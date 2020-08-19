const Discord = require("discord.js");
const Fast = require("../database/schemas/fasting");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();


module.exports.run = async (bot, message, args, PREFIX) => {
    //see, edit (when edit, show see first then usage),
    message.reply("(User) Settings in development!");
}

module.exports.help = {
    name: "settings",
    alias: ["set", "config"]
}