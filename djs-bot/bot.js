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
const DEFAULT_PREFIX = '?';
const Discord = require("discord.js");
const bot = new Discord.Client({ partials: ["MESSAGE", "CHANNEL", "REACTION"] });
const fn = require("../utilities/functions");
const rm = require("../utilities/reminder");
const fs = require("fs");
bot.commands = new Discord.Collection();
const cooldowns = new Discord.Collection();

const mongoose = require("mongoose");
const Guild = require("./database/schemas/guildsettings");
const User = require("./database/schemas/user");
const Reminder = require("./database/schemas/reminder");
const { reminderTypes } = require("../utilities/functions");
bot.mongoose = require("../utilities/mongoose");

//This shouldn't happen, this would be on Node.js
fs.readdir("./djs-bot/commands", (err, files) => {
    if (err) console.error(err);

    //to get the file extension .js
    let jsfiles = files.filter(f => f.split(".").pop() === "js");
    if (jsfiles.length <= 0) {
        console.log("No commands to load!");
        return;
    }

    console.log(`Loading ${jsfiles.length} commands!`);

    jsfiles.forEach((f, i) => {
        let props = require(`./commands/${f}`);
        console.log(`${i + 1}: ${f} loaded!`);
        bot.commands.set(props.name, props);
    });
});

bot.mongoose.init();

bot.on("ready", async () => {
    const userCount = await User.find({}).countDocuments()
        .catch(err => console.error(err));
    console.log(`${bot.user.username} is now online!`);

    bot.user.setActivity(`${userCount ? userCount : "you"} thrive! | ?help`, { type: "WATCHING" });

    // Reinstantiating the current reminders:
    await rm.resetReminders(bot);

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
    // If the message is from a bot, ignore
    if (message.author.bot) return;

    var PREFIX, guildSettings;
    if (message.channel.type === 'dm') {
        PREFIX = DEFAULT_PREFIX;
    }
    else {
        const guildID = message.guild.id;
        guildSettings = await Guild.findOne({ guildID });
        if (guildSettings) PREFIX = guildSettings.prefix;
        else PREFIX = DEFAULT_PREFIX;
    }
    // When the message does not start with prefix, do nothing
    if (!message.content.startsWith(PREFIX)) return;

    // Args/Arguments:
    // .slice to remove the first part of message containing the prefix
    // .split to section off multiple parts of the command (i.e. "?fast start now")
    // .shift() takes the first elements of the array
    // args will give all of the arguments passed in from the user
    const messageArray = message.content.split(/ +/);
    // Get the command (Word after prefix)
    const commandName = messageArray[0].slice(PREFIX.length).toLowerCase();
    // Get all of the arguments after the initial command
    let args = messageArray.slice(1);

    // Otherwise, begin checking if the message is a viable command!
    // With ALIASES
    const command = bot.commands.get(commandName)
        || bot.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    if (!command) return;

    const user = message.author;
    let userSettings = await User.findOne({ discordID: user.id });
    // Update the Guild Settings
    // Pull from the guild settings from the initial user settings
    var timezoneOffset, daylightSavingsSetting;
    if (!userSettings) {
        if (guildSettings) {
            const guildTimezone = guildSettings.timezone.name;
            const guildDaylightSavingSetting = guildSettings.timezone.daylightSavings;
            const initialOffset = fn.getTimezoneOffset(guildTimezone);
            const daylightOffset = fn.isDaylightSavingTime(Date.now(), guildDaylightSavingSetting) ?
                fn.getTimezoneDaylightOffset(guildTimezone) : 0;
            const guildUpdate = await Guild.findOneAndUpdate({ guildID: message.guild.id },
                {
                    timezone: {
                        name: guildTimezone,
                        offset: initialOffset + daylightOffset,
                        daylightSavings: guildDaylightSavingSetting,
                    },
                }, { new: true });
            console.log({ guildUpdate });
            guildSettings = guildUpdate;
        }
        // Should be initialized upon creation,
        // But in case of an error:
        else if (guildSettings === null) {
            guildSettings = await fn.createGuildSettings(message.guild.id, "EST", true);
            console.log(`${bot.user.username} is in the server ${message.guild.name} - saved to database.`);
        }
        // For the user that DMs PD Bot and is not in a guild!
        // This sets up their userSettings to default
        else guildSettings = { timezone: { name: "EST" } };

        const userInfo = await fn.createUserSettings(bot, user.id, message.guild.id);
        userSettings = userInfo;
        daylightSavingsSetting = userInfo.timezone.daylightSavings;
        timezoneOffset = userInfo.timezone.offset;
        const userCount = await User.find({}).countDocuments()
            .catch(err => console.error(err));
        bot.user.setActivity(`${userCount ? userCount : "you"} thrive! | ?help`, { type: "WATCHING" });
    }
    else {
        // const guildMap = userSettings.guilds.map(guild => guild.id);
        // const thisGuildIncluded = guildMap.includes(message.guild.id);
        let updateQuery = {
            discordTag: `${user.username}#${user.discriminator}`,
            avatar: user.avatar,
        };
        daylightSavingsSetting = userSettings.timezone.daylightSavings;
        // Get the UTC Timezone offset 
        const timezone = userSettings.timezone.name;
        let initialOffset = fn.getTimezoneOffset(timezone);
        console.log({ timezone, initialOffset, daylightSavingsSetting })
        timezoneOffset = daylightSavingsSetting ?
            (isNaN(timezone) ? initialOffset + fn.getTimezoneDaylightOffset(timezone)
                : initialOffset++)
            : initialOffset;
        updateQuery.timezone = {
            name: userSettings.timezone.name,
            offset: timezoneOffset,
            daylightSavings: true,
        };
        const update = await User.findOneAndUpdate({ discordID: message.author.id }, updateQuery, { new: true });
        console.log({ update });
        userSettings = update;
    }

    console.log(`%c User Command: ${PREFIX}${commandName} ${args.join(' ')}`, 'color: green; font-weight: bold;');

    // Help: If command requires args send help message
    if (!args.length && command.args) {
        return message.reply(`Try \`${PREFIX}${commandName} help\`...`);
    }

    // Cooldowns:
    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown) * 1000;
    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return fn.sendReplyThenDelete(message, `Please **wait ${timeLeft.toFixed(1)} more second(s)** before reusing the **\`${command.name}\` command**`, timeLeft * 1000);
        }
    }
    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    // Check if user wants to skip confirmation windows
    var forceSkip;
    const lastArg = args[args.length - 1];
    if (lastArg == "force") {
        forceSkip = true;
        args = args.slice(0, -1);
    }
    else forceSkip = false;

    try {
        command.run(bot, message, commandName, args, PREFIX,
            timezoneOffset, daylightSavingsSetting, forceSkip);
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
            const guild = await fn.createGuildSettings(guild.id, "EST", true);
            if (guild) console.log(`${bot.user.username} has joined the server ${guild.name}! Saved to Database.`);
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
        await Reminder.deleteMany({ guildID: guild.id });
        console.log(`Removed from ${guild.name}(${guild.id})\nDeleting Guild Settings and Reminders...`);
    }
    catch (err) {
        return console.error(err);
    }
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