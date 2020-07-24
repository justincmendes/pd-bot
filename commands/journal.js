const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const mongoose = require("mongoose");
const config = require("../botsettings.json");
const fn = require("../models/functions");

module.exports.run = async (bot, message, args) => {
    //At the end of every week, or when they submit their weekly journal reflection, send them a textfile of their weeks entries (press the paperclip)
    //create, see, edit, end
    message.reply("Journal in development!");
}

module.exports.help = {
    name: "journal"
}