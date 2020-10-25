const Discord = require("discord.js");
const Habit = require("../database/schemas/habittracker");
const Log = require("../database/schemas/habittracker");
const User = require("../database/schemas/user");
const Goal = require("../database/schemas/longtermgoals");
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
async function habitDocumentToString(habitDocument, showSettings = false, showRecentStats = false,) {
    const { userID, createdAt, archived, description, areaOfLife, reason,
        connectedGoal, settings, pastWeek, pastMonth, pastYear, nextCron } = habitDocument;
    const userSettings = await User.findOne({ discordID: userID }, { _id: 0, habitCron: 1, 'timezone.offset': 1, });
    const { habitCron, 'timezone.offset': timezoneOffset } = userSettings;
    const goalDocument = await Goal.findById(connectedGoal);
    let connectedGoalString = "";
    if (goalDocument) if (goalDocument.goal) if (goalDocument.goal.description) {
        connectedGoalString = `🎯 - **Associated Goal:** ${goalDocument.goal.description}`;
    }
    let statsString = "";
    if (showRecentStats) {
        const currentDate = new Date(Date.now() + HOUR_IN_MS * timezoneOffset);
        if (habitCron) if (habitCron.weekly || habitCron.weekly === 0) {
            statsString = `**Past Week:** ${pastWeek || 0}/${7 - ((6 - (currentDate.getUTCDay() - habitCron.weekly)) % 7 + 1) + 1}\n`;
        }
        statsString += `**Past Month:** ${pastMonth || 0}/${currentDate.getUTCDate()}`;
        statsString += `\n**Past Year:** ${pastYear || 0}/${fn.getDayOfYear(currentDate.getTime())}`;
    }
    let settingsString = "";
    if (showSettings && settings) {
        statsString += '\n';
        const cronString = `**Habit Reset Time:** Every ${settings.cronPeriods || 1}`
            + ` ${settings.isWeeklyType ? "week(s)" : "day(s)"} at ${fn.msToTimeFromMidnight(habitCron.daily)}`;
        let countGoalString = "";
        switch (settings.countGoalType) {
            case 1: countGoalString = `\n- **Daily Goal:** ${settings.countGoal || "None"}`;
                break;
            case 2: countGoalString = `\n- **Weekly Goal:** ${settings.countGoal || "None"}`;
                break;
            case 3: countGoalString = `\n- **Total/Cumulative Goal:** ${settings.countGoal || "None"}`;
                break;
        }
        let autoLogString = "No";
        switch (settings.autoLogType) {
            case 1: autoLogString = "Streak";
                break;
            case 2: autoLogString = "Based on Count Goal";
                break;
        }
        settingsString += `${cronString}\n**Count Habit:** ${settings.isCountType ? "Yes" : "No"}`
            + `\n- **Metric:** ${settings.countMetric || "N/A"}`
            + countGoalString
            + `\n**Auto Log:** ${autoLogString}`
            + `\n**Weekly:** ${settings.isWeeklyType ? "Yes" : "No"}`;
        // let integrationType = "";
        // if (settings.integration) {
        //     if (settings.integration.name) {
        //         integrationType = `**Connected Type:** ${fn.toTitleCase(settings.integration.name)}`;
        //         if (settings.integration.type) {
        //             /**
        //              * 1. Check in at least once a day or once a week (Mastermind)
        //              * 2. 
        //              */
        //             integrationType += "\n- **Explanation:** ";
        //             switch (settings.integration.name) {
        //                 case 'Fast': {
        //                     switch (settings.integration.type) {
        //                         case 1: integrationType += "Log fast at least once a day";
        //                             break;
        //                         case 2: integrationType += "";
        //                             break;
        //                     }
        //                 }
        //                     break;
        //                 case 'Journal': {
        //                     switch (settings.integration.type) {
        //                         case 1: integrationType += "Create at least 1 journal entry once a day";
        //                             break;
        //                         case 2: integrationType += "";
        //                             break;
        //                     }
        //                 }
        //                     break;
        //                 case 'Mastermind': {
        //                     switch (settings.integration.type) {
        //                         case 1: integrationType += "Create at least 1 mastermind entry once a week";
        //                             break;
        //                         case 2: integrationType += "";
        //                             break;
        //                     }
        //                 }
        //                     break;
        //             }
        //         }
        //     }
    }
    const areaOfLifeString = `${areasOfLifeEmojis[areaOfLife] ? `${areasOfLifeEmojis[areaOfLife]} ` : ""}${areasOfLife[areaOfLife] ? `__${areasOfLife[areaOfLife]}__` : ""}`;

    return (`${archived ? "\*\***ARCHIVED**\*\*\n" : ""}${areaOfLifeString}${description ? `\n👣 - **Description:**\n${description}` : ""}`
        + `${reason ? `\n💭 - **Reason:**\n${reason}` : ""}${connectedGoalString}`
        + `${createdAt || createdAt === 0 ? `\n**Created At:** ${fn.timestampToDateString(createdAt, true, true, true)}` : ""}`
        + `${nextCron || nextCron === 0 ? `\n**Next Streak Reset:** ${fn.timestampToDateString(nextCron, true, true, true)}` : ""}`
        + statsString + settingsString);
}

async function multipleHabitsToStringArray(message, habitArray, numberOfHabits, entriesToSkip = 0, toString = false) {
    var habitsToString = new Array();
    console.log({ numberOfHabits });
    for (i = 0; i < numberOfHabits; i++) {
        if (habitArray[i] === undefined) {
            numberOfHabits = i;
            fn.sendErrorMessage(message, `**HABITS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`);
            break;
        }
        const habitString = `__**Habit ${i + entriesToSkip + 1}:**__ ${await habitDocumentToString(habitArray[i])}`;
        habitsToString.push(habitString);
    }
    if (toString) habitsToString = habitsToString.join('\n\n')
    return habitsToString;
}


