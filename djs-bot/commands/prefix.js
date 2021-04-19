const fn = require("../../utilities/functions");
const GuildSettings = require("../database/schemas/guildsettings");
require("dotenv").config();

const invalidPrefixes = fn.invalidPrefixes;
const prefixAliases = ["p", "pre", "changeprefix", "prefixchange"];

// Function Declarations and Definitions
function specialCharacterArrayToList(charArray) {
  var string = "";
  charArray.forEach((character, i) => {
    if (i === charArray.length - 1) {
      string += `**\\${character}**`;
    } else {
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
  aliases: prefixAliases,
  cooldown: 3.5,
  args: false,
  run: async function run(
    bot,
    message,
    commandUsed,
    args,
    PREFIX,
    timezoneOffset,
    daylightSavings,
    forceSkip
  ) {
    const showCurrentPrefix = `This server's **current prefix** is **${PREFIX}**\nThe server owner can change prefix using: \`${PREFIX}${commandUsed} <NEW_PREFIX>\``;
    if (args[0] === undefined) {
      message.channel.send(showCurrentPrefix);
    } else if (args[0].toLowerCase() == "help") {
      message.channel.send(
        `${showCurrentPrefix}\n__*ALIASES:*__ **${
          this.name
        } - ${this.aliases.join("; ")}**`
      );
    } else {
      if (message.author.id === message.guild.owner.id) {
        // Invalid: Includes any markdown to special discord characters, prompt user to try again
        const invalidPrefixNames = [
          "**Asterisks** (*****) : *Italics* and **Bolding**",
          "**Underscore** (**_**) : __Underlining__",
          "**Tilda** (**~**) : ~~Strikethrough~~",
          "**Right Angle Bracket** (**>**) :\n> Quotation Blocks",
          "**Backslash** (**\\\\**) : gives special characters without it's functionality",
          "**Forward Slash** (**/**) : Discord Commands - /spoiler|| Don't change your prefix to /||",
          "**Colon** (**:**) : Emoji Matching - `:sunglasses:`",
          "**Backquote** (\\`) : `Code Blocks`",
          `**At Sign** (**\@**) : Ping Someone - <@${message.author.id}>`,
        ];
        const newPrefix = args[0];
        const markdownRegex = /[\*\_\~\>\\\/\:\`\@]+/;
        const isInvalidPrefix = markdownRegex.test(newPrefix);
        if (isInvalidPrefix) {
          fn.sendMessageThenDelete(
            message,
            `Sorry that contains a **special character**, please use something else!\n**__Special Characters__**: ${specialCharacterArrayToList(
              invalidPrefixes
            )}\n${arrayToMultilineList(invalidPrefixNames)}`,
            600000
          );
          return false;
        }
        const confirmation = await fn.getUserConfirmation(
          bot,
          message.author.id,
          message.channel.id,
          PREFIX,
          `Are you sure you want to change your **guild prefix ${PREFIX}** to **${newPrefix}**?`,
          forceSkip,
          "Prefix Change"
        );
        if (confirmation === false) return false;
        await GuildSettings.findOneAndUpdate(
          { guildID: message.guild.id },
          { $set: { prefix: newPrefix } }
        ).catch((err) => console.log(err));
        console.log(
          `${message.guild.name}'s (${message.guild.id}) prefix was changed to ${newPrefix}`
        );
        if (
          prefixAliases.includes(commandUsed.toLowerCase()) ||
          this.name === commandUsed.toLowerCase()
        ) {
          message.reply(
            `You have successfully **changed ${message.guild.name}'s prefix** from **${PREFIX}** to **${newPrefix}**\nWant to change it back? Try **\`${newPrefix}prefix <NEW_PREFIX>\`**`
          );
        }
        return true;
      } else {
        message.reply(
          "Sorry, you do not have permission to change the **guild prefix.**"
        );
        return false;
      }
    }
  },
};
