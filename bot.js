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
const bot = new Discord.Client({});

bot.on("ready", async () => 
{
    console.log(`${bot.user.username} is now online!`);

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

bot.on("message", async message =>
{
    //If the message is from a bot, ignore
    if(message.author.bot) return;

    //Messaging the bot in a DM
    /**
     * Have to implement DM interaction!
     * Right now it does not handle DMs
     */
    if(message.channel.type === "dm") return;

    //Args/Arguments:
    //.slice to remove the first part of message containing the prefix
    //.split to section off multiple parts of the command (i.e. "?fast start now")
    //.shift() takes the first elements of the array
    //args will give all of the arguments passed in from the user
    let messageArray = message.content.split(/ +/);
    //Get the command (Word after prefix)
    let command = messageArray[0].slice(prefix.length).toLowerCase();
    //Get all of the arguments after the initial command
    let args = messageArray.slice(1);

    

    // //Test Logs
    // console.log(messageArray);
    // console.log(args);
    // console.log(command);

    //When the message does not start with prefix, do nothing
    if(!message.content.startsWith(prefix)) return;
    //Otherwise, begin checking the message is a viable command!
    else
    {
        if(command === "ping")
        {
            //Show time between user command and bot reply = ping time!
            let pingTime = message.createdTimestamp;
            let botSendTime;
            let pingMessage = await message.channel.send("Pong!");
            
            botSendTime = pingMessage.createdTimestamp;
            pingTime = botSendTime - pingTime;
            pingMessage.edit(`Pong! \`${pingTime}ms\``).catch(console.error);
        }
    }

});

bot.login(token);

