const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const UserSettings = require("../models/usersettings");
const mongoose = require("mongoose");
const fn = require("../utils/functions");
require("dotenv").config();
const prefix = process.env.PREFIX;

// MAKE Help usage function*

// Handle <FIELD>s for each function call!

// IF USER TYPES `force` at the end, skip the confirmation window! FOR ALL FUNCTIONS!
// <FORCE>

// FOR FUTURE FEASABILITY/SCALABILITY:
// For ?fast see: allow ?fast see all file <FORCE> - to send them a txt file of their fasts!
// FOR SEE FUNCTION: Put a cap at PAST 5 AND ALL (max. 5), any number after that requires them to open the text file sent by the bot!
// Send them a confirmation if they'd like to see the rest on a file!
// Also put a cooldown on the see function!**


// SCROLL mode for see and delete: "cursor"
// For ?fast see/?fast delete: MAKE AN ITERATIVE PROCESS to show all fasts from 1-n and have the user confirm when they are finished seeing
// or if the fast they are looking at is the fast they want to delete (after deletion ask if they want to continue scrolling!) (MAKE THIS A MESSAGEAWAIT) FOR SPEED!

// For ?fast see/?fast delete: all for user to fast delete <NUMBER> past <STARTING_INDEX>

// ALLOW ALIASES (i.e. create fastfunctions.js and allow the switch to pick up multiple commands?)
// Ex: ?fast d => fast delete, ?fast st/?fast s => fast start, ?fast e => fast end

// CREATE Fast Post command!! (using fast see and fast end's logic => make functions to make the code more readable and reusable)

