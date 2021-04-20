/**
 * @author Justin Mendes
 * @license MIT
 * Date Created: July 18, 2020
 * Last Updated: April 18, 2021
 */

// To keep the sensitive information to be stored in a separate folder
// and allow for environment variables when hosting
require("dotenv").config();
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.DASHBOARD_CLIENT_ID;
const DEFAULT_PREFIX = "?";
const Discord = require("discord.js");
const bot = new Discord.Client({
  partials: ["MESSAGE", "CHANNEL", "REACTION"],
  ws: { intents: Discord.Intents.PRIVILEDGED },
});
const ic = require("../utilities/interactions");
const sd = require("../utilities/send");
const fn = require("../utilities/functions");
const rm = require("../utilities/reminder");
const hb = require("../utilities/habit");
const tr = require("../utilities/track");
const gu = require("../utilities/guild");
const fs = require("fs");
bot.commands = new Discord.Collection();
const cooldowns = new Discord.Collection();
const spamRecords = new Discord.Collection();

const mongoose = require("mongoose");
const Guild = require("./database/schemas/guildsettings");
const User = require("./database/schemas/user");
const Reminder = require("./database/schemas/reminder");
const Habit = require("./database/schemas/habit");
const Log = require("./database/schemas/habittracker");
const Track = require("./database/schemas/track");
bot.mongoose = require("../utilities/mongoose");

const pdBotTag = `<@!${CLIENT_ID}>`;
const timeoutDurations = [60000, 180000, 540000, 900000]; // in ms, max level: 4
const COMMAND_SPAM_NUMBER = 15;
const CLOSE_COMMAND_SPAM_NUMBER = fn.CLOSE_COMMAND_SPAM_NUMBER;
const REFRESH_SPAM_DELAY = fn.REFRESH_COMMAND_SPAM_DELAY;
const CLOSE_COMMAND_DELAY = fn.CLOSE_COMMAND_DELAY;

const validTypes = fn.reminderTypes;

// Function Definitions
/**
 * Parsing options into key-value args:
 */
const createArgs = (options) => {
  if (!options) return;
  var args = {};
  // console.log({ options });
  for (const option of options) {
    // console.log({ option });
    addArg(args, option);
    const subCommandOptions = option.options;
    // console.log({ subCommandOptions });
    if (subCommandOptions && subCommandOptions.length) {
      for (const subCommandOption of subCommandOptions) {
        // console.log({ subCommandOption });
        addArg(args, subCommandOption);
        const subCommandGroupOptions = subCommandOption.options;
        // console.log({ subCommandGroupOptions });
        if (subCommandGroupOptions && subCommandGroupOptions.length) {
          for (const subGroupOption of subCommandGroupOptions) {
            // console.log({ subGroupOption });
            addArg(args, subGroupOption);
          }
        }
      }
    }
  }
  return args;
};

/**
 * Add new key-value pair to an object.
 * - originalArgs, passed by reference.
 */
const addArg = (originalArgs, option) => {
  if (!option || !option.type) return false;
  const { type, name, value } = option;
  if (type !== 1 && type !== 2) {
    originalArgs[fn.snakeCaseToCamelCase(name)] = value;
  } else if (name) {
    if (type === 1) {
      originalArgs["subCommand"] = name;
    } else if (type === 2) {
      originalArgs["subCommandGroup"] = name;
    }
  }
  return true;
};

const getApp = (guildID) => {
  const app = bot.api.applications(bot.user.id);
  if (guildID) {
    app.guilds(guildID);
  }
  return app;
};

const getSpamMessage = (timeoutInMinutes) => {
  return `**Please don't spam me 🥺**, I will have to stop responding to your commands for at least **__${timeoutInMinutes} minute(s)__.**`;
};

const getCooldownMessage = (secondsLeft, commandName) => {
  return `Please **wait ${
    secondsLeft || secondsLeft === 0 ? secondsLeft.toFixed(1) : "a few"
  } more second(s)** before reusing the **\`${commandName}\` command**`;
};

const getPrefix = async (channelType, guildID = undefined) => {
  var PREFIX = DEFAULT_PREFIX;
  if (channelType !== "dm") {
    if (!guildID) return PREFIX;
    const guildSettings = await Guild.findOne({ guildID });
    PREFIX = (guildSettings && guildSettings.prefix) || DEFAULT_PREFIX;
  }
  return PREFIX;
};

const isPrefixedCommandCall = (string, PREFIX) => {
  const startsWithPrefix = string.startsWith(PREFIX);
  const isMention = string.startsWith(pdBotTag);
  return startsWithPrefix || isMention;
};

