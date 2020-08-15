const Discord = require("discord.js");
require("dotenv").config();
const PREFIX = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
    //Show time between user command and bot reply = ping time!
    let pingTime = message.createdTimestamp;
    let pingMessage = await message.channel.send("Pong!");
    let botSendTime = pingMessage.createdTimestamp;
    pingTime = botSendTime - pingTime;
    pingMessage.edit(`Pong! \`${pingTime}ms\``).catch(console.error);
}

module.exports.help = {
    name: "ping"
}