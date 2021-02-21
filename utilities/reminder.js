// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const User = require("../djs-bot/database/schemas/user");
const mongoose = require("mongoose");
const quotes = require("../utilities/quotes.json").quotes;
const fn = require("./functions");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const reminderTypes = fn.reminderTypes;
const repeatEmbedColour = fn.repeatReminderEmbedColour;
const goalEmbedColour = fn.goalsEmbedColour;
const reminderEmbedColour = fn.reminderEmbedColour;
const journalEmbedColour = fn.journalEmbedColour;
const fastEmbedColour = fn.fastEmbedColour;
const habitEmbedColour = fn.habitEmbedColour;
const quoteEmbedColour = fn.quoteEmbedColour;
const mastermindEmbedColour = fn.mastermindEmbedColour;
const trackEmbedColour = fn.trackEmbedColour;

const reminders = new Discord.Collection();

// When Storing Reminders: Use UTC time for proper restarts relative to system (UNIX) time
// => When Reading Reminders: Convert UTC to User Timezone

// Deal with user inputs in the front-end aka Discord bot.js or functions using this api
// ALL SECURITY and authorization access will be dealt with at the front-end calls and inputs
// In front-end add the tags to the reminder message.
// Ensure that if it's a channel reminder that the user at least tags 1 person or role!

// Make a sendRecurringReminder(interval), resetRecurringReminder()
// (with setInterval(sendReminder, interval))

// Design choice - include params isRecurring and interval to main function and edit logic
// OR make a separate function for each recurring and interval situations!
// Leaning towards first one, makes api easier to use

// MAYBE move embedColour parameter before is Recurring or Connected Document

// Edit convention: Cancel before starting a new instance

// Private Function Declarations

