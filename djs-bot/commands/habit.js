const Discord = require("discord.js");
const Habit = require("../database/schemas/habittracker");
const UserSettings = require("../database/schemas/usersettings");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();
const PREFIX = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
    // create, archive, current, see <progress for this habit>, pastweek (as per Sunday reset), past <number>
    // Allow users to check habit ✅, ❌, *SKIP habit if something happends (leave a ➖)
    // Set Habit Description - 50 words or less!
    // LAST Habit check-in time/date

    // When posting or editing habit: Allow them to choose to repost or just edit existing and 
    // Prompt users to strike through their previous number count (for number based habits)!

    // Connect with mastermind to be able to make a few weekly goals into a habit (comma separate which goals to transform)
    // FOR SUPER quick and easy habit logging for the week!

    // Currently: will only show 
    message.reply("Habit in development!");
}

module.exports.help = {
    name: "habit",
    aliases: ["habits"]
}