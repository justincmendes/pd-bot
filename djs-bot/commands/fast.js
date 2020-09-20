// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Fast = require("../database/schemas/fasting");
const User = require("../database/schemas/user");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const Reminder = require("../database/schemas/reminder");
require("dotenv").config();

const fastEmbedColour = fn.fastEmbedColour;
const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const dateAndTimeInstructions = fn.getDateAndTimeInstructions;


// REDESIGNED:
// Computed Property Names
// Using Object Destructuring

// Function Declarations and Definitions
function fastDataArrayToString(fastData, showFastEndMessage = false, PREFIX = '?', commandUsed = 'fast') {
    const [startTimestamp, endTimestamp, fastDuration, fastBreaker, moodRating, reflectionText] = fastData;
    const startTimeToDate = fn.timestampToDateString(startTimestamp);
    const endTimeToDate = fn.timestampToDateString(endTimestamp);
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
function fastDocumentToDataArray(fastDocument, userTimezone = 0, calculateFastDuration = false, updateShownEndTime = false, endTimestamp = null) {
    var fastDataArray;
    const givenEndTimestamp = endTimestamp;
    const startTimestamp = fastDocument.startTime;
    // Calculate Fast Duration => endTime is not defined yet!
    if (updateShownEndTime === true) {
        endTimestamp = endTimestamp;
    }
    else {
        endTimestamp = fastDocument.endTime;
    }
    let fastDuration = fastDocument.fastDuration;
    if (calculateFastDuration && fastDuration === null) {
        if (givenEndTimestamp !== null) {
            fastDuration = givenEndTimestamp - startTimestamp;
        }
        else {
            let currentUTCTimestamp = Date.now();
            fastDuration = currentUTCTimestamp + (userTimezone * HOUR_IN_MS) - startTimestamp;
        }
    }
    if (fastDuration <= 0) {
        fastDuration = null;
    }
    const fastBreaker = fastDocument.fastBreaker;
    const moodRating = fastDocument.mood;
    const reflectionText = fastDocument.reflection;
    fastDataArray = [startTimestamp, endTimestamp, fastDuration, fastBreaker, moodRating, reflectionText];
    return fastDataArray;
}
function multipleFastsToString(message, fastArray, numberOfFasts, userTimezoneOffset, entriesToSkip = 0, toArray = false) {
    var fastDataOut = toArray ? new Array() : "";
    for (i = 0; i < numberOfFasts; i++) {
        if (fastArray[i] === undefined) {
            numberOfFasts = i;
            fn.sendErrorMessage(message, `**FASTS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`);
            break;
        }
        var fastData;
        if (fastArray[i].endTime === null) {
            fastData = fastDocumentToDataArray(fastArray[i], userTimezoneOffset, true);
        }
        else {
            fastData = fastDocumentToDataArray(fastArray[i]);
        }
        const fastDataString = `__**Fast ${i + entriesToSkip + 1}:**__\n${fastDataArrayToString(fastData)}`;
        if (toArray) fastDataOut.push(fastDataString);
        else {
            fastDataOut = fastDataOut + fastDataString;
            if (i !== numberOfFasts - 1) {
                fastDataOut += '\n\n';
            }
        }
    }
    return fastDataOut;
}
async function getTotalFasts(userID) {
    try {
        const fastCount = await Fast.find({ userID }).countDocuments();
        return fastCount;
    }
    catch (err) {
        console.error(err);
    }
}
async function getFastRecencyIndex(userID, fastID) {
    const totalFasts = await getTotalFasts(userID);
    let i = 0;
    while (true) {
        let fast = await getOneFastByStartTime(userID, i);
        if (fast === undefined && i === totalFasts) {
            i = false;
            break;
        }
        else if (fast._id.toString() == fastID.toString()) break;
        i++;
    }
    return i + 1;
}
async function getCurrentOrRecentFastEmbed(userID, fastIsInProgress, userTimezoneOffset, PREFIX, commandUsed = 'fast') {
    var fastView, fastType, fastData, fastDataToString, fastEmbed;
    if (fastIsInProgress === true) {
        // Show the user the current fast
        fastView = await Fast.findOne({
            userID,
            endTime: null
        })
            .catch(err => console.error(err));
        fastType = "Current";
        fastData = fastDocumentToDataArray(fastView, userTimezoneOffset, true);
    }
    else {
        // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
        // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
        // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
        fastView = await Fast
            .findOne({ userID })
            .sort({ _id: -1 });
        fastType = "Previous";
        fastData = fastDocumentToDataArray(fastView);
    }
    fastDataToString = `__**Fast ${await getCurrentOrRecentFastIndex(userID)}:**__\n`;
    if (fastIsInProgress === true) {
        fastDataToString += fastDataArrayToString(fastData, true, PREFIX, commandUsed);
    }
    else {
        fastDataToString += fastDataArrayToString(fastData, false, PREFIX, commandUsed);
    }
    fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See ${fastType} Fast`, fastEmbedColour);
    return (fastEmbed);
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
    const finalEndTimestamp = endTimestamp || Date.now();
    const endTimeToDate = fn.timestampToDateString(finalEndTimestamp);
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
        console.log({ targetChannelIndex });
        let targetChannelName = await bot.channels.cache.get(channelList[targetChannelIndex]).name;
        confirmSendToChannel = await fn.getUserConfirmation(userOriginalMessageObject, `Are you sure you want to send it to **#${targetChannelName}**?`, forceSkip);
    }
    // Overwrite fastPost Title with one specific to user's nickname in respective server
    fastPost = fastPost.setTitle(`${bot.guilds.cache.get(botUserMutualServerIDs[targetServerIndex]).member(authorID).displayName}'s ${endTimeToDate} Fast`);
    await fn.sendMessageToChannel(bot, fastPost, channelList[targetChannelIndex]);
    return true;
}

