// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const DailyJournal = require("../database/schemas/dailyjournal");
const WeeklyJournal = require("../database/schemas/weeklyjournal");
const User = require("../database/schemas/user");
const Guild = require("../database/schemas/guildsettings");
const Mastermind = require("../database/schemas/mastermind");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();


const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const mastermindEmbedColour = fn.mastermindEmbedColour;
const areasOfLifeEmojis = fn.areasOfLifeEmojis;
const areasOfLife = fn.areasOfLife;

// Function Declarations and Initializations
// Use WeeklyJournalEntry function to create empty entries and format in backticks for Discord markdown

// FUTURE FEATURE: Create .txt file with FULL entry and react with paperclip for user to download the file
async function sendGeneratedTemplate(message, numberOfUsers, namesForTemplate, withMarkdown = true, templateEmbedColour = mastermindEmbedColour) {
    const date = new Date();
    let templateArray = new Array();
    for (templateIndex = 0; templateIndex < numberOfUsers; templateIndex++) {
        if (namesForTemplate[templateIndex] == undefined) {
            namesForTemplate.push(`NAME_${templateIndex + 1}`);
        }
        if (templateIndex === 0) {
            templateArray.push(`\`**__${date.toString()}__**\`\n\n${fn.mastermindWeeklyJournalEntry(namesForTemplate[templateIndex], withMarkdown)}`);
        }
        else templateArray.push(fn.mastermindWeeklyJournalEntry(namesForTemplate[templateIndex], withMarkdown));
    }
    await fn.sendPaginationEmbed(message, fn.getEmbedArray(templateArray, "Mastermind: Weekly Reflection And Goals Template", true, true, templateEmbedColour));
}

