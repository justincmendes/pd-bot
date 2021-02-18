const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const Habit = require("../database/schemas/habit");
const Log = require("../database/schemas/habittracker");
const quotes = require("../../utilities/quotes.json").quotes;
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const hb = require("../../utilities/habit");
const { authorize } = require("passport");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const futureTimeExamples = fn.futureTimeExamples;
const timeExamples = fn.timeExamples;
const intervalExamples = fn.intervalExamplesOver1Hour;
const daysOfWeek = fn.daysOfWeek;
const daysOfWeekList = daysOfWeek.map((day, i) => {
    return `\`${i + 1}\` - **${day}**`;
}).join(`\n`);
const userEmbedColour = fn.userSettingsEmbedColour;
const quoteEmbedColour = fn.quoteEmbedColour;
// Private Function Declarations

function userDocumentToString(userSettings) {
    const { timezone: { name, offset, daylightSaving }, likesPesteringAccountability: likesAccountability,
        habitCron, getQuote, quoteInterval, nextQuote, tier, deleteRepliesDuringCommand, } = userSettings;
    const output = `__**Timezone:**__ ${name}\n- **UTC Offset (in hours):** ${fn.hoursToUTCOffset(offset)}`
        + `\n- **Daylight Savings Time:** ${daylightSaving ? "Yes" : "No"}`
        + `\n\n__**Habit Reset Time:**__\n- **Daily:** ${fn.msToTimeFromMidnight(habitCron.daily)}`
        + `\n- **Weekly:** ${fn.getDayOfWeekToString(habitCron.weekly)}`
        + `\n\n__**Get Quotes:**__ ${getQuote ? "Yes" : "No"}`
        + `\n- **Next Quote:** ${getQuote ? nextQuote ? fn.timestampToDateString(nextQuote + (offset * HOUR_IN_MS)) : "N/A" : "N/A"}`
        + `\n- **Quote Interval:** ${getQuote ? quoteInterval ? `Every ${quoteInterval}` : "N/A" : "N/A"}`
        + `\n\n__**Delete Replies Sent During Commands:**__ ${deleteRepliesDuringCommand ? "Yes" : "No"}`
        + `\n\n__**Likes Pestering Accountability:**__ ${likesAccountability ? "YES!!!" : "No"}`
        + `\n\n__**Account Premium Level:**__ ${fn.getTierStarString(tier)}`;
    return output;
}

