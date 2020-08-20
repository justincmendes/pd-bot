const fn = require("../../utilities/functions");
const GuildSettings = require("../database/schemas/guildsettings");
require("dotenv").config();

// Function Declarations and Definitions
function stringContainsItemFromList(string, items) {
    var stringContainsItem = false
    items.forEach(item => {
        if (string.includes(item)) {
            stringContainsItem = true;
        }
    });
    return stringContainsItem;
}
function specialCharacterArrayToList(charArray) {
    var string = "";
    charArray.forEach((character, i) => {
        if (i === charArray.length - 1) {
            string += `**\\${character}**`;
        }
        else {
            string += `**\\${character}**, `;
        }
    });
    return string;
}
function arrayToMultilineList(array) {
    var string = "";
    array.forEach((element) => {
        string += `- ${element}\n`;
    });
    return string;
}

module.exports = {
    name: "prefix",
    description: "See and/or change guild prefix (can change only if owner)",
    aliases: ["p", "pre", "changeprefix", "prefixchange"],
    cooldown: 5,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX) {
        const showCurrentPrefix = `This server's **current prefix** is **${PREFIX}**\nThe server owner can change prefix using: \`${PREFIX}${commandUsed} <NEW_PREFIX>\``;
        if (args[0] === undefined) {
            message.channel.send(showCurrentPrefix);
        }
        else if (args[0].toLowerCase() == "help") {
            message.channel.send(showCurrentPrefix);
        }
        else {
            if (message.author.id === message.guild.owner.id) {
                // Invalid: Includes any markdown to special discord characters, prompt user to try again
                const invalidPrefixes = ['\*', '\_', '\~', '\>', '\\', '\/', '\:', '\`', '\@'];
                const invalidPrefixNames = ["**Asterisks** (\*) : *Italics* and **Bolding**", "**Underscore** (\_) : __Underlining__", "**Tilda** (\~) : ~~Strikethrough~~",
                    "**Right Angle Bracket** (\>) :\n\> Quotation Blocks", "**Backslash** (\\\\) : gives special characters without it's functionality",
                    "**Forward Slash** (\/) : Discord Commands - `/spoiler Don't change your prefix to /`",
                    "**Colon** (\:) : Emoji Matching - `:sunglasses:`", "**Backquote** (\\\`) : `Code Blocks`",
                    `**At Sign** (\@) : Ping Someone - <@${message.author.id}>`];
                const newPrefix = args[0];
                if (stringContainsItemFromList(newPrefix, invalidPrefixes)) {
                    message.channel.send("Sorry that contains a **special character**, please use something else!\n**__Special Characters__**: "
                        + `${specialCharacterArrayToList(invalidPrefixes)}\n${arrayToMultilineList(invalidPrefixNames)}`);
                    return;
                }
                const confirmation = await fn.getUserConfirmation(message, `Are you sure you want to change your guild prefix **${PREFIX}** to **${newPrefix}**?`,
                    fn.getForceSkip(args), "Prefix Change");
                if (confirmation === false) {
                    return;
                }
                const guildConfig = new GuildSettings();
                await guildConfig.collection.findOneAndUpdate({ guildID: message.guild.id }, { $set: { prefix: newPrefix } })
                    .catch(err => console.log(err));
                console.log(`${message.guild.name}'s (${message.guild.id}) prefix was changed to ${newPrefix}`);
                message.reply(`You have successfully **changed ${message.guild.name}'s prefix** from **${PREFIX}** to **${newPrefix}**`
                    + `\nWant to change it back? Try **\`${newPrefix}prefix <NEW_PREFIX>\`**`);
            }
            else {
                message.reply("Sorry, you do not have permission to change the guild prefix.");
            }
        }
    }
};