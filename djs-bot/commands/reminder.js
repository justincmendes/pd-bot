// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();
const goalsEmbedColour = "#0000FF";
const reminderType = "Reminder";

// Function Declarations and Definitions

module.exports = {
    name: "reminder",
    description: "Set personal reminders or group",
    aliases: ["rm", "remindme", "remind", "reminders"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX, forceSkip) {
        // Variable Declarations and Initializations
        let reminderUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <DATE/TIME> <CHANNEL> <MESSAGE> <force?>\``
            + "\n\n\`<DATE/TIME>\`: **any\*\***"
            + "\n\n\`<CHANNEL>\`: **dm, #channel_name**"
            + "\n\n\`<MESSAGE>\`: To send at the given time __*(Remember to tag the roles/users you want to ping in the message!)*__"
            + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        reminderUsageMessage = fn.getMessageEmbed(reminderUsageMessage, "Reminder: Help", goalsEmbedColour);
        const reminderHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        var reminderCommand = args[0].toLowerCase();
        if (reminderCommand === "help") {
            return message.channel.send(reminderUsageMessage);
        }


        // Add confirmation window to ask if the user wants a repeat! (Recurring Reminder)
        // Other functions: Edit, Remove
        // else if()
        else {
            return message.reply(reminderHelpMessage);
        }
    }
};