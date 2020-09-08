// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const getReminderSplitArgs = require("./reminder").getReminderSplitArgs;
require("dotenv").config();

const reminderEmbedColour = "#FFFF00";
const reminderType = "Reminder";
const dateAndTimeInstructions = fn.getDateAndTimeInstructions;
const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");

// Repeating Reminders?
// MAKE function: "repeat" aliases: ["schedule", "sch", "sched", "auto", "ar", "rr", "recur", "recurring"]
// **USAGE**\n\`${PREFIX}${commandUsed} <INTERVAL> <CHANNEL> <MESSAGE> <force?>
// Then prompt for when to start the first one!
// OR
// Add confirmation window to ask if the user wants a repeat! (Recurring Reminder)

// ADD Feature to prevent spam:
// The getUserFirstEndTime must be at least 1 minute from the start time!
// <BLACKLISTING>: Preventing certain roles or certain users from setting repeat reminders
// THAT @MENTION OTHER ROLES! (diffuse their pings)

// For channel reminders, as the user for confirmation when no @mentions are found
// in the message - so that the user is aware that no one will directly be notified!

// STORE the guild with NON-DM Reminders!

// Function Declarations and Definitions
async function getUserEndDuration(message, repeatHelpMessage, userTimezoneOffset, userDaylightSavingSetting, forceSkip) {
    var firstEndTime, error, startTimestamp;
    do {
        error = false;
        const reminderPrompt = "__**When do you intend to start the first recurring reminder?**__"
            + "\n\nType `skip` to **start it now**";
        const userTimeInput = await fn.messageDataCollectFirst(message, reminderPrompt, "Repeat Reminder: First Reminder", reminderEmbedColour);
        startTimestamp = new Date().getTime();
        if (userTimeInput === "skip") firstEndTime = startTimestamp;
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
            if (firstEndTime > startTimestamp) {
                const duration = firstEndTime - startTimestamp;
                const confirmReminder = await fn.getUserConfirmation(message,
                    `Are you sure you want to **start the first reminder** after **${fn.millisecondsToTimeString(duration)}**?`,
                    forceSkip, "Repeat Reminder: First Reminder Confirmation");
                if (confirmReminder) return duration;
            }
            else error = true;
        }
        console.log({ error });
        if (error) fn.sendReplyThenDelete(message, `**Please enter a proper time in the future**... ${repeatHelpMessage} for **valid time inputs!**`, 30000);
    }
    while (true)
}

module.exports = {
    name: "repeat",
    description: "Set a personal or group RECURRING reminder",
    aliases: ["rr", "ar", "recur", "recurring", "schedule", "sch", "sched", "auto"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX, forceSkip) {
        // Variable Declarations and Initializations
        const authorID = message.author.id;
        const userTimezoneOffset = -4;
        const userDaylightSavingSetting = true;
        let repeatUsageMessage = `**USAGE** (Recurring Reminder)\n\`${PREFIX}${commandUsed} <INTERVAL> <CHANNEL> <MESSAGE> <force?>\``
            + `\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<INTERVAL>\`: Time between each reminder, refer to `<DATE/TIME>`"
            + "\n\n\`<CHANNEL>\`: **dm, #channel_name**"
            + "\n\n\`<MESSAGE>\`: To send at the given time __*(Remember to tag the roles/users you want to ping in the message!)*__"
            + "\n\n\`<ACTION>\`: **see; edit; remove**"
            + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**"
            + `\n\n${dateAndTimeInstructions}`
            + `If you want to set a recurring reminder, try \`${PREFIX}repeat <INTERVAL> <CHANNEL> <MESSAGE> <force?>\` (then you will be prompted for the intended starting <DATE/TIME>)`
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        repeatUsageMessage = fn.getMessageEmbed(repeatUsageMessage, "Recurring Reminder: Help", reminderEmbedColour);
        const repeatHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        var reminderCommand = args[0].toLowerCase();
        if (reminderCommand === "help") {
            return message.channel.send(repeatUsageMessage);
        }
        // Other functions: See, Edit, Remove
        // else if()
        else {
            const splitArgs = getReminderSplitArgs(args);
            console.log({ splitArgs });
            if (!splitArgs) return message.reply(repeatHelpMessage);
            else {
                let currentTimestamp = message.createdTimestamp;
                const timeArgs = splitArgs[0].toLowerCase().split(' ');
                const interval = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs,
                    currentTimestamp, userTimezoneOffset, userDaylightSavingSetting)
                    - HOUR_IN_MS * userTimezoneOffset - currentTimestamp;
                if (!interval || interval <= 0) return message.reply(`**INVALID Interval**... ${repeatHelpMessage} for **valid time inputs!**`);
                else if (interval < 60000) return message.reply(`**INVALID Interval**... Interval MUST be **__> 1m__**`);
                let duration = await getUserEndDuration(message, repeatHelpMessage, userTimezoneOffset, userDaylightSavingSetting, forceSkip);
                if (!duration) return;
                else currentTimestamp = new Date().getTime();
                if (splitArgs[1].toLowerCase() === "dm") {
                    await rm.setNewDMReminder(bot, authorID, currentTimestamp, currentTimestamp,
                        currentTimestamp + duration, splitArgs[2], reminderType, false, true, interval);
                }
                else {
                    const channelID = /\<\#(\d+)\>/.exec(splitArgs[1])[1];
                    const userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                    console.log({ userPermissions });
                    if (userPermissions.has("SEND_MESSAGES") && userPermissions.has("VIEW_CHANNEL")) {
                        await rm.setNewChannelReminder(bot, authorID, channelID, currentTimestamp, currentTimestamp,
                            currentTimestamp + duration, splitArgs[2], reminderType, false, true, interval);
                    }
                    else return message.reply(`You are **not authorized to send messages** to that channel...`);
                }
                duration = duration > 0 ? duration : 0;
                return message.reply(`Your **recurring reminder** has been set to trigger in **${fn.millisecondsToTimeString(duration)}!**`);
            }
        }
    }
};