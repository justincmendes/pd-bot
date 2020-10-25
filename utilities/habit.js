// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const Habit = require("../djs-bot/database/schemas/habit");
const Log = require("../djs-bot/database/schemas/habittracker");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const User = require("../djs-bot/database/schemas/user");
const mongoose = require("mongoose");
const fn = require("./functions");
require("dotenv").config();

const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const habitEmbedColour = fn.habitEmbedColour;

// Private Function Declarations

module.exports = {
    habitCron: async function (bot, userID) {
        let userSettings = await User.findOne({ discordID: userID }, { _id: 0, habitCron: 1 });
        let { habitCron } = userSettings;
        let { daily: dailyCron, weekly: weeklyCronDay } = habitCron;

        let habits = await Habit.find({ userID, archived: false });
        if (habits) {
            let { nextCron, settings, currentLog, lastEdited: lastUpdateTime } = habits;
            console.log({ habits });
            const now = Date.now();
            const cronDelay = nextCron - now;
            console.log({ cronDelay, userID });
            console.log(`Habit Cron: User ID - ${userID}.`);
            try {
                fn.setLongTimeout(async () => {
                    habits = await Habit.find({ userID, archived: false });
                    userSettings = await User.findOne({ discordID: userID }, { _id: 0, habitCron: 1 });
                    if (userSettings.habitCron.daily === dailyCron && userSettings.habitCron.weekly === weeklyCronDay && habits) {
                        await this.updateHabits(habits);
                        if (userSettings.habitCron.daily === dailyCron && userSettings.habitCron.weekly === weeklyCronDay && habits) {
                            console.log("Updated Recurring Reminder in Database!");
                            if (bot.channels.cache.get(channel)) channelObject.send(message);
                            else this.deleteOneReminderByObjectID(reminderID);
                            now = endTime;
                            endTime += interval;
                            const recurringReminder = fn.setLongInterval(async () => {
                                await this.updateHabits(habits);
                                if (userSettings.habitCron.daily === dailyCron && userSettings.habitCron.weekly === weeklyCronDay && habits) {
                                    console.log({ update });
                                    if (update) {
                                        now += interval;
                                        endTime += interval;
                                        console.log("Updated Recurring Reminder in Database!");
                                        if (bot.channels.cache.get(channel)) channelObject.send(message);
                                        else this.deleteOneReminderByObjectID(reminderID);
                                    }
                                    else clearInterval(recurringReminder);
                                }
                            }, interval);
                        }
                    }
                    else this.habitCron(bot, userID);
                }, cronDelay);
            }
            catch (err) {
                console.error(err);
            }
        }
    },

    resetHabits: async function (bot) {
        const allHabits = await this.getAllHabits();
        console.log("Rescheduling all habits.");
        if (allHabits) {
            allHabits.forEach(async habit => {
                await this.habitCron(bot, userID);
            });
        }
    },

    getAllHabits: async function (archived = false) {
        const getAllHabits = await Habit
            .find({ archived: archived })
            .catch(err => {
                console.error(err);
                return false;
            });
        return getAllHabits;
    },

    getOneHabitByObjectID: async function (habitID) {
        if (habitID) {
            console.log({ habitID })
            const reminder = await Habit
                .findById(habitID)
                .catch(err => {
                    console.error(err);
                    return false;
                });
            console.log({ reminder })
            return reminder;
        }
        else return null;
    },

    updateHabits: async function (habits) {
        if (habits && Array.isArray(habits)) {
            habits.forEach(async habit => {
                let { nextCron, settings, currentLog, lastEdited: lastUpdateTime } = habit;
                const noEdit = habit.lastEdited === lastUpdateTime;
                console.log({ noEdit });
                if (noEdit) {
                    const settings = habit.endTime;
                    const interval = habit.interval;
                    if (settings && interval) {
                        let newEndTime = settings + interval;
                        while (newEndTime <= Date.now()) {
                            newEndTime += interval;
                        }
                        const newStartTime = newEndTime - interval;
                        let updateObject = {
                            startTime: newStartTime,
                            endTime: newEndTime
                        };
                        if (habit.type === "Quote") {
                            var quoteIndex, currentQuote, tags = new Array();
                            if (!habit.isDM) {
                                const roleRegex = /(\<\@\&\d+\>)/g;
                                tags = habit.message.match(roleRegex);
                            }
                            while (!currentQuote) {
                                quoteIndex = Math.round(Math.random() * quotes.length);
                                currentQuote = quotes[quoteIndex].message;
                            }
                            if (!habit.isDM && tags.length) currentQuote += `\n${tags.join(' ')}`;
                            if (currentQuote) updateObject.message = currentQuote;
                            if (habit.isDM) {
                                await User.findOneAndUpdate({ discordID: habit.userID },
                                    { $set: { nextQuote: newEndTime } }, { new: true });
                            }
                            else {
                                await Guild.findOneAndUpdate({ guildID: habit.guildID },
                                    { $set: { "quote.nextQuote": newEndTime } }, { new: true });
                            }
                        }
                        const updateReminder = await Reminder
                            .findOneAndUpdate({ _id: habitID },
                                { $set: updateObject }, { new: true });
                    }
                }
            });
        }
    },


};