module.exports = {
    name: "settings",
    description: "User Settings/Preferences: Timezone, Habits, Reminders, etc.",
    aliases: ["setting", "set", "s", "preferences",
        "user", "u", "usersettings", "userconfig"],
    cooldown: 2.5,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSaving, forceSkip) {
        const authorID = message.author.id;
        let userSettings = await User.findOne({ discordID: authorID });
        const authorUsername = message.author.username;
        const settingCommand = args[0] ? args[0].toLowerCase() : false;
        let settingUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed}\` - **(to see your settings)**`
            + `\n\`${PREFIX}${commandUsed} <ACTION> <force?>\``
            + "\n\n\`<ACTION>\`: **edit/change**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        settingUsageMessage = fn.getMessageEmbed(settingUsageMessage, "User Settings: Help", userEmbedColour);
        const settingHelpMessage = `Try ${PREFIX}${commandUsed} help - for more options (and how to edit)`;
        const username = message.channel.type === 'dm' ? authorUsername
            : bot.guilds.cache.get(message.guild.id).member(authorID).displayName;
        const showUserSettings = fn.getMessageEmbed(userDocumentToString(userSettings),
            `${username}'s Settings`,
            userEmbedColour)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setFooter(settingHelpMessage);

        if (settingCommand === "help") {
            return message.channel.send(settingUsageMessage);
        }


        //see, edit (when edit, show see first then usage),
        else if (settingCommand === "edit" || settingCommand === "ed" || settingCommand === "e"
            || settingCommand === "change" || settingCommand === "ch" || settingCommand === "c"
            || settingCommand === "setup" || settingCommand === "set" || settingCommand === "s") {
            do {
                userSettings = await User.findOne({ discordID: authorID });
                var userFields = userSettings.getQuote ? ["Timezone", "Daylight Savings Time", "Habit Daily Reset Time", "Habit Weekly Reset Time",
                    "Get Quotes", "Next Quote", "Quote Interval", "Delete Replies Sent During Commands", "Likes Pestering Accountability",]
                    : ["Timezone", "Daylight Savings Time", "Habit Daily Reset Time", "Habit Weekly Reset Time",
                        "Get Quotes", "Delete Replies Sent During Commands", "Likes Pestering Accountability",];
                const quoteAdjustment = userSettings.getQuote ? 0 : 2;
                let fieldsList = "";
                userFields.forEach((field, i) => {
                    fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
                });
                var continueEdit;
                const fieldToEditInstructions = "**Which field do you want to edit?:**";
                const fieldToEditAdditionalMessage = userDocumentToString(userSettings);
                const fieldToEditTitle = `${showUserSettings.title}: Edit Field`;
                let fieldToEditIndex = await fn.userSelectFromList(bot, PREFIX, message, fieldsList, userFields.length, fieldToEditInstructions,
                    fieldToEditTitle, userEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                const type = "Settings";
                const fieldToEdit = userFields[fieldToEditIndex];
                continueEdit = false;
                const originalTimezone = userSettings.timezone.name;
                var userEdit,
                    updatedTimezoneOffset = timezoneOffset,
                    updatedDaylightSaving = daylightSaving,
                    updatedTimezone = originalTimezone,
                    userSettingsPrompt = "";
                let { habitCron } = userSettings;
                switch (fieldToEditIndex) {
                    case 0:
                        userSettingsPrompt = `Please enter your **__timezone__** as an **abbreviation** or **+/- UTC Offset**:`;
                        userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, userSettingsPrompt, type, forceSkip, userEmbedColour);
                        break;
                    case 1:
                        userSettingsPrompt = `Does your timezone participate in **Daylight Savings Time (DST)?**\n**⌚ - Yes\n⛔ - No**`;
                        userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, userSettingsPrompt,
                            ['⌚', '⛔'], type, forceSkip, userEmbedColour);
                        break;
                    case 2:
                        userSettingsPrompt = `Enter the **time of day** (i.e. 1a, 3:30AM, etc.) you would like your **habits to reset daily:**`;
                        userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, userSettingsPrompt, type, forceSkip, userEmbedColour);
                        break;
                    case 3:
                        userSettingsPrompt = `Enter the number corresponding to the __**day of the week**__ when you would like your **weekly habits counter to reset:**`;
                        userEdit = await fn.getUserEditNumber(bot, message, PREFIX, fieldToEdit, daysOfWeek.length, type, daysOfWeek, forceSkip, userEmbedColour, `${userSettingsPrompt}\n\n${daysOfWeekList}`);
                        if (userEdit !== false && !isNaN(userEdit)) userEdit--;
                        console.log({ userEdit });
                        break;
                    case 4:
                        userSettingsPrompt = `Do you want to regularly receive an **inspirational quote?**\n🙌 - **Yes**\n⛔ - **No**`;
                        userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, userSettingsPrompt,
                            ['🙌', '⛔'], type, forceSkip, userEmbedColour);
                        break;
                    case 5:
                        if (userSettings.getQuote) {
                            userSettingsPrompt = `\n__**When do you intend to start the next quote?**__ ⌚\n${futureTimeExamples}`
                                + "\n\nType `skip` to **start it now**"
                            userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, userSettingsPrompt, type, forceSkip, userEmbedColour);
                        }
                        else {
                            fn.sendReplyThenDelete(message, "Make sure you allow yourself to **Get Quotes** first, before then adjusting the interval", 60000);
                            userEdit = "back";
                            continueEdit = true;
                        }
                        break;
                    case 6:
                        if (userSettings.getQuote) {
                            userSettingsPrompt = `How often do you want to receive an inspirational quote?\n\n${intervalExamples}`;
                            userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, userSettingsPrompt, type, forceSkip, userEmbedColour);
                        }
                        else {
                            fn.sendReplyThenDelete(message, "Make sure you allow yourself to **Get Quotes** first, before then adjusting the interval", 60000);
                            userEdit = "back";
                            continueEdit = true;
                        }
                        break;
                    case 7 - quoteAdjustment:
                        userSettingsPrompt = `Do you want me to delete your replies to my commands?\n(To keep servers/channels clean and/or hide your entries while typing in a server)`
                            + `\n\n👍 - **Yes**\n\n👎 - **No**`;
                        userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, userSettingsPrompt,
                            ['👍', '👎'], type, forceSkip, userEmbedColour);
                        break;
                    case 8 - quoteAdjustment:
                        userSettingsPrompt = `Are you into **pestering accountability** (💪) or not so much (🙅‍♀️)?`;
                        userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, userSettingsPrompt,
                            ['💪', '🙅‍♀️'], type, forceSkip, userEmbedColour);
                        break;
                }
                if (userEdit === false) return;
                else if (userEdit === undefined) userEdit = "back";
                else if (userEdit !== "back") {
                    switch (fieldToEditIndex) {
                        case 0:
                            {
                                updatedTimezoneOffset = fn.getTimezoneOffset(userEdit);
                                console.log({ updatedTimezoneOffset });
                                if (updatedTimezoneOffset || updatedTimezoneOffset === 0) {
                                    updatedTimezone = userEdit;
                                    if (updatedDaylightSaving) {
                                        updatedTimezoneOffset += fn.isDaylightSavingTime(
                                            Date.now() + updatedTimezoneOffset * HOUR_IN_MS,
                                            updatedTimezone,
                                            true
                                        ) ? fn.getTimezoneDaylightOffset(updatedTimezone) : 0;
                                    }
                                }
                                else {
                                    fn.sendReplyThenDelete(message, "**This timezone does not exist...**", 60000);
                                    continueEdit = true;
                                }
                            }
                            break;
                        case 1:
                            {
                                switch (userEdit) {
                                    case '⌚': userEdit = true;
                                        break;
                                    case '⛔': userEdit = false;
                                        break;
                                    default: userEdit = null;
                                        break;
                                }
                                if (typeof userEdit === "boolean") {
                                    updatedDaylightSaving = userEdit;
                                    updatedTimezoneOffset = fn.getTimezoneOffset(originalTimezone);
                                    if (updatedDaylightSaving === true) {
                                        updatedTimezoneOffset += fn.isDaylightSavingTime(Date.now() + updatedTimezoneOffset * HOUR_IN_MS,
                                            originalTimezone, true) ? fn.getTimezoneDaylightOffset(originalTimezone) : 0;
                                    }
                                }
                                else continueEdit = true;
                            }
                            break;
                        case 2:
                            {
                                const timeArgs = userEdit.toLowerCase().split(/[\s\n]+/);
                                const timeRegex = /^(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?$/;
                                const joinedArgs = timeArgs.join('')
                                const ensureTime = timeRegex.exec(joinedArgs);
                                const errorMessage = "**Please enter a proper time in the given format...**";
                                console.log({ ensureTime });
                                if (!ensureTime) {
                                    fn.sendReplyThenDelete(message, errorMessage, 30000);
                                    continueEdit = true;
                                }
                                else {
                                    const startTimestamp = new Date(Date.now());
                                    let endTime = fn.timeCommandHandlerToUTC(timeArgs[0] !== "today" ? (["today"]).concat(timeArgs) : timeArgs,
                                        startTimestamp.getTime(), timezoneOffset, daylightSaving);
                                    if (!endTime) {
                                        fn.sendReplyThenDelete(message, errorMessage, 30000);
                                        continueEdit = true;
                                    }
                                    else {
                                        const todayMidnight = new Date(startTimestamp.getUTCFullYear(), startTimestamp.getUTCMonth(),
                                            startTimestamp.getUTCDate()).setUTCHours(0);
                                        // Should not need to modulus the difference, but in case
                                        // the logic above fails..
                                        const DAY_IN_MS = fn.getTimeScaleToMultiplyInMs("day");
                                        var timeAfterMidnight = (endTime - todayMidnight) < 0 ?
                                            userSettings.habitCron.daily : (endTime - todayMidnight) % DAY_IN_MS;
                                        console.log({ endTime, startTimestamp, todayMidnight, });
                                        console.log({ timeAfterMidnight });
                                        const oldDailyCron = userSettings.habitCron.daily;
                                        // Prompt user if they want to adapt their logs to this new timestamp (i.e. bring the later logs back into the next day)
                                        // If yes, bring the logs which are between midnight and the old cron time, and move them backwards
                                        // Otherwise, if the new cron time is later, find all of the entries between the old cron time and the new cron time
                                        // and bring the cron times in the other section backwards
                                        if (oldDailyCron !== timeAfterMidnight) {
                                            userSettings = await User.findOneAndUpdate({ discordID: authorID },
                                                { $set: { 'habitCron.daily': timeAfterMidnight } }, { new: true });
                                            const habits = await Habit.find({ userID: authorID });
                                            if (habits) if (habits.length) {
                                                const newCronIsAfterOldCron = oldDailyCron < timeAfterMidnight;
                                                if ((!newCronIsAfterOldCron && oldDailyCron >= 1000) || newCronIsAfterOldCron) {
                                                    let confirmationMessage = "**Would you like to adjust your habit logs to fall within the __same day as they previously were?__**";
                                                    if (newCronIsAfterOldCron) {
                                                        confirmationMessage += `\n\ne.g. If you had a habit entry on **Monday** between **${fn.msToTimeFromMidnight(oldDailyCron)} and`
                                                            + ` ${fn.msToTimeFromMidnight(timeAfterMidnight)}**, it should still correspond to **Monday, instead of Sunday**`
                                                            + ` - since the entry would now be *before the new reset time (${fn.msToTimeFromMidnight(timeAfterMidnight)}) for Sunday*`;
                                                    }
                                                    else if (!newCronIsAfterOldCron && oldDailyCron >= 1000) {
                                                        confirmationMessage += `\n\ne.g. If you had a habit entry on **Monday** between **${fn.msToTimeFromMidnight(timeAfterMidnight)} and `
                                                            + `${fn.msToTimeFromMidnight(oldDailyCron)}**, it should still correspond to **Sunday, instead of Monday**`
                                                            + ` - since the entry would now be *after the new reset time (${fn.msToTimeFromMidnight(timeAfterMidnight)}) for Sunday*`;
                                                    }
                                                    else break;
                                                    const confirmAdjust = await fn.getUserConfirmation(bot, message, PREFIX, confirmationMessage, false,
                                                        `${type}: Adjust Previous Habit Times`, 600000);
                                                    // If it's null, the user did not type anything automatically adjust
                                                    if (confirmAdjust || confirmAdjust === null) {
                                                        const habitIDs = habits.map(habit => habit._id).filter(habitID => habitID !== undefined)
                                                        const logs = await Log.find({ connectedDocument: { $in: habitIDs } }, { timestamp: 1 });
                                                        if (logs) if (logs.length) {
                                                            logs.forEach(async log => {
                                                                if (log.timestamp) {
                                                                    var needsUpdate = false;
                                                                    let { timestamp } = log;
                                                                    const timestampsTimePastMidnight = fn.getTimePastMidnightInMs(timestamp);
                                                                    console.log(`Timestamp: ${fn.timestampToDateString(timestamp)}`);
                                                                    const date = new Date(timestamp);
                                                                    const year = date.getUTCFullYear();
                                                                    const month = date.getUTCMonth();
                                                                    const day = date.getUTCDate();
                                                                    if (newCronIsAfterOldCron) {
                                                                        if (timestampsTimePastMidnight >= oldDailyCron
                                                                            && timestampsTimePastMidnight < timeAfterMidnight) {
                                                                            timestamp = new Date(year, month, day).getTime() + timeAfterMidnight;
                                                                            console.log(`New Timestamp: ${fn.timestampToDateString(timestamp)}`);
                                                                            needsUpdate = true;
                                                                        }
                                                                    }
                                                                    else {
                                                                        if (timestampsTimePastMidnight >= timeAfterMidnight
                                                                            && timestampsTimePastMidnight < oldDailyCron) {
                                                                            // One second before, because on or over the cron time corresponds to the next day
                                                                            timestamp = new Date(year, month, day).getTime() + timeAfterMidnight - 1000;
                                                                            console.log(`New Timestamp: ${fn.timestampToDateString(timestamp)}`);
                                                                            needsUpdate = true;
                                                                        }
                                                                    }
                                                                    if (needsUpdate) {
                                                                        console.log("UPDATING TIMESTAMP!\n");
                                                                        const { connectedDocument } = log;
                                                                        await Log.updateOne({ connectedDocument }, { $set: { timestamp } });
                                                                    }
                                                                }
                                                            });
                                                        }
                                                    }
                                                    else if (confirmAdjust === false) {
                                                        let { habitCron: updatedHabitCron } = userSettings;
                                                        if (habits) if (habits.length) {
                                                            habits.forEach(async habit => {
                                                                if (habit) {
                                                                    const updatedHabit = await hb.updateHabit(habit, timezoneOffset, updatedHabitCron);
                                                                    await hb.cancelHabitById(habit._id);
                                                                    await hb.habitCron(updatedHabit, timezoneOffset, updatedHabitCron);
                                                                }
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        // WITH Time collection
                                        // Allow bot to make a new locked channel which will show the time based on the user settings - (ticking every 5 secs) then
                                        // upon start up deletes all remaining timer channels if any - 3 per server/guild! (Allows for pomodoro!)
                                    }
                                }
                            }
                            break;
                        case 3:
                            habitCron = {
                                daily: userSettings.habitCron.daily,
                                weekly: userEdit,
                            };
                            userSettings = await User.findOneAndUpdate({ discordID: authorID }, { $set: { habitCron } }, { new: true });
                            break;
                        case 4:
                            {
                                switch (userEdit) {
                                    case '🙌': userEdit = true;
                                        break;
                                    case '⛔': userEdit = false;
                                        break;
                                    default: userEdit = null;
                                        break;
                                }
                                // setup interval!
                                if (typeof userEdit === "boolean") {
                                    var interval, firstQuote;
                                    let error = false;
                                    if (userEdit) {
                                        userSettingsPrompt = `How often do you want to receive an inspirational quote?\n\n${intervalExamples}`;
                                        let intervalInput = await fn.getUserEditString(bot, message, PREFIX, "Quote Interval", userSettingsPrompt, type, forceSkip, userEmbedColour);
                                        if (!intervalInput) return;
                                        else if (intervalInput === "back") {
                                            continueEdit = true;
                                        }
                                        else {
                                            intervalInput = intervalInput.toLowerCase().split(/[\s\n]+/);
                                            const timeArgs = intervalInput[0] === "in" ? intervalInput : ["in"].concat(intervalInput);
                                            let now = Date.now();
                                            let endTime = fn.timeCommandHandlerToUTC(timeArgs, now, timezoneOffset,
                                                daylightSaving, true, true, true);
                                            if (!endTime) {
                                                error = true;
                                                continueEdit = true;
                                                interval = false;
                                            }
                                            else {
                                                endTime -= HOUR_IN_MS * timezoneOffset;
                                                now = fn.getCurrentUTCTimestampFlooredToSecond();
                                                interval = endTime - now;
                                            }
                                            if (!interval) {
                                                fn.sendReplyThenDelete(message, `**INVALID TIME**... ${settingHelpMessage}`, 60000);
                                                error = true;
                                                continueEdit = true;
                                            }
                                            else if (interval < HOUR_IN_MS) {
                                                fn.sendReplyThenDelete(message, "Please enter an interval __**> 1 hour**__");
                                                error = true;
                                                continueEdit = true;
                                            }
                                            else {
                                                userSettingsPrompt = `\n__**When do you intend to start the first quote?**__ ⌚\n${futureTimeExamples}`
                                                    + "\n\nType `skip` to **start it now**"
                                                let quoteTrigger = await fn.getUserEditString(bot, message, PREFIX, "First Quote Time", userSettingsPrompt, type, forceSkip, userEmbedColour);
                                                if (!quoteTrigger) return;
                                                else if (quoteTrigger === "back") {
                                                    continueEdit = true;
                                                }
                                                else {
                                                    const isCurrent = quoteTrigger === "skip" || quoteTrigger === "now";
                                                    currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                                                    if (isCurrent) firstQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                                    else {
                                                        quoteTrigger = quoteTrigger.toLowerCase().split(/[\s\n]+/);
                                                        const triggerArgs = quoteTrigger[0] === "in" ? quoteTrigger : ["in"].concat(quoteTrigger);
                                                        firstQuote = fn.timeCommandHandlerToUTC(triggerArgs, currentTimestamp, timezoneOffset, daylightSaving);
                                                    }
                                                    if (firstQuote) {
                                                        firstQuote -= HOUR_IN_MS * timezoneOffset;
                                                        if (firstQuote - currentTimestamp >= 0) {
                                                            continueEdit = false;
                                                        }
                                                        else {
                                                            fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                                            continueEdit = true;
                                                            error = true;
                                                        }
                                                    }
                                                    else {
                                                        fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                                        continueEdit = true;
                                                        error = true;
                                                    }
                                                }
                                            }
                                        }
                                        // Get the first instance!
                                    }
                                    else {
                                        try {
                                            console.log(`Deleting ${authorUsername}'s (${authorID}) recurring quotes`);
                                            const reminderQuery = { userID: authorID, isDM: true, isRecurring: true, title: "Quote" };
                                            const reminders = await Reminder.find(reminderQuery);
                                            reminders.forEach(async reminder => {
                                                await rm.cancelReminderById(reminder._id);
                                            });
                                            await Reminder.deleteMany(reminderQuery);
                                        }
                                        catch (err) {
                                            console.error(err);
                                            console.log("Deletion of recurring quote has failed!");
                                        }
                                    }
                                    if (!error) {
                                        userSettings = await User.findOneAndUpdate({ discordID: authorID },
                                            {
                                                $set:
                                                {
                                                    getQuote: userEdit,
                                                    quoteInterval: intervalInput.join(' '),
                                                    nextQuote: firstQuote,
                                                }
                                            }, { new: true });
                                    }
                                }
                                else continueEdit = true;
                            }
                            break;
                        case 5:
                            {
                                let nextQuote;
                                const isCurrent = userEdit === "skip" || userEdit === "now";
                                currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                                if (isCurrent) nextQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                else {
                                    userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                    const timeArgs = userEdit[0] === "in" ? userEdit : ["in"].concat(userEdit);
                                    nextQuote = fn.timeCommandHandlerToUTC(timeArgs, currentTimestamp, timezoneOffset, daylightSaving);
                                }
                                if (nextQuote) {
                                    nextQuote -= HOUR_IN_MS * timezoneOffset;
                                    if (nextQuote - currentTimestamp >= 0) {
                                        userSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                                            $set:
                                            {
                                                getQuote: true,
                                                quoteInterval: userSettings.quoteInterval,
                                                nextQuote,
                                            }
                                        }, { new: true });
                                        continueEdit = false;
                                    }
                                    else {
                                        fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                        continueEdit = true;
                                    }
                                }
                                else {
                                    fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                    continueEdit = true;
                                }
                            }
                            break;
                        case 6:
                            {
                                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                console.log({ userEdit });
                                let currentTimestamp = Date.now();
                                const intervalArgs = userEdit[0] === "in" ? userEdit : ["in"].concat(userEdit)
                                let endInterval = fn.timeCommandHandlerToUTC(intervalArgs, currentTimestamp,
                                    timezoneOffset, daylightSaving, true, true, true);
                                if (!endInterval) {
                                    fn.sendReplyThenDelete(message, `**INVALID TIME**... ${settingHelpMessage}`, 60000);
                                    continueEdit = true;
                                }
                                else {
                                    endInterval -= HOUR_IN_MS * timezoneOffset;
                                    currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                                    const updatedInterval = endInterval - currentTimestamp;
                                    if (updatedInterval < HOUR_IN_MS) {
                                        fn.sendReplyThenDelete(message, "Please enter an interval __**> 1 hour**__");
                                        continueEdit = true;
                                    }
                                    else {
                                        let { nextQuote } = userSettings;
                                        nextQuote += HOUR_IN_MS * timezoneOffset;
                                        userSettingsPrompt = `\n__**When do you intend to start the first quote?**__ ⌚`
                                            + `${nextQuote ? !isNaN(nextQuote) ? `\n\n**Currently**: ${fn.timestampToDateString(nextQuote)}` : "" : ""}`
                                            + `\n${futureTimeExamples}\n\nType \`same\` to **keep it the same**\nType \`skip\` to **start it now**`;
                                        let quoteTrigger = await fn.getUserEditString(bot, message, PREFIX, "First Quote Time", userSettingsPrompt, type, forceSkip, userEmbedColour);
                                        if (!quoteTrigger) return;
                                        else if (quoteTrigger === "back") {
                                            continueEdit = true;
                                        }
                                        else {
                                            var firstQuote;
                                            if (quoteTrigger === "same") {
                                                firstQuote = nextQuote;
                                            }
                                            else {
                                                const isCurrent = quoteTrigger === "skip" || quoteTrigger === "now";
                                                currentTimestamp = Date.now();
                                                if (isCurrent) firstQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                                else {
                                                    quoteTrigger = quoteTrigger.toLowerCase().split(/[\s\n]+/);
                                                    const triggerArgs = quoteTrigger[0] === "in" ? quoteTrigger : ["in"].concat(quoteTrigger);
                                                    firstQuote = fn.timeCommandHandlerToUTC(triggerArgs, currentTimestamp, timezoneOffset, daylightSaving);
                                                }
                                            }
                                            if (firstQuote) {
                                                firstQuote -= HOUR_IN_MS * timezoneOffset;
                                                if (firstQuote - currentTimestamp >= 0) {
                                                    userSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                                                        $set:
                                                        {
                                                            getQuote: true,
                                                            quoteInterval: userEdit.join(' '),
                                                            nextQuote: firstQuote,
                                                        }
                                                    }, { new: true });
                                                    continueEdit = false;
                                                }
                                                else {
                                                    fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                                    continueEdit = true;
                                                }
                                            }
                                            else {
                                                fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                                continueEdit = true;
                                            }
                                        }
                                    }
                                }
                            }
                            break;
                        case 7 - quoteAdjustment:
                            {
                                switch (userEdit) {
                                    case '👍': userEdit = true;
                                        break;
                                    case '👎': userEdit = false;
                                        break;
                                    default: userEdit = null;
                                        break;
                                }
                                if (typeof userEdit === "boolean") {
                                    userSettings = await User.findOneAndUpdate({ discordID: authorID },
                                        { $set: { deleteRepliesDuringCommand: userEdit } }, { new: true })
                                }
                                else continueEdit = true;
                            }
                            break;
                        case 8 - quoteAdjustment:
                            {
                                switch (userEdit) {
                                    case '💪': userEdit = true;
                                        break;
                                    case '🙅‍♀️': userEdit = false;
                                        break;
                                    default: userEdit = null;
                                        break;
                                }
                                if (typeof userEdit === "boolean") {
                                    userSettings = await User.findOneAndUpdate({ discordID: authorID },
                                        { $set: { likesPesteringAccountability: userEdit } }, { new: true })
                                }
                                else continueEdit = true;
                            }
                            break;
                    }
                }
                else continueEdit = true;
                if (fieldToEditIndex === 0 || fieldToEditIndex === 1) {
                    const timezoneDifference = updatedTimezoneOffset - timezoneOffset;
                    let reminderQuery = {
                        userID: authorID,
                    };
                    const confirmUpdateReminders = await fn.userSelectFromList(bot, PREFIX, message,
                        "`1` - Adjust **ALL** of your reminders\n`2` - Adjust only your **DM** reminders"
                        + "\n`3` - Adjust only your **server** reminders\n`4` - NONE", 4,
                        "**__Would you like to adjust your reminders to this new timezone?__**"
                        + `\n- From **${originalTimezone}, ${fn.hoursToUTCOffset(timezoneOffset)} - ${daylightSaving ? "NO DST" : "considering DST"}** -to-`
                        + ` **${updatedTimezone}, ${fn.hoursToUTCOffset(updatedTimezoneOffset)} - ${updatedDaylightSaving ? "NO DST" : "considering DST"}**`
                        + "\n(Type `4` to leave your reminders adjusted to your old timezone)"
                        + "\n(Your habit reset time, if any, will automatically be adapted regardless of your choice here)",
                        false, `${showUserSettings.title}: Reminder Adjustment Confirmation`);
                    if (!confirmUpdateReminders && confirmUpdateReminders !== 0) break;
                    switch (confirmUpdateReminders) {
                        case 1: reminderQuery.isDM = true;
                            break;
                        case 2: reminderQuery.isDM = false;
                            break;
                    }
                    if (confirmUpdateReminders !== 3) {
                        let userReminders = await Reminder.find(reminderQuery);
                        if (userReminders) if (userReminders.length) {
                            userReminders.forEach(async reminder => {
                                let { startTime, endTime } = reminder;
                                startTime += timezoneDifference * HOUR_IN_MS;
                                endTime += timezoneDifference * HOUR_IN_MS;
                                reminder = await Reminder.updateOne({ _id: reminder._id }, {
                                    $set: {
                                        startTime, endTime,
                                    }
                                });
                                await rm.cancelReminderById(reminder._id);
                                await rm.sendReminderByObject(bot, reminder);
                            });
                        }
                    }
                    let userHabits = await Habit.find({ userID: authorID });
                    if (userHabits) if (userHabits.length) {
                        userHabits.forEach(async habit => {
                            let { nextCron, settings } = habit;
                            const { isWeeklyType, cronPeriods } = settings;
                            nextCron = hb.getNextCronTimeUTC(updatedTimezoneOffset, habitCron, isWeeklyType, cronPeriods);
                            await Habit.updateOne({ _id: habit._id }, {
                                $set: {
                                    nextCron,
                                }
                            });
                        });
                        userHabits.forEach(async habit => {
                            await hb.cancelHabitById(habit._id);
                        });
                        await hb.habitCronUser(authorID);
                    }

                    timezoneOffset = updatedTimezoneOffset;
                    daylightSaving = updatedDaylightSaving;
                    userSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                        $set: {
                            timezone: {
                                name: updatedTimezone,
                                offset: updatedTimezoneOffset,
                                daylightSaving: updatedDaylightSaving,
                            }
                        }
                    }, { new: true });
                    console.log({ userSettings });
                }
                else if (fieldToEditIndex === 2 || fieldToEditIndex === 3) {
                    let userHabits = await Habit.find({ userID: authorID });
                    if (userHabits) if (userHabits.length) {
                        userHabits.forEach(async habit => {
                            let { nextCron, settings } = habit;
                            let { isWeeklyType, cronPeriods } = settings;
                            const now = Date.now();
                            do {
                                nextCron = await hb.getNextCronTimeUTC(timezoneOffset, habitCron, isWeeklyType, cronPeriods, nextCron);
                            }
                            while (nextCron < now)
                            await Habit.updateOne({ _id: habit._id }, {
                                $set: {
                                    nextCron,
                                }
                            });
                        });
                        userHabits.forEach(async habit => {
                            await hb.cancelHabitById(habit._id);
                        });
                        await hb.habitCronUser(authorID);
                    }
                }
                if (!continueEdit) {
                    if ((fieldToEditIndex === 4 && userEdit === true) || fieldToEditIndex === 5 || fieldToEditIndex === 6) {
                        const now = fn.getCurrentUTCTimestampFlooredToSecond();

                        const reminderQuery = { userID: authorID, title: "Quote", isDM: true, isRecurring: true, };
                        const reminders = await Reminder.find(reminderQuery);
                        reminders.forEach(async reminder => {
                            await rm.cancelReminderById(reminder._id);
                        });
                        await Reminder.deleteMany(reminderQuery);

                        var quoteIndex, currentQuote;
                        while (!currentQuote) {
                            quoteIndex = Math.round(Math.random() * quotes.length);
                            currentQuote = quotes[quoteIndex].message;
                        }
                        await rm.setNewDMReminder(bot, authorID, now, userSettings.nextQuote,
                            currentQuote, "Quote", true, false, true, userSettings.quoteInterval,
                            false, quoteEmbedColour);
                    }
                    const continueEditMessage = `Do you want to continue **editing your settings?**\n\n${userDocumentToString(userSettings)}`;
                    continueEdit = await fn.getUserConfirmation(bot, message, PREFIX, continueEditMessage, forceSkip, `Settings: Continue Editing?`, 300000);
                }
            }
            while (continueEdit === true)
            return;
        }
        else return message.channel.send(showUserSettings);
    }
};