async function getOneFastByStartTime(userID, fastIndex) {
    const fast = await Fast
        .findOne({ userID: userID })
        .sort({ startTime: -1 })
        .skip(fastIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return fast;
}

async function getOneFastByRecency(userID, fastIndex) {
    const fast = await Fast
        .findOne({ userID: userID })
        .sort({ _id: -1 })
        .skip(fastIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return fast;
}

// Split each function: current and recent in to separated.
async function getCurrentOrRecentFastIndex(userID) {
    try {
        const fastIsInProgress = (await Fast.find({ userID, endTime: null }).countDocuments() > 0);
        var index;
        const fasts = await Fast
            .find({ userID })
            .sort({ startTime: -1 });
        if (fastIsInProgress) {
            for (i = 0; i < fasts.length; i++) {
                if (fasts[i].endTime === null) {
                    index = i + 1;
                    break;
                }
            }
        }
        else {
            let targetID = await Fast
                .findOne({ userID })
                .sort({ _id: -1 });
            targetID = targetID._id.toString();
            console.log({ targetID });
            for (i = 0; i < fasts.length; i++) {
                if (fasts[i]._id.toString() === targetID) {
                    index = i + 1;
                    break;
                }
            }
        }
        return index;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

async function getCurrentOrMostRecentFast(userID) {
    try {
        let fastView = await Fast
            .findOne({ userID, endTime: null });
        if (!fastView) {
            fastView = await Fast
                .findOne({ userID })
                .sort({ _id: -1 });
        }
        return fastView;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

/**
 * 
 * @param {Discord.Client} bot 
 * @param {String} authorID 
 * @param {mongoose.ObjectId} fastDocumentID 
 * @param {Number} currentTimestamp In UTC timezone
 * @param {Number} startTimestamp In relative user timezone
 * @param {Number} endTimestamp Reminder End Time in relative user timezone
 * @param {Number} sendHoursBeforeEnd 
 */
function setFastEndHourReminder(bot, userTimezoneOffset, authorID, fastDocumentID, currentTimestamp, startTimestamp, endTimestamp, sendHoursBeforeEnd = 1) {
    const intendedFastDuration = endTimestamp - startTimestamp;
    sendHoursBeforeEnd = intendedFastDuration > 0 ? (sendHoursBeforeEnd > 0 ? sendHoursBeforeEnd : 0) : 0;
    const preEndMessage = `**At least __${sendHoursBeforeEnd}__ more hour(s) left of your __${fn.millisecondsToTimeString(intendedFastDuration)}__ fast!**\n(Started: __${fn.timestampToDateString(startTimestamp)}__)`
        + `\nYou're at least **${(((intendedFastDuration - HOUR_IN_MS * sendHoursBeforeEnd) / intendedFastDuration) * 100).toFixed(2)}% finished!**\n\nFinish strong - I'm cheering you on 😁`;
    rm.setNewDMReminder(bot, authorID, currentTimestamp, startTimestamp - HOUR_IN_MS * userTimezoneOffset, endTimestamp - HOUR_IN_MS * (userTimezoneOffset + sendHoursBeforeEnd),
        preEndMessage, "Fast", fastDocumentID, false);
}
/**
 * 
 * @param {Discord.Client} bot 
 * @param {String} commandUsed 
 * @param {String} authorID 
 * @param {mongoose.ObjectId} fastDocumentID 
 * @param {Number} currentTimestamp In UTC timezone
 * @param {Number} startTimestamp In relative user timezone
 * @param {Number} endTimestamp Reminder End Time in relative user timezone
 */
function setFastEndReminder(bot, userTimezoneOffset, commandUsed, authorID, fastDocumentID, currentTimestamp, startTimestamp, endTimestamp) {
    const intendedFastDuration = endTimestamp - startTimestamp;
    const endMessage = `**Your __${fn.millisecondsToTimeString(intendedFastDuration)}__ fast is done!** (Started: __${fn.timestampToDateString(startTimestamp)}__)`
        + `\nGreat job tracking and completing your fast!\nIf you want to **edit** your fast before ending, type \`?${commandUsed} edit current\``
        + `\nIf you want to **end** your fast, type \`?${commandUsed} end <DATE/TIME>\` (i.e. \`<DATE/TIME>\`: **\`now\`**)`;
    rm.setNewDMReminder(bot, authorID, currentTimestamp, startTimestamp - HOUR_IN_MS * userTimezoneOffset, endTimestamp - HOUR_IN_MS * userTimezoneOffset, endMessage, "Fast",
        fastDocumentID, false);
}
/**
 * 
 * @param {*} message 
 * @param {*} fastTimeHelpMessage 
 * @param {*} userTimezoneOffset 
 * @param {*} userDaylightSavingSetting 
 * @param {*} forceSkip 
 * In relative terms (NOT UTC)
 */
async function getUserReminderEndTime(message, startTimestamp, fastTimeHelpMessage, userTimezoneOffset, userDaylightSavingSetting, forceSkip) {
    // Setup Reminder:
    let setReminder = true;
    var reminderEndTime;
    do {
        const reminderPrompt = "__**How long do you intend to fast?**__\nI will DM you **when your fast is done and an hour before it's done**"
            + "\n\nType `skip` to **start your fast without setting up an end of fast reminder**";
        const userTimeInput = await fn.messageDataCollectFirst(message, reminderPrompt, "Fast Duration", fastEmbedColour);
        if (userTimeInput === "skip") return undefined;
        if (userTimeInput === "stop" || userTimeInput === false) return false;
        // Undo the timezoneOffset to get the end time in UTC
        const timeArgs = userTimeInput.toLowerCase().split(/[\s\n]+/)
        reminderEndTime = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs, startTimestamp - HOUR_IN_MS * userTimezoneOffset,
            userTimezoneOffset, userDaylightSavingSetting);
        const intendedFastDuration = reminderEndTime - startTimestamp;
        console.log({ userTimeInput, startTimestamp, reminderEndTime, intendedFastDuration });
        if (reminderEndTime > startTimestamp && intendedFastDuration >= HOUR_IN_MS) setReminder = true;
        else {
            setReminder = false;
            fn.sendReplyThenDelete(message, `**Please enter a proper time in the future __> 1 hour__!**...\n${fastTimeHelpMessage} for **valid time inputs!**`, 30000);
        }
        if (setReminder) {
            const fastDurationString = fn.millisecondsToTimeString(intendedFastDuration);
            const confirmReminder = await fn.getUserConfirmation(message,
                `Are you sure you want to be reminded after **${fastDurationString}** of fasting?`,
                forceSkip, "Fast Reminder Confirmation");
            if (confirmReminder) return reminderEndTime;
        }
    }
    while (true)
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
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavingSetting, forceSkip) {
        // Variable Declarations and Initializations
        var fastUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} <ACTION>\`\n\n`
            + "`<ACTION>`: **help; start; end; see; edit; delete; post**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        fastUsageMessage = fn.getMessageEmbed(fastUsageMessage, "Fast: Help", fastEmbedColour);
        const fastHelpMessage = `Try \`${PREFIX}fast help\``;
        const authorID = message.author.id;
        const authorUsername = message.author.username;
        let fastCommand = args[0].toLowerCase();
        const fastInProgress = Fast.find({
            userID: authorID,
            endTime: null
        });
        const fastIsInProgress = (await fastInProgress.countDocuments() > 0);
        const totalFastNumber = await getTotalFasts(authorID);
        if (totalFastNumber === false) return;
        const fastFieldList = ["start", "end", "fastbreaker", "duration", "mood", "reflection"];
        // Computed Property Names: Reduces code footprint
        console.log({ authorUsername, authorID, fastIsInProgress });

        if (fastCommand === "help") return message.channel.send(fastUsageMessage);


        else if (fastCommand === "start" || fastCommand === "st" || fastCommand === "s") {
            // Check if the user does not already have a fast in progress, otherwise start.
            // Using greater than equal to ensure error message sent even though 
            // Any given user should not be able to have more than 1 fast running at a time
            var fastStartUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <DATE/TIME> <force>\`\n\n`
                + `${dateAndTimeInstructions}\n\n\`<force>\`: type **force** at the end of your command to **skip all of the confirmation windows!**`;

            fastStartUsageMessage = fn.getMessageEmbed(fastStartUsageMessage, `Fast: Start Help`, fastEmbedColour);
            const fastStartHelpMessage = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            const fastIsRunningMessage = `You already have a **fast running!**\nIf you want to **end** your fast, try \`${PREFIX}${commandUsed} end <DATE/TIME>\``
                + `\nIf you want to **restart** it, try \`${PREFIX}${commandUsed} edit current\``
                + `\nIf you want to **delete** your fast entry altogether, try \`${PREFIX}${commandUsed} delete current\``;
            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") return message.channel.send(fastStartUsageMessage);
            }
            if (fastIsInProgress >= 1) return message.reply(fastIsRunningMessage);
            else if (args[1] == undefined || args.length == 1) return message.reply(fastStartHelpMessage);
            else {
                // Remove the "start" from the args using slice
                const startTimeArgs = args.slice(1);
                startTimestamp = fn.timeCommandHandlerToUTC(startTimeArgs, message.createdTimestamp, timezoneOffset, daylightSavingSetting);
                if (startTimestamp === false) return message.reply(fastStartHelpMessage);
                // Setup Reminder:
                const reminderEndTime = await getUserReminderEndTime(message, startTimestamp, fastStartHelpMessage, timezoneOffset, daylightSavingSetting, forceSkip);
                if (reminderEndTime === false) return;

                let newFast = new Fast({
                    _id: mongoose.Types.ObjectId(),
                    userID: authorID,
                    //using Date.now() gives the time in milliseconds since Jan 1, 1970 00:00:00
                    startTime: startTimestamp,

                    //if the endTime or fastDuration is null that indicates that the fast is still going
                    endTime: null,
                    fastDuration: null,
                    fastBreaker: null,
                    mood: null,
                    reflection: null
                });
                const currentTimestamp = message.createdTimestamp;
                const fastDocumentID = newFast._id;
                console.log({ fastDocumentID });
                const reminderEndTimeExists = reminderEndTime || reminderEndTime === 0;
                if (reminderEndTimeExists) {
                    // First Reminder: 1 Hour Warning/Motivation
                    if (currentTimestamp + HOUR_IN_MS * timezoneOffset < reminderEndTime) {
                        setFastEndHourReminder(bot, timezoneOffset, authorID, fastDocumentID, currentTimestamp, startTimestamp, reminderEndTime, 1);
                    }
                    // Second Reminder: End Time
                    setFastEndReminder(bot, timezoneOffset, commandUsed, authorID, fastDocumentID, currentTimestamp, startTimestamp, reminderEndTime);
                }
                await newFast.save()
                    .then(result => console.log(result))
                    .catch(err => console.log(err));

                message.reply(`Your fast starting **${startTimeArgs.join(' ')}${reminderEndTimeExists ? `, for ${fn.millisecondsToTimeString(reminderEndTime - startTimestamp)}, ` : ", "}**`
                    + `is being recorded!`);
            }
        }


        else if (fastCommand === "end" || fastCommand === "e") {
            var fastEndUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <DATE/TIME> <force>\`\n\n`
                + `${dateAndTimeInstructions}\n\n\`<force>\`: type **force** at the end of your command to **skip all of the confirmation windows!**`;
            fastEndUsageMessage = fn.getMessageEmbed(fastEndUsageMessage, `Fast: End Help`, fastEmbedColour);
            const fastEndHelpMessage = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            const noFastRunningMessage = `You don't have a **fast running!**\nIf you want to **start** one \`${PREFIX}${commandUsed} start <DATE/TIME>\``;

            if (args[1] != undefined) {
                if (args[1].toLowerCase() == "help") {
                    return message.channel.send(fastEndUsageMessage);
                }
            }
            if (fastIsInProgress == 0) {
                return message.reply(noFastRunningMessage);
            }
            else if (args[1] == undefined || args.length == 1) {
                return message.reply(fastEndHelpMessage);
            }
            else {
                // FOR Handling when the user's fast ending time is not now!
                // Remove the "end" from the args using slice
                const endTimeArgs = args.slice(1);
                const endTimestamp = fn.timeCommandHandlerToUTC(endTimeArgs, message.createdTimestamp, timezoneOffset, daylightSavingSetting);
                if (endTimestamp === false) {
                    return message.reply(fastEndHelpMessage);
                }
                const currentFast = await getCurrentOrMostRecentFast(authorID);
                if (currentFast.endTime !== null) {
                    return message.reply(noFastRunningMessage);
                }
                // Can use authorID in this case as well, but will stick to pulling the
                // value from the database - to ensure the user is correct!
                const startTimestamp = currentFast.startTime;
                console.log({ currentFast, startTimestamp, endTimestamp });
                const validEndTime = fn.endTimeAfterStartTime(message, startTimestamp, endTimestamp, "Fast");
                if (!validEndTime) {
                    return message.channel.send(`If you want to change the start time try \`${PREFIX}${commandUsed} edit recent\``);
                }
                const currentFastUserID = currentFast.userID;
                const fastDurationTimestamp = endTimestamp - startTimestamp;
                console.log({ currentFastUserID, startTimestamp, fastDurationTimestamp });
                // EVEN if the time is not now it will be handled accordingly
                const quickEndMessage = `**✅ - Log additional information: fast breaker, mood, reflection**` +
                    `\n**⌚ - Quickly log** your **${fn.millisecondsToTimeString(fastDurationTimestamp)}** fast now` +
                    `\n**❌ - Exit**` +
                    `\n\n\\*IF \`<DATE/TIME>\` is at a **FUTURE time**: you can always \`${PREFIX}${commandUsed} edit\``;
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
                if (quickEnd === "❌") return;
                else if (quickEnd === "✅") {
                    // Send message and as for fastBreaker and upload a picture too
                    // which can be referenced later or sent to a server when DMs are handled!
                    fastBreaker = await fn.messageDataCollectFirst(message, fastBreakerPrompt, "Fast: Fast Breaker", fastEmbedColour, 300000);
                    console.log({ fastBreaker });
                    if (!fastBreaker || fastBreaker == "stop") return;
                    else if (fastBreaker == "skip") fastBreaker = null;

                    // +1 to convert the returned index back to natural numbers
                    moodValue = await fn.userSelectFromList(message, "", 5, moodValuePrompt, "Fast: Mood Assessment", fastEmbedColour);
                    if (moodValue === false) return;
                    else moodValue++;
                    var reflectionText = "";
                    let messageIndex = 0;
                    let reset = false;
                    do {
                        let userReflection = await fn.messageDataCollectFirst(message, reflectionTextPrompt, "Fast: Reflection", fastEmbedColour, 900000);
                        if (!userReflection) return;
                        if (userReflection === "1") break;
                        else if (userReflection === "reset") {
                            let confirmReset = await fn.getUserConfirmation(message, "Are you sure you want to **reset/clear** your current message?\nYour current reflection entry will be lost!",
                                forceSkip, "Fast: Reset Reflection Confirmation");
                            if (confirmReset === true) {
                                reflectionTextPrompt = reflectionTextPromptOriginal;
                                reflectionText = "";
                                reset = true;
                            }
                        }
                        else if (userReflection === "stop") return;
                        else if (userReflection === "skip") {
                            // Overwrite any previously collected data: Make sure the user wants to do that
                            let confirmSkip = await fn.getUserConfirmation(message, "Are you sure you want to **skip?**\nYour current reflection entry will be lost!",
                                forceSkip, "Fast: Skip Reflection Confirmation");
                            if (confirmSkip === true) {
                                reflectionText = null;
                                break;
                            }
                        }
                        else {
                            if (messageIndex === 0 || reset === true) {
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
                await Fast.findOneAndUpdate({
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
                    }, async (err, doc) => {
                        if (err) return console.error(`Failed to end fast:\n${err}`);
                        // Removing any lingering reminders
                        if (doc) {
                            const removeReminders = await Reminder.deleteMany({ connectedDocument: doc._id });
                            console.log({ removeReminders });
                            // Posting the fast
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
                        }
                    });
            }
        }


        else if (fastCommand === "see" || fastCommand === "view" || fastCommand === "find"
            || fastCommand === "look" || fastCommand === "lookup" || fastCommand === "show") {
            // Will add the ability to gather all of the user's data into a spreadsheet or note/JSON file!
            // **Handle users who do not yet have a fast!
            var fastSeeUsageMessage = fn.getReadOrDeleteUsageMessage(PREFIX, commandUsed, fastCommand, true, ["Fast", "Fasts"],
                false, false, [`\n\`${PREFIX}${commandUsed} ${fastCommand} <number>\``]);
            fastSeeUsageMessage = fn.getMessageEmbed(fastSeeUsageMessage, `Fast: See Help`, fastEmbedColour);
            const fastSeeHelpMessage = `**INVALID USAGE**... Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;

            // If the user wants fast help, do not proceed to show them the fast.
            const seeCommands = ["past", "recent", "current", "all"];
            var fastBreaker, reflectionText;
            currentTimestamp = Date.now();

            // MAKE THIS OPERATION INTO A FUNCTION!
            if (args[1] !== undefined) {
                if (args[1].toLowerCase() === "help") {
                    return message.channel.send(fastSeeUsageMessage);
                }
                // If the user has no fasts
                if (totalFastNumber === 0) {
                    return message.reply(`**NO FASTS**... try \`${PREFIX}${commandUsed} start help\``);
                }
                else if (args[1].toLowerCase() === "number") {
                    return message.reply(`You have **${totalFastNumber} fasts** on record.`);
                }
            }
            // fast see (only):
            else return message.reply(`Try \`${PREFIX}${commandUsed} see help\``);
            // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(args[1]) && isNaN(args[1])) {
                message.channel.send(await getCurrentOrRecentFastEmbed(authorID, fastIsInProgress, timezoneOffset, PREFIX, commandUsed));
                return message.reply(fastSeeHelpMessage);
            }
            // Do not show the most recent fast embed, when a valid command is called
            // it will be handled properly later based on the values passed in!
            else {
                const seeType = args[1].toLowerCase();
                var pastFunctionality,
                    pastNumberOfEntriesIndex;
                let indexByRecency = false;
                // To check if the given argument is a number!
                // If it's not a number and has passed the initial 
                // filter, then use the "past" functionality
                // Handling Argument 1:
                const isNumberArg = !isNaN(args[1]);
                if (seeType === "recent" || seeType === "current") {
                    return message.channel.send(await getCurrentOrRecentFastEmbed(authorID, fastIsInProgress, timezoneOffset, PREFIX, commandUsed));
                }
                else if (seeType === "all") {
                    pastNumberOfEntriesIndex = totalFastNumber;
                    pastFunctionality = true;
                }
                else if (isNumberArg) {
                    pastNumberOfEntriesIndex = parseInt(args[1]);
                    if (pastNumberOfEntriesIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, fastSeeHelpMessage, "**FAST DOES NOT EXIST**...");
                    }
                    else pastFunctionality = false;
                }
                else if (seeType === "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else {
                    message.channel.send(await getCurrentOrRecentFastEmbed(authorID, fastIsInProgress, timezoneOffset, PREFIX, commandUsed));
                    return message.reply(fastSeeHelpMessage);
                }
                console.log({ pastNumberOfEntriesIndex, pastFunctionality });
                if (pastFunctionality) {
                    // Loop through all of the given fields, account for aliases and update fields
                    // Find Entries, toArray, store data in meaningful output
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Start Time";
                    if (args[2] !== undefined) {
                        // If the next argument is NotaNumber, invalid "past" command call
                        if (isNaN(args[2])) {
                            message.channel.send(await getCurrentOrRecentFastEmbed(authorID, fastIsInProgress, timezoneOffset, PREFIX, commandUsed));
                            return message.reply(fastSeeHelpMessage);
                        }
                        if (parseInt(args[2]) <= 0) {
                            message.channel.send(await getCurrentOrRecentFastEmbed(authorID, fastIsInProgress, timezoneOffset, PREFIX, commandUsed));
                            return message.reply(fastSeeHelpMessage);
                        }
                        const confirmSeeMessage = `Are you sure you want to **see ${args[2]} fasts?**`;
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeMessage, forceSkip, `Fast: See ${args[2]} Fasts (${sortType})`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (seeType !== "all") {
                            message.channel.send(await getCurrentOrRecentFastEmbed(authorID, fastIsInProgress, timezoneOffset, PREFIX, commandUsed));
                            return message.reply(fastSeeHelpMessage);
                        }
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your fast history?";
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeAllMessage, forceSkip, "Fast: See All Fasts");
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                    if (pastNumberOfEntriesIndex === undefined) {
                        pastNumberOfEntriesIndex = parseInt(args[2]);
                    }
                    var fastView;
                    if (indexByRecency) fastView = await fn.getEntriesByRecency(Fast, { userID: authorID }, 0, pastNumberOfEntriesIndex);
                    else fastView = await fn.getEntriesByStartTime(Fast, { userID: authorID }, 0, pastNumberOfEntriesIndex);
                    console.log({ fastView });
                    const fastDataToStringArray = multipleFastsToString(message, fastView, pastNumberOfEntriesIndex, timezoneOffset, 0, true);
                    await fn.sendPaginationEmbed(message, fn.getEmbedArray(fastDataToStringArray, `Fast: See ${pastNumberOfEntriesIndex} Fasts (${sortType})`, true, true, fastEmbedColour));
                    return;
                }
                // see <PAST_#_OF_ENTRIES> <recent> past <INDEX>
                if (args[2] !== undefined) {
                    var shiftIndex;
                    if (args[2].toLowerCase() === "past") {
                        shiftIndex = 0;
                        indexByRecency = false;
                    }
                    else if (args[2].toLowerCase() === "recent") {
                        shiftIndex = 1;
                        indexByRecency = true;
                    }
                    else return message.reply(fastSeeHelpMessage);
                    if (args[2 + shiftIndex]) {
                        if (args[2 + shiftIndex].toLowerCase() === "past") {
                            if (args[3 + shiftIndex] !== undefined) {
                                const sortType = indexByRecency ? "By Recency" : "By Start Time";
                                var entriesToSkip;
                                // If the argument after past is a number, valid command call!
                                if (!isNaN(args[3 + shiftIndex])) {
                                    entriesToSkip = parseInt(args[3 + shiftIndex]);
                                }
                                else if (args[3 + shiftIndex].toLowerCase() === "recent" || args[3 + shiftIndex].toLowerCase() === "current") {
                                    entriesToSkip = await getCurrentOrRecentFastIndex(authorID);
                                }
                                else return message.reply(fastSeeHelpMessage);
                                if (entriesToSkip < 0 || entriesToSkip > totalFastNumber) {
                                    return fn.sendErrorMessageAndUsage(message, fastSeeHelpMessage, "**FAST(S) DO NOT EXIST**...");
                                }
                                const confirmSeePastMessage = `Are you sure you want to **see ${args[1]} fasts past ${entriesToSkip}?**`;
                                const confirmSeePast = await fn.getUserConfirmation(message, confirmSeePastMessage, forceSkip, `Fast: See ${args[1]} Fasts Past ${entriesToSkip} (${sortType})`);
                                if (!confirmSeePast) return;
                                var fastView;
                                if (indexByRecency) fastView = await fn.getEntriesByRecency(Fast, { userID: authorID }, entriesToSkip, pastNumberOfEntriesIndex);
                                else fastView = await fn.getEntriesByStartTime(Fast, { userID: authorID }, entriesToSkip, pastNumberOfEntriesIndex);
                                console.log({ fastView });
                                const fastDataToStringArray = multipleFastsToString(message, fastView, pastNumberOfEntriesIndex, timezoneOffset, entriesToSkip, true);
                                await fn.sendPaginationEmbed(message, fn.getEmbedArray(fastDataToStringArray, `Fast: See ${pastNumberOfEntriesIndex} Fasts Past ${entriesToSkip} (${sortType})`, true, true, fastEmbedColour));
                                return;
                            }
                        }
                    }
                }
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var fastView;
                if (indexByRecency) fastView = await getOneFastByRecency(authorID, pastNumberOfEntriesIndex - 1);
                else fastView = await getOneFastByStartTime(authorID, pastNumberOfEntriesIndex - 1);
                console.log({ fastView });
                if (!fastView) {
                    return fn.sendErrorMessage(message, `**FAST ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                }
                // NOT using the past functionality:
                const sortType = indexByRecency ? "By Recency" : "By Start Time";
                var fastData;
                const fastEndTime = fastView.endTime;
                if (fastEndTime === null) {
                    fastData = fastDocumentToDataArray(fastView, timezoneOffset, true, false, currentTimestamp);
                }
                else {
                    fastData = fastDocumentToDataArray(fastView);
                }

                var showFastEndMessage = false;
                if (fastEndTime === null) {
                    showFastEndMessage = true;
                }
                const fastDataToString = `__**Fast ${pastNumberOfEntriesIndex}:**__\n` + fastDataArrayToString(fastData, showFastEndMessage, PREFIX, commandUsed);
                const fastEmbed = fn.getMessageEmbed(fastDataToString, `Fast: See Fast ${pastNumberOfEntriesIndex} (${sortType})`, fastEmbedColour);
                message.channel.send(fastEmbed);
            }
        }

        else if (fastCommand === "delete" || fastCommand === "d" || fastCommand === "remove"
            || fastCommand === "del" || fastCommand === "clear" || fastCommand === "erase") {
            const additionalInstruction = `\n\nIF you'd like to see more of your fasts first before trying to delete: try \`${PREFIX}${commandUsed} see\``
                + `\nIF you'd like to archive the deleted fasts as well (i.e. get the data in a .txt file) - **proceed**.\nIF you'd like to archive without deletion, try: \`${PREFIX}${commandUsed} archive\` (FUTURE FEATURE)\\*`;
            var fastDeleteUsage = fn.getReadOrDeleteUsageMessage(PREFIX, commandUsed, fastCommand, true, ["Fast", "Fasts"], true, fastFieldList, false, additionalInstruction);
            fastDeleteUsage = fn.getMessageEmbed(fastDeleteUsage, `Fast: Delete Help`, fastEmbedColour);
            const fastDeleteHelpMessage = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see help\``;

            // delete help command so that the user does not get spammed with the usage message!
            if (args[1] !== undefined) {
                if (args[1].toLowerCase() === "help") {
                    return message.channel.send(fastDeleteUsage);
                }
                // If the user has no fasts
                if (totalFastNumber === 0) {
                    return message.reply(`**NO FASTS**... try \`${PREFIX}${commandUsed} start\``);
                }
            }
            // fast delete (only):
            else return message.reply(`Try \`${PREFIX}${commandUsed} delete help\``);

            // Show the user the most recent fast
            if (args[1] === undefined || args.length === 1) {
                message.channel.send(await getCurrentOrRecentFastEmbed(authorID, fastIsInProgress, timezoneOffset, PREFIX, commandUsed));
                return message.reply(fastDeleteHelpMessage);
            }

            // Delete Handler:

            // delete past #:
            else if (args[2] !== undefined) {
                const deleteType = args[1].toLowerCase();
                if (deleteType === "past") {
                    // If the following argument is not a number, exit!
                    if (isNaN(args[2])) {
                        return fn.sendErrorMessageAndUsage(message, fastDeleteHelpMessage);
                    }
                    var numberArg = parseInt(args[2]);
                    if (numberArg <= 0) {
                        return fn.sendErrorMessageAndUsage(message, fastDeleteHelpMessage);
                    }
                    let indexByRecency = false;
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Start Time";
                    var fastCollection;
                    if (indexByRecency) fastCollection = await fn.getEntriesByRecency(Fast, { userID: authorID }, 0, numberArg);
                    else fastCollection = await fn.getEntriesByStartTime(Fast, { userID: authorID }, 0, numberArg);
                    const fastDataToStringArray = multipleFastsToString(message, fastCollection, numberArg, timezoneOffset, 0, true);
                    const fastArray = fn.getEmbedArray(fastDataToStringArray, ``, true, false, fastEmbedColour);
                    console.log({ fastArray });
                    // If the message is too long, the confirmation window didn't pop up and it defaulted to false!
                    const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} fast(s)**?`;
                    const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(message, fastArray, multipleDeleteMessage, forceSkip, `Fast: Delete Past ${numberArg} Fasts (${sortType})`, 600000);
                    if (!multipleDeleteConfirmation) return;
                    const targetIDs = await fastCollection.map(fast => fast._id);
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Fasts (${sortType})`);
                    await fn.deleteManyByIDAndConnectedReminders(Fast, targetIDs);
                    return;
                }
                if (deleteType === "many") {
                    if (args[2] === undefined) {
                        return message.reply(fastDeleteHelpMessage);
                    }
                    // Get the arguments after keyword MANY
                    // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
                    // Convert String of Numbers array into Integer array
                    // Check which fasts exist, remove/don't add those that don't
                    let toDelete = args[2].split(',').filter(index => {
                        if (!isNaN(index)) {
                            numberIndex = parseInt(index);
                            if (numberIndex > 0 && numberIndex <= totalFastNumber) {
                                return numberIndex;
                            }
                        }
                        else if (index === "recent" || index === "current") {
                            return true;
                        }
                    });
                    const recentIndex = await getCurrentOrRecentFastIndex(authorID);
                    toDelete = Array.from(new Set(toDelete.map((number) => {
                        if (number === "recent" || number === "current") {
                            return recentIndex;
                        }
                        else return +number;
                    })));
                    console.log({ toDelete });
                    // Send error message if none of the given fasts exist
                    if (!toDelete.length) {
                        return fn.sendErrorMessage(message, "All of these **fasts DO NOT exist**...");
                    }
                    else {
                        var indexByRecency = false;
                        if (args[3] !== undefined) {
                            if (args[3].toLowerCase() === "recent") {
                                indexByRecency = true;
                            }
                        }
                        var fastTargetIDs = new Array();
                        var fastDataToString = new Array();
                        for (i = 0; i < toDelete.length; i++) {
                            var fastView;
                            if (indexByRecency) {
                                fastView = await getOneFastByRecency(authorID, toDelete[i] - 1);
                            }
                            else {
                                fastView = await getOneFastByStartTime(authorID, toDelete[i] - 1);
                            }
                            var fastData;
                            if (toDelete[i] === 1) {
                                fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
                            }
                            else {
                                fastData = fastDocumentToDataArray(fastView);
                            }
                            fastTargetIDs.push(fastView._id);
                            fastDataToString.push(`__**Fast ${toDelete[i]}:**__\n${fastDataArrayToString(fastData)}`);
                        }
                        const fastDataToStringArray = fn.getEmbedArray(fastDataToString, ``, true, false);
                        const deleteConfirmMessage = `Are you sure you want to **delete fasts ${toDelete}?:**`
                        const sortType = indexByRecency ? "By Recency" : "By Start Time";
                        const confirmDeleteMany = await fn.getPaginatedUserConfirmation(message, fastDataToStringArray, deleteConfirmMessage, forceSkip, `Fast: Delete Fasts ${toDelete} (${sortType})`, 600000);
                        if (confirmDeleteMany) {
                            console.log(`Deleting ${authorID}'s Fasts ${toDelete} (${sortType})`);
                            await fn.deleteManyByIDAndConnectedReminders(Fast, fastTargetIDs);
                            return;
                        }
                        else return;
                    }
                }
                else {
                    var shiftIndex;
                    let indexByRecency = false;
                    if (args[2].toLowerCase() === "past") {
                        shiftIndex = 0;
                        indexByRecency = false;
                    }
                    else if (args[2].toLowerCase() === "recent") {
                        shiftIndex = 1;
                        indexByRecency = true;
                    }
                    if (args[2 + shiftIndex]) {
                        if (args[2 + shiftIndex].toLowerCase() === "past") {
                            var skipEntries;
                            if (isNaN(args[3 + shiftIndex])) {
                                if (args[3 + shiftIndex].toLowerCase() === "recent" || args[3 + shiftIndex].toLowerCase() === "current") {
                                    skipEntries = await getCurrentOrRecentFastIndex(authorID);
                                }
                                else return message.reply(fastDeleteHelpMessage);
                            }
                            else skipEntries = parseInt(args[3 + shiftIndex]);
                            const pastNumberOfEntries = parseInt(args[1]);
                            if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                                return fn.sendErrorMessageAndUsage(message, fastDeleteHelpMessage);
                            }
                            var fastCollection;
                            if (indexByRecency) fastCollection = await fn.getEntriesByRecency(Fast, { userID: authorID }, skipEntries, pastNumberOfEntries);
                            else fastCollection = await fn.getEntriesByStartTime(Fast, { userID: authorID }, skipEntries, pastNumberOfEntries);
                            const showFasts = multipleFastsToString(message, fastCollection, pastNumberOfEntries, timezoneOffset, skipEntries, true);
                            if (skipEntries >= totalFastNumber) return;
                            // If the message is too long, the confirmation window didn't pop up and it defaulted to false!
                            const sortType = indexByRecency ? "By Recency" : "By Start Time";
                            const multipleDeleteMessage = `Are you sure you want to **delete ${fastCollection.length} fast(s) past fast ${skipEntries}**?`;
                            const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(message, showFasts, multipleDeleteMessage, forceSkip,
                                `Fast: Multiple Delete Warning! (${sortType})`, 600000);
                            // const multipleDeleteConfirmation = await fn.getUserConfirmation(message, multipleDeleteMessage, forceSkip, `Fast: Multiple Delete Warning! (${sortType})`);
                            if (!multipleDeleteConfirmation) return;
                            const targetIDs = await fastCollection.map(fast => fast._id);
                            console.log(`Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} fast(s) past ${skipEntries} (${sortType})`);
                            await fn.deleteManyByIDAndConnectedReminders(Fast, targetIDs);
                            return;
                        }

                        // They haven't specified the field for the fast delete past function
                        else if (deleteType === "past") return message.reply(fastDeleteHelpMessage);
                        else return message.reply(fastDeleteHelpMessage);
                    }
                }
            }
            // Next: FAST DELETE ALL
            // Next: FAST DELETE MANY
            // Next: FAST DELETE

            // fast delete <NUMBER/RECENT/ALL>
            const noFastsMessage = `**NO FASTS**... try \`${PREFIX}${commandUsed} start help\``;
            if (isNaN(args[1])) {
                const deleteType = args[1].toLowerCase();
                if (deleteType == "recent" || deleteType == "current") {
                    const fastView = await getCurrentOrMostRecentFast(authorID);
                    if (fastView.length === 0) {
                        return fn.sendErrorMessage(message, noFastsMessage);
                    }
                    const fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
                    const fastTargetID = fastView._id;
                    console.log({ fastTargetID });
                    const fastIndex = await getCurrentOrRecentFastIndex(authorID);
                    const deleteConfirmMessage = `Are you sure you want to **delete your most recent fast?:**\n\n__**Fast ${fastIndex}:**__\n${fastDataArrayToString(fastData)}`;
                    const deleteIsConfirmed = await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Recent Fast`, 300000)
                    if (deleteIsConfirmed) {
                        await fn.deleteOneByIDAndConnectedReminders(Fast, fastTargetID);
                        return;
                    }
                }
                else if (deleteType === "all") {
                    const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded fasts?\n\nYou **cannot UNDO** this!" +
                        `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    const pastNumberOfEntriesIndex = totalFastNumber;
                    if (pastNumberOfEntriesIndex === 0) {
                        return fn.sendErrorMessage(message, noFastsMessage);
                    }
                    let confirmDeleteAll = await fn.getUserConfirmation(message, confirmDeleteAllMessage, forceSkip, "Fast: Delete All Fasts WARNING!");
                    if (!confirmDeleteAll) return;
                    const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR FASTS ON RECORD**?\n\nYou **cannot UNDO** this!"
                        + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    let finalConfirmDeleteAll = await fn.getUserConfirmation(message, finalDeleteAllMessage, false, "Fast: Delete ALL Fasts FINAL Warning!");
                    if (!finalConfirmDeleteAll) return;
                    console.log(`Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Fasts`);
                    await fn.deleteManyAndConnectedReminders(Fast, { userID: authorID });
                    return;
                }
                else return message.reply(fastDeleteHelpMessage);
            }
            else {
                const pastNumberOfEntriesIndex = parseInt(args[1]);
                let indexByRecency = false;
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var fastView;
                if (indexByRecency) fastView = await getOneFastByRecency(authorID, pastNumberOfEntriesIndex - 1);
                else fastView = await getOneFastByStartTime(authorID, pastNumberOfEntriesIndex - 1);
                if (!fastView) {
                    return fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, "**FAST DOES NOT EXIST**...");
                }
                const fastData = fastDocumentToDataArray(fastView);
                const fastTargetID = fastView._id;
                const sortType = indexByRecency ? "By Recency" : "By Start Time";
                const deleteConfirmMessage = `Are you sure you want to **delete Fast ${pastNumberOfEntriesIndex}?:**\n\n__**Fast ${pastNumberOfEntriesIndex}:**__\n` +
                    fastDataArrayToString(fastData);
                const deleteConfirmation = await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Fast: Delete Fast ${pastNumberOfEntriesIndex} (${sortType})`, 300000);
                if (deleteConfirmation) {
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Fast ${sortType}`);
                    await fn.deleteOneByIDAndConnectedReminders(Fast, fastTargetID);
                    return;
                }
            }
        }


        else if (fastCommand === "edit" || fastCommand === "ed" || fastCommand === "change"
            || fastCommand === "c" || fastCommand === "ch" || fastCommand === "alter"
            || fastCommand === "update" || fastCommand === "up" || fastCommand === "upd") {
            var fastEditUsage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\``
                + "\n\n`<#_MOST_RECENT_ENTRY>`: **recent/current; 3** (3rd most recent entry, \\**any number*)"
                + "\n\n`<recent?>`(OPT.): type **recent** at the indicated spot to sort the fasts by **time created instead of fast start time!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**"
            fastEditUsage = fn.getMessageEmbed(fastEditUsage, `Fast: Edit Help`, fastEmbedColour);
            const fastEditHelp = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            var pastNumberOfEntriesIndex;
            if (args[1] !== undefined) {
                if (args[1].toLowerCase() === "help") {
                    return message.channel.send(fastEditUsage);
                }
                // If the user has no fasts
                if (totalFastNumber === 0) {
                    return message.reply(`**NO FASTS**... Try \`${PREFIX}${commandUsed} start help\``);
                }
            }
            // User typed fast edit only
            else return message.reply(fastEditHelp);

            if (isNaN(args[1]) && args[1].toLowerCase() !== "recent" && args[1].toLowerCase() !== "current") {
                return message.reply(fastEditHelp);
            }
            else {
                var fastFields = ["Start Time", "End Time", "Fast Breaker", "Mood", "Reflection"];
                let fieldsList = "";
                fastFields.forEach((fast, i) => {
                    fieldsList = fieldsList + `\`${i + 1}\` - ${fast}\n`;
                });
                if (args[1].toLowerCase() === "recent" || args[1].toLowerCase() === "current") {
                    pastNumberOfEntriesIndex = await getCurrentOrRecentFastIndex(authorID);
                }
                else {
                    pastNumberOfEntriesIndex = parseInt(args[1]);
                    if (pastNumberOfEntriesIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, fastEditHelp, "**FAST DOES NOT EXIST**...");
                    }
                }

                var indexByRecency = false;
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var fastView;
                if (indexByRecency) fastView = await getOneFastByRecency(authorID, pastNumberOfEntriesIndex - 1);
                else fastView = await getOneFastByStartTime(authorID, pastNumberOfEntriesIndex - 1);
                if (!fastView) {
                    return fn.sendErrorMessageAndUsage(message, fastEditHelp, `**FAST ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                }
                const sortType = indexByRecency ? "By Recency" : "By Start Time";
                const fastTargetID = fastView._id;
                var fastData, showFast, continueEdit, isCurrent;
                do {
                    const checkFast = await Fast.findById(fastTargetID);
                    if (!checkFast) return;
                    isCurrent = false;
                    continueEdit = false;
                    if (fastView.endTime === null) {
                        fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
                        showFast = fastDataArrayToString(fastData, true, PREFIX, commandUsed);
                        isCurrent = true;
                    }
                    else {
                        fastData = fastDocumentToDataArray(fastView);
                        showFast = fastDataArrayToString(fastData);
                    }
                    // Field the user wants to edit
                    const fieldToEditInstructions = "**Which field do you want to edit?:**";
                    const fieldToEditAdditionalMessage = `__**Fast ${pastNumberOfEntriesIndex} (${sortType}):**__\n${showFast}`;
                    const fieldToEditTitle = `Fast: Edit Field`;
                    let fieldToEditIndex = await fn.userSelectFromList(message, fieldsList, fastFields.length, fieldToEditInstructions,
                        fieldToEditTitle, fastEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                    if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                    var userEdit, fastEditMessagePrompt = "";
                    const fieldToEdit = fastFields[fieldToEditIndex];
                    const type = "Fast";
                    switch (fieldToEditIndex) {
                        case 0:
                            fastEditMessagePrompt = dateAndTimeInstructions;
                            userEdit = await fn.getUserEditString(message, fieldToEdit, fastEditMessagePrompt, type, forceSkip, fastEmbedColour);
                            break;
                        case 1:
                            fastEditMessagePrompt = dateAndTimeInstructions;
                            userEdit = await fn.getUserEditString(message, fieldToEdit, fastEditMessagePrompt, type, forceSkip, fastEmbedColour);
                            break;
                        // No prompt for the fast breaker
                        case 2:
                            userEdit = await fn.getUserEditString(message, fieldToEdit, fastEditMessagePrompt, type, forceSkip, fastEmbedColour);
                            break;
                        case 3:
                            fastEditMessagePrompt = "***(Please enter a number from `1-5`)***\n";
                            userEdit = await fn.getUserEditNumber(message, fieldToEdit, 5, type, forceSkip, fastEmbedColour);
                            break;
                        case 4:
                            fastEditMessagePrompt = "**__Reflection Questions:__**\n- __Why__ did you feel that way?\n"
                                + "- What did you do that made it great? / What could you have done to __make it better__?\n";
                            userEdit = await fn.getUserMultilineEditString(message, fieldToEdit, fastEditMessagePrompt, type, forceSkip, fastEmbedColour);
                            break;
                    }
                    if (userEdit === false) return;
                    else if (userEdit === undefined) userEdit = "back";
                    else if (userEdit !== "back") {
                        // Parse User Edit
                        if (fieldToEditIndex === 0 || fieldToEditIndex === 1) {
                            const timestamp = Date.now();
                            userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                            console.log({ userEdit });
                            fastData[fieldToEditIndex] = fn.timeCommandHandlerToUTC(userEdit, timestamp, timezoneOffset, daylightSavingSetting);
                            if (!fastData[fieldToEditIndex]) {
                                fn.sendReplyThenDelete(message, `**INVALID TIME**... Try \`${PREFIX}${commandUsed} start help\` or \`${PREFIX}${commandUsed} end help\``, 60000);
                            }
                            console.log({ fastData });
                            // If the end time is correctly after the start time, update the fast duration as well!
                            // Otherwise, go back to the main menu
                            const validFastDuration = fastData[fieldToEditIndex] ? fn.endTimeAfterStartTime(message, fastData[0], fastData[1], type) : false;
                            if (!validFastDuration) {
                                continueEdit = true;
                            }
                            else {
                                const startTimestamp = fastData[0];
                                if (isCurrent) {
                                    var changeReminders = true;
                                    var newDuration = false;
                                    var end = false;
                                    var endTimeIsDefined = false;
                                    const connectedReminderQuery = { connectedDocument: fastTargetID };
                                    let oldReminders = await Reminder.find(connectedReminderQuery).sort({ endTime: -1 });
                                    // Automatically update the end time if the start time is edited
                                    // If the end time is edited remove ambiguity of user intent
                                    // By prompting if they wish to end their fast or update their fast end time!
                                    if (fieldToEditIndex === 1) {
                                        const changeRemindersMessage = "Do you want to **update your fast end reminders (⬆)** OR **just end your fast completely? (⏭)**"
                                            + "\n(i.e. altering the 1 hour prior and fast end DM reminders vs. just removing all reminders and ending the fast)";
                                        const endReaction = await fn.reactionDataCollect(message, changeRemindersMessage, ['⬆', '⏭', '❌'], "Fast: Update End Reminders or End Fast",
                                            "#FF0000", 60000);
                                        endTimeIsDefined = true;
                                        switch (endReaction) {
                                            case '⬆': end = false;
                                                break;
                                            case '⏭': end = true;
                                                break;
                                            case '❌': end = false;
                                                changeReminders = false;
                                                break;
                                        }
                                        if (end) {
                                            await Reminder.deleteMany(connectedReminderQuery);
                                            changeReminders = false;
                                        }
                                    }
                                    else if (fieldToEditIndex === 0) {
                                        const updateRemindersMessage = "Do you want to **update your intended fast duration?**";
                                        newDuration = await fn.getUserConfirmation(message, updateRemindersMessage, false, "Fast: Update Fast Duration");
                                        if (!newDuration) {
                                            if (!oldReminders.length) changeReminders = false;
                                        }
                                    }

                                    if (changeReminders) {
                                        const currentTimestamp = Date.now();
                                        var reminderEndTime;
                                        if (endTimeIsDefined) {
                                            const endTimestamp = fastData[1];
                                            reminderEndTime = endTimestamp;
                                        }
                                        else if (oldReminders.length && !newDuration) {
                                            // The largest endTimestamp is assumed to be the fast end time!
                                            // oldReminders is sorted from greatest to least.
                                            reminderEndTime = startTimestamp + oldReminders[0].endTime - oldReminders[0].startTime;
                                            if (!reminderEndTime) changeReminders = false;
                                            await Reminder.deleteMany(connectedReminderQuery);
                                        }
                                        else {
                                            reminderEndTime = await getUserReminderEndTime(message, startTimestamp,
                                                `Try \`${fieldToEditIndex === 0 ? `${PREFIX}${commandUsed} start help` : `${PREFIX}${commandUsed} end help`}\``,
                                                timezoneOffset, daylightSavingSetting, forceSkip);
                                            if (!reminderEndTime && reminderEndTime !== 0) changeReminders = false;
                                        }
                                        if (changeReminders) {
                                            console.log({
                                                userTimezoneOffset: timezoneOffset, authorID, fastTargetID,
                                                currentTimestamp, startTimestamp, reminderEndTime
                                            });
                                            // First Reminder: 1 Hour Warning/Motivation
                                            if ((reminderEndTime + timezoneOffset * HOUR_IN_MS) > currentTimestamp) {
                                                setFastEndHourReminder(bot, timezoneOffset, authorID, fastTargetID, currentTimestamp,
                                                    startTimestamp, reminderEndTime, 1);
                                            }
                                            // Second Reminder: End Time
                                            setFastEndReminder(bot, timezoneOffset, commandUsed, authorID, fastTargetID, currentTimestamp,
                                                startTimestamp, reminderEndTime);
                                        }
                                        else fastData[1] = null;
                                    }
                                }
                                if (endTimeIsDefined) {
                                    const endTimestamp = fastData[1];
                                    fastData[2] = endTimestamp - startTimestamp;
                                }
                                if (!end) {
                                    fastData[1] = null;
                                    fastData[2] = null;
                                }
                            }
                        }
                        else {
                            switch (fieldToEditIndex) {
                                case 2: fastData[fieldToEditIndex + 1] = userEdit;
                                    break;
                                case 3:
                                    if (!isNaN(userEdit)) {
                                        if (userEdit > 0 || userEdit <= 5) {
                                            fastData[fieldToEditIndex + 1] = parseInt(userEdit);
                                        }
                                    }
                                    break;
                                case 4: fastData[fieldToEditIndex] = userEdit;
                                    break;
                            }
                        }
                        if (!continueEdit) {
                            try {
                                console.log(`Editing ${authorID}'s Fast ${pastNumberOfEntriesIndex} (${sortType})`);
                                switch (fieldToEditIndex) {
                                    case 0:
                                        fastView = await Fast.findOneAndUpdate({ _id: fastTargetID }, { $set: { startTime: fastData[0], fastDuration: fastData[2] } }, { new: true });
                                        break;
                                    case 1:
                                        fastView = await Fast.findOneAndUpdate({ _id: fastTargetID }, { $set: { endTime: fastData[1], fastDuration: fastData[2] } }, { new: true });
                                        break;
                                    case 2:
                                        fastView = await Fast.findOneAndUpdate({ _id: fastTargetID }, { $set: { fastBreaker: fastData[3] } }, { new: true });
                                        break;
                                    case 3:
                                        fastView = await Fast.findOneAndUpdate({ _id: fastTargetID }, { $set: { mood: fastData[4] } }, { new: true });
                                        break;
                                    case 4:
                                        fastView = await Fast.findOneAndUpdate({ _id: fastTargetID }, { $set: { reflection: fastData[5] } }, { new: true });
                                        break;
                                }
                                console.log({ continueEdit, userEdit });
                                if (fastView) {
                                    pastNumberOfEntriesIndex = await getFastRecencyIndex(authorID, fastTargetID);
                                    console.log({ fastView, fastData, fastTargetID, fieldToEditIndex });
                                    fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
                                    showFast = fastDataArrayToString(fastData);
                                    console.log({ userEdit });
                                    const continueEditMessage = `Do you want to continue **editing Fast ${pastNumberOfEntriesIndex}?:**\n\n__**Fast ${pastNumberOfEntriesIndex}:**__\n${showFast}`;
                                    continueEdit = await fn.getUserConfirmation(message, continueEditMessage, forceSkip, `Fast: Continue Editing Fast ${pastNumberOfEntriesIndex}?`, 300000);
                                }
                                else {
                                    message.reply("**Fast does not exist anymore...**");
                                    continueEdit = false;
                                }
                            }
                            catch (err) {
                                return console.log(err);
                            }
                        }
                        else {
                            console.log({ continueEdit, userEdit });
                            fastView = await Fast.findById(fastTargetID);
                            if (fastView) {
                                pastNumberOfEntriesIndex = await getFastRecencyIndex(authorID, fastTargetID);
                                console.log({ fastView, fastData, fastTargetID, fieldToEditIndex });
                                fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
                                showFast = fastDataArrayToString(fastData);
                            }
                            else {
                                message.reply("**Fast does not exist anymore...**");
                                continueEdit = false;
                            }
                        }
                    }
                    else continueEdit = true;
                }
                while (continueEdit === true);
                return;
            }
        }

        else if (fastCommand === "post" || fastCommand === "p" || fastCommand === "send"
            || fastCommand === "accountability" || fastCommand === "share" || fastCommand === "upload") {
            var fastPostUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\``
                + `\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; 3 **(3rd most recent entry, \\**any number*)`
                + "\n\n`<recent?>`(OPT.): type **recent** at the indicated spot to sort the fasts by **time created instead of fast start time!**"
                + "\n\n`<force>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            fastPostUsageMessage = fn.getMessageEmbed(fastPostUsageMessage, `Fast: Post Help`, fastEmbedColour);
            const fastPostHelpMessage = `**INVALID USAGE**... Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
            if (args[1] !== undefined) {
                var fastData;
                if (args[1].toLowerCase() === "help") {
                    return message.channel.send(fastPostUsageMessage);
                }
                // If the user has no fasts
                if (totalFastNumber === 0) {
                    return message.reply(`**NO FASTS**... try \`${PREFIX}${commandUsed} start help\``);
                }
                if (isNaN(args[1])) {
                    if (args[1].toLowerCase() === "recent" || args[1].toLowerCase() === "current") {
                        // If user has no recent fast, case already handed above
                        const fastView = await getCurrentOrMostRecentFast(authorID);
                        console.log({ fastView });
                        const fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
                        console.log({ fastData });
                        const startTimestamp = fastData[0];
                        const endTimestamp = fastData[1];
                        let fastPost = await getFastPostEmbed(message, fastData, forceSkip);
                        console.log({ fastPost });
                        if (!fastPost) return;
                        if (endTimestamp === null) await postFast(bot, message, fastPost, startTimestamp, PREFIX, commandUsed, forceSkip, totalFastNumber);
                        else await postFast(bot, message, fastPost, endTimestamp, PREFIX, commandUsed, forceSkip, totalFastNumber);
                        return;
                    }
                    else return message.reply(fastPostHelpMessage);
                }
                else {
                    let pastNumberOfEntriesIndex = parseInt(args[1]);
                    var indexByRecency = false;
                    if (args[2] !== undefined) {
                        if (args[2].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var fastView;
                    if (indexByRecency) fastView = await getOneFastByRecency(authorID, pastNumberOfEntriesIndex - 1);
                    else fastView = await getOneFastByStartTime(authorID, pastNumberOfEntriesIndex - 1);
                    if (fastView.length === 0) {
                        return fn.sendErrorMessage(message, "**FAST DOES NOT EXIST**...");
                    }
                    var fastData;
                    if (pastNumberOfEntriesIndex === 0 && fastView.endTime === null) {
                        fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
                    }
                    else fastData = fastDocumentToDataArray(fastView);
                    console.log({ fastData });
                    const startTimestamp = fastData[0];
                    const endTimestamp = fastData[1];
                    let fastPost = await getFastPostEmbed(message, fastData, forceSkip);
                    if (!fastPost) return;
                    if (endTimestamp === null) await postFast(bot, message, fastPost, startTimestamp, PREFIX, commandUsed, forceSkip, totalFastNumber - pastNumberOfEntriesIndex);
                    else await postFast(bot, message, fastPost, endTimestamp, PREFIX, commandUsed, forceSkip, totalFastNumber - pastNumberOfEntriesIndex);
                }
            }
            // fast post (only):
            else return message.reply(fastPostHelpMessage);
        }


        else return message.reply(fastHelpMessage);
    }
};