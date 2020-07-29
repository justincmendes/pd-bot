const Discord = require("discord.js");

module.exports.run = async (bot, message, args) => {
    message.channel.send("**USAGE:** `?<COMMAND>`"
    + "\n\n`<COMMAND>`: **ping, prefix, fast, mastermind, habit, journal, settings**");
}

module.exports.help = {
    name: "help"
}