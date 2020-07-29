const Discord = require("discord.js");
const mongoose = require("mongoose");
const fn = require("../utils/functions");
require("dotenv").config();
const prefix = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
    message.channel.send(`This server's **current prefix** is **${prefix}**\n(SOON server managers can change prefix by: \`${prefix}prefix <PREFIX>\`)`);
    // Will check if the user sending the message has the MANAGE_GUILD permission
    // Use collection guildprefix.js to store the prefix of the current guild
    // Alter code to make it run with the new prefix (i.e. check what the prefix is of the current guild in the bot.js file
    // Change botsettings.json accordingly
    // Add const prefix to every new function made, if they don't have a database use ? by default!
}

module.exports.help = {
    name: "prefix"
}