const checkSpam = async (userID, createdTimestamp) => {
  const spamDetails = spamRecords.get(userID);
  if (spamDetails) {
    spamDetails.messageCount++;
    const messageSendDelay =
      createdTimestamp - (spamDetails.lastTimestamp || 0);
    spamDetails.lastTimestamp = createdTimestamp;
    if (messageSendDelay < CLOSE_COMMAND_DELAY) {
      spamDetails.closeMessageCount++;
    }
    if (
      spamDetails.closeMessageCount >= CLOSE_COMMAND_SPAM_NUMBER ||
      spamDetails.messageCount >= COMMAND_SPAM_NUMBER
    ) {
      const timeout =
        timeoutDurations[spamDetails.timeoutLevel - 1] ||
        fn.getTimeScaleToMultiplyInMs("minute");
      spamDetails.isRateLimited = true;
      setTimeout(() => {
        if (spamDetails) {
          spamDetails.closeMessageCount = 0;
          spamDetails.messageCount = 1;
          spamDetails.isRateLimited = false;
          if (spamDetails.timeoutLevel < 4) spamDetails.timeoutLevel++;
        }
      }, timeout);
      return {
        isSpamming: true,
        timeoutMinutes: timeout / fn.getTimeScaleToMultiplyInMs("minute"),
      };
    }
    if (spamDetails.messageCount === 2) {
      setTimeout(() => {
        if (spamDetails) {
          spamDetails.messageCount = 1;
          spamDetails.closeMessageCount = 0;
        }
      }, REFRESH_SPAM_DELAY);
    }
  } else {
    setTimeout(() => {
      if (spamDetails.isRateLimited) {
        setTimeout(() => {
          spamRecords.delete(userID);
        }, (timeoutDurations[spamDetails.timeoutLevel - 1] || fn.getTimeScaleToMultiplyInMs("minute")) + fn.getTimeScaleToMultiplyInMs("hour") * 4);
      } else spamRecords.delete(userID);
    }, fn.getTimeScaleToMultiplyInMs("day") / 2);
    spamRecords.set(userID, {
      lastTimestamp: createdTimestamp,
      messageCount: 1,
      closeMessageCount: 0,
      isRateLimited: false,
      timeoutLevel: 1,
    });
  }
  return {
    isSpamming: false,
  };
};

const cooldownCheck = async (userID, command) => {
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Discord.Collection());
  }
  const now = Date.now();
  const cooldownUsers = cooldowns.get(command.name);
  const cooldownAmount = command.cooldown * 1000;
  if (cooldownUsers.has(userID)) {
    const cooldownDetails = cooldownUsers.get(userID);
    if (cooldownDetails.sentCooldownMessage === false) {
      const expirationTime = cooldownDetails.endTime + cooldownAmount;
      if (now < expirationTime) {
        const secondsLeft = (expirationTime - now) / 1000;
        if (cooldownUsers.has(userID)) {
          cooldownDetails.sentCooldownMessage = true;
        }
        return {
          onCooldown: true,
          secondsLeft,
        };
      }
    }
    return {
      onCooldown: true,
      sentCooldownMessage: cooldownDetails.sentCooldownMessage,
    };
  } else {
    cooldownUsers.set(userID, {
      endTime: now,
      sentCooldownMessage: false,
    });
    setTimeout(() => cooldownUsers.delete(userID), cooldownAmount);
  }
  return {
    onCooldown: false,
  };
};

// File Reader Output
fs.readdir("./djs-bot/commands", (err, files) => {
  //! This (err) shouldn't happen, this would be on Node.js
  if (err) console.error(err);

  //to get the file extension .js
  let jsFiles = files.filter((file) => file.split(".").pop() === "js");
  if (jsFiles.length <= 0) {
    return console.log("No commands to load!");
  }

  console.log(`Loading ${jsFiles.length} commands!`);

  jsFiles.forEach((file, i) => {
    let props = require(`./commands/${file}`);
    console.log(`${i + 1}: ${file} loaded`);
    bot.commands.set(props.name, props);
  });
});

bot.mongoose.init();

