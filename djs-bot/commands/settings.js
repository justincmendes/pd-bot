const Discord = require("discord.js");
const User = require("../database/schemas/user");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();

const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const userEmbedColour = fn.userSettingsEmbedColour;

// Private Function Declarations
function msToTimeFromMidnight(milliseconds, inMilitaryTime = false) {
    const defaultTime = "00:00:00";
    if (isNaN(milliseconds)) return defaultTime;
    const DAY_IN_MS = fn.getTimeScaleToMultiplyInMs("day");
    milliseconds = milliseconds % DAY_IN_MS;
    let [hours, mins, seconds,] = fn.getHoursMinutesSecondsMillisecondsArray(milliseconds);
    var timeString;
    hours = hours < 10 ? `0${hours}` : hours;
    mins = mins < 10 ? `0${mins}` : mins;
    seconds = seconds < 10 ? `0${seconds}` : seconds;
    if (!inMilitaryTime) {
        const standardTime = fn.militaryTimeHoursToStandardTimeHoursArray(hours);
        if (!standardTime) return defaultTime;
        [hours, amPmString] = standardTime;
        timeString = `${hours}:${mins}:${seconds} ${amPmString}`;
    }
    else timeString = `${hours}:${mins}:${seconds}`;
    return timeString ? timeString : defaultTime;
}

function hoursToUTCOffset(hours) {
    if (!isNaN(hours)) {
        const sign = hours < 0 ? "-" : "+";
        hours = Math.abs(hours);
        let hoursOut = parseInt(hours);
        hoursOut = hoursOut < 10 ? `0${hoursOut}` : hoursOut;
        let minsOut = parseInt((hours - hoursOut) / 60);
        minsOut = minsOut < 10 ? `0${minsOut}` : minsOut;
        return `${sign}${hoursOut}:${minsOut}`;
    }
    else return hours;
}

function userDocumentToString(userSettings) {
    const { timezone: { name, offset, daylightSavings }, likesPesteringAccountability: likesAccountability,
        habitCron } = userSettings
    const output = `__**Timezone:**__ ${name}\n- **UTC Offset (in hours):** ${hoursToUTCOffset(offset)}`
        + `\n- **Daylight Savings Time:** ${daylightSavings ? "Yes" : "No"}`
        + `\n\n__**Habit Reset Time (daily):**__ ${msToTimeFromMidnight(habitCron)}`
        + `\n\n__**Likes Pestering Accountability:**__ ${likesAccountability ? "YES!!!" : "No"}`;
    return output;
}

