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

// Function Declarations and Definitions
async function getUserFirstEndTime(message, repeatHelpMessage, userTimezoneOffset, userDaylightSavingSetting, forceSkip) {
    const startTimestamp = new Date().getTime();
    var firstEndTime;
    var error = false;
    do {
        const reminderPrompt = "__**When do you intend to start the first recurring reminder?**__"
            + "\n\nType `skip` to **start it now**";
        const userTimeInput = await fn.messageDataCollectFirst(message, reminderPrompt, "Repeat Reminder: First Reminder", reminderEmbedColour);
        if (userTimeInput === "skip") firstEndTime = startTimestamp;
        else {
            if (userTimeInput === "stop" || userTimeInput === false) return false;
            // Undo the timezoneOffset to get the end time in UTC
            firstEndTime = fn.timeCommandHandlerToUTC(["in"].concat(userTimeInput.toLowerCase().split(/[\s\n]+/)), startTimestamp,
                userTimezoneOffset, userDaylightSavingSetting) - HOUR_IN_MS * userTimezoneOffset;
            if (!firstEndTime) error = true;
        }
        if (!error) {
            if (firstEndTime + 60000 > startTimestamp) {
                const confirmReminder = await fn.getUserConfirmation(message,
                    `Are you sure you want to **start the first reminder** at **${fn.timestampToDateString(firstEndTime + HOUR_IN_MS * userTimezoneOffset)}**?`,
                    forceSkip, "Repeat Reminder: First Reminder Confirmation");
                if (confirmReminder) return firstEndTime;
            }
            else error = true;
        }
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
                const currentTimestamp = message.createdTimestamp;
                const interval = fn.timeCommandHandlerToUTC((["in"]).concat(splitArgs[0].split(' ')), currentTimestamp, userTimezoneOffset, userDaylightSavingSetting)
                    - HOUR_IN_MS * userTimezoneOffset - currentTimestamp;
                if (!interval || interval <= 0) return message.reply(`**INVALID Interval**... ${repeatHelpMessage} for **valid time inputs!**`);
                const firstEndTime = await getUserFirstEndTime(message, repeatHelpMessage, currentTimestamp, userTimezoneOffset, userDaylightSavingSetting, forceSkip);
                if (!firstEndTime) return;
                if (splitArgs[1].toLowerCase() === "dm") {
                    await rm.setNewDMReminder(bot, authorID, currentTimestamp, currentTimestamp,
                        firstEndTime, splitArgs[2], reminderType, false, true, interval);
                }
                else {
                    const channelID = /\<\#(\d+)\>/.exec(splitArgs[1])[1];
                    const userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                    console.log({ userPermissions });
                    if (userPermissions.has("SEND_MESSAGES") && userPermissions.has("VIEW_CHANNEL")) {
                        await rm.setNewChannelReminder(bot, authorID, channelID, currentTimestamp, currentTimestamp,
                            firstEndTime, splitArgs[2], reminderType, false, true, interval);
                    }
                    else return message.reply(`You are **not authorized to send messages** to that channel...`);
                }
                let duration = interval - currentTimestamp;
                duration = duration > 0 ? duration : 0;
                return message.reply(`Your **recurring reminder** has been set to trigger in **${fn.millisecondsToTimeString(duration)}!**`);
            }
        }
    }
};