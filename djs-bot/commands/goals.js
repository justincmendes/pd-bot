// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Goal = require("../database/schemas/longtermgoals");
const User = require("../database/schemas/user");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();

const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const goalEmbedColour = fn.goalsEmbedColour;
const areasOfLifeEmojis = fn.areasOfLifeEmojis;
const areasOfLife = fn.areasOfLife;
const areasOfLifeCombinedEmoji = fn.getAreasOfLifeEmojiCombinedArray();
const areasOfLifeList = fn.getAreasOfLifeList().join('\n');

// Function Declarations and Definitions

function goalDocumentToString(goalDocument, showType = true) {
    const { archived, goal } = goalDocument;
    const areaOfLife = showType ? `${areasOfLifeEmojis[goal.type] ? `${areasOfLifeEmojis[goal.type]} ` : ""}${areasOfLife[goal.type] ? `__${areasOfLife[goal.type]}__` : ""}` : false;
    return (`${archived ? "\*\***ARCHIVED**\*\*\n" : ""}${areaOfLife ? areaOfLife : ""}${goal.description ? `\n🎯 ${goal.description}` : ""}`
        + `${goal.reason ? `\n💭 ${goal.reason}` : ""}${goal.checkpoints ? `\n🏁 ${goal.checkpoints}` : ""}${goal.steps ? `\n👣 ${goal.steps}` : ""}`
        + `${goal.start && !isNaN(goal.start) ? `\n**Start:** ${fn.timestampToDateString(goal.start, false, true, true)}` : ""}`
        + `${goal.end && !isNaN(goal.end) ? `\n**Target Completion:** ${fn.timestampToDateString(goal.end, false, true, true)}` : ""}`);
}

async function getGoalIndexByFunction(userID, goalID, totalGoals, archived, getOneGoal) {
    let i = 0;
    while (true) {
        let goal = await getOneGoal(userID, i, archived);
        if (goal === undefined && i === totalGoals) {
            return false;
        }
        else if (goal._id.toString() === goalID.toString()) break;
        i++;
    }
    return i + 1;
}

