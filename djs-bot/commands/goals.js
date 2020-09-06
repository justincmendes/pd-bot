// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Goals = require("../database/schemas/longtermgoals");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();
const goalsEmbedColour = "#0000FF";

// Function Declarations and Definitions

module.exports = {
    name: "goals",
    description: "Long-term goal setting handler",
    aliases: ["goal", "g"],
    cooldown: 3,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX, forceSkip) {
        // Variable Declarations and Initializations
        // See - with markdown option!
        let goalsUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<ACTION>\`: **template/templates/temp/t; see; add; edit; delete/remove; post**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        goalsUsageMessage = fn.getMessageEmbed(goalsUsageMessage, "Goals: Help", goalsEmbedColour);
        const goalsHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        var goalsCommand = args[0].toLowerCase();

        if (goalsCommand == "help") {
            message.channel.send(goalsUsageMessage);
            return;
        }
    }
};