async function getRecentHabit(userID, isArchived, embedColour) {
    const recentHabitToString = `__**Habit ${await getRecentHabitIndex(userID, isArchived)}:**__`
        + `${await habitDocumentToString(await getOneHabitByRecency(userID, 0, isArchived))}`;
    const habitEmbed = fn.getMessageEmbed(recentHabitToString, `Habit: See Recent Habit`, embedColour);
    return habitEmbed;
}

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
        const habits = await Habit
            .find({ userID, archived })
            .sort({ createdAt: +1, })
            .limit(numberOfEntries)
            .skip(entryIndex);
        return habits;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

async function getRecentHabitIndex(userID, archived) {
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
        + `\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; 5** (\\*any number); **all** \n(NOTE: ***__any number > 1__* will get more than 1 habit!**)`
        + `\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\**any number*)`
        + `\n\n\`<ENTRY_#>\`: **all; recent; 3** (3rd most recent habit, \\**any number*)\n(NOTE: Gets just 1 habit - UNLESS \`all\`)`
        + `\n\n\`<MANY_ENTRIES>\`: **3,5,recent,7,1,25**\n- **COMMA SEPARATED, NO SPACES:**\n1 being the most recent habit, 25 the 25th most recent, etc.`
        + `\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**`
        + `\n\n\`<recent?>\`: (OPT.) type **recent** at the indicated spot to sort the habits by **time created instead of the date created property!**`
        + `\n\n\`<force?>\`: (OPT.) type **force** at the end of your command to **skip all of the confirmation windows!**`;
}

