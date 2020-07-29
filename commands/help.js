const Discord = require("discord.js");
require("dotenv").config();
const prefix = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
    message.channel.send(`**USAGE:** \`${prefix}<COMMAND>\``
    + "\n\n`<COMMAND>`: **ping, prefix, fast, mastermind, habit, journal, settings**");
}

module.exports.help = {
    name: "help"
}