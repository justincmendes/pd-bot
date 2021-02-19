/**
 * @author Justin Mendes
 * @license MIT
 * Date Created: July 18, 2020
 * Last Updated: September 1, 2020
 */

// TO-DO ALIASES ON COMMANDS!

// To keep the sensitive information in a separate folder
// and allow for environment variables when hosting
require("dotenv").config();
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.DASHBOARD_CLIENT_ID;
const DEFAULT_PREFIX = '?';
const Discord = require("discord.js");
const bot = new Discord.Client({
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
    ws: { intents: Discord.Intents.PRIVILEDGED }
});
const fn = require("../utilities/functions");
const rm = require("../utilities/reminder");
const hb = require("../utilities/habit");
const fs = require("fs");
bot.commands = new Discord.Collection();
const cooldowns = new Discord.Collection();
const spamRecords = new Discord.Collection();

const mongoose = require("mongoose");
const Guild = require("./database/schemas/guildsettings");
const User = require("./database/schemas/user");
const Reminder = require("./database/schemas/reminder");
const Habit = require("./database/schemas/habit");
const Track = require("./database/schemas/track");
bot.mongoose = require("../utilities/mongoose");

const pdBotTag = `<@!${CLIENT_ID}>`;
const timeoutDurations = [60000, 180000, 540000, 900000] // in ms, max level: 4
const COMMAND_SPAM_NUMBER = 15;
const CLOSE_COMMAND_SPAM_NUMBER = fn.CLOSE_COMMAND_SPAM_NUMBER;
const REFRESH_SPAM_DELAY = fn.REFRESH_COMMAND_SPAM_DELAY;
const CLOSE_COMMAND_DELAY = fn.CLOSE_COMMAND_DELAY;


