const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const mongoose = require("mongoose");
const config = require("../botsettings.json");
const fn = require("../models/functions");

module.exports.run = async (bot, message, args) => {
    // create, archive, current, see <progress for this habit>, pastweek (as per Sunday reset), past <number>
    // Allow users to check habit ✅, ❌, *SKIP habit if something happends (leave a ➖)
    // Set Habit Description - 50 words or less!
    // LAST Habit check-in time/date

    // Connect with mastermind to be able to make a few weekly goals into a habit (comma separate which goals to transform)
    // FOR SUPER quick and easy habit logging for the week!

    // Currently: will only show 
    message.reply("Habits in development!");
}

module.exports.help = {
    name: "habits",
    aliases: ["habit"]
}