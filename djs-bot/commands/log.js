const Discord = require("discord.js");
const UserSettings = require("../database/schemas/usersettings");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();
const PREFIX = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
// To quickly log some you've completed in an Accountability chat (something that is not a habit!)
// Possible feature

    message.reply("**Log in development!**");
}

module.exports.help = {
    name: "log",
    aliases: ["track", "check"]
}