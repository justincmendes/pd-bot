const fn = require("../../utilities/functions");

module.exports = {
  name: "help",
  description: "Universal Help Command!",
  aliases: ["he", "halp", "how"],
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
    let commandHelpMessage = `**USAGE:**\n\`${PREFIX}<COMMAND>\`\n\n\`<COMMAND>\`: **${bot.commands
      .map((command) => command.name)
      .join("; ")}**\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join(
      "; "
    )}**`;
    commandHelpMessage = fn
      .getMessageEmbed(commandHelpMessage, "PD Bot Help")
      .setFooter(fn.premiumFooterText);
    message.channel.send(commandHelpMessage);
  },
};
