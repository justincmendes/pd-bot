// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
require("dotenv").config();

const goalsEmbedColour = "#0000FF";
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

function getReminderSplitArgs(args) {
    args = args.join(" ").toLowerCase();
    const splitArgs = /(.+)\s((?:dm)|(?:\<\#\d+\>))\s(.+)/.exec(args);
    if (splitArgs) {
        splitArgs.forEach((arg) => {
            if (arg === undefined) return false;
        });
    }
    return splitArgs.slice(1, 4);
}

module.exports = {
    name: "reminder",
    description: "Set a personal or group SINGLE-USE reminder",
    aliases: ["rm", "remindme", "remind", "reminders"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX, forceSkip) {
        // Variable Declarations and Initializations
        const authorID = message.author.id;
        const userTimezoneOffset = -4;
        const userDaylightSavingSetting = true;
        let reminderUsageMessage = `**USAGE** (Single-use Reminder)\n\`${PREFIX}${commandUsed} <DATE/TIME> <CHANNEL> <MESSAGE> <force?>\``
            + `\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<CHANNEL>\`: **dm, #channel_name**"
            + "\n\n\`<MESSAGE>\`: To send at the given time __*(Remember to tag the roles/users you want to ping in the message!)*__"
            + "\n\n\`<ACTION>\`: **see; edit; remove**"
            + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**"
            + `\n\n${dateAndTimeInstructions}`
            + `If you want to set a recurring reminder, try \`${PREFIX}repeat <INTERVAL> <CHANNEL> <MESSAGE> <force?>\` (then you will be prompted for the intended starting <DATE/TIME>)`
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        reminderUsageMessage = fn.getMessageEmbed(reminderUsageMessage, "Reminder: Help", goalsEmbedColour);
        const reminderHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        var reminderCommand = args[0].toLowerCase();
        if (reminderCommand === "help") {
            return message.channel.send(reminderUsageMessage);
        }
        // Other functions: See, Edit, Remove
        // else if()
        else {

            const splitArgs = getReminderSplitArgs(args);
            console.log({ splitArgs });
            if (!splitArgs) return message.reply(reminderHelpMessage);
            else {
                const currentTimestamp = message.createdTimestamp;
                const reminderEndTime = fn.timeCommandHandlerToUTC((["in"]).concat(splitArgs[0].split(' ')), currentTimestamp, userTimezoneOffset, userDaylightSavingSetting)
                - HOUR_IN_MS * userTimezoneOffset;
                if (!reminderEndTime) return message.reply(`**INVALID Time**... ${reminderHelpMessage}`);
                if (splitArgs[1] === "dm") {
                    await rm.setNewDMReminder(bot, authorID, currentTimestamp, currentTimestamp,
                        reminderEndTime, splitArgs[2], reminderType);
                }
                else {
                    const channelID = /(\<\#(\d+)\>)/.exec(splitArgs[1])[1];
                    await rm.setNewChannelReminder(bot, authorID, channelID, currentTimestamp, currentTimestamp,
                        reminderEndTime, splitArgs[2], reminderType);
                }
            }
        }

    }
};