module.exports = {
    name: "habit",
    description: "Habit Tracker",
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

        // Connect with mastermind to be able to make a few weekly habits into a habit (comma separate which habits to transform)
        // FOR SUPER quick and easy habit logging for the week!

        const authorID = message.author.id;
        const authorUsername = message.author.username;
        let userSettings = await User.findOne({ discordID: authorID });
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
                // Type Integration?: Give a selection if yes show all of the options, automark ✅
                // else:
                const habitDescription = await fn.getSingleEntryWithCharacterLimit(bot, message, PREFIX,
                    "👣 **What is the __habit__ you'd like to track?** 📈\n(Within 100 characters)", "Habit: Creation - Description",
                    100, "a habit description", forceSkip, habitEmbedColour, additionalInstructions, additionalKeywords);
                if (!habitDescription && habitDescription !== "") return;
                else if (habitDescription === "reset") {
                    reset = true;
                    continue;
                }

                const habitDescriptionString = `__**Description:**__\n${habitDescription}**`;
                const habitAreaOfLife = await fn.userSelectFromList(bot, PREFIX, message, areasOfLifeList, areasOfLife.length,
                    `${habitDescriptionString}\n\n**__Which area of life does your habit fall under?__** 🌱`, `Habit: Creation - Area of Life`, habitEmbedColour);
                if (!habitAreaOfLife && habitAreaOfLife !== 0) return;

                const habitTypeString = `__**Type:**__ ${areasOfLifeEmojis[habitAreaOfLife]} **${areasOfLife[habitAreaOfLife]}**\n${habitDescriptionString}`;
                let habitReason = await fn.getMultilineEntry(bot, PREFIX, message, habitTypeString
                    + `\n\n💭 **__Why__ do you want to incorporate this habit into your lifestyle?**`,
                    "Habit: Creation - Reason", true, habitEmbedColour, additionalInstructions, additionalKeywords);
                if (!habitReason.message && habitReason.message !== "") return;
                else if (habitReason.returnVal === "reset") {
                    reset = true;
                    continue;
                }
                else habitReason = habitReason.message;

                const goalDocuments = await Goal.find({ userID: authorID, archived: false, completed: false },
                    { _id: 1, 'goal.description': 1 }).sort({ 'goal.start': +1 });
                let goalList = "";
                goalDocuments.forEach((element, i) => {
                    goalList += `\`${i + 1}\` - **${element.goal.description}**\n`;
                });
                goalList += `${goalDocuments.length + 2} - **Skip/None**`;
                let connectedGoal = await fn.userSelectFromList(bot, PREFIX, message, goalList, goalDocuments.length + 1,
                    `${habitDescriptionString}\n\n**__Which goal is this habit connected to, if any?__** 🔗`, "Habit: Creation - Connected Goal", habitEmbedColour);
                if (!connectedGoal && connectedGoal !== 0) return;
                if (connectedGoal === goalList.length + 1) connectedGoal = undefined; // Assuming this is the skip option
                else connectedGoal = goalDocuments[connectedGoal] ? goalDocuments[connectedGoal]._id : undefined;

                userSettings = await User.findOne({ discordID: authorID });
                const cronSettings = `**Daily Cron Time:** ${fn.millisecondsToTimeString(userSettings.habitCron.daily)}`
                    + `\n**Weekly Cron Day:** ${fn.getDayOfWeekToString(userSettings.habitCron.weekly)}`;

                let cronType = await fn.userSelectFromList(bot, PREFIX, message, "`1` - **Daily Reset** 🌇\n`2` - **Weekly Reset** 📅", 2,
                    "**__When do you want this habit's streaks to reset?__** ⌚\nYou can specify after how many reset days or weeks the streak should reset in the next window"
                    + `\n${cronSettings}\n\`${PREFIX}user edit\` - to change daily reset time and weekly reset day shown above`, "Habit: Creation - Streak Reset", habitEmbedColour);
                if (!cronType && cronType !== 0) return;
                let isWeeklyType = false;
                if (cronType === 1) isWeeklyType = true;

                const advancedSettings = await fn.userSelectFromList(bot, PREFIX, message, "`1` - Default Settings\n`2` - Advanced Settings", 2,
                    `**__Would you like to use the default settings or change them?__** ⚙\n${cronSettings}`
                    + `\n**Habit Streak Reset Time:** Every ${isWeeklyType ? "Week" : "Day"}`
                    + `\n**Includes Value to Count:** No\n- **Auto-Log Based on Count:** No\n**Auto-Log as Streak: No**`,
                    "Habit: Creation - Settings", habitEmbedColour);
                if (!advancedSettings && advancedSettings !== 0) return;

                var cronPeriods, isCountType, autoLogType, countGoal, countGoalType, countMetric;
                if (advancedSettings === 1) {
                    cronPeriods = await fn.getSingleEntry(bot, PREFIX, message,
                        `**After how many ${isWeeklyType ? "weeks" : "days"} do you want this habit's streak to reset**\n${cronSettings}`,
                        `Habit: Creation - Advanced Settings: Streak Reset ${isWeeklyType ? "Weeks" : "Days"}`, forceSkip, habitEmbedColour);
                    if (!cronPeriods && cronPeriods !== 0) return;
                    if (!isNaN(cronPeriods)) cronPeriods = parseInt(cronPeriods);
                    else cronPeriods = 1;

                    isCountType = await fn.userSelectFromList(bot, PREFIX, message, "`1` - **Yes** 🔢\n`2` - **No** ⛔", 2,
                        `**__Does this habit include a value to track__**\n(e.g. number of pushups, minute spent studying, etc.)`,
                        "Habit: Creation - Advanced Settings: Count Value", habitEmbedColour);
                    if (!isCountType && isCountType !== 0) return;
                    isCountType = false;
                    if (isCountType === 1) isCountType = true;

                    if (isCountType) {
                        countMetric = await fn.getSingleEntryWithCharacterLimit(bot, message, PREFIX,
                            "👣 **What metric are you tracking for this habit?**\n(Within 30 characters)\ne.g. Pushups, Hours Spend Studying",
                            "Habit: Creation - Advanced Settings: Count Metric", 30, "a count metric", forceSkip, habitEmbedColour, additionalInstructions, additionalKeywords);
                        if (!countMetric && countMetric !== "") return;
                        else if (countMetric === "reset") {
                            reset = true;
                            continue;
                        }

                        countGoalType = await fn.userSelectFromList(bot, PREFIX, message, "`1` - **Daily Goal** 🌇\n`2` - **Weekly Goal** 📅\n`3` - **Total/Cumulative Goal** 🔢",
                            3, `**What kind of goal do you have for __${countMetric}__**`, "Habit: Creation - Advanced Settings: Count Goal Type", habitEmbedColour);
                        if (!countGoalType && countGoalType !== 0) return;
                        countGoalType++;
                        var goalTypeString;
                        switch (countGoalType) {
                            case 1: goalTypeString = "daily goal";
                                break;
                            case 2: goalTypeString = "weekly goal";
                                break;
                            case 3: goalTypeString = "total/cumulative goal";
                                break;
                            default: goalTypeString = "goal";
                                break;
                        }
                        do {
                            countGoal = await fn.getSingleEntry(bot, PREFIX, message,
                                `**What is your ${goalTypeString} for __${countMetric}__**\n(Enter a number)`,
                                `Habit: Creation - Advanced Settings: Count Goal`, forceSkip, habitEmbedColour);
                            if (!countGoal) return;
                            if (!isNaN(countGoal)) countGoal = parseInt(countGoal);
                            else {
                                fn.sendReplyThenDelete(message, `**Please enter a number...**`, 30000);
                                continue;
                            }
                        }
                        while (true)
                    }

                    autoLogType = await fn.userSelectFromList(bot, PREFIX, message, "`1` - **No** ⛔\n`2` - **Yes, As a Streak** (Every Reset Time) 🔄"
                        + `${isCountType`\n\`3\` - **Yes, Based on Count Goal** 🔄`}`,
                        isCountType ? 3 : 2, `Do you want the habit to automatically log at every reset time?`, 'Habit: Creation - Auto Log', habitEmbedColour);
                    if (!autoLogType && autoLogType !== 0) return;
                    let isWeeklyType = false;
                    if (autoLogType === 1) isWeeklyType = true;
                }
                else {
                    cronPeriods = 1;
                    isCountType = false;
                }



                // Daily Reset or Weekly Reset?
                // Count Habit or Just check-in
                // Auto check based on count or streak

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
                 * Auto - Ask if they'd like to track any number of their weekly habits as habit
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
                    createdAt: fn.getNowFlooredToSecond() + HOUR_IN_MS * timezoneOffset,
                    archived: false,
                    description: habitDescription,
                    areaOfLife: habitAreaOfLife,
                    reason: habitReason,
                    connectedGoal,
                    settings: {
                        isCountType,

                    },
                });
                await habitDocument.save()
                    .then(async result => {
                        console.log({ result });
                        totalHabitNumber++;
                        message.reply(`**Habit ${await getHabitIndexByFunction(authorID, habitDocument._id, totalHabitNumber, false, getOneHabitByCreatedAt)} Saved!**`);
                    })
                    .catch(err => console.error(err));
                const confirmReminder = await fn.getUserConfirmation(bot, message, PREFIX, "**Do you want to set a recurring reminder for when you want to log/complete your habit?**",
                    false, "Habit: Completion Reminder", 180000);
                if (!confirmReminder) return;

                const interval = await rm.getInterval(bot, message, PREFIX, timezoneOffset, daylightSavings,
                    "__**Please enter the time you'd like in-between recurring reminders (interval):**__",
                    "Habit: Reminder Interval", habitEmbedColour);
                if (!interval) return;

                let endTime = await fn.getDateAndTimeEntry(bot, message, PREFIX, timezoneOffset, daylightSavings,
                    "**When** would you like to **get your first habit reminder?**",
                    "Habit: First Reminder Time", forceSkip, habitEmbedColour);
                if (!endTime) return;
                endTime -= HOUR_IN_MS * timezoneOffset;

                const reminderMessage = `**__Reminder to track your habit:__** 😁\n${habitDescription}`
                    + `\n\nType** \`?${commandUsed} log ${await getHabitIndexByFunction(authorID, habitDocument._id, totalHabitNumber, false, getOneHabitByCreatedAt)}\` **`
                    + `- to **track your habit**`;
                const now = fn.getNowFlooredToSecond();
                await rm.setNewDMReminder(bot, authorID, now, endTime, reminderMessage,
                    "Habit", habitDocument._id, true, interval, habitEmbedColour);
                console.log("Habit log recurring reminder set.");
                message.reply(`Habit log recurring reminder set!\n**__First Reminder:__** **${fn.millisecondsToTimeString(endTime - fn.getNowFlooredToSecond())}** from now`
                    + `\n**__Interval:__** **${fn.millisecondsToTimeString(interval)}**`);
                return;
            }
            while (reset)
            return;
        }


        else if (habitCommand === "delete" || habitCommand === "remove" || habitCommand === "del" || habitCommand === "d"
            || habitCommand === "rem" || habitCommand === "r") {
            /**
             * Allow them to delete any habits - archived or not
             */

            let habitDeleteUsageMessage = getHabitReadOrDeleteHelp(PREFIX, commandUsed, habitCommand);
            habitDeleteUsageMessage = fn.getMessageEmbed(habitDeleteUsageMessage, "Habit: Delete Help", habitEmbedColour);
            const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see ${isArchived ? `archive ` : ""}help\``;

            if (habitType) {
                if (habitType === "help") {
                    return message.channel.send(habitDeleteUsageMessage);
                }
                if (!totalHabitNumber && !isArchived) {
                    return message.reply(`**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
                else if (!totalArchiveNumber && isArchived) {
                    return message.reply(`**NO ARCHIVED HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
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
                    const habitArray = fn.getEmbedArray(await multipleHabitsToStringArray(message, habitCollection, numberArg, 0), '', true, false, habitEmbedColour);
                    const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} habits?**`;
                    const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, habitArray, multipleDeleteMessage, forceSkip,
                        `Habit${isArchived ? ` Archive` : ""}: Delete Past ${numberArg} Habits (${sortType})`, 600000);
                    if (!multipleDeleteConfirmation) return;
                    const targetIDs = await habitCollection.map(entry => entry._id);
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Habits (${sortType})`);
                    await deleteManyByIdAndReminders(Habit, targetIDs);
                    return;
                }
                if (deleteType === "many") {
                    if (args[2 + archiveShift] === undefined) {
                        return message.reply(habitActionHelpMessage);
                    }
                    // Get the arguments after keyword MANY
                    // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
                    // Convert String of Numbers array into Integer array
                    // Check which habits exist, remove/don't add those that don't
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
                    const recentIndex = await getRecentHabitIndex(authorID, isArchived);
                    toDelete = Array.from(new Set(toDelete.map((number) => {
                        if (number === "recent") {
                            if (recentIndex !== -1) return recentIndex;
                        }
                        else return +number;
                    })));
                    console.log({ toDelete });
                    // Send error message if none of the given reminders exist
                    if (!toDelete.length) {
                        return fn.sendErrorMessage(message, `All of these **${isArchived ? "archived " : ""}habits DO NOT exist**...`);
                    }
                    var indexByRecency = false;
                    if (args[3 + archiveShift] !== undefined) {
                        if (args[3 + archiveShift].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var habitTargetIDs = new Array();
                    var habitArray = new Array();
                    for (i = 0; i < toDelete.length; i++) {
                        var habitView;
                        if (indexByRecency) {
                            habitView = await getOneHabitByRecency(authorID, toDelete[i] - 1, isArchived);
                        }
                        else {
                            habitView = await getOneHabitByCreatedAt(authorID, toDelete[i] - 1, isArchived);
                        }
                        habitTargetIDs.push(habitView._id);
                        habitArray.push(`__**Habit ${toDelete[i]}:**__ ${await habitDocumentToString(habitView)}`);
                    }
                    const deleteConfirmMessage = `Are you sure you want to **delete habits ${toDelete.toString()}?**`;
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    habitArray = fn.getEmbedArray(habitArray, '', true, false, habitEmbedColour);
                    const confirmDeleteMany = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, habitArray, deleteConfirmMessage,
                        forceSkip, `Habit${isArchived ? ` Archive` : ""}: Delete Habits ${toDelete} (${sortType})`, 600000);
                    if (confirmDeleteMany) {
                        console.log(`Deleting ${authorID}'s Habits ${toDelete} (${sortType})`);
                        await deleteManyByIdAndReminders(Habit, habitTargetIDs);
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
                                    skipEntries = await getRecentHabitIndex(authorID, isArchived);
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
                            const habitArray = fn.getEmbedArray(await multipleHabitsToStringArray(message, habitCollection, pastNumberOfEntries, skipEntries), '', true, false, habitEmbedColour);
                            if (skipEntries >= totalHabitNumber) return;
                            const sortType = indexByRecency ? "By Recency" : "By Date Created";
                            const multipleDeleteMessage = `Are you sure you want to **delete ${habitCollection.length} habits past habit ${skipEntries}?**`;
                            const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, habitArray, multipleDeleteMessage,
                                forceSkip, `Habit${isArchived ? ` Archive` : ""}: Multiple Delete Warning! (${sortType})`);
                            console.log({ multipleDeleteConfirmation });
                            if (!multipleDeleteConfirmation) return;
                            const targetIDs = await habitCollection.map(entry => entry._id);
                            console.log(`Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} habits past ${skipEntries} (${sortType})`);
                            await deleteManyByIdAndReminders(Habit, targetIDs);
                            return;
                        }

                        // They haven't specified the field for the habit delete past function
                        else if (deleteType === "past") return message.reply(habitActionHelpMessage);
                        else return message.reply(habitActionHelpMessage);
                    }
                }
            }
            // Next: HABIT DELETE ALL
            // Next: HABIT DELETE MANY
            // Next: HABIT DELETE

            // habit delete <NUMBER/RECENT/ALL>
            const noHabitsMessage = `**NO ${isArchived ? "ARCHIVED " : ""}HABITS**... try \`${PREFIX}${commandUsed} start help\``;
            if (isNaN(args[1 + archiveShift])) {
                const deleteType = habitType;
                if (deleteType === "recent") {
                    const habitView = await getOneHabitByRecency(authorID, 0, isArchived);
                    if (!habitView) return fn.sendErrorMessage(message, noHabitsMessage);
                    const habitTargetID = habitView._id;
                    console.log({ habitTargetID });
                    const habitIndex = await getRecentHabitIndex(authorID, isArchived);
                    const habitEmbed = fn.getEmbedArray(`__**Habit ${habitIndex}:**__ ${await habitDocumentToString(habitView)}`,
                        `Habit${isArchived ? " Archive" : ""}: Delete Recent Habit`, true, true, habitEmbedColour);
                    const deleteConfirmMessage = `Are you sure you want to **delete your most recent habit?:**`;
                    const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, habitEmbed, deleteConfirmMessage, forceSkip,
                        `Habit${isArchived ? " Archive" : ""}: Delete Recent Habit`, 600000);
                    if (deleteIsConfirmed) {
                        await deleteOneByIdAndReminders(Habit, habitTargetID);
                        return;
                    }
                }
                else if (deleteType === "all") {
                    const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded habits?\n\nYou **cannot UNDO** this!" +
                        `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    const pastNumberOfEntriesIndex = totalHabitNumber;
                    if (pastNumberOfEntriesIndex === 0) {
                        return fn.sendErrorMessage(message, noHabitsMessage);
                    }
                    let confirmDeleteAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmDeleteAllMessage, forceSkip, `Habit${isArchived ? ` Archive` : ""}: Delete All Habits WARNING!`);
                    if (!confirmDeleteAll) return;
                    const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR HABITS ON RECORD**?\n\nYou **cannot UNDO** this!"
                        + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    let finalConfirmDeleteAll = await fn.getUserConfirmation(bot, message, PREFIX, finalDeleteAllMessage, `Habit${isArchived ? ` Archive` : ""}: Delete ALL Habits FINAL Warning!`);
                    if (!finalConfirmDeleteAll) return;
                    console.log(`Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Habits`);
                    await fn.deleteUserEntriesAndReminders(Habit, authorID);
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
                var habitView;
                if (indexByRecency) habitView = await getOneHabitByRecency(authorID, pastNumberOfEntriesIndex - 1, isArchived);
                else habitView = await getOneHabitByCreatedAt(authorID, pastNumberOfEntriesIndex - 1, isArchived);
                if (!habitView) {
                    return fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, `**${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST**...`);
                }
                const habitTargetID = habitView._id;
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const habitEmbed = fn.getEmbedArray(`__**Habit ${pastNumberOfEntriesIndex}:**__ ${await habitDocumentToString(habitView)}`,
                    `Habit${isArchived ? ` Archive` : ""}: Delete Habit ${pastNumberOfEntriesIndex} (${sortType})`, true, true, habitEmbedColour);
                const deleteConfirmMessage = `Are you sure you want to **delete Habit ${pastNumberOfEntriesIndex}?**`;
                const deleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, habitEmbed, deleteConfirmMessage, forceSkip,
                    `Habit${isArchived ? ` Archive` : ""}: Delete Habit ${pastNumberOfEntriesIndex} (${sortType})`, 600000);
                if (deleteConfirmation) {
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Habit ${sortType}`);
                    await deleteOneByIdAndReminders(Habit, habitTargetID);
                    return;
                }
            }
        }



        else if (habitCommand === "see" || habitCommand === "show") {
            let habitSeeUsageMessage = getHabitReadOrDeleteHelp(PREFIX, commandUsed, habitCommand);
            habitSeeUsageMessage = fn.getMessageEmbed(habitSeeUsageMessage, `Habit${isArchived ? ` Archive` : ""}: See Help`, habitEmbedColour);

            const seeCommands = ["past", "recent", "all"];

            if (habitType) {
                if (habitType === "help") {
                    return message.channel.send(habitSeeUsageMessage);
                }
                if (!totalHabitNumber && !isArchived) {
                    return message.reply(`**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
                else if (!totalArchiveNumber && isArchived) {
                    return message.reply(`**NO ARCHIVED HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
                else if (args[1 + archiveShift] ? args[1 + archiveShift].toLowerCase() : false === "number") {
                    if (isArchived) return message.reply(`You have **${totalArchiveNumber} archived habits entries** on record.`);
                    else return message.reply(`You have **${totalArchiveNumber} archived habits entries** on record.`);
                }
            }
            else return message.reply(habitActionHelpMessage);

            // Show the user the last habit with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(habitType) && !archiveRegex.test(habitType) && isNaN(habitType)) {
                return message.reply(habitActionHelpMessage);
            }
            // Do not show the most recent habit embed, when a valid command is called
            // it will be handled properly later based on the values passed in!
            else {
                const seeType = habitType;
                var pastFunctionality,
                    habitIndex;
                let indexByRecency = false;
                // To check if the given argument is a number!
                // If it's not a number and has passed the initial 
                // filter, then use the "past" functionality
                // Handling Argument 1:
                const isNumberArg = !isNaN(args[1 + archiveShift]);
                if (seeType === "recent") {
                    return message.channel.send(await getRecentHabit(authorID, isArchived, habitEmbedColour));
                }
                else if (seeType === "all") {
                    habitIndex = totalHabitNumber;
                    pastFunctionality = true;
                }
                else if (isNumberArg) {
                    habitIndex = parseInt(args[1 + archiveShift]);
                    if (habitIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage, `** ${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST **...`);
                    }
                    else pastFunctionality = false;
                }
                else if (seeType === "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else return message.reply(habitActionHelpMessage);
                console.log({ pastNumberOfEntriesIndex: habitIndex, pastFunctionality });
                if (pastFunctionality) {
                    // Loop through all of the given fields, account for aliases and update fields
                    // Find Habits, toArray, store data in meaningful output
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
                        const confirmSeeMessage = `Are you sure you want to ** see ${args[2 + archiveShift]} habits ?** `;
                        let confirmSeeAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeeMessage, forceSkip, `Habit${isArchived ? ` Archive` : ""}: See ${args[2 + archiveShift]} Habits(${sortType})`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (seeType !== "all") return message.reply(habitActionHelpMessage);
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your habit history?";
                        let confirmSeeAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeeAllMessage, forceSkip, `Habit${isArchived ? ` Archive` : ""}: See All Habits`);
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                    if (habitIndex === undefined) {
                        habitIndex = parseInt(args[2 + archiveShift]);
                    }
                    var habitView;
                    if (indexByRecency) habitView = await fn.getEntriesByRecency(Habit, { userID: authorID, archived: isArchived }, 0, habitIndex);
                    else habitView = await getHabitsByCreatedAt(authorID, 0, habitIndex, isArchived);
                    console.log({ habitView, pastNumberOfEntriesIndex: habitIndex });
                    const habitArray = await multipleHabitsToStringArray(message, habitView, habitIndex, 0);
                    await fn.sendPaginationEmbed(bot, message.channel.id, authorID, fn.getEmbedArray(habitArray, `Habit${isArchived ? ` Archive` : ""}: See ${habitIndex} Habits(${sortType})`, true, true, habitEmbedColour));
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
                                    entriesToSkip = await getRecentHabit(authorID, isArchived, habitEmbedColour);
                                }
                                else return message.reply(habitActionHelpMessage);
                                if (entriesToSkip < 0 || entriesToSkip > totalHabitNumber) {
                                    return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage, `** ${isArchived ? "ARCHIVED " : ""} GOAL(S) DO NOT EXIST **...`);
                                }
                                const confirmSeePastMessage = `Are you sure you want to ** see ${args[1 + archiveShift]} entries past ${entriesToSkip}?** `;
                                const confirmSeePast = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeePastMessage, forceSkip, `Habit${isArchived ? ` Archive` : ""}: See ${args[1 + archiveShift]} Habits Past ${entriesToSkip} (${sortType})`);
                                if (!confirmSeePast) return;
                                var habitView;
                                if (indexByRecency) habitView = await fn.getEntriesByRecency(Habit, { userID: authorID, archived: isArchived }, entriesToSkip, habitIndex);
                                else habitView = await getHabitsByCreatedAt(authorID, entriesToSkip, habitIndex, isArchived);
                                console.log({ habitView });
                                const habitStringArray = await multipleHabitsToStringArray(message, habitView, habitIndex, entriesToSkip);
                                await fn.sendPaginationEmbed(bot, message.channel.id, authorID, fn.getEmbedArray(habitStringArray, `Habit${isArchived ? ` Archive` : ""}: See ${habitIndex} Habits Past ${entriesToSkip} (${sortType})`, true, true, habitEmbedColour));
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
                var habitView;
                if (indexByRecency) habitView = await getOneHabitByRecency(authorID, habitIndex - 1, isArchived);
                else habitView = await getOneHabitByCreatedAt(authorID, habitIndex - 1, isArchived);
                console.log({ habitView });
                if (!habitView) {
                    return fn.sendErrorMessage(message, `** ${isArchived ? "ARCHIVED " : ""} GOAL ${habitIndex} DOES NOT EXIST **...`);
                }
                // NOT using the past functionality:
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const habitString = `__ ** Habit ${habitIndex}:** __ ${await habitDocumentToString(habitView)} `;
                const habitEmbed = fn.getEmbedArray(habitString, `Habit${isArchived ? ` Archive` : ""}: See Habit ${habitIndex} (${sortType})`, true, true, habitEmbedColour);
                await fn.sendPaginationEmbed(bot, message.channel.id, authorID, habitEmbed);
            }
        }


        else if (habitCommand === "edit" || habitCommand === "change" || habitCommand === "ed"
            || habitCommand === "ch" || habitCommand === "c") {
            let habitEditUsageMessage = `** USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <archive?> <GOAL #> <recent?> <force?>\``
                + "\n\n`<HABIT #>`: **recent; 3** (3rd most recent entry, \\**any number*)"
                + `\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**`
                + "\n\n`<recent?>`(OPT.): type **recent** at the indicated spot to sort the habits by **actual time created instead of habit created time!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            habitEditUsageMessage = fn.getMessageEmbed(habitEditUsageMessage, `Habit: Edit Help`, habitEmbedColour);
            if (habitType) {
                if (habitType === "help") {
                    return message.channel.send(habitEditUsageMessage);
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
                var habitIndex;
                if (habitType === "recent") {
                    habitIndex = await getRecentHabitIndex(authorID, isArchived);
                }
                else {
                    habitIndex = parseInt(habitType);
                    if (habitIndex <= 0) {
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
                if (indexByRecency) habitDocument = await getOneHabitByRecency(authorID, habitIndex - 1, isArchived);
                else habitDocument = await getOneHabitByCreatedAt(authorID, habitIndex - 1, isArchived);
                if (!habitDocument) {
                    return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage, `**${isArchived ? "ARCHIVED " : ""}GOAL ${habitIndex} DOES NOT EXIST**...`);
                }
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                var habitFields = ["Date Created", "End Time", "Area of Life", "Description", "Reason", "Checkpoints", "Actionable Steps", "Completed", "Archived"];
                let fieldsList = "";
                habitFields.forEach((field, i) => {
                    fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
                });
                const habitTargetID = habitDocument._id;
                var showGoal, continueEdit;
                do {
                    const checkHabit = await getOneHabitByObjectID(habitTargetID);
                    if (!checkHabit) return;
                    continueEdit = false;
                    showGoal = await habitDocumentToString(habitDocument);
                    // Field the user wants to edit
                    const fieldToEditInstructions = "**Which field do you want to edit?:**";
                    const fieldToEditAdditionalMessage = `__**Habit ${habitIndex} (${sortType}):**__ ${showGoal}`;
                    const fieldToEditTitle = `Habit${isArchived ? " Archive" : ""}: Edit Field`;
                    let fieldToEditIndex = await fn.userSelectFromList(bot, PREFIX, message, fieldsList, habitFields.length, fieldToEditInstructions,
                        fieldToEditTitle, habitEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                    if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                    var userEdit, habitEditMessagePrompt = "";
                    const fieldToEdit = habitFields[fieldToEditIndex];
                    const type = `Habit${isArchived ? " Archive" : ""}`;
                    let { goal: habit, completed, archived } = habitDocument;
                    switch (fieldToEditIndex) {
                        case 0:
                            habitEditMessagePrompt = "\n__**Please enter the date/time ⌚ of when you started this goal:**__";
                            userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, habitEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            break;
                        case 1:
                            habitEditMessagePrompt = "\n__**Please enter the date/time ⌚ of when you ended or intend to end this goal:**__";
                            userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, habitEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            break;
                        case 2:
                            habitEditMessagePrompt = `\n**__Which area of life does your habit fall under?__ 🌱**\n${areasOfLifeList}`;
                            userEdit = await fn.getUserEditNumber(bot, message, PREFIX, fieldToEdit, areasOfLife.length, type, areasOfLifeCombinedEmoji, forceSkip, habitEmbedColour, habitEditMessagePrompt);
                            if (!userEdit) return;
                            else if (userEdit === "back") break;
                            userEdit--;
                            habit.type = userEdit;
                            break;
                        case 3:
                            habitEditMessagePrompt = "\n🎯 **What is your __habit__?**";
                            userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, habitEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            habit.description = userEdit;
                            break;
                        case 4:
                            habitEditMessagePrompt = "\n💭 **__Why__ do you want to accomplish this goal?**";
                            userEdit = await fn.getUserMultilineEditString(bot, PREFIX, message, fieldToEdit, habitEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            habit.reason = userEdit;
                            break;
                        case 5:
                            habitEditMessagePrompt = "\n🏁 **What are some __checkpoints__ that would indicate progress on this goal?**";
                            userEdit = await fn.getUserMultilineEditString(bot, PREFIX, message, fieldToEdit, habitEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            habit.checkpoints = userEdit;
                            break;
                        case 6:
                            habitEditMessagePrompt = "\n👣 **What are some __actionable steps__ for this goal?**";
                            userEdit = await fn.getUserMultilineEditString(bot, PREFIX, message, fieldToEdit, habitEditMessagePrompt, type, forceSkip, habitEmbedColour);
                            habit.steps = userEdit;
                            break;
                        case 7:
                            habitEditMessagePrompt = `\n**__Currently:__ ${completed ? "Completed" : "In Progress"}\n\n✅ - Completed\n\n🏃‍♂️ - In Progress**`;
                            userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, habitEditMessagePrompt, ['✅', '🏃‍♂️'], type, forceSkip, habitEmbedColour);
                            break;
                        case 8:
                            habitEditMessagePrompt = `\n**__Currently:__ ${archived ? "Archived" : "NOT Archived"}\n\n📁 - Archive\n\n📜 - No Archive**`;
                            userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, habitEditMessagePrompt, ['📁', '📜'], type, forceSkip, habitEmbedColour);
                            break;
                    }
                    console.log({ userEdit });
                    if (userEdit === false) return;
                    else if (userEdit === undefined) userEdit = "back";
                    else if (userEdit !== "back") {
                        if (fieldToEditIndex === 0 || fieldToEditIndex === 1 || fieldToEditIndex === 7 || fieldToEditIndex === 8) {
                            await Reminder.deleteMany({ connectedDocument: habitTargetID });
                        }
                        // Parse User Edit
                        if (fieldToEditIndex === 0 || fieldToEditIndex === 1) {
                            userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                            console.log({ userEdit });
                            const now = Date.now();
                            userEdit = fn.timeCommandHandlerToUTC(userEdit, now, timezoneOffset, daylightSavings);
                            if (!userEdit) {
                                fn.sendReplyThenDelete(message, `**INVALID TIME**... ${habitHelpMessage}`, 60000);
                                continueEdit = true;
                            }
                            switch (fieldToEditIndex) {
                                case 0: habit.start = userEdit;
                                    break;
                                case 1: habit.end = userEdit;
                                    break
                                default: continueEdit = true;
                                    break;
                            }
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
                            console.log(`Editing ${authorID}'s Habit ${habitIndex} (${sortType})`);
                            if (fieldToEditIndex === 7) habitDocument = await Habit.findOneAndUpdate({ _id: habitTargetID }, { $set: { completed: userEdit } }, { new: true });
                            else if (fieldToEditIndex === 8) habitDocument = await Habit.findOneAndUpdate({ _id: habitTargetID }, { $set: { archived: userEdit } }, { new: true });
                            else habitDocument = await Habit.findOneAndUpdate({ _id: habitTargetID }, { $set: { goal: habit } }, { new: true });
                            console.log({ continueEdit });
                            if (habitDocument) {
                                habitIndex = indexByRecency ?
                                    await getHabitIndexByFunction(authorID, habitTargetID, isArchived ? totalArchiveNumber : totalHabitNumber, isArchived, getOneHabitByRecency)
                                    : await getHabitIndexByFunction(authorID, habitTargetID, isArchived ? totalArchiveNumber : totalHabitNumber, isArchived, getOneHabitByCreatedAt);
                                console.log({ habitDocument, habitTargetID, fieldToEditIndex });
                                showGoal = await habitDocumentToString(habitDocument);
                                const continueEditMessage = `Do you want to continue **editing Habit ${habitIndex}?:**\n\n__**Habit ${habitIndex}:**__ ${showGoal}`;
                                continueEdit = await fn.getUserConfirmation(bot, message, PREFIX, continueEditMessage, forceSkip, `Habit${isArchived ? " Archive" : ""}: Continue Editing Habit ${habitIndex}?`, 300000);
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
                        habitDocument = await Habit.findById(habitTargetID);
                        if (habitDocument) {
                            habitIndex = indexByRecency ?
                                await getHabitIndexByFunction(authorID, habitTargetID, isArchived ? totalArchiveNumber : totalHabitNumber, isArchived, getOneHabitByCreatedAt)
                                : await getHabitIndexByFunction(authorID, habitTargetID, isArchived ? totalArchiveNumber : totalHabitNumber, isArchived, getOneHabitByRecency);
                            console.log({ habitDocument, habitTargetID, fieldToEditIndex });
                            showGoal = await habitDocumentToString(habitDocument);
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
            let habits = await Habit.find({ archived: false }).sort({ 'goal.start': +1 });
            if (!habits) return message.reply(`**You don't have any habits**, try \`${PREFIX}${commandUsed} start\``);
            const targetChannel = await fn.getPostChannel(bot, PREFIX, message, `Habit`, forceSkip, habitEmbedColour);
            if (!targetChannel) return;
            const member = bot.channels.cache.get(targetChannel).guild.member(authorID);
            const habitStringArray = await multipleHabitsToStringArray(message, habits, totalHabitNumber, 0);
            if (habitStringArray.length) habitStringArray[0] = `<@!${authorID}>\n${habitStringArray[0]}`;
            const posts = fn.getEmbedArray(habitStringArray, `${member ? `${member.displayName}'s ` : ""}Long-Term Habits`
                + ` (as of ${new Date(Date.now() + HOUR_IN_MS * timezoneOffset).getUTCFullYear()})`, true, false, habitEmbedColour);
            posts.forEach(async post => {
                await fn.sendMessageToChannel(bot, post, targetChannel);
            });
            return;
        }


        else if (habitCommand === "log" || habitCommand === "track" || habitCommand === "check" || habitCommand === "complete"
            || habitCommand === "end" || habitCommand === "e") {
            // (similar indexing to edit, recent or #) + archive
            // Make a list - similar to archive
            let habitEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <archive?> <recent?> <force?>\``
                + `\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**`
                + "\n\n`<recent?>`(OPT.): type **recent** to order the habits by **actual time created instead of the date created property!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            habitEditUsageMessage = fn.getMessageEmbed(habitEditUsageMessage, `Habit: End Help`, habitEmbedColour);
            if (habitType === "help") return message.channel.send(habitEditUsageMessage);

            var indexByRecency = false;
            if (args[1 + archiveShift] !== undefined) {
                if (args[1 + archiveShift].toLowerCase() === "recent") {
                    indexByRecency = true;
                }
            }

            do {
                var habitArray;
                if (indexByRecency) habitArray = await Habit.find({ archived: isArchived, completed: false }, { _id: 1, "goal.description": 1 }).sort({ _id: -1 });
                else habitArray = await Habit.find({ archived: isArchived, completed: false }, { _id: 1, "goal.description": 1 }).sort({ "goal.start": +1 });
                if (!habitArray.length) return message.reply(`**No ${isArchived ? "archived " : ""}habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`);

                let habitList = "";
                habitArray.forEach((element, i) => {
                    habitList += `\`${i + 1}\` - ${element.goal.description}\n`;
                });

                let targetGoalIndex = await fn.userSelectFromList(bot, PREFIX, message, habitList, habitArray.length, "__**Which habit would you like to end?:**__",
                    `Habit${isArchived ? " Archive" : ""}: End Selection`, habitEmbedColour, 600000, 0);
                if (!targetGoalIndex) return;
                const targetGoal = habitArray[targetGoalIndex];
                const confirmEnd = await fn.getUserConfirmation(bot, message, PREFIX, `**Are you sure you want to mark this habit as complete?**\n🎯 - __**Description:**__\n${targetGoal.goal.description}`,
                    forceSkip, `Habit${isArchived ? " Archive" : ""}: End Confirmation`);
                if (confirmEnd) await Habit.updateOne({ _id: targetGoal._id }, { $set: { completed: true, "goal.end": fn.getNowFlooredToSecond() + HOUR_IN_MS * timezoneOffset } },
                    (err, result) => {
                        if (err) return console.error(err);
                        console.log({ result });
                        Reminder.deleteMany({ connectedDocument: targetGoal._id });
                    });
                else continue;
            }
            while (true)
        }


        else if (habitCommand === "today" || habitCommand === "tod" || habitCommand === "current" || habitCommand === "now") {

        }


        // Set one or more reminders for a specific habit
        else if (habitCommand === "reminder" || habitCommand === "remindme" || habitCommand === "remind" || habitCommand === "rem" || habitCommand === "r") {

        }


        else if (archiveRegex.test(habitCommand) || habitCommand === "stash" || habitCommand === "store") {
            if (tier === 1) {
                if (totalArchiveNumber >= habitArchiveMax) {
                    return message.channel.send(fn.getMessageEmbed(fn.getTierMaxMessage(PREFIX, commandUsed, habitArchiveMax, ["Habit", "Habits"], 1, true),
                        `Habit Archive: Tier 1 Maximum`, habitEmbedColour).setFooter(fn.premiumFooterText));
                }
            }
            // Allows for archive - indexing by unarchived entries only!
            let habitEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <recent?> <force?>\``
                + "\n\n`<recent?>`(OPT.): type **recent** to order the habits by **actual time created instead of the date created property!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            habitEditUsageMessage = fn.getMessageEmbed(habitEditUsageMessage, `Habit: Archive Help`, habitEmbedColour);
            if (habitType === "help") return message.channel.send(habitEditUsageMessage);

            var indexByRecency = false;
            if (args[1] !== undefined) {
                if (args[1].toLowerCase() === "recent") {
                    indexByRecency = true;
                }
            }

            do {
                var habitArray;
                if (indexByRecency) habitArray = await Habit.find({ archived: false }, { _id: 1, "habit.description": 1 }).sort({ _id: -1 });
                else habitArray = await Habit.find({ archived: false }, { _id: 1, "habit.description": 1 }).sort({ "habit.createdAt": +1 });
                if (!habitArray.length) return message.reply(`**No ${isArchived ? "archived " : ""}habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`);

                let habitList = "";
                habitArray.forEach((habit, i) => {
                    habitList += `\`${i + 1}\` - ${habit.description}\n`;
                });

                let targetHabitIndex = await fn.userSelectFromList(bot, PREFIX, message, habitList, habitArray.length, "__**Which habit would you like to archive?:**__",
                    `Habit${isArchived ? " Archive" : ""}: Archive Selection`, habitEmbedColour, 600000, 0);
                if (!targetHabitIndex && targetHabitIndex !== 0) return;
                const targetHabit = habitArray[targetHabitIndex];
                const confirmEnd = await fn.getUserConfirmation(bot, message, PREFIX, `**Are you sure you want to archive this habit?**`
                    + `\n(it will not be deleted, but won't show up in your regular \`${PREFIX}${commandUsed} see\` \`${PREFIX}${commandUsed} post\` \`${PREFIX}${commandUsed} delete\` commands`
                    + `\nand you won't get reminders for it anymore)`
                    + `\n\n🎯 - __**Description:**__\n${targetHabit.description}`,
                    forceSkip, `Habit${isArchived ? " Archive" : ""}: Archive Confirmation`);
                if (confirmEnd) {
                    await Habit.updateOne({ _id: targetHabit._id }, { $set: { archived: true } }, (err, result) => {
                        if (err) return console.error(err);
                        console.log({ result });
                        Reminder.deleteMany({ connectedDocument: targetHabit._id });
                    });
                }
                else continue;
            }
            while (true)
        }


        else return message.reply(habitHelpMessage);
    }
};