module.exports = {
    /**
     * @param {Discord.Client} bot
     * @param {String} userID Ensure the user has allowed for open DMs
     * @param {Number} startTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {Number} endTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {String} reminderMessage
     * @param {String | false} title Sample Titles: "Reminder", "Habit", "Fast"
     * @param {mongoose.ObjectId | String | Number} connectedDocumentID 
     * @param {Boolean} isRecurring 
     * @param {String} interval Ensure this is properly defined when the reminder is recurring
     * Will auto-delete the reminder instance in the database after sending the reminder
     */
    setNewDMReminder: async function (bot, userID, startTimestamp, endTimestamp, reminderMessage,
        title, sendAsEmbed = true, connectedDocumentID = undefined, isRecurring = false, interval = undefined,
        remainingOccurrences = undefined, embedColour = undefined) {
        if (!remainingOccurrences && remainingOccurrences !== 0) remainingOccurrences = undefined;
        if (!interval) interval = undefined;
        if (!mongoose.Types.ObjectId.isValid(connectedDocumentID)) connectedDocumentID = undefined;
        console.log({ connectedDocumentID, isRecurring, embedColour });
        const reminder = await this.putNewReminderInDatabase(userID, userID, startTimestamp, endTimestamp, reminderMessage,
            title, connectedDocumentID, true, sendAsEmbed, isRecurring, interval, remainingOccurrences, undefined, embedColour)
            .catch(err => console.error(err));
        console.log({ reminder });
        await this.sendReminderByObject(bot, reminder, embedColour);
    },

    /**
     * @param {Discord.Client} bot
     * @param {String} userID 
     * @param {String} channelToSend Ensure the user enters a channel that they can SEND_MESSAGES to
     * @param {Number} startTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {Number} endTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {String} reminderMessage 
     * @param {String | false} title Sample Titles: "Reminder", "Habit", "Fast"
     * @param {mongoose.ObjectId | String | Number} connectedDocumentID 
     * @param {Boolean} isRecurring 
     * @param {String} interval Ensure that if the interval isRecurring, the interval is a number
     * Will auto-delete the reminder instance in the database after sending the reminder
     */
    setNewChannelReminder: async function (bot, userID, channelToSend, startTimestamp, endTimestamp,
        reminderMessage, title, sendAsEmbed = false, connectedDocumentID = undefined, isRecurring = false,
        interval = undefined, remainingOccurrences = undefined, embedColour = undefined) {
        const channel = bot.channels.cache.get(channelToSend);
        if (!channel) return false;
        if (!remainingOccurrences && remainingOccurrences !== 0) remainingOccurrences = undefined;
        if (!interval) interval = undefined;
        if (!mongoose.Types.ObjectId.isValid(connectedDocumentID)) connectedDocumentID = undefined;
        const guildID = channel.guild.id;
        console.log({ connectedDocumentID, guildID });
        const reminder = await this.putNewReminderInDatabase(userID, channelToSend, startTimestamp, endTimestamp, reminderMessage,
            title, connectedDocumentID, false, sendAsEmbed, isRecurring, interval, remainingOccurrences, guildID, embedColour)
            .catch(err => console.error(err));
        await this.sendReminderByObject(bot, reminder, embedColour);
    },

    sendReminderByObject: async function (bot, reminderObject) {
        try {
            console.log({ reminderObject });
            if (!reminderObject) return false;
            let { isDM, isRecurring, _id: reminderID, userID, channel, startTime,
                endTime, message, title, connectedDocument, guildID, sendAsEmbed,
                embedColour } = reminderObject;
            // const userSettings = await User.findOne({ discordID: userID }, { _id: 1, timezone: 1 });
            const duration = endTime - startTime;
            const user = bot.users.cache.get(userID);
            const channelObject = isDM ? user : bot.channels.cache.get(channel);
            if (channelObject) {
                const channelID = channelObject.id;
                const usernameAndDiscriminator = user ? `${user.username}#${user.discriminator}` : "someone";
                const username = isDM ? user ? user.username : "someone" : bot.guilds.cache.get(channelObject.guild.id).member(userID).displayName;
                var titleOut = title;
                if (reminderTypes.includes(title) && isRecurring) {
                    title = `Repeating ${title}`;
                }
                if (title === "Voice Channel Tracking") {
                    const reportString = await fn.getTrackingReportString(bot, userID);
                    if (reportString) {
                        message = reportString;
                    }
                    else message = "";
                }
                if (isDM && sendAsEmbed === undefined) {
                    sendAsEmbed = true;
                }
                if (sendAsEmbed) {
                    const originalEmbedColour = embedColour;
                    switch (title) {
                        case "Fast": embedColour = fastEmbedColour;
                            break;
                        case "Habit": embedColour = habitEmbedColour;
                            break;
                        case "Goal": embedColour = goalEmbedColour;
                            break;
                        case "Journal": embedColour = journalEmbedColour;
                            break;
                        case "Quote": embedColour = quoteEmbedColour;
                            break;
                        case "Mastermind": embedColour = mastermindEmbedColour;
                            break;
                        case "Voice Channel Tracking": embedColour = trackEmbedColour;
                            break;
                        case "Repeating Reminder": embedColour = repeatEmbedColour;
                            break;
                        default:
                            // Assuming the embedColour passed in is valid hex code****
                            if (!embedColour && embedColour !== 0) {
                                if (isRecurring) embedColour = repeatEmbedColour;
                                else embedColour = reminderEmbedColour;
                            }
                            break;
                    }
                    if (embedColour !== originalEmbedColour) {
                        await Reminder.findByIdAndUpdate(reminderID, { $set: { embedColour } });
                    }
                    let reminderFooter = "";
                    if (title !== "Quote") {
                        reminderFooter = `A ${fn.millisecondsToTimeString(duration)} reminder set by ${username}`;
                    }
                    message = new Discord.MessageEmbed()
                        .setTitle(titleOut)
                        .setDescription(message)
                        .setFooter(reminderFooter, user.displayAvatarURL())
                        .setColor(embedColour);
                }
                else {
                    // Add a zero-width space between the @everyone/@here mentions for users who are not
                    // originally able to mention the given roles with their current permissions
                    if (!isDM) {
                        const targetChannel = bot.guilds.cache.get(guildID).channels.cache.get(channelID);
                        const userPermissions = targetChannel.permissionsFor(bot.users.cache.get(userID));
                        if (!userPermissions.has("MENTION_EVERYONE")) {
                            message = message.replace(/\@(everyone|here)/g, `\@\u200b$1`);
                        }
                    }
                    if (title !== "Quote" && title !== "Voice Channel Tracking") {
                        message += `\n\n\\\*\\\*__A **${fn.millisecondsToTimeString(duration)} ${titleOut}** set by **${username}**__\\\*\\\*`;
                    }
                }
                // var mentions;
                // if (!isDM) {
                //     const discordMentionRegex = /(?:\<\@\!\d+\>)|(?:\<\@\&\d+\>)/g;
                //     const tags = originalMessage.match(discordMentionRegex);
                //     console.log({ tags });
                //     if (tags) mentions = `${tags.join(' ')}`;
                // }
                const currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                const reminderDelay = endTime - currentTimestamp;

                console.log({ reminderID, connectedDocument, title, reminderDelay, username, channelID });
                console.log(`Setting ${username}'s (${usernameAndDiscriminator}) ${fn.millisecondsToTimeString(duration)} reminder!`
                    + `\nTime Left: ${reminderDelay < 0 ? fn.millisecondsToTimeString(0) : fn.millisecondsToTimeString(reminderDelay)}`
                    + `\nRecurring: ${isRecurring}\nDM: ${isDM}\nChannel: ${channelID}`);

                // Save each timeout to an array, per user:
                // For long-term memory efficiency when reminders are edited or deleted
                // Reminders can directly be accessed and canceled/deleted
                if (!reminders.has(userID)) {
                    // The array will hold all of the reminder timeout objects of the user
                    reminders.set(userID, new Array());
                }
                const userReminders = reminders.get(userID);
                if (isRecurring) {
                    // If it's recurring and should have been triggered when the bot was down
                    // Trigger it once right away then follow the intervals.
                    userReminders.push({
                        id: reminderID.toString(),
                        connectedId: connectedDocument ? connectedDocument.toString() : undefined,
                        timeout: fn.setLongTimeout(async () => {
                            const updatedReminderObject = await this.updateRecurringReminderByObjectID(bot, reminderID);
                            if (updatedReminderObject) {
                                console.log({ updatedReminderObject });
                                console.log("Updated Recurring Reminder in Database!");

                                const isLastReminder = updatedReminderObject.remainingOccurrences === 0
                                    || updatedReminderObject.remainingOccurrences < 0;

                                if (bot.channels.cache.get(channel) || bot.users.cache.get(userID)) {
                                    if (updatedReminderObject.remainingOccurrences ||
                                        updatedReminderObject.remainingOccurrences === 0) {
                                        var remainingOccurrencesMessage = "";
                                        if (isLastReminder) {
                                            remainingOccurrencesMessage = `\nThis is the last reminder!`;
                                        }
                                        else if (updatedReminderObject.remainingOccurrences) {
                                            remainingOccurrencesMessage = `\n${updatedReminderObject.remainingOccurrences} more reminder`
                                                + `${updatedReminderObject.remainingOccurrences === 1 ? "" : "s"} left!`;
                                        }
                                        if (updatedReminderObject.sendAsEmbed) {
                                            const { footer } = message;
                                            // 0 is allowed if there were occurrences left,
                                            // but the bot was down when the reminder should have sent.
                                            // Send it then delete it.
                                            message = message.setFooter(footer.text + remainingOccurrencesMessage,
                                                footer.iconURL);
                                        }
                                        else message += remainingOccurrencesMessage;
                                    }
                                    channelObject.send(message);
                                    await this.sendReminderByObject(bot, updatedReminderObject);
                                    if (!isLastReminder) return;
                                }
                            }
                            await this.deleteOneReminderByObjectID(reminderID);
                            return;
                        }, reminderDelay),
                    });
                }
                else {
                    userReminders.push({
                        id: reminderID.toString(),
                        connectedId: connectedDocument ? connectedDocument.toString() : undefined,
                        timeout: fn.setLongTimeout(async () => {
                            const reminderExists = await this.getOneReminderByObjectID(reminderID);
                            console.log({ reminderExists });
                            if (reminderExists) {
                                channelObject.send(message);
                                await this.deleteOneReminderByObjectID(reminderID)
                                    .catch(err => console.error(err));
                                console.log("Deleted Reminder in Database!");
                            }
                            else console.log(`This reminder (${reminderID}) no longer exists - it may have been deleted or edited to trigger at an earlier time!`);
                        }, reminderDelay),
                    });
                }
            }
        }
        catch (err) {
            console.error(err);
        }
    },

    /**
     * @param {mongoose.Schema.Types.ObjectId | String} reminderID
     */
    cancelReminderById: async function (reminderID) {
        const success = await fn.cancelCronById(reminders, reminderID);
        if (success) {
            console.log(`Successfully cancelled reminder ${reminderID}.`);
        }
        else if (success === null) {
            console.log(`Reminder ${reminderID} does not exist, or is already cancelled.`);
        }
        else {
            console.log(`Failed to cancel reminder ${reminderID}.`);
        }
        return success;
    },

    /**
     * @param {mongoose.Schema.Types.ObjectId | String} connectedDocumentId
     */
    cancelReminderByConnectedDocument: async function (connectedDocumentId) {
        const success = await fn.cancelCronByConnectedDocument(reminders, connectedDocumentId);
        if (success) {
            console.log(`Successfully cancelled reminders connected to document ${connectedDocumentId}`);
        }
        else if (success === null) {
            console.log(`Reminders connected to document ${connectedDocumentId} do not exist, or are already cancelled.`);
        }
        else {
            console.log(`Failed to cancel reminders connected to document ${connectedDocumentId}`);
        }
        return success;
    },

    resetReminders: async function (bot) {
        const allReminders = await this.getAllReminders();
        console.log("Reinitializing all reminders.");
        if (allReminders) {
            allReminders.forEach(async reminder => {
                await this.sendReminderByObject(bot, reminder);
            });
        }
    },

    putNewReminderInDatabase: async function (userID, channelToSend, startTime,
        endTime, reminderMessage, title, connectedDocument,
        isDM, sendAsEmbed, isRecurring = false, interval = undefined,
        remainingOccurrences = undefined, guildID = undefined, embedColour = undefined) {
        const putNewReminder = new Reminder({
            _id: mongoose.Types.ObjectId(),
            userID,
            channel: channelToSend,
            startTime,
            endTime,
            message: reminderMessage,
            title,
            connectedDocument,
            isDM,
            sendAsEmbed,
            isRecurring,
            interval,
            remainingOccurrences,
            guildID,
            embedColour,
        });
        await putNewReminder.save()
            .then(result => console.log({ result }))
            .catch(err => console.log(err));
        return putNewReminder;
    },

    getAllReminders: async function () {
        const getAllReminders = await Reminder
            .find({})
            .catch(err => {
                console.error(err);
                return false;
            });
        return getAllReminders;
    },

    getUserReminders: async function (userID) {
        const getUserReminders = await Reminder
            .find({ userID })
            .catch(err => {
                console.error(err);
                return false;
            });
        return getUserReminders;
    },

    getOneReminder: async function (userID, channelToSend, startTimestamp, endTimestamp, title,
        connectedDocument, reminderMessage, isDM, isRecurring) {
        const getReminders = await Reminder
            .findOne({
                userID,
                channel: channelToSend,
                startTime: startTimestamp,
                endTime: endTimestamp,
                message: reminderMessage,
                title,
                connectedDocument,
                isDM,
                isRecurring,
            })
            .catch(err => console.error(err));
        return getReminders;
    },

    getRemindersObjectID: async function (userID, channelToSend, startTimestamp, endTimestamp,
        reminderMessage, isDM, isRecurring) {
        const reminderObject = await Reminder
            .findOne({
                userID,
                channel: channelToSend,
                startTime: startTimestamp,
                endTime: endTimestamp,
                message: reminderMessage,
                isDM,
                isRecurring,
            })
            .catch(err => {
                console.error(err);
                return false;
            });
        return reminderObject._id;
    },

    getOneReminderByObjectID: async function (reminderID) {
        if (reminderID) {
            console.log({ reminderID });
            const reminder = await Reminder
                .findById(reminderID)
                .catch(err => {
                    console.error(err);
                    return false;
                });
            console.log({ reminder });
            return reminder;
        }
        else return null;
    },

    deleteOneReminder: async function (userID, channelToSend, startTimestamp, endTimestamp, title,
        connectedDocument, reminderMessage, isDM, isRecurring) {
        console.log({
            userID, channelToSend, startTimestamp, endTimestamp, title,
            connectedDocument, reminderMessage, isDM, isRecurring
        });
        await Reminder
            .findOneAndDelete({
                userID,
                channel: channelToSend,
                startTime: startTimestamp,
                endTime: endTimestamp,
                message: reminderMessage,
                title,
                connectedDocument,
                isDM,
                isRecurring,
            })
            .catch(err => console.error(err));
        console.log(`Deleting One Reminder...`);
    },

    deleteOneReminderByObjectID: async function (reminderID) {
        if (reminderID) {
            deleteReminder = await Reminder
                .findOneAndDelete({ _id: reminderID })
                .catch(err => {
                    console.error(err);
                    return false;
                });
        }
        console.log({ deleteReminder });
        console.log(`Deleting One Reminder by ID...`);
    },

    deleteUserReminders: async function (userID) {
        const deleteReminders = await Reminder
            .deleteMany({ userID })
            .catch(err => console.error(err));
        console.log(`Deleting all of ${userID}'s reminders`);
    },

    updateRecurringReminderByObjectID: async function (bot, reminderID) {
        if (reminderID) {
            const reminder = await this.getOneReminderByObjectID(reminderID);
            if (reminder) if (reminder.isRecurring) {
                const userSettings = await User.findOne({ discordID: reminder.userID }, { _id: 0, timezone: 1 });
                const { offset, daylightSaving } = userSettings.timezone;
                const { endTime, interval, remainingOccurrences } = reminder;
                const hasOccurrences = remainingOccurrences > 0 || remainingOccurrences === undefined
                    || remainingOccurrences === null || remainingOccurrences === false;
                if (endTime && interval && hasOccurrences) {
                    let intervalArgs = interval.split(/[\s\n]+/);
                    intervalArgs = intervalArgs[0].toLowerCase() !== "in" ? (["in"]).concat(intervalArgs) : intervalArgs;

                    var remindersLeft = remainingOccurrences || 1;
                    let onFirst = true,
                        newEndTime = endTime;
                    var intervalDuration;
                    do {
                        newEndTime = fn.timeCommandHandlerToUTC(intervalArgs, newEndTime,
                            offset, daylightSaving, false, true, true);
                        if (!newEndTime) return false;
                        else {
                            newEndTime -= HOUR_IN_MS * offset;
                            if (onFirst) {
                                intervalDuration = newEndTime - endTime;
                                onFirst = false;
                            }
                            if (remainingOccurrences) remindersLeft--;
                        }
                    }
                    while (newEndTime <= fn.getCurrentUTCTimestampFlooredToSecond()
                        && remindersLeft > 0)

                    const newStartTime = intervalDuration ? newEndTime - intervalDuration : endTime;
                    let updateObject = {
                        startTime: newStartTime,
                        endTime: newEndTime,
                        remainingOccurrences: remainingOccurrences ? remindersLeft : remainingOccurrences,
                    };
                    if (reminder.title === "Quote") {
                        var quoteIndex, currentQuote, tags = new Array();
                        if (!reminder.isDM) {
                            const roleRegex = /(\<\@\&\d+\>)/g;
                            tags = reminder.message.match(roleRegex);
                        }
                        while (!currentQuote) {
                            quoteIndex = Math.round(Math.random() * quotes.length);
                            currentQuote = quotes[quoteIndex].message;
                        }
                        if (!reminder.isDM && tags.length) currentQuote += `\n${tags.join(' ')}`;
                        if (currentQuote) updateObject.message = currentQuote;
                        if (reminder.isDM) {
                            await User.findOneAndUpdate({ discordID: reminder.userID },
                                { $set: { nextQuote: newEndTime } }, { new: true });
                        }
                        else {
                            await Guild.findOneAndUpdate({ guildID: reminder.guildID },
                                { $set: { "quote.nextQuote": newEndTime } }, { new: true });
                        }
                    }
                    if (reminder.title === "Voice Channel Tracking") {
                        updateObject.message = await fn.getTrackingReportString(bot, reminder.userID);
                    }
                    const updateReminder = await Reminder
                        .findOneAndUpdate({ _id: reminderID },
                            { $set: updateObject }, { new: true });
                    if (updateReminder) {
                        if (reminder.title === "Voice Channel Tracking") {
                            updateReminder.message = updateObject.message;
                        }
                        return updateReminder;
                    }
                }
            }
        }
        return false;
    },

    // COMMAND FUNCTIONS
    getReminderSplitArgs: function (args) {
        args = args.join(" ");
        const splitArgs = /(.+?)\s?((?:[Dd][Mm])|(?:\<\#\d+\>))\s?((?:.|\n)+)/.exec(args);
        if (splitArgs) {
            splitArgs.forEach((arg) => {
                if (arg === undefined) return false;
            });
        }
        else return false;
        return splitArgs.slice(1, 4);
    },

    getTotalReminders: async function (userID, isRecurring) {
        try {
            const totalReminders = await Reminder.find({ userID, isRecurring }).countDocuments();
            return totalReminders;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    multipleRemindersToString: function (bot, message, reminderArray, numberOfReminders, userTimezoneOffset, entriesToSkip = 0, toArray = false) {
        var remindersToString = toArray ? new Array() : "";
        console.log({ numberOfReminders });
        for (let i = 0; i < numberOfReminders; i++) {
            if (reminderArray[i] === undefined) {
                numberOfReminders = i;
                fn.sendErrorMessage(message, `**REMINDERS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`);
                break;
            }
            const reminderString = `__**Reminder ${i + entriesToSkip + 1}:**__`
                + `\n${this.reminderDocumentToString(bot, reminderArray[i], userTimezoneOffset)}`;
            if (toArray) remindersToString.push(reminderString);
            else {
                remindersToString = `${remindersToString}${reminderString}`;
                if (i !== numberOfReminders - 1) {
                    remindersToString += '\n\n';
                }
            }
        }
        return remindersToString;
    },

    reminderDocumentToString: function (bot, reminderDocument, userTimezoneOffset = 0, replaceRoles = true) {
        const { isDM, isRecurring, channel, startTime, endTime,
            message, title, interval, remainingOccurrences, guildID } = reminderDocument;
        const titleString = `**Title:** ${title}\n`;
        const typeString = "**Type:**" + (isRecurring ? " Repeating" : " One-Time") + (isDM ? ", DM" : ", Channel");
        const intervalString = (isRecurring ? `**Interval:** Every ${interval}\n` : "")
            + (remainingOccurrences && remainingOccurrences !== 0 ? `**Reminders Left:** ${remainingOccurrences}\n` : "");
        const channelName = isDM ? "" : `**Channel:** \#${bot.channels.cache.get(channel) ?
            bot.channels.cache.get(channel).name : ""}\n`;
        const guildString = isDM ? "" : `**Guild:** ${bot.guilds.cache.get(guildID) ?
            bot.guilds.cache.get(guildID).name : ""}\n`;
        console.log({ reminderDocument });

        let outputString = `${titleString}${typeString}\n${intervalString}${guildString}${channelName}`
            + `**Start Time:** ${fn.timestampToDateString(startTime + HOUR_IN_MS * userTimezoneOffset)}`
            + `\n**End Time:** ${fn.timestampToDateString(endTime + HOUR_IN_MS * userTimezoneOffset)}`
            + `\n**Message:** ${replaceRoles ? this.getProperReminderMessageRoles(bot, guildID, message) : message}`;

        outputString = fn.getRoleMentionToTextString(bot, outputString);
        return outputString;
    },

    getProperReminderMessageRoles: function (bot, guildID, message) {
        if (!guildID) return message;
        const roleRegex = /\<\@\&(\d+)\>/g;
        const roles = message.replace(roleRegex, (match, roleID, offset, string) => {
            return `\@${bot.guilds.cache.get(guildID).roles.cache.get(roleID).name}`;
        });
        return roles;
    },

    getRecentReminderIndex: async function (userID, isRecurring = undefined) {
        try {
            var index;
            const userReminders = await Reminder
                .find({ userID, isRecurring })
                .sort({ endTime: +1 });
            console.log({ userReminders });
            if (userReminders) {
                if (userReminders.length) {
                    let targetID = await Reminder
                        .findOne({ userID, isRecurring })
                        .sort({ _id: -1 });
                    targetID = targetID._id.toString();
                    console.log({ targetID });
                    for (let i = 0; i < userReminders.length; i++) {
                        if (userReminders[i]._id.toString() === targetID) {
                            index = i + 1;
                            return index;
                        }
                    }
                }
            }
            else return -1;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    getReminderIndexByEndTime: async function (userID, reminderID, isRecurring) {
        const totalReminders = await this.getTotalReminders(userID, isRecurring);
        let i = 0;
        while (true) {
            let reminder = await this.getOneReminderByEndTime(userID, i, isRecurring);
            if (reminder === undefined && i === totalReminders) {
                return false;
            }
            else if (reminder._id.toString() == reminderID.toString()) break;
            i++;
        }
        return i + 1;
    },

    getReminderIndexByRecency: async function (userID, reminderID, isRecurring) {
        const totalReminders = await this.getTotalReminders(userID, isRecurring);
        let i = 0;
        while (true) {
            let reminder = await this.getOneReminderByRecency(userID, i, isRecurring);
            if (reminder === undefined && i === totalReminders) {
                return false;
            }
            else if (reminder._id.toString() == reminderID.toString()) break;
            i++;
        }
        return i + 1;
    },

    getOneReminderByEndTime: async function (userID, reminderIndex, isRecurring) {
        const reminder = await Reminder
            .findOne({ userID, isRecurring })
            .sort({ endTime: +1 })
            .skip(reminderIndex)
            .catch(err => {
                console.log(err);
                return false;
            });
        return reminder;
    },

    getOneReminderByRecency: async function (userID, reminderIndex, isRecurring) {
        const reminder = await Reminder
            .findOne({ userID, isRecurring })
            .sort({ _id: -1 })
            .skip(reminderIndex)
            .catch(err => {
                console.log(err);
                return false;
            });
        return reminder;
    },

    getMostRecentReminder: async function (bot, userID, isRecurring, userTimezoneOffset, embedColour = reminderEmbedColour) {
        const recentReminderToString = `__**Reminder ${await this.getRecentReminderIndex(userID, isRecurring)}:**__`
            + `\n${this.reminderDocumentToString(bot, await this.getOneReminderByRecency(userID, 0, isRecurring), userTimezoneOffset)}`;
        const reminderEmbed = fn.getMessageEmbed(recentReminderToString, `Reminder: See Recent Reminder`, embedColour);
        return (reminderEmbed);
    },

    getUserFirstRecurringEndDuration: async function (bot, message, PREFIX, helpMessage, userTimezoneOffset,
        userDaylightSavingSetting, isRecurring, timeExamples = fn.timeExamples) {
        var firstEndTime, error, startTimestamp;
        do {
            error = false;
            const reminderPrompt = `__**When do you intend to start the first ${isRecurring ? "recurring " : ""}reminder?**__`
                + `\n\n${timeExamples}\n\nType \`skip\` to **start it now**`;
            const userTimeInput = await fn.messageDataCollect(bot, message, PREFIX, reminderPrompt,
                `${isRecurring ? "Repeat " : ""}Reminder: First Reminder`, isRecurring ? repeatEmbedColour : reminderEmbedColour);
            if (!userTimeInput || userTimeInput === "stop") return false;
            startTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
            if (userTimeInput === "skip" || userTimeInput.toLowerCase() === "now") firstEndTime = startTimestamp;
            else {
                console.log({ error });
                // Undo the timezoneOffset to get the end time in UTC
                const timeArgs = userTimeInput.toLowerCase().split(/[\s\n]+/);
                firstEndTime = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs,
                    startTimestamp, userTimezoneOffset, userDaylightSavingSetting);
                if (!firstEndTime) error = true;
                else firstEndTime -= HOUR_IN_MS * userTimezoneOffset
                console.log({ error });
            }
            console.log({ error });
            if (!error) {
                if (firstEndTime >= startTimestamp) {
                    const duration = firstEndTime - startTimestamp;
                    // const confirmReminder = await fn..getUserConfirmation(bot, message, PREFIX,
                    //     `Are you sure you want to **start the first reminder** after **${fn.millisecondsToTimeString(duration)}**?`,
                    //     forceSkip, "Repeat Reminder: First Reminder Confirmation");
                    // if (confirmReminder) return duration;
                    return duration;
                }
                else error = true;
            }
            console.log({ error });
            if (error) fn.sendReplyThenDelete(message, `**Please enter a proper time in the future**... ${helpMessage} for **valid time inputs!**`, 30000);
        }
        while (true)
    },

    getChannelOrDM: async function (bot, message, PREFIX, instructions = "Please enter a **target channel (using #)** or \"**DM**\":", title = "Enter Channel or DM",
        allowDMs = true, embedColour = fn.defaultEmbedColour, dataCollectDelay = 300000, errorReplyDelay = 60000,) {
        let spamDetails = {
            lastTimestamp: null,
            closeMessageCount: 0,
        };
        var channel;
        do {
            channel = await fn.messageDataCollect(bot, message, PREFIX, instructions, title, embedColour, dataCollectDelay, false);
            var currentTimestamp;
            if (!channel || channel === "stop") return false;
            else if (channel) currentTimestamp = Date.now();
            else if (channel.startsWith(PREFIX) && channel !== PREFIX) {
                message.reply(`Any **command calls** while writing a message will **stop** the collection process.\n**__Command Entered:__**\n${channel}`);
                return false;
            }
            if (allowDMs && channel.toLowerCase() === "dm") return channel.toUpperCase();
            else {
                channel = /(\<\#\d+\>)/.exec(channel);
                if (channel) return channel[1];
                else fn.sendReplyThenDelete(message, `Please enter a **valid channel**${allowDMs ? ` or \"**DM**\"` : ""}`, errorReplyDelay);
            }
            // Spam Prevention:
            if (spamDetails) {
                const messageSendDelay = (currentTimestamp || Date.now()) - (spamDetails.lastTimestamp || 0);
                console.log({ messageSendDelay });
                spamDetails.lastTimestamp = (currentTimestamp || Date.now());
                if (messageSendDelay < 2500) {
                    spamDetails.closeMessageCount++;
                }
                if (spamDetails.closeMessageCount >= 5) {
                    console.log("Exiting due to spam...");
                    message.reply("**Exiting... __Please don't spam!__**");
                    return false;
                }
                if (spamDetails.closeMessageCount === 0) {
                    setTimeout(() => {
                        if (spamDetails) spamDetails.closeMessageCount = 0;
                    }, 30000);
                }
                console.log({ spamDetails })
            }
        }
        while (true)
    },

    getEditInterval: async function (bot, message, PREFIX, timezoneOffset, daylightSetting, field,
        instructionPrompt, title, embedColour = fn.defaultEmbedColour, errorReplyDelay = 60000,
        intervalExamples = fn.intervalExamplesOver1Minute) {
        do {
            let interval = await fn.getUserEditString(bot, message, PREFIX, field, `${instructionPrompt}\n\n${intervalExamples}`,
                title, true, embedColour);
            if (!interval || interval === "stop") return false;
            else if (interval === "back") return interval;
            const timeArgs = interval.toLowerCase().split(/[\s\n]+/);
            interval = this.getProcessedInterval(message, timeArgs, PREFIX, timezoneOffset,
                daylightSetting, errorReplyDelay);
            if (!interval) continue;
            else return interval;
        }
        while (true);
    },

    getEditEndTime: async function (bot, message, PREFIX, reminderHelpMessage, timezoneOffset,
        daylightSavingsSetting, forceSkip, isRecurring, reminderMessage, isDM, channelID = false, intervalDuration = false) {
        let duration = await this.getUserFirstRecurringEndDuration(bot, message, PREFIX, reminderHelpMessage,
            timezoneOffset, daylightSavingsSetting, isRecurring);
        console.log({ duration })
        if (!duration && duration !== 0) return false;
        duration = duration > 0 ? duration : 0;
        const channel = isDM ? "DM" : bot.channels.cache.get(channelID);
        const confirmCreationMessage = `Are you sure you want to set the following **${isRecurring ? "recurring" : "one-time"} reminder** to send`
            + ` - **in ${channel.name ? channel.name : "DM"} after ${fn.millisecondsToTimeString(duration)}**${isRecurring ? ` (and repeat every **${fn.millisecondsToTimeString(intervalDuration)}**)` : ""}:\n\n${reminderMessage}`;
        const confirmCreation = await fn.getUserConfirmation(bot, message, PREFIX, confirmCreationMessage, forceSkip, `${isRecurring ? "Recurring " : ""}Reminder: Confirm Creation`, 180000);
        if (!confirmCreation) return false;
        else {
            const currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
            console.log({ currentTimestamp });
            let userPermissions = channel !== "DM" ? channel.permissionsFor(authorID) : false;
            console.log({ userPermissions });
            if (userPermissions) {
                if (!userPermissions.has("SEND_MESSAGES") || !userPermissions.has("VIEW_CHANNEL")) {
                    message.reply(`You are **not authorized to send messages** to that channel...`);
                    return false;
                }
            }
            message.reply(`Your **${isRecurring ? "recurring" : "one-time"} reminder** has been set to trigger in **${fn.millisecondsToTimeString(duration)}** from now!`);
            return currentTimestamp + duration;
        }
    },

    getInterval: async function (bot, message, PREFIX, timezoneOffset, daylightSetting,
        instructions = "__**Please enter the time you'd like in-between recurring reminders (interval):**__",
        title = "Interval", embedColour = fn.defaultEmbedColour, dataCollectDelay = 300000, errorReplyDelay = 60000,
        intervalExamples = fn.intervalExamplesOver1Minute,) {
        do {
            let interval = await fn.messageDataCollect(bot, message, PREFIX, `${instructions}\n\n${intervalExamples}`,
                title, embedColour, dataCollectDelay, false, false);
            if (!interval || interval === "stop") return false;
            const timeArgs = interval.toLowerCase().split(' ');
            interval = this.getProcessedInterval(message, timeArgs, PREFIX, timezoneOffset,
                daylightSetting, errorReplyDelay);
            if (!interval) continue;
            else return interval;
        }
        while (true)
    },

    getProcessedInterval: function (message, timeArgs, PREFIX, timezoneOffset, daylightSetting, errorReplyDelay) {
        let now = Date.now();
        const adjustedTimeArgs = timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs
        interval = fn.timeCommandHandlerToUTC(adjustedTimeArgs, now, timezoneOffset, daylightSetting, true, true, true);
        if (!interval) {
            fn.sendReplyThenDelete(message, `**INVALID Interval**...** \`${PREFIX}date\` **for **valid time inputs!**`, errorReplyDelay);
            return false;
        }
        else now = fn.getCurrentUTCTimestampFlooredToSecond();
        interval -= now + HOUR_IN_MS * timezoneOffset;
        if (interval <= 0) {
            fn.sendReplyThenDelete(message, `**INVALID Interval**... ${PREFIX}date for **valid time inputs!**`, errorReplyDelay);
            return false;
        }
        else if (interval < 60000) {
            fn.sendReplyThenDelete(message, `Intervals must be **__> 1 minute__**`, errorReplyDelay);
            return false;
        }
        else return { args: timeArgs.join(' '), duration: interval };
    },

};