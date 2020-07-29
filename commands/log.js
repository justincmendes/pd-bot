const Discord = require("discord.js");
const UserSettings = require("../models/usersettings");
const mongoose = require("mongoose");
const fn = require("../utils/functions");
require("dotenv").config();
const prefix = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
// To quickly log some you've completed in an Accountability chat (something that is not a habit!)
// Possible feature

    message.reply("Log in development!");
}

module.exports.help = {
    name: "log",
    aliases: ["track", "check"]
}