bot.on("ready", async () => {
  const userCount = await User.find({})
    .countDocuments()
    .catch((err) => console.error(err));
  console.log(`${bot.user.username} is now online!`);

  bot.user.setActivity(`${userCount ? userCount : "you"} thrive! | ?help`, {
    type: "WATCHING",
  });

  // const collectedMessage = await fn.messageDataCollect(
  //   bot,
  //   "746119608271896598",
  //   "736750420625457216",
  //   "?",
  //   "Enter something, make sure to test if it listens to when you start up another command or interaction!",
  //   "Testing Message Collection"
  // );
  // console.log({ collectedMessage });

  // const collectedReaction = await fn.reactionDataCollect(
  //   bot,
  //   "746119608271896598",
  //   "736750420625457216",
  //   "Enter an emoji reactions!",
  //   ["😀", "😎", "😂", "😃", "😄"],
  //   "Testing Reaction Collection"
  // );
  // console.log({ collectedReaction });

  //* Show Current Slash Commands in Guild
  // const commands = await getApp("736750419170164800").commands.get();
  // console.log({ commands });

  //* Sample Slash Command (from guild) Deletion!
  // await getApp("736750419170164800").commands("832857900954681344").delete();
  // await getApp(<GUILD_ID>).commands(<COMMAND_ID>).delete();

  //* Reminder Command:
  // await getApp().commands.post({
  //   data: {
  //     name: "reminder",
  //     description: "Set a channel or DM one-time reminder",
  //     options: [
  //       {
  //         name: "set",
  //         description: "Create/Set a reminder",
  //         type: 2,
  //         options: [
  //           {
  //             name: "dm",
  //             description: "Set a DM Reminder",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "when",
  //                 description:
  //                   "Enter the date/time of when you want this reminder to be triggered.",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "message",
  //                 description: "Enter the message of this reminder.",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "embed",
  //                 description:
  //                   "Send this reminder as an embed message. (Default: True)",
  //                 required: false,
  //                 type: 5,
  //               },
  //             ],
  //           },
  //           {
  //             name: "channel",
  //             description: "Set a channel Reminder",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "channel",
  //                 description:
  //                   "Enter the text channel you'd like to send this reminder to",
  //                 required: true,
  //                 type: 7,
  //               },
  //               {
  //                 name: "when",
  //                 description:
  //                   "Enter date/time of when you want this reminder to be triggered",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "message",
  //                 description:
  //                   "Enter the reminder message. (Remember to @mention the roles/users you want to ping/notify!)",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "embed",
  //                 description:
  //                   "Send this reminder as an embed message. NOTE: No pings will trigger if true! (Default: False)",
  //                 required: false,
  //                 type: 5,
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //       {
  //         name: "edit",
  //         description: "Edit a reminder",
  //         type: 2,
  //         options: [
  //           {
  //             name: "type",
  //             description:
  //               "Change the type of your reminder (e.g. Habit to Regular Reminder)",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the type for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "type",
  //                 description:
  //                   "Enter the type of reminder you'd like to change this reminder to.",
  //                 required: true,
  //                 type: 3,
  //                 choices: validTypes.map((type) => {
  //                   return { name: type, value: type };
  //                 }),
  //               },
  //             ],
  //           },
  //           {
  //             name: "channel",
  //             description:
  //               "Change your reminder's destination to a channel of your choice.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "channel",
  //                 description:
  //                   "Enter the text channel you'd like to send this reminder to",
  //                 required: true,
  //                 type: 7,
  //               },
  //             ],
  //           },
  //           {
  //             name: "dm",
  //             description:
  //               "Change your reminder's destination to your direct messages.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //             ],
  //           },
  //           {
  //             name: "time_created",
  //             description:
  //               "Change the date/time of when your reminder was created.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "when",
  //                 description:
  //                   "Enter date/time of when you created this reminder.",
  //                 required: true,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "trigger_time",
  //             description:
  //               "Change the date/time of when you want your reminder to be sent.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "when",
  //                 description:
  //                   "Enter date/time of when you want this reminder to send.",
  //                 required: true,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "message",
  //             description: "Change the message of your reminder.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "message",
  //                 description:
  //                   'Enter the message you want to be sent. If reminder type is not "reminder," this edit will be lost.',
  //                 required: true,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "repeat",
  //             description:
  //               "Convert your reminder into a recurring/repeating reminder.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the repetition for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "interval",
  //                 description:
  //                   "Enter the time duration you want between each reminder.",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "repetitions",
  //                 description:
  //                   "How many times do you want to get this reminder? Enter 0 for default. (Default: Indefinitely)",
  //                 required: false,
  //                 type: 4,
  //               },
  //               {
  //                 name: "next",
  //                 description:
  //                   "Update your reminder trigger time. Enter the date/time of when you want to send your next reminder.",
  //                 required: false,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "embed",
  //             description:
  //               "Change whether your reminder gets sent as an embed or plain text.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the embed setting for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "embed",
  //                 description:
  //                   "Send this reminder as an embed message. NOTE: No pings will trigger if true for a channel reminder!",
  //                 required: false,
  //                 type: 5,
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // });

  //* Recurring Reminder (Repeat) Command:
  // await getApp().commands.post({
  //   data: {
  //     name: "recurringreminder",
  //     description: "Set a channel or DM repeating/recurring reminder",
  //     options: [
  //       {
  //         name: "set",
  //         description: "Create/Set a recurring reminder",
  //         type: 2,
  //         options: [
  //           {
  //             name: "dm",
  //             description: "Set a DM Recurring Reminder",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "when",
  //                 description:
  //                   "Enter the date/time of when you want this reminder to be triggered.",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "interval",
  //                 description:
  //                   "Enter the duration of time you want between each recurring reminder.",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "message",
  //                 description: "Enter the message of this reminder.",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "repetitions",
  //                 description:
  //                   "How many times do you want to get this reminder? Enter 0 for default. (Default: Indefinitely)",
  //                 required: false,
  //                 type: 4,
  //               },
  //               {
  //                 name: "embed",
  //                 description:
  //                   "Send this reminder as an embed message. (Default: True)",
  //                 required: false,
  //                 type: 5,
  //               },
  //             ],
  //           },
  //           {
  //             name: "channel",
  //             description: "Set a channel Recurring Reminder",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "channel",
  //                 description:
  //                   "Enter the text channel you'd like to send this reminder to",
  //                 required: true,
  //                 type: 7,
  //               },
  //               {
  //                 name: "when",
  //                 description:
  //                   "Enter date/time of when you want this reminder to be triggered",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "interval",
  //                 description:
  //                   "Enter the duration of time you want between each recurring reminder.",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "message",
  //                 description:
  //                   "Enter the reminder message. (Remember to @mention the roles/users you want to ping/notify!)",
  //                 required: true,
  //                 type: 3,
  //               },
  //               {
  //                 name: "repetitions",
  //                 description:
  //                   "How many times do you want to get this reminder? Enter 0 for default. (Default: Indefinitely)",
  //                 required: false,
  //                 type: 4,
  //               },
  //               {
  //                 name: "embed",
  //                 description:
  //                   "Send this reminder as an embed message. NOTE: No pings will trigger if true! (Default: False)",
  //                 required: false,
  //                 type: 5,
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //       {
  //         name: "edit",
  //         description: "Edit a repeating/recurring reminder",
  //         type: 2,
  //         options: [
  //           {
  //             name: "type",
  //             description:
  //               "Change the type of your reminder (e.g. Habit to Regular Reminder)",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the type for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "type",
  //                 description:
  //                   "Enter the type of reminder you'd like to change this reminder to.",
  //                 required: true,
  //                 type: 3,
  //                 choices: validTypes.map((type) => {
  //                   return { name: type, value: type };
  //                 }),
  //               },
  //             ],
  //           },
  //           {
  //             name: "channel",
  //             description:
  //               "Change your reminder's destination to a channel of your choice.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "channel",
  //                 description:
  //                   "Enter the text channel you'd like to send this reminder to",
  //                 required: true,
  //                 type: 7,
  //               },
  //             ],
  //           },
  //           {
  //             name: "dm",
  //             description:
  //               "Change your reminder's destination to your direct messages.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //             ],
  //           },
  //           {
  //             name: "time_created",
  //             description:
  //               "Change the date/time of when your reminder was created.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "when",
  //                 description:
  //                   "Enter date/time of when you created this reminder.",
  //                 required: true,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "trigger_time",
  //             description:
  //               "Change the date/time of when you want your reminder to be sent.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "when",
  //                 description:
  //                   "Enter date/time of when you want this reminder to send.",
  //                 required: true,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "message",
  //             description: "Change the message of your reminder.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the channel for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "message",
  //                 description:
  //                   'Enter the message you want to be sent. If reminder type is not "reminder," this edit will be lost.',
  //                 required: true,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "one-time",
  //             description: "Convert your reminder into a one-time reminder.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to make a one-time reminder.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "next",
  //                 description:
  //                   "Update your reminder trigger time. Enter the date/time of when you want to send your next reminder.",
  //                 required: false,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "interval",
  //             description:
  //               "Change the time duration between your repeating/recurring reminder.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the interval for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "interval",
  //                 description:
  //                   "Enter the duration of time you want between each recurring reminder.",
  //                 required: true,
  //                 type: 3,
  //               },
  //             ],
  //           },
  //           {
  //             name: "repetitions",
  //             description: "Change the number of reminders you want.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the interval for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "repetitions",
  //                 description:
  //                   "How many times do you want to get this reminder? Enter 0 for default. (Default: Indefinitely)",
  //                 required: true,
  //                 type: 4,
  //               },
  //             ],
  //           },
  //           {
  //             name: "embed",
  //             description:
  //               "Change whether your reminder gets sent as an embed or plain text.",
  //             type: 1,
  //             options: [
  //               {
  //                 name: "index",
  //                 description:
  //                   "Enter the number of the reminder you'd like to edit the embed setting for.",
  //                 required: true,
  //                 type: 4,
  //               },
  //               {
  //                 name: "embed",
  //                 description:
  //                   "Send this reminder as an embed message. NOTE: No pings will trigger if true for a channel reminder!",
  //                 required: false,
  //                 type: 5,
  //               },
  //             ],
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // });

  //* Sample Command: Ping
  // await getApp("736750419170164800").commands.post({
  //   data: {
  //     name: 'ping',
  //     description: 'A simple ping pong commands',
  //   },
  // });

  //* Sample Command With Options/Args
  // await getApp("736750419170164800").commands.post({
  //   data: {
  //     name: "new",
  //     description: "A new command",
  //     options: [
  //       {
  //         name: "Name",
  //         description: "Your Name",
  //         required: true,
  //         type: 3,
  //       },
  //       {
  //         name: "Age",
  //         description: "Your Age",
  //         required: false,
  //         type: 4,
  //       },
  //       {
  //         name: "Channel",
  //         description: "Enter the channel you'd like to send this reminder to!",
  //         required: false,
  //         type: 7,
  //       },
  //     ],
  //   },
  // });

  /**
   * * Slash Command Event Listener (Websocket)
   */
  bot.ws.on("INTERACTION_CREATE", async (interaction) => {
    console.log({ interaction });
    const { name, options } = interaction.data;
    // console.log({ options });

    // Parsing options into key-value args:
    let args = createArgs(options);
    const commandName = name.toLowerCase();
    args = { commandName, ...args };
    console.log({ args });

    const command = bot.commands.get(commandName);
    if (!command) return;

    const userID = interaction.guild_id
      ? interaction.member.user.id
      : interaction.user.id;

    // Spam Prevention:
    const updatedSpamCheck = await checkSpam(userID, Date.now());
    if (updatedSpamCheck && updatedSpamCheck.isSpamming) {
      // const userDM = bot.users.cache.get(userID);
      await ic.reply(
        bot,
        interaction,
        getSpamMessage(updatedSpamCheck.timeoutMinutes),
        true
      );
      return;
    }

    // Cooldowns:
    const cooldown = await cooldownCheck(userID, commandName);
    if (cooldown && cooldown.onCooldown) {
      await ic.reply(
        bot,
        interaction,
        getCooldownMessage(cooldown.secondsLeft, commandName),
        true,
        cooldown.secondsLeft * 1000
      );
    }

    // Check if PD Bot is already awaiting a response from the user. If yes, cancel the await and send a response that there is an await.
    const userAwait = fn.getUserAwait(userID);
    if (userAwait) {
      if (userAwait.channel && userAwait.channel !== userID) {
        await sd.sendMessage(
          bot,
          userAwait.channel,
          `Any **command calls** while I am listening to your response will automatically **stop** the listening.\n**__Command Used:__** ${commandName}`
        );
      }
      fn.cancelUserAwait(userID);
      fn.deleteUserAwait(userID);
    }

    // Retrieve user settings:
    var timezoneOffset, daylightSaving;
    let userSettings = await User.findOne({ discordID: userID });
    if (!userSettings) {
      // Get user to enter the userSettings
    } else {
      timezoneOffset = userSettings.timezone.offset;
      daylightSaving = userSettings.timezone.daylightSaving;
    }

    const PREFIX = await getPrefix(
      interaction.guild_id ? "text" : "dm",
      interaction.guild_id
    );

    try {
      // console.log({ command });
      console.log(`Interaction Command: ${command.name}`);
      await command.runSlashCommand({
        bot,
        interaction,
        args,
        timezoneOffset,
        daylightSaving,
        PREFIX,
      });
      return;
    } catch (err) {
      console.error(err);
      await ic.reply(
        bot,
        interaction,
        "There was an error trying to execute that command!",
        true
      );
    }
    // console.log({ interaction });
    return;
  });

  //! DO NOT have this activated when testing - it will delete all of the guildsettings data
  if (!bot.guilds.cache.get("736750419170164800")) {
    await gu.updateGuilds(bot);
  }

  //! Avoid having this one on when not testing voice - it will alter other user's tracking data!
  if (!bot.guilds.cache.get("736750419170164800")) {
    await fn.resetAllVoiceChannelTracking(bot);
  }

  //* Enable these 4 below for proper data persistence upon reset
  await fn.updateAllUsers(bot);
  await rm.rescheduleAllDST(bot);
  await rm.resetReminders(bot);
  await hb.resetAllHabitCrons();

  // For adjusting EST user's from EST to EDT! (Should not need to be used, will happen automatically now)
  // const estUsers = await User.find({
  // // discordID: {
  // //   $nin: [
  // //     "208829852583723008",
  // //     "208829852583723008",
  // //     "635266254109802508",
  // //     "633117006874542110",
  // //   ],
  // // },
  //   "timezone.name": "EST",
  // });
  // for (const estUser of estUsers) {
  //    await rm.updateUserReminders(bot, estUser.discordID, -1, true, true);
  // }

  //* Testing Discord message sending!
  // const testChannel = bot.channels.cache.get('746119608271896598');
  // testChannel.send("Sent to channel!");

  // const testUser = bot.users.cache.get('746119608271896598');
  // const msgOut = await testUser.send(new Discord.MessageEmbed().setTitle("Test").setDescription("Message"));
  // console.log({msgOut});
  // msgOut.delete({timeout: 3000});

  //* For Testing
  // console.log(fn.timestampToDateString(fn.timeCommandHandlerToUTC("2 mon ago", Date.now(), -4, true, false, true, false)));
  // console.log(fn.timestampToDateString(fn.timeCommandHandlerToUTC("in 2 tues", Date.now(), -4, true, false, true, true)));
  // let logs = [
  //   {
  //     _id: 10,
  //     timestamp: new Date(2021, 2, 29, 0).getTime(),
  //     state: 1,
  //   },
  //   {
  //     _id: 9,
  //     timestamp: new Date(2021, 2, 28, 0).getTime(),
  //     state: 1,
  //   },
  //   {
  //     _id: 8,
  //     timestamp: new Date(2021, 2, 27, 0).getTime(),
  //     state: 1,
  //   },
  //   {
  //     _id: 7,
  //     timestamp: new Date(2021, 2, 26, 0).getTime(),
  //     state: 2,
  //   },
  //   {
  //     _id: 6,
  //     timestamp: new Date(2021, 2, 25, 0).getTime(),
  //     state: 1,
  //   },
  // {
  //   _id: 5,
  //   timestamp: new Date(2021, 2, 10, 4).getTime(),
  //   state: 1,
  // },
  // {
  //   _id: 4,
  //   timestamp: new Date(2021, 2, 4, 4).getTime(),
  //   state: 2,
  // },
  // {
  //   _id: 3,
  //   timestamp: new Date(2021, 2, 3, 4).getTime(),
  //   state: 2,
  // },
  // {
  //   _id: 2,
  //   timestamp: new Date(2021, 2, 2, 4).getTime(),
  //   state: 2,
  // },
  // {
  //   _id: 1,
  //   timestamp: new Date(2021, 2, -13, 4).getTime(),
  //   state: 1,
  // },
  // ];

  // console.log(
  //   fn.calculateCurrentStreak(logs, -5, { daily: 0, weekly: 0 }, false, 1)
  // );
  // logs = await Log.find({
  //   connectedDocument: "6039f503812977313c2f8ec6",
  // }).sort({ timestamp: -1 });
  // console.log(
  //   fn.calculateCurrentStreak(logs, -5, { daily: 0, weekly: 0 }, true, 2)
  // );
  // console.log(fn.getHabitLogOnTimestampDay(logs, new Date(2021, 2, 14, 4), 0));

  // await hb.updateHabit(
  //   await Habit.findOne({ userID: message.author.id }).sort({ timestamp: -1 }),
  //   -5,
  //   { daily: 0, weekly: 0 }
  // );

  // if (message.author.id === "208829852583723008") {
  //     const directory = `utilities/file_storage/208829852583723008`;
  //     const path = `${directory}/${fn.timestampToDateString(Date.now(), true, true, true, true)}.txt`;
  //     const outputString = "Yay!\nThis works!\n\n\n\n\n\nLots of \\n";
  //     if (outputString) {
  //         fs.appendFileSync(path, outputString);
  //         const fileOut = fs.readFileSync(path, 'utf-8');
  //         const userObject = bot.users.cache.get("208829852583723008");
  //         if (userObject && fileOut) {
  //             await userObject.send({ files: [path] });
  //             console.log("true");
  //         }
  //         fs.unlink(path, (err) => {
  //             console.error(err);
  //             return;
  //         });
  //     }
  // }

  // console.log(fn.timestampToDateString(fn.getStartOfWeekTimestamp(Date.now() - 5 * HOUR_IN_MS, -5, true, false)));

  // const result = await rm.cancelReminder("208829852583723008", "5f9647410dd2ff1eb497d05d");
  // console.log({ result });

  // await hb.habitCron(await Habit.findById("5f9711afa1b3d3321c142504"), -5, { daily: 10800000, weekly: 0 });
  // console.log(fn.timestampToDateString(1605513600000));
  // console.log(fn.getCurrentUTCTimestampFlooredToSecond());
  // console.log(hb.getPastDaysStreak([
  //     {
  //         timestamp: new Date(2020, 10, 8, 4).getTime(),
  //         state: 1
  //     },
  //     {
  //         timestamp: new Date(2020, 10, 7, 4).getTime(),
  //         state: 1
  //     },
  //     {
  //         timestamp: new Date(2020, 10, 5, 4).getTime(),
  //         state: 1
  //     },
  //     {
  //         timestamp: new Date(2020, 10, 3, 4).getTime(),
  //         state: 1
  //     },
  //     {
  //         timestamp: new Date(2020, 10, 2, 4).getTime(),
  //         state: 1
  //     },
  //     {
  //         timestamp: new Date(2020, 10, 0, 4).getTime(),
  //         state: 1
  //     },
  // ], -5, { daily: 10800000, weekly: 0 }, 3, new Date(2020, 10, 1, 4).getTime()));
  // await hb.habitCron(bot, '208829852583723008');
  // fn.calculateCurrentStreak([
  // {
  //     timestamp: new Date(2020, 11, 8, 4).getTime(),
  //     state: 1
  // },
  // {
  //     timestamp: new Date(2020, 11, 2, 4).getTime(),
  //     state: 1
  // },
  // {
  //     timestamp: new Date(2020, 10, 25, 4).getTime(),
  //     state: 1
  // },
  // {
  //     timestamp: new Date(2020, 10, 21, 4).getTime(),
  //     state: 1
  // },
  // {
  //     timestamp: new Date(2020, 10, 12, 4).getTime(),
  //     state: 1
  // },

  // {
  //     timestamp: new Date(2020, 10, 28, 4).getTime(),
  //     state: 1
  // },
  // {
  //     timestamp: new Date(2020, 10, 26, 4).getTime(),
  //     state: 1
  // },
  // {
  //     timestamp: new Date(2020, 10, 24, 4).getTime(),
  //     state: 1
  // },
  // {
  //     timestamp: new Date(2020, 10, 23, 4).getTime(),
  //     state: 1
  // },
  // {
  //     timestamp: new Date(2020, 10, 22, 4).getTime(),
  //     state: 1
  // },
  // ], -5, { daily: 10800000, weekly: 0 }, false, 2, fn.getNextCronTimeUTC(-5, { daily: 10800000, weekly: 0 }, true, 2,
  //     new Date(2020, 9, 29, 12).getTime() - 5 * 8.64e+7) - 5 * 8.64e+7);
  // console.log(fn.timestampToDateString(fn.getNextCronTimeUTC(-5, { daily: 10800000, weekly: 0 }, true, 2,
  //     new Date(2020, 9, 30, 12).getTime() - 5 * 8.64e+7) - 5 * 8.64e+7));

  // //Generating Link
  //Method 1:
  // bot.generateInvite([126016]).then(link =>
  // {
  //     console.log(link);
  // }).catch(err =>
  // {
  //     console.log(err.stack);
  // });

  // //Method 2: Async - Handling Promises
  // //When using await it "pauses" code until the promise is fulfilled
  // //It is good practice to put it into a try-catch block
  // try
  // {
  //     let link = await bot.generateInvite([126016]);
  // }
  // catch(e)
  // {
  //     console.log(e.stack);
  // }
});

