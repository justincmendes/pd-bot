const Discord = require("discord.js");
require("dotenv").config();
const PREFIX = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
    const commandHelpMessage = `**USAGE:** \`${PREFIX}<COMMAND>\``
    + "\n\n`<COMMAND>`: **ping, prefix, fast, mastermind, habit, journal, settings**"
    message.channel.send(commandHelpMessage);
}

module.exports.help = {
    name: "help"
}