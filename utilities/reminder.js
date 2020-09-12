// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("./functions");
const { repeatReminderEmbedColour } = require("./functions");
require("dotenv").config();

const validTypes = fn.reminderTypes;
const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const reminderEmbedColour = fn.reminderEmbedColour;
const fastEmbedColour = fn.fastEmbedColour;
const habitEmbedColour = fn.habitEmbedColour;
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

// Edit convention: If the startTime is in the future, set the lastEdited time to the startTime

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
        connectedDocumentID = undefined, isRecurring = false, interval = undefined, embedColour = reminderEmbedColour) {
        // Variable Declarations and Initializations
        // See - with markdown option!
        if (type) {
            if (!validTypes.includes(type)) type = "Reminder";
        }
        else type = "Reminder";
        if (!mongoose.Types.ObjectId.isValid(connectedDocumentID)) connectedDocumentID = undefined;
        if (isNaN(interval)) isRecurring = false;
        embedColour = isRecurring ? fn.repeatReminderEmbedColour : reminderEmbedColour;
        console.log({ connectedDocumentID, isRecurring, embedColour });
        // await this.putNewReminderInDatabase(userID, userID, startTimestamp, endTimestamp, reminderMessage,
        //     type, connectedDocumentID, true, isRecurring, interval)
        //     .then(async (reminderID) => {
        //         if (reminderID) {
        //             console.log({ reminderID });
        //             await this.sendReminderByID(bot, currentTimestamp, reminderID, embedColour);
        //         }
        //     })
        //     .catch(err => console.error(err));
        const reminder = await this.putNewReminderInDatabase(userID, userID, startTimestamp, endTimestamp, reminderMessage,
            type, connectedDocumentID, true, isRecurring, interval)
            .catch(err => console.error(err));
        // await this.sendReminder(bot, userID, userID, currentTimestamp, startTimestamp, endTimestamp, reminderMessage,
        //     type, connectedDocumentID, true, isRecurring, interval, embedColour);
        console.log({ reminder });
        await this.sendReminderByObject(bot, currentTimestamp, reminder, embedColour);
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
        const reminder = await this.putNewReminderInDatabase(userID, channelToSend, startTimestamp, endTimestamp, reminderMessage,
            type, connectedDocumentID, false, isRecurring, interval, guildID)
            .catch(err => console.error(err));
        // await this.sendReminder(bot, userID, channelToSend, currentTimestamp, startTimestamp, endTimestamp, reminderMessage,
        //     type, connectedDocumentID, false, isRecurring, interval);
        await this.sendReminderByObject(bot, currentTimestamp, reminder);
    },

    // /**
    //  * 
    //  * @param {Discord.Client} bot 
    //  * @param {String} userID 
    //  * @param {String} channelToSend 
    //  * @param {Number} currentTimestamp Ensure Timestamp is in UTC for system restarts
    //  * @param {Number} startTimestamp Ensure Timestamp is in UTC for system restarts
    //  * @param {Number} endTimestamp Ensure Timestamp is in UTC for system restarts
    //  * @param {String} reminderMessage
    //  * @param {String | false} type Valid Types: "Reminder", "Habit", "Fast" (case sensitive)
    //  * @param {mongoose.ObjectId | String | Number | false} connectedDocumentID 
    //  * @param {Boolean} isDM 
    //  * @param {Boolean} isRecurring 
    //  * @param {Number} interval 
    //  * @param {String} embedColour 
    //  */
    // sendReminder: async function (bot, userID, channelToSend, currentTimestamp, startTimestamp, endTimestamp, reminderMessage, type, connectedDocumentID,
    //     isDM, isRecurring = false, interval = undefined, embedColour = reminderEmbedColour) {
    //     const originalReminderMessage = reminderMessage;
    //     const reminderDelay = endTimestamp - currentTimestamp;
    //     const duration = isRecurring ? interval : endTimestamp - startTimestamp;
    //     const channel = isDM ? bot.users.cache.get(userID) : bot.channels.cache.get(channelToSend);
    //     const channelID = channel.id;
    //     const username = isDM ? bot.users.cache.get(userID).username :
    //         bot.guilds.cache.get(channel.guild.id).member(userID).displayName;
    //     if (isDM) {
    //         switch (type) {
    //             case "Fast": embedColour = fastEmbedColour;
    //                 break;
    //             case "Habit": embedColour = habitEmbedColour;
    //                 break;
    //         }
    //         var typeOut = type;
    //         if (type === "Reminder" && isRecurring) {
    //             typeOut = "Repeating Reminder";
    //             embedColour = repeatReminderEmbedColour;
    //         }
    //         reminderMessage = new Discord.MessageEmbed()
    //             .setTitle(typeOut)
    //             .setDescription(reminderMessage)
    //             .setFooter(`A ${fn.millisecondsToTimeString(duration, true)} reminder set by ${username}`)
    //             .setColor(embedColour);
    //     }
    //     var mentions;
    //     // if (!isDM) {
    //     //     const discordMentionRegex = /(?:\<\@\!\d+\>)|(?:\<\@\&\d+\>)/g;
    //     //     const tags = originalReminderMessage.match(discordMentionRegex);
    //     //     console.log({ tags });
    //     //     if (tags) mentions = `${tags.join(' ')}\n`;
    //     // }
    //     // reminderMessage = isDM ? reminderMessage : originalReminderMessage.mentions.users
    //     console.log({ connectedDocumentID, type, reminderDelay, username, channelID, mentions });
    //     console.log(`Setting ${username}'s ${fn.millisecondsToTimeString(duration, true)} reminder!`
    //         + `\nTime Left: ${reminderDelay < 0 ? fn.millisecondsToTimeString(0, true) : fn.millisecondsToTimeString(reminderDelay, true)}`
    //         + `\nRecurring: ${isRecurring}\nDM: ${isDM}\nChannel: ${channelID}`);
    //     if (isRecurring) {
    //         // If it's recurring and should have been triggered when the bot was down
    //         // Trigger it once right away then follow the intervals.
    //         try {
    //             setTimeout(async () => {
    //                 await this.updateRecurringReminderStartAndEndTime(userID, channelID, startTimestamp, endTimestamp,
    //                     originalReminderMessage, type, connectedDocumentID, isDM, isRecurring, interval)
    //                     .then(async (complete) => {
    //                         console.log({ complete });
    //                         if (complete) {
    //                             var lastEditedFirst = complete.lastEdited ? complete.lastEdited : complete.endTime + 1;
    //                             console.log({ lastEdited })
    //                             if (lastEditedFirst <= complete.startTime || lastEditedFirst >= complete.endTime) {
    //                                 console.log("Updated Recurring Reminder in Database!");
    //                                 channel.send(reminderMessage);
    //                                 startTimestamp = endTimestamp;
    //                                 endTimestamp += interval;
    //                                 const recurringReminder = setInterval(async () => {
    //                                     await this.updateRecurringReminderStartAndEndTime(userID, channelID, startTimestamp, endTimestamp,
    //                                         originalReminderMessage, type, connectedDocumentID, isDM, isRecurring, interval)
    //                                         .then((update) => {
    //                                             console.log({ update });
    //                                             if (update) {
    //                                                 var lastEdited = update.lastEdited ? update.lastEdited : update.endTime + 1;
    //                                                 console.log({ lastEdited });
    //                                                 if (lastEdited <= update.startTime || lastEdited >= update.endTime) {
    //                                                     startTimestamp += interval;
    //                                                     endTimestamp += interval;
    //                                                     console.log("Updated Recurring Reminder in Database!");
    //                                                     channel.send(reminderMessage);
    //                                                 }
    //                                             }
    //                                             else clearInterval(recurringReminder);
    //                                         })
    //                                         .catch(err => console.error(err));
    //                                 }, interval);
    //                             }
    //                         }
    //                     })
    //                     .catch(err => console.error(err));
    //             }, reminderDelay);
    //         }
    //         catch (err) {
    //             console.error(err);
    //         }
    //     }
    //     else {
    //         setTimeout(async () => {
    //             const reminderExists = await this.getOneReminder(userID, channelID, startTimestamp,
    //                 endTimestamp, type, connectedDocumentID, originalReminderMessage, isDM, isRecurring);
    //             console.log({ reminderExists })
    //             if (reminderExists) {
    //                 var lastEdited = reminderExists.lastEdited ? reminderExists.lastEdited : reminderExists.endTime + 1;
    //                 console.log({ lastEdited });
    //                 if (lastEdited <= reminderExists.startTime || lastEdited >= reminderExists.endTime) {
    //                     channel.send(reminderMessage);
    //                     await this.deleteOneReminder(userID, channelID, startTimestamp, endTimestamp,
    //                         type, connectedDocumentID, originalReminderMessage, isDM, isRecurring)
    //                         .catch(err => console.error(err));
    //                     console.log("Deleted Reminder in Database!");
    //                 }
    //             }
    //         }, reminderDelay);
    //     }
    // },

    sendReminderByObject: async function (bot, currentTimestamp, reminderObject, embedColour = reminderEmbedColour) {
        console.log({ reminderObject });
        let { isDM, isRecurring, _id: reminderID, userID, channel, startTime, endTime, message, type,
            connectedDocument, interval, guildID, lastEdited: lastUpdateTime } = reminderObject;
        console.log({
            isDM, isRecurring, reminderID, userID, channel, startTime, endTime, message, type,
            connectedDocument, interval, guildID, lastUpdateTime
        });
        const reminderDelay = endTime - currentTimestamp;
        const duration = isRecurring ? interval : endTime - startTime;
        const channelObject = isDM ? bot.users.cache.get(userID) : bot.channels.cache.get(channel);
        const channelID = channelObject.id;
        const username = isDM ? bot.users.cache.get(userID).username :
            bot.guilds.cache.get(channelObject.guild.id).member(userID).displayName;
        const typeOut = isRecurring ? `Repeating ${type}` : type;
        if (isDM) {
            switch (type) {
                case "Fast": embedColour = fastEmbedColour;
                    break;
                case "Habit": embedColour = habitEmbedColour;
                    break;
                default:
                    if (isRecurring) embedColour = repeatReminderEmbedColour;
                    else embedColour = reminderEmbedColour;
                    break;
            }
            message = new Discord.MessageEmbed()
                .setTitle(typeOut)
                .setDescription(message)
                .setFooter(`A ${fn.millisecondsToTimeString(duration, true)} reminder set by ${username}`)
                .setColor(embedColour);
        }
        else message += `\n\n(__*A **${fn.millisecondsToTimeString(duration, true)} ${typeOut}** set by **${username}***__)`;
        // var mentions;
        // if (!isDM) {
        //     const discordMentionRegex = /(?:\<\@\!\d+\>)|(?:\<\@\&\d+\>)/g;
        //     const tags = originalReminderMessage.match(discordMentionRegex);
        //     console.log({ tags });
        //     if (tags) mentions = `${tags.join(' ')}\n`;
        // }
        // reminderMessage = isDM ? reminderMessage : originalReminderMessage.mentions.users
        console.log({ connectedDocument, type, reminderDelay, username, channelID });
        console.log(`Setting ${username}'s ${fn.millisecondsToTimeString(duration, true)} reminder!`
            + `\nTime Left: ${reminderDelay < 0 ? fn.millisecondsToTimeString(0, true) : fn.millisecondsToTimeString(reminderDelay, true)}`
            + `\nRecurring: ${isRecurring}\nDM: ${isDM}\nChannel: ${channelID}`);
        if (isRecurring) {
            // If it's recurring and should have been triggered when the bot was down
            // Trigger it once right away then follow the intervals.
            try {
                setTimeout(async () => {
                    await this.updateRecurringReminderStartAndEndTimeByObjectID(reminderID, lastUpdateTime)
                        .then(async (complete) => {
                            console.log({ complete });
                            if (complete) {
                                console.log("Updated Recurring Reminder in Database!");
                                channelObject.send(message);
                                startTime = endTime;
                                endTime += interval;
                                const recurringReminder = setInterval(async () => {
                                    await this.updateRecurringReminderStartAndEndTimeByObjectID(reminderID, lastUpdateTime)
                                        .then((update) => {
                                            console.log({ update });
                                            if (update) {
                                                startTime += interval;
                                                endTime += interval;
                                                console.log("Updated Recurring Reminder in Database!");
                                                channelObject.send(message);
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
                const reminderExists = await this.getOneReminderByObjectID(reminderID);
                console.log({ reminderExists })
                if (reminderExists) {
                    const noEdit = reminderExists.lastEdited === lastUpdateTime;
                    console.log({ noEdit });
                    if (noEdit) {
                        channelObject.send(message);
                    }
                    await this.deleteOneReminderByObjectID(reminderID)
                        .catch(err => console.error(err));
                    console.log("Deleted Reminder in Database!");
                }
            }, reminderDelay);
        }
    },

    resetReminders: async function (bot) {
        const allReminders = await this.getAllReminders();
        console.log({ allReminders });
        if (allReminders) {
            allReminders.forEach(async (reminder) => {
                await this.sendReminderByObject(bot, new Date().getTime(), reminder);
            });
        }
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

    getOneReminder: async function (userID, channelToSend, startTimestamp, endTimestamp, type,
        connectedDocument, reminderMessage, isDM, isRecurring, lastEdited = undefined) {
        const getReminders = await Reminder
            .findOne({
                userID,
                channel: channelToSend,
                startTime: startTimestamp,
                endTime: endTimestamp,
                message: reminderMessage,
                type,
                connectedDocument,
                isDM,
                isRecurring,
                lastEdited,
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
            console.log({ reminderID })
            const reminder = await Reminder
                .findById(reminderID)
                .catch(err => {
                    console.error(err);
                    return false;
                });
            console.log({ reminder })
            return reminder;
        }
        else return undefined;
    },

    deleteOneReminder: async function (userID, channelToSend, startTimestamp, endTimestamp, type,
        connectedDocument, reminderMessage, isDM, isRecurring, lastEdited) {
        console.log({
            userID, channelToSend, startTimestamp, endTimestamp, type,
            connectedDocument, reminderMessage, isDM, isRecurring, lastEdited
        });
        await Reminder
            .findOneAndDelete({
                userID,
                channel: channelToSend,
                startTime: startTimestamp,
                endTime: endTimestamp,
                message: reminderMessage,
                type,
                connectedDocument,
                isDM,
                isRecurring,
                lastEdited,
            })
            .catch(err => console.error(err));
        console.log(`Deleting One Reminder...`);
    },

    deleteOneReminderByObjectID: async function (reminderID) {
        if (reminderID) {
            deleteReminder = await Reminder
                .findOneAndDelete({ _id: reminderID })
                .catch(err => console.error(err));
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

    // updateRecurringReminderStartAndEndTime: async function (userID, channel, startTime, endTime, message,
    //     type, connectedDocument, isDM, isRecurring, interval, lastUpdateTime) {
    //     console.log({
    //         userID, channel, startTime, endTime, message,
    //         type, connectedDocument, isDM, isRecurring, interval, lastUpdateTime
    //     });
    //     if (isRecurring && interval) {
    //         const newStartTime = endTime;
    //         const newEndTime = endTime + interval;
    //         const updateReminder = await Reminder
    //             .findOneAndUpdate({ userID, channel, startTime, endTime, message, type, connectedDocument, isDM, isRecurring, interval },
    //                 { $set: { startTime: newStartTime, endTime: newEndTime, } });
    //         console.log({ updateReminder });
    //         if (updateReminder) return updateReminder;
    //         else return false;
    //     }
    //     else return false;
    // },

    updateRecurringReminderStartAndEndTimeByObjectID: async function (reminderID, lastUpdateTime) {
        if (reminderID) {
            const reminder = await this.getOneReminderByObjectID(reminderID);
            if (reminder) {
                const noEdit = reminder.lastEdited === lastUpdateTime;
                console.log({ noEdit });
                if (noEdit) if (reminder.isRecurring) {
                    const endTime = reminder.endTime
                    const interval = reminder.interval;
                    if (endTime && interval) {
                        const newEndTime = endTime + interval;
                        const newStartTime = endTime;
                        const updateReminder = await Reminder
                            .findOneAndUpdate({ _id: reminderID },
                                { $set: { startTime: newStartTime, endTime: newEndTime } });
                        if (updateReminder) return updateReminder;
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
    multipleRemindersToString: function (bot, message, reminderArray, numberOfReminders, userTimezoneOffset, entriesToSkip = 0) {
        var remindersToString = "";
        console.log({ numberOfReminders });
        for (i = 0; i < numberOfReminders; i++) {
            if (reminderArray[i] === undefined) {
                numberOfReminders = i;
                fn.sendErrorMessage(message, `**REMINDERS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`);
                break;
            }
            var reminderData;
            reminderData = this.reminderDocumentToDataArray(reminderArray[i]);
            remindersToString = `${remindersToString}__**Reminder ${i + entriesToSkip + 1}:**__`
                + `\n${this.reminderDataArrayToString(bot, reminderData, userTimezoneOffset)}`;
            if (i !== numberOfReminders - 1) {
                remindersToString += '\n\n';
            }
        }
        return remindersToString;
    },

    reminderDocumentToDataArray: function (reminderDoc) {
        const { isDM, isRecurring, _id, userID, channel, startTime, endTime, message, type, interval, guildID } = reminderDoc;
        return [isDM, isRecurring, _id, userID, channel, startTime, endTime, message, type, interval, guildID];
    },

    reminderDataArrayToString: function (bot, reminderData, userTimezoneOffset = 0) {
        const [isDM, isRecurring, , , channel, startTime, endTime, message, type, interval, guildID] = reminderData;
        const reminderType = type === "Reminder" ? "" : `, ${type}`;
        const typeString = "**Type:**" + (isRecurring ? " Repeating" : " One-Time") + reminderType + (isDM ? ", DM" : ", Channel");
        const intervalString = isRecurring ? `**Interval:** ${fn.millisecondsToTimeString(interval)}\n` : "";
        const channelName = isDM ? "" : `**Channel:** \#${bot.channels.cache.get(channel).name}\n`;
        const guildString = isDM ? "" : `**Guild:** ${bot.guilds.cache.get(guildID).name}\n`;
        console.log({ reminderData });
        return `${typeString}\n${intervalString}${guildString}${channelName}`
            + `**Start Time:** ${fn.timestampToDateString(startTime + HOUR_IN_MS * userTimezoneOffset)}`
            + `\n**End Time:** ${fn.timestampToDateString(endTime + HOUR_IN_MS * userTimezoneOffset)}\n**Message:** ${message}`;
    },

    getRecentReminderIndex: async function (userID, isRecurring = undefined) {
        try {
            var index;
            const reminders = await Reminder
                .find({ userID, isRecurring })
                .sort({ endTime: +1 });
            console.log({ reminders });
            if (reminders) {
                if (reminders.length) {
                    let targetID = await Reminder
                        .findOne({ userID, isRecurring })
                        .sort({ _id: -1 });
                    targetID = targetID._id.toString();
                    console.log({ targetID });
                    for (i = 0; i < reminders.length; i++) {
                        if (reminders[i]._id.toString() === targetID) {
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
            + `\n${this.reminderDataArrayToString(bot,
                this.reminderDocumentToDataArray(await this.getOneReminderByRecency(userID, 0, isRecurring)), userTimezoneOffset)}`;
        const reminderEmbed = fn.getMessageEmbed(recentReminderToString, `Reminder: See Recent Reminder`, embedColour);
        return (reminderEmbed);
    },

    getUserFirstRecurringEndDuration: async function (message, helpMessage, userTimezoneOffset, userDaylightSavingSetting, isRecurring) {
        var firstEndTime, error, startTimestamp;
        do {
            error = false;
            const reminderPrompt = `__**When do you intend to start the first ${isRecurring ? "recurring " : ""}reminder?**__`
                + "\n\nType `skip` to **start it now**";
            const userTimeInput = await fn.messageDataCollectFirst(message, reminderPrompt, `${isRecurring ? "Repeat " : ""}Reminder: First Reminder`, reminderEmbedColour);
            startTimestamp = new Date().getTime();
            if (userTimeInput === "skip" || userTimeInput.toLowerCase() === "now") firstEndTime = startTimestamp;
            else {
                console.log({ error });
                if (userTimeInput === "stop" || userTimeInput === false) return false;
                // Undo the timezoneOffset to get the end time in UTC
                const timeArgs = userTimeInput.toLowerCase().split(/[\s\n]+/);
                firstEndTime = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs,
                    startTimestamp, userTimezoneOffset, userDaylightSavingSetting) - HOUR_IN_MS * userTimezoneOffset;
                if (!firstEndTime) error = true;
                console.log({ error });
            }
            console.log({ error });
            if (!error) {
                if (firstEndTime >= startTimestamp) {
                    const duration = firstEndTime - startTimestamp;
                    // const confirmReminder = await fn..getUserConfirmation(message,
                    //     `Are you sure you want to **start the first reminder** after **${fn..millisecondsToTimeString(duration)}**?`,
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


};