fs.readdir("./djs-bot/commands", (err, files) => {
    //This shouldn't happen, this would be on Node.js
    if (err) console.error(err);

    //to get the file extension .js
    let jsFiles = files.filter(file => file.split(".").pop() === "js");
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
    const userCount = await User.find({}).countDocuments()
        .catch(err => console.error(err));
    console.log(`${bot.user.username} is now online!`);

    bot.user.setActivity(`${userCount ? userCount : "you"} thrive! | ?help`, { type: "WATCHING" });

    await fn.rescheduleAllDST();
    await hb.resetAllHabitCrons();
    await rm.resetReminders(bot);
    await fn.updateAllUsers(bot);
    await fn.resetAllVoiceChannelTracking(bot);

    // For Testing
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
    // hb.calculateCurrentStreak([
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
    // ], -5, { daily: 10800000, weekly: 0 }, false, 2, hb.getNextCronTimeUTC(-5, { daily: 10800000, weekly: 0 }, true, 2,
    //     new Date(2020, 9, 29, 12).getTime() - 5 * 8.64e+7) - 5 * 8.64e+7);
    // console.log(fn.timestampToDateString(hb.getNextCronTimeUTC(-5, { daily: 10800000, weekly: 0 }, true, 2,
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

bot.on("message", async message => {
    // If the user is blocked from typing commands - 1 minute timeout, make this a global statement
    // If their name is part of the timeouts Array List!
    // If the message is from a bot, ignore
    if (message.author.bot) return;
    else if (spamRecords.has(message.author.id)) {
        const userSpamCheck = spamRecords.get(message.author.id);
        if (userSpamCheck.isRateLimited) return;
    }

    var PREFIX;
    if (message.channel.type === 'dm') {
        PREFIX = DEFAULT_PREFIX;
    }
    else {
        const guildID = message.guild.id;
        const guildSettings = await Guild.findOne({ guildID });
        PREFIX = guildSettings ? guildSettings.prefix : DEFAULT_PREFIX;
    }
    const isMention = message.content.startsWith(pdBotTag);
    // PREFIX = '?'; // For Testing

    // When the message does not start with prefix, do nothing
    if (!message.content.startsWith(PREFIX) && !isMention) return;

    // Args/Arguments:
    // .slice to remove the first part of message containing the prefix
    // .split to section off multiple parts of the command (i.e. "?fast start now")
    // .shift() takes the first elements of the array
    // args will give all of the arguments passed in from the user
    const messageArray = message.content.split(/ +/);
    // For @mention prefix command calls, check if the @mention is separated by
    // a space or not
    const isSplit = isMention ? messageArray[0] === pdBotTag ? true : false : false;
    // Get the command (Word after prefix)
    const commandName = isMention ? isSplit ? messageArray[1] ? messageArray[1].toLowerCase() : false
        : messageArray[0].slice(pdBotTag.length).toLowerCase()
        : messageArray[0].slice(PREFIX.length).toLowerCase();
    // Get all of the arguments after the initial command
    let args = isSplit ? messageArray.slice(2) : messageArray.slice(1);

    // Otherwise, begin checking if the message is a viable command!
    // With ALIASES
    const command = bot.commands.get(commandName)
        || bot.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    if (!command) return;

    console.log(`%c User Command: ${commandName} ${args.join(' ')}`, 'color: green; font-weight: bold;');

    // Spam Prevention:
    const spamDetails = spamRecords.get(message.author.id);
    if (spamDetails) {
        spamDetails.messageCount++;
        const messageSendDelay = message.createdTimestamp - (spamDetails.lastTimestamp || 0);
        spamDetails.lastTimestamp = message.createdTimestamp;
        if (messageSendDelay < CLOSE_COMMAND_DELAY) {
            spamDetails.closeMessageCount++;
        }
        if (spamDetails.closeMessageCount >= CLOSE_COMMAND_SPAM_NUMBER || spamDetails.messageCount >= COMMAND_SPAM_NUMBER) {
            const timeout = timeoutDurations[spamDetails.timeoutLevel - 1] || fn.getTimeScaleToMultiplyInMs('minute');
            const userDM = await bot.users.fetch(message.author.id);
            spamDetails.isRateLimited = true;
            setTimeout(() => {
                if (spamDetails) {
                    spamDetails.closeMessageCount = 0;
                    spamDetails.messageCount = 1;
                    spamDetails.isRateLimited = false;
                    if (spamDetails.timeoutLevel < 4) spamDetails.timeoutLevel++;
                }
                // if (userDM) userDM.send("**You may now enter my commands again**, please don't spam again - you will be ratelimited for longer!");
            }, timeout);
            if (userDM) userDM.send(`**Please don't spam me 🥺**, I will have to stop responding to your commands `
                + `for at least **__${timeout / fn.getTimeScaleToMultiplyInMs('minute')} minute(s)__.**`);
            return;
        }
        if (spamDetails.messageCount === 2) {
            setTimeout(() => {
                if (spamDetails) {
                    spamDetails.messageCount = 1;
                    spamDetails.closeMessageCount = 0;
                }
            }, REFRESH_SPAM_DELAY);
        }
    }
    else {
        setTimeout(() => {
            if (spamDetails.isRateLimited) {
                setTimeout(() => {
                    spamRecords.delete(message.author.id);
                }, (timeoutDurations[spamDetails.timeoutLevel - 1] || fn.getTimeScaleToMultiplyInMs('minute'))
                + fn.getTimeScaleToMultiplyInMs("hour") * 4);
            }
            else spamRecords.delete(message.author.id);
        }, fn.getTimeScaleToMultiplyInMs("day") / 2);
        spamRecords.set(message.author.id, {
            lastTimestamp: message.createdTimestamp,
            messageCount: 1,
            closeMessageCount: 0,
            isRateLimited: false,
            timeoutLevel: 1,
        });
    }

    // Cooldowns:
    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }
    const now = Date.now();
    const cooldownUsers = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown) * 1000;
    if (cooldownUsers.has(message.author.id)) {
        const cooldownDetails = cooldownUsers.get(message.author.id);
        if (cooldownDetails.sentCooldownMessage === false) {
            const expirationTime = cooldownDetails.endTime + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                fn.sendReplyThenDelete(message, `Please **wait ${timeLeft.toFixed(1)} more second(s)** before reusing the **\`${command.name}\` command**`, timeLeft * 1000);
                if (cooldownUsers.has(message.author.id)) {
                    cooldownDetails.sentCooldownMessage = true;
                }
            }
        }
        return;
    }
    else {
        cooldownUsers.set(message.author.id, {
            endTime: now,
            sentCooldownMessage: false,
        });
        setTimeout(() => cooldownUsers.delete(message.author.id), cooldownAmount);
    }

    if (commandName !== "ping") {
        const user = message.author;
        let userSettings = await User.findOne({ discordID: user.id });
        // Update the Guild Settings
        // Pull from the guild settings from the initial user settings
        var timezoneOffset, daylightSavingSetting;
        if (!userSettings) {
            const timezone = await fn.getNewUserTimezoneSettings(bot, message, PREFIX, user.id);
            if (!timezone) return;
            const userInfo = await fn.createUserSettings(bot, user.id, timezone);
            if (!userInfo) return message.reply("**Sorry, I could not setup your user settings, contact the developer for more information!**"
                + "\n(https://discord.gg/Czc3CSy)");
            userSettings = userInfo;
            daylightSavingSetting = timezone.daylightSaving;
            timezoneOffset = timezone.offset;
            const userCount = await User.find({}).countDocuments()
                .catch(err => console.error(err));
            bot.user.setActivity(`${userCount ? userCount : "you"} thrive! | ?help`, { type: "WATCHING" });
        }
        else {
            // Future: Try a mixture of an event listener + a initial check on start-up to save resources
            // on checking whether a user has changed their credentials each time! ✅

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
            daylightSavingSetting = userSettings.daylightSaving;
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
        }
        else forceSkip = false;
    }

    try {
        command.run(bot, message, commandName, args, PREFIX,
            timezoneOffset, daylightSavingSetting, forceSkip);
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
    try {
        const guildObject = await Guild.findOne({ guildID: guild.id });
        // Check if it already exists to avoid duplicates
        if (guildObject) return console.log(`${bot.user.username} is already in ${guild.name}! Won't create new instance in Database.`);
        else {
            const guildSettings = await fn.createGuildSettings(guild.id, "EST", true);
            if (guildSettings) console.log(`${bot.user.username} has joined the server ${guild.name}! Saved to Database.`);
            else console.log(`There was an error adding ${guild.name} to the database.`);
        }
    }
    catch (err) {
        return console.error(err);
    }
});

