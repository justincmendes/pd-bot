// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Fast = require("../database/schemas/fasting");
const UserSettings = require("../database/schemas/usersettings");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();
const fastEmbedColour = "#32CD32";

// REDESIGNED:
// Computed Property Names
// Using Object Destructuring

// Function Declarations and Definitions
function fastDataArrayToString(fastData, showFastEndMessage = false, PREFIX = '?', commandUsed = 'fast') {
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
        `**Reflection:** ${reflectionText}`;
    if (showFastEndMessage) {
        fastDataString += `\n\n(Want to end your fast? \`${PREFIX}${commandUsed} end\`)`;
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
function multipleFastsToString(message, fastArray, numberOfFasts, entriesToSkip = 0) {
    var fastDataToString = "";
    for (i = 0; i < numberOfFasts; i++) {
        if (fastArray[i] === undefined) {
            numberOfFasts = i;
            fn.sendErrorMessage(message, `**FASTS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`);
            break;
        }
        var fastData;
        if (i === 0 && fastArray[i].endTime === null) {
            fastData = fastCursorToDataArray(fastArray[i], true);
        }
        else {
            fastData = fastCursorToDataArray(fastArray[i]);
        }
        fastDataToString = fastDataToString + `__**Fast ${i + entriesToSkip + 1}:**__\n${fastDataArrayToString(fastData)}`;
        if (i !== numberOfFasts - 1) {
            fastDataToString += '\n\n';
        }
    }
    return fastDataToString;
}
async function totalFasts(fastCollectionDocument, userID) {
    let fastCount = await fastCollectionDocument.collection
        .find({ userID: userID })
        .count()
    return fastCount;
}
async function getRecentFast(message, fast, fastIsInProgress, PREFIX, commandUsed = 'fast') {
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
    fastDataToString = "__**Fast 1:**__\n";
    if (fastIsInProgress === true) {
        fastDataToString += fastDataArrayToString(fastData, true, PREFIX, commandUsed);
    }
    else {
        fastDataToString += fastDataArrayToString(fastData, false, PREFIX, commandUsed);
    }
    fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See ${fastType} Fast`, fastEmbedColour);
    return (fastEmbed);
}
async function getEditEndConfirmation(userOriginalMessageObject, field, userEdit, forceSkip = false) {
    const resetWarningMessage = `**Are you sure you want to change your ${field} to:**\n${userEdit}`;
    let endEditConfirmation = await fn.getUserConfirmation(userOriginalMessageObject, resetWarningMessage, forceSkip, `Fast: Edit ${field} Confirmation`);
    return endEditConfirmation;
}
async function getBackToMainMenuConfirmation(userOriginalMessageObject, forceSkip) {
    const backToMainEditMessage = "Are you sure you want to go **back to the main edit menu?**";
    const backToMainEdit = await fn.getUserConfirmation(userOriginalMessageObject, backToMainEditMessage, forceSkip, "Edit: Back to Main Menu");
    return backToMainEdit;
}
async function getUserEditString(userOriginalMessageObject, field, instructionPrompt, forceSkip = false) {
    let messageIndex = 0;
    let reset = false;
    var collectedEdit, userEdit = "";
    let fastEditMessagePrompt = `**What will you change your *${field}* to?:**\n${instructionPrompt}\n`;
    fastEditMessagePrompt = fastEditMessagePrompt + `\nType \`0\` to **restart/clear** your current edit!`
        + `\nType \`1\` when you're **done!**\nType \`back\` to go **back to the main edit menu**\n`;
    const fastEditMessagePromptOriginal = fastEditMessagePrompt;
    do {
        messageIndex++;
        collectedEdit = await fn.messageDataCollectFirst(userOriginalMessageObject, fastEditMessagePrompt, "Fast: Edit", fastEmbedColour, 600000);
        if (!collectedEdit || collectedEdit === "stop") {
            fn.sendReplyThenDelete(userOriginalMessageObject, `**Exiting...** This was your **${field} edit!**: *(Deleting in 10 minutes)*\n${userEdit}`, 600000)
            return false;
        }
        if (messageIndex === 1 || reset === true) {
            if (collectedEdit == "1") {
                const endEditConfirmation = await getEditEndConfirmation(userOriginalMessageObject, field, userEdit, forceSkip);
                if (endEditConfirmation === true) {
                    break;
                }
            }
            else if (collectedEdit != "0" && collectedEdit != "back") {
                fastEditMessagePrompt = fastEditMessagePrompt + "\n**Current Edit:**\n" + collectedEdit + "\n";
                userEdit = collectedEdit;
                reset = false;
            }
            else if (collectedEdit == "back") {
                const backToMainEdit = await getBackToMainMenuConfirmation(userOriginalMessageObject, forceSkip);
                if (backToMainEdit === true) {
                    userEdit = "back";
                    break;
                }
            }
        }
        else if (collectedEdit == "back") {
            const backToMainEdit = await getBackToMainMenuConfirmation(userOriginalMessageObject, forceSkip);
            if (backToMainEdit === true) {
                userEdit = "back";
                break;
            }
        }
        else if (collectedEdit == "1") {
            let endEditConfirmation = await getEditEndConfirmation(userOriginalMessageObject, field, userEdit, forceSkip);
            if (endEditConfirmation === true) {
                break;
            }
        }
        else if (collectedEdit == "0") {
            if (userEdit == "") {
                reset = true;
            }
            else {
                const resetWarningMessage = "Are you sure you want to __**reset**__ your current edit?\n*(All of your current edit will be lost...)*";
                let resetConfirmation = await fn.getUserConfirmation(userOriginalMessageObject, resetWarningMessage, forceSkip, `Fast: Edit ${field} Reset`);
                if (resetConfirmation === true) {
                    fastEditMessagePrompt = fastEditMessagePromptOriginal;
                    userEdit = "";
                    reset = true;
                }
            }
        }
        else {
            fastEditMessagePrompt = fastEditMessagePrompt + collectedEdit + "\n";
            userEdit = `${userEdit}\n${collectedEdit}`;
        }
    }
    while (true)
    return userEdit;
}
async function getUserEditNumber(userOriginalMessageObject, field, maxNumber, forceSkip = false) {
    var collectedEdit;
    const numberErrorMessage = `**INVALID INPUT... Please Enter a Number from 1-${maxNumber}**`;
    let fastEditMessagePrompt = `**What will you change your *${field}* to?:**\n***(Please enter a number from \`1-${maxNumber}\`)***\n`
        + "\nType `back` to go **back to the main edit menu**\n";
    while (true) {
        collectedEdit = await fn.messageDataCollectFirst(userOriginalMessageObject, fastEditMessagePrompt, "Fast: Edit", fastEmbedColour, 300000);
        if (!collectedEdit || collectedEdit === "stop") {
            return false;
        }
        // Check if the given message is a number
        else if (isNaN(collectedEdit)) {
            if (collectedEdit == "back") {
                const backToMainEdit = await getBackToMainMenuConfirmation(userOriginalMessageObject, forceSkip);
                if (backToMainEdit === true) {
                    userEdit = "back";
                    break;
                }
            }
            else {
                fn.sendReplyThenDelete(userOriginalMessageObject, numberErrorMessage, 15000);
            }
        }
        else if (collectedEdit !== undefined) {
            collectedEdit = parseInt(collectedEdit);
            if (collectedEdit < 1 || collectedEdit > maxNumber) {
                fn.sendReplyThenDelete(userOriginalMessageObject, numberErrorMessage, 15000);
            }
            else {
                let confirmEdit = await getEditEndConfirmation(userOriginalMessageObject, field, collectedEdit, forceSkip);
                if (confirmEdit === true) {
                    break;
                }
            }
        }
    }
    return collectedEdit;
}
function urlIsImage(url) {
    return (url.indexOf(".png", url.length - 4) !== -1
        || url.indexOf(".jpeg", url.length - 5) !== -1
        || url.indexOf(".jpg", url.length - 4) !== -1
        || url.indexOf(".gif") !== -1
        || url.indexOf("-gif") !== -1);
}
function messageAttachmentIsImage(messageAttachment) {
    const url = messageAttachment.url;
    console.log({ url });
    // Return true if the url is of a png, jpg or jpeg image
    return urlIsImage(url);
}
async function findFirstAttachment(attachmentArray) {
    var attachment;
    await attachmentArray.forEach((currentAttachment, i) => {
        if (messageAttachmentIsImage(currentAttachment)) {
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
    let postIndex = 0;
    let fastPost = "";
    let attachment = null;
    var collectedMessage = "", collectedObject;
    var fastPostMessagePrompt = "Please enter the message(s) you'd like to send. (you can send pictures!)"
        + "\nThe latest picture you send will be attached to the post for ALL options below (except stop):"
        + "\nType `0` to add **default message with fast breaker**\nType `1` when **done**!\nType `2` to add **full fast**"
        + "\nType `remove` to **remove** the **attached image**\nType `clear` to **reset/clear** your **current message** (message only)"
        + "\nType `clear all` to **clear** both attached **image and message**\n\n";
    const originalFastPostMessagePrompt = fastPostMessagePrompt;
    const postCommands = ["0", "1", "2", "remove", "clear", "clear all"];
    let onFirstMessageCollection = false;
    // Loop to collect the first message given and store it, if that message is 0, 1, or stop then handle accordingly
    // Detect and store images, allow user to remove image before posting!
    do {
        postIndex++;
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
        if (!collectedObject) return false;
        collectedMessage = collectedObject.content;
        if (postIndex === 1) {
            if (collectedMessage == "1") {
                fastPost = addUserTag(userOriginalMessageObject, fastPost);
                break;
            }
            let attachmentArray = collectedObject.attachments;
            console.log({ attachmentArray });
            if (attachmentArray.size > 0) {
                // Just check and post the first image
                if (attachmentArray.some(messageAttachmentIsImage)) {
                    attachment = await findFirstAttachment(attachmentArray);
                    postIndex = 0;
                }
            }
            else if (postCommands.includes(collectedMessage)) {
                if (collectedMessage != "0" && collectedMessage != "2") {
                    postIndex--;
                }
                else {
                    fastPostMessagePrompt += "__**Current Message:**__";
                    onFirstMessageCollection = true;
                }
            }
            else {
                if (urlIsImage(collectedMessage)) {
                    attachment = collectedMessage;
                    postIndex = 0;
                }
                else {
                    fastPostMessagePrompt += `__**Current Message:**__\n${collectedMessage}`;
                    fastPost = collectedMessage;
                }
            }
        }
        else if (!postCommands.includes(collectedMessage)) {
            let attachmentArray = collectedObject.attachments;
            console.log({ attachmentArray });
            if (attachmentArray.size > 0) {
                // Just check and post the first image/gif
                if (attachmentArray.some(messageAttachmentIsImage)) {
                    attachment = await findFirstAttachment(attachmentArray);
                    if (collectedMessage != "") {
                        fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
                        fastPost = `${fastPost}\n${collectedMessage}`;
                    }
                }
            }
            else {
                // If the user posts the link to their image/gif
                if (urlIsImage(collectedMessage)) {
                    attachment = collectedMessage;
                }
                else {
                    fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
                    fastPost = `${fastPost}\n${collectedMessage}`;
                }
            }
            console.log({ attachment });
        }

        if (collectedMessage == "remove" && attachment !== null) {
            const removeFastWarning = "Are you sure you want to remove your **attached image/gif?**";
            let confirmClearMessage = await fn.getUserConfirmation(userOriginalMessageObject, removeFastWarning, forceSkip, "Fast Post: Remove Attachment");
            if (confirmClearMessage === true) {
                attachment = null;
            }
        }
        else if (collectedMessage == "clear") {
            const clearMessageWarning = "Are you sure you want to reset your **current message?** (your attached image remains the same if you had one)";
            let confirmClearMessage = await fn.getUserConfirmation(userOriginalMessageObject, clearMessageWarning, forceSkip, "Fast Post: Clear Current Message");
            if (confirmClearMessage === true) {
                fastPostMessagePrompt = originalFastPostMessagePrompt;
                fastPost = "";
                postIndex = 0;
            }
        }
        else if (collectedMessage == "clear all") {
            const clearAllWarning = "Are you sure you want to reset both your **current message and attached image?**";
            let confirmClearAll = await fn.getUserConfirmation(userOriginalMessageObject, clearAllWarning, forceSkip, "Fast Post: Clear All");
            if (confirmClearAll === true) {
                fastPostMessagePrompt = originalFastPostMessagePrompt;
                fastPost = "";
                attachment = null;
                postIndex = 0;
            }
        }
        else if (collectedMessage == "stop") {
            return false;
        }
        else if (collectedMessage == "1") {
            fastPost = addUserTag(userOriginalMessageObject, fastPost);
            break;
        }
        else if (collectedMessage == "0") {
            const addDefaultMessagePrompt = "Are you sure you want to add the default message including the **time and your fast breaker** (if you entered one)";
            let confirmOverwrite = await fn.getUserConfirmation(userOriginalMessageObject, addDefaultMessagePrompt, forceSkip, "Add Default Fast Message");
            if (confirmOverwrite === true) {
                if (fastBreaker === null) {
                    collectedMessage = `=============\nBroke my **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast!\n=============`;
                    if (onFirstMessageCollection) {
                        fastPost = collectedMessage;
                        onFirstMessageCollection = false;
                    }
                    else {
                        fastPost = `${fastPost}\n${collectedMessage}`;
                    }
                    fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
                }
                else {
                    collectedMessage = `=============\nBroke my **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast with **${fastBreaker}**!\n=============`;
                    if (onFirstMessageCollection) {
                        fastPost = collectedMessage;
                        onFirstMessageCollection = false;
                    }
                    else {
                        fastPost = `${fastPost}\n${collectedMessage}`;
                    }
                    fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
                }
            }
        }
        else if (collectedMessage == "2") {
            const addFullFastPrompt = "Are you sure you want to add your **full fast (including mood and reflection)**";
            let confirmOverwrite = await fn.getUserConfirmation(userOriginalMessageObject, addFullFastPrompt, forceSkip, "Add Full Fast");
            if (confirmOverwrite === true) {
                collectedMessage = `=============\n${fastDataArrayToString(fastData)}\n=============`;
                if (onFirstMessageCollection) {
                    fastPost = collectedMessage;
                    onFirstMessageCollection = false;
                }
                else {
                    fastPost = `${fastPost}\n${collectedMessage}`;
                }
                fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
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
        fn.sendReplyThenDelete(userOriginalMessageObject, "**Here was your post:** (deleting in 10 minutes)", 600000);
        fn.sendMessageThenDelete(userOriginalMessageObject, fastPost, 600000);
    }
    userOriginalMessageObject.reply(mistakeMessage);
    return;
}

async function postFast(bot, userOriginalMessageObject, fastPost, endTimestamp, PREFIX, commandUsed, forceSkip = false, fastNumber = 1) {
    var endTimeToDate;
    if (endTimestamp === null) {
        endTimeToDate = new Date().toLocaleString();
    }
    else {
        endTimeToDate = new Date(endTimestamp).toLocaleString();
    }
    const authorID = userOriginalMessageObject.author.id;

    // Check all of the servers the bot is in
    let botServers = await bot.guilds.cache.map(guild => guild.id);
    console.log({ botServers });

    // Find all the mutual servers with the user and bot
    var botUserMutualServerIDs = await fn.userAndBotMutualServerIDs(bot, userOriginalMessageObject, botServers);
    var targetServerIndex, targetChannelIndex;
    var channelList, channelListDisplay;
    var confirmSendToChannel = false;
    const channelSelectInstructions = "Type the number corresponding to the channel you want to post in:";
    const serverSelectInstructions = "Type the number corresponding to the server you want to post in:";
    const postToServerTitle = "Fast: Post to Server";
    const postToChannelTitle = "Fast: Post to Channel";
    const mistakeMessage = `Exiting... try \`${PREFIX}${commandUsed} post\` to try to **post again!**`;
    var serverList = await fn.listOfServerNames(bot, botUserMutualServerIDs);
    targetServerIndex = await fn.userSelectFromList(userOriginalMessageObject, serverList, botUserMutualServerIDs.length,
        serverSelectInstructions, postToServerTitle, fastEmbedColour);
    if (targetServerIndex === false) {
        await showFastPost(userOriginalMessageObject, fastPost, mistakeMessage);
        return false;
    }
    channelList = await fn.listOfServerTextChannelsUserCanSendTo(bot, userOriginalMessageObject, botUserMutualServerIDs[targetServerIndex]);
    if (channelList.length == 0) {
        fn.sendReplyThenDelete(userOriginalMessageObject, "This server has **no channels!** EXITING...");
        return false;
    }
    channelListDisplay = await fn.listOfChannelNames(bot, channelList);
    while (!confirmSendToChannel) {
        targetChannelIndex = await fn.userSelectFromList(userOriginalMessageObject, channelListDisplay, channelList.length,
            channelSelectInstructions, postToChannelTitle, fastEmbedColour, 300000);
        if (targetChannelIndex === false) {
            await showFastPost(userOriginalMessageObject, fastPost, mistakeMessage);
            return false;
        }
        console.log({ targetChannelIndex })
        let targetChannelName = await bot.channels.cache.get(channelList[targetChannelIndex]).name;
        confirmSendToChannel = await fn.getUserConfirmation(userOriginalMessageObject, `Are you sure you want to send it to **#${targetChannelName}**?`, forceSkip);
    }
    // Overwrite fastPost Title with one specific to user's nickname in respective server
    fastPost = fastPost.setTitle(`${bot.guilds.cache.get(botUserMutualServerIDs[targetServerIndex]).member(authorID).displayName}'s ${endTimeToDate} Fast`);
    await fn.sendMessageToChannel(bot, fastPost, channelList[targetChannelIndex]);
    return true;
}

async function getOneFast(fastCollectionDocument, userID, fastIndex) {
    const fastView = await fastCollectionDocument.collection
        .find({ userID: userID })
        .sort({ startTime: -1 })
        .limit(1)
        .skip(fastIndex)
        .toArray()
        .catch(err => {
            console.log(err);
            return false;
        });
    return fastView;
}

async function getFastsIndexOf(fastCollectionDocument, userID, fastIndex, numberOfEntries = 1) {
    const fastView = await fastCollectionDocument.collection
        .find({ userID: userID })
        .sort({ startTime: -1 })
        .limit(numberOfEntries)
        .skip(fastIndex)
        .toArray()
        .catch(err => {
            console.log(err);
            return false;
        });
    if (fastView.length > 0) {
        console.log(fastView);
        return fastView;
    }
    // The query was out of bounds, calculate manually
    // for other functions to handle appropriately
    // by checking the length of the fastCollection returned array
    else {
        var fastCollection = new Array();
        for (i = 0; i < numberOfEntries; i++) {
            const checkFast = await getOneFast(fastCollectionDocument, userID, fastIndex)
            if (!checkFast) {
                fastCollection.push(checkFast);
            }
        }
        return fastCollection;
    }
}
function endTimeAfterStartTime(message, startTimestamp, endTimestamp) {
    if (endTimestamp < startTimestamp) {
        const startTimestampToDate = new Date(startTimestamp).toLocaleString();
        const endTimestampToDate = new Date(endTimestamp).toLocaleString();
        message.reply(`Your __fast end time__ **(${endTimestampToDate})** cannot be ***before*** your __fast start time__ **(${startTimestampToDate})**`);
        return false;
    }
    else return true;
}


//==========================
//          START
//==========================


module.exports = {
    name: "fast",
    description: "Fully Functional Fasting Tracker (for Intermittent Fasting)",
    aliases: ["f", "if", "fasts", "fasting"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX, forceSkip) {
        // Variable Declarations and Initializations
        var fastUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} <ACTION>\`\n\n`
            + "`<ACTION>`: **help; start; end; see; edit; delete; post**"
            + `\n\n*__ALIASES:__* **${this.name}; ${this.aliases.join('; ')}**`;
        fastUsageMessage = fn.getMessageEmbed(fastUsageMessage, "Fast: Help", fastEmbedColour);
        const fastHelpMessage = `Try \`${PREFIX}fast help\``;
        const authorID = message.author.id;
        const authorUsername = message.author.username;
        let fastCommand = args[0].toLowerCase();
        let fastCollectionDocument = new Fast();
        const fastInProgress = fastCollectionDocument.collection.find({
            userID: authorID,
            endTime: null
        });
        const fastIsInProgress = (await fastInProgress.count() >= 1);
        const totalFastNumber = await totalFasts(fastCollectionDocument, authorID);
        // Computed Property Names: Reduces code footprint
        console.log({ authorUsername, authorID, fastIsInProgress });

        if (fastCommand == "help") {
            message.channel.send(fastUsageMessage);
            return;
        }


        else if (fastCommand == "start" || fastCommand == "st" || fastCommand == "s") {
            // Check if the user does not already have a fast in progress, otherwise start.
            // Using greater than equal to ensure error message sent even though 
            // Any given user should not be able to have more than 1 fast running at a time
            var fastStartUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <DATE/TIME> <force>\`\n\n`
            + "`<DATE/TIME>` Enter date and/or time in relative terms\n"
            + "(i.e. now, 1 hour ago, 15 minutes ago, in 15 minutes, in 1 hour, yesterday at 10pm EST,"
            + " two days ago at 6P PST, 1 day ago 8p) Default: next time forward(AM/PM), EST"
            + "\n\nOR\n\n Enter date and/or time in absolute terms\n"
            + "(i.e. [Month/Day/Year] 3/22/2020 at 10a EST, [Month.Day.Year] 3.22.2020 at 9PM,"
            + "[Month/Day] 3/22 at 10a EST, [Month.Day] 3.22 at 9PM)"
            + "\n\n`<force>`: type **force** at the end of your command to **skip all of the confimation windows!**";

            fastStartUsageMessage = fn.getMessageEmbed(fastStartUsageMessage, `Fast: Start Help`, fastEmbedColour);
            const fastStartHelpMessage = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            const fastIsRunningMessage = `You already have a **fast running!**\nIf you want to **restart** it try \`${PREFIX}${commandUsed} edit help\``
                + `\nIf you want to **delete** the fast entry altogether try \`${PREFIX}${commandUsed} delete help\``;
            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastStartUsageMessage);
                    return;
                }
            }
            if (fastIsInProgress >= 1) {
                message.reply(fastIsRunningMessage);
                return;
            }
            else if (args[1] == undefined || args.length == 1) {
                message.reply(fastStartHelpMessage);
                return;
            }
            else {
                // Remove the "start" from the args using slice
                const startTimeArgs = args.slice(1);
                startTimestamp = fn.timeCommandHandler(startTimeArgs, message.createdTimestamp);
                if (startTimestamp == false) {
                    message.reply(fastStartHelpMessage);
                    return;
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


        else if (fastCommand == "end" || fastCommand == "e") {
            var fastEndUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <DATE/TIME> <force>\`\n\n`
                + "`<DATE/TIME>` Enter date and/or time in relative terms\n"
                + "(i.e. now, 1 hour ago, 15 minutes ago, in 15 minutes, in 1 hour, yesterday at 10pm EST,"
                + " two days ago at 6P PST, 1 day ago 8p) Default: next time forward(AM/PM), EST"
                + "\n\nOR\n\n Enter date and/or time in absolute terms\n"
                + "(i.e. [Month/Day/Year] 3/22/2020 at 10a EST, [Month.Day.Year] 3.22.2020 at 9PM,"
                + "[Month/Day] 3/22 at 10a EST, [Month.Day] 3.22 at 9PM)"
                + "\n\n`<force>`: type **force** at the end of your command to **skip all of the confimation windows!**";
            fastEndUsageMessage = fn.getMessageEmbed(fastEndUsageMessage, `Fast: End Help`, fastEmbedColour);
            const fastEndHelpMessage = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            const noFastRunningMessage = `You don't have a **fast running!**\nIf you want to **start** one \`${PREFIX}${commandUsed} start <DATE/TIME>\``;

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
                    return message.reply(fastEndHelpMessage);
                }
                const currentFast = await getOneFast(fastCollectionDocument, authorID, 0);
                // Can use authorID in this case as well, but will stick to pulling the
                // value from the database - to ensure the user is correct!
                const startTimestamp = currentFast[0].startTime;
                const validEndTime = endTimeAfterStartTime(message, startTimestamp, endTimestamp);
                if (!validEndTime) {
                    return message.channel.send(`If you want to change the start time try \`${PREFIX}${commandUsed} edit recent\``);
                }
                const currentFastUserID = currentFast[0].userID;
                const fastDurationTimestamp = endTimestamp - startTimestamp;
                console.log({ currentFastUserID, startTimestamp, fastDurationTimestamp });

                // EVEN if the time is not now it will be handled accordingly
                const quickEndMessage = `**✅ - Log additional information: fast breaker, mood, reflection**` +
                    `\n**⌚ - Quickly log** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast now` +
                    `\n**❌ - Exit**` +
                    `\n\n\\*IF \`<DATE/TIME>\` is at a **FUTURE time**: (use ⌚)\\* (you can always \`${PREFIX}${commandUsed} edit\`)`;
                const quickEndEmojis = ["✅", "❌", "⌚"];
                var endConfirmation = `Are you sure you want to **end** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast?`;
                const fastBreakerPrompt = "**What did you break your fast with?** \n\nType `skip` to **skip** (will **continue**, but log it as blank)";
                const moodValuePrompt = "**How did you feel during this past fast?\n\nEnter a number from 1-5 (1 = worst, 5 = best)**\n`5`-😄; `4`-🙂; `3`-😐; `2`-😔; `1`-😖;";
                var reflectionTextPrompt = "**Elaborate? For Example:\n - __Why__ did you feel that way?\n - What did you do that made it great? / What could you have done to __make it better__?**" +
                    "\n\nType `1` when **done**\nType `skip` to **skip** (will **continue**, but log it as blank)\nType `reset` to **reset** your current reflection message\n\n";
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
                    if (!fastBreaker || fastBreaker == "stop") {
                        return;
                    }
                    else if (fastBreaker == "skip") {
                        fastBreaker = null;
                    }

                    // +1 to convert the returned index back to natural numbers
                    moodValue = await fn.userSelectFromList(message, "", 5, moodValuePrompt, "Fast: Mood Assessment", fastEmbedColour) + 1;
                    if (moodValue === false) return;
                    var reflectionText = "";
                    let messageIndex = 0;
                    let reset = false;
                    do {
                        let userReflection = await fn.messageDataCollectFirst(message, reflectionTextPrompt, "Fast: Reflection", fastEmbedColour, 900000);
                        if (!userReflection) return;
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
                                reflectionTextPrompt = reflectionTextPrompt + "**Current Reflection Message:**\n" + userReflection;
                                reflectionText = userReflection;
                                reset = false;
                            }
                            else {
                                reflectionTextPrompt = `${reflectionTextPrompt}\n${userReflection}`;
                                reflectionText = `${reflectionText}\n${userReflection}`;
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
                if (!confirmation) return;
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
                        let confirmPostFast = await fn.getUserConfirmation(message, confirmPostFastMessage, forceSkip, "Send Message for Accountability?", 180000, 0);
                        if (!confirmPostFast) return;
                        else {
                            let fastPost = await getFastPostEmbed(message, fastData, forceSkip);
                            if (!fastPost) return;
                            if (endTimestamp === null) {
                                await postFast(bot, message, fastPost, startTimestamp, PREFIX, commandUsed, forceSkip);
                            }
                            else {
                                await postFast(bot, message, fastPost, endTimestamp, PREFIX, commandUsed, forceSkip);
                            }
                        }
                    })
                    .catch(err => console.error(`Failed to end fast ${err}`));
            }
        }


        else if (fastCommand == "see" || fastCommand == "view" || fastCommand == "find"
            || fastCommand == "look" || fastCommand == "lookup" || fastCommand == "show") {
            // Will add the ability to gather all of the user's data into a spreadsheet or note/JSON file!
            // **Handle users who do not yet have a fast!
            var fastSeeUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} past <PAST_#_OF_ENTRIES> <FIELD> <force>\`\n\`${PREFIX}${commandUsed} ${fastCommand} <#_MOST_RECENT_ENTRY> <FIELD> <force>\``
                + `\n\`${PREFIX}${commandUsed} ${fastCommand} <#_OF_ENTRIES> past <STARTING_INDEX> <FIELD> <force>\`\n\`${PREFIX}${commandUsed} ${fastCommand} <number>\``
                + `\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; all; 5** (\\*any number)`
                + `\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\*any number)`
                + `\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; all** (returns entire history); **3 **(3rd most recent entry, \\**any number*)`
                + `\n\n\`<STARTING_INDEX>\`: **4** (any number); (you want to see \`<#_OF_ENTRIES>\` past the 4th fast)`
                + `\n\n\`<number>\`: type **number** (shows you the number of fasts you have on record))`
                + "\n\n`<FIELD>`(OPT.): **start; end; fastbreaker; duration; reflection** (includes mood); *Default:* all fields\n(if MULTIPLE `<FIELD>`s: separate by space!)"
                + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows!**";
            fastSeeUsageMessage = fn.getMessageEmbed(fastSeeUsageMessage, `Fast: See Help`, fastEmbedColour);
            const fastSeeHelpMessage = `**INVALID USAGE**... Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;

            // If the user wants fast help, do not proceed to show them the fast.
            const seeCommands = ["past", "recent", "all"];
            var fastDataToString, startTimeToDate, endTimeToDate, fastDuration, fastBreaker, moodRating, reflectionText;
            currentTimestamp = fn.timeCommandHandler(["now"], message.createdTimestamp);

            // MAKE THIS OPERATION INTO A FUNCTION!
            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastSeeUsageMessage);
                    return;
                }
                // If the user has no fasts
                if (totalFastNumber == 0) {
                    message.reply(`NO FASTS... try \`${PREFIX}${commandUsed} start help\``);
                    return;
                }
                else if (args[1].toLowerCase() == "number") {
                    message.reply(`You have **${totalFastNumber} fasts** on record.`);
                    return;
                }
            }
            // fast see (only):
            else {
                message.reply(`Try \`${PREFIX}${commandUsed} see help\``);
                return;
            }
            // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(args[1]) && isNaN(args[1])) {
                message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, PREFIX, commandUsed));
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
                    message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, PREFIX, commandUsed));
                    return;
                }
                else if (seeType == "all") {
                    pastNumberOfEntriesIndex = await totalFasts(fastCollectionDocument, authorID);
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
                    message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, PREFIX, commandUsed));
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
                            message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, PREFIX, commandUsed));
                            message.reply(fastSeeHelpMessage);
                            return;
                        }
                        if (parseInt(args[2]) <= 0) {
                            message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, PREFIX, commandUsed));
                            message.reply(fastSeeHelpMessage);
                            return;
                        }
                        const confirmSeeMessage = `Are you sure you want to **see ${args[2]} fasts?**\n\n*(IF a lot of logs, it will spam DM/server!)*`;
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeMessage, forceSkip, `Fast: See ${args[2]} Fasts WARNING!`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (seeType != "all") {
                            message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, PREFIX, commandUsed));
                            message.reply(fastSeeHelpMessage);
                            return;
                        }
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your fast history?\n\n*(IF a lot of logs, it will spam DM/server!)*";
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeAllMessage, forceSkip, "Fast: See All Fasts WARNING!");
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                    if (pastNumberOfEntriesIndex === undefined) {
                        pastNumberOfEntriesIndex = parseInt(args[2]);
                    }
                    const fastView = await getFastsIndexOf(fastCollectionDocument, authorID, 0, pastNumberOfEntriesIndex);
                    const fastDataToString = multipleFastsToString(message, fastView, pastNumberOfEntriesIndex);
                    fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See ${pastNumberOfEntriesIndex} Fasts`, fastEmbedColour);
                    message.channel.send(fastEmbed);
                    return;
                }
                // see <PAST_#_OF_ENTRIES> past <INDEX>
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() == "past") {
                        if (args[3] !== undefined) {
                            var entriesToSkip;
                            // If the argument after past is a number, valid command call!
                            if (!isNaN(args[3])) {
                                entriesToSkip = parseInt(args[3]);
                            }
                            else if (args[3] == "recent") {
                                entriesToSkip = 1;
                            }
                            else {
                                message.reply(fastSeeHelpMessage);
                                return;
                            }
                            if (entriesToSkip < 0 || entriesToSkip > totalFastNumber) {
                                fn.sendErrorMessageAndUsage(message, fastSeeHelpMessage, "**FAST(S) DO NOT EXIST**...");
                                return;
                            }
                            const confirmSeePastMessage = `Are you sure you want to **see ${args[1]} fasts past ${entriesToSkip}?**\n\n*(IF a lot of logs, it will spam DM/server!)*`;
                            const confirmSeePast = await fn.getUserConfirmation(message, confirmSeePastMessage, forceSkip, `Fast: See ${args[1]} Fasts Past ${entriesToSkip} WARNING!`);
                            if (!confirmSeePast) {
                                return;
                            }

                            const fastView = await getFastsIndexOf(fastCollectionDocument, authorID, entriesToSkip, pastNumberOfEntriesIndex);
                            const fastDataToString = multipleFastsToString(message, fastView, pastNumberOfEntriesIndex, entriesToSkip);
                            fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See ${pastNumberOfEntriesIndex} Fasts Past ${entriesToSkip}`, fastEmbedColour);
                            message.channel.send(fastEmbed);
                            return;
                        }
                        else {
                            message.reply(fastSeeHelpMessage);
                            return;
                        }
                    }
                }
                const fastView = await getOneFast(fastCollectionDocument, authorID, pastNumberOfEntriesIndex - 1);
                if (fastView === undefined) {
                    fn.sendErrorMessage(message, "**FAST DOES NOT EXIST**...");
                    return;
                }
                // NOT using the past functionality:
                var fastData;
                const fastEndTime = fastView[0].endTime;
                if (fastEndTime === null) {
                    fastData = fastCursorToDataArray(fastView[0], true, false, currentTimestamp);
                }
                else {
                    fastData = fastCursorToDataArray(fastView[0]);
                }

                var showFastEndMessage = false;
                if (fastEndTime === null) {
                    showFastEndMessage = true;
                }
                fastDataToString = `__**Fast ${pastNumberOfEntriesIndex}:**__\n` + fastDataArrayToString(fastData, showFastEndMessage, PREFIX, commandUsed);
                fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See Fast ${pastNumberOfEntriesIndex}`, fastEmbedColour);
                message.channel.send(fastEmbed);
            }
        }


        else if (fastCommand == "delete" || fastCommand == "d" || fastCommand == "remove"
            || fastCommand == "del" || fastCommand == "clear" || fastCommand == "erase") {
            var fastDeleteUsage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} past <PAST_#_OF_ENTRIES> <FIELD> <force>\``
                + `\n\`${PREFIX}${commandUsed} ${fastCommand} <#_MOST_RECENT_ENTRY> <FIELD> <force>\``
                + `\n\`${PREFIX}${commandUsed} ${fastCommand} many <RECENT_ENTRIES> <FIELD> <force>\``
                + `\n\`${PREFIX}${commandUsed} ${fastCommand} <#_OF_ENTRIES> past <STARTING_INDEX> <FIELD> <force>\``
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
            const fastDeleteHelpMessage = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see help\``;

            // delete help command so that the user does not get spammed with the usage message!
            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastDeleteUsage);
                    return;
                }
                const fastView = await totalFasts(fastCollectionDocument, authorID);
                // If the user has no fasts
                if (fastView == 0) {
                    message.reply(`NO FASTS... try \`${PREFIX}${commandUsed} start\``);
                    return;
                }
            }
            // fast delete (only):
            else {
                message.reply(`Try \`${PREFIX}${commandUsed} delete help\``);
                return;
            }

            // Show the user the most recent fast
            if (args[1] == undefined || args.length == 1) {
                message.channel.send(await getRecentFast(message, fastCollectionDocument, fastIsInProgress, PREFIX, commandUsed));
                message.reply(fastDeleteHelpMessage);
                return;
            }

            // delete past #:
            else if (args[2] !== undefined) {
                const deleteType = args[1].toLowerCase();
                if (deleteType == "past") {
                    // If the following argument is not a number, exit!
                    if (isNaN(args[2])) {
                        fn.sendErrorMessageAndUsage(message, fastDeleteHelpMessage);
                        return;
                    }
                    var numberArg = parseInt(args[2]);
                    if (numberArg <= 0) {
                        fn.sendErrorMessageAndUsage(message, fastDeleteHelpMessage);
                        return;
                    }
                    // Start with an empty string as it will be iteratively populated
                    var deleteConfirmMessage = "";
                    var fastTargetIDs = new Array();
                    const fastView = await getFastsIndexOf(fastCollectionDocument, authorID, 0, numberArg);
                    for (i = 0; i < numberArg; i++) {
                        if (fastView[i] == undefined) {
                            numberArg = i;
                            deleteConfirmMessage = `Are you sure you want to **delete ${numberArg} fasts?:**\n${deleteConfirmMessage}`;
                            break;
                        }
                        var fastData;
                        if (i === 0 && fastView[i].endTime === null) {
                            fastData = fastCursorToDataArray(fastView[i], true);
                        }
                        else {
                            fastData = fastCursorToDataArray(fastView[i]);
                        }
                        fastTargetIDs.push(fastView[i]._id);
                        fastDataToString = `__**Fast ${i + 1}:**__\n${fastDataArrayToString(fastData)}`;
                        // at the last element
                        if (i === numberArg - 1) {
                            deleteConfirmMessage = `${deleteConfirmMessage}${fastDataToString}`;
                        }
                        else {
                            deleteConfirmMessage = `${deleteConfirmMessage}${fastDataToString}\n\n`;
                        }
                    }
                    if (await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Past ${numberArg} Fasts`, 600000)) {
                        console.log(`Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Fasts`);
                        fastCollectionDocument.collection.deleteMany({ _id: { $in: fastTargetIDs } });
                    }
                    else {
                        return;
                    }
                }
                else if (deleteType == "many") {
                    if (args[2] === undefined) {
                        message.reply(fastDeleteHelpMessage);
                        return;
                    }
                    // Get the arguments after keyword MANY
                    // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
                    // Convert String of Numbers array into Integer array
                    // Check which fasts exist, remove/don't add those that don't
                    const existingFasts = await totalFasts(fastCollectionDocument, authorID);
                    const toDelete = args.slice(2).join("").split(',').filter(index => {
                        if (!isNaN(index)) {
                            numberIndex = parseInt(index);
                            if (numberIndex > 0 && numberIndex < existingFasts) {
                                return numberIndex;
                            }
                        }
                        else if (index === "recent") {
                            return true;
                        }
                    }).map(number => {
                        if (number === "recent") {
                            return 1;
                        }
                        else {
                            return +number;
                        }
                    });
                    console.log(toDelete);
                    // Send error message if none of the given fasts exist
                    if (toDelete.length === 0) {
                        fn.sendErrorMessage(message, "All of these **fasts DO NOT exist**...");
                        return;
                    }
                    var deleteConfirmMessage = "";
                    var fastTargetIDs = new Array();
                    let fastView = new Array();
                    for (i = 0; i < toDelete.length; i++) {
                        fastView = await getOneFast(fastCollectionDocument, authorID, toDelete[i] - 1);
                        var fastData;
                        if (toDelete[i] === 1) {
                            fastData = fastCursorToDataArray(fastView[0], true);
                        }
                        else {
                            fastData = fastCursorToDataArray(fastView[0]);
                        }
                        fastTargetIDs.push(fastView[0]._id);
                        fastDataToString = `\n__**Fast ${toDelete[i]}:**__\n` + fastDataArrayToString(fastData);
                        deleteConfirmMessage = deleteConfirmMessage + fastDataToString + "\n";
                    }
                    deleteConfirmMessage = `Are you sure you want to **delete fasts ${toDelete.toString()}?:**\n` + deleteConfirmMessage;
                    if (await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Fasts ${toDelete}`, 600000)) {
                        console.log(`Deleting ${authorID}'s Fasts ${toDelete}`);
                        fastCollectionDocument.collection.deleteMany({ _id: { $in: fastTargetIDs } });
                        return;
                    }
                }
                else if (args[2].toLowerCase() == "past") {
                    var skipEntries;
                    if (isNaN(args[3])) {
                        if (args[3].toLowerCase() == "recent") {
                            skipEntries = 0;
                        }
                        else {
                            message.reply(fastDeleteHelpMessage);
                            return;
                        }
                    }
                    else {
                        skipEntries = parseInt(args[3]);
                    }
                    const pastNumberOfEntries = parseInt(args[1]);
                    if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                        fn.sendErrorMessageAndUsage(message, fastDeleteHelpMessage);
                        return;
                    }
                    const fastCollection = await getFastsIndexOf(fastCollectionDocument, authorID, skipEntries, pastNumberOfEntries);
                    const showFasts = multipleFastsToString(message, fastCollection, pastNumberOfEntries, skipEntries);
                    if (skipEntries >= totalFastNumber) {
                        return;
                    }
                    // If the message is too long, the confirmation window didn't pop up and it defaulted to false!
                    const multipleDeleteMessage = `Are you sure you want to **delete ${fastCollection.length} fast(s) past fast ${skipEntries}**:\n\n${showFasts}`;
                    const multipleDeleteConfirmation = await fn.getUserConfirmation(message, multipleDeleteMessage, forceSkip, "Fast: Multiple Delete Warning!");
                    if (!multipleDeleteConfirmation) return;
                    const targetIDs = await fastCollection.map(fast => fast._id);
                    console.log(`Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} fasts(s) past ${skipEntries}`);
                    fastCollectionDocument.collection.deleteMany({ _id: { $in: targetIDs } });
                    return;
                }
                // They haven't specified the field for the fast delete past function
                else if (deleteType == "past") {
                    message.reply(fastDeleteHelpMessage);
                    return;
                }
                else {
                    message.reply(fastDeleteHelpMessage);
                    return;
                }
            }
            // Next: FAST DELETE ALL
            // Next: FAST DELETE MANY
            // Next: FAST DELETE

            // fast delete <NUMBER/RECENT/ALL>
            else {
                const noFastsMessage = `**NO FASTS**... try \`${PREFIX}${commandUsed} start help\``;
                if (isNaN(args[1])) {
                    const deleteType = args[1].toLowerCase();
                    if (deleteType == "recent") {
                        const fastView = await getOneFast(fastCollectionDocument, authorID, 0);
                        if (fastView === undefined) {
                            fn.sendErrorMessage(message, noFastsMessage);
                            return;
                        }
                        const fastData = fastCursorToDataArray(fastView[0], true);
                        const fastTargetID = [fastView[0]._id];
                        const deleteConfirmMessage = "Are you sure you want to **delete your most recent fast?:**\n\n__**Fast 1:**__\n" +
                            fastDataArrayToString(fastData);
                        if (await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Recent Fast`, 300000)) {
                            // Must Find the array of cursors first (map _id), then delete only args[3] of them
                            // Sort from greatest endtime => most recent
                            console.log(`Deleting ${authorUsername}'s (${authorID}) Recent Fast`);
                            fastCollectionDocument.collection.deleteOne({ _id: { $in: fastTargetID } });
                            return;
                        }
                    }
                    else if (deleteType == "all") {
                        const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded fasts?\n\nYou **cannot UNDO** this!" +
                            `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                        const pastNumberOfEntriesIndex = await totalFasts(fastCollectionDocument, authorID);
                        if (pastNumberOfEntriesIndex == 0) {
                            fn.sendErrorMessage(message, noFastsMessage);
                            return;
                        }
                        let confirmDeleteAll = await fn.getUserConfirmation(message, confirmDeleteAllMessage, forceSkip, "Fast: Delete All Fasts WARNING!");
                        if (!confirmDeleteAll) return;
                        const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR FASTS ON RECORD**?\n\nYou **cannot UNDO** this!"
                            + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                        let finalConfirmDeleteAll = await fn.getUserConfirmation(message, finalDeleteAllMessage, false, "Fast: Delete ALL Fasts Final Warning!");
                        if (!finalConfirmDeleteAll) return;
                        console.log(`Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Fasts`);
                        fastCollectionDocument.collection.deleteMany({ userID: authorID });
                        return;
                    }
                    else {
                        message.reply(fastDeleteHelpMessage);
                        return;
                    }
                }
                else {
                    const pastNumberOfEntriesIndex = parseInt(args[1]);
                    const fastView = await getOneFast(fastCollectionDocument, authorID, pastNumberOfEntriesIndex - 1);
                    if (fastView === undefined) {
                        fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, "**FAST DOES NOT EXIST**...");
                        return;
                    }
                    const fastData = fastCursorToDataArray(fastView[0]);
                    const fastTargetID = [fastView[0]._id];
                    const deleteConfirmMessage = `Are you sure you want to **delete Fast ${pastNumberOfEntriesIndex}?:**\n\n__**Fast ${pastNumberOfEntriesIndex}:**__\n` +
                        fastDataArrayToString(fastData);
                    if (await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Fast ${pastNumberOfEntriesIndex}`, 300000)) {
                        console.log(`Deleting ${authorUsername}'s (${authorID}) Recent Fast`);
                        fastCollectionDocument.collection.deleteOne({ _id: { $in: fastTargetID } });
                        return;
                    }
                }
            }
        }


        else if (fastCommand == "edit" || fastCommand == "ed" || fastCommand == "change"
            || fastCommand == "c" || fastCommand == "ch" || fastCommand == "alter" || fastCommand == "update"
            || fastCommand == "up" || fastCommand == "upd") {
            var fastEditUsage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <#_MOST_RECENT_ENTRY> <force>\``
                + "\n\n`<#_MOST_RECENT_ENTRY>`: **recent; 3** (3rd most recent entry, \\**any number*)"
                + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows! (More editing capabilities in future development)**"
            fastEditUsage = fn.getMessageEmbed(fastEditUsage, `Fast: Edit Help`, fastEmbedColour);
            const fastEditHelp = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            const fastEditTrySee = `Try \`${PREFIX}${commandUsed} see help\``;
            var pastNumberOfEntriesIndex;

            if (args[1] !== undefined) {
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastEditUsage);
                    return;
                }
                // If the user has no fasts
                if (totalFastNumber === 0) {
                    message.reply(`NO FASTS... Try \`${PREFIX}${commandUsed} start help\``);
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
                var fastBreaker, reflectionText, continueEditMessage;
                var fastFields = ["Start Time", "End Time", "Fast Breaker", "Mood", "Reflection"];
                let fieldsList = "";
                fastFields.forEach((element, i) => {
                    fieldsList = fieldsList + `\`${i + 1}\` - ${element}\n`;
                });
                if (args[1].toLowerCase() == "recent") {
                    pastNumberOfEntriesIndex = 1;
                }
                else {
                    pastNumberOfEntriesIndex = parseInt(args[1]);
                    if (pastNumberOfEntriesIndex <= 0) {
                        fn.sendErrorMessageAndUsage(message, fastEditHelp, "**FAST DOES NOT EXIST**...");
                        return;
                    }
                }
                const fastView = await getFastsIndexOf(fastCollectionDocument, authorID, pastNumberOfEntriesIndex - 1);
                if (fastView.length === 0) {
                    fn.sendErrorMessageAndUsage(message, fastEditHelp, `**FAST ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                    return;
                }
                const fastTargetID = fastView[0]._id;
                var fastData, showFast;
                if (fastView[0].endTime === null) {
                    fastData = fastCursorToDataArray(fastView[0], true);
                    showFast = fastDataArrayToString(fastData, true, PREFIX, commandUsed);
                }
                else {
                    fastData = fastCursorToDataArray(fastView[0]);
                    showFast = fastDataArrayToString(fastData);
                }
                var continueEdit = false;
                do {
                    // Field the user wants to edit
                    const fieldToEditInstructions = "**Which field do you want to edit?:**";
                    // const fieldToEditAdditionalMessage = `***NO \`<START/END_DATE/TIME>\` EDITING YET*** AND \n**\`fastDuration\`** CAN ONLY BE CHANGED TO **\`now\`**\n(In Development...)\n\n`
                    //     + `__**Fast ${pastNumberOfEntriesIndex}:**__\n${showFast}`;
                    const fieldToEditAdditionalMessage = `__**Fast ${pastNumberOfEntriesIndex}:**__\n${showFast}`;
                    const fieldToEditTitle = "Fast: Edit Field";
                    let fieldToEditIndex = await fn.userSelectFromList(message, fieldsList, 6, fieldToEditInstructions, fieldToEditTitle, fastEmbedColour, 180000, 0, fieldToEditAdditionalMessage);
                    if (fieldToEditIndex === false) {
                        return;
                    }
                    var userEdit, fastEditMessagePrompt = "";
                    const fieldToEdit = fastFields[fieldToEditIndex];
                    if (fieldToEditIndex == 0 || fieldToEditIndex == 1) {
                        fastEditMessagePrompt = "***(ONLY possible edit = `now`)***\n";
                    }
                    // No prompt for the fast breaker
                    else if (fieldToEditIndex == 3) {
                        fastEditMessagePrompt = "***(Please enter a number from `1-5`)***\n";
                    }
                    else if (fieldToEditIndex == 4) {
                        fastEditMessagePrompt = "**__Reflection Questions:__\n- __Why__ did you feel that way?\n"
                            + "- What did you do that made it great? / What could you have done to __make it better__?**\n";
                    }
                    if (fieldToEditIndex == 3) {
                        userEdit = await getUserEditNumber(message, fieldToEdit, 5, forceSkip);
                    }
                    else {
                        userEdit = await getUserEditString(message, fieldToEdit, fastEditMessagePrompt, forceSkip);
                    }
                    if (userEdit === false) {
                        return;
                    }
                    else if (userEdit !== "back") {
                        // Parse User Edit
                        if (fieldToEditIndex == 0 || fieldToEditIndex == 1) {
                            userEdit = userEdit.split(/ +/);
                            console.log({ userEdit });
                            fastData[fieldToEditIndex] = fn.timeCommandHandler(userEdit, message.createdAt);
                            // If the end time is correctly after the start time, update the fast duration as well!
                            // Otherwise, go back to the main menu
                            const validFastDuration = endTimeAfterStartTime(message, fastData[0], fastData[1]);
                            if (!validFastDuration) {
                                continueEdit = true;
                            }
                            else {
                                fastData[2] = fastData[1] - fastData[0];
                            }
                        }
                        else if (fieldToEditIndex == 2) {
                            fastData[fieldToEditIndex] = userEdit;
                        }
                        else if (fieldToEditIndex == 3) {
                            if (!isNaN(userEdit)) {
                                if (userEdit > 0 || userEdit <= 5) {
                                    fastData[fieldToEditIndex] = parseInt(userEdit);
                                }
                            }
                        }
                        else if (fieldToEditIndex == 4) {
                            fastData[fieldToEditIndex] = userEdit;
                        }

                        if (!continueEdit) {
                            console.log(`Editing ${authorID}'s Fast ${pastNumberOfEntriesIndex}`);
                            switch (fieldToEditIndex) {
                                case 0:
                                    await fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { startTime: fastData[0], fastDuration: fastData[2] } })
                                        .catch(err => console.error(err));
                                    break;
                                case 1:
                                    await fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { endTime: fastData[1], fastDuration: fastData[2] } })
                                        .catch(err => console.error(err));
                                    break;
                                case 2:
                                    await fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { fastBreaker: fastData[3] } })
                                        .catch(err => console.error(err));
                                    break;
                                case 3:
                                    await fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { mood: fastData[4] } })
                                        .catch(err => console.error(err));
                                    break;
                                case 4:
                                    await fastCollectionDocument.collection.updateOne({ _id: fastTargetID }, { $set: { reflection: fastData[5] } })
                                        .catch(err => console.error(err));
                                    break;
                            }
                            console.log({ userEdit });
                            showFast = fastDataArrayToString(fastData);
                            console.log({ fastData, fastTargetID, fieldToEditIndex });
                            continueEditMessage = `Do you want to continue **editing Fast ${pastNumberOfEntriesIndex}?:**\n\n__**Fast ${pastNumberOfEntriesIndex}:**__\n${showFast}`;
                            continueEdit = await fn.getUserConfirmation(message, continueEditMessage, forceSkip, `Fast: Continue Editing Fast ${pastNumberOfEntriesIndex}?`, 300000);
                        }
                    }
                    else {
                        continueEdit = true;
                    }
                }
                while (continueEdit === true);
                return;
            }
        }

        else if (fastCommand == "post" || fastCommand == "p" || fastCommand == "send" || fastCommand == "accountability"
            || fastCommand == "share" || fastCommand == "upload") {
            var fastPostUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <#_MOST_RECENT_ENTRY> <FIELD> <force>\``
                + `\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; 3 **(3rd most recent entry, \\**any number*)`
                + "\n\n`<FIELD>`(OPT.): **start; end; fastbreaker; duration; reflection** (includes mood); *Default:* all fields\n(if MULTIPLE `<FIELD>`s: separate by space!)"
                + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confimation windows!**";
            fastPostUsageMessage = fn.getMessageEmbed(fastPostUsageMessage, `Fast: Post Help`, fastEmbedColour);
            const fastPostHelpMessage = `**INVALID USAGE**... Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            const totalFastsNumber = await totalFasts(fastCollectionDocument, authorID);
            if (args[1] !== undefined) {
                var fastData;
                if (args[1].toLowerCase() == "help") {
                    message.channel.send(fastPostUsageMessage);
                    return;
                }
                // If the user has no fasts
                if (totalFastsNumber == 0) {
                    message.reply(`NO FASTS... try \`${PREFIX}${commandUsed} start help\``);
                    return;
                }
                if (isNaN(args[1])) {
                    if (args[1].toLowerCase() == "recent") {
                        // If user has no recent fast, case already handed above
                        const fastView = await getFastsIndexOf(fastCollectionDocument, authorID, 0);
                        const fastData = fastCursorToDataArray(fastView[0], true);
                        const startTimestamp = fastData[0];
                        const endTimestamp = fastData[1];
                        let fastPost = await getFastPostEmbed(message, fastData, forceSkip);
                        console.log({ fastPost });
                        if (!fastPost) return;
                        if (endTimestamp === null) {
                            await postFast(bot, message, fastPost, startTimestamp, PREFIX, commandUsed, forceSkip, totalFastsNumber);
                        }
                        else {
                            await postFast(bot, message, fastPost, endTimestamp, PREFIX, commandUsed, forceSkip, totalFastsNumber);
                        }
                        return;
                    }
                    else {
                        message.reply(fastPostHelpMessage);
                        return;
                    }
                }
                else {
                    var fastData;
                    let pastNumberOfEntriesIndex = parseInt(args[1]) - 1;
                    const fastView = await getFastsIndexOf(fastCollectionDocument, authorID, pastNumberOfEntriesIndex);
                    if (fastView === undefined) {
                        fn.sendErrorMessage(message, "**FAST DOES NOT EXIST**...");
                        return;
                    }
                    const shownFast = fastView[0];
                    if (pastNumberOfEntriesIndex === 0 && shownFast.endTime === null) {
                        fastData = fastCursorToDataArray(shownFast, true);
                    }
                    else {
                        fastData = fastCursorToDataArray(shownFast);
                    }
                    const startTimestamp = fastData[0];
                    const endTimestamp = fastData[1];
                    let fastPost = await getFastPostEmbed(message, fastData, forceSkip);
                    if (!fastPost) return;
                    if (endTimestamp === null) {
                        await postFast(bot, message, fastPost, startTimestamp, PREFIX, commandUsed, forceSkip, totalFastsNumber - pastNumberOfEntriesIndex + 1);
                    }
                    else {
                        await postFast(bot, message, fastPost, endTimestamp, PREFIX, commandUsed, forceSkip, totalFastsNumber - pastNumberOfEntriesIndex + 1);
                    }
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
};