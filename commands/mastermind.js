const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const mongoose = require("mongoose");
const config = require("../botsettings.json");
const fn = require("../models/functions");

module.exports.run = async (bot, message, args) => {
    // Will allow for text collection of notes during meeting and output it in a nice format!
    // Allow users with the "mastermind" (captain) role to press the pencil and edit the sent message!
    // Collect 1 message per user and put it beside their tag!

    // Will allow users to add their own to the mastermind week's message and handle multiple people
    // Adding their own edits at the same time.
    message.reply("Mastermind in development!");
}

module.exports.help = {
    name: "mastermind"
}