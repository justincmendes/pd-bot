const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const Habit = require("../database/schemas/habit");
const quotes = require("../../utilities/quotes.json").quotes;
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const hb = require("../../utilities/habit");
require("dotenv").config();

const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
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
                var userEdit, userSettingsPrompt = "";
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
                                let updatedTimezone = fn.getTimezoneOffset(userEdit);
                                console.log({ updatedTimezone, continueEdit })
                                if (updatedTimezone || updatedTimezone === 0) {
                                    const daylightSetting = userSettings.timezone.daylightSaving
                                    if (daylightSetting) {
                                        updatedTimezone += fn.isDaylightSavingTime(
                                            Date.now() + updatedTimezone * HOUR_IN_MS,
                                            userEdit,
                                            true
                                        ) ? fn.getTimezoneDaylightOffset(userEdit) : 0;
                                    }
                                    userSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                                        $set: {
                                            timezone: {
                                                name: userEdit,
                                                offset: updatedTimezone,
                                                daylightSaving: daylightSetting,
                                            }
                                        }
                                    }, { new: true });
                                    timezoneDifference = updatedTimezone;
                                }
                                else {
                                    fn.sendReplyThenDelete(message, "**This timezone does not exist...**", 60000);
                                    continueEdit = true;
                                }
                                console.log({ continueEdit });
                                timezoneOffset = updatedTimezone;
                                daylightSaving = userEdit;
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
                                    const originalTimezone = userSettings.timezone.name;
                                    let updatedTimezoneOffset = fn.getTimezoneOffset(originalTimezone);
                                    if (userEdit === true) {
                                        updatedTimezoneOffset += fn.isDaylightSavingTime(Date.now() + updatedTimezoneOffset * HOUR_IN_MS,
                                            originalTimezone, true) ? fn.getTimezoneDaylightOffset(originalTimezone) : 0;
                                    }
                                    userSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                                        $set: {
                                            timezone: {
                                                name: originalTimezone,
                                                offset: updatedTimezoneOffset,
                                                daylightSaving: userEdit,
                                            }
                                        }
                                    }, { new: true });
                                    console.log({ userSettings });
                                    timezoneDifference = updatedTimezoneOffset;
                                }
                                else continueEdit = true;
                                timezoneOffset = updatedTimezoneOffset;
                                daylightSaving = userEdit;
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
                                        habitCron = {
                                            daily: timeAfterMidnight,
                                            weekly: userSettings.habitCron.weekly,
                                        };
                                        userSettings = await User.findOneAndUpdate({ discordID: authorID }, { $set: { habitCron } }, { new: true });
                                        // Prompt user if they want to adapt their logs to this new timestamp (i.e. bring the later logs back into the next day)
                                        // If yes, bring the logs which are between midnight and the old cron time, and move them backwards
                                        // Otherwise, if the new cron time is later, find all of the entries between the old cron time and the new cron time
                                        // and bring the cron times in the other section backwards

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
                                        console.log(`Deleting ${authorUsername}'s (${authorID}) recurring quotes`);
                                        await Reminder.deleteMany({ userID: authorID, isDM: true, isRecurring: true, type: "Quote" })
                                            .catch(err => {
                                                console.error(err);
                                                console.log("Deletion of recurring quote has failed!");
                                            });
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
                    const timezoneDifference = updatedTimezone - timezoneOffset;
                    const confirmUpdateReminders = await fn.getUserConfirmation(bot, message, PREFIX,
                        `**Would you like to adjust your reminders to this new timezone? (${userEdit}, ${updatedTimezone})**`
                        + "\n\n(Your habits will automatically be adapted regardless of your choice here)",
                        false, `${showUserSettings.title}: Reminder Adjustment Confirmation`);
                    if (confirmUpdateReminders) {
                        let userReminders = await Reminder.find({ userID: authorID });
                        if (userReminders) if (userReminders.length) {
                            userReminders.forEach(async reminder => {
                                let { startTime, endTime } = reminder;
                                startTime += timezoneDifference * HOUR_IN_MS;
                                endTime += timezoneDifference * HOUR_IN_MS;
                                const now = Date.now();
                                reminder = await Reminder.updateOne({ _id: reminder._id }, {
                                    $set: {
                                        startTime, endTime, lastEdited: now,
                                    }
                                });
                                await rm.sendReminderByObject(bot, reminder);
                            });
                        }
                    }
                    let userHabits = await Habit.find({ userID: authorID });
                    if (userHabits) if (userHabits.length) {
                        userHabits.forEach(async habit => {
                            let { nextCron } = habit;
                            nextCron += timezoneDifference * HOUR_IN_MS;
                            const now = Date.now();
                            await Habit.updateOne({ _id: habit._id }, {
                                $set: {
                                    nextCron, lastEdited: now,
                                }
                            });
                        });
                        await hb.habitCronUser(authorID);
                    }
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
                                    nextCron, lastEdited: now,
                                }
                            });
                        });
                        await hb.habitCronUser(authorID);
                    }
                }
                if (!continueEdit) {
                    if ((fieldToEditIndex === 4 && userEdit === true) || fieldToEditIndex === 5 || fieldToEditIndex === 6) {
                        const now = fn.getCurrentUTCTimestampFlooredToSecond();
                        await Reminder.deleteMany({ userID: authorID, type: "Quote", isDM: true, isRecurring: true, });
                        var quoteIndex, currentQuote;
                        while (!currentQuote) {
                            quoteIndex = Math.round(Math.random() * quotes.length);
                            currentQuote = quotes[quoteIndex].message;
                        }
                        await rm.setNewDMReminder(bot, authorID, now, userSettings.nextQuote,
                            currentQuote, "Quote", false, true, userSettings.quoteInterval, quoteEmbedColour);
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