// To deal with reactions to bot messages
// bot.on("messageReactionAdd", async (reaction, user) => {
//     if (reaction.message.partial) {
//         console.log(reaction);
//         console.log("A user has reacted to an uncached message.");
//     }
// });

bot.on("message", async (message) => {
  // console.log({ message });

  // If the user is blocked from typing commands - 1 minute timeout, make this a global statement
  // If their name is part of the timeouts Array List!
  // If the message is from a bot, ignore
  if (message.author.bot) return;
  else if (spamRecords.has(message.author.id)) {
    const userSpamCheck = spamRecords.get(message.author.id);
    if (userSpamCheck.isRateLimited) return;
  }

  const PREFIX = await getPrefix(
    message.channel.type,
    message.guild && message.guild.id
  );
  const isMention = message.content.startsWith(pdBotTag);
  // PREFIX = '?'; //* For Testing

  // When the message does not start with prefix, do nothing
  if (!isPrefixedCommandCall(message.content, PREFIX)) return;

  // Args/Arguments:
  // .slice to remove the first part of message containing the prefix
  // .split to section off multiple parts of the command (i.e. "?fast start now")
  // .shift() takes the first elements of the array
  // args will give all of the arguments passed in from the user
  const messageArray = message.content.split(/ +/);
  // For @mention prefix command calls, check if the @mention is separated by
  // a space or not
  const isSplit = isMention
    ? messageArray[0] === pdBotTag
      ? true
      : false
    : false;

  // Get the command (Word after prefix)
  const commandName = isMention
    ? isSplit
      ? messageArray[1]
        ? messageArray[1].toLowerCase()
        : false
      : messageArray[0].slice(pdBotTag.length).toLowerCase()
    : messageArray[0].slice(PREFIX.length).toLowerCase();
  // Get all of the arguments after the initial command
  let args = isSplit ? messageArray.slice(2) : messageArray.slice(1);

  // Otherwise, begin checking if the message is a viable command!
  // With ALIASES
  const command =
    bot.commands.get(commandName) ||
    bot.commands.find(
      (cmd) => cmd.aliases && cmd.aliases.includes(commandName)
    );
  if (!command) return;

  console.log(
    `%c User Command: ${commandName} ${args.join(" ")}`,
    "color: green; font-weight: bold;"
  );

  // Spam Prevention:
  const updatedSpamCheck = await checkSpam(
    message.author.id,
    message.createdTimestamp
  );
  if (updatedSpamCheck && updatedSpamCheck.isSpamming) {
    const userDM = bot.users.cache.get(message.author.id);
    userDM.send(getSpamMessage(updatedSpamCheck.timeoutMinutes));
    return;
  }

  // Cooldowns:
  const cooldown = await cooldownCheck(message.author.id, command);
  if (cooldown && cooldown.onCooldown) {
    if (!cooldown.sentCooldownMessage) {
      fn.sendReplyThenDelete(
        message,
        getCooldownMessage(cooldown.secondsLeft, command.name),
        cooldown.secondsLeft * 1000
      );
    }
    return;
  }

  // Check if PD Bot is already awaiting a response from the user. If yes, cancel the await and send a response that there is an await.
  const userAwait = fn.getUserAwait(message.author.id);
  if (userAwait) {
    if (userAwait.channel && userAwait.channel !== message.author.id) {
      await sd.sendMessage(
        bot,
        userAwait.channel,
        `Any **command calls** while I am listening to your response will automatically **stop** the listening.\n**__Prefix:__** ${PREFIX}\n**__Command Entered:__** ${PREFIX}${commandName} ${args.join(
          " "
        )}`
      );
    }
    fn.cancelUserAwait(message.author.id);
    fn.deleteUserAwait(message.author.id);
  }

  if (commandName !== "ping") {
    const user = message.author;
    let userSettings = await User.findOne({ discordID: user.id });
    // Update the Guild Settings
    // Pull from the guild settings from the initial user settings
    var timezoneOffset, daylightSavingSetting;
    if (!userSettings) {
      const timezone = await fn.getNewUserTimezoneSettings(
        bot,
        message.author.id,
        message.channel.id,
        PREFIX,
        user.id
      );
      if (!timezone) return;
      const userInfo = await fn.createUserSettings(bot, user.id, timezone);
      if (!userInfo)
        return message.reply(
          `**Sorry, I could not setup your user settings, contact the developer for more information!**\n(https://discord.gg/Czc3CSy)`
        );
      userSettings = userInfo;
      daylightSavingSetting = timezone.daylightSaving;
      timezoneOffset = timezone.offset;
      const userCount = await User.find({})
        .countDocuments()
        .catch((err) => console.error(err));
      bot.user.setActivity(`${userCount ? userCount : "you"} thrive! | ?help`, {
        type: "WATCHING",
      });
    } else {
      // TODO - Future: Try a mixture of an event listener + a initial check on start-up to save resources on checking whether a user has changed their credentials each time! ✅ (DONE!)
      // const guildMap = userSettings.guilds.map(guild => guild.id);
      // const thisGuildIncluded = guildMap.includes(message.guild.id);
      // let updateQuery = {
      //     discordTag: `${user.username}#${user.discriminator}`,
      //     avatar: user.avatar,
      // };
      // const update = await User.findOneAndUpdate({ discordID: message.author.id }, updateQuery, { new: true });
      // console.log({ update });
      // userSettings = update;
      timezoneOffset = userSettings.timezone.offset;
      daylightSavingSetting = userSettings.timezone.daylightSaving;
    }

    // Help: If command requires args send help message
    if (!args.length && command.args) {
      return message.reply(`Try** \`${PREFIX}${commandName} help\` **`);
    }

    // Check if user wants to skip confirmation windows
    var forceSkip;
    const lastArg = args[args.length - 1];
    if (lastArg == "force") {
      forceSkip = true;
      args = args.slice(0, -1);
    } else forceSkip = false;
  }

  try {
    command.run(
      bot,
      message,
      commandName,
      args,
      PREFIX,
      timezoneOffset,
      daylightSavingSetting,
      forceSkip
    );
  } catch (err) {
    console.error(err);
    return message.reply("There was an error trying to execute that command!");
  }
});

