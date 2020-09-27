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
const dateAndTimeInstructions = fn.getDateAndTimeInstructions;
const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");

// Function Declarations and Definitions

module.exports = {
    name: "reminder",
    description: "Set a personal or group SINGLE-USE reminder",
    aliases: ["rm", "remindme", "remind", "reminders"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavingsSetting, forceSkip) {
        // Variable Declarations and Initializations
        const authorID = message.author.id;
        const authorUsername = message.author.username;
        let reminderUsageMessage = `**USAGE** (One-time Reminder)\n\`${PREFIX}${commandUsed} <DATE/TIME> <CHANNEL> <MESSAGE> <force?>\``
            + `\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<CHANNEL>\`: **dm, #channel_name**"
            + "\n\n\`<MESSAGE>\`: To send at the given time __*(Remember to tag the roles/users you want to ping in the message!)*__"
            + "\n\n\`<ACTION>\`: **see; edit; remove**"
            + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**"
            + `\n\n${dateAndTimeInstructions}`
            + `\n\nIf you want to set a recurring reminder, try \`${PREFIX}repeat <INTERVAL> <CHANNEL> <MESSAGE> <force?>\` (then you will be prompted for the intended starting <DATE/TIME>)`
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
                    const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(message, reminderStringArray, multipleDeleteMessage, forceSkip,
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
                    const confirmDeleteMany = await fn.getPaginatedUserConfirmation(message, reminderDataToStringArray, deleteConfirmMessage,
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
                            const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(message, reminderStringArray, multipleDeleteMessage,
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
                    const deleteConfirmMessage = `Are you sure you want to **delete your most recent reminder?:**\n\n__**Reminder ${reminderIndex}:**__\n${rm.reminderDataArrayToString(bot, reminderData, timezoneOffset)}`;
                    const deleteIsConfirmed = await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Reminder: Delete Recent Reminder`, 300000)
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
                    let confirmDeleteAll = await fn.getUserConfirmation(message, confirmDeleteAllMessage, forceSkip, "Reminder: Delete All Reminders WARNING!");
                    if (!confirmDeleteAll) return;
                    const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR REMINDERS ON RECORD**?\n\nYou **cannot UNDO** this!"
                        + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    let finalConfirmDeleteAll = await fn.getUserConfirmation(message, finalDeleteAllMessage, false, "Reminders: Delete ALL Reminders FINAL Warning!");
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
                const deleteConfirmMessage = `Are you sure you want to **delete Reminder ${pastNumberOfEntriesIndex}?:**\n\n__**Reminder ${pastNumberOfEntriesIndex}:**__\n` +
                    rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                const deleteConfirmation = await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Reminder: Delete Reminder ${pastNumberOfEntriesIndex} (${sortType})`, 300000);
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
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeMessage, forceSkip, `Reminder: See ${args[2]} Reminders (${sortType})`);
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
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeAllMessage, forceSkip, "Reminder: See All Reminders");
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
                    await fn.sendPaginationEmbed(message, fn.getEmbedArray(reminderDataToStringArray, `Reminder: See ${pastNumberOfEntriesIndex} Reminders (${sortType})`, true, true, reminderEmbedColour));
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
                                const confirmSeePast = await fn.getUserConfirmation(message, confirmSeePastMessage, forceSkip, `Reminder: See ${args[1]} Reminders Past ${entriesToSkip} (${sortType})`);
                                if (!confirmSeePast) return;
                                var reminderView;
                                if (indexByRecency) reminderView = await fn.getEntriesByRecency(Reminder, { userID: authorID, isRecurring: false }, entriesToSkip, pastNumberOfEntriesIndex);
                                else reminderView = await fn.getEntriesByEarliestEndTime(Reminder, { userID: authorID, isRecurring: false }, entriesToSkip, pastNumberOfEntriesIndex);
                                console.log({ reminderView });
                                const reminderDataToStringArray = rm.multipleRemindersToString(bot, message, reminderView, pastNumberOfEntriesIndex, timezoneOffset, entriesToSkip, true);
                                await fn.sendPaginationEmbed(message, fn.getEmbedArray(reminderDataToStringArray, `Reminder: See ${pastNumberOfEntriesIndex} Reminder Past ${entriesToSkip} (${sortType})`, true, true, reminderEmbedColour));
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
                const reminderEmbed = fn.getMessageEmbed(reminderDataToString, `Reminder: See Reminder ${pastNumberOfEntriesIndex} (${sortType})`, reminderEmbedColour);
                message.channel.send(reminderEmbed);
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
                    return message.channel.send(reminderDeleteUsageMessage);
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
                        const checkFast = await rm.getOneReminderByObjectID(reminderTargetID);
                        if (!checkFast) return;
                        continueEdit = false;
                        reminderData = rm.reminderDocumentToDataArray(reminderView);
                        showReminder = rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                        // Field the user wants to edit
                        const fieldToEditInstructions = "**Which field do you want to edit?:**";
                        const fieldToEditAdditionalMessage = `__**Reminder ${pastNumberOfEntriesIndex} (${sortType}):**__\n${showReminder}`;
                        const fieldToEditTitle = `Reminder: Edit Field`;
                        let fieldToEditIndex = await fn.userSelectFromList(message, fieldsList, reminderFields.length, fieldToEditInstructions,
                            fieldToEditTitle, reminderEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                        if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                        var userEdit, reminderEditMessagePrompt = "";
                        const fieldToEdit = reminderFields[fieldToEditIndex];
                        const type = "Reminder";
                        switch (fieldToEditIndex) {
                            case 0:
                                reminderEditMessagePrompt = `Please enter one of the following reminder types: **__${validTypes.join(', ')}__**`;
                                userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 1:
                                reminderEditMessagePrompt = `Please enter the **channel you'd like to send the reminder to OR "DM"** if you want to get it through a Direct Message:`;
                                userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 2:
                                reminderEditMessagePrompt = dateAndTimeInstructions;
                                userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 3:
                                reminderEditMessagePrompt = dateAndTimeInstructions;
                                userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            // Reminder does not need a prompt explanation
                            case 4:
                                userEdit = await fn.getUserMultilineEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 5:
                                reminderEditMessagePrompt = `Would you like to make this a **__repeating (⌚)__ OR __one-time (1️⃣)__ reminder?**`;
                                userEdit = await fn.getUserEditBoolean(message, fieldToEdit, reminderEditMessagePrompt,
                                    ['⌚', '1️⃣'], type, forceSkip, reminderEmbedColour);
                                break;
                            case 6:
                                if (reminderData[1] === true) {
                                    reminderEditMessagePrompt = `**Please enter the time you'd like in-between recurring reminders (interval):**`;
                                    userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
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
                                const timestamp = Date.now();
                                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                console.log({ userEdit });
                                reminderData[fieldToEditIndex + 3] = fn.timeCommandHandlerToUTC(userEdit, timestamp, timezoneOffset, daylightSavingsSetting);
                                if (!reminderData[fieldToEditIndex + 3]) {
                                    fn.sendReplyThenDelete(message, `**INVALID TIME**... ${reminderHelpMessage}`, 60000);
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
                                                let removeConnectedDocsConf = await fn.getUserConfirmation(message,
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
                                                    let userInterval = await fn.getUserEditString(message, reminderFields[6],
                                                        `**Please enter the time you'd like in-between recurring reminders (interval):**`,
                                                        type, forceSkip, reminderEmbedColour);
                                                    if (!userInterval) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    let currentTimestamp = Date.now();
                                                    let timeArgs = userInterval.toLowerCase().split(' ');
                                                    let interval = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs,
                                                        currentTimestamp, timezoneOffset, daylightSavingsSetting);
                                                    if (!interval) {
                                                        continueEdit = true;
                                                        message.reply(`**INVALID Interval**... ${reminderHelpMessage} for **valid time inputs!**`);
                                                        break;
                                                    }
                                                    interval -= HOUR_IN_MS * timezoneOffset + currentTimestamp;
                                                    if (interval <= 0) {
                                                        continueEdit = true;
                                                        message.reply(`**INVALID Interval**... ${reminderHelpMessage} for **valid time inputs!**`);
                                                        break;
                                                    }
                                                    else if (interval < 60000) {
                                                        continueEdit = true;
                                                        message.reply(`**INVALID Interval**... Interval MUST be **__> 1m__**`);
                                                        break;
                                                    }
                                                    reminderData[9] = interval;
                                                    // GET THE INTENDED END TIME!
                                                    let duration = await rm.getUserFirstRecurringEndDuration(message, reminderHelpMessage, timezoneOffset, daylightSavingsSetting, true);
                                                    console.log({ duration })
                                                    if (!duration && duration !== 0) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    duration = duration > 0 ? duration : 0;
                                                    let channel = reminderData[0] ? "DM" : bot.channels.cache.get(reminderData[4]);
                                                    let confirmCreationMessage = `Are you sure you want to set the following **recurring reminder** to send -\n**in ${channel.name} after ${fn.millisecondsToTimeString(duration)}**`
                                                        + ` (and repeat every **${fn.millisecondsToTimeString(interval)}**):\n\n${reminderData[7]}`;
                                                    let confirmCreation = await fn.getUserConfirmation(message, confirmCreationMessage, forceSkip, "Recurring Reminder: Confirm Creation", 180000);
                                                    if (!confirmCreation) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    else {
                                                        currentTimestamp = Date.now();
                                                        reminderData[6] = currentTimestamp + duration;
                                                        console.log({ currentTimestamp });
                                                        let channelID = channel.id;
                                                        let userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                                                        console.log({ userPermissions });
                                                        if (!userPermissions.has("SEND_MESSAGES") || !userPermissions.has("VIEW_CHANNEL")) {
                                                            message.reply(`You are **not authorized to send messages** to that channel...`);
                                                        }
                                                        message.reply(`Your **recurring reminder** has been set to trigger in **${fn.millisecondsToTimeString(duration)}!**`);
                                                    }
                                                }
                                                // From Repeating to One-Time
                                                else if (userEdit === false && reminderData[1] === true) {
                                                    reminderData[1] = userEdit;
                                                    // GET THE INTENDED END TIME! (For non-recurring)
                                                    let duration = await rm.getUserFirstRecurringEndDuration(message, reminderHelpMessage, timezoneOffset, daylightSavingsSetting, false);
                                                    console.log({ duration })
                                                    if (!duration && duration !== 0) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    duration = duration > 0 ? duration : 0;
                                                    let channel = reminderData[0] ? "DM" : bot.channels.cache.get(reminderData[4]).name;
                                                    let confirmCreationMessage = `Are you sure you want to set the following **one-time reminder** to send -\n**in ${channel} after ${fn.millisecondsToTimeString(duration)}**`
                                                        + `\n\n${reminderData[7]}`;
                                                    let confirmCreation = await fn.getUserConfirmation(message, confirmCreationMessage, forceSkip, "Reminder: Confirm Creation", 180000);
                                                    if (!confirmCreation) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    else {
                                                        currentTimestamp = Date.now();
                                                        console.log({ currentTimestamp });
                                                        reminderData[6] = currentTimestamp + duration;
                                                        if (reminderData[0] === false) {
                                                            let channelID = channel.id;
                                                            let userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                                                            console.log({ userPermissions });
                                                            if (!userPermissions.has("SEND_MESSAGES") || !userPermissions.has("VIEW_CHANNEL")) {
                                                                message.reply(`You are **not authorized to send messages** to that channel...`);
                                                                continueEdit = true;
                                                                break;
                                                            }
                                                            message.reply(`Your **one-time reminder** has been set to trigger in **${fn.millisecondsToTimeString(duration)}!**`);
                                                        }
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
                                                let currentTimestamp = Date.now();
                                                let timeArgs = userEdit.toLowerCase().split(' ');
                                                let interval = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs,
                                                    currentTimestamp, timezoneOffset, daylightSavingsSetting);
                                                if (!interval) {
                                                    continueEdit = true;
                                                    message.reply(`**INVALID Interval**... ${reminderHelpMessage} for **valid time inputs!**`);
                                                    break;
                                                }
                                                interval -= HOUR_IN_MS * timezoneOffset + currentTimestamp;
                                                if (interval <= 0) {
                                                    continueEdit = true;
                                                    message.reply(`**INVALID Interval**... ${reminderHelpMessage} for **valid time inputs!**`);
                                                    break;
                                                }
                                                else if (interval < 60000) {
                                                    continueEdit = true;
                                                    message.reply(`**INVALID Interval**... Interval MUST be **__> 1m__**`);
                                                    break;
                                                }
                                                reminderData[9] = interval;
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
                                        pastNumberOfEntriesIndex = await rm.getRecentReminderIndex(authorID, false);
                                        console.log({ reminderView, reminderData, reminderTargetID, fieldToEditIndex });
                                        reminderData = rm.reminderDocumentToDataArray(reminderView);
                                        showReminder = rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                                        console.log({ userEdit });
                                        const continueEditMessage = `Do you want to continue **editing Reminder ${pastNumberOfEntriesIndex}?:**\n\n__**Reminder ${pastNumberOfEntriesIndex}:**__\n${showReminder}`;
                                        continueEdit = await fn.getUserConfirmation(message, continueEditMessage, forceSkip, `Reminder: Continue Editing Reminder ${pastNumberOfEntriesIndex}?`, 300000);
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
                                    pastNumberOfEntriesIndex = await rm.getRecentReminderIndex(authorID, false);
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
        else {
            const splitArgs = rm.getReminderSplitArgs(args);
            console.log({ splitArgs });
            if (!splitArgs) return message.reply(reminderHelpMessage);
            else {
                const currentTimestamp = message.createdTimestamp;
                const reminderEndTime = fn.timeCommandHandlerToUTC((["in"]).concat(splitArgs[0].split(' ')), currentTimestamp, timezoneOffset, daylightSavingsSetting)
                    - HOUR_IN_MS * timezoneOffset;
                console.log({ reminderEndTime });
                if (!reminderEndTime) return message.reply(`**INVALID Time**... ${reminderHelpMessage}`);
                let duration = reminderEndTime - currentTimestamp;
                duration = fn.millisecondsToTimeString(duration > 0 ? duration : 0);
                const confirmCreationMessage = `Are you sure you want to set the following **one-time reminder** to send -\n**in ${splitArgs[1]} after ${duration} from now**:\n\n${splitArgs[2]}`;
                const confirmCreation = await fn.getUserConfirmation(message, confirmCreationMessage, forceSkip, "Reminder: Confirm Creation", 180000);
                if (!confirmCreation) return;
                else {
                    if (splitArgs[1].toLowerCase() === "dm") {
                        await rm.setNewDMReminder(bot, authorID, currentTimestamp, currentTimestamp,
                            reminderEndTime, splitArgs[2], reminderType, false, false, false, reminderEmbedColour);
                    }
                    else {
                        const channelID = /\<\#(\d+)\>/.exec(splitArgs[1])[1];
                        const userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                        console.log({ userPermissions });
                        if (userPermissions.has("SEND_MESSAGES") && userPermissions.has("VIEW_CHANNEL")) {
                            await rm.setNewChannelReminder(bot, authorID, channelID, currentTimestamp, currentTimestamp,
                                reminderEndTime, splitArgs[2], reminderType, false, false, false);
                        }
                        else return message.reply(`You are **not authorized to send messages** to that channel...`);
                    }
                    return message.reply(`Your **one-time reminder** has been set to trigger in **${duration}!**`);
                }
            }
        }
    },

};