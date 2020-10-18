const Discord = require("discord.js");
const Habit = require("../database/schemas/habittracker");
const Log = require("../database/schemas/habittracker");
const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
require("dotenv").config();

const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const habitMax = fn.habitMaxTier1;
const habitArchiveMax = fn.habitArchiveMaxTier1;
const habitEmbedColour = fn.habitEmbedColour;
const areasOfLifeEmojis = fn.areasOfLifeEmojis;
const areasOfLife = fn.areasOfLife;
const areasOfLifeCombinedEmoji = fn.getAreasOfLifeEmojiCombinedArray();
const areasOfLifeList = fn.getAreasOfLifeList().join('\n');

// Private Function Declarations

async function getHabitIndexByFunction(userID, habitID, totalHabits, archived, getOneHabit) {
    let i = 0;
    while (true) {
        let habit = await getOneHabit(userID, i, archived);
        if (habit === undefined && i === totalHabits) {
            return false;
        }
        else if (habit._id.toString() === habitID.toString()) break;
        i++;
    }
    return i + 1;
}

async function getOneHabitByRecency(userID, habitIndex, archived = undefined) {
    const habit = await Habit
        .findOne({ userID, archived })
        .sort({ _id: -1 })
        .skip(habitIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return habit;
}

async function getOneHabitByCreatedAt(userID, habitIndex, archived = undefined) {
    const habit = await Habit
        .findOne({ userID, archived })
        .sort({ createdAt: +1, })
        .skip(habitIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return habit;
}

async function getOneHabitByObjectID(habitID) {
    const habit = await Habit.findById(habitID)
        .catch(err => {
            console.log(err);
            return false;
        });
    return habit;
}

async function getHabitsByCreatedAt(userID, entryIndex, numberOfEntries = 1, archived = undefined) {
    try {
        const goals = await Habit
            .find({ userID, archived })
            .sort({ createdAt: +1, })
            .limit(numberOfEntries)
            .skip(entryIndex);
        return goals;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

async function getRecentGoalIndex(userID, archived) {
    try {
        var index;
        const entries = await Habit
            .find({ userID, archived })
            .sort({ createdAt: +1, });
        if (entries.length) {
            let targetID = await Habit
                .findOne({ userID, archived })
                .sort({ _id: -1 });
            targetID = targetID._id.toString();
            console.log({ targetID });
            for (i = 0; i < entries.length; i++) {
                if (entries[i]._id.toString() === targetID) {
                    index = i + 1;
                    return index;
                }
            }
        }
        else return -1;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

function getHabitReadOrDeleteHelp(PREFIX, commandUsed, crudCommand) {
    return `**USAGE:**\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> past <PAST_#_OF_ENTRIES> <recent?> <force?>\``
        + `\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> <ENTRY #> <recent?> <force?>\``
        + `\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> many <MANY_ENTRIES> <recent?> <force?>\``
        + `\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> <#_OF_ENTRIES> <recent?> past <STARTING_INDEX> <force?>\``
        + `\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; 5** (\\*any number); **all** \n(NOTE: ***__any number > 1__* will get more than 1 goal!**)`
        + `\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\**any number*)`
        + `\n\n\`<ENTRY_#>\`: **all; recent; 3** (3rd most recent goal, \\**any number*)\n(NOTE: Gets just 1 goal - UNLESS \`all\`)`
        + `\n\n\`<MANY_ENTRIES>\`: **3,5,recent,7,1,25**\n- **COMMA SEPARATED, NO SPACES:**\n1 being the most recent goal, 25 the 25th most recent, etc.`
        + `\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived goals!**`
        + `\n\n\`<recent?>\`: (OPT.) type **recent** at the indicated spot to sort the goals by **time created instead of goal start time!**`
        + `\n\n\`<force?>\`: (OPT.) type **force** at the end of your command to **skip all of the confirmation windows!**`;
}

module.exports = {
    name: "habit",
    description: "Long-term goal setting handler",
    aliases: ["habits", "hab", "ha", "h",],
    cooldown: 3,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        // create, archive, current, see <progress for this habit>, pastweek (as per Sunday reset), past <number>
        // see - show stats
        // Allow users to check habit ✅, 🔲, *SKIP habit if something happends (leave a ➖)
        // Set Habit Description - 50 words or less!
        // LAST Habit check-in time/date

        // When posting or editing habit: Allow them to choose to repost or just edit existing and 
        // Prompt users to strike through their previous number count (for number based habits)!

        // Connect with mastermind to be able to make a few weekly goals into a habit (comma separate which goals to transform)
        // FOR SUPER quick and easy habit logging for the week!

        const authorID = message.author.id;
        const authorUsername = message.author.username;
        const userSettings = await User.findOne({ discordID: authorID });
        const { tier } = userSettings;
        let habitUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<ACTION>\`: **add; see; today; log; edit; end; archive; delete; post**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        habitUsageMessage = fn.getMessageEmbed(habitUsageMessage, "Habit: Help", habitEmbedColour);
        const habitHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        const habitCommand = args[0].toLowerCase();
        const habitActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${habitCommand} help\``;
        let habitType = args[1] ? args[1].toLowerCase() : false;
        let totalHabitNumber = await Habit.find({ archived: false }).countDocuments();
        let totalArchiveNumber = await Habit.find({ archived: true }).countDocuments();
        const archiveRegex = /^(archive[ds]?|arch|ar?)$/i;
        const isArchived = archiveRegex.test(habitType);
        const archiveShift = isArchived ? 1 : 0;
        console.log({ isArchived, archiveShift });

        if (habitCommand === "help") return message.channel.send(habitUsageMessage);


        else if (habitCommand === "start" || habitCommand === "create" || habitCommand === "s" || habitCommand === "set"
            || habitCommand === "c" || habitCommand === "make" || habitCommand === "m" || habitCommand === "add") {
            if (tier === 1) {
                if (totalHabitNumber >= habitMax) {
                    return message.channel.send(fn.getMessageEmbed(fn.getTierMaxMessage(PREFIX, commandUsed, habitMax, ["Habit", "Habits"], 1, false),
                        `Habit: Tier 1 Maximum`, habitEmbedColour).setFooter(fn.premiumFooterText));
                }
            }
            /**
             * Iteratively create new habits until the user is finished!
             */

            var habitDocument, reset;
            const additionalInstructions = `Type \`reset\` to **reset** your current habit entry`;
            const additionalKeywords = ["reset"];
            do {
                reset = false;
                const habitDescription = await fn.getSingleEntry(bot, message, "👣📈 **What is the __habit__ you'd like to track?**",
                    `Habit: Creation - Description`, forceSkip, habitEmbedColour, additionalInstructions, additionalKeywords);
                if (!habitDescription && habitDescription !== "") return;
                else if (habitDescription === "reset") {
                    reset = true;
                    continue;
                }

                const habitDescriptionString = `__**Description:**__\n${habitDescription}**`;
                const habitAreaOfLife = await fn.userSelectFromList(bot, PREFIX, message, areasOfLifeList, areasOfLife.length,
                    `${habitDescriptionString}\n\n**__Which area of life does your habit fall under?__ 🌱**`, `Habit: Creation - Area of Life`, habitEmbedColour);
                if (!habitAreaOfLife && habitAreaOfLife !== 0) return;

                const habitTypeString = `__**Type:**__ ${areasOfLifeEmojis[habitAreaOfLife]} **${areasOfLife[habitAreaOfLife]}**\n${habitDescriptionString}`;
                const habitReason = await fn.getMultilineEntry(bot, PREFIX, message, habitTypeString
                    + `\n\n💭 **__Why__ do you want to incorporate this habit into your lifestyle?**`,
                    `Habit: Creation - Reason`, true, habitEmbedColour, additionalInstructions, additionalKeywords);
                if (!habitReason.message && habitReason.message !== "") return;
                else if (habitReason.returnVal === "reset") {
                    reset = true;
                    continue;
                }

                // Related goal?
                // with none as the last

                // Daily Reset or Weekly Reset?
                // Count Habit or Just check-in
                // Auto check based on count or streak

                // let resetScale = await fn.reactionDataCollect(bot, message, `📜 - **Daily (2-part) Journal Template** (*5-Minute Journal*)`
                //     + `\n🗣 - **Prompt/Question & Answer** (Enter a prompt or get a generated prompt)`
                //     + `\n✍ - \"**Freehand**\" (No template or prompt)\n❌ - **Exit**`, ['📜', '🗣', '✍', '❌'], "Journal: Template", habitEmbedColour);
                // switch (resetScale) {
                //     case '🌞': resetScale = true;
                //         break;
                //     case '📅': resetScale = false;
                //         break;
                //     default: resetScale = null;
                //         break;
                // }

                /**
                 * What type of habit is it?
                 * What goal does this relate to?
                 * Daily Reset or Weekly Reset?
                 * Count Habit or Just check-in
                 * Auto check based on count or streak
                 * 
                 * INTEGRATION: Connect it to Fasts, Journals, Masterminds (DO LAST - as a final connection)
                 * Fast:
                 * Auto - Track when you fasted for X hours on that given day
                 * Auto - Track if you've checked-in your fast
                 * Auto - Track if you've entered something (at least started/ended your fast) 
                 * Journal:
                 * Auto - Track when you just create and entry for the day
                 * Auto - Track when you start and/or finish a template
                 * Auto - Track when you enter X journal entries
                 * Mastermind:
                 * Auto - When you make an entry (weekly entry)
                 * Auto - Ask if they'd like to track any number of their weekly goals as habit
                 * 
                 * FOR ALL:
                 * - Track when you just use it - X entries
                 * -- Weekly or daily
                 * - Check if there is an entry
                 * - Track when you post an entry X times per day
                 * 
                 * Goal:
                 * - Ask them if they'd like to create a habit for the goal that they enter
                 * - 
                 * 
                 * Will need to refactor the code for each command (for integration):
                 * - Each start/end/edit/post command needs to update or create a log value
                 * 
                 */

                habitDocument = new Habit({
                    _id: mongoose.Types.ObjectId(),
                    userID: authorID,
                    archived: false,
                    description: habitDescription.message,
                    areaOfLife: habitAreaOfLife,
                    reason: habitReason.message,
                    settings: {
                        isCountType: false,
                    },
                });
                await habitDocument.save()
                    .then(async result => {
                        console.log({ result });
                        totalHabitNumber++;
                        message.reply(`**Habit ${await getHabitIndexByFunction(authorID, habitDocument._id, totalHabitNumber, false, getOneHabitByCreatedAt)} Saved!**`);
                    })
                    .catch(err => console.error(err));
            }
            while (reset)
            return;
        }


        else if (habitCommand === "delete" || habitCommand === "remove" || habitCommand === "del" || habitCommand === "d"
            || habitCommand === "rem" || habitCommand === "r") {
            /**
             * Allow them to delete any goals - archived or not
             */

            let goalDeleteUsageMessage = getHabitReadOrDeleteHelp(PREFIX, commandUsed, habitCommand);
            goalDeleteUsageMessage = fn.getMessageEmbed(goalDeleteUsageMessage, "Habit: Delete Help", habitEmbedColour);
            const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see ${isArchived ? `archive ` : ""}help\``;

            if (habitType) {
                if (habitType === "help") {
                    return message.channel.send(goalDeleteUsageMessage);
                }
                if (!totalHabitNumber) {
                    return message.reply(`**NO ${isArchived ? "ARCHIVED " : ""}HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
            }
            else return message.reply(habitActionHelpMessage);

            // delete past #:
            if (args[2 + archiveShift] !== undefined) {
                const deleteType = args[1 + archiveShift] ? args[1 + archiveShift].toLowerCase() : false;
                if (deleteType === "past") {
                    // If the following argument is not a number, exit!
                    if (isNaN(args[2 + archiveShift])) {
                        return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage);
                    }
                    var numberArg = parseInt(args[2 + archiveShift]);
                    if (numberArg <= 0) {
                        return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage);
                    }
                    let indexByRecency = false;
                    if (args[3 + archiveShift] !== undefined) {
                        if (args[3 + archiveShift].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    var habitCollection;
                    if (indexByRecency) habitCollection = await fn.getEntriesByRecency(Habit, { userID: authorID, archived: isArchived, }, 0, numberArg);
                    else habitCollection = await getHabitsByCreatedAt(authorID, 0, numberArg, isArchived);
                    const goalArray = fn.getEmbedArray(multipleGoalsToStringArray(message, habitCollection, numberArg, 0), '', true, false, habitEmbedColour);
                    const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} goals?**`;
                    const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, goalArray, multipleDeleteMessage, forceSkip,
                        `Habit${isArchived ? ` Archive` : ""}: Delete Past ${numberArg} Goals (${sortType})`, 600000);
                    if (!multipleDeleteConfirmation) return;
                    const targetIDs = await habitCollection.map(entry => entry._id);
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Goals (${sortType})`);
                    await deleteManyByIdAndReminders(targetIDs);
                    return;
                }
                if (deleteType === "many") {
                    if (args[2 + archiveShift] === undefined) {
                        return message.reply(habitActionHelpMessage);
                    }
                    // Get the arguments after keyword MANY
                    // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
                    // Convert String of Numbers array into Integer array
                    // Check which goals exist, remove/don't add those that don't
                    let toDelete = args[2 + archiveShift].split(',').filter(index => {
                        if (!isNaN(index)) {
                            numberIndex = parseInt(index);
                            if (numberIndex > 0 && numberIndex <= totalHabitNumber) {
                                return numberIndex;
                            }
                        }
                        else if (index === "recent") {
                            return true;
                        }
                    });
                    const recentIndex = await getRecentGoalIndex(authorID, isArchived);
                    toDelete = Array.from(new Set(toDelete.map((number) => {
                        if (number === "recent") {
                            if (recentIndex !== -1) return recentIndex;
                        }
                        else return +number;
                    })));
                    console.log({ toDelete });
                    // Send error message if none of the given reminders exist
                    if (!toDelete.length) {
                        return fn.sendErrorMessage(message, `All of these **${isArchived ? "archived " : ""}goals DO NOT exist**...`);
                    }
                    var indexByRecency = false;
                    if (args[3 + archiveShift] !== undefined) {
                        if (args[3 + archiveShift].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var goalTargetIDs = new Array();
                    var goalArray = new Array();
                    for (i = 0; i < toDelete.length; i++) {
                        var goalView;
                        if (indexByRecency) {
                            goalView = await getOneHabitByRecency(authorID, toDelete[i] - 1, isArchived);
                        }
                        else {
                            goalView = await getOneHabitByCreatedAt(authorID, toDelete[i] - 1, isArchived);
                        }
                        goalTargetIDs.push(goalView._id);
                        goalArray.push(`__**Habit ${toDelete[i]}:**__ ${goalDocumentToString(goalView)}`);
                    }
                    const deleteConfirmMessage = `Are you sure you want to **delete goals ${toDelete.toString()}?**`;
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    goalArray = fn.getEmbedArray(goalArray, '', true, false, habitEmbedColour);
                    const confirmDeleteMany = await fn.getPaginatedUserConfirmation(bot, message, goalArray, deleteConfirmMessage,
                        forceSkip, `Habit${isArchived ? ` Archive` : ""}: Delete Goals ${toDelete} (${sortType})`, 600000);
                    if (confirmDeleteMany) {
                        console.log(`Deleting ${authorID}'s Goals ${toDelete} (${sortType})`);
                        await deleteManyByIdAndReminders(goalTargetIDs);
                        return;
                    }
                    else return;
                }
                else {
                    var shiftIndex;
                    let indexByRecency = false;
                    if (args[2 + archiveShift].toLowerCase() === "past") {
                        shiftIndex = 0;
                        indexByRecency = false;
                    }
                    else if (args[2 + archiveShift].toLowerCase() === "recent") {
                        shiftIndex = 1;
                        indexByRecency = true;
                    }
                    console.log({ shiftIndex });
                    if (args[2 + archiveShift + shiftIndex]) {
                        if (args[2 + archiveShift + shiftIndex].toLowerCase() === "past") {
                            var skipEntries;
                            if (isNaN(args[3 + archiveShift + shiftIndex])) {
                                if (args[3 + archiveShift + shiftIndex].toLowerCase() === "recent") {
                                    skipEntries = await getRecentGoalIndex(authorID, isArchived);
                                }
                                else return message.reply(habitActionHelpMessage);
                            }
                            else skipEntries = parseInt(args[3 + archiveShift + shiftIndex]);
                            const pastNumberOfEntries = parseInt(args[1 + archiveShift]);
                            if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                                return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage);
                            }
                            var habitCollection;
                            if (indexByRecency) habitCollection = await fn.getEntriesByRecency(Habit, { userID: authorID, archived: isArchived, }, skipEntries, pastNumberOfEntries);
                            else habitCollection = await getHabitsByCreatedAt(authorID, skipEntries, pastNumberOfEntries, isArchived);
                            const goalArray = fn.getEmbedArray(multipleGoalsToStringArray(message, habitCollection, pastNumberOfEntries, skipEntries), '', true, false, habitEmbedColour);
                            if (skipEntries >= totalHabitNumber) return;
                            const sortType = indexByRecency ? "By Recency" : "By Date Created";
                            const multipleDeleteMessage = `Are you sure you want to **delete ${habitCollection.length} goals past goal ${skipEntries}?**`;
                            const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, goalArray, multipleDeleteMessage,
                                forceSkip, `Habit${isArchived ? ` Archive` : ""}: Multiple Delete Warning! (${sortType})`);
                            console.log({ multipleDeleteConfirmation });
                            if (!multipleDeleteConfirmation) return;
                            const targetIDs = await habitCollection.map(entry => entry._id);
                            console.log(`Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} goals past ${skipEntries} (${sortType})`);
                            await deleteManyByIdAndReminders(targetIDs);
                            return;
                        }

                        // They haven't specified the field for the goal delete past function
                        else if (deleteType === "past") return message.reply(habitActionHelpMessage);
                        else return message.reply(habitActionHelpMessage);
                    }
                }
            }
            // Next: GOAL DELETE ALL
            // Next: GOAL DELETE MANY
            // Next: GOAL DELETE

            // goal delete <NUMBER/RECENT/ALL>
            const noGoalsMessage = `**NO ${isArchived ? "ARCHIVED " : ""}HABITS**... try \`${PREFIX}${commandUsed} start help\``;
            if (isNaN(args[1 + archiveShift])) {
                const deleteType = habitType;
                if (deleteType === "recent") {
                    const habitView = await getOneHabitByRecency(authorID, 0, isArchived);
                    if (!habitView) return fn.sendErrorMessage(message, noGoalsMessage);
                    const goalTargetID = habitView._id;
                    console.log({ goalTargetID });
                    const goalIndex = await getRecentGoalIndex(authorID, isArchived);
                    const goalEmbed = fn.getEmbedArray(`__**Habit ${goalIndex}:**__ ${goalDocumentToString(habitView)}`,
                        `Habit${isArchived ? ` Archive` : ""}: Delete Recent Habit`, true, true, habitEmbedColour);
                    const deleteConfirmMessage = `Are you sure you want to **delete your most recent goal?:**`;
                    const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(bot, message, goalEmbed, deleteConfirmMessage, forceSkip,
                        `Habit${isArchived ? ` Archive` : ""}: Delete Recent Habit`, 600000);
                    if (deleteIsConfirmed) {
                        await deleteOneByIdAndReminders(goalTargetID);
                        return;
                    }
                }
                else if (deleteType === "all") {
                    const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded goals?\n\nYou **cannot UNDO** this!" +
                        `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    const pastNumberOfEntriesIndex = totalHabitNumber;
                    if (pastNumberOfEntriesIndex === 0) {
                        return fn.sendErrorMessage(message, noGoalsMessage);
                    }
                    let confirmDeleteAll = await fn.getUserConfirmation(message, confirmDeleteAllMessage, forceSkip, `Habit${isArchived ? ` Archive` : ""}: Delete All Goals WARNING!`);
                    if (!confirmDeleteAll) return;
                    const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR HABITS ON RECORD**?\n\nYou **cannot UNDO** this!"
                        + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    let finalConfirmDeleteAll = await fn.getUserConfirmation(message, finalDeleteAllMessage, `Habit${isArchived ? ` Archive` : ""}: Delete ALL Goals FINAL Warning!`);
                    if (!finalConfirmDeleteAll) return;
                    console.log(`Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Goals`);
                    await deleteUserGoalsAndReminders(authorID);
                    return;
                }
                else return message.reply(habitActionHelpMessage);
            }
            else {
                const pastNumberOfEntriesIndex = parseInt(args[1 + archiveShift]);
                let indexByRecency = false;
                if (args[2 + archiveShift] !== undefined) {
                    if (args[2 + archiveShift].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var goalView;
                if (indexByRecency) goalView = await getOneHabitByRecency(authorID, pastNumberOfEntriesIndex - 1, isArchived);
                else goalView = await getOneHabitByCreatedAt(authorID, pastNumberOfEntriesIndex - 1, isArchived);
                if (!goalView) {
                    return fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, `**${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST**...`);
                }
                const goalTargetID = goalView._id;
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const goalEmbed = fn.getEmbedArray(`__**Habit ${pastNumberOfEntriesIndex}:**__ ${goalDocumentToString(goalView)}`,
                    `Habit${isArchived ? ` Archive` : ""}: Delete Habit ${pastNumberOfEntriesIndex} (${sortType})`, true, true, habitEmbedColour);
                const deleteConfirmMessage = `Are you sure you want to **delete Habit ${pastNumberOfEntriesIndex}?**`;
                const deleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, goalEmbed, deleteConfirmMessage, forceSkip,
                    `Habit${isArchived ? ` Archive` : ""}: Delete Habit ${pastNumberOfEntriesIndex} (${sortType})`, 600000);
                if (deleteConfirmation) {
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Habit ${sortType}`);
                    await deleteOneByIdAndReminders(goalTargetID);
                    return;
                }
            }
        }



        else if (habitCommand === "see" || habitCommand === "show") {
            let goalSeeUsageMessage = getHabitReadOrDeleteHelp(PREFIX, commandUsed, habitCommand);
            goalSeeUsageMessage = fn.getMessageEmbed(goalSeeUsageMessage, `Habit${isArchived ? ` Archive` : ""}: See Help`, habitEmbedColour);

            const seeCommands = ["past", "recent", "all"];

            if (habitType) {
                if (habitType === "help") {
                    return message.channel.send(goalSeeUsageMessage);
                }
                if (!totalHabitNumber) {
                    return message.reply(`**NO ${isArchived ? `ARCHIVED ` : ""}HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
                else if (habitType === "number") {
                    return message.reply(`You have **${totalHabitNumber} goal entries** on record.`);
                }
            }
            else return message.reply(habitActionHelpMessage);

            // Show the user the last goal with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(habitType) && !archiveRegex.test(habitType) && isNaN(habitType)) {
                return message.reply(habitActionHelpMessage);
            }
            // Do not show the most recent goal embed, when a valid command is called
            // it will be handled properly later based on the values passed in!
            else {
                const seeType = habitType;
                var pastFunctionality,
                    goalIndex;
                let indexByRecency = false;
                // To check if the given argument is a number!
                // If it's not a number and has passed the initial 
                // filter, then use the "past" functionality
                // Handling Argument 1:
                const isNumberArg = !isNaN(args[1 + archiveShift]);
                if (seeType === "recent") {
                    return message.channel.send(await getRecentGoal(authorID, isArchived, habitEmbedColour));
                }
                else if (seeType === "all") {
                    goalIndex = totalHabitNumber;
                    pastFunctionality = true;
                }
                else if (isNumberArg) {
                    goalIndex = parseInt(args[1 + archiveShift]);
                    if (goalIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage, `**${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST**...`);
                    }
                    else pastFunctionality = false;
                }
                else if (seeType === "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else return message.reply(habitActionHelpMessage);
                console.log({ pastNumberOfEntriesIndex: goalIndex, pastFunctionality });
                if (pastFunctionality) {
                    // Loop through all of the given fields, account for aliases and update fields
                    // Find Goals, toArray, store data in meaningful output
                    if (args[3 + archiveShift] !== undefined) {
                        if (args[3 + archiveShift].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    if (args[2 + archiveShift] !== undefined) {
                        // If the next argument is NotaNumber, invalid "past" command call
                        if (isNaN(args[2 + archiveShift])) return message.reply(habitActionHelpMessage);
                        if (parseInt(args[2 + archiveShift]) <= 0) return message.reply(habitActionHelpMessage);
                        const confirmSeeMessage = `Are you sure you want to **see ${args[2 + archiveShift]} goals?**`;
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeMessage, forceSkip, `Habit${isArchived ? ` Archive` : ""}: See ${args[2 + archiveShift]} Goals (${sortType})`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (seeType !== "all") return message.reply(habitActionHelpMessage);
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your goal history?";
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeAllMessage, forceSkip, `Habit${isArchived ? ` Archive` : ""}: See All Goals`);
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                    if (goalIndex === undefined) {
                        goalIndex = parseInt(args[2 + archiveShift]);
                    }
                    var goalView;
                    if (indexByRecency) goalView = await fn.getEntriesByRecency(Habit, { userID: authorID, archived: isArchived }, 0, goalIndex);
                    else goalView = await getHabitsByCreatedAt(authorID, 0, goalIndex, isArchived);
                    console.log({ goalView, pastNumberOfEntriesIndex: goalIndex });
                    const goalArray = multipleGoalsToStringArray(message, goalView, goalIndex, 0);
                    await fn.sendPaginationEmbed(bot, message.channel.id, authorID, fn.getEmbedArray(goalArray, `Habit${isArchived ? ` Archive` : ""}: See ${goalIndex} Goals (${sortType})`, true, true, habitEmbedColour));
                    return;
                }
                // see <PAST_#_OF_ENTRIES> <recent> past <INDEX>
                if (args[2 + archiveShift] !== undefined) {
                    var shiftIndex;
                    if (args[2 + archiveShift].toLowerCase() === "past") {
                        shiftIndex = 0;
                        indexByRecency = false;
                    }
                    else if (args[2 + archiveShift].toLowerCase() === "recent") {
                        shiftIndex = 1;
                        indexByRecency = true;
                    }
                    if (args[2 + archiveShift + shiftIndex]) {
                        if (args[2 + archiveShift + shiftIndex].toLowerCase() === "past") {
                            if (args[3 + archiveShift + shiftIndex] !== undefined) {
                                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                                var entriesToSkip;
                                // If the argument after past is a number, valid command call!
                                if (!isNaN(args[3 + archiveShift + shiftIndex])) {
                                    entriesToSkip = parseInt(args[3 + archiveShift + shiftIndex]);
                                }
                                else if (args[3 + archiveShift + shiftIndex].toLowerCase() === "recent") {
                                    entriesToSkip = await getRecentGoal(authorID, isArchived, habitEmbedColour);
                                }
                                else return message.reply(habitActionHelpMessage);
                                if (entriesToSkip < 0 || entriesToSkip > totalHabitNumber) {
                                    return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage, `**${isArchived ? "ARCHIVED " : ""}GOAL(S) DO NOT EXIST**...`);
                                }
                                const confirmSeePastMessage = `Are you sure you want to **see ${args[1 + archiveShift]} entries past ${entriesToSkip}?**`;
                                const confirmSeePast = await fn.getUserConfirmation(message, confirmSeePastMessage, forceSkip, `Habit${isArchived ? ` Archive` : ""}: See ${args[1 + archiveShift]} Goals Past ${entriesToSkip} (${sortType})`);
                                if (!confirmSeePast) return;
                                var goalView;
                                if (indexByRecency) goalView = await fn.getEntriesByRecency(Habit, { userID: authorID, archived: isArchived }, entriesToSkip, goalIndex);
                                else goalView = await getHabitsByCreatedAt(authorID, entriesToSkip, goalIndex, isArchived);
                                console.log({ goalView });
                                const goalStringArray = multipleGoalsToStringArray(message, goalView, goalIndex, entriesToSkip);
                                await fn.sendPaginationEmbed(bot, message.channel.id, authorID, fn.getEmbedArray(goalStringArray, `Habit${isArchived ? ` Archive` : ""}: See ${goalIndex} Goals Past ${entriesToSkip} (${sortType})`, true, true, habitEmbedColour));
                                return;
                            }
                        }
                    }
                }
                if (args[2 + archiveShift] !== undefined) {
                    if (args[2 + archiveShift].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var goalView;
                if (indexByRecency) goalView = await getOneHabitByRecency(authorID, goalIndex - 1, isArchived);
                else goalView = await getOneHabitByCreatedAt(authorID, goalIndex - 1, isArchived);
                console.log({ goalView });
                if (!goalView) {
                    return fn.sendErrorMessage(message, `**${isArchived ? "ARCHIVED " : ""}GOAL ${goalIndex} DOES NOT EXIST**...`);
                }
                // NOT using the past functionality:
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const goalString = `__**Habit ${goalIndex}:**__ ${goalDocumentToString(goalView)}`;
                const goalEmbed = fn.getEmbedArray(goalString, `Habit${isArchived ? ` Archive` : ""}: See Habit ${goalIndex} (${sortType})`, true, true, habitEmbedColour);
                await fn.sendPaginationEmbed(bot, message.channel.id, authorID, goalEmbed);
            }
        }


        else if (habitCommand === "edit" || habitCommand === "change" || habitCommand === "ed"
            || habitCommand === "ch" || habitCommand === "c") {
            let goalEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <archive?> <GOAL #> <recent?> <force?>\``
                + "\n\n`<GOAL #>`: **recent; 3** (3rd most recent entry, \\**any number*)"
                + `\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived goals!**`
                + "\n\n`<recent?>`(OPT.): type **recent** at the indicated spot to sort the goals by **actual time created instead of goal start time!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            goalEditUsageMessage = fn.getMessageEmbed(goalEditUsageMessage, `Habit: Edit Help`, habitEmbedColour);
            if (habitType) {
                if (habitType === "help") {
                    return message.channel.send(goalEditUsageMessage);
                }
                if (!totalHabitNumber) {
                    return message.reply(`**NO ${isArchived ? "ARCHIVED " : ""}HABITS**... try \`${PREFIX}${commandUsed} start\` to set one up!`);
                }
                if (isNaN(habitType) && habitType !== "recent" && !archiveRegex.test(habitType)) {
                    return message.reply(habitActionHelpMessage);
                }
            }
            habitType = isArchived ? args[2] ? args[2].toLowerCase() : false : habitType;
            if (habitType) {
                var goalIndex;
                if (habitType === "recent") {
                    goalIndex = await getRecentGoalIndex(authorID, isArchived);
                }
                else {
                    goalIndex = parseInt(habitType);
                    if (goalIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage, `**${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST**...`);
                    }
                }

                var indexByRecency = false;
                if (args[2 + archiveShift] !== undefined) {
                    if (args[2 + archiveShift].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var habitDocument;
                if (indexByRecency) habitDocument = await getOneHabitByRecency(authorID, goalIndex - 1, isArchived);
                else habitDocument = await getOneHabitByCreatedAt(authorID, goalIndex - 1, isArchived);
                if (!habitDocument) {
                    return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage, `**${isArchived ? "ARCHIVED " : ""}GOAL ${goalIndex} DOES NOT EXIST**...`);
                }
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                var goalFields = ["Start Time", "End Time", "Area of Life", "Description", "Reason", "Checkpoints", "Actionable Steps", "Completed", "Archived"];
                let fieldsList = "";
                goalFields.forEach((field, i) => {
                    fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
                });
                const goalTargetID = habitDocument._id;
                var showGoal, continueEdit;
                do {
                    const checkGoal = await getOneHabitByObjectID(goalTargetID);
                    if (!checkGoal) return;
                    continueEdit = false;
                    showGoal = goalDocumentToString(habitDocument);
                    // Field the user wants to edit
                    const fieldToEditInstructions = "**Which field do you want to edit?:**";
                    const fieldToEditAdditionalMessage = `__**Habit ${goalIndex} (${sortType}):**__ ${showGoal}`;
                    const fieldToEditTitle = `Habit${isArchived ? " Archive" : ""}: Edit Field`;
                    let fieldToEditIndex = await fn.userSelectFromList(bot, PREFIX, message, fieldsList, goalFields.length, fieldToEditInstructions,
                        fieldToEditTitle, habitEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                    if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                    var userEdit, goalEditMessagePrompt = "";
                    const fieldToEdit = goalFields[fieldToEditIndex];
                    const type = `Habit${isArchived ? " Archive" : ""}`;
                    let { goal, completed, archived } = habitDocument;
                    switch (fieldToEditIndex) {
                        case 0:
                            goalEditMessagePrompt = "\n__**Please enter the date/time ⌚ of when you started this goal:**__";
                            userEdit = await fn.getUserEditString(bot, message, fieldToEdit, goalEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            break;
                        case 1:
                            goalEditMessagePrompt = "\n__**Please enter the date/time ⌚ of when you ended or intend to end this goal:**__";
                            userEdit = await fn.getUserEditString(bot, message, fieldToEdit, goalEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            break;
                        case 2:
                            goalEditMessagePrompt = `\n**__Which area of life does your habit fall under?__ 🌱**\n${areasOfLifeList}`;
                            userEdit = await fn.getUserEditNumber(bot, message, fieldToEdit, areasOfLife.length, type, areasOfLifeCombinedEmoji, forceSkip, habitEmbedColour, goalEditMessagePrompt);
                            if (!userEdit) return;
                            else if (userEdit === "back") break;
                            userEdit--;
                            goal.type = userEdit;
                            break;
                        case 3:
                            goalEditMessagePrompt = "\n🎯 **What is your __habit__?**";
                            userEdit = await fn.getUserEditString(bot, message, fieldToEdit, goalEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            goal.description = userEdit;
                            break;
                        case 4:
                            goalEditMessagePrompt = "\n💭 **__Why__ do you want to accomplish this goal?**";
                            userEdit = await fn.getUserMultilineEditString(bot, PREFIX, message, fieldToEdit, goalEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            goal.reason = userEdit;
                            break;
                        case 5:
                            goalEditMessagePrompt = "\n🏁 **What are some __checkpoints__ that would indicate progress on this goal?**";
                            userEdit = await fn.getUserMultilineEditString(bot, PREFIX, message, fieldToEdit, goalEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            goal.checkpoints = userEdit;
                            break;
                        case 6:
                            goalEditMessagePrompt = "\n👣 **What are some __actionable steps__ for this goal?**";
                            userEdit = await fn.getUserMultilineEditString(bot, PREFIX, message, fieldToEdit, goalEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            goal.steps = userEdit;
                            break;
                        case 7:
                            goalEditMessagePrompt = `\n**__Currently:__ ${completed ? "Completed" : "In Progress"}\n\n✅ - Completed\n\n🏃‍♂️ - In Progress**`;
                            userEdit = await fn.getUserEditBoolean(bot, message, fieldToEdit, goalEditMessagePrompt, ['✅', '🏃‍♂️'], type, forceSkip, habitEmbedColour);
                            break;
                        case 8:
                            goalEditMessagePrompt = `\n**__Currently:__ ${archived ? "Archived" : "NOT Archived"}\n\n📁 - Archive\n\n📜 - No Archive**`;
                            userEdit = await fn.getUserEditBoolean(bot, message, fieldToEdit, goalEditMessagePrompt, ['📁', '📜'], type, forceSkip, habitEmbedColour);
                            break;
                    }
                    console.log({ userEdit });
                    if (userEdit === false) return;
                    else if (userEdit === undefined) userEdit = "back";
                    else if (userEdit !== "back") {
                        if (fieldToEditIndex === 0 || fieldToEditIndex === 1 || fieldToEditIndex === 7 || fieldToEditIndex === 8) {
                            await Reminder.deleteMany({ connectedDocument: goalTargetID });
                        }
                        // Parse User Edit
                        if (fieldToEditIndex === 0 || fieldToEditIndex === 1) {
                            const now = Date.now();
                            userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                            console.log({ userEdit });
                            userEdit = fn.timeCommandHandlerToUTC(userEdit, now, timezoneOffset, daylightSavings);
                            if (!userEdit) {
                                fn.sendReplyThenDelete(message, `**INVALID TIME**... ${habitHelpMessage}`, 60000);
                                continueEdit = true;
                            }
                            switch (fieldToEditIndex) {
                                case 0: goal.start = userEdit;
                                    break;
                                case 1: goal.end = userEdit;
                                    break
                                default: continueEdit = true;
                                    break;
                            }
                            await setGoalReminders(bot, authorID, timezoneOffset, PREFIX, commandUsed,
                                goalTargetID, goal.description, totalHabitNumber, goal.start, now, goal.end);
                        }
                        else if (fieldToEditIndex === 7) {
                            switch (userEdit) {
                                case '✅': userEdit = true;
                                    break;
                                case '🏃‍♂️': userEdit = false;
                                    break;
                                default: continueEdit = true;
                            }
                        }
                        else if (fieldToEditIndex === 8) {
                            switch (userEdit) {
                                case '📁': userEdit = true;
                                    break;
                                case '📜': userEdit = false;
                                    break;
                                default: continueEdit = true;
                            }
                        }
                    }
                    else continueEdit = true;
                    console.log({ userEdit });
                    if (!continueEdit) {
                        try {
                            console.log(`Editing ${authorID}'s Habit ${goalIndex} (${sortType})`);
                            if (fieldToEditIndex === 7) habitDocument = await Habit.findOneAndUpdate({ _id: goalTargetID }, { $set: { completed: userEdit } }, { new: true });
                            else if (fieldToEditIndex === 8) habitDocument = await Habit.findOneAndUpdate({ _id: goalTargetID }, { $set: { archived: userEdit } }, { new: true });
                            else habitDocument = await Habit.findOneAndUpdate({ _id: goalTargetID }, { $set: { goal } }, { new: true });
                            console.log({ continueEdit });
                            if (habitDocument) {
                                goalIndex = indexByRecency ?
                                    await getHabitIndexByFunction(authorID, goalTargetID, isArchived ? totalArchiveNumber : totalHabitNumber, isArchived, getOneHabitByRecency)
                                    : await getHabitIndexByFunction(authorID, goalTargetID, isArchived ? totalArchiveNumber : totalHabitNumber, isArchived, getOneHabitByCreatedAt);
                                console.log({ goalDocument: habitDocument, goalTargetID, fieldToEditIndex });
                                showGoal = goalDocumentToString(habitDocument);
                                const continueEditMessage = `Do you want to continue **editing Habit ${goalIndex}?:**\n\n__**Habit ${goalIndex}:**__ ${showGoal}`;
                                continueEdit = await fn.getUserConfirmation(message, continueEditMessage, forceSkip, `Habit${isArchived ? " Archive" : ""}: Continue Editing Habit ${goalIndex}?`, 300000);
                            }
                            else {
                                message.reply("**Habit not found...**");
                                continueEdit = false;
                            }
                        }
                        catch (err) {
                            return console.log(err);
                        }
                    }
                    else {
                        console.log({ continueEdit, userEdit });
                        habitDocument = await Habit.findById(goalTargetID);
                        if (habitDocument) {
                            goalIndex = indexByRecency ?
                                await getHabitIndexByFunction(authorID, goalTargetID, isArchived ? totalArchiveNumber : totalHabitNumber, isArchived, getOneHabitByCreatedAt)
                                : await getHabitIndexByFunction(authorID, goalTargetID, isArchived ? totalArchiveNumber : totalHabitNumber, isArchived, getOneHabitByRecency);
                            console.log({ goalDocument: habitDocument, goalTargetID, fieldToEditIndex });
                            showGoal = goalDocumentToString(habitDocument);
                        }
                        else {
                            message.reply(`**${isArchived ? "Archived " : ""}Habit not found...**`);
                            continueEdit = false;
                        }
                    }
                }
                while (continueEdit === true);
                return;
            }
            else return message.reply(habitActionHelpMessage);
        }


        else if (habitCommand === "post" || habitCommand === "p") {
            let goals = await Habit.find({ archived: false }).sort({ 'goal.start': +1 });
            if (!goals) return message.reply(`**You don't have any goals**, try \`${PREFIX}${commandUsed} start\``);
            const targetChannel = await fn.getPostChannel(bot, PREFIX, message, `Habit`, forceSkip, habitEmbedColour);
            if (!targetChannel) return;
            const member = bot.channels.cache.get(targetChannel).guild.member(authorID);
            const goalStringArray = multipleGoalsToStringArray(message, goals, totalHabitNumber, 0);
            if (goalStringArray.length) goalStringArray[0] = `<@!${authorID}>\n${goalStringArray[0]}`;
            const posts = fn.getEmbedArray(goalStringArray, `${member ? `${member.displayName}'s ` : ""}Long-Term Goals`
                + ` (as of ${new Date(Date.now() + HOUR_IN_MS * timezoneOffset).getUTCFullYear()})`, true, false, habitEmbedColour);
            posts.forEach(async post => {
                await fn.sendMessageToChannel(bot, post, targetChannel);
            });
            return;
        }


        else if (habitCommand === "end" || habitCommand === "e" || habitCommand === "complete" || habitCommand === "log") {
            // (similar indexing to edit, recent or #) + archive
            // Make a list - similar to archive
            let goalEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <archive?> <recent?> <force?>\``
                + `\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived goals!**`
                + "\n\n`<recent?>`(OPT.): type **recent** to order the goals by **actual time created instead of goal start time!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            goalEditUsageMessage = fn.getMessageEmbed(goalEditUsageMessage, `Habit: End Help`, habitEmbedColour);
            if (habitType === "help") return message.channel.send(goalEditUsageMessage);

            var indexByRecency = false;
            if (args[1 + archiveShift] !== undefined) {
                if (args[1 + archiveShift].toLowerCase() === "recent") {
                    indexByRecency = true;
                }
            }

            do {
                var goalArray;
                if (indexByRecency) goalArray = await Habit.find({ archived: isArchived, completed: false }, { _id: 1, "goal.description": 1 }).sort({ _id: -1 });
                else goalArray = await Habit.find({ archived: isArchived, completed: false }, { _id: 1, "goal.description": 1 }).sort({ "goal.start": +1 });
                if (!goalArray.length) return message.reply(`**No ${isArchived ? "archived " : ""}goals** were found... Try \`${PREFIX}${commandUsed} help\` for help!`);

                let goalList = "";
                goalArray.forEach((element, i) => {
                    goalList += `\`${i + 1}\` - ${element.goal.description}\n`;
                });

                let targetGoalIndex = await fn.userSelectFromList(bot, PREFIX, message, goalList, goalArray.length, "__**Which goal would you like to end?:**__",
                    `Habit${isArchived ? " Archive" : ""}: End Selection`, habitEmbedColour, 600000, 0);
                if (!targetGoalIndex) return;
                const targetGoal = goalArray[targetGoalIndex];
                const confirmEnd = await fn.getUserConfirmation(message, `**Are you sure you want to mark this goal as complete?**\n🎯 - __**Description:**__\n${targetGoal.goal.description}`,
                    forceSkip, `Habit${isArchived ? " Archive" : ""}: End Confirmation`);
                if (confirmEnd) await Habit.updateOne({ _id: targetGoal._id }, { $set: { completed: true, "goal.end": Date.now() + HOUR_IN_MS * timezoneOffset } },
                    (err, result) => {
                        if (err) return console.error(err);
                        console.log({ result });
                        Reminder.deleteMany({ connectedDocument: targetGoal._id });
                    });
                else continue;
            }
            while (true)
        }


        else if (habitCommand === "log" || habitCommand === "track" || habitCommand === "check") {

        }


        else if (habitCommand === "today" || habitCommand === "tod" || habitCommand === "current" || habitCommand === "now") {

        }


        else if (archiveRegex.test(habitCommand) || habitCommand === "stash" || habitCommand === "store") {
            if (tier === 1) {
                if (totalArchiveNumber >= habitArchiveMax) {
                    return message.channel.send(fn.getMessageEmbed(fn.getTierMaxMessage(PREFIX, commandUsed, habitArchiveMax, ["Habit", "Habits"], 1, true),
                        `Habit Archive: Tier 1 Maximum`, habitEmbedColour).setFooter(fn.premiumFooterText));
                }
            }
            // Allows for archive - indexing by unarchived entries only!
            let goalEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <recent?> <force?>\``
                + "\n\n`<recent?>`(OPT.): type **recent** to order the goals by **actual time created instead of goal start time!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            goalEditUsageMessage = fn.getMessageEmbed(goalEditUsageMessage, `Habit: Archive Help`, habitEmbedColour);
            if (habitType === "help") return message.channel.send(goalEditUsageMessage);

            var indexByRecency = false;
            if (args[1] !== undefined) {
                if (args[1].toLowerCase() === "recent") {
                    indexByRecency = true;
                }
            }

            do {
                var goalArray;
                if (indexByRecency) goalArray = await Habit.find({ archived: false }, { _id: 1, "goal.description": 1 }).sort({ _id: -1 });
                else goalArray = await Habit.find({ archived: false }, { _id: 1, "goal.description": 1 }).sort({ "goal.start": +1 });
                if (!goalArray.length) return message.reply(`**No ${isArchived ? "archived " : ""}goals** were found... Try \`${PREFIX}${commandUsed} help\` for help!`);

                let goalList = "";
                goalArray.forEach((element, i) => {
                    goalList += `\`${i + 1}\` - ${element.goal.description}\n`;
                });

                let targetGoalIndex = await fn.userSelectFromList(bot, PREFIX, message, goalList, goalArray.length, "__**Which goal would you like to archive?:**__",
                    `Habit${isArchived ? " Archive" : ""}: Archive Selection`, habitEmbedColour, 600000, 0);
                if (!targetGoalIndex) return;
                const targetGoal = goalArray[targetGoalIndex];
                const confirmEnd = await fn.getUserConfirmation(message, `**Are you sure you want to archive this goal?**`
                    + `\n(it will not be deleted, but won't show up in your \`${PREFIX}${commandUsed} post\`\nand you won't get reminders for it anymore)`
                    + `\n\n🎯 - __**Description:**__\n${targetGoal.goal.description}`,
                    forceSkip, `Habit${isArchived ? " Archive" : ""}: Archive Confirmation`);
                if (confirmEnd) await Habit.updateOne({ _id: targetGoal._id }, { $set: { archived: true } }, (err, result) => {
                    if (err) return console.error(err);
                    console.log({ result });
                    Reminder.deleteMany({ connectedDocument: targetGoal._id });
                });
                else continue;
            }
            while (true)
        }


        else return message.reply(habitHelpMessage);
    }
};