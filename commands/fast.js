// Global Variable Delclarations and Initializations
const Discord = require("discord.js");
const Fast = require("../models/fasting.js");
const UserSettings = require("../models/usersettings");
const mongoose = require("mongoose");
const fn = require("../utils/functions");
require("dotenv").config();
const PREFIX = process.env.PREFIX;
const fastEmbedColour = "#32CD32";

// REDESIGNED:
// Computed Property Names
// Using Object Destructuring

// Function Declarations and Definitions
function fastDataArrayToString(fastData, showFastEndMessage) {
    const [startTimestamp, endTimestamp, fastDuration, fastBreaker, moodRating, reflectionText] = fastData;
    const startTimeToDate = new Date(startTimestamp).toLocaleString();
    var endTimeToDate;
    if (endTimestamp === null) {
        endTimeToDate = null;
    }
    else {
        endTimeToDate = new Date(endTimestamp).toLocaleString();
    }
    let fastDataString = `**Start Time:** ${startTimeToDate}\n` +
        `**End Time:** ${endTimeToDate}\n` +
        `**Fast Duration:** ${fn.millisecondsToTimeString(fastDuration)}\n` +
        `**Fast Breaker:** ${fastBreaker}\n` +
        `**Mood Rating (1-5):** ${moodRating}\n` +
        `**Reflection:** ${reflectionText}\n`;
    if (showFastEndMessage) {
        fastDataString += "\n(Want to end your fast? `?fast end`";
    }
    return fastDataString;
}
function fastCursorToDataArray(fastCursor, calculateFastDuration = false, updateShownEndTime = false, endTimestamp = null) {
    var fastDataArray;
    const givenEndTimestamp = endTimestamp;
    const startTimestamp = fastCursor.startTime;
    // Calculate Fast Duration => endTime is not defined yet!
    if (updateShownEndTime === true) {
        endTimestamp = endTimestamp;
    }
    else {
        endTimestamp = fastCursor.endTime;
    }
    var fastDuration;
    if (calculateFastDuration) {
        if (givenEndTimestamp !== null) {
            fastDuration = givenEndTimestamp - startTimestamp;
        }
        else {
            let currentTimestamp = new Date();
            fastDuration = currentTimestamp - startTimestamp;
        }
    }
    else {
        fastDuration = fastCursor.fastDuration;
    }
    const fastBreaker = fastCursor.fastBreaker;
    const moodRating = fastCursor.mood;
    const reflectionText = fastCursor.reflection;
    fastDataArray = [startTimestamp, endTimestamp, fastDuration, fastBreaker, moodRating, reflectionText];
    return fastDataArray;
}
async function getRecentFast(message, fast, fastIsInProgress, currentTimestamp) {
    var fastView, fastType, fastData, fastDataToString, fastEmbed;
    if (fastIsInProgress === true) {
        // Show the user the current fast
        fastView = await fast.collection.findOne({
            userID: message.author.id,
            endTime: null
        })
            .catch(err => console.error(err));
        fastType = "Current";
        fastData = fastCursorToDataArray(fastView, true);
    }
    else {
        // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
        // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
        // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
        fastView = await fast.collection
            .find({ userID: message.author.id })
            .sort({ endTime: -1 })
            .limit(1)
            .toArray();
        fastView = fastView[0];
        fastType = "Previous";
        fastData = fastCursorToDataArray(fastView);
    }
    fastDataToString = `__**Fast 1:**__\n${fastDataArrayToString(fastData)}`;
    if (fastIsInProgress === true) {
        fastDataToString = fastDataToString + `\n(Want to end your fast? \`${PREFIX}fast end\`)`;
    }
    fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See ${fastType} Fast`, fastEmbedColour);
    return (fastEmbed);
}
async function getEditEndConfirmation(userOriginalMessageObject, field, userEdit, forceSkip = false) {
    const resetWarningMessage = `**Are you sure you want to change your ${field} to:**\n${userEdit}`;
    let endEditConfirmation = await fn.getUserConfirmation(userOriginalMessageObject, resetWarningMessage, forceSkip, `Fast: Edit ${field} Confirmation`);
    return endEditConfirmation;
}
async function getUserEdit(userOriginalMessageObject, fastFields, fieldToEdit, forceSkip = false) {
    let messageIndex = 0;
    let reset = false;
    var collectedEdit, userEdit;
    let field = fastFields[fieldToEdit]
    fastEditMessagePrompt = `**What will you change your *${field}* to?:**\n`;
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
    fastEditMessagePrompt = fastEditMessagePrompt + `\nType \`0\` to **restart/clear** your current edit!`
        + `\nType \`1\` when you're **done!**\n`;
    const fastEditMessagePromptOriginal = fastEditMessagePrompt;
    do {
        messageIndex++;
        collectedEdit = await fn.messageDataCollectFirst(userOriginalMessageObject, fastEditMessagePrompt, "Fast: Edit", "00FF00", 600000);
        if (collectedEdit === "stop") {
            return false;
        }
        if (messageIndex === 1 || reset === true) {
            if (collectedEdit == "1") {
                let endEditConfirmation = await getEditEndConfirmation(userOriginalMessageObject, field, userEdit, forceSkip);
                if (endEditConfirmation === true) {
                    break;
                }
            }
            else if (collectedEdit != "0") {
                fastEditMessagePrompt = fastEditMessagePrompt + "\n**Current Edit:**\n" + collectedEdit + "\n";
                userEdit = collectedEdit + "\n";
                reset = false;
            }
        }
        else if (collectedEdit == "1") {
            let endEditConfirmation = await getEditEndConfirmation(userOriginalMessageObject, field, userEdit, forceSkip);
            if (endEditConfirmation === true) {
                break;
            }
        }
        else if (collectedEdit == "0") {
            const resetWarningMessage = "Are you sure you want to __**reset**__ your current edit?\n*(All of your current edit will be lost...)*";
            let resetConfirmation = await fn.getUserConfirmation(userOriginalMessageObject, resetWarningMessage, forceSkip, `Fast: Edit ${field} Reset`);
            if (resetConfirmation === true) {
                fastEditMessagePrompt = fastEditMessagePromptOriginal;
                userEdit = "";
                reset = true;
            }
        }
        else {
            fastEditMessagePrompt = fastEditMessagePrompt + collectedEdit + "\n";
            userEdit = "\n" + userEdit + collectedEdit + "\n";
        }
    }
    while (true)
    return userEdit;
}
async function confirmPostOverwrite(userOriginalMessageObject, overwriteReplaceWith, forceSkip = false, overwriteTitle = "Overwrite") {
    let confirmOverwrite = await fn.getUserConfirmation(userOriginalMessageObject, "Are you sure you want to "
        + `**overwrite** your current message with a ${overwriteReplaceWith}?`
        + "\n\n(**Your current message progress will be lost**, the latest image sent will be posted, unless you did `remove`)",
        forceSkip, `Fast Post: Overwrite with ${overwriteTitle}`, 60000, 0, "\n\nSelect ✅ to **overwrite and post**\nSelect ❌ to **continue with message creation**")
        .catch(err => console.error(err));
    return confirmOverwrite;
}
function attachedIsImage(messageAttachment) {
    var url = messageAttachment.url;
    console.log({ url });
    // Return true if the url is of a png, jpg or jpeg image
    return (url.indexOf(".png", url.length - 4) !== -1
        || url.indexOf(".jpeg", url.length - 5) !== -1
        || url.indexOf(".jpg", url.length - 4) !== -1);
}
async function findFirstAttachment(attachmentArray) {
    var attachment;
    await attachmentArray.forEach((currentAttachment, i) => {
        if (attachedIsImage(currentAttachment)) {
            attachment = currentAttachment.url;
            return;
        }
    })
    return attachment;
}
function addUserTag(userOriginalMessageObject, post) {
    return `<@${userOriginalMessageObject.author.id}>\n${post}`;
}
// Designed not to break when userConfirmation = ❌ (FALSE), but only stop when `stop`
async function getFastPostEmbed(userOriginalMessageObject, fastData, forceSkip = false) {
    const [startTimestamp, endTimestamp, fastDurationTimestamp, fastBreaker, moodValue, reflectionText] = fastData;
    let messageIndex = 0;
    let fastPost = "";
    let attachment = null;
    var collectedMessage = "", collectedObject;
    var fastPostMessagePrompt = "Please enter the message(s) you'd like to send. (you can send pictures!)"
        + "\nThe latest picture you send will be attached to the post for ALL options below (except stop):"
        + "\nType `0` for **default message with fast breaker**\nType `1` when **done**!\nType `2` **to post full fast**"
        + "\nType `remove` to remove the attached image";
    // Loop to collect the first message given and store it, if that message is 0, 1, or stop then handle accordingly
    // Detect and store images, allow user to remove image before posting!
    do {
        messageIndex++;
        console.log({ attachment });
        if (attachment === null) {
            collectedObject = await fn.messageDataCollectFirstObject(userOriginalMessageObject, fastPostMessagePrompt, "Fast: Post Creation", fastEmbedColour, 1800000,
                true, 3000);
        }
        else {
            collectedObject = await fn.messageDataCollectFirstObject(userOriginalMessageObject, fastPostMessagePrompt, "Fast: Post Creation", fastEmbedColour, 1800000,
                true, 3000, true, attachment);
        }
        // If user types stop, messageDataCollectFirstObject returns false:
        if (collectedObject === false) {
            return false;
        }
        collectedMessage = collectedObject.content;
        if (messageIndex === 1) {
            if (collectedMessage == "1") {
                break;
            }
            let attachmentArray = collectedObject.attachments;
            console.log({ attachmentArray });
            if (attachmentArray.size > 0) {
                // Just check and post the first image
                if (attachmentArray.some(attachedIsImage)) {
                    attachment = await findFirstAttachment(attachmentArray);
                }
            }
            if (collectedMessage == "0" || collectedMessage == "2" || collectedMessage == "remove") {
                messageIndex--;
            }
            else {
                fastPostMessagePrompt += `\n**Current Message:**\n${collectedMessage}\n`;
                fastPost = collectedMessage + "\n";
            }
        }
        else if (collectedMessage != "0" && collectedMessage != "1" && collectedMessage != "2" && collectedMessage != "remove") {
            let attachmentArray = collectedObject.attachments;
            console.log({ attachmentArray });
            if (attachmentArray.size > 0) {
                // Just check and post the first image
                if (attachmentArray.some(attachedIsImage)) {
                    attachment = await findFirstAttachment(attachmentArray);
                    if (collectedMessage != "") {
                        fastPostMessagePrompt = fastPostMessagePrompt + collectedMessage + "\n";
                        fastPost = fastPost + collectedMessage + "\n";
                    }
                }
            }
            else {
                fastPostMessagePrompt = fastPostMessagePrompt + collectedMessage + "\n";
                fastPost = fastPost + collectedMessage + "\n";
            }
        }
        if (collectedMessage == "remove" && attachment !== null) {
            userOriginalMessageObject.reply("**Attachment Removed!**")
                .then(msg => {
                    msg.delete({ timeout: 30000 });
                })
                .catch(err => console.error(err));
            attachment = null;
        }
        if (collectedMessage == "stop") return false;
        if (collectedMessage == "1") {
            fastPost = addUserTag(userOriginalMessageObject, fastPost);
            break;
        }
        if (collectedMessage == "0") {
            // Overwrite any previously collected data: Confirm first, if confirmed exit and post, otherwise continue loop
            let confirmOverwrite = await confirmPostOverwrite(userOriginalMessageObject, "default message including the **time and your fast breaker** (if you entered one)",
                forceSkip, "Default Post");
            if (confirmOverwrite === true) {
                if (fastBreaker == null) {
                    fastPost = addUserTag(userOriginalMessageObject, `Broke my **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast!`);
                    break;
                }
                else {
                    fastPost = addUserTag(userOriginalMessageObject, `Broke my **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast with **${fastBreaker}**!`);
                    break;
                }
            }
        }
        if (collectedMessage == "2") {
            // Overwrite any previously collected data: Confirm first, if confirmed exit and post, otherwise continue loop
            let confirmOverwrite = await confirmPostOverwrite(userOriginalMessageObject, "**full fast post (including mood and reflection)**", forceSkip, "Full Fast Post");
            if (confirmOverwrite === true) {
                fastPost = addUserTag(userOriginalMessageObject, fastDataArrayToString(fastData));
                break;
            }
        }
    }
    while (true)
    if (attachment === null) {
        fastPost = await fn.getMessageEmbed(fastPost, "Fast Post", fastEmbedColour);
    }
    else {
        fastPost = await fn.getMessageImageEmbed(attachment, fastPost, "Fast Post", fastEmbedColour);
    }
    return fastPost;
}

