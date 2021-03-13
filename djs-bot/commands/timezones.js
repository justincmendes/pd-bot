// Create a simple command displaying all of the valid timezone inputs - similar to date.js
// And add this instruction to the places in code where appropriate

// Show all of the options as an abbreviation (and the corresponding UTC offset + Location)
// Show examples for the format of numerical entries i.e. +4:00, -9, +12:45, ... along with the boundaries of these entries
// FUTURE: Show the options for the full written form: i.e. Africa/Abidjan, Canada/Central, ...

const fn = require("../../utilities/functions");
const timezoneInstructions = fn.timezoneInstructions;

module.exports = {
  name: "timezones",
  description: "Timezone Instructions",
  aliases: ["timezone", "tz"],
  cooldown: 5,
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
    await fn.sendPaginationEmbed(
      bot,
      message.channel.id,
      message.author.id,
      fn.getEmbedArray(timezoneInstructions, "Timezone Instructions"),
      true
    );
    return;
  },
};
