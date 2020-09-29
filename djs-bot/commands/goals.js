// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Goals = require("../database/schemas/longtermgoals");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();
const goalsEmbedColour = fn.goalsEmbedColour;

// Function Declarations and Definitions

function goalDocumentToString(goalDocument) {
    const {goal, } = goalDocument;
}

async function getGoalsString(userID) {

}

async function goalDocumentArrayToString(userID, goalDocument) {

}


module.exports = {
    name: "goals",
    description: "Long-term goal setting handler",
    aliases: ["goal", "g"],
    cooldown: 3,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        // Variable Declarations and Initializations
        // See - with markdown option!
        // Edit includes the ability to add
        let goalsUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<ACTION>\`: **start/create; see; edit; delete/remove; post; complete/log/status**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        goalsUsageMessage = fn.getMessageEmbed(goalsUsageMessage, "Goals: Help", goalsEmbedColour);
        const goalsHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        const goalsCommand = args[0].toLowerCase();
        const goalsType = args[1] ? args[1].toLowerCase() : false;

        if (goalsCommand === "help") return message.channel.send(goalsUsageMessage);


        else if (goalsCommand === "start" || goalsCommand === "create" || goalsCommand === "s" || goalsCommand === "set"
            || goalsCommand === "c" || goalsCommand === "make" || goalsCommand === "m") {
            /**
             * Iteratively create new long-term goals until the user is finished!
             * 1. Show their type
             * 2. Add their why
             * 3. 
             */
        }


        else if (goalsCommand === "delete" || goalsCommand === "remove" || goalsCommand === "del" || goalsCommand === "d"
            || goalsCommand === "rem" || goalsCommand === "r") {
            /**
             * Allow them to delete any goals - archived or not
             */
        }


        else if (goalsCommand === "see" || goalsCommand === "show") {

        }


        else if (goalsCommand === "edit" || goalsCommand === "change" || goalsCommand === "ed" || goalsCommand === "e"
            || goalsCommand === "ch" || goalsCommand === "c") {
                
        }


        else if (goalsCommand === "post" || goalsCommand === "p") {

        }


        // Ordered by recency
        else if (goalsCommand === "complete" || goalsCommand === "log" || goalsCommand === "status" || goalsCommand === "check") {

        }
    }
};