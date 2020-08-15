const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const mongoose = require("mongoose");
const fn = require("../utils/functions");
require("dotenv").config();


module.exports.run = async (bot, message, args) => {
    //see, edit (when edit, show see first then usage),
    message.reply("(User) Settings in development!");
}

module.exports.help = {
    name: "settings",
    alias: ["set", "config"]
}