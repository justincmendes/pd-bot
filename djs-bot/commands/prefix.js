const Discord = require("discord.js");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const GuildSettings = require("../database/schemas/guildsettings");
require("dotenv").config();

module.exports.run = async (bot, message, args, PREFIX) => {
    if (args[0] === undefined) {
        message.channel.send(`This server's **current prefix** is **${PREFIX}**\nThe server owner can change prefix using: \`${PREFIX}prefix <NEW_PREFIX>\``);
    }
    else {
        if (message.author.id === message.guild.owner.id) {
            const guildConfig = new GuildSettings();
            const newPrefix = args[0];
            await guildConfig.collection.findOneAndUpdate({ guildID: message.guild.id }, {$set: {prefix: newPrefix }})
                .catch(err => console.log(err));
            console.log(`${message.guild.name}'s (${message.guild.id}) prefix was changed to ${newPrefix}`);
            message.reply(`You have successfully **changed ${message.guild.name}'s prefix** from ${PREFIX} to ${newPrefix}`
            + `\nWant to change it back? Try \`${newPrefix}prefix <NEW_PREFIX>\``);
        }
        else {
            message.reply("Sorry, you do not have permission to do that.");
        }
    }
}

module.exports.help = {
    name: "prefix"
}