// bot.on("messageReactionAdd", async (reaction, user) => {
//     try {
//         if (reaction.message.partial) await reaction.message.fetch();
//         if (reaction.partial) await reaction.fetch();
//         if (reaction.message.channel.id != message.channel.id) return;
//         if (user.bot) return;
//         if (user != userOriginal) return;

//         if (reaction.emoji.name === "✅") {
//             confirm.delete({ timeout: deleteDelay });
//             confirmation = true;
//             console.log("About to return!");
//             return;
//         }
//         else {
//             message.channel.send("Exiting...");
//             confirm.delete({ timeout: deleteDelay });
//             confirmation = false;
//             return;
//         }
//     } catch (err) {
//         console.log(err);
//     }
// });

// For dynamic bot settings per guild
// Will help with handling unique prefixes!
bot.on("guildCreate", async (guild) => {
  await fn.resetAllVoiceChannelTracking(bot);
  await gu.setupNewGuild(bot, guild.id, guild.name);
  return;
});

// Remove the settings and preset data if PD is removed from guild
bot.on("guildDelete", async (guild) => {
  // console.log([...guild.channels.cache.values()]);
  await gu.deleteGuild(guild.id, guild.name, guild.channels.cache).array();
  return;
});

bot.on("guildMemberUpdate", async (member) => {
  const user = member.user;
  await fn.updateUser(user);
  return;
});