module.exports = {
    name: "settings",
    description: "User Settings/Preferences: Timezone, Habits, Reminders, etc.",
    aliases: ["setting", "set", "s", "preferences",
        "user", "usersettings", "userconfig"],
    cooldown: 5,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        const authorID = message.author.id;
        let userSettings = await User.findOne({ discordID: authorID });
        const authorUsername = message.author.username;
        const settingCommand = args[0] ? args[0].toLowerCase() : false;
        let settingUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION> <force?>\``
            + "\n\n\`<ACTION>\`: **edit/change**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        settingUsageMessage = fn.getMessageEmbed(settingUsageMessage, "User Settings: Help", userEmbedColour);
        const settingHelpMessage = `Try \*${PREFIX}${commandUsed} help\* for more options (and how to edit)`;
        const username = message.channel.type === 'dm' ? authorUsername
            : bot.guilds.cache.get(message.guild.id).member(authorID).displayName;
        const showUserSettings = fn.getMessageEmbed(userDocumentToString(userSettings),
            `${username}'s Settings`,
            userEmbedColour)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter(settingHelpMessage);

        if (settingCommand === "help") {
            return message.channel.send(settingUsageMessage);
        }


        //see, edit (when edit, show see first then usage),
        else if (settingCommand === "edit" || settingCommand === "ed" || settingCommand === "e"
            || settingCommand === "change" || settingCommand === "ch" || settingCommand === "c") {
            var userFields = ["Timezone", "Daylight Savings Time", "Habit Reset Time", "Likes Pestering Accountability",];
            let fieldsList = "";
            userFields.forEach((field, i) => {
                fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
            });
            var continueEdit;
            do {
                const fieldToEditInstructions = "**Which field do you want to edit?:**";
                const fieldToEditAdditionalMessage = userDocumentToString(userSettings);
                const fieldToEditTitle = `${showUserSettings.title}: Edit Field`;
                let fieldToEditIndex = await fn.userSelectFromList(message, fieldsList, userFields.length, fieldToEditInstructions,
                    fieldToEditTitle, userEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                const type = "Settings";
                const fieldToEdit = userFields[fieldToEditIndex];
                continueEdit = false;
                var userEdit, userSettingsPrompt = "";
                switch (fieldToEditIndex) {
                    case 0:
                        userSettingsPrompt = `Please enter your **timezone** (as an *Abbreviation*):`;
                        userEdit = await fn.getUserEditString(message, fieldToEdit, userSettingsPrompt, type, forceSkip, userEmbedColour);
                        break;
                    case 1:
                        userSettingsPrompt = `Does your timezone participate in **Daylight Savings Time (DST)?**\n**⌚ - Yes\n⛔ - No**`;
                        userEdit = await fn.getUserEditBoolean(message, fieldToEdit, userSettingsPrompt,
                            ['⌚', '⛔'], type, forceSkip, userEmbedColour);
                        break;
                    case 2:
                        userSettingsPrompt = `Enter the **time of day** (i.e. 1a, 3:30AM, etc.) you would like your **habits to reset daily:**`;
                        userEdit = await fn.getUserEditString(message, fieldToEdit, userSettingsPrompt, type, forceSkip, userEmbedColour);
                        break;
                    case 3:
                        userSettingsPrompt = `Are you into **pestering accountability** (💪) or not so much (🙅‍♀️)?`;
                        userEdit = await fn.getUserEditBoolean(message, fieldToEdit, userSettingsPrompt,
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
                                    const daylightSetting = userSettings.timezone.daylightSavings
                                    if (daylightSetting) {
                                        updatedTimezone += fn.isDaylightSavingTime(Date.now(), true) ?
                                            fn.getTimezoneDaylightOffset(userEdit) : 0;
                                    }
                                    userSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                                        $set: {
                                            timezone: {
                                                name: userEdit,
                                                offset: updatedTimezone,
                                                daylightSavings: daylightSetting,
                                            }
                                        }
                                    }, { new: true });
                                }
                                else {
                                    fn.sendReplyThenDelete(message, "**This timezone does not exist...**", 60000);
                                    continueEdit = true;
                                }
                                console.log({ continueEdit });
                            }
                            break;
                        case 1:
                            {
                                switch (userEdit) {
                                    case '⌚': userEdit = true;
                                        break;
                                    case '⛔': userEdit = false;
                                        break;
                                    default: null;
                                        break;
                                }
                                if (typeof userEdit === "boolean") {
                                    const originalTimezone = userSettings.timezone.name;
                                    let updatedTimezoneOffset = fn.getTimezoneOffset(originalTimezone);
                                    if (userEdit === true) {
                                        updatedTimezoneOffset += fn.isDaylightSavingTime(Date.now(), true) ?
                                            fn.getTimezoneDaylightOffset(originalTimezone) : 0;
                                    }
                                    userSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                                        $set: {
                                            timezone: {
                                                name: originalTimezone,
                                                offset: updatedTimezoneOffset,
                                                daylightSavings: userEdit,
                                            }
                                        }
                                    }, { new: true });
                                    console.log({ userSettings })
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
                                        startTimestamp.getTime(), timezoneOffset, daylightSavings);
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
                                            userSettings.habitCron : (endTime - todayMidnight) % DAY_IN_MS;
                                        console.log({ endTime, startTimestamp, todayMidnight, });
                                        console.log({ timeAfterMidnight });
                                        userSettings = await User.findOneAndUpdate({ discordID: authorID },
                                            { $set: { habitCron: timeAfterMidnight } }, { new: true });
                                    }
                                }
                            }
                            break;
                        case 3:
                            {
                                switch (userEdit) {
                                    case '💪': userEdit = true;
                                        break;
                                    case '🙅‍♀️': userEdit = false;
                                        break;
                                    default: null;
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
                if (!continueEdit) {
                    const continueEditMessage = `Do you want to continue **editing your settings?**\n\n${userDocumentToString(userSettings)}`;
                    continueEdit = await fn.getUserConfirmation(message, continueEditMessage, forceSkip, `Settings: Continue Editing?`, 300000);
                }
            }
            while (continueEdit === true)
            return;
        }
        else return message.channel.send(showUserSettings);
    }
};