async function showFastPost(userOriginalMessageObject, fastPost, mistakeMessage, deleteFastPost = false) {
    if (deleteFastPost == false) {
        userOriginalMessageObject.reply("**Here was your post:**");
        userOriginalMessageObject.channel.send(fastPost);
    }
    else {
        userOriginalMessageObject.reply("**Here was your post:** (deleting in 10 minutes)")
            .then(msg => {
                msg.delete({ timeout: 600000 });
            })
            .catch(err => console.error(err));
        userOriginalMessageObject.channel.send(fastPost)
            .then(msg => {
                msg.delete({ timeout: 600000 });
            })
            .catch(err => console.error(err));
    }
    userOriginalMessageObject.reply(mistakeMessage);
    return;
}

async function postFast(bot, userOriginalMessageObject, fastPost, endTimestamp, forceSkip = false) {
    // FUTURE: On the sent post, there will be a reaction collect and it will allow the user to edit or delete their post!
    // TAGGED @user in the post so that you can retrieve this information with partials! (getting the first @user.author.id): "@user 's fast:"
    var endTimeToDate;
    if(endTimestamp === null) {
        endTimeToDate = new Date().toLocaleString();
    }
    else {
        endTimeToDate = new Date(endTimestamp).toLocaleString();
    }
    const authorID = userOriginalMessageObject.author.id;

    // Check all the servers the bot is in
    let botServers = await bot.guilds.cache.map(guild => guild.id);
    console.log({ botServers });

    // Find all the mutual servers with the user and bot
    var botUserMutualServerIDs = await fn.userAndBotMutualServerIDs(bot, userOriginalMessageObject, botServers);
    var targetServerIndex, targetChannelIndex;
    var channelList;
    var confirmSendToChannel = false;
    var channelListDisplay;
    const channelSelectInstructions = "Type the number corresponding to the channel you want to post in:";
    const serverSelectInstructions = "Type the number corresponding to the server you want to post in:";
    const postToServerTitle = "Fast: Post to Server";
    const postToChannelTitle = "Fast: Post to Channel";
    const mistakeMessage = `Exiting... try \`${PREFIX}fast post\` to try to **post again!**`;
    var serverList = await fn.listOfServerNames(bot, botUserMutualServerIDs);
    targetServerIndex = await fn.userSelectFromList(userOriginalMessageObject, serverList, botUserMutualServerIDs.length,
        serverSelectInstructions, postToServerTitle, "00FF00");
    if (targetServerIndex === false) {
        await showFastPost(userOriginalMessageObject, fastPost, mistakeMessage);
        return false;
    }
    channelList = await fn.listOfServerTextChannelsUserCanSendTo(bot, userOriginalMessageObject, botServers[targetServerIndex]);
    if (channelList.length == 0) {
        userOriginalMessageObject.reply("This server has **no channels!** EXITING...")
            .then(msg => {
                msg.delete({ timeout: 5000 });
            })
            .catch(err => console.error(err));
        return false;
    }
    channelListDisplay = await fn.listOfChannelNames(bot, channelList);
    while (confirmSendToChannel === false) {
        targetChannelIndex = await fn.userSelectFromList(userOriginalMessageObject, channelListDisplay, channelList.length,
            channelSelectInstructions, postToChannelTitle, "00FF00", 300000);
        if (targetChannelIndex === false) {
            await showFastPost(userOriginalMessageObject, fastPost, mistakeMessage);
            return false;
        }
        console.log({ targetChannelIndex })
        let targetChannelName = await bot.channels.cache.get(channelList[targetChannelIndex]).name;
        confirmSendToChannel = await fn.getUserConfirmation(userOriginalMessageObject, `Are you sure you want to send it to **#${targetChannelName}**?`, forceSkip);
    }
    // Overwrite fastPost Title with one specific to user's nickname in respective server
    fastPost = fastPost.setTitle(`${bot.guilds.cache.get(botServers[targetServerIndex]).member(authorID).displayName}'s ${endTimeToDate} Fast`);
    await fn.sendMessageToChannel(bot, fastPost, channelList[targetChannelIndex]);
    return true;
}