module.exports.run = async (bot, message, args) => {
    const usageMessage = `**USAGE:**\n\`${prefix}fast <ACTION>\`\n\n`
        + "`<ACTION>`: **help; start; end; see; edit; delete; see <PAST_#_OF_ENTRIES>; see <recent OR all>**";
    const usageHelp = `Try \`${prefix}fast help\``;
    var forceSkip, fastEmbed;

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
        message.reply(usageHelp);
        return;
    }

    if (args[args.length - 1] == "force") forceSkip = true;
    else forceSkip = false;

    let fast = new Fast();

    const fastsInProgress = await fast.collection.find({
        userID: message.author.id,
        endTime: null
    }).count();
    console.log(`fastsInProgress: ${fastsInProgress}`);

    const currentDate = new Date();
    var startTimestamp, currentTimestamp;

    switch (args[0]) {
        case "help": message.reply(usageMessage); break;
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
            var fastStartUsage = `**USAGE:**\n\`${prefix}fast start <DATE/TIME>\`\n\n`
                + "`<DATE/TIME>`: **now**\n\n(more features in development, i.e. set fast goal time + fast reminder,  and <DATE/TIME> natural language processor";
            fastStartUsage = new Discord.MessageEmbed()
                .setColor("#00FF00")
                .setTitle(`Fast: Fast Start Help`)
                .setDescription(fastStartUsage);
            const fastStartHelp = `Try \`${prefix}fast start help\``;
            const fastRunningMessage = `You already have a **fast running!**\nIf you want to **restart** it try \`${prefix}fast edit help\``
                + `\nIf you want to **delete** the fast entry altogether try \`${prefix}fast delete help\``;
            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastStartUsage);
                    return;
                }
            }
            if (fastsInProgress >= 1) {
                message.reply(fastRunningMessage); return;
            }
            else if (args[1] == undefined || args.length == 1) {
                message.reply(fastStartHelp); return;
            }
            else {
                // Remove the "start" from the args using slice
                startTimestamp = fn.timeCommandHandler(args.slice(1), message.createdTimestamp);
                if (startTimestamp == false) {
                    message.reply(fastStartHelp); return;
                }
                fast = new Fast({
                    _id: mongoose.Types.ObjectId(),
                    userID: message.author.id,
                    //using new Date().getTime() gives the time in milliseconds since Jan 1, 1970 00:00:00
                    startTime: startTimestamp,

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
            var fastEndUsage = `**USAGE:**\n\`${prefix}fast end <DATE/TIME> <force>\`\n\n`
                + "`<DATE/TIME>`: **now**\n\n(more features in development, i.e. send fast to accountability chat and <DATE/TIME> that is not just now)"
                + "\n\n`<force>`: type **force** at the end of your command to **skip all of the confimation windows!**";
            fastEndUsage = new Discord.MessageEmbed()
                .setColor("#00FF00")
                .setTitle(`Fast: Fast End Help`)
                .setDescription(fastEndUsage);
            const fastEndHelp = `Try \`${prefix}fast end help\``;
            const noFastRunningMessage = `You don't have a **fast running!**\nIf you want to **start** one \`${prefix}fast start <DATE/TIME>\``;

            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastEndUsage);
                    return;
                }
            }
            if (fastsInProgress == 0) {
                message.reply(noFastRunningMessage);
            }
            else if (args[1] == undefined || args.length == 1) {
                message.reply(fastEndHelp); return;
            }
            else {
                // FOR Handling when the user's fast ending time is not now!
                // Remove the "end" from the args using slice
                const endTimestamp = fn.timeCommandHandler(args.slice(1), message.createdTimestamp);
                if (endTimestamp == false) {
                    message.reply(fastEndHelp); return;
                }

                const currentFast = await fast.collection.findOne({
                    userID: message.author.id,
                    endTime: null
                })
                    .catch(err => console.error(err));
                const currentFastUser = currentFast.userID;
                startTimestamp = currentFast.startTime;
                const fastDurationTimestamp = endTimestamp - startTimestamp;
                console.log(`${currentFastUser}'s fast start timestamp: ${startTimestamp}`);
                console.log(`${currentFastUser}'s fast duration timestamp (if ending now): ${fastDurationTimestamp}`);

                // EVEN if the time is not now it will be handled accordingly
                const quickEndMessage = `**Log additional information - fast breaker, mood, reflection**?: (press ✅)` +
                    `\n\n**Quickly log** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast now?: (press ⌚)` +
                    `\n\n**Exit:** (press ❌)` +
                    `\n\n\\*IF \`<DATE/TIME>\` is at a **FUTURE time**: (use ⌚)\\* (you can always \`${prefix}fast edit\`)`;
                const quickEndEmojis = ["✅", "❌", "⌚"];
                var endConfirmation = `Are you sure you want to **end** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast?`;
                const fastBreakerPrompt = "**What did you break your fast with?** \n\nType `skip` to **skip** (will **continue**, but log it as blank)";
                const moodValuePrompt = "**How did you feel during this past fast?\n\nEnter a number from 1-5 (Default: null)**\n`5`-😄; `4`-🙂; `3`-😐; `2`-😔; `1`-😖;\n";
                // const moodValuePrompt = "**How did you feel during this past fast?**\n\n(Press ❌ to **exit**)";
                // const moodValueEmojis = ["😄", "🙂", "😐", "😔", "😖", "❌"];
                // var moodResult;
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
                    if (fastBreaker === false) return;
                    if (fastBreaker == "stop") return;
                    else if (fastBreaker == "skip") {
                        fastBreaker = null;
                    }

                    // Send message for reflection with reaction moods from 1-5
                    // Listen/await for the message.author.id to reply
                    // METHOD 1: Reaction Collect
                    // Map the corresponding response to moodValue
                    // moodValue = await fn.reactionDataCollect(message, moodValuePrompt, moodValueEmojis, "Fast: Mood Assessment", "#008000")
                    //     .catch(err => console.error(err));;
                    // if (!moodValue || moodValue == "❌") return;
                    // else {
                    //     for (i in moodValueEmojis) {
                    //         if (moodValue == moodValueEmojis[i]) {
                    //             moodResult = 5 - i;
                    //         }
                    //     }
                    // }

                    // METHOD 2: Message Collect
                    moodValue = await fn.messageDataCollectFirst(message, moodValuePrompt, "Fast: Mood Assessment", "#008000")
                        .catch(err => console.error(err));;
                    if (moodValue == "stop" || moodValue === false) return;
                    if (isNaN(moodValue)) moodValue = null;
                    if (moodValue > 5 || moodValue < 1) moodValue = null;

                    // Then proceed to prompt user with next message regarding reflection
                    // Press the X reaction to leave it blank
                    let reflection = new Array();
                    var reflectionText;

                    let messageIndex = 0;
                    // Loop it to collect the first message given and store it, if that message is 0, 1, or stop then handle accordingly
                    do {
                        reflection.push(await fn.messageDataCollectFirst(message, reflectionTextPrompt, "Fast: Reflection", "#00FF00", 900000));
                        if (reflection[messageIndex] === false) return;
                        if (reflection[messageIndex] == "1") {
                            // Delete "1" from the end:
                            reflection.pop();
                            break;
                        }
                        else if (reflection[messageIndex] == "stop") return;

                        else if (reflection[messageIndex] == "skip") {
                            // Overwrite any previously collected data: Make sure the user wants to do that
                            if (await fn.confirmationMessage(message, "Are you sure you want to **skip?** Your current reflection entry will be lost!",
                                "Fast: Skip Reflection Confirmation")) {
                                reflectionText = "";
                                break;
                            }
                        }
                        else {
                            if (messageIndex == 0) {
                                reflectionTextPrompt = reflectionTextPrompt + "\n\n**Current Reflection Message:**\n" + reflection[messageIndex] + "\n";
                                reflectionText = reflection[messageIndex] + "\n";
                            }
                            else {
                                reflectionTextPrompt = reflectionTextPrompt + reflection[messageIndex] + "\n";
                                reflectionText = reflectionText + reflection[messageIndex] + "\n";
                            }
                        }
                        messageIndex++;
                    }
                    while (true)
                }
                else {
                    // Skip adding values to the other fields, just end the fast
                    fastBreaker = null;
                    // moodResult = null;
                    moodValue = null;
                    reflectionText = null;
                }

                endConfirmation = endConfirmation + `\n\n**Fast Breaker:** ${fastBreaker}\n**Mood:** ${moodValue}\n**Reflection:** ${reflectionText}`;
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
                            fastBreaker: fastBreaker, mood: moodValue, reflection: reflectionText
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
                        let confirmPostFast = await fn.confirmationMessage(message, confirmPostFastMessage, "Send Message for Accountability?", 60000, 0)
                            .catch(err => console.error(err))
                        if (!confirmPostFast) return;
                        else {
                            // FUTURE: Save messages to an array so that, on the sent post, there will be a reaction collect and it will allow the user to edit or delete their post!
                            // TAG @user in the post so that you can retrieve this information with partials! (getting the first @user.author.id): "@user 's fast:"
                            // **CANNOT COLLECTED IMAGES! Make a new function in fn! to listen to messages WITH pictures attached - while copying that object or image link to the final embed!
                            var fastPostMessagePrompt = "Please enter the message(s) you'd like to send. (you can send pictures!)"
                                + "\nType `0` for **default message with fast breaker**\nType `1` when **done**!\nType `2` **to post full fast**";
                            const endTimeToDate = new Date(endTimestamp).toLocaleString();
                            let messageIndex = 0;
                            let fastPost = "";
                            var collectedMessage, confirmOverwrite;
                            // fastPost.push();
                            // Loop it to collect the first message given and store it, if that message is 0, 1, or stop then handle accordingly
                            do {
                                messageIndex++;
                                collectedMessage = await fn.messageDataCollectFirst(message, fastPostMessagePrompt, "Fast: Post Creation", "#ADD8E6", 1800000);
                                if (collectedMessage === false) return;
                                if (messageIndex === 1) {
                                    if (collectedEdit == "1") break;
                                    fastPostMessagePrompt = fastPostMessagePrompt + "\n**Current Message:**\n" + collectedMessage + "\n";
                                    fastPost = collectedMessage + "\n";
                                }
                                else if (collectedMessage != "0") {
                                    fastPostMessagePrompt = fastPostMessagePrompt + collectedMessage + "\n";
                                    fastPost = fastPost + collectedMessage + "\n";
                                }
                                if (collectedMessage == "stop") return;
                                if (collectedMessage == "1") break;

                                if (collectedMessage == "0") {
                                    // Overwrite any previously collected data: Confirm first, if confirmed exit and post, otherwise continue loop
                                    confirmOverwrite = await fn.confirmationMessage(message, "Are you sure you want to "
                                        + "**overwrite** your current message with the default message including the **time and your fast breaker** (if you entered one)?"
                                        + "\n\n(**Your current message progress will be lost**)",
                                        "Fast Post: Overwrite with Default", 60000, 0, "\n\nSelect ✅ to **overwrite and post**\nSelect ❌ to **continue with message creation**")
                                        .catch(err => console.error(err));
                                    if (confirmOverwrite) {
                                        if (fastBreaker == null) {
                                            fastPost = `Broke my **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast!`;
                                            break;
                                        }
                                        else {
                                            fastPost = `Broke my **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast with **${fastBreaker}**!`;
                                            break;
                                        }
                                    }
                                }
                                if (collectedMessage = "2") {
                                    // Overwrite any previously collected data: Confirm first, if confirmed exit and post, otherwise continue loop
                                    confirmOverwrite = await fn.confirmationMessage(message, "Are you sure you want to "
                                        + "**overwrite** your current message with the **full fast post (including mood and reflection)?**"
                                        + "\n\n(**Your current message progress will be lost**)",
                                        "Fast Post: Overwrite with Full Fast Post", 60000, 0, "\n\nSelect ✅ to **overwrite and post**\nSelect ❌ to **continue with message creation**")
                                        .catch(err => console.error(err));
                                    if (confirmOverwrite) {
                                        startTimeToDate = new Date(startTimestamp).toLocaleString();
                                        fastPost = fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDurationTimestamp,
                                            fastBreaker, moodValue, reflectionText);
                                    }
                                    break;
                                }
                            }
                            while (true)
                            // Ideally, format output with new line for every message sent! \n

                            // Now Send the Fast Post to desired channel
                            fn.sendMessageToChannel(bot, message, fastPost,
                                `Exiting... try \`${prefix}fast post\` to try to **post again!**`, "#00FF00",
                                "Fast: Post to Server", "Fast: Post to Channel", `${message.author.username}'s - ${endTimeToDate} - Fast`);
                        }
                    })
                    .catch(err => console.error(`Failed to end fast ${err}`));
            }
            break;

        case "see":
            // Will add the ability to gather all of the user's data into a spreadsheet or note/JSON file!
            // **Handle users who do not yet have a fast!
            var fastSeeUsage = `**USAGE:**\n\`${prefix}fast see past <PAST_#_OF_ENTRIES> <FIELD> <force>\`\n\`${prefix}fast see <#_MOST_RECENT_ENTRY> <FIELD> <force>\``
                + `\n\`${prefix}fast see <#_OF_ENTRIES> past <STARTING_INDEX> <FIELD> <force>\`\n\`${prefix}fast see <number>\``
                + `\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; all; 5** (\\*any number)`
                + `\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\*any number)`
                + `\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; all** (returns entire history); **3 **(3rd most recent entry, \\**any number*)`
                + `\n\n\`<STARTING_INDEX>\`: **4** (any number); (you want to see \`<#_OF_ENTRIES>\` past the 4th fast)`
                + `\n\n\`<number>\`: type **number** (shows you the number of fasts you have on record))`
                + "\n\n`<FIELD>`(OPT.): **start; end; fastbreaker; duration; reflection** (includes mood); *Default:* all fields\n(if MULTIPLE `<FIELD>`s: separate by space!)"
                + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows!**";
            fastSeeUsage = new Discord.MessageEmbed()
                .setColor("#00FF00")
                .setTitle(`Fast: Fast See Help`)
                .setDescription(fastSeeUsage);
            const fastSeeHelp = `**INVALID USAGE**... Try \`${prefix}fast see help\``;

            // If the user wants fast help, do not proceed to show them the fast.
            const seeCommands = ["past", "recent", "all"];
            var fastView, fastData, startTimeToDate, endTimeToDate, fastDuration, fastBreaker, moodRating, reflectionText;
            currentTimestamp = fn.timeCommandHandler(["now"], message.createdTimestamp);

            // MAKE THIS OPERATION INTO A FUNCTION!
            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastSeeUsage);
                    return;
                }
                fastView = await fast.collection
                    .find({ userID: message.author.id })
                    .count();
                // If the user has no fasts
                if (fastView == 0) {
                    message.reply(`NO FASTS... try \`${prefix}fast start help\``);
                    return;
                }
                else if (args[1].toLowerCase() == "number") {
                    message.reply(`You have **${fastView} fasts** on record.`);
                    return;
                }
            }
            // fast see (only):
            else {
                message.reply(`Try \`${prefix}fast see help\``);
                return;
            }
            // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(args[1]) && isNaN(args[1])) {
                await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp, fastSeeHelp);
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
                    if (pastNumOfEntries <= 0) {
                        await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp, fastSeeHelp);
                        message.reply(fastSeeHelp);
                        return;
                    }
                    else pastFunctionality = false;
                }
                else if (args[1].toLowerCase() == "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else {
                    await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp, fastSeeHelp);
                    message.reply(fastSeeHelp);
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
                            await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp, fastSeeHelp);
                            message.reply(fastSeeHelp);
                            return;
                        }
                        if (parseInt(args[2]) <= 0) {
                            await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp, fastSeeHelp);
                            message.reply(fastSeeHelp);
                            return;
                        }
                        const confirmSeeMessage = `Are you sure you want to see ${args[2]} fasts?\n\n*(IF a lot of logs, it will spam DM/server!)*`;
                        let confirmSeeAll = await fn.confirmationMessage(message, confirmSeeMessage, `Fast: See ${args[2]} Fasts WARNING!`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (args[1].toLowerCase() != "all") {
                            await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp, fastSeeHelp);
                            message.reply(fastSeeHelp);
                            return;
                        }
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your fast history?\n\n*(IF a lot of logs, it will spam DM/server!)*";
                        let confirmSeeAll = await fn.confirmationMessage(message, confirmSeeAllMessage, "Fast: See All Fasts WARNING!");
                        if (!(await confirmSeeAll)) return;
                    }
                    // To assign pastNumOfEntries the argument value if not already see "all"
                    if (pastNumOfEntries == undefined) {
                        pastNumOfEntries = parseInt(args[2]);
                    }
                    fastView = await fast.collection
                        .find(fields)
                        .sort({ startTime: -1 })
                        .limit(pastNumOfEntries)
                        .toArray();

                    fastData = "";
                    for (i = 0; i < pastNumOfEntries; i++) {
                        console.log(fastView[i]);
                        if (fastView[i] == undefined) {
                            pastNumOfEntries = i;
                            fn.invalidInputError(message, fastSeeHelp, `**FAST ${i + 1}**+ ONWARDS DOES NOT EXIST...`, false);
                            break;
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
                        fastData = fastData + `__**Fast ${i + 1}:**__\n` + fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                            fastBreaker, moodRating, reflectionText) + "\n";
                    }
                    fastEmbed = new Discord.MessageEmbed()
                        .setColor("#008000")
                        .setTitle(`Fast: See ${pastNumOfEntries} Fasts`)
                        .setDescription(fastData);
                    message.channel.send(fastEmbed);
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
                        fn.invalidInputError(message, fastSeeHelp, "INVALID NUMBER...");
                        console.log(err);
                        return;
                    });
                console.log(fastView);
                // If the returned array is empty, then the fast does not exist.
                if (fastView.length == 0) {
                    fn.invalidInputError(message, fastSeeHelp, "**FAST DOES NOT EXIST**...", false);
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

                fastEmbed = new Discord.MessageEmbed()
                    .setColor("#008000")
                    .setTitle(`Fast: See Fast ${pastNumOfEntries}`)
                    .setDescription(fastData);
                message.channel.send(fastEmbed);

            }
            break;

        //FIX USAGE MESSAGE - doens't make sense for new feature now.
        //
        case "delete":
            var fastDeleteUsage = `**USAGE:**\n\`${prefix}fast delete past <PAST_#_OF_ENTRIES> <FIELD> <force>\``
                + `\n\`${prefix}fast delete <#_MOST_RECENT_ENTRY> <FIELD> <force>\``
                + `\n\`${prefix}fast delete many <RECENT_ENTRIES> <FIELD> <force>\``
                + `\n\`${prefix}fast delete <#_OF_ENTRIES> past <STARTING_INDEX> <FIELD> <force>\``
                + "\n\n`<PAST_#_OF_ENTRIES>`: **recent; 5** (\\*any number); **all** \n(NOTE: ***any number or all* will delete more than 1 entry!**)"
                + `\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\**any number*)`
                + "\n\n`<#_MOST_RECENT_ENTRY>`: **all; recent; 3** (3rd most recent entry, \\**any number*)\n(NOTE: Deletes just 1 entry - UNLESS `all`)"
                + "\n\n`<RECENT_ENTRIES>`: **3,5,7,1,25**\n(**COMMA SEPARATED, NO SPACES:** with 1 being the most recent fast, 25 the 25th most recent, etc.)"
                + "\n\n`<FIELD>`(OPT.): **start; end; fastbreaker; duration; mood; reflection** (any field you'd like to clear, doesn't remove whole fast)"
                + "\n(if MULTIPLE `<FIELD>`s: separate by **space**!)"
                + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows!**"
                + "\n\nIF you'd like to see more of your fasts first before trying to delete: `?fast see`"
                + "\nIF you'd like to archive the deleted fasts as well (i.e. get the data in a .txt file) - **proceed**.\nIF you'd like to archive without deletion, try: `fast archive` (FUTURE FEATURE)\\*";
            fastDeleteUsage = new Discord.MessageEmbed()
                .setColor("#00FF00")
                .setTitle(`Fast: Fast Delete Help`)
                .setDescription(fastDeleteUsage);
            const fastDeleteHelp = `Try \`${prefix}fast delete help\``;
            const fastDeleteTrySee = `Try \`${prefix}fast see help\``;

            // delete help command so that the user does not get spammed with the usage message!
            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastDeleteUsage);
                    return;
                }
                fastView = await fast.collection
                    .find({ userID: message.author.id })
                    .count();
                // If the user has no fasts
                if (fastView == 0) {
                    message.reply(`NO FASTS... try \`${prefix}fast start\``);
                    return;
                }
            }
            // fast delete (only):
            else {
                message.reply(`Try \`${prefix}fast delete help\``);
                return;
            }

            var mostRecentFast, fastView, fastData, startTimeToDate, endTimeToDate, fastDuration, fastBreaker, moodRating, reflectionText;
            currentTimestamp = fn.timeCommandHandler(["now"], message.createdTimestamp);
            const deleteCommands = ["past", "all", "many"];

            // Show the user the most recent fast
            if (args[1] == undefined || args.length == 1) {
                await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp);
                message.reply(fastDeleteHelp);
                return;
            }

            // delete past command:
            else if (args[2] != undefined) {
                if (args[1].toLowerCase() == "past") {
                    // If the following argument is not a number, exit!
                    if (isNaN(args[2])) {
                        await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp);
                        message.reply(fastDeleteHelp);
                        return;
                    }
                    var numberArg = parseInt(args[2]);
                    if (numberArg <= 0) {
                        await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp);
                        message.reply(fastDeleteHelp);
                        return;
                    }
                    // Start with an empty string as it will be iteratively populated
                    var deleteConfirmMessage = "";
                    var fastTargetIDs = new Array();
                    fastView = await fast.collection.find({ userID: message.author.id })
                        .sort({ startTime: -1 })
                        .limit(numberArg)
                        .toArray();
                    for (i = 0; i < numberArg; i++) {
                        if (fastView[i] == undefined) {
                            numberArg = i;
                            deleteConfirmMessage = `Are you sure you want to **delete ${numberArg} fasts?:**\n` + deleteConfirmMessage;
                            break;
                        }
                        startTimeToDate = new Date(fastView[i].startTime).toLocaleString();
                        if (i == 0) {

                            if (fastView[0].endTime == null) endTimeToDate = null;
                        }
                        else {
                            endTimeToDate = new Date(fastView[i].endTime);
                        }
                        fastDuration = fastView[i].fastDuration;
                        fastBreaker = fastView[i].fastBreaker;
                        moodRating = fastView[i].mood;
                        reflectionText = fastView[i].reflection;
                        fastTargetIDs.push(fastView[i]._id);
                        fastData = `__**Fast ${i + 1}:**__\n` + fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                            fastBreaker, moodRating, reflectionText);
                        deleteConfirmMessage = deleteConfirmMessage + fastData + "\n";

                        // at the last element
                        if (i == numberArg - 1) {
                            deleteConfirmMessage = `Are you sure you want to **delete ${numberArg} fasts?:**\n` + deleteConfirmMessage;
                        }
                    }

                    if (await fn.confirmationMessage(message, deleteConfirmMessage, `Fast: Delete Past ${numberArg} Fasts`, 600000)) {
                        // Must Find the array of cursors first (map _id), then delete only args[3] of them
                        // Sort from greatest endtime => most recent!
                        console.log(`Deleting ${message.author.id}'s Past ${numberArg} Fasts`);
                        fast.collection.deleteMany({ _id: { $in: fastTargetIDs } });
                    }
                    else {
                        return;
                    }
                }
                else if (args[1].toLowerCase() == "many") {
                    if (args[2] == undefined) {
                        message.reply(fastDeleteHelp);
                        return;
                    }
                    // Get the arguments after keyword MANY
                    // Process them as comma separated values (ignore spaces)
                    // FIX REGEX TO IGNORE SPACES!
                    var toDelete = args[2].split(",");
                    var deleteConfirmMessage = "";
                    var fastTargetIDs = new Array();
                    var fastView;

                    console.log(toDelete);
                    // Remove all of the elements that are not numbers
                    toDelete.forEach((element, i) => {
                        if (isNaN(element)) {
                            toDelete.splice(i, 1);
                        }
                    });

                    // Convert String of Numbers array into Integer array
                    toDelete = toDelete.map(num => +num);
                    console.log(toDelete);

                    // Check which fasts exist, remove those that don't
                    fastView = fast.collection.find({ userID: message.author.id });
                    const existingFasts = await fastView.count();
                    for (i = 0; i < toDelete.length; i++) {
                        console.log(toDelete[i]);
                        if (toDelete[i] <= 0 || toDelete[i] > existingFasts) {
                            toDelete[i] = null;
                        }
                    }

                    // IF a toDelete element is = null, delete it
                    toDelete = toDelete.filter(element => element != null);
                    console.log(toDelete);

                    fastView = new Array();
                    for (i = 0; i < toDelete.length; i++) {
                        fastView = await fast.collection.find({ userID: message.author.id })
                            .sort({ startTime: -1 })
                            .limit(1)
                            .skip(toDelete[i])
                            .toArray();
                        console.log(fastView);
                        startTimeToDate = new Date(fastView[0].startTime).toLocaleString();
                        if (i == 0) {
                            if (fastView[0].endTime == null) endTimeToDate = null;
                        }
                        else {
                            endTimeToDate = new Date(fastView[0].endTime);
                        }
                        fastDuration = fastView[0].fastDuration;
                        fastBreaker = fastView[0].fastBreaker;
                        moodRating = fastView[0].mood;
                        reflectionText = fastView[0].reflection;
                        fastTargetIDs.push(fastView[0]._id);
                        fastData = `__**Fast ${toDelete[i]}:**__\n` + fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                            fastBreaker, moodRating, reflectionText);
                        deleteConfirmMessage = deleteConfirmMessage + fastData + "\n";

                        // at the last element
                        if (i == toDelete.length - 1) {
                            deleteConfirmMessage = `Are you sure you want to **delete fasts ${toDelete.toString()}?:**\n` + deleteConfirmMessage;
                        }
                    }
                    if (await fn.confirmationMessage(message, deleteConfirmMessage, `Fast: Delete Fasts ${toDelete}`, 600000)) {
                        console.log(`Deleting ${message.author.id}'s Fasts ${toDelete}`);
                        fast.collection.deleteMany({ _id: { $in: fastTargetIDs } });
                        return;
                    }
                }
                // They haven't specified the field for the fast delete past function
                else if (args[1] == "past") {
                    message.reply(fastDeleteHelp);
                    return;
                }
            }
            // Next: FAST DELETE ALL
            // Next: FAST DELETE MANY
            // Next: FAST DELETE

            // fast delete <NUMBER/RECENT/ALL>
            else {
                var deleteConfirmMessage = "";
                var fastTargetIDs = new Array();
                var pastNumOfEntries;
                const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded fasts?" +
                    `\n\n*(I'd suggest you* \`${prefix}fast see all\` *or* \`${prefix}fast archive all\` *first)*`;
                if (isNaN(args[1])) {
                    if (args[1].toLowerCase() == "recent") {
                        fastView = await fast.collection.find({ userID: message.author.id })
                            .sort({ startTime: -1 })
                            .limit(1)
                            .toArray();
                        if (fastView.length == 0) {
                            fn.invalidInputError(message, fastDeleteHelp, `**NO FASTS**... try \`${prefix}fast start help\``, false);
                            return;
                        }
                        startTimeToDate = new Date(fastView[0].startTime).toLocaleString();
                        if (fastView[0].endTime == null) {
                            endTimeToDate = null;
                        }
                        else {
                            endTimeToDate = new Date(fastView[0].endTime);
                        }
                        fastDuration = fastView[0].fastDuration;
                        fastBreaker = fastView[0].fastBreaker;
                        moodRating = fastView[0].mood;
                        reflectionText = fastView[0].reflection;
                        fastTargetIDs.push(fastView[0]._id);
                        deleteConfirmMessage = "Are you sure you want to **delete your most recent fast?:**\n\n__**Fast 1:**__\n" +
                            fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                                fastBreaker, moodRating, reflectionText);
                        if (await fn.confirmationMessage(message, deleteConfirmMessage, `Fast: Delete Recent Fast`, 300000)) {
                            // Must Find the array of cursors first (map _id), then delete only args[3] of them
                            // Sort from greatest endtime => most recent!
                            console.log(`Deleting ${message.author.id}'s Recent Fast`);
                            fast.collection.deleteOne({ _id: { $in: fastTargetIDs } });
                            return;
                        }
                    }
                    else if (args[1].toLowerCase() == "all") {
                        pastNumOfEntries = await fast.collection.find({ userID: message.author.id }).count();
                        if (pastNumOfEntries == 0) {
                            fn.invalidInputError(message, fastDeleteHelp, `**NO FASTS**... try \`${prefix}fast start help\``, false);
                            return;
                        }
                        let confirmDeleteAll = await fn.confirmationMessage(message, confirmDeleteAllMessage, "Fast: Delete All Fasts WARNING!");
                        if (!(await confirmDeleteAll)) return;
                        console.log(`Deleting ALL OF ${message.author.id}'s Recorded Fasts`);
                        fast.collection.deleteMany({ userID: message.author.id });
                        return;
                    }
                    else {
                        message.reply(fastDeleteHelp);
                        return;
                    }
                }
                else {
                    pastNumOfEntries = parseInt(args[1]);
                    fastView = await fast.collection
                        .find({ userID: message.author.id })
                        .sort({ startTime: -1 })
                        .limit(1)
                        .skip(pastNumOfEntries - 1)
                        .toArray()
                        .catch(err => {
                            fn.invalidInputError(message, fastDeleteHelp, "**INVALID NUMBER**...");
                            console.log(err);
                            return;
                        });
                    if (fastView.length == 0) {
                        fn.invalidInputError(message, fastDeleteTrySee, "**FAST DOES NOT EXIST**...");
                        return;
                    }
                    startTimeToDate = new Date(fastView[0].startTime).toLocaleString();
                    if (fastView[0].endTime == null) {
                        endTimeToDate = null;
                    }
                    else {
                        endTimeToDate = new Date(fastView[0].endTime);
                    }
                    fastDuration = fastView[0].fastDuration;
                    fastBreaker = fastView[0].fastBreaker;
                    moodRating = fastView[0].mood;
                    reflectionText = fastView[0].reflection;
                    fastTargetIDs.push(fastView[0]._id);
                    deleteConfirmMessage = `Are you sure you want to **delete Fast ${pastNumOfEntries}?:**\n\n__**Fast ${pastNumOfEntries}:**__\n` +
                        fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                            fastBreaker, moodRating, reflectionText);
                    if (await fn.confirmationMessage(message, deleteConfirmMessage, `Fast: Delete Fast ${pastNumOfEntries}`, 300000)) {
                        // Must Find the array of cursors first (map _id), then delete only args[3] of them
                        // Sort from greatest endtime => most recent!
                        console.log(`Deleting ${message.author.id}'s Recent Fast`);
                        fast.collection.deleteOne({ _id: { $in: fastTargetIDs } });
                        return;
                    }

                }
                //     var pastNumOfEntries;
                //     // To check if the given argument is a number!
                //     const isNumberArg = !isNaN(args[2]);
                //     var allEntries;
                //     switch (args[2]) {
                //         case "recent": pastNumOfEntries = 1;
                //             break;
                //         case "all": pastNumOfEntries = await fast.collection.countDocuments({ userID: message.author.id });
                //             break;
                //         case isNumberArg: pastNumOfEntries = args[2].parseInt();
                //             break;
                //         default:
                //             await fn.showRecentFast(message, fast, fastsInProgress, currentTimestamp);
                //             message.reply(fastDeleteHelp);
                //             return;
                //     }
            }
            break;

        case "edit":
            var fastEditUsage = `**USAGE:**\n\`${prefix}fast edit <#_MOST_RECENT_ENTRY> <force>\``
                + "\n\n`<#_MOST_RECENT_ENTRY>`: **recent; 3** (3rd most recent entry, \\**any number*)"
                + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows! (More editing capabilities in future development)**"

            fastEditUsage = new Discord.MessageEmbed()
                .setColor("#00FF00")
                .setTitle(`Fast: Fast Delete Help`)
                .setDescription(fastEditUsage);
            const fastEditHelp = `Try \`${prefix}fast edit help\``;
            const fastEditTrySee = `Try \`${prefix}fast see help\``;
            var fastView;

            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastEditUsage);
                    return;
                }
                fastView = await fast.collection
                    .find({ userID: message.author.id })
                    .count();
                // If the user has no fasts
                if (fastView == 0) {
                    message.reply(`NO FASTS... Try \`${prefix}fast start help\``);
                    return;
                }
            }
            // User typed fast edit only
            else {
                message.reply(fastEditHelp);
                return;
            }

            if (isNaN(args[1]) && args[1].toLowerCase() != "recent") {
                message.reply(fastEditHelp);
                return;
            }
            else {

                var fastView, startTimeToDate, endTimeToDate, fastDuration, fastBreaker, moodRating,
                    fastTargetID, reflectionText, editConfirmMessage, showFast;
                var fastFields = ["startTime", "endTime", "fastDuration", "fastBreaker", "mood", "reflection"];
                let fieldsView = "";
                fastFields.forEach((element, i) => {
                    fieldsView = fieldsView + `\`${i + 1}\` - ${element}\n`;
                });

                if (args[1].toLowerCase() == "recent") {
                    pastNumOfEntries = 1;
                }
                else {
                    pastNumOfEntries = parseInt(args[1]);
                }

                fastView = await fast.collection
                    .find({ userID: message.author.id })
                    .sort({ startTime: -1 })
                    .limit(1)
                    .skip(pastNumOfEntries - 1)
                    .toArray()
                    .catch(err => {
                        fn.invalidInputError(message, fastEditHelp, "**INVALID NUMBER**...");
                        console.log(err);
                        return;
                    });
                if (fastView.length == 0) {
                    fn.invalidInputError(message, fastEditTrySee, "**FAST DOES NOT EXIST**...");
                    return;
                }

                // Get user's fast at pastNumOfEntries
                startTimeToDate = new Date(fastView[0].startTime).toLocaleString();
                if (fastView[0].endTime == null) {
                    endTimeToDate = null;
                }
                else {
                    endTimeToDate = new Date(fastView[0].endTime);
                }
                fastDuration = fastView[0].fastDuration;
                fastBreaker = fastView[0].fastBreaker;
                moodRating = fastView[0].mood;
                reflectionText = fastView[0].reflection;
                fastTargetID = fastView[0]._id;
                showFast = fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                    fastBreaker, moodRating, reflectionText);

                // Field the user wants to edit
                do {
                    fieldToEdit = await fn.messageDataCollectFirst(message, `**Which field do you want to edit?:**\n ${fieldsView}`
                        + `\n***NO \`<START/END_DATE/TIME>\` EDITING YET*** AND \n**\`fastDuration\`** CAN ONLY BE CHANGED TO **\`now\`**,\n(In Development...)\n\n__**Fast ${pastNumOfEntries}:**__\n${showFast}`,
                        "Fast: Fast Edit Field", "00FF00", 180000);
                    if (fieldToEdit === false) return;
                    if (isNaN(fieldToEdit)) {
                        if (fieldToEdit.toLowerCase() == "stop") return;
                        else {
                            message.reply("Please enter a number on the given list!")
                                .then(msg => {
                                    msg.delete({ timeout: 5000 });
                                })
                                .catch(err => console.error(err));
                        }
                    }
                    else if (parseInt(fieldToEdit) > fastFields.length || parseInt(fieldToEdit) <= 0) {
                        message.reply("Please enter a number on the given list!")
                            .then(msg => {
                                msg.delete({ timeout: 5000 });
                            })
                            .catch(err => console.error(err));
                    }
                    else {
                        // Minus 1 to convert to back array index (was +1 for user understanding)
                        fieldToEdit = parseInt(fieldToEdit) - 1;
                        break;
                    }
                }
                while (true)

                let messageIndex = 0;
                var collectedEdit, userEdit;
                fastEditMessagePrompt = `**What will you change your *${fastFields[fieldToEdit]}* to?:**\n`;
                if (fieldToEdit == 2) {
                    fastEditMessagePrompt = fastEditMessagePrompt + "***(ONLY possible edit = `now`)***\n";
                }
                else if (fieldToEdit == 4) {
                    fastEditMessagePrompt = fastEditMessagePrompt + "***(Please enter a number from `1-5`)***\n";
                }
                else if (fieldToEdit == 5) {
                    fastEditMessagePrompt = fastEditMessagePrompt + "__**Reflection Questions:**__\n-__Why__ did you feel that way?\n"
                        + "- What did you do that made it great? / What could you have done to __make it better__?\n";
                }
                fastEditMessagePrompt = fastEditMessagePrompt + `\nType \`0\` when you're **done!**\n`;


                // Collect User Edit
                do {
                    messageIndex++;
                    collectedEdit = await fn.messageDataCollectFirst(message, fastEditMessagePrompt, "Fast: Fast Edit", "00FF00", 600000);
                    if (collectedEdit === false) return;
                    if (messageIndex === 1) {
                        if (collectedEdit == "0") break;
                        fastEditMessagePrompt = fastEditMessagePrompt + "\n**Current Edit:**\n" + collectedEdit + "\n";
                        userEdit = collectedEdit;
                    }
                    else if (collectedEdit == "0") break;
                    else {
                        fastEditMessagePrompt = fastEditMessagePrompt + collectedEdit + "\n";
                        userEdit = "\n" + userEdit + collectedEdit + "\n";
                    }
                    if (collectedEdit == "stop") return;
                }
                while (true)
                console.log(userEdit);

                // Show user updated fast!
                if (fieldToEdit == 2) {
                    userEdit = userEdit.split(/ +/);
                    console.log(userEdit);
                    fastDuration = fn.timeCommandHandler(userEdit, message.createdAt);
                }
                else if (fieldToEdit == 3) fastBreaker = userEdit;
                else if (fieldToEdit == 4) {
                    if (!isNaN(userEdit)) {
                        if (parseInt(userEdit) > 0 || parseInt(userEdit) <= 5) {
                            moodRating = userEdit;
                        }
                    }
                }
                else if (fieldToEdit == 5) reflectionText = userEdit;

                showFast = fn.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
                    fastBreaker, moodRating, reflectionText);

                editConfirmMessage = `Are you sure you want to **edit fast ${pastNumOfEntries}'s ${fastFields[fieldToEdit]}?:**\n\n__**Fast ${pastNumOfEntries}:**__\n` + showFast;
                if (await fn.confirmationMessage(message, editConfirmMessage, `Fast: Edit Fast ${pastNumOfEntries}`, 300000)) {
                    console.log(`Editing ${message.author.id}'s Fast ${pastNumOfEntries}`);

                    switch (fieldToEdit) {
                        case 0:
                            fast.collection.updateOne({ _id: fastTargetID }, { $set: { startTime: startTimestamp } })
                                .catch(err => console.error(err));
                            break;
                        case 1:
                            fast.collection.updateOne({ _id: fastTargetID }, { $set: { endTime: endTimestamp } })
                                .catch(err => console.error(err));
                            break;
                        case 2:
                            fast.collection.updateOne({ _id: fastTargetID }, { $set: { fastDuration: fastDuration } })
                                .catch(err => console.error(err));
                            break;
                        case 3:
                            fast.collection.updateOne({ _id: fastTargetID }, { $set: { fastBreaker: fastBreaker } })
                                .catch(err => console.error(err));
                            break;
                        case 4:
                            fast.collection.updateOne({ _id: fastTargetID }, { $set: { mood: moodRating } })
                                .catch(err => console.error(err));
                            break;
                        case 5:
                            fast.collection.updateOne({ _id: fastTargetID }, { $set: { reflection: reflectionText } })
                                .catch(err => console.error(err));
                            break;
                    }
                    return;
                }
                else {
                    message.reply("**Exiting... This was your edit!: (Deleting in 10 minutes)**\n" + userEdit)
                        .then(msg => {
                            msg.delete({ timeout: 600000 });
                        })
                        .catch(err => console.error(err));
                    return;
                }

            }
            break;

        // ALIAS: "send"
        // case "post":
        //     if()
        // break;

        default:
            message.reply(usageHelp);
            break;
    }
}

module.exports.help = {
    name: "fast",
    aliases: ["if", "fasts"]
}