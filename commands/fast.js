const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const mongoose = require("mongoose");
const config = require("../botsettings.json");

//Function Declarations and Definitions
function millisecondsToTimeString(milliseconds) {
    var hours, minutes, seconds, timeString;
    hours = Math.floor(milliseconds/3600/1000);
    minutes = Math.floor((milliseconds - hours*3600*1000)/60/1000);
    seconds = Math.floor((milliseconds - hours*3600*1000 - minutes*60*1000)/1000);

    timeString = `${hours}h:${minutes}m:${seconds}s`;
    return(timeString);
}

function confirmationEmbed(message) {
    var yes;
    // let embed = new Discord.MessageEmbed()
    // yes = true;
    return(yes);
}

function timeCommandHandler(args, messageCreatedTime) {
    if(args[0] == "now")
    {
        return messageCreatedTime;
    }
}

module.exports.run = async (bot, message, args) => {
    const usageMessage = `**USAGE:**\n\`${config.PREFIX}fast <ACTION>\`\n\n`
    + "**<ACTION>:** start; end; see past <#_OF_ENTRIES> OR see all";
    const fastStartUsage = `**USAGE:**\n\`${config.PREFIX}fast start <DATE/TIME>\`\n\n`
    + "<DATE/TIME>: **now**\n(more features in development)";
    const fastEndUsage = `**USAGE:**\n\`${config.PREFIX}fast end <DATE/TIME>\`\n\n`
    + "<DATE/TIME>: **now**\n(more features in development)";

    // MOSTLY Fleshed out capability: Most Time Handling Edge-Cases Considered
    // const fastStartUsage = `**USAGE:**\n\`${config.PREFIX}fast start <DATE/TIME>\`\n\n`
    // + "Enter date and/or time in **relative terms**\n"
    // + "(i.e. now, 1 hour ago, 15 minutes ago, yesterday at 12PM, today at 8:32a)"
    // + "\n\nOR\n\n Enter date and/or time in **absolute terms**\n"
    // + "(i.e. [Month/Day/Year]: 3/22/2020 10a EST, [Month.Day.Year]: 3.22.2020 at 9PM," 
    // + "[Month/Day]: 3/22 at 10p PST, [Month.Day]: 3.22 9:27PM, [Time]: 9:22PM OR 11:05a)"
    // + "**Defaults:** Time: *Assumed Today*; Time Zone: *EST*";

    // FULLY Fleshed out capability: All Time Handling Edge-Cases Considered
    // const fastStartUsage = `**USAGE:**\n\`${config.PREFIX}fast start <DATE/TIME>\`\n\n`
    // + "Enter date and/or time in relative terms\n"
    // + "(i.e. now, 1 hour ago, 15 minutes ago, in 15 minutes, in 1 hour, yesterday at 10pm EST,"
    // + " two days ago at 6P PST, 1 day ago 8p) Default: next time forward(AM/PM), EST"
    // + "\n\nOR\n\n Enter date and/or time in absolute terms\n"
    // + "(i.e. [Month/Day/Year] 3/22/2020 at 10a EST, [Month.Day.Year] 3.22.2020 at 9PM," 
    // + "[Month/Day] 3/22 at 10a EST, [Month.Day] 3.22 at 9PM)";
    
    // Before declaration of more variables - check if the user has any arguments
    if(args == undefined || args.length == 0)
    {
        message.reply(usageMessage);
        return;
    }

    let fast = new Fast();

    const fastsInProgress = await fast.collection.find({
        userID: message.author.id,
        endTime: null}).count();
    console.log(fastsInProgress);

    const fastRunningMessage = `you already have a **fast running!**\nIf you want to **restart** it try \`${config.PREFIX}fast edit\``
    + `\nIf you want to **delete** the fast entry altogether try \`${config.PREFIX}fast delete\``;

    const noFastRunningMessage = `you don't have a **fast running!**\nIf you want to **start** one \`${config.PREFIX}fast start <DATE/TIME>\``;

    const date = new Date();
    var startTimeStamp, currentTimeStamp;

    /**
     * TIME STRING TESTING!
     */
    // currentTimeStamp = date.getTime();
    // console.log(millisecondsToTimeString(currentTimeStamp));

    switch(args[0])
    {
        case "start":
            /**
             * TO ADD:
             * 1. How long do you intend to fast? (in hours - you can use decimals too)
             * 
             * 2. Set your fast reminder preference? (this will apply unless you change it)
             * Would you like a reminder before or when your fasts ends? if so when?
             * -> When you DM the user, have reaction at the bottom which allow them to
             * quickly and seamlessly end or edit their fast! (Embed)
             */

            //Check if the user does not already have a fast in progress, otherwise start.
            //Using greater than equal to ensure error message sent even though 
            //any given user should not be able to have more than 1 fast running at a time
            if(fastsInProgress >= 1) {
                message.reply(fastRunningMessage); return;
            }
            else if(args[1] == undefined || args.length == 1) {
                message.reply(fastStartUsage); return;
            }
            else {
                startTimeStamp = timeCommandHandler(args, messageCreatedTime);
                fast = new Fast({
                    _id: mongoose.Types.ObjectId(),
                    userID: message.author.id,
                    //using new Date().getTime() gives the time in milliseconds since Jan 1, 1970 00:00:00
                    startTime: startTimeStamp,
    
                    //if the endTime or fastDuration is null that indicates that the fast is still going
                    endTime: null,
                    fastDuration: null,
                    fastBreaker: null,
                    mood: null,
                    reflection: null
                });
            
                fast.save()
                .then(result => console.log(result))
                .catch(err => console.log(err))
            
                message.reply("your fast has been recorded!");
            }
        break;
        
        case "end":
            if(fastsInProgress == 0) {
                message.reply(noFastRunningMessage);
            }
            else {
                // Send message and as for fastBreaker and upload a picture too
                // which can be referenced later or sent to a server when DMs are handled!
                let fastBreakerText;

                // Send message for reflection with reaction moods from 1-5
                // Listen/await for the message.author.id to reply
                // Map the corresponding response to moodValue
                let moodValue;

                // Then proceed to prompt user with next message regarding reflection
                // Press the X reaction to leave it blank
                let reflectionText;
                
                // Setup current time to find duration of fast
                const currentTimeStamp = date.getTime();

                let currentFast = await fast.collection.findOne({
                    userID: message.author.id,
                    endTime: null})
                .catch(err => console.error(err));

                const startTimeStamp = currentFast.startTime;
                console.log(startTimeStamp);

                const fastDurationTimeStamp = currentTimeStamp - startTimeStamp; 
                console.log(fastDurationTimeStamp);

                fast.collection.updateOne({
                    userID: message.author.id, 
                    endTime: null},
                    {
                        $set: {fastDuration: fastDurationTimeStamp, endTime: currentTimeStamp},
                        // $currentDate: {endTime: { $type: "timestamp"}}
                    })
                .then(result => {
                    message.reply(`you have successfully logged your **${millisecondsToTimeString(fastDurationTimeStamp)} fast!** Good Stuff 💪!`)
                })
                .catch(err => console.error(`Failed to end fast ${err}`));
            }
         break;

        // case "see":
        //     if()
        // break;

        // case "delete":
        //     if()
        // break;

        default:
            message.channel.send(usageMessage);
    }



}

module.exports.help = {
    name: "fast"
}