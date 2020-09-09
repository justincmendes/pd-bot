// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const reminderCollectionDocument = new Reminder().collection;
const mongoose = require("mongoose");
const fn = require("./functions");
require("dotenv").config();

const validTypes = ["Reminder", "Habit", "Fast"];
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

// Private Function Declarations

module.exports = {
    /**
     * @param {Discord.Client} bot
     * @param {String} userID Ensure the user has allowed for open DMs
     * @param {Number} currentTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {Number} startTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {Number} endTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {String} reminderMessage
     * @param {String | false} type Valid Types: "Reminder", "Habit", "Fast" (case sensitive)
     * @param {mongoose.ObjectId | String | Number} connectedDocumentID 
     * @param {Boolean} isRecurring 
     * @param {Number} interval Ensure this is properly defined when the reminder is recurring
     * 
     * Will auto-delete the reminder instance in the database after sending the reminder
     */
    setNewDMReminder: async function (bot, userID, currentTimestamp, startTimestamp, endTimestamp, reminderMessage, type,
        connectedDocumentID = undefined, isRecurring = false, interval = undefined, embedColour = "#FFFF00") {
        // Variable Declarations and Initializations
        // See - with markdown option!
        if (type) {
            if (!validTypes.includes(type)) type = "Reminder";
        }
        else type = "Reminder";
        console.log({ connectedDocumentID });
        if (!mongoose.Types.ObjectId.isValid(connectedDocumentID)) connectedDocumentID = undefined;
        if (isNaN(interval)) isRecurring = false;
        console.log({ connectedDocumentID });
        await this.putNewReminderInDatabase(userID, userID, startTimestamp, endTimestamp, reminderMessage,
            type, connectedDocumentID, true, isRecurring, interval)
            .catch(err => console.error(err));
        await this.sendReminder(bot, userID, userID, currentTimestamp, startTimestamp, endTimestamp, reminderMessage,
            type, connectedDocumentID, true, isRecurring, interval, embedColour);
    },

    /**
     * @param {Discord.Client} bot
     * @param {String} userID 
     * @param {String} channelToSend Ensure the user enters a channel that they can SEND_MESSAGES to
     * @param {Number} currentTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {Number} startTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {Number} endTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {String} reminderMessage 
     * @param {String | false} type Valid Types: "Reminder", "Habit", "Fast" (case sensitive)
     * @param {mongoose.ObjectId | String | Number} connectedDocumentID 
     * @param {Boolean} isRecurring 
     * @param {Number} interval Ensure that if the interval isRecurring, the interval is a number
     * Will auto-delete the reminder instance in the database after sending the reminder
     */
    setNewChannelReminder: async function (bot, userID, channelToSend, currentTimestamp, startTimestamp, endTimestamp, reminderMessage,
        type, connectedDocumentID = undefined, isRecurring = false, interval = undefined) {
        // Variable Declarations and Initializations
        // See - with markdown option!
        if (type) {
            if (!validTypes.includes(type)) type = "Reminder";
        }
        else type = "Reminder";
        if (!mongoose.Types.ObjectId.isValid(connectedDocumentID)) connectedDocumentID = undefined;
        if (isNaN(interval)) isRecurring = false;
        const guildID = bot.channels.cache.get(channelToSend).guild.id;
        console.log({ connectedDocumentID, guildID });
        await this.putNewReminderInDatabase(userID, channelToSend, startTimestamp, endTimestamp, reminderMessage,
            type, connectedDocumentID, false, isRecurring, interval, guildID)
            .catch(err => console.error(err));
        await this.sendReminder(bot, userID, channelToSend, currentTimestamp, startTimestamp, endTimestamp, reminderMessage,
            type, connectedDocumentID, false, isRecurring, interval);
    },

    /**
     * 
     * @param {Discord.Client} bot 
     * @param {String} userID 
     * @param {String} channelToSend 
     * @param {Number} currentTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {Number} startTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {Number} endTimestamp Ensure Timestamp is in UTC for system restarts
     * @param {String} reminderMessage
     * @param {String | false} type Valid Types: "Reminder", "Habit", "Fast" (case sensitive)
     * @param {mongoose.ObjectId | String | Number | false} connectedDocumentID 
     * @param {Boolean} isDM 
     * @param {Boolean} isRecurring 
     * @param {Number} interval 
     * @param {String} embedColour 
     */
    sendReminder: async function (bot, userID, channelToSend, currentTimestamp, startTimestamp, endTimestamp, reminderMessage, type, connectedDocumentID,
        isDM, isRecurring = false, interval = undefined, embedColour = "#FFFF00") {
        const originalReminderMessage = reminderMessage;
        const reminderDelay = endTimestamp - currentTimestamp;
        const duration = isRecurring ? interval : endTimestamp - startTimestamp;
        const channel = isDM ? bot.users.cache.get(userID) : bot.channels.cache.get(channelToSend);
        const channelID = channel.id;
        const username = isDM ? bot.users.cache.get(userID).username :
            bot.guilds.cache.get(channel.guild.id).member(userID).displayName;
        console.log({ connectedDocumentID, type, reminderDelay, username, channelID });
        reminderMessage = isDM ? new Discord.MessageEmbed()
            .setTitle(`${type}`)
            .setDescription(`${reminderMessage}`)
            .setFooter(`A ${fn.millisecondsToTimeString(duration, true)} reminder set by ${username}`)
            .setColor(embedColour)
            : reminderMessage;
        console.log(`Setting ${username}'s ${fn.millisecondsToTimeString(duration, true)} reminder!`
            + `\nTime Left: ${reminderDelay < 0 ? fn.millisecondsToTimeString(0, true) : fn.millisecondsToTimeString(reminderDelay, true)}`
            + `\nRecurring: ${isRecurring}\nDM: ${isDM}\nChannel: ${channelID}`);
        if (isRecurring) {
            // If it's recurring and should have been triggered when the bot was down
            // Trigger it once right away then follow the intervals.
            try {
                setTimeout(async () => {
                    await this.updateRecurringReminderStartAndEndTime(userID, channelID, startTimestamp, endTimestamp,
                        originalReminderMessage, type, connectedDocumentID, isDM, isRecurring, interval)
                        .then((complete) => {
                            console.log({ complete });
                            if (complete) {
                                console.log("Updated Recurring Reminder in Database!");
                                channel.send(reminderMessage);
                                startTimestamp = endTimestamp;
                                endTimestamp += interval;
                                const recurringReminder = setInterval(async () => {
                                    await this.updateRecurringReminderStartAndEndTime(userID, channelID, startTimestamp, endTimestamp,
                                        originalReminderMessage, type, connectedDocumentID, isDM, isRecurring, interval)
                                        .then((update) => {
                                            console.log({ update });
                                            startTimestamp += interval;
                                            endTimestamp += interval;
                                            if (update) {
                                                console.log("Updated Recurring Reminder in Database!");
                                                channel.send(reminderMessage);
                                            }
                                            else clearInterval(recurringReminder);
                                        })
                                        .catch(err => console.error(err));
                                }, interval);
                            }
                        })
                        .catch(err => console.error(err));
                }, reminderDelay);
            }
            catch (err) {
                console.error(err);
            }
        }
        else {
            setTimeout(async () => {
                channel.send(reminderMessage);
                await this.deleteOneReminder(userID, channelID, startTimestamp, endTimestamp,
                    type, connectedDocumentID, originalReminderMessage, isDM, isRecurring)
                    .catch(err => console.error(err));
                console.log("Deleted Reminder in Database!");
            }, reminderDelay);
        }
    },

    resetReminders: async function (bot) {
        const allReminders = await this.getAllReminders();
        console.log({ allReminders });
        allReminders.forEach(async (reminder) => {
            await this.sendReminder(bot, reminder.userID, reminder.channel, new Date().getTime(), reminder.startTime,
                reminder.endTime, reminder.message, reminder.type, reminder.connectedDocument,
                reminder.isDM, reminder.isRecurring, reminder.interval);
        });
    },

    putNewReminderInDatabase: async function (userID, channelToSend, startTime, endTime, reminderMessage,
        type, connectedDocument, isDM, isRecurring = false, interval = undefined, guildID = undefined) {
        const putNewReminder = new Reminder({
            _id: mongoose.Types.ObjectId(),
            userID,
            channel: channelToSend,
            startTime,
            endTime,
            message: reminderMessage,
            type,
            connectedDocument,
            isDM,
            isRecurring,
            interval,
            guildID,
        });
        console.log({ putNewReminder })
        putNewReminder.save()
            .then(result => console.log(result))
            .catch(err => console.log(err));
    },

    getAllReminders: async function () {
        const getAllReminders = await reminderCollectionDocument
            .find({})
            .toArray()
            .catch(err => {
                console.error(err);
                return false;
            });
        return getAllReminders;
    },

    getUserReminders: async function (userID) {
        const getUserReminders = await reminderCollectionDocument
            .find({ userID })
            .toArray()
            .catch(err => {
                console.error(err);
                return false;
            });
        return getUserReminders;
    },

    getOneReminder: async function (userID, channelToSend, startTimestamp, endTimestamp, type, connectedDocument, reminderMessage, isDM, isRecurring) {
        const getReminders = await reminderCollectionDocument
            .find({
                userID,
                channel: channelToSend,
                startTime: startTimestamp,
                endTime: endTimestamp,
                message: reminderMessage,
                type,
                connectedDocument,
                isDM,
                isRecurring,
            })
            .toArray()
            .catch(err => console.error(err));
        return getReminders[0];
    },

    getRemindersObjectID: async function (userID, channelToSend, startTimestamp, endTimestamp, reminderMessage, isDM, isRecurring) {
        const getRemindersObjectID = await reminderCollectionDocument
            .find({
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
        return getRemindersObjectID._id;
    },

    getOneReminderByObjectID: async function (reminderID) {
        if (reminderID) {
            const getReminders = await reminderCollectionDocument
                .find({ _id: reminderID })
                .toArray()
                .catch(err => {
                    console.error(err);
                    return false;
                });
            return getReminders[0];
        }
        else return undefined;
    },

    deleteOneReminder: async function (userID, channelToSend, startTimestamp, endTimestamp, type, connectedDocument, reminderMessage, isDM, isRecurring) {
        console.log({ userID, channelToSend, startTimestamp, endTimestamp, type, connectedDocument, reminderMessage, isDM, isRecurring });
        await reminderCollectionDocument
            .deleteOne({
                userID,
                channel: channelToSend,
                startTime: startTimestamp,
                endTime: endTimestamp,
                message: reminderMessage,
                type,
                connectedDocument,
                isDM,
                isRecurring,
            })
            .catch(err => console.error(err));
        console.log(`Deleting One Reminder...`);
    },

    deleteOneReminderByObjectID: async function (reminderID) {
        if (reminderID) {
            deleteReminder = await reminderCollectionDocument
                .deleteOne({ _id: reminderID })
                .catch(err => console.error(err));
        }
        console.log({ deleteReminder });
        console.log(`Deleting One Reminder by ID...`);
    },

    deleteUserReminders: async function (userID) {
        const deleteReminders = await reminderCollectionDocument
            .deleteMany({ userID })
            .catch(err => console.error(err));
        console.log(`Deleting all of ${userID}'s reminders`);
    },

    updateRecurringReminderStartAndEndTime: async function (userID, channel, startTime, endTime, message,
        type, connectedDocument, isDM, isRecurring, interval) {
        if (isRecurring && interval) {
            const newStartTime = endTime;
            const newEndTime = endTime + interval;
            const updateReminder = await reminderCollectionDocument
                .updateOne({ userID, channel, startTime, endTime, message, type, connectedDocument, isDM, isRecurring, interval, },
                    { $set: { startTime: newStartTime, endTime: newEndTime } });
            if (updateReminder.modifiedCount > 0) return true;
            else return false;
        }
        else return false;
    },

    updateRecurringReminderStartAndEndTimeByObjectID: async function (reminderID) {
        if (reminderID) {
            const reminder = await this.getOneReminderByObjectID(reminderID);
            if (reminder.isRecurring) {
                const endTime = reminder.endTime
                const interval = reminder.interval;
                if (endTime && interval) {
                    const newEndTime = endTime + interval;
                    const newStartTime = endTime;
                    const updateReminder = await reminderCollectionDocument
                        .updateOne({ _id: reminderID },
                            { $set: { startTime: newStartTime, endTime: newEndTime } });
                    if (updateReminder.modifiedCount > 0) return true;
                    else return false;
                }
            }
        }
        return false;
    },
};