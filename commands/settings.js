const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const mongoose = require("mongoose");
const config = require("../botsettings.json");
const fn = require("../models/functions");

module.exports.run = async (bot, message, args) => {
    //see, edit (when edit, show see first then usage),
    message.reply("Settings in development!");
}

module.exports.help = {
    name: "settings"
}