async function getOneMastermindByCreatedTime(userID, mastermindIndex) {
    const mastermind = await Mastermind
        .findOne({ userID })
        .sort({ createdAt: -1 })
        .skip(mastermindIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return mastermind;
}

async function getOneMastermindByRecency(userID, mastermindIndex) {
    const mastermind = await Mastermind
        .findOne({ userID })
        .sort({ _id: -1 })
        .skip(mastermindIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return mastermind;
}

function mastermindDocumentToString(bot, mastermindDoc) {
    const { createdAt, createdBy, guildID, usedTemplate, journal } = mastermindDoc;
    const guildString = guildID ? `\n**Server:** ${bot.guilds.cache.get(guildID).name}` : "";
    // const guild = bot.guilds.cache.get(guildID);
    // ${guild.member(createdBy).displayName} 
    // const username = `<@!${userID}>`;
    const creatorUsername = `<@!${createdBy}>`;
    var entryString;
    if (usedTemplate) {
        const { observations, areaOfLife, stopEntry, startEntry, continueEntry, goals } = journal;
        entryString = fn.mastermindWeeklyJournalEntry(false, false,
            observations, areaOfLife, stopEntry, startEntry, continueEntry, goals);
    }
    else entryString = journal.entry;
    return `**Created At:** ${fn.timestampToDateString(createdAt)}`
        + guildString
        + `\n**Created By:** ${creatorUsername}`
        + `\n\n${entryString}`;
}

function multipleMastermindsToString(bot, message, mastermindArray, numberOfMasterminds, entriesToSkip = 0, toArray = false) {
    var entriesToString = toArray ? new Array() : "";
    console.log({ numberOfMasterminds });
    for (i = 0; i < numberOfMasterminds; i++) {
        if (mastermindArray[i] === undefined) {
            numberOfMasterminds = i;
            fn.sendErrorMessage(message, `**MASTERMINDS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`);
            break;
        }
        const mastermindString = `__**Mastermind ${i + entriesToSkip + 1}:**__`
            + `\n${mastermindDocumentToString(bot, mastermindArray[i])}`;
        if (toArray) entriesToString.push(mastermindString);
        else {
            entriesToString = `${entriesToString}${mastermindString}`;
            if (i !== numberOfMasterminds - 1) {
                entriesToString += '\n\n';
            }
        }
    }
    return entriesToString;
}

async function getMostRecentMastermind(bot, userID, embedColour = mastermindEmbedColour) {
    const recentMastermindToString = `__**Mastermind ${await getRecentMastermindIndex(userID)}:**__`
        + `\n${mastermindDocumentToString(bot, await getOneMastermindByRecency(userID, 0))}`;
    const mastermindEmbed = fn.getMessageEmbed(recentMastermindToString, `Mastermind: See Recent Entry`, embedColour);
    return mastermindEmbed;
}

async function getRecentMastermindIndex(userID) {
    try {
        var index;
        const entries = await Mastermind
            .find({ userID })
            .sort({ createdAt: -1 });
        console.log({ entries });
        if (entries) {
            if (entries.length) {
                let targetID = await Mastermind
                    .findOne({ userID })
                    .sort({ _id: -1 });
                targetID = targetID._id.toString();
                console.log({ targetID });
                for (i = 0; i < entries.length; i++) {
                    if (entries[i]._id.toString() === targetID) {
                        index = i + 1;
                        return index;
                    }
                }
            }
        }
        else return -1;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

async function getMastermindByCreatedAt(userID, entryIndex, numberOfEntries = 1) {
    try {
        const entries = await Mastermind
            .find({ userID })
            .sort({ createdAt: -1 })
            .limit(numberOfEntries)
            .skip(entryIndex);
        console.log(entries);
        return entries;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

async function getSingleEntry(message, instructionPrompt, title, forceSkip = false, embedColour = mastermindEmbedColour, additionalInstructions = "", instructionKeywords = []) {
    let reset = false;
    var collectedEntry;
    instructionPrompt += !additionalInstructions ? "" : `\n\n${additionalInstructions}`;
    var hasInstructions = false;
    if (instructionKeywords) {
        if (Array.isArray(instructionKeywords)) {
            if (instructionKeywords.length) {
                hasInstructions = true;
            }
        }
    }
    do {
        reset = false;
        collectedEdit = await fn.messageDataCollectFirst(message, instructionPrompt, title, embedColour, 600000);
        if (!collectedEdit) return false;
        if (hasInstructions) {
            if (instructionKeywords.includes(collectedEdit)) {
                return collectedEdit;
            }
        }
        if (!reset) {
            const confirmEntry = await fn.getUserConfirmation(message, `**__Are you sure you want to enter:__**\n${collectedEdit}`, forceSkip, title);
            if (!confirmEntry) {
                reset = true;
            }
        }
    }
    while (reset);
    return collectedEdit;
}

async function getMultilineEntry(message, instructionPrompt, title, forceSkip = false, embedColour = mastermindEmbedColour, additionalInstructions = "", instructionKeywords = []) {
    let inputIndex = 0;
    let reset = false;
    var collectedEntry, finalEntry = new Array();
    instructionPrompt += `\n\nType \`0\` to **restart/clear** your **entire** current entry!`
        + `\nType \`1\` when you're **done!**\nType \`2\` to **undo** the previous entry`;
    instructionPrompt += !additionalInstructions ? "" : `\n\n${additionalInstructions}`;
    var hasInstructions = false;
    if (instructionKeywords) {
        if (Array.isArray(instructionKeywords)) {
            if (instructionKeywords.length) {
                hasInstructions = true;
            }
        }
    }
    const originalPrompt = instructionPrompt;
    do {
        inputIndex++;
        collectedEntry = await fn.messageDataCollectFirst(message, instructionPrompt, title, embedColour, 600000, false);
        if (!collectedEntry || collectedEntry === "stop") {
            if (collectedEntry !== "stop") {
                fn.sendReplyThenDelete(message, `**Exiting...** This was your **entry**: *(Deleting in 10 minutes)*\n${finalEntry.join('\n')}`, 600000);
            }
            return false;
        }
        if (hasInstructions) {
            if (instructionKeywords.includes(collectedEntry)) {
                return collectedEntry;
            }
        }
        if (inputIndex === 1 || reset === true) {
            if (collectedEntry === "1") {
                const endConfirmation = await fn.getUserConfirmation(message, `**__Are you sure you want to enter:__**\n${finalEntry.join('\n')}`, forceSkip, title, 180000);
                if (endConfirmation === true) break;
            }
            else if (collectedEntry !== "0" && collectedEntry !== "2") {
                instructionPrompt += `\n\n**Current Entry:**\n${collectedEntry}\n`;
                previousEntry = collectedEntry;
                finalEntry.push(collectedEntry);
                reset = false;
            }
            else inputIndex = 0;
        }
        else if (collectedEntry === "1") {
            const endConfirmation = await fn.getUserConfirmation(message, `**__Are you sure you want to enter:__**\n${finalEntry.join('\n')}`, forceSkip, title, 180000);
            if (endConfirmation === true) break;
        }
        else if (collectedEntry === "0") {
            if (finalEntry === "") {
                reset = true;
            }
            else {
                const resetWarningMessage = `__Are you sure you want to **reset** the current entry for this section?:__\n${finalEntry.join('\n')}`;
                let resetConfirmation = await fn.getUserConfirmation(message, resetWarningMessage, false, `${title} Reset`);
                if (resetConfirmation === true) {
                    instructionPrompt = originalPrompt;
                    finalEntry = new Array();
                    reset = true;
                }
            }
        }
        // Undo Mechanism
        else if (collectedEntry === "2") {
            if (finalEntry.length) {
                let error = false;
                if (finalEntry.length === 1) {
                    instructionPrompt = originalPrompt;
                    reset = true;
                }
                else {
                    targetStringIndex = instructionPrompt.lastIndexOf(finalEntry[finalEntry.length - 1]);
                    if (targetStringIndex >= 0) {
                        instructionPrompt = instructionPrompt.substring(0, targetStringIndex);
                    }
                    else {
                        console.log("Could not undo the last entry!");
                        fn.sendMessageThenDelete(message, `**Sorry <@!${message.author.id}>, I could not undo the last entry!**`, 30000);
                        error = true;
                    }
                }
                if (!error) finalEntry.pop();
            }
            else {
                instructionPrompt = originalPrompt;
                reset = true;
            }
        }
        else {
            instructionPrompt = instructionPrompt + collectedEntry + "\n";
            finalEntry.push(collectedEntry);
        }
    }
    while (true)
    return finalEntry.join('\n');
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

module.exports = {
    name: "mastermind",
    description: "Mastermind Meeting/Group Helper",
    aliases: ["m", "mm", "master", "masterminds"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        // Will allow for text collection of notes during meeting and output it in a nice format!
        // Allow users with the mastermind facilitator role to press the pencil and edit the sent message!
        // User's with mastermind role can ADD TO ANYONE'S ENTRIES! **be careful**
        // Others can only edit their own
        // Collect 1 message per user and put it beside their tag!

        // Long-Term Goal Creation (store in DB and allow user to edit it in the channel!)

        // Scriber Mode: Admin team OR a specific role only can add to the messages (when event is called)

        // All Mode: anyone who types can change add to and change their reflection! If they type 1, finalize
        // their contributions. (flag a boolean) But if they type more give them a confirmation warning that
        // they will overwrite their previous progress!
        // edit: allow them to edit their current contribution! running in the channel rn
        // Add contributions to the embed so far so everyone can see.
        // Once it is closed - finalize document and no longer listen to messages
        // React with a pencil so that users can edit the message if they wish in a dm
        // Once the pencil is reacted to, dm the user. Remove reaction
        // Give their current entry markdown in `code`
        // When finished in DM, update the embed in the weekly reflection channel!

        // Solo: They can only edit the things they contribute

        // Faciliator: Anyone can edit the whole embed or certain parts of the embed
        // Can edit/add/start other user's reflections!
        // This is possible through

        // Day collect - allow the bot to listen to messages in a certain channel for a day

        // Type 1 to go to the next prompt as you're filling it out!
        // Type 0 to leave section blank!
        // It will go to weekly goal 1, weekly goal 2 and so on

        //NOTE: when one user is working on their edit, they are only allow to change their part
        // Manage this via a double array and @mention userid
        // Other people's part will not be affected by one user editing theirs!

        // Make array for each user that types (new one if they author id hasn't been seen)
        // Make array of this array holding each user's entries (object oriented) identifiable by the user id
        // NO bots
        // WHILE The user is filling out their prompt DELETE the text they wrote as they go along but update the embed message they see!
        // var currentMessage
        //Add it to each part of the template as one goes along

        // Will allow users to add their own to the mastermind week's message and handle multiple people
        // Adding their own edits at the same time.

        // Post, Edit, start/create, delete

        // Variable Declarations and Initializations
        let mastermindUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<ACTION>\`: **template/t; start/create; delete; edit**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        mastermindUsageMessage = fn.getMessageEmbed(mastermindUsageMessage, "Mastermind: Help", mastermindEmbedColour);
        const mastermindHelpMessage = `Try \`${PREFIX}${commandUsed} help\`...`;
        const mastermindCommand = args[0].toLowerCase(); // Args are expected to be defined!
        if (mastermindCommand === "help") return message.channel.send(mastermindUsageMessage);

        const mastermindType = args[1] ? args[1].toLowerCase() : false;
        const authorID = message.author.id;
        const authorUsername = message.author.username;
        const guildID = message.channel.type === 'dm' ? undefined : message.guild.id;
        const isInGuild = !!guildID;
        const totalMastermindNumber = await Mastermind.find({ userID: authorID }).countDocuments();
        const mastermindActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${mastermindCommand} help\``;
        if (mastermindCommand === "start" || mastermindCommand === "create" || mastermindCommand === "s" || mastermindCommand === "set"
            || mastermindCommand === "c" || mastermindCommand === "make" || mastermindCommand === "m") {
            /**
             * 1. Check if the user has the mastermind facilitator role: prompt them to enter the name of ther person
             * they are making the entry for - if it's themselves they can type me/myself
             * -- allow them to enter the user similar to how the pester function works (maybe make it a universal function)
             * 
             * 2. Dive right into the first prompt 1. Previous Week's Assessment (Multiple line entry)
             * 1 when finished and stop to stop (OR instead of stop 🛑- react with an emoji and create a reaction collector)
             * 
             * 3. continue to the rest of the prompts. Add in the footer - you can make changes to it at the end before submitting
             * 
             * 4. Confirm that the document is good to go - give them the list of prompts they have answered from userSelectFromList()
             * -- otherwise type done to finish. (this will be its own function, with similar functionality to the userSelectFromList with text support)
             * ---- or utilise another function and if they type 
             * ---- when going back show the user the previous entry so that they have a reference (then include the current edit)
             * 
             * 5. Send confirmation reply that the entry for *username* on (now in guild local time) -- 09/21/2020 5:46:32PM -04:00/EST/PST...-- was collected!
             * IF the user is self-creating - say that "your entry was collected (time in user local time)"
             * 
             * 6. POST: Ask if they would like to post it to a specific channel.
             * Footer: if they want to post it to multiple channels they can do so as well! By ?PREFIX commandused post recent
             */


            // 1. Check if the user has the mastermind facilitator role: prompt them to enter the name of ther person
            // they are making the entry for - if it's themselves they can type me/myself
            // -- allow them to enter the user similar to how the pester function works (maybe make it a universal function)
            var targetUser;
            if (isInGuild) {
                const guildSettings = await Guild.findOne({ guildID });
                const mastermindRoles = guildSettings.mastermind.roles;
                if (mastermindRoles) {
                    const permissions = message.guild.member(authorID).roles.cache.some(role => mastermindRoles.includes(role));
                    if (permissions) {
                        let chooseUser = await fn.messageDataCollectFirst(message, "**Who are you writing the mastermind weekly reflection for?**\n(Type \`me\` or \`myself\` if it's you)",
                            "Mastermind Entry: User", mastermindEmbedColour, 60000);
                        if (!chooseUser || chooseUser === "stop") return;
                        chooseUser = chooseUser.toLowerCase();
                        if (chooseUser === "me" || chooseUser === "myself") {
                            targetUser = authorID;
                        }
                        else {
                            const guild = bot.guilds.cache.get(guildID);
                            const allMembers = guild.members.cache.map(member => member.user);
                            targetUser = fn.getIDArrayFromNames(chooseUser, allMembers, guild);
                            if (!targetUser) return message.reply(`**No users in __${guild.name}__ exist on file...**`);
                            else if (targetUser.length === 0) {
                                return message.channel.send(fn.getMessageEmbed(`Could not find user \"**${chooseUser}**\" (${mastermindActionHelpMessage})`,
                                    "Mastermind Entry: User", mastermindEmbedColour));
                            }
                            targetUser = targetUser[0];
                            if (guild.member(targetUser).user.bot) {
                                return message.channel.send(fn.getMessageEmbed(`**You __cannot__ create entries for 🤖 bots (non-users): <@!${targetUser}>**`,
                                    "Mastermind Entry: User", mastermindEmbedColour));
                            }
                        }
                    }
                }
            }
            if (!targetUser) targetUser = authorID;
            console.log({ targetUser });

            // 1.5. Check if the user wants to use the template or not
            const thumbsUp = '👍';
            const thumbsDown = '👎';
            let userWantsTemplate = await fn.reactionDataCollect(message, `**Would you like to use a mastermind reflection __template__  ${thumbsUp} or __not__ ${thumbsDown}?**`,
                [thumbsUp, thumbsDown], "Mastermind Entry: Template?", mastermindEmbedColour);
            switch (userWantsTemplate) {
                case thumbsUp: userWantsTemplate = true;
                    break;
                case thumbsDown: userWantsTemplate = false;
                    break;
                default: userWantsTemplate = null;
                    break;
            }

            // 2. Create a function for the data collection loop function.
            var mastermindDocument;
            const targetUserSettings = await User.findOne({ discordID: targetUser });
            const targetUserTimezoneOffset = targetUserSettings.timezone.offset;
            const targetUserTimezone = targetUserSettings.timezone.name;
            if (userWantsTemplate) {
                const observations = await getMultilineEntry(message, "**__Look back at the previous week ↩:__**"
                    + "\n**- 📈 How much did you stick to your habits and/or progress on your goals this week?\n- 💭 Make 3 observations.**",
                    "Mastermind Entry: Observations", true, mastermindEmbedColour);
                console.log({ observations });
                if (!observations && observations !== '') return;

                var areasOfLifeList = "";
                areasOfLife.forEach((areaOfLife, i) => {
                    if (i === areasOfLife.length - 1) {
                        areasOfLifeList += `\`${i + 1}\` - **${areasOfLifeEmojis[i]} ${areaOfLife}**`;
                    }
                    else areasOfLifeList += `\`${i + 1}\` - **${areasOfLifeEmojis[i]} ${areaOfLife}**\n`;
                });

                const areaOfLifeIndex = await fn.userSelectFromList(message, areasOfLifeList, areasOfLife.length, "**__Which Area of Life Needs the Most Attention This Week? 🌱__**",
                    "Mastermind Entry: Area of Life Assessment", mastermindEmbedColour);
                console.log({ areaOfLifeIndex });
                if (!areaOfLifeIndex && areaOfLifeIndex !== 0) return;

                const areaOfLifeReason = await getSingleEntry(message, `**Why does ${areasOfLifeEmojis[areaOfLifeIndex]} __${areasOfLife[areaOfLifeIndex]}__ need the most attention this week?**`,
                    "Mastermind Entry: Area of Life Assessment", forceSkip, mastermindEmbedColour);
                console.log({ areaOfLifeReason });
                if (!areaOfLifeReason && areaOfLifeReason !== '') return;

                const stopEntry = await getSingleEntry(message, "**What do you want to __stop__ doing this week?**",
                    "Mastermind Entry: Stop", forceSkip, mastermindEmbedColour);
                console.log({ stopEntry });
                if (!stopEntry && stopEntry !== '') return;

                const startEntry = await getSingleEntry(message, "**What do you want to __start__ doing this week?**",
                    "Mastermind Entry: Start", forceSkip, mastermindEmbedColour);
                console.log({ startEntry });
                if (!startEntry && startEntry !== '') return;

                const continueEntry = await getSingleEntry(message, "**What went well this past week that you want to __continue__ doing for this week?**",
                    "Mastermind Entry: Continue", forceSkip, mastermindEmbedColour);
                console.log({ continueEntry });
                if (!continueEntry && continueEntry !== '') return;

                let goalCount = 1;
                var weeklyGoals = new Array();
                do {
                    const completionInstructions = `${goalCount !== 1 ? goalCount === 2 ?
                        `Type \`set\` to **submit** all goals entered so far (**Goal ${goalCount - 1}**)`
                        : `Type \`set\` to **submit** all goals entered so far (**Goals 1-${goalCount - 1}**)`
                        : `Type \`set\` to **skip** entering any goals`}\nType \`reset\` to **reset** all of your current **weekly goals**`;
                    const completionKeywords = ["set", "reset"];
                    const weeklyGoalDescription = await getSingleEntry(message, `**🎯 What is __Goal #${goalCount}__ of this week's goals?**`,
                        `Mastermind Entry: Weekly Goal ${goalCount}`, forceSkip, mastermindEmbedColour, completionInstructions, completionKeywords);
                    if (!weeklyGoalDescription && weeklyGoalDescription !== "" || weeklyGoalDescription === "set") break;
                    else if (weeklyGoalDescription === "reset") {
                        goalCount = 1;
                        weeklyGoals = new Array();
                        continue;
                    }
                    const goalDescriptionString = `__**Goal #${goalCount}:**__${weeklyGoalDescription === "" ? "" : `\n${weeklyGoalDescription}`}`;

                    const weeklyGoalType = await fn.userSelectFromList(message, `${areasOfLifeList}\n\n${goalDescriptionString}`, areasOfLife.length,
                        `**__Which Area of Life does Goal #${goalCount} fall under?__**`,
                        `Mastermind Entry: Weekly Goal ${goalCount}`, mastermindEmbedColour);
                    if (!weeklyGoalType && weeklyGoalType !== 0) break;
                    const goalTypeString = `__**Type:**__ ${areasOfLifeEmojis[weeklyGoalType]} ${areasOfLife[weeklyGoalType]}`;

                    const weeklyGoalReason = await getSingleEntry(message, `${goalTypeString}\n${goalDescriptionString}\n\n**__💭 Why do you want to accomplish this goal?__**`,
                        `Mastermind Entry: Weekly Goal ${goalCount}`, forceSkip, mastermindEmbedColour, completionInstructions, completionKeywords);
                    if (!weeklyGoalReason && weeklyGoalReason !== "" || weeklyGoalReason === "set") break;
                    else if (weeklyGoalReason === "reset") {
                        goalCount = 1;
                        weeklyGoals = new Array();
                        continue;
                    }

                    weeklyGoals.push({
                        type: weeklyGoalType,
                        description: weeklyGoalDescription,
                        reason: weeklyGoalReason,
                    });
                    goalCount++;
                }
                while (true)
                console.log({ weeklyGoals });

                mastermindDocument = new Mastermind({
                    _id: mongoose.Types.ObjectId(),
                    userID: targetUser,
                    createdAt: Date.now() + HOUR_IN_MS * targetUserTimezoneOffset,
                    createdBy: authorID,
                    usedTemplate: userWantsTemplate,
                    guildID,
                    journal: {
                        observations,
                        areaOfLife: {
                            type: areaOfLifeIndex,
                            reason: areaOfLifeReason,
                        },
                        stopEntry,
                        startEntry,
                        continueEntry,
                        goals: weeklyGoals,
                    }
                });
            }
            else if (userWantsTemplate === false) {
                const entry = await getMultilineEntry(message, "**Enter your mastermind entry:**",
                    "Mastermind Entry: No Template", forceSkip, mastermindEmbedColour);
                if (entry) {
                    mastermindDocument = new Mastermind({
                        _id: mongoose.Types.ObjectId(),
                        userID: targetUser,
                        createdAt: Date.now() + HOUR_IN_MS * targetUserTimezoneOffset,
                        createdBy: authorID,
                        usedTemplate: userWantsTemplate,
                        guildID,
                        journal: { entry },
                    });
                }
                else return;
            }
            else return;

            if (mastermindDocument) {
                if (mastermindDocument.userID === mastermindDocument.createdBy) {
                    message.channel.send(fn.getMessageEmbed(`Your mastermind entry was **successfully logged!** (${fn.timestampToDateString(mastermindDocument.createdAt)} ${targetUserTimezone})`,
                        "Mastermind Entry", mastermindEmbedColour));
                }
                else {
                    message.channel.send(fn.getMessageEmbed(`<@!${targetUser}>'s mastermind entry was **successfully logged!** (${fn.timestampToDateString(mastermindDocument.createdAt)} ${targetUserTimezone})`
                        + `\n\n__**Creator:**__ <@!${authorID}>`, "Mastermind Entry", mastermindEmbedColour));
                }
                await mastermindDocument.save()
                    .then(result => console.log({ result }))
                    .catch(err => console.error(err));
            }

            // 6. Post
            const postConfirmation = await fn.getUserConfirmation(message, `**Would you like to __post__ your mastermind entry to a __server's channel?__**`,
                false, "Mastermind: Post", 180000);
            if (!postConfirmation) return;
            const targetChannel = await fn.getPostChannel(bot, message, "Mastermind", forceSkip, mastermindEmbedColour);
            if (!targetChannel) return;
            const member = bot.guilds.cache.get(guildID).member(authorID);
            const post = fn.getMessageEmbed(mastermindDocumentToString(bot, mastermindDocument), `${member ? `${member.displayName}'s ` : ""}Mastermind Reflection`
                + ` - ${fn.timestampToDateString(mastermindDocument.createdAt)} ${targetUserTimezone}`, mastermindEmbedColour);
            await fn.sendMessageToChannel(bot, post, targetChannel);
        }


        else if (mastermindCommand === "delete" || mastermindCommand === "remove" || mastermindCommand === "del" || mastermindCommand === "d"
            || mastermindCommand === "rem" || mastermindCommand === "r") {
            /**
             * 1. Format - delete 1/55/recent <recent>, delete many 1,2,3,recent <recent>, delete past #, delete # past #,
             * Similar to reminders/fasts
             */
            let mastermindDeleteUsageMessage = fn.getReadOrDeleteUsageMessage(PREFIX, commandUsed, mastermindCommand, true, ["Entry", "Entries"]);
            mastermindDeleteUsageMessage = fn.getMessageEmbed(mastermindDeleteUsageMessage, "Mastermind: Delete Help", mastermindEmbedColour);
            const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see help\``;

            if (mastermindType) {
                if (mastermindType === "help") {
                    return message.channel.send(mastermindDeleteUsageMessage);
                }
                if (!totalMastermindNumber) {
                    return message.reply(`**NO ENTRIES**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
            }
            else return message.reply(mastermindActionHelpMessage);

            // delete past #:
            if (args[2] !== undefined) {
                const deleteType = mastermindType;
                if (deleteType === "past") {
                    // If the following argument is not a number, exit!
                    if (isNaN(args[2])) {
                        return fn.sendErrorMessageAndUsage(message, mastermindActionHelpMessage);
                    }
                    var numberArg = parseInt(args[2]);
                    if (numberArg <= 0) {
                        return fn.sendErrorMessageAndUsage(message, mastermindActionHelpMessage);
                    }
                    let indexByRecency = false;
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    var mastermindCollection;
                    if (indexByRecency) mastermindCollection = await fn.getEntriesByRecency(Mastermind, { userID: authorID }, 0, numberArg);
                    else mastermindCollection = await getMastermindByCreatedAt(authorID, 0, numberArg);
                    const mastermindStringArray = fn.getEmbedArray(multipleMastermindsToString(bot, message, mastermindCollection, numberArg, 0, true),
                        '', true, false, mastermindEmbedColour);
                    const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} entries?**`;
                    const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(message, mastermindStringArray, multipleDeleteMessage, forceSkip,
                        `Mastermind: Delete Past ${numberArg} Entries (${sortType})`, 600000);
                    if (!multipleDeleteConfirmation) return;
                    const targetIDs = await mastermindCollection.map(entry => entry._id);
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Entries (${sortType})`);
                    await Mastermind.deleteMany({ _id: { $in: targetIDs } });
                    return;
                }
                if (deleteType === "many") {
                    if (args[2] === undefined) {
                        return message.reply(mastermindActionHelpMessage);
                    }
                    // Get the arguments after keyword MANY
                    // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
                    // Convert String of Numbers array into Integer array
                    // Check which masterminds exist, remove/don't add those that don't
                    let toDelete = args[2].split(',').filter(index => {
                        if (!isNaN(index)) {
                            numberIndex = parseInt(index);
                            if (numberIndex > 0 && numberIndex <= totalMastermindNumber) {
                                return numberIndex;
                            }
                        }
                        else if (index === "recent") {
                            return true;
                        }
                    });
                    const recentIndex = await getRecentMastermindIndex(authorID);
                    toDelete = Array.from(new Set(toDelete.map((number) => {
                        if (number === "recent") {
                            if (recentIndex !== -1) return recentIndex;
                        }
                        else return +number;
                    })));
                    console.log({ toDelete });
                    // Send error message if none of the given reminders exist
                    if (!toDelete.length) {
                        return fn.sendErrorMessage(message, "All of these **masterminds DO NOT exist**...");
                    }
                    var indexByRecency = false;
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var mastermindTargetIDs = new Array();
                    var mastermindStringArray = new Array();
                    for (i = 0; i < toDelete.length; i++) {
                        var mastermindView;
                        if (indexByRecency) {
                            mastermindView = await getOneMastermindByRecency(authorID, toDelete[i] - 1);
                        }
                        else {
                            mastermindView = await getOneMastermindByCreatedTime(authorID, toDelete[i] - 1);
                        }
                        mastermindTargetIDs.push(mastermindView._id);
                        mastermindStringArray.push(`__**Mastermind ${toDelete[i]}:**__\n${mastermindDocumentToString(bot, mastermindView)}`);
                    }
                    const deleteConfirmMessage = `Are you sure you want to **delete entries ${toDelete.toString()}?**`;
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    mastermindStringArray = fn.getEmbedArray(mastermindStringArray, '', true, false, mastermindEmbedColour);
                    const confirmDeleteMany = await fn.getPaginatedUserConfirmation(message, mastermindStringArray, deleteConfirmMessage,
                        forceSkip, `Mastermind: Delete Entries ${toDelete} (${sortType})`, 600000);
                    if (confirmDeleteMany) {
                        console.log(`Deleting ${authorID}'s Entries ${toDelete} (${sortType})`);
                        await Mastermind.deleteMany({ _id: { $in: mastermindTargetIDs } });
                        return;
                    }
                    else return;
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
                    console.log({ shiftIndex });
                    if (args[2 + shiftIndex]) {
                        if (args[2 + shiftIndex].toLowerCase() === "past") {
                            var skipEntries;
                            if (isNaN(args[3 + shiftIndex])) {
                                if (args[3 + shiftIndex].toLowerCase() === "recent") {
                                    skipEntries = await getRecentMastermindIndex(authorID);
                                }
                                else return message.reply(mastermindActionHelpMessage);
                            }
                            else skipEntries = parseInt(args[3 + shiftIndex]);
                            const pastNumberOfEntries = parseInt(args[1]);
                            if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                                return fn.sendErrorMessageAndUsage(message, mastermindActionHelpMessage);
                            }
                            var mastermindCollection;
                            if (indexByRecency) mastermindCollection = await fn.getEntriesByRecency(Mastermind, { userID: authorID }, skipEntries, pastNumberOfEntries);
                            else mastermindCollection = await getMastermindByCreatedAt(authorID, skipEntries, pastNumberOfEntries);
                            const mastermindStringArray = fn.getEmbedArray(multipleMastermindsToString(bot, message, mastermindCollection, pastNumberOfEntries, skipEntries, true),
                                '', true, false, mastermindEmbedColour);
                            if (skipEntries >= totalMastermindNumber) return;
                            const sortType = indexByRecency ? "By Recency" : "By Date Created";
                            const multipleDeleteMessage = `Are you sure you want to **delete ${mastermindCollection.length} entries past entry ${skipEntries}?**`;
                            const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(message, mastermindStringArray, multipleDeleteMessage,
                                forceSkip, `Mastermind: Multiple Delete Warning! (${sortType})`);
                            console.log({ multipleDeleteConfirmation });
                            if (!multipleDeleteConfirmation) return;
                            console.log({ multipleDeleteConfirmation });
                            const targetIDs = await mastermindCollection.map(entry => entry._id);
                            console.log(`Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} entries past ${skipEntries} (${sortType})`);
                            await Mastermind.deleteMany({ _id: { $in: targetIDs } });
                            return;
                        }

                        // They haven't specified the field for the mastermind delete past function
                        else if (deleteType === "past") return message.reply(mastermindActionHelpMessage);
                        else return message.reply(mastermindActionHelpMessage);
                    }
                }
            }
            // Next: MASTERMIND DELETE ALL
            // Next: MASTERMIND DELETE MANY
            // Next: MASTERMIND DELETE

            // mastermind delete <NUMBER/RECENT/ALL>
            const noMastermindsMessage = `**NO MASTERMINDS**... try \`${PREFIX}${commandUsed} start help\``;
            if (isNaN(args[1])) {
                const deleteType = mastermindType;
                if (deleteType === "recent") {
                    const mastermindView = await getOneMastermindByRecency(authorID, 0, false);
                    if (mastermindView.length === 0) {
                        return fn.sendErrorMessage(message, noMastermindsMessage);
                    }
                    const mastermindTargetID = mastermindView._id;
                    console.log({ mastermindTargetID });
                    const mastermindIndex = await getRecentMastermindIndex(authorID);
                    const deleteConfirmMessage = `Are you sure you want to **delete your most recent entry?:**\n\n__**Mastermind ${mastermindIndex}:**__\n${mastermindDocumentToString(bot, mastermindView)}`;
                    const deleteIsConfirmed = await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Mastermind: Delete Recent Entry`, 300000)
                    if (deleteIsConfirmed) {
                        await Mastermind.deleteOne({ _id: mastermindTargetID });
                        return;
                    }
                }
                else if (deleteType === "all") {
                    const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded masterminds?\n\nYou **cannot UNDO** this!" +
                        `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    const pastNumberOfEntriesIndex = totalMastermindNumber;
                    if (pastNumberOfEntriesIndex === 0) {
                        return fn.sendErrorMessage(message, noMastermindsMessage);
                    }
                    let confirmDeleteAll = await fn.getUserConfirmation(message, confirmDeleteAllMessage, forceSkip, "Mastermind: Delete All Entries WARNING!");
                    if (!confirmDeleteAll) return;
                    const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR MASTERMINDS ON RECORD**?\n\nYou **cannot UNDO** this!"
                        + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    let finalConfirmDeleteAll = await fn.getUserConfirmation(message, finalDeleteAllMessage, "Mastermind: Delete ALL Entries FINAL Warning!");
                    if (!finalConfirmDeleteAll) return;
                    console.log(`Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Entries`);
                    await Mastermind.deleteMany({ userID: authorID });
                    return;
                }
                else return message.reply(mastermindActionHelpMessage);
            }
            else {
                const pastNumberOfEntriesIndex = parseInt(args[1]);
                let indexByRecency = false;
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var mastermindView;
                if (indexByRecency) mastermindView = await getOneMastermindByRecency(authorID, pastNumberOfEntriesIndex - 1);
                else mastermindView = await getOneMastermindByCreatedTime(authorID, pastNumberOfEntriesIndex - 1);
                if (!mastermindView) {
                    return fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, "**MASTERMIND DOES NOT EXIST**...");
                }
                const mastermindTargetID = mastermindView._id;
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const deleteConfirmMessage = `Are you sure you want to **delete Entry ${pastNumberOfEntriesIndex}?:**\n\n__**Mastermind ${pastNumberOfEntriesIndex}:**__\n` +
                    mastermindDocumentToString(bot, mastermindView);
                const deleteConfirmation = await fn.getUserConfirmation(message, deleteConfirmMessage, forceSkip, `Mastermind: Delete Entry ${pastNumberOfEntriesIndex} (${sortType})`, 300000);
                if (deleteConfirmation) {
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Entry ${sortType}`);
                    await Mastermind.deleteOne({ _id: mastermindTargetID });
                    return;
                }
            }
        }



        else if (mastermindCommand === "see" || mastermindCommand === "show") {
            let mastermindSeeUsageMessage = fn.getReadOrDeleteUsageMessage(PREFIX, commandUsed, mastermindCommand, true, ["Entry", "Entries"]);
            mastermindSeeUsageMessage = fn.getMessageEmbed(mastermindSeeUsageMessage, "Mastermind: See Help", mastermindEmbedColour);

            const seeCommands = ["past", "recent", "all"];

            if (mastermindType) {
                if (mastermindType === "help") {
                    return message.channel.send(mastermindSeeUsageMessage);
                }
                if (!totalMastermindNumber) {
                    return message.reply(`**NO MASTERMINDS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
                else if (mastermindType === "number") {
                    return message.reply(`You have **${totalMastermindNumber} mastermind entries** on record.`);
                }
            }
            else return message.reply(mastermindActionHelpMessage);

            // Show the user the last mastermind with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(mastermindType) && isNaN(mastermindType)) {
                return message.reply(mastermindActionHelpMessage);
            }
            // Do not show the most recent mastermind embed, when a valid command is called
            // it will be handled properly later based on the values passed in!
            else {
                const seeType = mastermindType;
                var pastFunctionality,
                    pastNumberOfEntriesIndex;
                let indexByRecency = false;
                // To check if the given argument is a number!
                // If it's not a number and has passed the initial 
                // filter, then use the "past" functionality
                // Handling Argument 1:
                const isNumberArg = !isNaN(args[1]);
                if (seeType === "recent") {
                    return message.channel.send(await getMostRecentMastermind(bot, authorID, mastermindEmbedColour));
                }
                else if (seeType === "all") {
                    pastNumberOfEntriesIndex = totalMastermindNumber;
                    pastFunctionality = true;
                }
                else if (isNumberArg) {
                    pastNumberOfEntriesIndex = parseInt(args[1]);
                    if (pastNumberOfEntriesIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, mastermindActionHelpMessage, "**MASTERMIND DOES NOT EXIST**...");
                    }
                    else pastFunctionality = false;
                }
                else if (seeType === "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else return message.reply(mastermindActionHelpMessage);
                console.log({ pastNumberOfEntriesIndex, pastFunctionality });
                if (pastFunctionality) {
                    // Loop through all of the given fields, account for aliases and update fields
                    // Find Entries, toArray, store data in meaningful output
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    if (args[2] !== undefined) {
                        // If the next argument is NotaNumber, invalid "past" command call
                        if (isNaN(args[2])) return message.reply(mastermindActionHelpMessage);
                        if (parseInt(args[2]) <= 0) return message.reply(mastermindActionHelpMessage);
                        const confirmSeeMessage = `Are you sure you want to **see ${args[1]} masterminds?**`;
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeMessage, forceSkip, `Mastermind: See ${args[1]} Entries (${sortType})`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (seeType !== "all") return message.reply(mastermindActionHelpMessage);
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your mastermind history?";
                        let confirmSeeAll = await fn.getUserConfirmation(message, confirmSeeAllMessage, forceSkip, "Mastermind: See All Entries");
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                    if (pastNumberOfEntriesIndex === undefined) {
                        pastNumberOfEntriesIndex = parseInt(args[2]);
                    }
                    var mastermindView;
                    if (indexByRecency) mastermindView = await fn.getEntriesByRecency(Mastermind, { userID: authorID }, 0, pastNumberOfEntriesIndex);
                    else mastermindView = await getMastermindByCreatedAt(authorID, 0, pastNumberOfEntriesIndex);
                    console.log({ mastermindView, pastNumberOfEntriesIndex });
                    const mastermindStringArray = multipleMastermindsToString(bot, message, mastermindView, pastNumberOfEntriesIndex, 0, true);
                    await fn.sendPaginationEmbed(message, fn.getEmbedArray(mastermindStringArray, `Mastermind: See ${pastNumberOfEntriesIndex} Entries (${sortType})`, true, true, mastermindEmbedColour));
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
                    if (args[2 + shiftIndex]) {
                        if (args[2 + shiftIndex].toLowerCase() === "past") {
                            if (args[3 + shiftIndex] !== undefined) {
                                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                                var entriesToSkip;
                                // If the argument after past is a number, valid command call!
                                if (!isNaN(args[3 + shiftIndex])) {
                                    entriesToSkip = parseInt(args[3 + shiftIndex]);
                                }
                                else if (args[3 + shiftIndex].toLowerCase() === "recent") {
                                    entriesToSkip = await getRecentMastermindIndex(authorID);
                                }
                                else return message.reply(mastermindActionHelpMessage);
                                if (entriesToSkip < 0 || entriesToSkip > totalMastermindNumber) {
                                    return fn.sendErrorMessageAndUsage(message, mastermindActionHelpMessage, "**MASTERMIND(S) DO NOT EXIST**...");
                                }
                                const confirmSeePastMessage = `Are you sure you want to **see ${args[1]} entries past ${entriesToSkip}?**`;
                                const confirmSeePast = await fn.getUserConfirmation(message, confirmSeePastMessage, forceSkip, `Mastermind: See ${args[1]} Entries Past ${entriesToSkip} (${sortType})`);
                                if (!confirmSeePast) return;
                                var mastermindView;
                                if (indexByRecency) mastermindView = await fn.getEntriesByRecency(Mastermind, { userID: authorID }, entriesToSkip, pastNumberOfEntriesIndex);
                                else mastermindView = await getMastermindByCreatedAt(authorID, entriesToSkip, pastNumberOfEntriesIndex);
                                console.log({ mastermindView });
                                const mastermindStringArray = multipleMastermindsToString(bot, message, mastermindView, pastNumberOfEntriesIndex, entriesToSkip, true);
                                await fn.sendPaginationEmbed(message, fn.getEmbedArray(mastermindStringArray, `Mastermind: See ${pastNumberOfEntriesIndex} Entries Past ${entriesToSkip} (${sortType})`, true, true, mastermindEmbedColour));
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
                var mastermindView;
                if (indexByRecency) mastermindView = await getOneMastermindByRecency(authorID, pastNumberOfEntriesIndex - 1);
                else mastermindView = await getOneMastermindByCreatedTime(authorID, pastNumberOfEntriesIndex - 1);
                console.log({ mastermindView });
                if (!mastermindView) {
                    return fn.sendErrorMessage(message, `**MASTERMIND ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                }
                // NOT using the past functionality:
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const mastermindString = `__**Mastermind ${pastNumberOfEntriesIndex}:**__\n${mastermindDocumentToString(bot, mastermindView)}`;
                const mastermindEmbed = fn.getMessageEmbed(mastermindString, `Mastermind: See Entry ${pastNumberOfEntriesIndex} (${sortType})`, mastermindEmbedColour);
                message.channel.send(mastermindEmbed);
            }
        }


        else if (mastermindCommand === "edit" || mastermindCommand === "change" || mastermindCommand === "ed" || mastermindCommand === "e"
            || mastermindCommand === "ch" || mastermindCommand === "c") {
            let reminderEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${reminderCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\``
                + "\n\n`<#_MOST_RECENT_ENTRY>`: **recent; 3** (3rd most recent entry, \\**any number*)"
                + "\n\n`<recent?>`(OPT.): type **recent** at the indicated spot to sort the reminders by **time created instead of reminder start time!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            reminderEditUsageMessage = fn.getMessageEmbed(reminderEditUsageMessage, `Reminder: Edit Help`, reminderEmbedColour);
            if (reminderIndex) {
                if (reminderIndex === "help") {
                    return message.channel.send(reminderDeleteUsageMessage);
                }
                if (!totalReminderNumber) {
                    return message.reply(`**NO REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }

                if (isNaN(reminderIndex) && reminderIndex !== "recent") {
                    return message.reply(reminderActionHelpMessage);
                }
                else {
                    var reminderFields = ["Type", "Send to (DM or Channel)", "Start Time", "End Time", "Message", "Repeat", "Interval"];
                    let fieldsList = "";
                    reminderFields.forEach((field, i) => {
                        fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
                    });
                    if (reminderIndex === "recent") {
                        pastNumberOfEntriesIndex = await rm.getRecentReminderIndex(authorID, false);
                    }
                    else {
                        pastNumberOfEntriesIndex = parseInt(reminderIndex);
                        if (pastNumberOfEntriesIndex <= 0) {
                            return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage, "**REMINDER DOES NOT EXIST**...");
                        }
                    }

                    var indexByRecency = false;
                    if (args[2] !== undefined) {
                        if (args[2].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var reminderView;
                    if (indexByRecency) reminderView = await rm.getOneReminderByRecency(authorID, pastNumberOfEntriesIndex - 1, false);
                    else reminderView = await rm.getOneReminderByEndTime(authorID, pastNumberOfEntriesIndex - 1, false);
                    if (!reminderView) {
                        return fn.sendErrorMessageAndUsage(message, reminderActionHelpMessage, `**REMINDER ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                    }
                    const sortType = indexByRecency ? "By Recency" : "By End Time";
                    const reminderTargetID = reminderView._id;
                    var reminderData, showReminder, continueEdit;
                    do {
                        const checkFast = await rm.getOneReminderByObjectID(reminderTargetID);
                        if (!checkFast) return;
                        continueEdit = false;
                        reminderData = rm.reminderDocumentToDataArray(reminderView);
                        showReminder = rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                        // Field the user wants to edit
                        const fieldToEditInstructions = "**Which field do you want to edit?:**";
                        const fieldToEditAdditionalMessage = `__**Reminder ${pastNumberOfEntriesIndex} (${sortType}):**__\n${showReminder}`;
                        const fieldToEditTitle = `Reminder: Edit Field`;
                        let fieldToEditIndex = await fn.userSelectFromList(message, fieldsList, reminderFields.length, fieldToEditInstructions,
                            fieldToEditTitle, reminderEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                        if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                        var userEdit, reminderEditMessagePrompt = "";
                        const fieldToEdit = reminderFields[fieldToEditIndex];
                        const type = "Reminder";
                        switch (fieldToEditIndex) {
                            case 0:
                                reminderEditMessagePrompt = `Please enter one of the following reminder types: **__${validTypes.join(', ')}__**`;
                                userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 1:
                                reminderEditMessagePrompt = `Please enter the **channel you'd like to send the reminder to OR "DM"** if you want to get it through a Direct Message:`;
                                userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 2:
                                reminderEditMessagePrompt = dateAndTimeInstructions;
                                userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 3:
                                reminderEditMessagePrompt = dateAndTimeInstructions;
                                userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            // Reminder does not need a prompt explanation
                            case 4:
                                userEdit = await fn.getUserMultilineEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                break;
                            case 5:
                                reminderEditMessagePrompt = `Would you like to make this a **__repeating (⌚)__ OR __one-time (1️⃣)__ reminder?**`;
                                userEdit = await fn.getUserEditBoolean(message, fieldToEdit, reminderEditMessagePrompt,
                                    ['⌚', '1️⃣'], type, forceSkip, reminderEmbedColour);
                                break;
                            case 6:
                                if (reminderData[1] === true) {
                                    reminderEditMessagePrompt = `**Please enter the time you'd like in-between recurring reminders (interval):**`;
                                    userEdit = await fn.getUserEditString(message, fieldToEdit, reminderEditMessagePrompt, type, forceSkip, reminderEmbedColour);
                                }
                                else userEdit = 0;
                                break;
                        }
                        console.log({ userEdit });
                        if (userEdit === false) return;
                        else if (userEdit === undefined) userEdit = "back";
                        else if (userEdit !== "back") {
                            // Parse User Edit
                            if (fieldToEditIndex === 2 || fieldToEditIndex === 3) {
                                const timestamp = Date.now();
                                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                console.log({ userEdit });
                                reminderData[fieldToEditIndex + 3] = fn.timeCommandHandlerToUTC(userEdit, timestamp, timezoneOffset, daylightSavingsSetting);
                                if (!reminderData[fieldToEditIndex + 3]) {
                                    fn.sendReplyThenDelete(message, `**INVALID TIME**... ${reminderHelpMessage}`, 60000);
                                    continueEdit = true;
                                }
                                if (continueEdit === false) {
                                    reminderData[fieldToEditIndex + 3] -= HOUR_IN_MS * timezoneOffset;
                                    const validReminderDuration = fn.endTimeAfterStartTime(message, reminderData[5], reminderData[6], type);
                                    console.log({ validReminderDuration });
                                    if (!validReminderDuration) {
                                        continueEdit = true;
                                    }
                                    console.log({ reminderData });
                                }
                            }
                            else {
                                switch (fieldToEditIndex) {
                                    case 0:
                                        {
                                            let userType = fn.toTitleCase(userEdit)
                                            if (validTypes.includes(userType)) {
                                                let removeConnectedDocsConf = await fn.getUserConfirmation(message,
                                                    `Are you sure you want to change the reminder type to **"${userType}"**`
                                                    + `\n\n*(This reminder will **lose** it's **connected document**, if any)*`,
                                                    forceSkip, "Reminder: Change Type Confirmation", 90000);
                                                if (removeConnectedDocsConf) {
                                                    reminderData[8] = userType;
                                                    reminderData[2] = undefined;
                                                }
                                            }
                                            else continueEdit = true;
                                            break;
                                        }
                                    case 1:
                                        {
                                            let userArgs = userEdit.split(/[\s\n]+/).join(' ');
                                            let channel = /((?:[Dd][Mm])|(?:\<\#\d+\>))/.exec(userArgs);
                                            if (channel) {
                                                if (/[Dd][Mm]/.test(channel[1])) {
                                                    reminderData[0] = true;
                                                    reminderData[4] = authorID;
                                                    reminderData[10] = undefined;
                                                }
                                                else {
                                                    let channelID = /\<\#(\d+)\>/.exec(channel);
                                                    channelID = channelID[1];
                                                    const userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                                                    console.log({ userPermissions });
                                                    if (userPermissions.has("SEND_MESSAGES") && userPermissions.has("VIEW_CHANNEL")) {
                                                        reminderData[0] = false;
                                                        reminderData[4] = channelID;
                                                        reminderData[10] = bot.channels.cache.get(channelID).guild.id;
                                                    }
                                                    else {
                                                        continueEdit = true;
                                                        message.reply(`You are **not authorized to send messages** to that channel...`);
                                                    }
                                                }
                                            }
                                        }
                                        break;
                                    case 4: reminderData[7] = userEdit;
                                        break;
                                    case 5:
                                        {
                                            switch (userEdit) {
                                                case '⌚': userEdit = true;
                                                    break;
                                                case '1️⃣': userEdit = false;
                                                    break;
                                                default: null;
                                                    break;
                                            }
                                            if (typeof userEdit === "boolean") {
                                                // From One-Time to Repeating
                                                if (userEdit === true && reminderData[1] === false) {
                                                    reminderData[1] = userEdit;
                                                    let userInterval = await fn.getUserEditString(message, reminderFields[6],
                                                        `**Please enter the time you'd like in-between recurring reminders (interval):**`,
                                                        type, forceSkip, reminderEmbedColour);
                                                    if (!userInterval) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    let currentTimestamp = Date.now();
                                                    let timeArgs = userInterval.toLowerCase().split(' ');
                                                    let interval = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs,
                                                        currentTimestamp, timezoneOffset, daylightSavingsSetting);
                                                    if (!interval) {
                                                        continueEdit = true;
                                                        message.reply(`**INVALID Interval**... ${reminderHelpMessage} for **valid time inputs!**`);
                                                        break;
                                                    }
                                                    interval -= HOUR_IN_MS * timezoneOffset + currentTimestamp;
                                                    if (interval <= 0) {
                                                        continueEdit = true;
                                                        message.reply(`**INVALID Interval**... ${reminderHelpMessage} for **valid time inputs!**`);
                                                        break;
                                                    }
                                                    else if (interval < 60000) {
                                                        continueEdit = true;
                                                        message.reply(`**INVALID Interval**... Interval MUST be **__> 1m__**`);
                                                        break;
                                                    }
                                                    reminderData[9] = interval;
                                                    // GET THE INTENDED END TIME!
                                                    let duration = await rm.getUserFirstRecurringEndDuration(message, reminderHelpMessage, timezoneOffset, daylightSavingsSetting, true);
                                                    console.log({ duration })
                                                    if (!duration && duration !== 0) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    duration = duration > 0 ? duration : 0;
                                                    let channel = reminderData[0] ? "DM" : bot.channels.cache.get(reminderData[4]);
                                                    let confirmCreationMessage = `Are you sure you want to set the following **recurring reminder** to send -\n**in ${channel.name} after ${fn.millisecondsToTimeString(duration)}**`
                                                        + ` (and repeat every **${fn.millisecondsToTimeString(interval)}**):\n\n${reminderData[7]}`;
                                                    let confirmCreation = await fn.getUserConfirmation(message, confirmCreationMessage, forceSkip, "Recurring Reminder: Confirm Creation", 180000);
                                                    if (!confirmCreation) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    else {
                                                        currentTimestamp = Date.now();
                                                        reminderData[6] = currentTimestamp + duration;
                                                        console.log({ currentTimestamp });
                                                        let channelID = channel.id;
                                                        let userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                                                        console.log({ userPermissions });
                                                        if (!userPermissions.has("SEND_MESSAGES") || !userPermissions.has("VIEW_CHANNEL")) {
                                                            message.reply(`You are **not authorized to send messages** to that channel...`);
                                                        }
                                                        message.reply(`Your **recurring reminder** has been set to trigger in **${fn.millisecondsToTimeString(duration)}!**`);
                                                    }
                                                }
                                                // From Repeating to One-Time
                                                else if (userEdit === false && reminderData[1] === true) {
                                                    reminderData[1] = userEdit;
                                                    // GET THE INTENDED END TIME! (For non-recurring)
                                                    let duration = await rm.getUserFirstRecurringEndDuration(message, reminderHelpMessage, timezoneOffset, daylightSavingsSetting, false);
                                                    console.log({ duration })
                                                    if (!duration && duration !== 0) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    duration = duration > 0 ? duration : 0;
                                                    let channel = reminderData[0] ? "DM" : bot.channels.cache.get(reminderData[4]).name;
                                                    let confirmCreationMessage = `Are you sure you want to set the following **one-time reminder** to send -\n**in ${channel} after ${fn.millisecondsToTimeString(duration)}**`
                                                        + `\n\n${reminderData[7]}`;
                                                    let confirmCreation = await fn.getUserConfirmation(message, confirmCreationMessage, forceSkip, "Reminder: Confirm Creation", 180000);
                                                    if (!confirmCreation) {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    else {
                                                        currentTimestamp = Date.now();
                                                        console.log({ currentTimestamp });
                                                        reminderData[6] = currentTimestamp + duration;
                                                        if (reminderData[0] === false) {
                                                            let channelID = channel.id;
                                                            let userPermissions = bot.channels.cache.get(channelID).permissionsFor(authorID);
                                                            console.log({ userPermissions });
                                                            if (!userPermissions.has("SEND_MESSAGES") || !userPermissions.has("VIEW_CHANNEL")) {
                                                                message.reply(`You are **not authorized to send messages** to that channel...`);
                                                                continueEdit = true;
                                                                break;
                                                            }
                                                            message.reply(`Your **one-time reminder** has been set to trigger in **${fn.millisecondsToTimeString(duration)}!**`);
                                                        }
                                                    }
                                                }
                                                else {
                                                    continueEdit = true;
                                                    break;
                                                }

                                            }
                                            else {
                                                continueEdit = true;
                                                break;
                                            }
                                        }
                                        break;
                                    case 6:
                                        {
                                            // Ensure that the reminder isRecurring
                                            if (reminderData[1] === true) {
                                                let currentTimestamp = Date.now();
                                                let timeArgs = userEdit.toLowerCase().split(' ');
                                                let interval = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs,
                                                    currentTimestamp, timezoneOffset, daylightSavingsSetting);
                                                if (!interval) {
                                                    continueEdit = true;
                                                    message.reply(`**INVALID Interval**... ${reminderHelpMessage} for **valid time inputs!**`);
                                                    break;
                                                }
                                                interval -= HOUR_IN_MS * timezoneOffset + currentTimestamp;
                                                if (interval <= 0) {
                                                    continueEdit = true;
                                                    message.reply(`**INVALID Interval**... ${reminderHelpMessage} for **valid time inputs!**`);
                                                    break;
                                                }
                                                else if (interval < 60000) {
                                                    continueEdit = true;
                                                    message.reply(`**INVALID Interval**... Interval MUST be **__> 1m__**`);
                                                    break;
                                                }
                                                reminderData[9] = interval;
                                            }
                                            else {
                                                fn.sendReplyThenDelete(message, `**Interval cannot be set for one-time reminder**, try changing the **repeat** first`, 30000);
                                                continueEdit = true;
                                                break;
                                            }
                                        }
                                        break;
                                }
                            }
                            console.log({ reminderData });
                            if (!continueEdit) {
                                try {
                                    console.log(`Editing ${authorID}'s Fast ${pastNumberOfEntriesIndex} (${sortType})`);
                                    // Setup a new reminder! And leave a new lastEdited Timestamp:
                                    let currentTimestamp = Date.now();
                                    var newReminder;
                                    switch (fieldToEditIndex) {
                                        case 0:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { type: reminderData[8], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                        case 1:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, {
                                                $set: {
                                                    isDM: reminderData[0], channel: reminderData[4],
                                                    guildID: reminderData[10], lastEdited: currentTimestamp
                                                }
                                            }, { new: true });
                                            break;
                                        case 2:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { startTime: reminderData[5], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                        case 3:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { endTime: reminderData[6], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                        case 4:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { message: reminderData[7], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                        case 5:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, {
                                                $set: {
                                                    isRecurring: reminderData[1], endTime: reminderData[6],
                                                    interval: reminderData[9], lastEdited: currentTimestamp
                                                }
                                            }, { new: true });
                                            break;
                                        case 6:
                                            newReminder = await Reminder.findOneAndUpdate({ _id: reminderTargetID }, { $set: { interval: reminderData[9], lastEdited: currentTimestamp } }, { new: true });
                                            break;
                                    }
                                    console.log({ continueEdit, userEdit, newReminder });
                                    currentTimestamp = Date.now();
                                    reminderView = await Reminder.findById(reminderTargetID);
                                    if (reminderView) {
                                        await rm.sendReminderByObject(bot, currentTimestamp, newReminder);
                                        pastNumberOfEntriesIndex = await rm.getRecentReminderIndex(authorID, false);
                                        console.log({ reminderView, reminderData, reminderTargetID, fieldToEditIndex });
                                        reminderData = rm.reminderDocumentToDataArray(reminderView);
                                        showReminder = rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                                        console.log({ userEdit });
                                        const continueEditMessage = `Do you want to continue **editing Reminder ${pastNumberOfEntriesIndex}?:**\n\n__**Reminder ${pastNumberOfEntriesIndex}:**__\n${showReminder}`;
                                        continueEdit = await fn.getUserConfirmation(message, continueEditMessage, forceSkip, `Reminder: Continue Editing Reminder ${pastNumberOfEntriesIndex}?`, 300000);
                                    }
                                    else {
                                        message.reply("**Reminder not found...**");
                                        continueEdit = false;
                                    }
                                }
                                catch (err) {
                                    return console.log(err);
                                }
                            }
                            else {
                                console.log({ continueEdit, userEdit });
                                reminderView = await Reminder.findById(reminderTargetID);
                                if (reminderView) {
                                    pastNumberOfEntriesIndex = await rm.getRecentReminderIndex(authorID, false);
                                    console.log({ reminderView, reminderData, reminderTargetID, fieldToEditIndex });
                                    reminderData = rm.reminderDocumentToDataArray(reminderView);
                                    showReminder = rm.reminderDataArrayToString(bot, reminderData, timezoneOffset);
                                }
                                else {
                                    message.reply("**Reminder not found...**");
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
        }


        else if (mastermindCommand === "post" || mastermindCommand === "p") {
            if (args[1] !== undefined) {
                let mastermindIndex = isNaN(args[1]) ? args[1].toLowerCase() : parseInt(args[1]);
                let indexByRecency = false;
                if (mastermindIndex === "recent") {
                    mastermindIndex = 1;
                    indexByRecency = true;
                }
                else if (args[2] !== undefined) {
                    if (isNaN(args[2])) {
                        if (args[2].toLowerCase === "recent") {
                            indexByRecency = true;
                        }
                    }
                }
                mastermindIndex--;
                if (mastermindIndex < 0 || mastermindIndex >= totalMastermindNumber) {
                    return message.reply(`**Mastermind ${mastermindIndex + 1} does not exist**`);
                }
                var mastermind;
                if (indexByRecency) mastermind = await getOneMastermindByRecency(authorID, mastermindIndex);
                else mastermind = await getOneMastermindByCreatedTime(authorID, mastermindIndex);
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const targetChannel = await fn.getPostChannel(bot, message, `Mastermind ${sortType}`, forceSkip, mastermindEmbedColour);
                if (!targetChannel) return;
                const user = await User.findOne({ discordID: authorID });
                const member = bot.guilds.cache.get(guildID).member(authorID);
                const post = fn.getMessageEmbed(mastermindDocumentToString(bot, mastermind), `${member ? `${member.displayName}'s ` : ""}Mastermind Reflection`
                    + ` - ${fn.timestampToDateString(mastermind.createdAt)}${user ? ` ${user.timezone.name}` : ""}`, mastermindEmbedColour);
                await fn.sendMessageToChannel(bot, post, targetChannel);
            }
            else message.channel.send(mastermindActionHelpMessage);
        }


        else if (mastermindCommand === "template" || mastermindCommand === "templates" || mastermindCommand === "temp" || mastermindCommand === "t") {
            let templateUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${mastermindCommand} <NUMBER_OF_USERS> <NAMES>\``
                + "\n\n\`<NUMBER_OF_USERS>\`: **10** (\**any number*\*)"
                + "\n\n\`<NAMES>\`: Enter names of people in mastermind meeting\n***(COMMA SEPARATED, spaces in between is optional)***"
                + "\n(i.e. \`Paul, Radeesh, David, Kurt, Angel, Luke, Josh, Ragel, Sharran, Justin\`)";
            templateUsageMessage = fn.getMessageEmbed(templateUsageMessage, "Mastermind: Help", mastermindEmbedColour);
            const templateHelpMessage = `Try \`${PREFIX}${commandUsed} ${mastermindCommand} help\``;
            const invalidTemplateNumber = "**INVALID INPUT**... Enter a **positive number > 1!**";
            let numberOfUsers = args[1];
            if (isNaN(numberOfUsers)) {
                if (numberOfUsers !== undefined) {
                    numberOfUsers = numberOfUsers.toLowerCase();
                    if (numberOfUsers == "help") {
                        message.channel.send(templateUsageMessage);
                        return;
                    }
                }
                else {
                    message.reply(templateHelpMessage);
                    return;
                }
            }
            else {
                numberOfUsers = parseInt(numberOfUsers);
                if (numberOfUsers <= 0) {
                    fn.sendErrorMessageAndUsage(message, templateHelpMessage, invalidTemplateNumber);
                    return;
                }
            }
            // "Template" Variable Declarations
            const confirmTemplateGenerationMessage = `Are you sure you want to **generate a mastermind template for ${numberOfUsers} user(s)?**`;
            const confirmTemplateGenerationTitle = `Mastermind: Confirm ${numberOfUsers} User Template`;
            var namesForTemplate = new Array();
            console.log({ numberOfUsers });
            let userConfirmation = await fn.getUserConfirmation(message, confirmTemplateGenerationMessage, forceSkip, confirmTemplateGenerationTitle, 30000);
            if (userConfirmation === false) return;
            if (args[2] !== undefined) {
                var names = args;
                // Filter out the empty inputs due to multiple commas (e.g. ",,,, ,,, ,   ,")
                namesForTemplate = names.slice(2).join("").split(',').filter(name => name != "");
                console.log({ namesForTemplate });
            }
            // Use WeeklyJournalEntry function to create empty entries and format in backticks for Discord markdown
            await sendGeneratedTemplate(message, numberOfUsers, namesForTemplate, true, mastermindEmbedColour);
            return;
        }


        else return message.reply(mastermindHelpMessage);
    }
};