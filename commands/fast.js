const Discord = require("discord.js");
const botSettings = require("../botsettings.json");
const prefix = botSettings.PREFIX;
const Fast = require("../models/fasting.js");
const mongoose = require("mongoose");
const config = require("../botsettings.json");
const fn = require("../models/functions");

module.exports.run = async (bot, message, args) => {
    const usageMessage = `**USAGE:**\n\`${config.PREFIX}fast <ACTION>\`\n\n`
        + "`<ACTION>`: start; end; see; edit; delete; see <PAST_#_OF_ENTRIES>; see <recent OR all>";
    const fastStartUsage = `**USAGE:**\n\`${config.PREFIX}fast start <DATE/TIME>\`\n\n`
        + "`<DATE/TIME>`: **now**\n(more features in development)";
    const fastEndUsage = `**USAGE:**\n\`${config.PREFIX}fast end <DATE/TIME>\`\n\n`
        + "`<DATE/TIME>`: **now**\n(more features in development)";

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
    if (args == undefined || args.length == 0) {
        message.reply(usageMessage);
        return;
    }

    let fast = new Fast();

    const fastsInProgress = await fast.collection.find({
        userID: message.author.id,
        endTime: null
    }).count();
    console.log(`fastsInProgress: ${fastsInProgress}`);

    const fastRunningMessage = `You already have a **fast running!**\nIf you want to **restart** it try \`${config.PREFIX}fast edit\``
        + `\nIf you want to **delete** the fast entry altogether try \`${prefix}fast delete\``;

    const noFastRunningMessage = `You don't have a **fast running!**\nIf you want to **start** one \`${config.PREFIX}fast start <DATE/TIME>\``;

    const currentDate = new Date();
    var startTimeStamp, currentTimestamp, fastEmbed;

    // // Check all the servers the bot is in
    // let botServers = await bot.guilds.cache.map(guild => guild.id);
    // console.log(botServers);

    // // Find all the servers that the user is in (within the given scope)
    // var botUserServers = new Array();
    // console.log(botUserServers);

    // // for(i = 0; i < botServers.length; i++)
    // // {        
    // //     if(bot.guild.get(botServers[i]).member(message.author.id))
    // //     {
    // //         botUserServers.push(botServers[i]);
    // //     }

    // // }
    // console.log(botUserServers);
    // console.log(message);

    // // Check all of the servers that the user is in, and show them the servers the bot is in too!



    switch (args[0]) {
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
            if (fastsInProgress >= 1) {
                message.reply(fastRunningMessage); return;
            }
            else if (args[1] == undefined || args.length == 1) {
                message.reply(fastStartUsage); return;
            }
            else {
                // Remove the "start" from the args using slice
                startTimeStamp = fn.timeCommandHandler(args.slice(1), message.createdTimestamp);
                if (startTimeStamp == false) {
                    message.reply(fastStartUsage); return;
                }
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
                    .catch(err => console.log(err));

                message.reply(`Your fast starting **${args.slice(1)}** is being recorded!`);
            }
            break;

        case "end":
            if (fastsInProgress == 0) {
                message.reply(noFastRunningMessage);
            }
            else if (args[1] == undefined || args.length == 1) {
                message.reply(fastEndUsage); return;
            }
            else {
                // FOR Handling when the user's fast ending time is not now!
                // Remove the "end" from the args using slice
                const endTimestamp = fn.timeCommandHandler(args.slice(1), message.createdTimestamp);
                if (endTimestamp == false) {
                    message.reply(fastEndUsage); return;
                }

                const currentFast = await fast.collection.findOne({
                    userID: message.author.id,
                    endTime: null
                })
                    .catch(err => console.error(err));
                const currentFastUser = currentFast.userID;
                const startTimeStamp = currentFast.startTime;
                const fastDurationTimestamp = endTimestamp - startTimeStamp;
                console.log(`${currentFastUser}'s fast start timestamp: ${startTimeStamp}`);
                console.log(`${currentFastUser}'s fast duration timestamp (if ending now): ${fastDurationTimestamp}`);

                // EVEN if the time is not now it will be handled accordingly
                const quickEndMessage = `**Log additional information - fast breaker, mood, reflection**?: (press ✅)` +
                    `\n\n**Quickly log** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast now?: (press ⌚)` +
                    `\n\n**Exit:** (press ❌)` +
                    `\n\n\\*IF \`<DATE/TIME>\` is at a **FUTURE time**: (use ⌚)\\* (you can always \`${prefix}fast edit\`)`;
                const quickEndEmojis = ["✅", "❌", "⌚"];
                var endConfirmation = `Are you sure you want to **end** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast?`;
                const fastBreakerPrompt = "**What did you break your fast with?** \n\nType `skip` to **skip** (will **continue**, but log it as blank)";
                const moodValuePrompt = "**How did you feel during this past fast?**\n\n(Press ❌ to **exit**)";
                const moodValueEmojis = ["😄", "🙂", "😐", "😔", "😖", "❌"];
                var moodResult;
                var reflectionTextPrompt = "**Elaborate? For Example:\n - __Why__ did you feel that way?\n - What did you do that made it great? / What could you have done to __make it better__?**" +
                    "\n\nType `1` when **done**\nType `skip` to **skip** (will **continue**, but log it as blank)";
                let quickEnd = await fn.reactionDataCollect(message, quickEndMessage, quickEndEmojis, "Fast: Quick End?", "#00FF00", 180000)
                    .catch(err => console.error(err));
                var fastBreaker, moodValue, reflectionText;
                if (quickEnd == "❌") return;
                else if (quickEnd == "✅") {
                    // Send message and as for fastBreaker and upload a picture too
                    // which can be referenced later or sent to a server when DMs are handled!
                    fastBreaker = await fn.messageDataCollectFirst(message, fastBreakerPrompt, "Fast: Fast Breaker!", "#32CD32", 300000);
                    console.log(fastBreaker);
                    if (fastBreaker == "stop") return;
                    else if (fastBreaker == "skip") {
                        fastBreaker = null;
                    }

                    // Send message for reflection with reaction moods from 1-5
                    // Listen/await for the message.author.id to reply
                    // Map the corresponding response to moodValue
                    moodValue = await fn.reactionDataCollect(message, moodValuePrompt, moodValueEmojis, "Fast: Mood Assessment", "#008000")
                        .catch(err => console.error(err));;
                    if (!moodValue || moodValue == "❌") return;
                    else {
                        for (i in moodValueEmojis) {
                            if (moodValue == moodValueEmojis[i]) {
                                moodResult = 5 - i;
                            }
                        }
                    }
                    // Then proceed to prompt user with next message regarding reflection
                    // Press the X reaction to leave it blank
                    let reflectionText = new Array();
                    const endTimeToDate = new Date(endTimestamp).toLocaleString();
                    let messageIndex = 0;
                    // Loop it to collect the first message given and store it, if that message is 0, 1, or stop then handle accordingly
                    do {
                        reflectionText.push(await fn.messageDataCollectFirst(message, reflectionTextPrompt, "Fast: Reflection", "#00FF00", 900000));

                        if (messageIndex == 0) {
                            reflectionTextPrompt = reflectionTextPrompt + "\n\n**Current Reflection Message:**\n" + reflectionText[messageIndex] + "\n";
                        }
                        else {
                            reflectionTextPrompt = reflectionTextPrompt + reflectionText[messageIndex] + "\n";
                        }

                        if (reflectionText[messageIndex] == "1") {
                            // Delete "1" from the end:
                            reflectionText.pop();
                            break;
                        }
                        if (reflectionText[messageIndex] == "stop") return;

                        if (reflectionText[messageIndex] == "skip") {
                            // Overwrite any previously collected data: Make sure the user wants to do that
                            if (await fn.confirmationMessage(message, "Are you sure you want to **skip?** Your current reflection entry will be lost!",
                                "Fast: Skip Reflection Confirmation")) {
                                reflectionText = new Array(null);
                                break;
                            }
                        }
                        messageIndex++;
                    }
                    while (true)
                }
                else {
                    // Skip adding values to the other fields, just end the fast
                    fastBreaker = null;
                    moodResult = null;
                    reflectionText = null;
                }

                endConfirmation = endConfirmation + `\n\n**Fast Breaker:** ${fastBreaker}\n**Mood:** ${moodResult}\n**Reflection:** ${reflectionText}`;
                //If the user declines or has made a mistake, stop.
                const confirmation = await fn.confirmationMessage(message, endConfirmation)
                    .catch(err => console.error(err));
                console.log(`Confirmation function call: ${confirmation}`);
                if (!confirmation) return;

                fast.collection.updateOne({
                    userID: message.author.id,
                    endTime: null
                },
                    {
                        $set: {
                            fastDuration: fastDurationTimestamp, endTime: endTimestamp,
                            fastBreaker: fastBreaker, mood: moodResult, reflection: reflectionText
                        }
                    })
                    .then(async () => {
                        message.reply(`You have successfully logged your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast!`);
                        /**
                         * Fast poster:
                         * Make sure that you delete the messages of the confirmation windows after!
                         */
                        const confirmPostFastMessage = "Would you like to take a **picture** of your **fast breaker** *and/or* **send a message** to a server channel? (for accountability!)"
                            + "\n\n(if ✅, I will list the servers you're in to find the channel you want to post to!)";
                        let confirmPostFast = await fn.confirmationMessage(message, confirmPostFastMessage, "Send Message for Accountability?", 45000, 0)
                            .catch(err => console.error(err))
                        if (!confirmPostFast) return;
                        else {
                            // FUTURE: Save messages to an array so that, on the sent post, there will be a reaction collect and it will allow the user to edit or delete their post!
                            // TAG @user in the post so that you can retrieve this information with partials! (getting the first @user.author.id): "@user 's fast:"
                            var fastPostMessagePrompt = "Please enter the message(s) you'd like to send. (you can send pictures!)\nType `0` for **default message with fast breaker**\nType `1` when **done**!\n";
                            const endTimeToDate = new Date(endTimestamp).toLocaleString();
                            let messageIndex = 0;
                            let fastPost = new Array(`<@${message.author.id}>'s ${endTimeToDate} Fast:`);
                            // fastPost.push();
                            // Loop it to collect the first message given and store it, if that message is 0, 1, or stop then handle accordingly
                            do {
                                messageIndex++;
                                fastPost.push(await fn.messageDataCollectFirst(message, fastPostMessagePrompt, "Fast: Post Creation", "#ADD8E6", 1800000));

                                if (messageIndex === 1) {
                                    fastPostMessagePrompt = fastPostMessagePrompt + "\n**Current Message:**\n" + fastPost[messageIndex] + "\n";
                                }
                                else {
                                    fastPostMessagePrompt = fastPostMessagePrompt + fastPost[messageIndex] + "\n";
                                }

                                if (fastPost[messageIndex] == "stop") return;
                                if (fastPost[messageIndex] == "1") {
                                    // Delete "1" from the end:
                                    fastPost.pop();
                                    break;
                                }
                                if (fastPost[messageIndex] == "0") {
                                    // Overwrite any previously collected data:
                                    if (fastBreaker == null) {
                                        fastPost = new Array(`Broke my **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast!`);
                                        break;
                                    }
                                    else {
                                        fastPost = new Array(`Broke my **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast with ${fastBreaker}!`);
                                        break;
                                    }
                                }
                            }
                            while (true)
                            // Ideally, format output with new line for every message sent! \n
                            console.log(`Fast Post: ${fastPost}`);
                            message.reply(`Functionality still in development...\n**Fast Post:**\n${fastPost}`);
                            // Now Send the Fast Post to desired channel
                        }
                    })
                    .catch(err => console.error(`Failed to end fast ${err}`));
            }
            break;

        case "see":
            // Will add the ability to gather all of the user's data into a spreadsheet or note/JSON file!
            // **Handle users who do not yet have a fast!
            const fastSeeHelp = `Type \`${prefix}fast see help\` for **more options/ways to see your fasts!**`;
            const fastSeeUsage = `**USAGE:**\n\`${prefix}fast see past <PAST_#_OF_ENTRIES> <FIELD>\`\n\`${prefix}fast see <#_MOST_RECENT_ENTRY> <FIELD>\``
                + `\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; all; 5** (\\*any number)`
                + `\n\`<#_MOST_RECENT_ENTRY>\`: **recent; all** (returns entire history); **3 **(\\*3rd most recent entry, any number)`
                + `\n\`all\`: Returns all of your past entries`;
            + "\n`<FIELD>`: **start; end; fastbreaker; duration; reflection** (includes mood); *Default:* all fields\n(if MULTIPLE `<FIELD>`: separate by space!)";
            // If the user wants fast help, do not proceed to show them the fast.
            const seeCommands = ["past", "recent", "all"];
            var fastView, fastData, startTimeToDate, endTimeToDate, fastDuration, fastBreaker, moodRating, reflectionText;
            currentTimestamp = fn.timeCommandHandler(["now"], message.createdTimestamp);
            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.reply(fastSeeUsage);
                    return;
                }
            }
            // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(args[1]) && isNaN(args[1])) {
                await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp, fastSeeUsage);
                message.reply(fastSeeHelp);
                return;
            }
            // Do not show the most recent fast embed, when a valid command is called
            // it will be handled properly later based on the values passed in!
            else {
                var pastFunctionality;
                var pastNumOfEntries;
                var fields = { userID: message.author.id };
                // To check if the given argument is a number!
                // If it's not a number and has passed the initial 
                // filter, then use the "past" functionality
                // Handling Argument 1:
                const isNumberArg = !isNaN(args[1]);
                var allEntries;
                if (args[1].toLowerCase() == "recent") {
                    pastNumOfEntries = 1;
                    pastFunctionality = false;
                }
                else if (args[1].toLowerCase() == "all") {
                    pastNumOfEntries = await fast.collection.find({ userID: message.author.id }).count();
                    pastFunctionality = true;
                }
                else if (isNumberArg) {
                    pastNumOfEntries = parseInt(args[1]);
                    pastFunctionality = false;
                }
                else if (args[1].toLowerCase() == "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else {
                    await fn.invalidInputError(message, fastSeeUsage);
                    return;
                }
                console.log(pastNumOfEntries);
                console.log(pastFunctionality);
                if (pastFunctionality) {
                    // Loop through all of the given fields, account for aliases and update fields
                    // Find Entries, toArray, store data in meaningful output
                    if (args[2] != undefined) {
                        // If the next argument is NotaNumber, invalid "past" command call
                        if (isNaN(args[2])) {
                            fn.invalidInputError(message, fastSeeUsage);
                            return;
                        }
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (args[1].toLowerCase() != "all") {
                            message.reply(fastSeeUsage);
                            return;
                        }
                        const confirmSeeAllMessage = "Are you sure you want to see all of your fast history?\n\n*(IF a lot of logs, it will spam DM/server!)*";
                        let confirmSeeAll = await fn.confirmationMessage(message, confirmSeeAllMessage, "Fast: See All WARNING!");
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumOfEntries the argument value if not alread see "all"
                    if (pastNumOfEntries == undefined) {
                        pastNumOfEntries = parseInt(args[2]);
                    }
                    fastView = await fast.collection
                        .find(fields)
                        .sort({ startTime: -1 })
                        .limit(pastNumOfEntries)
                        .toArray();

                    for (i = 0; i < pastNumOfEntries; i++) {
                        console.log(fastView[i]);
                        if (fastView[i] == undefined) {
                            fn.invalidInputError(message, fastSeeUsage, `**FAST ${i + 1}**+ ONWARDS DOES NOT EXIST...`, false);
                            return;
                        }
                        startTimeToDate = new Date(fastView[i].startTime).toLocaleString();
                        if (i == 0 && fastView[0].endTime == null) {
                            endTimeToDate = null;
                        }
                        else {
                            endTimeToDate = new Date(fastView[i].endTime);
                        }
                        fastDuration = fastView[i].fastDuration;
                        fastBreaker = fastView[i].fastBreaker;
                        moodRating = fastView[i].mood;
                        reflectionText = fastView[i].reflection;
                        fastData = `__**Fast ${i + 1}:**__\n` + fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                            fastBreaker, moodRating, reflectionText);
                        message.reply(fastData);
                    }
                    return;
                }

                // If not using the pastFunctionality, then look up element
                fastView = await fast.collection
                    .find({ userID: message.author.id })
                    .sort({ startTime: -1 })
                    .limit(1)
                    .skip(pastNumOfEntries - 1)
                    .toArray()
                    .catch(err => {
                        fn.invalidInputError(message, fastSeeUsage, "INVALID NUMBER...");
                        console.log(err);
                        return;
                    });
                console.log(fastView);
                // If the returned array is empty, then the fast does not exist.
                if (fastView.length == 0) {
                    fn.invalidInputError(message, fastSeeUsage, "FAST DOES NOT EXIST...", false);
                    return;
                }

                startTimeToDate = new Date(fastView[0].startTime).toLocaleString();

                if (fastView[0].endTime == null) {
                    endTimeToDate = null;
                }
                else {
                    endTimeToDate = new Date(fastView[0].endTime);
                }
                fastDuration = currentTimestamp - fastView[0].startTime;
                fastBreaker = fastView[0].fastBreaker;
                moodRating = fastView[0].mood;
                reflectionText = fastView[0].reflection;

                fastData = `__**Fast ${pastNumOfEntries}:**__\n` + fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                    fastBreaker, moodRating, reflectionText);
                message.reply(fastData);

            }
            break;

        case "delete":
            const fastDeleteUsage = `**USAGE:**\n\`${prefix}fast delete past <PAST_#_OF_ENTRIES> <FIELD>\``
                + `\n\`${prefix}fast delete <#_MOST_RECENT_ENTRY> <FIELD>\``
                + `\n\`${prefix}fast delete many <RECENT_ENTRIES> <FIELD>\``
                + "\n\n`<PAST_#_OF_ENTRIES>`: 5 (\\*any number); all \n(NOTE: Will delete more than 1 entry!)"
                + "\n`<#_MOST_RECENT_ENTRY>`: recent; 3 (\\*3rd most recent entry, any number)\n(NOTE: Deletes just 1 entry)"
                + "\n`<RECENT_ENTRIES>`: 3, 5, 7, 1, 25\n(**COMMA SEPARATED:** with 1 being the most recent fast, 25 the 25th most recent, etc.)"
                + "\n`<FIELD>`: (any field you'd like to clear, doesn't remove whole fast) start; end; fastbreaker; duration; mood; reflection"
                + "\n(if MULTIPLE `<FIELD>`s: separate by **space**!)"
                + "\nIF you'd like to see more of your fasts first before trying to delete: `?fast see`"
                + "\n\nIF you'd like to archive the deleted fasts as well (i.e. get the data in a .txt file) - **proceed**.\nIF you'd like to archive without deletion, try: `fast archive` (FUTURE FEATURE)\\*";
            var mostRecentFast, fastView, fastData, startTimeToDate, endTimeToDate, fastDuration, fastBreaker, moodRating, reflectionText;
            currentTimestamp = fn.timeCommandHandler(["now"], message.createdTimestamp);
            const deleteCommands = ["past", "all", "many"];

            // Show the user the current fast if they
            fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp);
            message.reply(fastDeleteUsage);

            if (args[1] == undefined || args.length == 1) {
                message.reply(fastDeleteUsage); return;
            }
            else {
                if (args[2] != undefined) {
                    if (args[2].toLowerCase == "past") {
                        // If the following argument is not a number, exit!
                        if (!args[3].isNaN()) {
                            message.reply(fastDeleteUsage);
                            return;
                        }
                        var deleteConfirmMessage = `Are you sure you want to delete ${args[3]} fasts?:`;
                        var fastTargetIDs;
                        fastView = await fast.collection.find({ userID: message.author.id })
                            .sort({ startTime: -1 })
                            .limit(args[3])
                            .toArray();
                        for (i = 0; i < args[3]; i++) {
                            startTimeToDate = new Date(fastView[i].startTime).toLocaleString();
                            if (i == 0 && fastView[0].endTime == null) {
                                endTimeToDate = null;
                            }
                            else {
                                endTimeToDate = new Date(fastView[i].endTime);
                            }
                            fastDuration = fastView[i].fastDuration;
                            fastBreaker = fastView[i].fastBreaker;
                            moodRating = fastView[i].mood;
                            reflectionText = fastView[i].reflection;
                            fastData = `__**Fast ${i + 1}:**__\n` + fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                                fastBreaker, moodRating, reflectionText);
                            deleteConfirmMessage = deleteConfirmMessage + "\n\n" + fastData;
                        }

                        if (await fn.confirmationMessage(message, deleteConfirmMessage, `Fast: Delete Past ${args[3]}`)) {
                            // Must Find the array of cursors first (map _id), then delete only args[3] of them
                            // Sort from greatest endtime => most recent!
                            console.log("Will delete!");

                            // fastTargetIDs = fast.collection.find({ userID: message.author.id })
                            //     .sort({ endtime: -1 })
                            //     .limit(args[3])
                            //     .toArray()
                            //     .map(fasts => fasts._id);
                            // fast.collection.remove({_id: {$in: fastTargetIDs}});
                        }
                        else return;
                    }
                }
                else {
                    var pastNumOfEntries;
                    // To check if the given argument is a number!
                    const isNumberArg = !isNaN(args[2]);
                    var allEntries;
                    switch (args[2]) {
                        case "recent": pastNumOfEntries = 1;
                            break;
                        case "all": pastNumOfEntries = await fast.collection.countDocuments({ userID: message.author.id });
                            break;
                        case isNumberArg: pastNumOfEntries = args[2].parseInt();
                            break;
                        default: await fn.invalidInputError(message, fastDeleteUsage)
                            return;
                    }
                }
            }
            break;

        // case "edit":
        //     if()
        // break;

        // case "send":
        //     if()
        // break;

        default:
            message.channel.send(usageMessage);
            break;
    }
}

module.exports.help = {
    name: "fast",
    aliases: ["if"]
}