async function getOneGoalByRecency(userID, goalIndex, archived = undefined) {
    const goal = await Goal
        .findOne({ userID, archived })
        .sort({ _id: -1 })
        .skip(goalIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return goal;
}

async function getOneGoalByStartTime(userID, goalIndex, archived = undefined) {
    const goal = await Goal
        .findOne({ userID, archived })
        .sort({ 'goal.start': +1, })
        .skip(goalIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return goal;
}

async function getGoalsByStartTime(userID, entryIndex, numberOfEntries = 1, archived = undefined) {
    try {
        const goals = await Goal
            .find({ userID, archived })
            .sort({ 'goal.start': +1, })
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
        const entries = await Goal
            .find({ userID, archived })
            .sort({ 'goal.start': +1, });
        if (entries.length) {
            let targetID = await Goal
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

function getGoalReadOrDeleteHelp(PREFIX, commandUsed, crudCommand) {
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

function multipleGoalsToStringArray(message, goalArray, numberOfGoals, entriesToSkip = 0, toString = false) {
    var goalsToString = new Array();
    console.log({ numberOfGoals });
    for (i = 0; i < numberOfGoals; i++) {
        if (goalArray[i] === undefined) {
            numberOfGoals = i;
            fn.sendErrorMessage(message, `**GOALS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`);
            break;
        }
        const goalString = `__**Goal ${i + entriesToSkip + 1}:**__ ${goalDocumentToString(goalArray[i])}`;
        goalsToString.push(goalString);
    }
    if (toString) goalsToString = goalsToString.join('\n\n')
    return goalsToString;
}

async function getRecentGoal(userID, isArchived, embedColour) {
    const recentGoalToString = `__**Goal ${await getRecentGoalIndex(userID, isArchived)}:**__`
        + `${goalDocumentToString(await getOneGoalByRecency(userID, 0, isArchived))}`;
    const goalEmbed = fn.getMessageEmbed(recentGoalToString, `Long-Term Goal: See Recent Goal`, embedColour);
    return goalEmbed;
}

module.exports = {
    name: "goals",
    description: "Long-term goal setting handler",
    aliases: ["goal", "g"],
    cooldown: 3,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        // Variable Declarations and Initializations
        // See - with markdown option!
        // Edit includes the ability to add
        const authorID = message.author.id;
        const authorUsername = message.author.username;
        let goalUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<ACTION>\`: **start/create; see; edit; delete/remove; post; complete/log/status**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        goalUsageMessage = fn.getMessageEmbed(goalUsageMessage, "Goals: Help", goalEmbedColour);
        const goalHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        const goalCommand = args[0].toLowerCase();
        const goalActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${goalCommand} help\``;
        const goalType = args[1] ? args[1].toLowerCase() : false;
        const totalGoalNumber = await Goal.find({}).countDocuments();
        const archiveRegex = /^(archive[ds]?|arch|ar?)$/i;
        const isArchived = archiveRegex.test(goalType);
        const archiveShift = isArchived ? 1 : 0;
        console.log({ isArchived, archiveShift });

        if (goalCommand === "help") return message.channel.send(goalUsageMessage);


        else if (goalCommand === "start" || goalCommand === "create" || goalCommand === "s" || goalCommand === "set"
            || goalCommand === "c" || goalCommand === "make" || goalCommand === "m" || goalCommand === "add") {
            /**
             * Iteratively create new long-term goals until the user is finished!
             */

            var goalDocument, reset;
            const additionalInstructions = `Type \`reset\` to **reset** your current long-term goal entry`;
            const additionalKeywords = ["reset"];
            do {
                reset = false;
                const goalType = await fn.userSelectFromList(message, areasOfLifeList, areasOfLife.length,
                    `**__Which area of life does your long-term goal fall under?__**`, `Long-Term Goal: Creation - Area of Life`, goalEmbedColour);
                if (!goalType && goalType !== 0) return;

                const goalTypeString = `__**Type:**__ ${areasOfLifeEmojis[goalType]} **${areasOfLife[goalType]}**`;
                const goalDescription = await fn.getSingleEntry(message, `${goalTypeString}\n\n🎯 **What is your __long-term goal__?**`,
                    `Long-Term Goal: Creation - Set Goal`, forceSkip, goalEmbedColour, additionalInstructions, additionalKeywords);
                if (!goalDescription && goalDescription !== "") return;
                else if (goalDescription === "reset") {
                    reset = true;
                    continue;
                }

                const goalDescriptionString = `__**Goal:**__${goalDescription === "" ? "" : `\n${goalDescription}`}`;
                const goalCheckpoints = await fn.getSingleEntry(message, `${goalTypeString}\n${goalDescriptionString}`
                    + `\n\n🏁 **What are some __checkpoints__ that would indicate progress on this goal?**`,
                    `Long-Term Goal: Creation - Reason`, forceSkip, goalEmbedColour, additionalInstructions, additionalKeywords);
                if (!goalCheckpoints && goalCheckpoints !== "") return;
                else if (goalCheckpoints === "reset") {
                    reset = true;
                    continue;
                }

                const goalCheckpointsString = `__**Checkpoints:**__${goalCheckpoints === "" ? "" : `\n${goalCheckpoints}`}`;
                const goalSteps = await fn.getSingleEntry(message, `${goalTypeString}\n${goalDescriptionString}\n\n${goalCheckpointsString}\n\n👣 **What are some __actionable steps__ for this goal?**`,
                    `Long-Term Goal: Creation - Actionable Steps`, forceSkip, goalEmbedColour, additionalInstructions, additionalKeywords);
                if (!goalSteps && goalSteps !== "") return;
                else if (goalSteps === "reset") {
                    reset = true;
                    continue;
                }

                const goalStepsString = `__**Steps:**__${goalSteps === "" ? "" : `\n${goalSteps}`}`;
                const goalReason = await fn.getSingleEntry(message, `${goalTypeString}\n${goalDescriptionString}\n\n${goalCheckpointsString}\n\n${goalStepsString}`
                    + `\n\n💭 **__Why__ do you want to accomplish this goal?**`,
                    `Long-Term Goal: Creation - Reason`, forceSkip, goalEmbedColour, additionalInstructions, additionalKeywords);
                if (!goalReason && goalReason !== "") return;
                else if (goalReason === "reset") {
                    reset = true;
                    continue;
                }

                let time = ["started", "plan to have finished"];
                for (i = 0; i < 2; i++) {
                    do {
                        const index = i;
                        let goalsTimePrompt = `**Please enter the date and time when you __${time[i]}__ this goal:**\n(e.g. now, OR March 22, 2027)`;
                        time[i] = await fn.getSingleEntry(message, goalsTimePrompt, "Long-Term Goal: Creation - Set Time", forceSkip, goalEmbedColour,
                            additionalInstructions, additionalKeywords);
                        if (!time[i]) return;
                        else if (time[i] === "reset") {
                            reset = true;
                            break;
                        }

                        time[i] = time[i].toLowerCase().split(/[\s\n]+/);
                        const now = Date.now();
                        time[i] = fn.timeCommandHandlerToUTC(time[i], now, timezoneOffset, daylightSavings);
                        i = index;
                        if (!time[i] && time[i] !== 0) {
                            fn.sendReplyThenDelete(message, `**INVALID DATE/TIME**...`, 60000);
                        }
                    }
                    while (!time[i])
                    if (reset) break;
                }
                if (reset) continue;

                console.log(`Start: ${fn.timestampToDateString(time[0])}\nEnd: ${fn.timestampToDateString(time[1])}`);
                if (fn.endTimeAfterStartTime(message, time[0], time[1], "Long-Term Goal")) {
                    goalDocument = new Goal({
                        _id: mongoose.Types.ObjectId(),
                        userID: authorID,
                        completed: false,
                        archived: false,
                        goal: {
                            start: time[0] - HOUR_IN_MS * timezoneOffset,
                            end: time[1] - HOUR_IN_MS * timezoneOffset,
                            type: goalType,
                            description: goalDescription,
                            checkpoints: goalCheckpoints,
                            steps: goalSteps,
                            reason: goalReason,
                        },
                    });
                    await goalDocument.save()
                        .then(result => {
                            console.log({ result });
                            message.reply(`**Long-Term Goal Saved!**`);
                        })
                        .catch(err => console.error(err));
                }
                else {
                    reset = true;
                    continue;
                }
                const createAnother = await fn.getUserConfirmation(message, "Would you like to create another **long-term goal?**",
                    false, "Long-Term Goal: Create Another", 180000);
                console.log({ createAnother });
                if (!createAnother) return;
                else reset = true;
            }
            while (reset)
            return;
        }


        else if (goalCommand === "delete" || goalCommand === "remove" || goalCommand === "del" || goalCommand === "d"
            || goalCommand === "rem" || goalCommand === "r") {
            /**
             * Allow them to delete any goals - archived or not
             */

            let goalDeleteUsageMessage = getGoalReadOrDeleteHelp(PREFIX, commandUsed, goalCommand);
            goalDeleteUsageMessage = fn.getMessageEmbed(goalDeleteUsageMessage, "Long-Term Goal: Delete Help", goalEmbedColour);
            const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see ${isArchived ? `archive ` : ""}help\``;

            if (goalType) {
                if (goalType === "help") {
                    return message.channel.send(goalDeleteUsageMessage);
                }
                if (!totalGoalNumber) {
                    return message.reply(`**NO GOALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
            }
            else return message.reply(goalActionHelpMessage);

            // delete past #:
            if (args[2 + archiveShift] !== undefined) {
                const deleteType = args[1 + archiveShift] ? args[1 + archiveShift].toLowerCase() : false;
                if (deleteType === "past") {
                    // If the following argument is not a number, exit!
                    if (isNaN(args[2 + archiveShift])) {
                        return fn.sendErrorMessageAndUsage(message, goalActionHelpMessage);
                    }
                    var numberArg = parseInt(args[2 + archiveShift]);
                    if (numberArg <= 0) {
                        return fn.sendErrorMessageAndUsage(message, goalActionHelpMessage);
                    }
                    let indexByRecency = false;
                    if (args[3 + archiveShift] !== undefined) {
                        if (args[3 + archiveShift].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Start Time";
                    var goalCollection;
                    if (indexByRecency) goalCollection = await fn.getEntriesByRecency(Goal, { userID: authorID, archived: isArchived, }, 0, numberArg);
                    else goalCollection = await getGoalsByStartTime(authorID, 0, numberArg, isArchived);
                    const goalArray = fn.getEmbedArray(multipleGoalsToStringArray(message, goalCollection, numberArg, 0), '', true, false, goalEmbedColour);
                    const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} goals?**`;
                    const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(message, goalArray, multipleDeleteMessage, forceSkip,
                        `Long-Term Goal${isArchived ? ` Archive` : ""}: Delete Past ${numberArg} Goals (${sortType})`, 600000);
                    if (!multipleDeleteConfirmation) return;
                    const targetIDs = await goalCollection.map(entry => entry._id);
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Goals (${sortType})`);
                    await Goal.deleteMany({ _id: { $in: targetIDs } });
                    return;
                }
                if (deleteType === "many") {
                    if (args[2 + archiveShift] === undefined) {
                        return message.reply(goalActionHelpMessage);
                    }
                    // Get the arguments after keyword MANY
                    // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
                    // Convert String of Numbers array into Integer array
                    // Check which goals exist, remove/don't add those that don't
                    let toDelete = args[2 + archiveShift].split(',').filter(index => {
                        if (!isNaN(index)) {
                            numberIndex = parseInt(index);
                            if (numberIndex > 0 && numberIndex <= totalGoalNumber) {
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
                        return fn.sendErrorMessage(message, "All of these **goals DO NOT exist**...");
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
                            goalView = await getOneGoalByRecency(authorID, toDelete[i] - 1, isArchived);
                        }
                        else {
                            goalView = await getOneGoalByStartTime(authorID, toDelete[i] - 1, isArchived);
                        }
                        goalTargetIDs.push(goalView._id);
                        goalArray.push(`__**Goal ${toDelete[i]}:**__${goalDocumentToString(goalView)}`);
                    }
                    const deleteConfirmMessage = `Are you sure you want to **delete goals ${toDelete.toString()}?**`;
                    const sortType = indexByRecency ? "By Recency" : "By Start Time";
                    goalArray = fn.getEmbedArray(goalArray, '', true, false, goalEmbedColour);
                    const confirmDeleteMany = await fn.getPaginatedUserConfirmation(message, goalArray, deleteConfirmMessage,
                        forceSkip, `Long-Term Goal${isArchived ? ` Archive` : ""}: Delete Goals ${toDelete} (${sortType})`, 600000);
                    if (confirmDeleteMany) {
                        console.log(`Deleting ${authorID}'s Goals ${toDelete} (${sortType})`);
                        await Goal.deleteMany({ _id: { $in: goalTargetIDs } });
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
                                else return message.reply(goalActionHelpMessage);
                            }
                            else skipEntries = parseInt(args[3 + archiveShift + shiftIndex]);
                            const pastNumberOfEntries = parseInt(args[1 + archiveShift]);
                            if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                                return fn.sendErrorMessageAndUsage(message, goalActionHelpMessage);
                            }
                            var goalCollection;
                            if (indexByRecency) goalCollection = await fn.getEntriesByRecency(Goal, { userID: authorID, archived: isArchived, }, skipEntries, pastNumberOfEntries);
                            else goalCollection = await getGoalsByStartTime(authorID, skipEntries, pastNumberOfEntries, isArchived);
                            const goalArray = fn.getEmbedArray(multipleGoalsToStringArray(message, goalCollection, pastNumberOfEntries, skipEntries), '', true, false, goalEmbedColour);
                            if (skipEntries >= totalGoalNumber) return;
                            const sortType = indexByRecency ? "By Recency" : "By Start Time";
                            const multipleDeleteMessage = `Are you sure you want to **delete ${goalCollection.length} goals past goal ${skipEntries}?**`;
                            const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(message, goalArray, multipleDeleteMessage,
                                forceSkip, `Long-Term Goal${isArchived ? ` Archive` : ""}: Multiple Delete Warning! (${sortType})`);
                            console.log({ multipleDeleteConfirmation });
                            if (!multipleDeleteConfirmation) return;
                            console.log({ multipleDeleteConfirmation });
                            const targetIDs = await goalCollection.map(entry => entry._id);
                            console.log(`Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} goals past ${skipEntries} (${sortType})`);
                            await Goal.deleteMany({ _id: { $in: targetIDs } });
                            return;
                        }

                        // They haven't specified the field for the goal delete past function
                        else if (deleteType === "past") return message.reply(goalActionHelpMessage);
                        else return message.reply(goalActionHelpMessage);
                    }
                }
            }
            // Next: GOAL DELETE ALL
            // Next: GOAL DELETE MANY
            // Next: GOAL DELETE

            // goal delete <NUMBER/RECENT/ALL>
            const noGoalsMessage = `**NO ${isArchived ? "ARCHIVED " : ""}GOALS**... try \`${PREFIX}${commandUsed} start help\``;
            if (isNaN(args[1 + archiveShift])) {
                const deleteType = goalType;
                if (deleteType === "recent") {
                    const goalView = await getOneGoalByRecency(authorID, 0, isArchived);
                    if (goalView.length === 0) {
                        return fn.sendErrorMessage(message, noGoalsMessage);
                    }
                    const goalTargetID = goalView._id;
                    console.log({ goalTargetID });
                    const goalIndex = await getRecentGoalIndex(authorID, isArchived);
                    const deleteConfirmMessage = `Are you sure you want to **delete your most recent goal?:**\n\n__**Goal ${goalIndex}:**__${goalDocumentToString(goalView)}`;
                    const deleteIsConfirmed = await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Long-Term Goal${isArchived ? ` Archive` : ""}: Delete Recent Goal`, 300000)
                    if (deleteIsConfirmed) {
                        await Goal.deleteOne({ _id: goalTargetID });
                        return;
                    }
                }
                else if (deleteType === "all") {
                    const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded goals?\n\nYou **cannot UNDO** this!" +
                        `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    const pastNumberOfEntriesIndex = totalGoalNumber;
                    if (pastNumberOfEntriesIndex === 0) {
                        return fn.sendErrorMessage(message, noGoalsMessage);
                    }
                    let confirmDeleteAll = await fn.getUserConfirmation(message, confirmDeleteAllMessage, forceSkip, `Long-Term Goal${isArchived ? ` Archive` : ""}: Delete All Goals WARNING!`);
                    if (!confirmDeleteAll) return;
                    const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR GOALS ON RECORD**?\n\nYou **cannot UNDO** this!"
                        + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    let finalConfirmDeleteAll = await fn.getUserConfirmation(message, finalDeleteAllMessage, `Long-Term Goal${isArchived ? ` Archive` : ""}: Delete ALL Goals FINAL Warning!`);
                    if (!finalConfirmDeleteAll) return;
                    console.log(`Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Goals`);
                    await Goal.deleteMany({ userID: authorID });
                    return;
                }
                else return message.reply(goalActionHelpMessage);
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
                if (indexByRecency) goalView = await getOneGoalByRecency(authorID, pastNumberOfEntriesIndex - 1, isArchived);
                else goalView = await getOneGoalByStartTime(authorID, pastNumberOfEntriesIndex - 1, isArchived);
                if (!goalView) {
                    return fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, "**GOAL DOES NOT EXIST**...");
                }
                const goalTargetID = goalView._id;
                const sortType = indexByRecency ? "By Recency" : "By Start Time";
                const deleteConfirmMessage = `Are you sure you want to **delete Goal ${pastNumberOfEntriesIndex}?:**\n\n__**Goal ${pastNumberOfEntriesIndex}:**__` +
                    goalDocumentToString(goalView);
                const deleteConfirmation = await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Long-Term Goal${isArchived ? ` Archive` : ""}: Delete Goal ${pastNumberOfEntriesIndex} (${sortType})`, 300000);
                if (deleteConfirmation) {
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Goal ${sortType}`);
                    await Goal.deleteOne({ _id: goalTargetID });
                    return;
                }
            }
        }



        else if (goalCommand === "see" || goalCommand === "show") {
            let goalSeeUsageMessage = getGoalReadOrDeleteHelp(PREFIX, commandUsed, goalCommand);
            goalSeeUsageMessage = fn.getMessageEmbed(goalSeeUsageMessage, `Long-Term Goal${isArchived ? ` Archive` : ""}: See Help`, goalEmbedColour);

            const seeCommands = ["past", "recent", "all", "archive"];

            if (goalType) {
                if (goalType === "help") {
                    return message.channel.send(goalSeeUsageMessage);
                }
                if (!totalGoalNumber) {
                    return message.reply(`**NO ${isArchived ? `ARCHIVED ` : ""}GOALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
                else if (goalType === "number") {
                    return message.reply(`You have **${totalGoalNumber} goal entries** on record.`);
                }
            }
            else return message.reply(goalActionHelpMessage);

            // Show the user the last goal with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(goalType) && isNaN(goalType)) {
                return message.reply(goalActionHelpMessage);
            }
            // Do not show the most recent goal embed, when a valid command is called
            // it will be handled properly later based on the values passed in!
            else {
                const seeType = goalType;
                var pastFunctionality,
                    pastNumberOfEntriesIndex;
                let indexByRecency = false;
                // To check if the given argument is a number!
                // If it's not a number and has passed the initial 
                // filter, then use the "past" functionality
                // Handling Argument 1:
                const isNumberArg = !isNaN(args[1 + archiveShift]);
                if (seeType === "recent") {
                    return message.channel.send(await getRecentGoal(authorID, isArchived, goalEmbedColour));
                }
                else if (seeType === "all") {
                    pastNumberOfEntriesIndex = totalGoalNumber;
                    pastFunctionality = true;
                }
                else if (isNumberArg) {
                    pastNumberOfEntriesIndex = parseInt(args[1 + archiveShift]);
                    if (pastNumberOfEntriesIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, goalActionHelpMessage, "**GOAL DOES NOT EXIST**...");
                    }
                    else pastFunctionality = false;
                }
                else if (seeType === "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else return message.reply(goalActionHelpMessage);
                console.log({ pastNumberOfEntriesIndex, pastFunctionality });
                if (pastFunctionality) {
                    // Loop through all of the given fields, account for aliases and update fields
                    // Find Goals, toArray, store data in meaningful output
                    if (args[3 + archiveShift] !== undefined) {
                        if (args[3 + archiveShift].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Start Time";
                    if (args[2 + archiveShift] !== undefined) {
                        // If the next argument is NotaNumber, invalid "past" command call
                        if (isNaN(args[2 + archiveShift])) return message.reply(goalActionHelpMessage);
                        if (parseInt(args[2 + archiveShift]) <= 0) return message.reply(goalActionHelpMessage);
                        const confirmSeeMessage = `Are you sure you want to **see ${args[2 + archiveShift]} goals?**`;
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeMessage, forceSkip, `Long-Term Goal${isArchived ? ` Archive` : ""}: See ${args[2 + archiveShift]} Goals (${sortType})`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (seeType !== "all") return message.reply(goalActionHelpMessage);
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your goal history?";
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeAllMessage, forceSkip, `Long-Term Goal${isArchived ? ` Archive` : ""}: See All Goals`);
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                    if (pastNumberOfEntriesIndex === undefined) {
                        pastNumberOfEntriesIndex = parseInt(args[2 + archiveShift]);
                    }
                    var goalView;
                    if (indexByRecency) goalView = await fn.getEntriesByRecency(Goal, { userID: authorID, archived: isArchived }, 0, pastNumberOfEntriesIndex);
                    else goalView = await getGoalsByStartTime(authorID, 0, pastNumberOfEntriesIndex, isArchived);
                    console.log({ goalView, pastNumberOfEntriesIndex });
                    const goalArray = multipleGoalsToStringArray(message, goalView, pastNumberOfEntriesIndex, 0);
                    await fn.sendPaginationEmbed(message, fn.getEmbedArray(goalArray, `Long-Term Goal${isArchived ? ` Archive` : ""}: See ${pastNumberOfEntriesIndex} Goals (${sortType})`, true, true, goalEmbedColour));
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
                                const sortType = indexByRecency ? "By Recency" : "By Start Time";
                                var entriesToSkip;
                                // If the argument after past is a number, valid command call!
                                if (!isNaN(args[3 + archiveShift + shiftIndex])) {
                                    entriesToSkip = parseInt(args[3 + archiveShift + shiftIndex]);
                                }
                                else if (args[3 + archiveShift + shiftIndex].toLowerCase() === "recent") {
                                    entriesToSkip = await getRecentGoal(authorID, isArchived, goalEmbedColour);
                                }
                                else return message.reply(goalActionHelpMessage);
                                if (entriesToSkip < 0 || entriesToSkip > totalGoalNumber) {
                                    return fn.sendErrorMessageAndUsage(message, goalActionHelpMessage, "**GOAL(S) DO NOT EXIST**...");
                                }
                                const confirmSeePastMessage = `Are you sure you want to **see ${args[1 + archiveShift]} entries past ${entriesToSkip}?**`;
                                const confirmSeePast = await fn.getUserConfirmation(message, confirmSeePastMessage, forceSkip, `Long-Term Goal${isArchived ? ` Archive` : ""}: See ${args[1 + archiveShift]} Goals Past ${entriesToSkip} (${sortType})`);
                                if (!confirmSeePast) return;
                                var goalView;
                                if (indexByRecency) goalView = await fn.getEntriesByRecency(Goal, { userID: authorID, archived: isArchived }, entriesToSkip, pastNumberOfEntriesIndex);
                                else goalView = await getGoalsByStartTime(authorID, entriesToSkip, pastNumberOfEntriesIndex, isArchived);
                                console.log({ goalView });
                                const goalStringArray = multipleGoalsToStringArray(message, goalView, pastNumberOfEntriesIndex, entriesToSkip);
                                await fn.sendPaginationEmbed(message, fn.getEmbedArray(goalStringArray, `Long-Term Goal${isArchived ? ` Archive` : ""}: See ${pastNumberOfEntriesIndex} Goals Past ${entriesToSkip} (${sortType})`, true, true, goalEmbedColour));
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
                if (indexByRecency) goalView = await getOneGoalByRecency(authorID, pastNumberOfEntriesIndex - 1, isArchived);
                else goalView = await getOneGoalByStartTime(authorID, pastNumberOfEntriesIndex - 1, isArchived);
                console.log({ goalView });
                if (!goalView) {
                    return fn.sendErrorMessage(message, `**GOAL ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                }
                // NOT using the past functionality:
                const sortType = indexByRecency ? "By Recency" : "By Start Time";
                const goalString = `__**Goal ${pastNumberOfEntriesIndex}:**__${goalDocumentToString(goalView)}`;
                const goalEmbed = fn.getMessageEmbed(goalString, `Long-Term Goal${isArchived ? ` Archive` : ""}: See Goal ${pastNumberOfEntriesIndex} (${sortType})`, goalEmbedColour);
                message.channel.send(goalEmbed);
            }
        }


        else if (goalCommand === "edit" || goalCommand === "change" || goalCommand === "ed"
            || goalCommand === "ch" || goalCommand === "c") {

        }


        else if (goalCommand === "post" || goalCommand === "p") {
            let goals = await Goal.find({}).sort({ 'goal.start': +1 });
            if (!goals) return message.reply(`**You don't have any goals**, try \`${PREFIX}${commandUsed} start\``);
            const targetChannel = await fn.getPostChannel(bot, message, `Long-Term Goal`, forceSkip, goalEmbedColour);
            if (!targetChannel) return;
            const member = bot.channels.cache.get(targetChannel).guild.member(authorID);
            const posts = fn.getEmbedArray([`<@!${authorID}>`].concat(multipleGoalsToStringArray(message, goals, totalGoalNumber, 0)),
            `${member ? `${member.displayName}'s ` : ""}Long-Term Goals (as of ${new Date(Date.now() + HOUR_IN_MS * timezoneOffset).getUTCFullYear()})`,
            true, false, goalEmbedColour);
            posts.forEach(async post => {
                await fn.sendMessageToChannel(bot, post, targetChannel);
            });
        }


        else if (goalCommand === "end" || goalCommand === "e" || goalCommand === "complete" || goalCommand === "log") {

        }


        else if (goalCommand === "status" || goalCommand === "check") {

        }


        else if (archiveRegex.test(goalCommand) || goalCommand === "stash" || goalCommand === "store") {

        }


        else return message.reply(goalHelpMessage);
    }
};