async function userFastIndexOf(fastCollectionDocument, userID, pastNumberOfEntriesIndex, numberOfEntries = 1) {
    fastView = await fastCollectionDocument.collection
        .find({ userID: userID })
        .sort({ startTime: -1 })
        .limit(numberOfEntries)
        .skip(pastNumberOfEntriesIndex)
        .toArray()
        .catch(err => {
            console.log(err);
            return [];
        });
    if (fastView.length > 0) {
        console.log(fastView);
        return fastView;
    }
}

module.exports.run = async (bot, message, args) => {
    // Variable Declarations and Initializations
    var fastUsageMessage = `**USAGE:**\n\`${PREFIX}fast <ACTION>\`\n\n`
        + "`<ACTION>`: **help; start; end; see; edit; delete; see <PAST_#_OF_ENTRIES>; see <recent OR all>**";
    fastUsageMessage = fn.getMessageEmbed(fastUsageMessage, "Fast: Help", fastEmbedColour);
    const fastHelpMessage = `Try \`${PREFIX}fast help\``;
    const authorID = message.author.id;
    const authorUsername = message.author.username;
    const forceSkip = fn.getForceSkip(args);
    let fastCommand = args[0];
    // Before declaration of more variables - check if the user has any arguments
    if (fastCommand === undefined || args.length == 0) {
        fn.sendErrorMessageAndUsage(message, fastHelpMessage);
        return;
    }
    fastCommand = fastCommand.toLowerCase();

    let fastCollectionDocument = new Fast();
    const fastInProgress = fastCollectionDocument.collection.find({
        userID: authorID,
        endTime: null
    });
    const fastIsInProgress = (await fastInProgress.count() >= 1);
    // Computed Property Names: Reduces code footprint
    console.log({ authorUsername, authorID, fastIsInProgress });

    var startTimestamp, currentTimestamp;

    if (fastCommand == "help") {
        message.channel.send(fastUsageMessage);
        return;
    }


    else if (fastCommand == "start" || fastCommand == "st" || fastCommand == "s") {
        // Check if the user does not already have a fast in progress, otherwise start.
        // Using greater than equal to ensure error message sent even though 
        // Any given user should not be able to have more than 1 fast running at a time
        var fastStartUsageMessage = `**USAGE:**\n\`${PREFIX}fast start <DATE/TIME>\`\n\n`
            + "`<DATE/TIME>`: **now**\n\n(more features in development, i.e. set fast goal time + fast reminder,  and <DATE/TIME> natural language processor";
        fastStartUsageMessage = fn.getMessageEmbed(fastStartUsageMessage, `Fast: Start Help`, fastEmbedColour);
        const fastStartHelpMessage = `Try \`${PREFIX}fast start help\``;
        const fastIsRunningMessage = `You already have a **fast running!**\nIf you want to **restart** it try \`${PREFIX}fast edit help\``
            + `\nIf you want to **delete** the fast entry altogether try \`${PREFIX}fast delete help\``;
        if (args[1] != undefined) {
            if (args[1].toLowerCase() == "help") {
                message.channel.send(fastStartUsageMessage);
                return;
            }
        }
        if (fastIsInProgress >= 1) {
            message.reply(fastIsRunningMessage); return;
        }
        else if (args[1] == undefined || args.length == 1) {
            message.reply(fastStartHelpMessage); return;
        }
        else {
            // Remove the "start" from the args using slice
            const startTimeArgs = args.slice(1);
            startTimestamp = fn.timeCommandHandler(startTimeArgs, message.createdTimestamp);
            if (startTimestamp == false) {
                message.reply(fastStartHelpMessage); return;
            }
            fastCollectionDocument = new Fast({
                _id: mongoose.Types.ObjectId(),
                userID: authorID,
                //using new Date().getTime() gives the time in milliseconds since Jan 1, 1970 00:00:00
                startTime: startTimestamp,

                //if the endTime or fastDuration is null that indicates that the fast is still going
                endTime: null,
                fastDuration: null,
                fastBreaker: null,
                mood: null,
                reflection: null
            });

            fastCollectionDocument.save()
                .then(result => console.log(result))
                .catch(err => console.log(err));

            message.reply(`Your fast starting **${startTimeArgs}** is being recorded!`);
        }
    }


    else if (fastCommand == "end" || fastCommand == "e" || fastCommand == "s") {
        var fastEndUsageMessage = `**USAGE:**\n\`${PREFIX}fast end <DATE/TIME> <force>\`\n\n`
            + "`<DATE/TIME>`: **now**\n\n(more features in development, end with <DATE/TIME> that is not just now)"
            + "\n\n`<force>`: type **force** at the end of your command to **skip all of the confimation windows!**";
        fastEndUsageMessage = fn.getMessageEmbed(fastEndUsageMessage, `Fast: End Help`, fastEmbedColour);
        const fastEndHelpMessage = `Try \`${PREFIX}fast end help\``;
        const noFastRunningMessage = `You don't have a **fast running!**\nIf you want to **start** one \`${PREFIX}fast start <DATE/TIME>\``;

        if (args[1] != undefined) {
            if (args[1].toLowerCase() == "help") {
                message.channel.send(fastEndUsageMessage);
                return;
            }
        }
        if (fastIsInProgress == 0) {
            message.reply(noFastRunningMessage);
        }
        else if (args[1] == undefined || args.length == 1) {
            message.reply(fastEndHelpMessage); return;
        }
        else {
            // FOR Handling when the user's fast ending time is not now!
            // Remove the "end" from the args using slice
            const endTimeArgs = args.slice(1);
            const endTimestamp = fn.timeCommandHandler(endTimeArgs, message.createdTimestamp);
            if (endTimestamp == false) {
                message.reply(fastEndHelpMessage); return;
            }

            const currentFast = await fastInProgress
                .sort({ startTime: -1 })
                .limit(1)
                .toArray();
            // Can use authorID in this case as well, but will stick to pulling the
            // value from the database - to ensure the user is correct!
            const currentFastUserID = currentFast[0].userID;
            startTimestamp = currentFast[0].startTime;
            const fastDurationTimestamp = endTimestamp - startTimestamp;
            console.log({ currentFastUserID, startTimestamp, fastDurationTimestamp });

            // EVEN if the time is not now it will be handled accordingly
            const quickEndMessage = `**✅ - Log additional information: fast breaker, mood, reflection**` +
                `\n**⌚ - Quickly log** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast now` +
                `\n**❌ - Exit**` +
                `\n\n\\*IF \`<DATE/TIME>\` is at a **FUTURE time**: (use ⌚)\\* (you can always \`${PREFIX}fast edit\`)`;
            const quickEndEmojis = ["✅", "❌", "⌚"];
            var endConfirmation = `Are you sure you want to **end** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast?`;
            const fastBreakerPrompt = "**What did you break your fast with?** \n\nType `skip` to **skip** (will **continue**, but log it as blank)";
            const moodValuePrompt = "**How did you feel during this past fast?\n\nEnter a number from 1-5 (1 = worst, 5 = best)**\n`5`-😄; `4`-🙂; `3`-😐; `2`-😔; `1`-😖;";
            var reflectionTextPrompt = "**Elaborate? For Example:\n - __Why__ did you feel that way?\n - What did you do that made it great? / What could you have done to __make it better__?**" +
                "\n\nType `1` when **done**\nType `skip` to **skip** (will **continue**, but log it as blank)\nType `reset` to **reset** your current reflection message";
            const reflectionTextPromptOriginal = reflectionTextPrompt;
            let quickEnd = await fn.reactionDataCollect(message, quickEndMessage, quickEndEmojis, "Fast: Quick End?", fastEmbedColour, 180000)
                .catch(err => console.error(err));
            var fastBreaker, moodValue, reflectionText;
            if (quickEnd == "❌") {
                return;
            }
            else if (quickEnd == "✅") {
                // Send message and as for fastBreaker and upload a picture too
                // which can be referenced later or sent to a server when DMs are handled!
                fastBreaker = await fn.messageDataCollectFirst(message, fastBreakerPrompt, "Fast: Fast Breaker", fastEmbedColour, 300000);
                console.log({ fastBreaker });
                if (fastBreaker === false || fastBreaker == "stop") {
                    return;
                }
                else if (fastBreaker == "skip") {
                    fastBreaker = null;
                }

                moodValue = await fn.userSelectFromList(message, "", 5, moodValuePrompt, "Fast: Mood Assessment", fastEmbedColour);
                if (moodValue === false) {
                    return;
                }
                var reflectionText;
                let messageIndex = 0;
                let reset = false;
                do {
                    let userReflection = await fn.messageDataCollectFirst(message, reflectionTextPrompt, "Fast: Reflection", fastEmbedColour, 900000);
                    if (userReflection === false) {
                        return;
                    }
                    if (userReflection == "1") {
                        break;
                    }
                    else if (userReflection == "reset") {
                        let confirmReset = await fn.getUserConfirmation(message, "Are you sure you want to **reset/clear** your current message?\nYour current reflection entry will be lost!",
                            forceSkip, "Fast: Reset Reflection Confirmation");
                        if (confirmReset === true) {
                            reflectionTextPrompt = reflectionTextPromptOriginal;
                            reflectionText = "";
                            reset = true;
                        }
                    }
                    else if (userReflection == "stop") {
                        return;
                    }
                    else if (userReflection == "skip") {
                        // Overwrite any previously collected data: Make sure the user wants to do that
                        let confirmSkip = await fn.getUserConfirmation(message, "Are you sure you want to **skip?**\nYour current reflection entry will be lost!",
                            forceSkip, "Fast: Skip Reflection Confirmation");
                        if (confirmSkip === true) {
                            reflectionText = null;
                            break;
                        }
                    }
                    else {
                        if (messageIndex == 0 || reset === true) {
                            reflectionTextPrompt = reflectionTextPrompt + "\n\n**Current Reflection Message:**\n" + userReflection + "\n";
                            reflectionText = userReflection + "\n";
                            reset = false;
                        }
                        else {
                            reflectionTextPrompt = reflectionTextPrompt + userReflection + "\n";
                            reflectionText = reflectionText + userReflection + "\n";
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
            const confirmation = await fn.getUserConfirmation(message, endConfirmation, forceSkip)
                .catch(err => console.error(err));
            console.log(`Confirmation function call: ${confirmation}`);
            if (confirmation === false) {
                return;
            }
            const fastData = [startTimestamp, endTimestamp, fastDurationTimestamp, fastBreaker, moodValue, reflectionText];
            fastCollectionDocument.collection.updateOne({
                userID: authorID,
                endTime: null
            },
                {
                    $set: {
                        fastDuration: fastDurationTimestamp,
                        endTime: endTimestamp,
                        fastBreaker: fastBreaker,
                        mood: moodValue,
                        reflection: reflectionText
                    }
                })
                // Posting the fast
                .then(async () => {
                    message.reply(`You have successfully logged your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast!`);
                    const confirmPostFastMessage = "Would you like to take a **picture** of your **fast breaker** *and/or* **send a message** to a server channel? (for accountability!)"
                        + "\n\n(if ✅, I will list the servers you're in to find the channel you want to post to!)";
                    let confirmPostFast = await fn.getUserConfirmation(message, confirmPostFastMessage, forceSkip, "Send Message for Accountability?", 180000, 0)
                        .catch(err => console.error(err))
                    if (confirmPostFast === false) {
                        return;
                    }
                    else {
                        let fastPost = await getFastPostEmbed(message, fastData, forceSkip);
                        if (fastPost === false) {
                            return;
                        }
                        await postFast(bot, message, fastPost, endTimestamp, forceSkip);
                    }
                })
                .catch(err => console.error(`Failed to end fast ${err}`));
        }
    }


    else if (fastCommand == "see" || fastCommand == "view" || fastCommand == "find"
        || fastCommand == "look" || fastCommand == "lookup" || fastCommand == "show") {
        // Will add the ability to gather all of the user's data into a spreadsheet or note/JSON file!
        // **Handle users who do not yet have a fast!
        var fastSeeUsageMessage = `**USAGE:**\n\`${PREFIX}fast see past <PAST_#_OF_ENTRIES> <FIELD> <force>\`\n\`${PREFIX}fast see <#_MOST_RECENT_ENTRY> <FIELD> <force>\``
            + `\n\`${PREFIX}fast see <#_OF_ENTRIES> past <STARTING_INDEX> <FIELD> <force>\`\n\`${PREFIX}fast see <number>\``
            + `\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; all; 5** (\\*any number)`
            + `\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\*any number)`
            + `\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; all** (returns entire history); **3 **(3rd most recent entry, \\**any number*)`
            + `\n\n\`<STARTING_INDEX>\`: **4** (any number); (you want to see \`<#_OF_ENTRIES>\` past the 4th fast)`
            + `\n\n\`<number>\`: type **number** (shows you the number of fasts you have on record))`
            + "\n\n`<FIELD>`(OPT.): **start; end; fastbreaker; duration; reflection** (includes mood); *Default:* all fields\n(if MULTIPLE `<FIELD>`s: separate by space!)"
            + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows!**";
        fastSeeUsageMessage = fn.getMessageEmbed(fastSeeUsageMessage, `Fast: See Help`, fastEmbedColour);
        const fastSeeHelpMessage = `**INVALID USAGE**... Try \`${PREFIX}fast see help\``;

        // If the user wants fast help, do not proceed to show them the fast.
        const seeCommands = ["past", "recent", "all"];
        var fastView, fastDataToString, startTimeToDate, endTimeToDate, fastDuration, fastBreaker, moodRating, reflectionText;
        currentTimestamp = fn.timeCommandHandler(["now"], message.createdTimestamp);

        // MAKE THIS OPERATION INTO A FUNCTION!
        if (args[1] != undefined) {
            if (args[1].toLowerCase() == "help") {
                message.channel.send(fastSeeUsageMessage);
                return;
            }
            fastView = await fastCollectionDocument.collection
                .find({ userID: authorID })
                .count();
            // If the user has no fasts
            if (fastView == 0) {
                message.reply(`NO FASTS... try \`${PREFIX}fast start help\``);
                return;
            }
            else if (args[1].toLowerCase() == "number") {
                message.reply(`You have **${fastView} fasts** on record.`);
                return;
            }
        }
        // fast see (only):
        else {
            message.reply(`Try \`${PREFIX}fast see help\``);
            return;
        }
        // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
        // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
        // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
        if (!seeCommands.includes(args[1]) && isNaN(args[1])) {
            message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
            message.reply(fastSeeHelpMessage);
            return;
        }
        // Do not show the most recent fast embed, when a valid command is called
        // it will be handled properly later based on the values passed in!
        else {
            const seeType = args[1].toLowerCase();
            var pastFunctionality;
            var pastNumberOfEntriesIndex;
            // To check if the given argument is a number!
            // If it's not a number and has passed the initial 
            // filter, then use the "past" functionality
            // Handling Argument 1:
            const isNumberArg = !isNaN(args[1]);
            if (seeType == "recent") {
                message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
                return;
            }
            else if (seeType == "all") {
                pastNumberOfEntriesIndex = await fastCollectionDocument.collection.find({ userID: authorID }).count();
                pastFunctionality = true;
            }
            else if (isNumberArg) {
                pastNumberOfEntriesIndex = parseInt(args[1]);
                if (pastNumberOfEntriesIndex <= 0) {
                    fn.sendErrorMessageAndUsage(message, fastSeeHelpMessage, "**FAST DOES NOT EXIST**...");
                    return;
                }
                else pastFunctionality = false;
            }
            else if (seeType == "past") {
                pastFunctionality = true;
            }
            // After this filter:
            // If the first argument after "see" is not past, then it is not a valid call
            else {
                message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
                message.reply(fastSeeHelpMessage);
                return;
            }
            console.log({ pastNumberOfEntriesIndex, pastFunctionality });
            if (pastFunctionality) {
                // Loop through all of the given fields, account for aliases and update fields
                // Find Entries, toArray, store data in meaningful output
                if (args[2] != undefined) {
                    // If the next argument is NotaNumber, invalid "past" command call
                    if (isNaN(args[2])) {
                        message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
                        message.reply(fastSeeHelpMessage);
                        return;
                    }
                    if (parseInt(args[2]) <= 0) {
                        message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
                        message.reply(fastSeeHelpMessage);
                        return;
                    }
                    const confirmSeeMessage = `Are you sure you want to see ${args[2]} fasts?\n\n*(IF a lot of logs, it will spam DM/server!)*`;
                    let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeMessage, forceSkip, `Fast: See ${args[2]} Fasts WARNING!`);
                    if (confirmSeeAll === false) return;
                }
                else {
                    // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                    // => empty "past" command call
                    if (seeType != "all") {
                        message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
                        message.reply(fastSeeHelpMessage);
                        return;
                    }
                    const confirmSeeAllMessage = "Are you sure you want to **see all** of your fast history?\n\n*(IF a lot of logs, it will spam DM/server!)*";
                    let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeAllMessage, forceSkip, "Fast: See All Fasts WARNING!");
                    if (confirmSeeAll === false) return;
                }
                // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                if (pastNumberOfEntriesIndex === undefined) {
                    pastNumberOfEntriesIndex = parseInt(args[2]);
                }

                fastView = await userFastIndexOf(fastCollectionDocument, authorID, 0, pastNumberOfEntriesIndex);
                fastDataToString = "";
                for (i = 0; i < pastNumberOfEntriesIndex; i++) {
                    console.log(fastView[i]);
                    if (fastView[i] === undefined) {
                        pastNumberOfEntriesIndex = i;
                        fn.sendErrorMessage(message, `**FAST ${i + 1}**+ ONWARDS DOES NOT EXIST...`);
                        break;
                    }
                    let fastData = fastCursorToDataArray(fastView[i]);
                    fastDataToString = fastDataToString + `__**Fast ${i + 1}:**__\n` + fastDataArrayToString(fastData) + "\n";
                }
                fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See ${pastNumberOfEntriesIndex} Fasts`, fastEmbedColour);
                message.channel.send(fastEmbed);
                return;
            }
            // <PAST_#_OF_ENTRIES> past <INDEX>
            if (args[2] !== undefined) {
                if (args[2].toLowerCase() == "past") {
                    if (args[3] !== undefined) {
                        // If the argument after past is a number, valid command call!
                        if (!isNaN(args[3])) {
                            let entriesToSkip = parseInt(args[3]);
                            fastView = await userFastIndexOf(fastCollectionDocument, authorID, entriesToSkip, pastNumberOfEntriesIndex);

                            var fastDataToString = "";
                            for (i = 0; i < pastNumberOfEntriesIndex; i++) {
                                if (fastView[i] === undefined) {
                                    pastNumberOfEntriesIndex = i;
                                    fn.sendErrorMessage(message, `**FAST ${i + entriesToSkip + 1}**+ ONWARDS DOES NOT EXIST...`);
                                    break;
                                }
                                let fastData = fastCursorToDataArray(fastView[i]);
                                fastDataToString = fastDataToString + `__**Fast ${i + entriesToSkip + 1}:**__\n` + fastDataArrayToString(fastData) + "\n";
                            }
                            fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See ${pastNumberOfEntriesIndex} Fasts Past ${entriesToSkip}`, fastEmbedColour);
                            message.channel.send(fastEmbed);
                            return;
                        }
                        else {
                            message.reply(fastSeeHelpMessage);
                            return;
                        }
                    }
                    else {
                        message.reply(fastSeeHelpMessage);
                        return;
                    }
                }
            }
            fastView = await userFastIndexOf(fastCollectionDocument, authorID, pastNumberOfEntriesIndex - 1);
            if (fastView === undefined) {
                fn.sendErrorMessage(message, "**FAST DOES NOT EXIST**...");
                return;
            }
            // NOT using the past functionality:
            var fastData;
            if (fastView[0].endTime === null) {
                fastData = fastCursorToDataArray(fastView[0], true, false, currentTimestamp);
            }
            else {
                fastData = fastCursorToDataArray(fastView[0]);
            }

            var showFastEndMessage = false;
            if (pastNumberOfEntriesIndex === 1) {
                showFastEndMessage = true
            }
            fastDataToString = `__**Fast ${pastNumberOfEntriesIndex}:**__\n` + fastDataArrayToString(fastData, showFastEndMessage);
            fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See Fast ${pastNumberOfEntriesIndex}`, fastEmbedColour);
            message.channel.send(fastEmbed);
        }
    }


    else if (fastCommand == "delete" || fastCommand == "d" || fastCommand == "remove"
        || fastCommand == "del" || fastCommand == "clear" || fastCommand == "erase") {
        var fastDeleteUsage = `**USAGE:**\n\`${PREFIX}fast delete past <PAST_#_OF_ENTRIES> <FIELD> <force>\``
            + `\n\`${PREFIX}fast delete <#_MOST_RECENT_ENTRY> <FIELD> <force>\``
            + `\n\`${PREFIX}fast delete many <RECENT_ENTRIES> <FIELD> <force>\``
            + `\n\`${PREFIX}fast delete <#_OF_ENTRIES> past <STARTING_INDEX> <FIELD> <force>\``
            + "\n\n`<PAST_#_OF_ENTRIES>`: **recent; 5** (\\*any number); **all** \n(NOTE: ***any number or all* will delete more than 1 entry!**)"
            + `\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\**any number*)`
            + "\n\n`<#_MOST_RECENT_ENTRY>`: **all; recent; 3** (3rd most recent entry, \\**any number*)\n(NOTE: Deletes just 1 entry - UNLESS `all`)"
            + "\n\n`<RECENT_ENTRIES>`: **3,5,7,1,25**\n(**COMMA SEPARATED, NO SPACES:** with 1 being the most recent fast, 25 the 25th most recent, etc.)"
            + "\n\n`<FIELD>`(OPT.): **start; end; fastbreaker; duration; mood; reflection** (any field you'd like to clear, doesn't remove whole fast)"
            + "\n(if MULTIPLE `<FIELD>`s: separate by **space**!)"
            + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows!**"
            + "\n\nIF you'd like to see more of your fasts first before trying to delete: `?fast see`"
            + "\nIF you'd like to archive the deleted fasts as well (i.e. get the data in a .txt file) - **proceed**.\nIF you'd like to archive without deletion, try: `fast archive` (FUTURE FEATURE)\\*";
        fastDeleteUsage = fn.getMessageEmbed(fastDeleteUsage, `Fast: Delete Help`, fastEmbedColour);
        const fastDeleteHelpMessage = `Try \`${PREFIX}fast delete help\``;
        const trySeeCommandMessage = `Try \`${PREFIX}fast see help\``;

        // delete help command so that the user does not get spammed with the usage message!
        if (args[1] != undefined) {
            if (args[1].toLowerCase() == "help") {
                message.channel.send(fastDeleteUsage);
                return;
            }
            fastView = await fastCollectionDocument.collection
                .find({ userID: authorID })
                .count();
            // If the user has no fasts
            if (fastView == 0) {
                message.reply(`NO FASTS... try \`${PREFIX}fast start\``);
                return;
            }
        }
        // fast delete (only):
        else {
            message.reply(`Try \`${PREFIX}fast delete help\``);
            return;
        }

        var fastView, fastDataToString;
        currentTimestamp = fn.timeCommandHandler(["now"], message.createdTimestamp);

        // Show the user the most recent fast
        if (args[1] == undefined || args.length == 1) {
            message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
            message.reply(fastDeleteHelpMessage);
            return;
        }

        // delete past command:
        else if (args[2] !== undefined) {
            const deleteType = args[1].toLowerCase();
            if (deleteType == "past") {
                // If the following argument is not a number, exit!
                if (isNaN(args[2])) {
                    message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
                    message.reply(fastDeleteHelpMessage);
                    return;
                }
                var numberArg = parseInt(args[2]);
                if (numberArg <= 0) {
                    message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, currentTimestamp));
                    message.reply(fastDeleteHelpMessage);
                    return;
                }
                // Start with an empty string as it will be iteratively populated
                var deleteConfirmMessage = "";
                var fastTargetIDs = new Array();
                fastView = await fastCollectionDocument.collection.find({ userID: authorID })
                    .sort({ startTime: -1 })
                    .limit(numberArg)
                    .toArray();
                for (i = 0; i < numberArg; i++) {
                    if (fastView[i] == undefined) {
                        numberArg = i;
                        deleteConfirmMessage = `Are you sure you want to **delete ${numberArg} fasts?:**\n` + deleteConfirmMessage;
                        break;
                    }
                    let fastData = fastCursorToDataArray(fastView[i]);
                    fastTargetIDs.push(fastView[i]._id);
                    fastDataToString = `__**Fast ${i + 1}:**__\n` + fastDataArrayToString(fastData);
                    deleteConfirmMessage = deleteConfirmMessage + fastDataToString + "\n";

                    // at the last element
                    if (i == numberArg - 1) {
                        deleteConfirmMessage = `Are you sure you want to **delete ${numberArg} fasts?:**\n` + deleteConfirmMessage;
                    }
                }
                if (await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Past ${numberArg} Fasts`, 600000)) {
                    // Must Find the array of cursors first (map _id), then delete only args[3] of them
                    // Sort from greatest endtime => most recent!
                    console.log(`Deleting ${authorID}'s Past ${numberArg} Fasts`);
                    fastCollectionDocument.collection.deleteMany({ _id: { $in: fastTargetIDs } });
                }
                else {
                    return;
                }
            }
            else if (deleteType == "many") {
                if (args[2] == undefined) {
                    message.reply(fastDeleteHelpMessage);
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
                fastView = fastCollectionDocument.collection.find({ userID: authorID });
                const existingFasts = await fastView.count();
                for (i = 0; i < toDelete.length; i++) {
                    console.log(toDelete[i]);
                    if (toDelete[i] <= 0 || toDelete[i] > existingFasts) {
                        toDelete[i] = null;
                    }
                }
                // IF a toDelete element is = null, delete it
                toDelete = toDelete.filter(element => element != null);
                console.log({ toDelete });
                fastView = new Array();
                for (i = 0; i < toDelete.length; i++) {
                    fastView = await userFastIndexOf(fastCollectionDocument, authorID, toDelete[i], 1);
                    console.log({ fastView });
                    let fastData = fastCursorToDataArray(fastView[i]);
                    fastTargetIDs.push(fastView[0]._id);
                    fastDataToString = `__**Fast ${toDelete[i]}:**__\n` + fastDataArrayToString(fastData);
                    deleteConfirmMessage = deleteConfirmMessage + fastDataToString + "\n";
                    // at the last element
                    if (i == toDelete.length - 1) {
                        deleteConfirmMessage = `Are you sure you want to **delete fasts ${toDelete.toString()}?:**\n` + deleteConfirmMessage;
                    }
                }
                if (await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Fasts ${toDelete}`, 600000)) {
                    console.log(`Deleting ${authorID}'s Fasts ${toDelete}`);
                    fastCollectionDocument.collection.deleteMany({ _id: { $in: fastTargetIDs } });
                    return;
                }
            }
            else if (args[2].toLowerCase() == "past") {
                if (isNaN(args[3])) {
                    if (args[3].toLowerCase() == "recent") {
                        let pastNumberOfEntriesIndex = parseInt(args[1]);
                        let skipEntries = 0;
                        const multipleDeleteMessage = `Are you sure you want to delete ${pastNumberOfEntriesIndex} fast(s) after recent`;
                        let multipleDeleteConfirmation = await fn.getUserConfirmation(message, multipleDeleteMessage, forceSkip, "Fast: Multiple Delete Warning!");
                        if (multipleDeleteConfirmation === false) {
                            return;
                        }
                        let fastCollection = await userFastIndexOf(fastCollectionDocument, authorID, skipEntries, pastNumberOfEntriesIndex);
                        let targetIDs = await fastCollection.map(fast => fast._id);
                        fastCollectionDocument.collection.deleteMany({ _id: { $in: targetIDs } });
                        return;
                    }
                    else {
                        message.reply(fastDeleteHelpMessage);
                    }
                    return;
                }
                else {
                    let skipEntries = parseInt(args[3]);
                    let pastNumberOfEntriesIndex = parseInt(args[1]);
                    const multipleDeleteMessage = `Are you sure you want to delete ${pastNumberOfEntriesIndex} fast(s) past fast ${skipEntries}`;
                    let multipleDeleteConfirmation = await fn.getUserConfirmation(message, multipleDeleteMessage, forceSkip, "Fast: Multiple Delete Warning!");
                    if (multipleDeleteConfirmation === false) {
                        return;
                    }
                    let fastCollection = await userFastIndexOf(fastCollectionDocument, authorID, skipEntries, pastNumberOfEntriesIndex);
                    let targetIDs = await fastCollection.map(fast => fast._id);
                    fastCollectionDocument.collection.deleteMany({ _id: { $in: targetIDs } });
                    return;
                }
            }
            // They haven't specified the field for the fast delete past function
            else if (deleteType == "past") {
                message.reply(fastDeleteHelpMessage);
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
            var pastNumberOfEntriesIndex;
            const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded fasts?" +
                `\n\n*(I'd suggest you* \`${PREFIX}fast see all\` *or* \`${PREFIX}fast archive all\` *first)*`;
            const noFastsMessage = `**NO FASTS**... try \`${PREFIX}fast start help\``;
            if (isNaN(args[1])) {
                const deleteType = args[1].toLowerCase();
                if (deleteType == "recent") {
                    fastView = await userFastIndexOf(fastCollectionDocument, authorID, 0, 1);
                    if (fastView.length == 0) {
                        fn.sendErrorMessage(message, noFastsMessage);
                        return;
                    }
                    let fastData = fastCursorToDataArray(fastView[0]);
                    fastTargetIDs.push(fastView[0]._id);
                    deleteConfirmMessage = "Are you sure you want to **delete your most recent fast?:**\n\n__**Fast 1:**__\n" +
                        fastDataArrayToString(fastData);
                    if (await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Recent Fast`, 300000)) {
                        // Must Find the array of cursors first (map _id), then delete only args[3] of them
                        // Sort from greatest endtime => most recent
                        console.log(`Deleting ${authorID}'s Recent Fast`);
                        fastCollectionDocument.collection.deleteOne({ _id: { $in: fastTargetIDs } });
                        return;
                    }
                }
                else if (deleteType == "all") {
                    pastNumberOfEntriesIndex = await fastCollectionDocument.collection.find({ userID: authorID }).count();
                    if (pastNumberOfEntriesIndex == 0) {
                        fn.sendErrorMessage(message, noFastsMessage);
                        return;
                    }
                    let confirmDeleteAll = await fn.getUserConfirmation(message, confirmDeleteAllMessage, forceSkip, "Fast: Delete All Fasts WARNING!");
                    if (!(await confirmDeleteAll)) return;
                    console.log(`Deleting ALL OF ${authorID}'s Recorded Fasts`);
                    fastCollectionDocument.collection.deleteMany({ userID: authorID });
                    return;
                }
                else {
                    message.reply(fastDeleteHelpMessage);
                    return;
                }
            }
            else {
                pastNumberOfEntriesIndex = parseInt(args[1]);
                fastView = await userFastIndexOf(fastCollectionDocument, authorID, pastNumberOfEntriesIndex - 1);
                if (fastView.length == 0) {
                    fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, "**FAST DOES NOT EXIST**...");
                    return;
                }
                let fastData = fastCursorToDataArray(fastView[0]);
                deleteConfirmMessage = `Are you sure you want to **delete Fast ${pastNumberOfEntriesIndex}?:**\n\n__**Fast ${pastNumberOfEntriesIndex}:**__\n` +
                    fastDataArrayToString(fastData);
                if (await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Fast ${pastNumberOfEntriesIndex}`, 300000)) {
                    // Must Find the array of cursors first (map _id), then delete only args[3] of them
                    // Sort from greatest endtime => most recent
                    console.log(`Deleting ${authorID}'s Recent Fast`);
                    fastCollectionDocument.collection.deleteOne({ _id: { $in: fastTargetIDs } });
                    return;
                }
            }
        }
    }


    else if (fastCommand == "edit" || fastCommand == "ed" || fastCommand == "change"
        || fastCommand == "c" || fastCommand == "ch" || fastCommand == "alter" || fastCommand == "update"
        || fastCommand == "up" || fastCommand == "upd") {
        var fastEditUsage = `**USAGE:**\n\`${PREFIX}fast edit <#_MOST_RECENT_ENTRY> <force>\``
            + "\n\n`<#_MOST_RECENT_ENTRY>`: **recent; 3** (3rd most recent entry, \\**any number*)"
            + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows! (More editing capabilities in future development)**"
        fastEditUsage = fn.getMessageEmbed(fastEditUsage, `Fast: Edit Help`, fastEmbedColour);
        const fastEditHelp = `Try \`${PREFIX}fast edit help\``;
        const fastEditTrySee = `Try \`${PREFIX}fast see help\``;
        var fastView, pastNumberOfEntriesIndex;

        if (args[1] != undefined) {
            if (args[1].toLowerCase() == "help") {
                message.channel.send(fastEditUsage);
                return;
            }
            fastView = await fastCollectionDocument.collection
                .find({ userID: authorID })
                .count();
            // If the user has no fasts
            if (fastView == 0) {
                message.reply(`NO FASTS... Try \`${PREFIX}fast start help\``);
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
                fastTargetID, reflectionText, editConfirmationMessage, showFast;
            var fastFields = ["startTime", "endTime", "fastDuration", "fastBreaker", "mood", "reflection"];
            let fieldsList = "";
            fastFields.forEach((element, i) => {
                fieldsList = fieldsList + `\`${i + 1}\` - ${element}\n`;
            });

            if (args[1].toLowerCase() == "recent") {
                pastNumberOfEntriesIndex = 1;
            }
            else {
                pastNumberOfEntriesIndex = parseInt(args[1]);
            }
            fastView = await userFastIndexOf(fastCollectionDocument, authorID, pastNumberOfEntriesIndex - 1);
            if (fastView === undefined) {
                fn.sendErrorMessageAndUsage(message, fastEditHelp, "**FAST DOES NOT EXIST**...");
                return;
            }

            fastTargetID = fastView[0]._id;
            let fastData = fastCursorToDataArray(fastView[0]);
            showFast = fastDataArrayToString(fastData);

            // Field the user wants to edit
            const fieldToEditInstructions = "**Which field do you want to edit?:**";
            const fieldToEditAdditionalMessage = `***NO \`<START/END_DATE/TIME>\` EDITING YET*** AND \n**\`fastDuration\`** CAN ONLY BE CHANGED TO **\`now\`**,`
                + `\n(In Development...)\n\n__**Fast ${pastNumberOfEntriesIndex}:**__\n${showFast}`;
            const fieldToEditTitle = "Fast: Edit Field";
            fieldToEdit = await fn.userSelectFromList(message, fieldsList, 6, fieldToEditInstructions, fieldToEditTitle, "00FF00", 180000, 0, fieldToEditAdditionalMessage);
            if (fieldToEdit === false) {
                return;
            }
            let userEdit = await getUserEdit(message, fastFields, fieldToEdit, forceSkip);
            if (userEdit === false) {
                return;
            }
            console.log({ userEdit });

            // Show user updated fast!
            if (fieldToEdit == 2) {
                userEdit = userEdit.split(/ +/);
                console.log({ userEdit });
                fastData[fieldToEdit] = fn.timeCommandHandler(userEdit, message.createdAt);
            }
            else if (fieldToEdit == 3) {
                fastData[fieldToEdit] = userEdit;
            }
            else if (fieldToEdit == 4) {
                if (!isNaN(userEdit)) {
                    if (parseInt(userEdit) > 0 || parseInt(userEdit) <= 5) {
                        fastData[fieldToEdit] = userEdit;
                    }
                }
            }
            else if (fieldToEdit == 5) {
                fastData[fieldToEdit] = userEdit;
            }
            showFast = fastDataArrayToString(fastData);
            console.log({ fastData });
            editConfirmationMessage = `Are you sure you want to **edit fast ${pastNumberOfEntriesIndex}'s ${fastFields[fieldToEdit]}?:**\n\n__**Fast ${pastNumberOfEntriesIndex}:**__\n` + showFast;
            if (await fn.getUserConfirmation(message, editConfirmationMessage, forceSkip, `Fast: Edit Fast ${pastNumberOfEntriesIndex}`, 300000)) {
                console.log(`Editing ${authorID}'s Fast ${pastNumberOfEntriesIndex}`);
                switch (fieldToEdit) {
                    case 0:
                        fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { startTime: fastData[0] } })
                            .catch(err => console.error(err));
                        break;
                    case 1:
                        fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { endTime: fastData[1] } })
                            .catch(err => console.error(err));
                        break;
                    case 2:
                        fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { fastDuration: fastData[2] } })
                            .catch(err => console.error(err));
                        break;
                    case 3:
                        fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { fastBreaker: fastData[3] } })
                            .catch(err => console.error(err));
                        break;
                    case 4:
                        fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { mood: fastData[4] } })
                            .catch(err => console.error(err));
                        break;
                    case 5:
                        fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { reflection: fastData[5] } })
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
    }


    else if (fastCommand == "post" || fastCommand == "p" || fastCommand == "send" || fastCommand == "accountability"
        || fastCommand == "share" || fastCommand == "upload") {
        var fastPostUsageMessage = `**USAGE:**\n\`${PREFIX}fast post <#_MOST_RECENT_ENTRY> <FIELD> <force>\``
            + `\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; 3 **(3rd most recent entry, \\**any number*)`
            + "\n\n`<FIELD>`(OPT.): **start; end; fastbreaker; duration; reflection** (includes mood); *Default:* all fields\n(if MULTIPLE `<FIELD>`s: separate by space!)"
            + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows!**";
        fastPostUsageMessage = fn.getMessageEmbed(fastPostUsageMessage, `Fast: Post Help`, fastEmbedColour);
        const fastPostHelpMessage = `**INVALID USAGE**... Try \`${PREFIX}fast post help\``;
        if (args[1] !== undefined) {
            var fastData;
            if (args[1].toLowerCase() == "help") {
                message.channel.send(fastPostUsageMessage);
                return;
            }
            let fastView = await fastCollectionDocument.collection
                .find({ userID: authorID })
                .count();
            // If the user has no fasts
            if (fastView == 0) {
                message.reply(`NO FASTS... try \`${PREFIX}fast start help\``);
                return;
            }
            if (isNaN(args[1])) {
                if (args[1].toLowerCase() == "recent") {
                    // If user has no recent fast, case already handed above
                    let fastView = await userFastIndexOf(fastCollectionDocument, authorID, 0);
                    fastData = fastCursorToDataArray(fastView[0], true);
                    endTimestamp = fastData[1];
                    let fastPost = await getFastPostEmbed(message, fastData, forceSkip);
                    console.log({fastPost});
                    if (fastPost === false) {
                        return;
                    }
                    await postFast(bot, message, fastPost, endTimestamp, forceSkip);
                    return;
                }
                else {
                    message.reply(fastPostHelpMessage);
                    return;
                }
            }
            else {
                var fastData;
                pastNumberOfEntriesIndex = parseInt(args[1]) - 1;
                let fastView = await userFastIndexOf(fastCollectionDocument, authorID, pastNumberOfEntriesIndex);
                if (fastView === undefined) {
                    fn.sendErrorMessage(message, "**FAST DOES NOT EXIST**...");
                    return;
                }
                let shownFast = fastView[0];
                if (pastNumberOfEntriesIndex === 0 && shownFast.endTime === null) {
                    fastData = fastCursorToDataArray(shownFast, true);
                }
                else {
                    fastData = fastCursorToDataArray(shownFast);
                }
                endTimestamp = fastData[1];
                let fastPost = await getFastPostEmbed(message, fastData, forceSkip);
                if (fastPost === false) {
                    return;
                }
                await postFast(bot, message, fastPost, endTimestamp, forceSkip);
            }
        }
        // fast post (only):
        else {
            message.reply(fastPostHelpMessage);
            return;
        }
    }


    else {
        message.reply(fastHelpMessage);
        return;
    }
}

module.exports.help = {
    name: "fast",
    aliases: ["if", "fasts"]
}