// Remove the settings and preset data if PD is removed from guild
bot.on('guildDelete', async (guild) => {
    try {
        await Guild.deleteOne({ guildID: guild.id });
        const guildReminders = await Reminder.find({ guildID: guild.id });
        guildReminders.forEach(async reminder => {
            await rm.cancelReminderById(reminder._id);
            await Reminder.findByIdAndDelete(reminder._id);
        });
        // await Reminder.deleteMany({ guildID: guild.id });
        console.log(`Removed from ${guild.name}(${guild.id})\nDeleting Guild Settings and Reminders...`);
    }
    catch (err) {
        return console.error(err);
    }
});

bot.on('guildMemberUpdate', async (member) => {
    const user = member.user;
    const { id, avatar, username, discriminator } = user;
    // console.log({ user, id, avatar, username, discriminator });
    const updateUser = await User.findOneAndUpdate({ discordID: id }, {
        $set: { avatar, discordTag: `${username}#${discriminator}`, }
    }, { new: true });
    if (updateUser) {
        console.log({ updateUser });
    }
    return;
});

// Check if the new channelID joined is part of the list, 
// if it is, then start the interval

// Check if the new channelID is null (implies that they left), 
// then update the tracked duration by the difference
// and cancel the interval if there is any

// Each interval update the tracked duration 
// by the time per interval period

bot.on('voiceStateUpdate', async (oldState, newState) => {
    const userID = oldState.member.id;
    const oldChannelID = oldState.channelID;
    const newChannelID = newState.channelID;
    console.log(`Old Channel ID: ${oldChannelID}`
        + ` - New Channel ID: ${newChannelID}`);

    if (!fn.voiceTrackingHasUser(userID)) {
        const vcInformation = await fn.getTargetVoiceChannelAndUserSettings(
            bot, userID, newChannelID
        );
        if (!vcInformation) return;
        const setup = await fn.setupVoiceChannelTracking(bot, userID,
            newChannelID, vcInformation);
        if (!setup) return;
    }
    else if (oldChannelID !== newChannelID) {
        // If they left the voice channel:
        // Stop tracking and clear + delete interval.
        const trackingDocument = await Track.findOne({
            userID, voiceChannelID: oldChannelID
        });
        if (trackingDocument) {
            await fn.updateVoiceChannelTimeTracked(bot, userID, oldChannelID,
                fn.getCurrentUTCTimestampFlooredToSecond() - trackingDocument.start,
                true,
            );
        }
        fn.voiceTrackingClearInterval(userID);
        fn.voiceTrackingDeleteCollection(userID);
        await Track.deleteMany({ userID });

        // If they transferred to a new channel:
        // Delete old interval.
        // Then check if this new channel also needs to be tracked
        // and setup the tracking if so, otherwise delete interval and return
        if (newChannelID) {
            const vcInformation = await fn.getTargetVoiceChannelAndUserSettings(
                bot, userID, newChannelID
            );
            if (!vcInformation) return;
            const setup = await fn.setupVoiceChannelTracking(bot, userID,
                newChannelID, vcInformation);
            if (!setup) return;
        }
    }
    return;
});

// To ensure that the MongoDB is connected before logging in
// the bot as the "ready" even resets lingering reminders
// which relies on MongoDB to be online!
const ensureDB = setInterval(() => {
    if (mongoose.connection.readyState === 1) {
        bot.login(TOKEN);
        clearInterval(ensureDB);
    }
    else {
        console.log("Waiting for MongoDB to connect...");
    }
}, 600);

module.exports = { bot: bot, };