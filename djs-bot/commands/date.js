const fn = require("../../utilities/functions");

const dateAndTimeInstructions = fn.dateAndTimeInstructions;

module.exports = {
  name: "date",
  description: "Date and Time Instructions",
  aliases: ["datetime", "time", "dateandtime"],
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
    message.channel.send(
      fn.getMessageEmbed(dateAndTimeInstructions, "Date and Time Instructions")
    );
  },
};
