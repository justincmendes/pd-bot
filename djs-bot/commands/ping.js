const Discord = require("discord.js");
require("dotenv").config();

module.exports.run = async (bot, message, args, PREFIX) => {
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