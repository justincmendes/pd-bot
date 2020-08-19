/**
 * @author Justin Mendes
 * @license MIT
 * Date Created: July 18, 2020
 * Last Updated: August 10, 2020
 */

 // TO-DO ALIASES ON COMMANDS!

// To keep the sensitive information in a separate folder
// and allow for environment variables when hosting
require("dotenv").config();
const TOKEN = process.env.TOKEN;

const Discord = require("discord.js");
const bot = new Discord.Client({ partials: ["MESSAGE", "CHANNEL", "REACTION"] });
const fn = require("../utilities/functions");

const fs = require("fs");
bot.commands = new Discord.Collection();

const mongoose = require("mongoose");
const GuildSettings = require("./database/schemas/guildsettings");
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
        bot.commands.set(props.help.name, props);
    });
});



bot.on("ready", async () => {
    console.log(`${bot.user.username} is now online!`);

    bot.user.setActivity(`you thrive! | ?help`, { type: "WATCHING" });

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

bot.mongoose.init();

bot.on("message", async message => {
    const guildConfig = new GuildSettings();
    const guildID = message.guild.id;
    const guildSettingsObject = await guildConfig.collection.find({guildID}).limit(1).toArray();
    const PREFIX = guildSettingsObject[0].prefix || "?";

    //If the message is from a bot, ignore
    //When the message does not start with prefix, do nothing
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    //Args/Arguments:
    //.slice to remove the first part of message containing the prefix
    //.split to section off multiple parts of the command (i.e. "?fast start now")
    //.shift() takes the first elements of the array
    //args will give all of the arguments passed in from the user
    const messageArray = message.content.split(/ +/);
    //Get the command (Word after prefix)
    const commandName = messageArray[0].slice(PREFIX.length).toLowerCase();
    //Get all of the arguments after the initial command
    const args = messageArray.slice(1);

    //Otherwise, begin checking if the message is a viable command!
    if (!bot.commands.has(commandName)) return;
    else {
        try {
            console.log(`%c User Command: ${PREFIX}${commandName} ${args.join(' ')}`, 'color: green; font-weight: bold;');
            bot.commands.get(commandName).run(bot, message, args, PREFIX);
        } catch (error) {
            console.error(error);
            message.reply("There was an error trying to execute that command!");
        }
    }
});

// bot.on("messageReactionAdd", async (reaction, user) => {
//     try {
//         if (reaction.message.partial) await reaction.message.fetch();
//         if (reaction.partial) await reaction.fetch();
//         if (reaction.message.channel.id != message.channel.id) return;
//         if (user.bot) return;
//         if (user != userOriginal) return;

//         if (reaction.emoji.name == agree) {
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
// Will implement better to make sure os guildID unique field
bot.on ("guildCreate", async (guild) => {
    try {
        const guildConfig = new GuildSettings(); 
        const guildCheck = await guildConfig.collection
        .find({ guildID: guild.id })
        .count()
        .catch(err => {
            console.log(err);
            return;
        });
        
        // Check if it already exists to avoid duplicates
        if (guildCheck >= 1) {
            console.log(`${bot.user.username} is already in ${guild.name}! Won't create new instance in Database.`);
            return;
        }
        else {
            const guildConfig = new GuildSettings( {
                _id: mongoose.Types.ObjectId(),
                guildID: guild.id,
            });
        guildConfig.save()
        .then(result => console.log(result))
        .catch(err => console.log(err));
        console.log(`${bot.user.username} has joined the server ${guild.name}! Saved to Database.`);
        }
    }
    catch (err) {
        console.error(err);
    }
})

// Remove the settings and preset data if PD is removed from guild
bot.on('guildDelete', async (guild) => {
    try {
        const guildConfig = new GuildSettings();
        await guildConfig.collection
        .deleteOne({ guildID: guild.id })
        .catch(err => {
            console.log(err);
            return;
        });
        console.log(`Removed from ${guild.name}(${guild.id})\nDeleting guildsettings...`);
    }
    catch(err) {
        console.error(err);
    }
})

bot.login(TOKEN);
