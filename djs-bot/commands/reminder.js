// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
require("dotenv").config();

const validTypes = fn.reminderTypes;
const reminderEmbedColour = fn.reminderEmbedColour;
const reminderType = "Reminder";
const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const futureTimeExamples = fn.futureTimeExamples;

// Function Declarations and Definitions

module.exports = {
    name: "reminder",
    description: "Set a personal or group SINGLE-USE reminder",
    aliases: ["rm", "remindme", "remind", "reminders"],
    cooldown: 3.5,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavingsSetting, forceSkip) {
        // Variable Declarations and Initializations
        const authorID = message.author.id;
        const authorUsername = message.author.username;
        let reminderUsageMessage = `**USAGE** (One-time Reminder)\n\`${PREFIX}${commandUsed} <ACTION> <force?>\``
            + "\n\n\`<ACTION>\`: **set/start; see; edit; delete**"
            + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**"
            + `\n\nIf you want to set a recurring reminder, try \`${PREFIX}repeat <force?>\``
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        reminderUsageMessage = fn.getMessageEmbed(reminderUsageMessage, "One-Time Reminder: Help", reminderEmbedColour);
        const reminderHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        const reminderCommand = args[0] ? args[0].toLowerCase() : false;
        const reminderIndex = args[1] ? args[1].toLowerCase() : false;
        const totalReminderNumber = await rm.getTotalReminders(authorID, false);
        if (totalReminderNumber === false) return;


        if (reminderCommand === "help") {
            return message.channel.send(reminderUsageMessage);
        }


        // CRUD Operations
        const reminderActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${reminderCommand} help\``;

        if (reminderCommand === "delete" || reminderCommand === "del" || reminderCommand === "d" || reminderCommand === "remove" || reminderCommand === "rem" || reminderCommand === "r") {
            let reminderDeleteUsageMessage = fn.getReadOrDeleteUsageMessage(PREFIX, commandUsed, reminderCommand, true, ["Reminder", "Reminders"]);
            reminderDeleteUsageMessage = fn.getMessageEmbed(reminderDeleteUsageMessage, "Reminder: Delete Help", reminderEmbedColour);
            const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see help\``;

            if (reminderIndex) {
                if (reminderIndex === "help") {
                    return message.channel.send(reminderDeleteUsageMessage);
                }
                if (!totalReminderNumber) {
                    return message.reply(`**NO REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
            }
            else return message.reply(reminderActionHelpMessage);

            // delete past #:
            if (args[2] !== undefined) {
                const deleteType = reminderIndex;
                if (deleteType === "past") {
                    // If the following argument is not a number, exit!
                    if (isNaN(args[2])) {
                        return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage);
                    }
                    var numberArg = parseInt(args[2]);
                    if (numberArg <= 0) {
                        return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage);
                    }
                    let indexByRecency = false;
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By End Time";
                    var reminderCollection;
                    if (indexByRecency) reminderCollection = await fn.getEntriesByRecency(Reminder, { userID: authorID, isRecurring: false }, 0, numberArg);
                    else reminderCollection = await fn.getEntriesByEarliestEndTime(Reminder, { userID: authorID, isRecurring: false }, 0, numberArg);
                    const reminderStringArray = fn.getEmbedArray(rm.multipleRemindersToString(bot, message, reminderCollection, numberArg, timezoneOffset, 0, true),
                        '', true, false, reminderEmbedColour);
                    const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} reminder(s)?**`;
                    const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, reminderStringArray, multipleDeleteMessage, forceSkip,
                        `Reminder: Delete Past ${numberArg} Reminders (${sortType})`, 600000);
                    if (!multipleDeleteConfirmation) return;
                    const targetIDs = await reminderCollection.map(reminder => reminder._id);
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Reminders (${sortType})`);
                    await Reminder.deleteMany({ _id: { $in: targetIDs } });
                    return;
                }
                if (deleteType === "many") {
                    if (args[2] === undefined) {
                        return message.reply(reminderActionHelpMessage);
                    }
                    // Get the arguments after keyword MANY
                    // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
                    // Convert String of Numbers array into Integer array
                    // Check which reminder exist, remove/don't add those that don't
                    let toDelete = args[2].split(',').filter(index => {
                        if (!isNaN(index)) {
                            numberIndex = parseInt(index);
                            if (numberIndex > 0 && numberIndex <= totalReminderNumber) {
                                return numberIndex;
                            }
                        }
                        else if (index === "recent") {
                            return true;
                        }
                    });
                    const recentIndex = await rm.getRecentReminderIndex(authorID, false);
                    toDelete = Array.from(new Set(toDelete.map((number) => {
                        if (number === "recent") {
                            if (recentIndex !== -1) return recentIndex;
                        }
                        else return +number;
                    })));
                    console.log({ toDelete });
                    // Send error message if none of the given reminders exist
                    if (!toDelete.length) {
                        return fn.sendErrorMessage(message, "All of these **reminders DO NOT exist**...");
                    }
                    var indexByRecency = false;
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var reminderTargetIDs = new Array();
                    var reminderDataToStringArray = new Array();
                    for (i = 0; i < toDelete.length; i++) {
                        var reminderView;
                        if (indexByRecency) {
                            reminderView = await rm.getOneReminderByRecency(authorID, toDelete[i] - 1, false);
                        }
                        else {
                            reminderView = await rm.getOneReminderByEndTime(authorID, toDelete[i] - 1, false);
                        }
                        var reminderData;
                        if (toDelete[i] === 1) {
                            reminderData = rm.reminderDocumentToDataArray(reminderView, timezoneOffset, true);
                        }
                        else {
                            reminderData = rm.reminderDocumentToDataArray(reminderView);
                        }
                        reminderTargetIDs.push(reminderView._id);
                        reminderDataToStringArray.push(`__**Reminder ${toDelete[i]}:**__\n${rm.reminderDataArrayToString(bot, reminderData, timezoneOffset)}`);
                    }
                    const deleteConfirmMessage = `Are you sure you want to **delete reminders ${toDelete.toString()}?**`;
                    const sortType = indexByRecency ? "By Recency" : "By End Time";
                    reminderDataToStringArray = fn.getEmbedArray(reminderDataToStringArray, '', true, false, reminderEmbedColour);
                    const confirmDeleteMany = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, reminderDataToStringArray, deleteConfirmMessage,
                        forceSkip, `Reminder: Delete Reminders ${toDelete} (${sortType})`, 600000);
                    if (confirmDeleteMany) {
                        console.log(`Deleting ${authorID}'s Reminders ${toDelete} (${sortType})`);
                        await Reminder.deleteMany({ _id: { $in: reminderTargetIDs } });
                        return;
                    }
                    else return;
                }
                else {
                    var shiftIndex;
                    let indexByRecency = false;
                    if (args[2].toLowerCase() === "past") {
                        shiftIndex = 0;
                        indexByRecency = false;
                    }
                    else if (args[2].toLowerCase() === "recent") {
                        shiftIndex = 1;
                        indexByRecency = true;
                    }
                    console.log({ shiftIndex });
                    if (args[2 + shiftIndex]) {
                        if (args[2 + shiftIndex].toLowerCase() === "past") {
                            var skipEntries;
                            if (isNaN(args[3 + shiftIndex])) {
                                if (args[3 + shiftIndex].toLowerCase() === "recent") {
                                    skipEntries = await rm.getRecentReminderIndex(authorID, false);
                                }
                                else return message.reply(reminderActionHelpMessage);
                            }
                            else skipEntries = parseInt(args[3 + shiftIndex]);
                            const pastNumberOfEntries = parseInt(args[1]);
                            if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                                return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage);
                            }
                            var reminderCollection;
                            if (indexByRecency) reminderCollection = await fn.getEntriesByRecency(Reminder, { userID: authorID, isRecurring: false }, skipEntries, pastNumberOfEntries);
                            else reminderCollection = await fn.getEntriesByEarliestEndTime(Reminder, { userID: authorID, isRecurring: false }, skipEntries, pastNumberOfEntries);
                            const reminderStringArray = fn.getEmbedArray(rm.multipleRemindersToString(bot, message, reminderCollection, pastNumberOfEntries, timezoneOffset, skipEntries, true),
                                '', true, false, reminderEmbedColour);
                            if (skipEntries >= totalReminderNumber) return;
                            const sortType = indexByRecency ? "By Recency" : "By End Time";
                            const multipleDeleteMessage = `Are you sure you want to **delete ${reminderCollection.length} reminder(s) past reminder ${skipEntries}?**`;
                            const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, reminderStringArray, multipleDeleteMessage,
                                forceSkip, `Reminder: Multiple Delete Warning! (${sortType})`);
                            if (!multipleDeleteConfirmation) return;
                            const targetIDs = await reminderCollection.map(reminder => reminder._id);
                            console.log(`Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} reminder(s) past ${skipEntries} (${sortType})`);
                            await Reminder.deleteMany({ _id: { $in: targetIDs } });
                            return;
                        }

                        // They haven't specified the field for the reminder delete past function
                        else if (deleteType === "past") return message.reply(reminderActionHelpMessage);
                        else return message.reply(reminderActionHelpMessage);
                    }
                }
            }
            // Next: REMINDER DELETE ALL
            // Next: REMINDER DELETE MANY
            // Next: REMINDER DELETE

            // reminder delete <NUMBER/RECENT/ALL>
            const noRemindersMessage = `**NO REMINDERS**... try \`${PREFIX}${commandUsed} start help\``;
            if (isNaN(args[1])) {
                const deleteType = args[1].toLowerCase();
                if (deleteType === "recent") {
                    const reminderView = await rm.getOneReminderByRecency(authorID, 0, false);
                    if (reminderView.length === 0) {
                        return fn.sendErrorMessage(message, noRemindersMessage);
                    }
                    const reminderData = rm.reminderDocumentToDataArray(reminderView);
                    const reminderTargetID = reminderView._id;
                    console.log({ reminderTargetID });
                    const reminderIndex = await rm.getRecentReminderIndex(authorID, false);
                    const reminderEmbed = fn.getEmbedArray(`__**Reminder ${reminderIndex}:**__\n${rm.reminderDataArrayToString(bot, reminderData, timezoneOffset)}`,
                        `Reminder: Delete Recent Reminder`, true, true, reminderEmbedColour);
                    const deleteConfirmMessage = `Are you sure you want to **delete your most recent reminder?**`;
                    const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, reminderEmbed, deleteConfirmMessage, forceSkip,
                        `Reminder: Delete Recent Reminder`, 600000);
                    if (deleteIsConfirmed) {
                        await Reminder.deleteOne({ _id: reminderTargetID });
                        return;
                    }
                }
                else if (deleteType === "all") {
                    const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded reminders?\n\nYou **cannot UNDO** this!" +
                        `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    const pastNumberOfEntriesIndex = totalReminderNumber;
                    if (pastNumberOfEntriesIndex === 0) {
                        return fn.sendErrorMessage(message, noRemindersMessage);
                    }
                    let confirmDeleteAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmDeleteAllMessage, forceSkip, "Reminder: Delete All Reminders WARNING!");
                    if (!confirmDeleteAll) return;
                    const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR REMINDERS ON RECORD**?\n\nYou **cannot UNDO** this!"
                        + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    let finalConfirmDeleteAll = await fn.getUserConfirmation(bot, message, PREFIX, finalDeleteAllMessage, false, "Reminders: Delete ALL Reminders FINAL Warning!");
                    if (!finalConfirmDeleteAll) return;
                    console.log(`Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Reminders`);
                    await Reminder.deleteMany({ userID: authorID, isRecurring: false });
                    return;
                }
                else return message.reply(reminderActionHelpMessage);
            }
            else {
                const pastNumberOfEntriesIndex = parseInt(args[1]);
                let indexByRecency = false;
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var reminderView;
                if (indexByRecency) reminderView = await rm.getOneReminderByRecency(authorID, pastNumberOfEntriesIndex - 1, false);
                else reminderView = await rm.getOneReminderByEndTime(authorID, pastNumberOfEntriesIndex - 1, false);
                if (!reminderView) {
                    return fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, "**REMINDER DOES NOT EXIST**...");
                }
                const reminderData = rm.reminderDocumentToDataArray(reminderView);
                const reminderTargetID = reminderView._id;
                const sortType = indexByRecency ? "By Recency" : "By End Time";
                const reminderEmbed = fn.getEmbedArray(`__**Reminder ${pastNumberOfEntriesIndex}:**__\n${rm.reminderDataArrayToString(bot, reminderData, timezoneOffset)}`,
                    `Reminder: Delete Reminder ${pastNumberOfEntriesIndex} (${sortType})`, true, true, reminderEmbedColour);
                const deleteConfirmMessage = `Are you sure you want to **delete Reminder ${pastNumberOfEntriesIndex}?**`;
                const deleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, reminderEmbed, deleteConfirmMessage, forceSkip,
                    `Reminder: Delete Reminder ${pastNumberOfEntriesIndex} (${sortType})`, 600000);
                if (deleteConfirmation) {
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Reminder ${sortType}`);
                    await Reminder.deleteOne({ _id: reminderTargetID });
                    return;
                }
            }
        }



        else if (reminderCommand === "see" || reminderCommand === "show") {
            let reminderSeeUsageMessage = fn.getReadOrDeleteUsageMessage(PREFIX, commandUsed, reminderCommand, true, ["Reminder", "Reminders"]);
            reminderSeeUsageMessage = fn.getMessageEmbed(reminderSeeUsageMessage, "Reminder: See Help", reminderEmbedColour);
            if (reminderIndex) {
                if (reminderIndex === "help") {
                    return message.channel.send(reminderSeeUsageMessage);
                }
                if (!totalReminderNumber) {
                    return message.reply(`**NO REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
            }
            else return message.reply(reminderActionHelpMessage);

            const seeCommands = ["past", "recent", "all"];

            if (reminderIndex) {
                if (reminderIndex === "help") {
                    return message.channel.send(reminderSeeUsageMessage);
                }
                if (!totalReminderNumber) {
                    return message.reply(`**NO REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
                else if (reminderIndex === "number") {
                    return message.reply(`You have **${totalReminderNumber} reminders** on record.`);
                }
            }
            else return message.reply(reminderActionHelpMessage);

            // Show the user the last reminder with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(reminderIndex) && isNaN(reminderIndex)) {
                return message.reply(reminderActionHelpMessage);
            }
            // Do not show the most recent reminder embed, when a valid command is called
            // it will be handled properly later based on the values passed in!
            else {
                const seeType = reminderIndex;
                var pastFunctionality,
                    pastNumberOfEntriesIndex;
                let indexByRecency = false;
                // To check if the given argument is a number!
                // If it's not a number and has passed the initial 
                // filter, then use the "past" functionality
                // Handling Argument 1:
                const isNumberArg = !isNaN(args[1]);
                if (seeType === "recent") {
                    return message.channel.send(await rm.getMostRecentReminder(bot, authorID, false, timezoneOffset, reminderEmbedColour));
                }
                else if (seeType === "all") {
                    pastNumberOfEntriesIndex = totalReminderNumber;
                    pastFunctionality = true;
                }
                else if (isNumberArg) {
                    pastNumberOfEntriesIndex = parseInt(args[1]);
                    if (pastNumberOfEntriesIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage, "**REMINDER DOES NOT EXIST**...");
                    }
                    else pastFunctionality = false;
                }
                else if (seeType === "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else {
                    message.channel.send(await rm.getMostRecentReminder(bot, authorID, false, timezoneOffset, reminderEmbedColour));
                    return message.reply(reminderActionHelpMessage);
                }
                console.log({ pastNumberOfEntriesIndex, pastFunctionality });
                if (pastFunctionality) {
                    // Loop through all of the given fields, account for aliases and update fields
                    // Find Entries, toArray, store data in meaningful output
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By End Time";
                    if (args[2] !== undefined) {
                        // If the next argument is NotaNumber, invalid "past" command call
                        if (isNaN(args[2])) {
                            message.channel.send(await rm.getMostRecentReminder(bot, authorID, false, timezoneOffset, reminderEmbedColour));
                            return message.reply(reminderActionHelpMessage);
                        }
                        if (parseInt(args[2]) <= 0) {
                            message.channel.send(await rm.getMostRecentReminder(bot, authorID, false, timezoneOffset, reminderEmbedColour));
                            return message.reply(reminderActionHelpMessage);
                        }
                        const confirmSeeMessage = `Are you sure you want to **see ${args[2]} reminders?**`;
                        let confirmSeeAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeeMessage, forceSkip, `Reminder: See ${args[2]} Reminders (${sortType})`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (seeType !== "all") {
                            message.channel.send(await rm.getMostRecentReminder(bot, authorID, false, timezoneOffset, reminderEmbedColour));
                            return message.reply(reminderActionHelpMessage);
                        }
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your reminder history?";
                        let confirmSeeAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeeAllMessage, forceSkip, "Reminder: See All Reminders");
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                    if (pastNumberOfEntriesIndex === undefined) {
                        pastNumberOfEntriesIndex = parseInt(args[2]);
                    }
                    var reminderView;
                    if (indexByRecency) reminderView = await fn.getEntriesByRecency(Reminder, { userID: authorID, isRecurring: false }, 0, pastNumberOfEntriesIndex);
                    else reminderView = await fn.getEntriesByEarliestEndTime(Reminder, { userID: authorID, isRecurring: false }, 0, pastNumberOfEntriesIndex);
                    console.log({ reminderView });
                    const reminderDataToStringArray = rm.multipleRemindersToString(bot, message, reminderView, pastNumberOfEntriesIndex, timezoneOffset, 0, true);
                    await fn.sendPaginationEmbed(bot, message.channel.id, authorID, fn.getEmbedArray(reminderDataToStringArray, `Reminder: See ${pastNumberOfEntriesIndex} Reminders (${sortType})`, true, true, reminderEmbedColour));
                    return;
                }
                // see <PAST_#_OF_ENTRIES> <recent> past <INDEX>
                if (args[2] !== undefined) {
                    var shiftIndex;
                    if (args[2].toLowerCase() === "past") {
                        shiftIndex = 0;
                        indexByRecency = false;
                    }
                    else if (args[2].toLowerCase() === "recent") {
                        shiftIndex = 1;
                        indexByRecency = true;
                    }
                    else return message.reply(reminderActionHelpMessage);
                    if (args[2 + shiftIndex]) {
                        if (args[2 + shiftIndex].toLowerCase() === "past") {
                            if (args[3 + shiftIndex] !== undefined) {
                                const sortType = indexByRecency ? "By Recency" : "By End Time";
                                var entriesToSkip;
                                // If the argument after past is a number, valid command call!
                                if (!isNaN(args[3 + shiftIndex])) {
                                    entriesToSkip = parseInt(args[3 + shiftIndex]);
                                }
                                else if (args[3 + shiftIndex].toLowerCase() === "recent") {
                                    entriesToSkip = await rm.getRecentReminderIndex(authorID, false);
                                }
                                else return message.reply(reminderActionHelpMessage);
                                if (entriesToSkip < 0 || entriesToSkip > totalReminderNumber) {
                                    return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage, "**REMINDER(S) DO NOT EXIST**...");
                                }
                                const confirmSeePastMessage = `Are you sure you want to **see ${args[1]} reminders past ${entriesToSkip}?**`;
                                const confirmSeePast = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeePastMessage, forceSkip, `Reminder: See ${args[1]} Reminders Past ${entriesToSkip} (${sortType})`);
                                if (!confirmSeePast) return;
                                var reminderView;
                                if (indexByRecency) reminderView = await fn.getEntriesByRecency(Reminder, { userID: authorID, isRecurring: false }, entriesToSkip, pastNumberOfEntriesIndex);
                                else reminderView = await fn.getEntriesByEarliestEndTime(Reminder, { userID: authorID, isRecurring: false }, entriesToSkip, pastNumberOfEntriesIndex);
                                console.log({ reminderView });
                                const reminderDataToStringArray = rm.multipleRemindersToString(bot, message, reminderView, pastNumberOfEntriesIndex, timezoneOffset, entriesToSkip, true);
                                await fn.sendPaginationEmbed(bot, message.channel.id, authorID, fn.getEmbedArray(reminderDataToStringArray, `Reminder: See ${pastNumberOfEntriesIndex} Reminder Past ${entriesToSkip} (${sortType})`, true, true, reminderEmbedColour));
                                return;
                            }
                        }
                    }
                }
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var reminderView;
                if (indexByRecency) reminderView = await rm.getOneReminderByRecency(authorID, pastNumberOfEntriesIndex - 1, false);
                else reminderView = await rm.getOneReminderByEndTime(authorID, pastNumberOfEntriesIndex - 1, false);
                console.log({ reminderView });
                if (!reminderView) {
                    return fn.sendErrorMessage(message, `**REMINDER ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                }
                // NOT using the past functionality:
                const sortType = indexByRecency ? "By Recency" : "By End Time";
                const reminderData = rm.reminderDocumentToDataArray(reminderView);
                const reminderDataToString = `__**Reminder ${pastNumberOfEntriesIndex}:**__\n` + rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                const reminderEmbed = fn.getEmbedArray(reminderDataToString, `Reminder: See Reminder ${pastNumberOfEntriesIndex} (${sortType})`, true, true, reminderEmbedColour);
                await fn.sendPaginationEmbed(bot, message.channel.id, authorID, reminderEmbed);
            }
        }

        // EDIT

        else if (reminderCommand === "edit" || reminderCommand === "ed" || reminderCommand === "update" || reminderCommand === "upd") {
            let reminderEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${reminderCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\``
                + "\n\n`<#_MOST_RECENT_ENTRY>`: **recent; 3** (3rd most recent entry, \\**any number*)"
                + "\n\n`<recent?>`(OPT.): type **recent** at the indicated spot to sort the reminders by **time created instead of reminder start time!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            reminderEditUsageMessage = fn.getMessageEmbed(reminderEditUsageMessage, `Reminder: Edit Help`, reminderEmbedColour);
            if (reminderIndex) {
                if (reminderIndex === "help") {
                    return message.channel.send(reminderEditUsageMessage);
                }
                if (!totalReminderNumber) {
                    return message.reply(`**NO REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }

                if (isNaN(reminderIndex) && reminderIndex !== "recent") {
                    return message.reply(reminderActionHelpMessage);
                }
                else {
                    var reminderFields = ["Type", "Send to (DM or Channel)", "Start Time", "End Time", "Message", "Repeat", "Interval"];
                    let fieldsList = "";
                    reminderFields.forEach((field, i) => {
                        fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
                    });
                    if (reminderIndex === "recent") {
                        pastNumberOfEntriesIndex = await rm.getRecentReminderIndex(authorID, false);
                    }
                    else {
                        pastNumberOfEntriesIndex = parseInt(reminderIndex);
                        if (pastNumberOfEntriesIndex <= 0) {
                            return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage, "**REMINDER DOES NOT EXIST**...");
                        }
                    }

                    var indexByRecency = false;
                    if (args[2] !== undefined) {
                        if (args[2].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var reminderView;
                    if (indexByRecency) reminderView = await rm.getOneReminderByRecency(authorID, pastNumberOfEntriesIndex - 1, false);
                    else reminderView = await rm.getOneReminderByEndTime(authorID, pastNumberOfEntriesIndex - 1, false);
                    if (!reminderView) {
                        return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage, `**REMINDER ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                    }
                    const sortType = indexByRecency ? "By Recency" : "By End Time";
                    const reminderTargetID = reminderView._id;
                    var reminderData, showReminder, continueEdit;
                    do {
                        const checkReminder = await rm.getOneReminderByObjectID(reminderTargetID);
                        if (!checkReminder) return;
                        continueEdit = false;
                        reminderData = rm.reminderDocumentToDataArray(reminderView);
                        showReminder = rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                        // Field the user wants to edit
                        const fieldToEditInstructions = "**Which field do you want to edit?:**";
                        const fieldToEditAdditionalMessage = `__**Reminder ${pastNumberOfEntriesIndex} (${sortType}):**__\n${showReminder}`;
                        const fieldToEditTitle = `Reminder: Edit Field`;
                        let fieldToEditIndex = await fn.userSelectFromList(bot, PREFIX, message, fieldsList, reminderFields.length, fieldToEditInstructions,
                            fieldToEditTitle, reminderEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                        if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                        var userEdit, reminderEditMessagePrompt = "";
                        const fieldToEdit = reminderFields[fieldToEditIndex];
                        const type = "Reminder";
                        switch (fieldToEditIndex) {
                            case 0:
                                reminderEditMessagePrompt = `Please enter one of the following reminder types: **__${validTypes.join(', ')}__**`;
                                userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 1:
                                reminderEditMessagePrompt = `Please enter the **channel you'd like to send the reminder to OR "DM"** if you want to get it through a Direct Message:`;
                                userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 2:
                                userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 3:
                                userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            // Reminder does not need a prompt explanation
                            case 4:
                                userEdit = await fn.getUserMultilineEditString(bot, PREFIX, message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 5:
                                reminderEditMessagePrompt = `Would you like to make this a **__repeating (⌚)__ OR __one-time (1️⃣)__ reminder?**`;
                                userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, reminderEditMessagePrompt,
                                    ['⌚', '1️⃣'], type, true, reminderEmbedColour);
                                break;
                            case 6:
                                if (reminderData[1] === true) {
                                    reminderEditMessagePrompt = `**Please enter the time you'd like in-between recurring reminders (interval):**`;
                                    userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                }
                                else userEdit = 0;
                                break;
                        }
                        console.log({ userEdit });
                        if (userEdit === false) return;
                        else if (userEdit === undefined) userEdit = "back";
                        else if (userEdit !== "back") {
                            // Parse User Edit
                            if (fieldToEditIndex === 2 || fieldToEditIndex === 3) {
                                const now = Date.now();
                                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                console.log({ userEdit });
                                reminderData[fieldToEditIndex + 3] = fn.timeCommandHandlerToUTC(userEdit, now, timezoneOffset, daylightSavingsSetting);
                                if (!reminderData[fieldToEditIndex + 3]) {
                                    fn.sendReplyThenDelete(message, `**INVALID TIME**... Try** \`${PREFIX}date\` **for **help with dates and times**`, 60000);
                                    continueEdit = true;
                                }
                                if (continueEdit === false) {
                                    reminderData[fieldToEditIndex + 3] -= HOUR_IN_MS * timezoneOffset;
                                    const validReminderDuration = fn.endTimeAfterStartTime(message, reminderData[5], reminderData[6], type);
                                    console.log({ validReminderDuration });
                                    if (!validReminderDuration) {
                                        continueEdit = true;
                                    }
                                    console.log({ reminderData });
                                }
                            }
                            else {
                                switch (fieldToEditIndex) {
                                    case 0:
                                        {
                                            let userType = fn.toTitleCase(userEdit)
                                            if (validTypes.includes(userType)) {
                                                let removeConnectedDocsConf = await fn.getUserConfirmation(bot, message, PREFIX,
                                                    `Are you sure you want to change the reminder type to **"${userType}"**`
                                                    + `\n\n*(This reminder will **lose** it's **connected document**, if any)*`,
                                                    forceSkip, "Reminder: Change Type Confirmation", 90000);
                                                if (removeConnectedDocsConf) {
                                                    reminderData[8] = userType;
                                                    reminderData[2] = undefined;
                                                }
                                            }
                                            else continueEdit = true;
                                            break;
                                        }
                                    case 1:
                                        {
                                            let userArgs = userEdit.split(/[\s\n]+/).join(' ');
                                            let channel = /((?:[Dd][Mm])|(?:\<\#\d+\>))/.exec(userArgs);
                                            if (channel) {
                                                if (/[Dd][Mm]/.test(channel[1])) {
                                                    reminderData[0] = true;
                                                    reminderData[4] = authorID;
                                                    reminderData[10] = undefined;
                                                }
                                                else {
                                                    let channelID = /\<\#(\d+)\>/.exec(channel);
                                                    channelID = channelID[1];
                                                    const userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                                                    console.log({ userPermissions });
                                                    if (userPermissions.has("SEND_MESSAGES") && userPermissions.has("VIEW_CHANNEL")) {
                                                        reminderData[0] = false;
                                                        reminderData[4] = channelID;
                                                        reminderData[10] = bot.channels.cache.get(channelID).guild.id;
                                                    }
                                                    else {
                                                        continueEdit = true;
                                                        message.reply(`You are **not authorized to send messages** to that channel...`);
                                                    }
                                                }
                                            }
                                        }
                                        break;
                                    case 4: reminderData[7] = userEdit;
                                        break;
                                    case 5:
                                        {
                                            switch (userEdit) {
                                                case '⌚': userEdit = true;
                                                    break;
                                                case '1️⃣': userEdit = false;
                                                    break;
                                                default: null;
                                                    break;
                                            }
                                            if (typeof userEdit === "boolean") {
                                                // From One-Time to Repeating
                                                if (userEdit === true && reminderData[1] === false) {
                                                    reminderData[1] = userEdit;
                                                    const interval = await rm.getEditInterval(bot, message, PREFIX, timezoneOffset, daylightSavingsSetting,
                                                        reminderFields[6], `\n**Please enter the time you'd like in-between recurring reminders (interval):**`,
                                                        type, reminderEmbedColour);
                                                    if (!interval) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    reminderData[9] = interval;
                                                    // GET THE INTENDED END TIME!
                                                    const endTime = await rm.getEditEndTime(bot, message, reminderHelpMessage, timezoneOffset, daylightSavingsSetting,
                                                        forceSkip, true, reminderData[7], reminderData[0], reminderData[4], reminderData[9]);
                                                    if (!endTime) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    else {
                                                        reminderData[6] = endTime;
                                                        // message.reply(`Use \`${PREFIX}repeat help\` to continue editing this reminder!`);
                                                    }
                                                }
                                                // From Repeating to One-Time
                                                else if (userEdit === false && reminderData[1] === true) {
                                                    reminderData[1] = userEdit;
                                                    // GET THE INTENDED END TIME! (For non-recurring)
                                                    const endTime = await rm.getEditEndTime(bot, message, reminderHelpMessage, timezoneOffset, daylightSavingsSetting,
                                                        forceSkip, false, reminderData[7], reminderData[0], reminderData[4], reminderData[9]);
                                                    if (!endTime) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    else {
                                                        reminderData[6] = endTime;
                                                        // message.reply(`Use \`${PREFIX}reminder help\` to continue editing this reminder!`);
                                                    }
                                                }
                                                else {
                                                    continueEdit = true;
                                                    break;
                                                }

                                            }
                                            else {
                                                continueEdit = true;
                                                break;
                                            }
                                        }
                                        break;
                                    case 6:
                                        {
                                            // Ensure that the reminder isRecurring
                                            if (reminderData[1] === true) {
                                                const timeArgs = userEdit.toLowerCase().split(' ');
                                                const interval = await rm.getProcessedInterval(message, timeArgs, PREFIX, timezoneOffset, daylightSavingsSetting);
                                                if (!interval) {
                                                    continueEdit = true;
                                                    break;
                                                }
                                                else reminderData[9] = interval;
                                            }
                                            else {
                                                fn.sendReplyThenDelete(message, `**Interval cannot be set for one-time reminder**, try changing the **repeat** first`, 30000);
                                                continueEdit = true;
                                                break;
                                            }
                                        }
                                        break;
                                }
                            }
                            console.log({ reminderData });
                            if (!continueEdit) {
                                try {
                                    console.log(`Editing ${authorID}'s Fast ${pastNumberOfEntriesIndex} (${sortType})`);
                                    // Setup a new reminder! And leave a new lastEdited Timestamp:
                                    let currentTimestamp = Date.now();
                                    var newReminder;
                                    switch (fieldToEditIndex) {
                                        case 0:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { type: reminderData[8], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                        case 1:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, {
                                                $set: {
                                                    isDM: reminderData[0], channel: reminderData[4],
                                                    guildID: reminderData[10], lastEdited: currentTimestamp
                                                }
                                            }, { new: true });
                                            break;
                                        case 2:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { startTime: reminderData[5], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                        case 3:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { endTime: reminderData[6], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                        case 4:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { message: reminderData[7], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                        case 5:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, {
                                                $set: {
                                                    isRecurring: reminderData[1], endTime: reminderData[6],
                                                    interval: reminderData[9], lastEdited: currentTimestamp
                                                }
                                            }, { new: true });
                                            break;
                                        case 6:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { interval: reminderData[9], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                    }
                                    console.log({ continueEdit, userEdit, newReminder });
                                    currentTimestamp = Date.now();
                                    reminderView = await Reminder.findById(reminderTargetID);
                                    if (reminderView) {
                                        await rm.sendReminderByObject(bot, currentTimestamp, newReminder);
                                        pastNumberOfEntriesIndex = indexByRecency ? await rm.getReminderIndexByRecency(authorID, reminderTargetID, reminderData[1]) : await rm.getReminderIndexByEndTime(authorID, reminderTargetID, reminderData[1]);
                                        console.log({ reminderView, reminderData, reminderTargetID, fieldToEditIndex });
                                        reminderData = rm.reminderDocumentToDataArray(reminderView);
                                        showReminder = rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                                        console.log({ userEdit });
                                        const continueEditMessage = `Do you want to continue **editing Reminder ${pastNumberOfEntriesIndex}?:**\n\n__**Reminder ${pastNumberOfEntriesIndex}:**__\n${showReminder}`;
                                        continueEdit = await fn.getUserConfirmation(bot, message, PREFIX, continueEditMessage, forceSkip, `Reminder: Continue Editing Reminder ${pastNumberOfEntriesIndex}?`, 300000);
                                    }
                                    else {
                                        message.reply("**Reminder not found...**");
                                        continueEdit = false;
                                    }
                                }
                                catch (err) {
                                    return console.log(err);
                                }
                            }
                            else {
                                console.log({ continueEdit, userEdit });
                                reminderView = await Reminder.findById(reminderTargetID);
                                if (reminderView) {
                                    pastNumberOfEntriesIndex = indexByRecency ? await rm.getReminderIndexByRecency(authorID, reminderTargetID, reminderData[1]) : await rm.getReminderIndexByEndTime(authorID, reminderTargetID, reminderData[1]);
                                    console.log({ reminderView, reminderData, reminderTargetID, fieldToEditIndex });
                                    reminderData = rm.reminderDocumentToDataArray(reminderView);
                                    showReminder = rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                                }
                                else {
                                    message.reply("**Reminder not found...**");
                                    continueEdit = false;
                                }
                            }
                        }
                        else continueEdit = true;
                    }
                    while (continueEdit === true);
                    return;
                }
            }
            else return message.reply(reminderActionHelpMessage);
        }


        // Other functions: See, Edit, Remove
        // CREATE:
        else if (reminderCommand === "set" || reminderCommand === "s" || reminderCommand === "start" || reminderCommand === "make"
            || reminderCommand === "m" || reminderCommand === "create" || reminderCommand === "c" || reminderCommand === "st") {
            let channel = await rm.getChannelOrDM(bot, message, PREFIX,
                "Please enter the **target channel (using #)** or **\"DM\"** to send your reminder to.",
                `Reminder: Channel or DM`, true, reminderEmbedColour);
            if (!channel) return;
            const isDM = channel === "DM";

            let reminderMessage = await fn.getMultilineEntry(bot, PREFIX, message, `__**Enter the message of this reminder**__:`
                + `${isDM ? "" : "\n(Remember to **@mention** the roles/users you want to ping in the message!)"}`,
                "Reminder: Message", forceSkip, reminderEmbedColour);
            reminderMessage = reminderMessage.message;
            if (!reminderMessage) return;

            var currentTimestamp;
            let reminderEndTime = await fn.getDateAndTimeEntry(bot, message, PREFIX, timezoneOffset, daylightSavingsSetting,
                `Enter the **date/time** when you want the reminder to be triggered:`, `Reminder: End Time`, true,
                reminderEmbedColour, 300000, 60000, futureTimeExamples);
            if (!reminderEndTime) return;
            else {
                currentTimestamp = Date.now();
                reminderEndTime -= HOUR_IN_MS * timezoneOffset;
            }

            let duration = reminderEndTime - currentTimestamp;
            duration = fn.millisecondsToTimeString(duration > 0 ? duration : 0);
            const confirmCreationMessage = `Are you sure you want to set the following **one-time reminder** to send -\n**in ${channel} after ${duration} from now**:\n\n${reminderMessage}`;
            const confirmCreation = await fn.getUserConfirmation(bot, message, PREFIX, confirmCreationMessage, forceSkip, "Reminder: Confirm Creation", 180000);
            if (!confirmCreation) return;
            else {
                currentTimestamp = Date.now();
                if (isDM) {
                    await rm.setNewDMReminder(bot, authorID, currentTimestamp, currentTimestamp,
                        reminderEndTime, reminderMessage, reminderType, false, false, false, reminderEmbedColour);
                }
                else {
                    const channelID = /\<\#(\d+)\>/.exec(channel)[1];
                    const userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                    console.log({ userPermissions });
                    if (userPermissions.has("SEND_MESSAGES") && userPermissions.has("VIEW_CHANNEL")) {
                        await rm.setNewChannelReminder(bot, authorID, channelID, currentTimestamp, currentTimestamp,
                            reminderEndTime, reminderMessage, reminderType, false, false, false);
                    }
                    else return message.reply(`You are **not authorized to send messages** to that channel...`);
                }
                duration = reminderEndTime - currentTimestamp;
                duration = fn.millisecondsToTimeString(duration > 0 ? duration : 0);
                return message.reply(`Your **one-time reminder** has been set to trigger in **${duration}** from now!`);
            }
        }


        else return message.reply(reminderHelpMessage);
    },

};