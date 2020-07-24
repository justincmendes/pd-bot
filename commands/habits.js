const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const mongoose = require("mongoose");
const config = require("../botsettings.json");
const fn = require("../models/functions");

module.exports.run = async (bot, message, args) => {
    //create, archive, current, see <progress for this habit>, pastweek (as per Sunday reset), past <number>
    message.reply("Habits in development!");
}

module.exports.help = {
    name: "habits",
    aliases: ["habit"]
}