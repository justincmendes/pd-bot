// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
require("dotenv").config();

const reminderEmbedColour = "#FFFF00";
const reminderType = "Reminder";
const dateAndTimeInstructions = fn.getDateAndTimeInstructions;
const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");

// Function Declarations and Definitions

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
        let reminderUsageMessage = `**USAGE** (One-time Reminder)\n\`${PREFIX}${commandUsed} <DATE/TIME> <CHANNEL> <MESSAGE> <force?>\``
            + `\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<CHANNEL>\`: **dm, #channel_name**"
            + "\n\n\`<MESSAGE>\`: To send at the given time __*(Remember to tag the roles/users you want to ping in the message!)*__"
            + "\n\n\`<ACTION>\`: **see; edit; remove**"
            + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**"
            + `\n\n${dateAndTimeInstructions}`
            + `If you want to set a recurring reminder, try \`${PREFIX}repeat <INTERVAL> <CHANNEL> <MESSAGE> <force?>\` (then you will be prompted for the intended starting <DATE/TIME>)`
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        reminderUsageMessage = fn.getMessageEmbed(reminderUsageMessage, "One-Time Reminder: Help", reminderEmbedColour);
        const reminderHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        var reminderCommand = args[0].toLowerCase();
        if (reminderCommand === "help") {
            return message.channel.send(reminderUsageMessage);
        }
        // Other functions: See, Edit, Remove
        // else if()
        else {

            const splitArgs = this.getReminderSplitArgs(args);
            console.log({ splitArgs });
            if (!splitArgs) return message.reply(reminderHelpMessage);
            else {
                const currentTimestamp = message.createdTimestamp;
                const reminderEndTime = fn.timeCommandHandlerToUTC((["in"]).concat(splitArgs[0].split(' ')), currentTimestamp, userTimezoneOffset, userDaylightSavingSetting)
                    - HOUR_IN_MS * userTimezoneOffset;
                console.log({ reminderEndTime });
                if (!reminderEndTime) return message.reply(`**INVALID Time**... ${reminderHelpMessage}`);
                if (splitArgs[1].toLowerCase() === "dm") {
                    await rm.setNewDMReminder(bot, authorID, currentTimestamp, currentTimestamp,
                        reminderEndTime, splitArgs[2], reminderType);
                }
                else {
                    const channelID = /\<\#(\d+)\>/.exec(splitArgs[1])[1];
                    const userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                    console.log({ userPermissions });
                    if (userPermissions.has("SEND_MESSAGES") && userPermissions.has("VIEW_CHANNEL")) {
                        await rm.setNewChannelReminder(bot, authorID, channelID, currentTimestamp, currentTimestamp,
                            reminderEndTime, splitArgs[2], reminderType);
                    }
                    else return message.reply(`You are **not authorized to send messages** to that channel...`);
                }
                let duration = reminderEndTime - currentTimestamp;
                duration = duration > 0 ? duration : 0;
                return message.reply(`Your **one-time reminder** has been set to trigger in **${fn.millisecondsToTimeString(duration)}!**`);
            }
        }
    },
    getReminderSplitArgs: function (args) {
        args = args.join(" ");
        const splitArgs = /(.+)\s?((?:[Dd][Mm])|(?:\<\#\d+\>))\s?(.+)/.exec(args);
        if (splitArgs) {
            splitArgs.forEach((arg) => {
                if (arg === undefined) return false;
            });
        }
        else return false;
        return splitArgs.slice(1, 4);
    }
};