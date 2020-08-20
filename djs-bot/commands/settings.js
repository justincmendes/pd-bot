const Discord = require("discord.js");
const Fast = require("../database/schemas/fasting");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();

module.exports = {
    name: "settings",
    description: "User Settings/Preferences: Timezone, reminders, etc.",
    aliases: ["setting", "set", "config", "s", "preferences"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX, forceSkip) {
        //see, edit (when edit, show see first then usage),
        message.reply("User Settings in development!");
    }
};