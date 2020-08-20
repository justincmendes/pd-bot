// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Goals = require("../database/schemas/longtermgoals");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();
const goalsEmbedColour = "#0000FF";

// Function Declarations and Definitions

module.exports.run = async (bot, message, args, PREFIX) => {
    // Variable Declarations and Initializations
    // See - with markdown option!
    let goalsUsageMessage = `**USAGE**\n\`${PREFIX}goals <ACTION>\``
        + "\n\n\`<ACTION>\`: **template/templates/temp/t; see; add; edit; delete/remove; post**";
    goalsUsageMessage = fn.getMessageEmbed(goalsUsageMessage, "Goals: Help", goalsEmbedColour);
    const goalsHelpMessage = `Try \`${PREFIX}goals help\``;
    const forceSkip = fn.getForceSkip(args);
    var goalsCommand = args[0];

    // Before declaration of more variables - check if the user has any arguments
    if (goalsCommand === undefined || args.length == 0) {
        message.reply(goalsHelpMessage);
        return;
    }
    else {
        goalsCommand = goalsCommand.toLowerCase();
    }
    


    if (goalsCommand == "help") {
        message.channel.send(goalsUsageMessage);
        return;
    }


}

module.exports.help = {
    name: "goals",
    aliases: ["goal", "g"]
}