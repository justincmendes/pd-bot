// // Global Variable Declarations and Initializations
// const Discord = require("discord.js");
// const Reminders = require("../database/schemas/reminders");
// const mongoose = require("mongoose");
// const fn = require("../../utilities/functions");
// require("dotenv").config();
// const goalsEmbedColour = "#0000FF";

// // Function Declarations and Definitions

// module.exports = {
//     name: "remindme",
//     description: "Set personal reminders",
//     aliases: ["rm"],
//     cooldown: 5,
//     args: true,
//     run: async function run(bot, message, commandUsed, args, PREFIX, forceSkip) {
//         // Variable Declarations and Initializations
//         // See - with markdown option!
//         let goalsUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\``
//             + "\n\n\`<ACTION>\`: **template/templates/temp/t; see; add; edit; delete/remove; post**"
//             + `\n\n*__ALIASES:__* **${this.name}; ${this.aliases.join('; ')}**`;
//         goalsUsageMessage = fn.getMessageEmbed(goalsUsageMessage, "Goals: Help", goalsEmbedColour);
//         const goalsHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
//         var goalsCommand = args[0].toLowerCase();

//         if (goalsCommand == "help") {
//             message.channel.send(goalsUsageMessage);
//             return;
//         }
//     }
// };