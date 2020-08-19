const Discord = require("discord.js");
require("dotenv").config();
const fn = require('../../utilities/functions');

module.exports.run = async (bot, message, args, PREFIX) => {
    let commandHelpMessage = `**USAGE:** \`${PREFIX}<COMMAND>\``
    + "\n\n`<COMMAND>`: **ping, prefix, fast, mastermind, habit, journal, settings**";
    commandHelpMessage = fn.getMessageEmbed(commandHelpMessage, "PD Bot Help");
    message.channel.send(commandHelpMessage);
}

module.exports.help = {
    name: "help"
}