// Check if the new channelID joined is part of the list,
// if it is, then start the interval

// Check if the new channelID is null (implies that they left),
// then update the tracked duration by the difference
// and cancel the interval if there is any

// Each interval update the tracked duration
// by the time per interval period

bot.on("voiceStateUpdate", async (oldState, newState) => {
  const userID = oldState.member.id;
  const oldChannelID = oldState.channelID;
  const newChannelID = newState.channelID;
  console.log(
    `Old Channel ID: ${oldChannelID} - New Channel ID: ${newChannelID}`
  );

  if (
    !fn.voiceTrackingHasUser(userID) &&
    !fn.autoSendTrackReportHasUser(userID)
  ) {
    const vcInformation = await fn.getTargetVoiceChannelAndUserSettings(
      bot,
      userID,
      newChannelID
    );
    if (!vcInformation) return;
    const setup = await fn.setupVoiceChannelTracking(
      bot,
      userID,
      newChannelID,
      vcInformation
    );
    if (!setup) return;
  } else if (oldChannelID !== newChannelID) {
    // If they left the voice channel:
    // Stop tracking and clear + delete interval.
    const trackingDocument = await Track.findOne({
      userID,
      voiceChannelID: oldChannelID,
    });
    const autoSendReportEnabled = !!trackingDocument
      ? typeof trackingDocument.finishedSession === "boolean"
      : false;
    console.log({ autoSendReportEnabled });
    if (trackingDocument) {
      if (autoSendReportEnabled) {
        await fn.voiceTrackingSetAutoSendTrackReport(
          bot,
          userID,
          trackingDocument,
          false
        );
      } else {
        await fn.updateVoiceChannelTimeTracked(
          bot,
          userID,
          oldChannelID,
          fn.getCurrentUTCTimestampFlooredToSecond() - trackingDocument.start,
          true
        );
      }
    }
    fn.voiceTrackingUserClearChannelInterval(userID, oldChannelID);
    fn.voiceTrackingUserDeleteChannel(userID, oldChannelID);
    if (!autoSendReportEnabled) {
      await Track.deleteOne({ userID, voiceChannelID: oldChannelID });
      // await rm.updateTrackingReportReminder(bot, userID);
    }

    // If they transferred to a new channel:
    // Delete old interval.
    // Then check if this new channel also needs to be tracked
    // and setup the tracking if so, otherwise delete interval and return
    if (newChannelID) {
      const vcInformation = await fn.getTargetVoiceChannelAndUserSettings(
        bot,
        userID,
        newChannelID
      );
      if (!vcInformation) return;
      const setup = await fn.setupVoiceChannelTracking(
        bot,
        userID,
        newChannelID,
        vcInformation
      );
      if (!setup) return;
    }
  }
  return;
});

bot.on("channelDelete", async (channel) => {
  // If a user tracked voice channel gets deleted,
  // make the channel name as the id and store the guildName
  await tr.unlinkVoiceChannelTracking(channel);
});

// To ensure that the MongoDB is connected before logging in
// the bot as the "ready" even resets lingering reminders
// which relies on MongoDB to be online!
const ensureDB = setInterval(() => {
  if (mongoose.connection.readyState === 1) {
    bot.login(TOKEN);
    clearInterval(ensureDB);
  } else {
    console.log("Waiting for MongoDB to connect...");
  }
}, 600);

module.exports = { bot: bot };
