const Discord = require("discord.js");
const User = require("../database/schemas/user");
const GuildConfig = require("../database/schemas/guildsettings");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();

module.exports = {
    name: "guild",
    description: "Guild Settings/Preferences: Default Timezone, Mastermind Cron/Reset Timing and Roles, Reminders, etc.",
    aliases: ["guilds", "config", "guildconfig", "guildsettings", "guildpreferences"],
    cooldown: 5,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        // Show current guild settings by default
        // If in a DM, show the user the list of mutual guilds and ask which one to see/edit
        // See, Edit
        message.reply("Guild Settings in development!");
    }
};