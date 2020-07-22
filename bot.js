/**
 * Author Name: Justin Mendes
 * Date Created: July 18, 2020
 * Last Updated: July 18, 2020
 */

//To keep the sensitive information in a separate folder
const botSettings = require("./botsettings.json");
const token = botSettings.TOKEN;
const prefix = botSettings.PREFIX;

const Discord = require("discord.js");
const bot = new Discord.Client({ partials: ["MESSAGE", "CHANNEL", "REACTION"] });
const fn = require("./models/functions");

const fs = require("fs");
bot.commands = new Discord.Collection();

bot.mongoose = require("./utils/mongoose");

//This shouldn't happen, this would be on Node.js
fs.readdir("./commands", (err, files) => {
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

    bot.user.setActivity("you thrive! | ?help", { type: "WATCHING" });

    // //Generating Link
    // //Method 1:
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

bot.on("message", async message => {
    //If the message is from a bot, ignore
    //When the message does not start with prefix, do nothing
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    //Messaging the bot in a DM
    /**
     * Have to implement DM interaction!
     * Right now it does not handle DMs preoply
     */
    // if(message.channel.type === "dm") return;

    //Args/Arguments:
    //.slice to remove the first part of message containing the prefix
    //.split to section off multiple parts of the command (i.e. "?fast start now")
    //.shift() takes the first elements of the array
    //args will give all of the arguments passed in from the user
    const messageArray = message.content.split(/ +/);
    //Get the command (Word after prefix)
    const command = messageArray[0].slice(prefix.length).toLowerCase();
    //Get all of the arguments after the initial command
    const args = messageArray.slice(1);

    // //Test Logs
    // console.log(messageArray);
    // console.log(args);
    // console.log(command);

    
    //Otherwise, begin checking if the message is a viable command!
    if (!bot.commands.has(command)) return;
    else {
        try {
            bot.commands.get(command).run(bot, message, args);
        } catch (error) {
            console.error(error);
            message.reply("there was an error trying to execute that command!");
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


bot.mongoose.init();
bot.login(token);
