/**
 * File of all the important and universally reusable functions!
 */
const Discord = require("discord.js");
const mongoose = require("mongoose");
const Reminder = require("../djs-bot/database/schemas/reminder");
const User = require("../djs-bot/database/schemas/user");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const Dst = require("../djs-bot/database/schemas/dst");
const Track = require("../djs-bot/database/schemas/track");
require("dotenv").config();

const CLIENT_ID = process.env.DASHBOARD_CLIENT_ID;
const DEFAULT_PREFIX = '?';
const TRACKING_INTERVAL = 5000;
const TIMEOUT_MS = 375;
// Timescale Constants
const SECOND_IN_MS = 1000;
const MINUTE_IN_MS = 60000;
const HOUR_IN_MS = 3.6e+6;
const DAY_IN_MS = 8.64e+7;
const WEEK_IN_MS = 6.048e+8;
const MONTH_IN_MS = 2.628e+9;
// const YEAR_IN_MS = DAY_IN_MS * 365;
const YEAR_IN_MS = 3.154e+10;
const MAX_32_BIT_SIGNED_INT = 2147483647;
const spamRecords = new Discord.Collection();
const tracking = new Discord.Collection();

// Private Function Declarations

module.exports = {
    userIsSpamming: async function (message, messageTimestamp = Date.now(),
        CLOSE_MESSAGE_DELAY = this.CLOSE_MESSAGE_DELAY,
        CLOSE_MESSAGE_SPAM_NUMBER = this.CLOSE_MESSAGE_SPAM_NUMBER,
        REFRESH_MESSAGE_SPAM_DELAY = this.REFRESH_MESSAGE_SPAM_DELAY) {
        const spamDetails = spamRecords.get(message.author.id);
        if (spamDetails) {
            const messageSendDelay = messageTimestamp - spamDetails.lastTimestamp;
            console.log({ messageSendDelay });
            spamDetails.lastTimestamp = messageTimestamp;
            if (messageSendDelay < CLOSE_MESSAGE_DELAY) {
                spamDetails.closeMessageCount++;
            }
            if (spamDetails.closeMessageCount >= CLOSE_MESSAGE_SPAM_NUMBER) {
                console.log("Exiting due to spam...");
                message.reply("**Exiting... __Please don't spam!__**");
                return true;
            }
        }
        else {
            spamRecords.set(message.author.id, {
                lastTimestamp: null,
                closeMessageCount: 0,
            });
            setTimeout(() => spamRecords.delete(message.author.id), REFRESH_MESSAGE_SPAM_DELAY);
        }
        return false;
    },

    quickReact: async function (message, emoji, timeoutMultiplier = 1, TIMEOUT = TIMEOUT_MS) {
        try {
            if (message) {
                if (!message.deleted) {
                    setTimeout(async () => {
                        await message.react(emoji);
                    }, TIMEOUT * timeoutMultiplier);
                }
            }
        }
        catch (err) {
            console.error(err);
        }
    },

    getUserConfirmation: async function (bot, message, PREFIX, confirmationPrompt, forceSkip = false, embedTitle = "Confirmation",
        delayTime = 60000, deleteDelay = 3000, confirmationInstructions = this.confirmationInstructions) {
        try {
            if (forceSkip === true) return true;
            do {
                let confirmation = await this.messageDataCollect(bot, message, PREFIX, confirmationPrompt, embedTitle, "#FF0000",
                    delayTime, false, true, false, false, 0, null, confirmationInstructions, false);
                if (!confirmation) return false;
                let confirmationMessage = confirmation.content;
                const tag = `<@!${CLIENT_ID}>`;
                const isTagged = confirmationMessage.startsWith(tag) && confirmationMessage !== tag;
                const isPrefixed = confirmationMessage.startsWith(PREFIX) && confirmationMessage !== PREFIX;
                if (isTagged || isPrefixed) {
                    this.sendMessageThenDelete(message, "Exiting...", deleteDelay);
                    message.reply(`Any **command calls** while confirming your intentions will automatically **cancel**.\n**__Prefix:__** ${isPrefixed ? PREFIX : tag}\n**__Command Entered:__**\n${confirmationMessage}`);
                    return null;
                }
                confirmationMessage = confirmationMessage ? confirmationMessage.toLowerCase() : false;
                if (confirmationMessage === "yes" || confirmationMessage === "y" || confirmationMessage === "1") {
                    if (message.channel.type !== 'dm') {
                        const userSettings = await User.findOne({ discordID: message.author.id }, { _id: 0, deleteRepliesDuringCommand: 1 });
                        if (userSettings) {
                            if (userSettings.deleteRepliesDuringCommand) {
                                confirmation.delete();
                            }
                        }
                    }
                    this.sendMessageThenDelete(message, "Confirmed!", deleteDelay);
                    console.log(`Confirmation Value (in function): true`);
                    return true;
                }
                else if (confirmationMessage === "no" || confirmationMessage === "n" || confirmationMessage === "0"
                    || confirmationMessage === "stop" || confirmationMessage === "2") {
                    if (message.channel.type !== 'dm') {
                        const userSettings = await User.findOne({ discordID: message.author.id }, { _id: 0, deleteRepliesDuringCommand: 1 });
                        if (userSettings) {
                            if (userSettings.deleteRepliesDuringCommand) {
                                confirmation.delete();
                            }
                        }
                    }
                    console.log("Ending (confirmationMessage) promise...\nConfirmation Value (in function): false");
                    this.sendMessageThenDelete(message, "Exiting...", deleteDelay);
                    return false;
                }
                else continue;
            }
            while (true)
        }
        catch (err) {
            const SECONDS_IN_MS = 1000;
            console.error(err);
            console.log(`ERROR: User didn't react within ${delayTime / SECONDS_IN_MS}s!`);
            console.log("Ending (confirmationMessage) promise...\nConfirmation Value (in function): false");
            this.sendMessageThenDelete(message, "Exiting...", deleteDelay);
            return null;
        }
    },

    getPaginatedUserConfirmation: async function (bot, message, PREFIX, embedArray, confirmationMessage, forceSkip = false,
        embedTitle = "Confirmation", delayTime = 60000, deleteDelay = 3000, confirmationInstructions = this.confirmationInstructions) {
        try {
            if (forceSkip === true) return true;
            const SECONDS_IN_MS = 1000;
            if (embedArray) {
                if (embedArray.length) {
                    confirmationInstructions += embedArray.length > 1 ? `\n⬅ to scroll left\n➡ to scroll right` : "";
                    const footerText = `${confirmationInstructions}\n*(expires in ${delayTime / SECONDS_IN_MS}s)*`;
                    embedArray.forEach(embed => {
                        embed.setTitle(embedTitle)
                            .setFooter(footerText)
                            .setColor("#FF0000");
                    });
                }
                else return false;
            }
            else return false;
            // let currentPage = 0;
            const embed = await this.sendPaginationEmbed(bot, message.channel.id, message.author.id, embedArray, false);
            const confirmation = await this.getUserConfirmation(bot, message, PREFIX, confirmationMessage, forceSkip,
                embedArray[0].title, delayTime, deleteDelay, confirmationInstructions);
            const embedDeleted = embed.deleted;
            if (confirmation) {
                if (!embedDeleted) await embed.delete();
                return true;
            }
            else {
                if (!embedDeleted) await embed.delete();
                return false;
            }
        }
        catch (err) {
            const SECONDS_IN_MS = 1000;
            console.error(err);
            embed.delete();
            console.log(`ERROR: User didn't react within ${delayTime / SECONDS_IN_MS}s!`);
            console.log("Ending (confirmationMessage) promise...\nConfirmation Value (in function): false");
            this.sendMessageThenDelete(message, "Exiting...", deleteDelay);
            return false;
        }
    },

    // BUG: When user reacts too soon, the code breaks, figure out how to let it keep running!
    reactionDataCollect: async function (bot, message, prompt, emojiArray, title = "Reaction",
        colour = this.defaultEmbedColour, delayTime = 60000, promptMessageDelete = true) {
        try {
            const userOriginal = message.author.id;
            var result;
            const deleteDelay = 3000;
            const MS_TO_SECONDS = 1000;
            const footerText = `*(expires in ${delayTime / MS_TO_SECONDS}s)*`;
            let embeds = this.getEmbedArray(prompt, title, true, false, colour);
            embeds.forEach((embed, i) => {
                embed[i] = embed.setFooter(footerText);
            });

            await this.sendPaginationEmbed(bot, message.channel.id, userOriginal, embeds, false)
                .then(async confirm => {
                    emojiArray.forEach(async (emoji, i) => {
                        await this.quickReact(confirm, emoji, i);
                    });
                    const filter = (reaction, user) => {
                        const filterOut = user.id == userOriginal && (emojiArray.includes(reaction.emoji.name));
                        // console.log(`For ${user.username}'s ${reaction.emoji.name} reaction, the filter value is: ${filterOut}`);
                        return filterOut;
                    };

                    // Create the awaitReactions promise object for the confirmation message just sent
                    result = await confirm.awaitReactions(filter, { time: delayTime, max: 1 })
                        .then(reacted => {
                            console.log(`User's ${reacted.first().emoji.name} collected!`);
                            if (promptMessageDelete) {
                                confirm.delete();
                            }
                            console.log(`Reaction Value (in function): ${reacted.first().emoji.name}`);
                            return reacted.first().emoji.name;
                        })
                        // When the user DOESN'T react!
                        .catch(err => {
                            console.error(err);
                            confirm.delete();
                            console.log(`ERROR: User didn't react within ${delayTime / MS_TO_SECONDS}s!`);
                            console.log("Ending (reactionDataCollect) promise...");
                            this.sendMessageThenDelete(message, "Exiting...", deleteDelay);
                            console.log(`Reaction Value (in function): undefined`);
                            return false;
                        });
                });
            return result;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    /**
     * 
     * @param {Discord.Client} bot 
     * @param {Object} message 
     * @param {String} PREFIX
     * @param {String} prompt 
     * @param {String} title Default: "Message Reaction"
     * @param {String} colour Default: "#ADD8E6"
     * @param {Number} delayTime Default: 60000
     * @param {Boolean} showNewLineInstructions Default: true
     * @param {Boolean} getObject Default: false
     * @param {Boolean} deleteUserMessage Default: true
     * @param {Number} userMessageDeleteDelay Default: 0
     * @param {String | null} imageURL Default: null (No image will be attached) 
     * @param {String | false} additionalFooterText Default: false
     * @param {Boolean} showStopInstructions Default: true
     * @param {Boolean} allowCommandCalls Default: true
     */
    messageDataCollect: async function (bot, message, PREFIX, prompt, title = "Message Reaction", colour = this.defaultEmbedColour, delayTime = 60000, showNewLineInstructions = true,
        getObject = false, allowCommandCalls = false, deleteUserMessage = true, userMessageDeleteDelay = 0, imageURL = null, additionalFooterText = false, showStopInstructions = true) {
        const userOriginal = message.author.id;
        var result;
        const deleteDelay = 3000;
        const MS_TO_SECONDS = 1000;
        const footerText = `${additionalFooterText ? `${additionalFooterText}\n` : ""}*(expires in ${delayTime / MS_TO_SECONDS}s)*`;
        textEntryInstructions = `${showNewLineInstructions ? `\n\n↩ - Press \`SHIFT+ENTER\` to enter a **newline** before sending!` : ""}`
            + `${showStopInstructions ? `\n\n🛑 - Type \`stop\` to **cancel**` : ""}`;
        prompt = prompt + textEntryInstructions;
        let embeds = this.getEmbedArray(prompt, title, true, false, colour);
        embeds.forEach((embed, i) => {
            embeds[i] = embed.setFooter(footerText);
            if (imageURL) {
                embeds[i] = embeds[i].setImage(imageURL);
            }
        });
        await this.sendPaginationEmbed(bot, message.channel.id, userOriginal, embeds, false)
            .then(async confirm => {
                const filter = response => {
                    const filterOut = response.author.id === userOriginal;
                    console.log(`For ${response.author.username}'s response, the filter value is: ${filterOut}`);
                    return filterOut;
                };

                // Create the awaitMessages promise object for the confirmation message just sent
                result = await message.channel.awaitMessages(filter, { time: delayTime, max: 1 })
                    .then(async reacted => {
                        console.log(`${reacted.first().author.username}'s message was collected!`);
                        confirm.delete();
                        console.log(`Message Sent (in function): ${reacted.first().content}`);
                        if (deleteUserMessage && message.channel.type !== 'dm') {
                            const userSettings = await User.findOne({ discordID: message.author.id }, { _id: 0, deleteRepliesDuringCommand: 1 });
                            if (userSettings) {
                                if (userSettings.deleteRepliesDuringCommand) {
                                    reacted.first().delete({ timeout: userMessageDeleteDelay });
                                }
                            }
                        }
                        const finalMessage = reacted.first().content;
                        if (!allowCommandCalls) {
                            const tag = `<@!${CLIENT_ID}>`;
                            const isTagged = finalMessage.startsWith(tag) && finalMessage !== tag;
                            const isPrefixed = finalMessage.startsWith(PREFIX) && finalMessage !== PREFIX;
                            if (isTagged || isPrefixed) {
                                this.sendMessageThenDelete(message, "Exiting...", deleteDelay);
                                message.reply(`Any **command calls** while confirming your intentions will automatically **cancel**.\n**__Prefix:__** ${isPrefixed ? PREFIX : tag}\n**__Command Entered:__**\n${finalMessage}`);
                                return false;
                            }
                        }
                        if (getObject) return reacted.first();
                        else return finalMessage;
                    })
                    // When the user DOESN'T react!
                    .catch(err => {
                        console.error(err);
                        confirm.delete();
                        console.log(`ERROR: User didn't respond within ${delayTime / MS_TO_SECONDS}s!`);
                        console.log("Ending (messageDataCollect) promise...");
                        this.sendMessageThenDelete(message, "Ending...", deleteDelay);
                        console.log(`Message Sent (in function): false`);
                        return false;
                    });
            }).catch(err => console.error(err));
        return result;
    },

    /**
     * @param {String} string
     */
    toTitleCase: function (string) {
        try {
            if (string && typeof string === "string") {
                if (string.length > 0) {
                    string = string.replace(/(.+?)([\s\n\/]+)/, (match, word, spacing, offset, string) => {
                        return `${word[0].toUpperCase()}${word.slice(1)}${spacing}`;
                    });
                    return string;
                }
            }
            return false;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    // START CRUD Operations Help

    /**
     * 
     * @param {String} PREFIX 
     * @param {String} commandUsed 
     * @param {String} crudCommandName 
     * @param {Boolean} supportsStartTimeAndRecency 
     * @param {[String] | false}
     * @param {Boolean} canDeleteByFields 
     * @param {[String] | false} fields 
     * @param {[String] | false} additionalCommands 
     * @param {String | false} additionalInformation 
     */
    getReadOrDeleteUsageMessage: function (PREFIX, commandUsed, crudCommandName, supportsStartTimeAndRecency = false,
        entryName = ["entry", "entries"], supportsFields = false, fields = false, additionalCommands = false, additionalInformation = "") {
        entryName = Array.isArray(entryName) ? entryName.length >= 2 ? entryName : ["entry", "entries"] : ["entry", "entries"];
        const entrySingular = entryName[0].toLowerCase();
        const entryPlural = entryName[1].toLowerCase();
        const recent = supportsStartTimeAndRecency ? " <recent?>" : "";
        const recentInstructions = supportsStartTimeAndRecency ? `\n\n\`<recent?>\`: (OPT.) type **recent** at the indicated spot to sort the ${entryPlural} by **time created instead of ${entrySingular} start time!**` : ""
        const field = supportsFields ? " <FIELDS?>" : "";
        fields = fields ? (fields.length > 0 ? fields : false) : false;
        additionalCommands = additionalCommands ? (additionalCommands.length > 0 ? additionalCommands : "") : "";
        additionalInformation = additionalInformation ? additionalInformation : "";
        const fieldInstructions = supportsFields ? (fields ? `\n\n\`<FIELDS?>\`(OPT.): **${fields.join("**;** ")}** (any field you'd like to clear, doesn't remove whole ${entrySingular})`
            + "\n(if MULTIPLE `<FIELDS>`: separate by **commas**!)" : "") : "";
        return `**USAGE:**\n\`${PREFIX}${commandUsed} ${crudCommandName} past <PAST_#_OF_ENTRIES>${recent}${field} <force?>\``
            + `\n\`${PREFIX}${commandUsed} ${crudCommandName} <#_MOST_RECENT_ENTRY>${recent}${field} <force?>\``
            + `\n\`${PREFIX}${commandUsed} ${crudCommandName} many <RECENT_ENTRIES>${recent}${field} <force?>\``
            + `\n\`${PREFIX}${commandUsed} ${crudCommandName} <#_OF_ENTRIES>${recent} past <STARTING_INDEX>${field} <force?>\``
            + additionalCommands
            + `\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; 5** (\\*any number); **all** \n(NOTE: ***__any number > 1__* will get more than 1 ${entrySingular}!**)`
            + `\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\**any number*)`
            + `\n\n\`<#_MOST_RECENT_ENTRY>\`: **all; recent; 3** (3rd most recent ${entrySingular}, \\**any number*)\n(NOTE: Gets just 1 ${entrySingular} - UNLESS \`all\`)`
            + `\n\n\`<RECENT_ENTRIES>\`: **3,5,recent,7,1,25**\n- **COMMA SEPARATED, NO SPACES:**\n1 being the most recent ${entrySingular}, 25 the 25th most recent, etc.`
            + `${recentInstructions}${fieldInstructions}\n\n\`<force?>\`: (OPT.) type **force** at the end of your command to **skip all of the confirmation windows!**${additionalInformation}`;
    },

    getEntriesByStartTime: async function (Model, query, entryIndex, numberOfEntries = 1) {
        try {
            const entries = await Model
                .find(query)
                .sort({ startTime: -1 })
                .limit(numberOfEntries)
                .skip(entryIndex);
            console.log(entries);
            return entries;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    getEntriesByEarliestEndTime: async function (Model, query, entryIndex, numberOfEntries = 1) {
        try {
            const entries = await Model
                .find(query)
                .sort({ endTime: +1 })
                .limit(numberOfEntries)
                .skip(entryIndex);
            console.log(entries);
            return entries;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    getEntriesByRecency: async function (Model, query, entryIndex, numberOfEntries = 1) {
        try {
            const entries = await Model
                .find(query)
                .sort({ _id: -1 })
                .limit(numberOfEntries)
                .skip(entryIndex);
            console.log(entries);
            return entries;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    // END CRUD Operations Help


    dateAndTimeInstructions: "`<DATE/TIME>`:"
        + "\n**NOT Case-Sensitive!**\nEnter **timezone (optional)** at the **end**.\nThe **\"at\"** before the time is **optional.**\n"
        // + "\n**? = optional, # = number**\n`<in?>`: (OPT.) **future date/time**\n`<RELATIVE TIME>`: **(PAST) ago/prior/before**\nOR **(FUTURE) from now/later/in the future**"
        // + "\n`<DAY OF WEEK>`: **Mon/Monday, Tues/Tuesday,..., Sun/Sunday**\n`<RELATIVE TO NOW>`: **yesterday/yest/the day before**\nOR **today/tod**\nOR **tomorrow/tom/tmrw**"
        // + "\n`<TIME SCALES>`: **minutes/min, hours/hr, days, weeks, months, years/yrs**"
        // + "\n`<TIME>`: **Military or Standard**\n***(e.g. 13:00, 159am, 1:59, 1259p, 1pm, 6a, 645p, 23:59)***"
        // + "\n`<TIMEZONE?>`: (OPT. - CAN BE ADDED TO THE END OF ANY DATE/TIME)\nEnter the timezone in as **abbreviation or a UTC offset**\n***(e.g. est, pst, cdt, amt, -4:00, +12, +130)*** - **DEFAULT:** Your Timezone (settings)"
        + "\n__**`Enter relative date and/or time`**__:"
        // + "\n`<in?> # <TIME SCALES> <RELATIVE TIME> <at?> <TIME?> <TIMEZONE?>`"
        // + "\n`<in?> # <DAY OF WEEK> <RELATIVE TIME> <at?> <TIME?> <TIMEZONE?>`\n`<previous/last/past/next/this> <DAY OF WEEK> <at?> <TIME?> <TIMEZONE?>`"
        // + "\n`<RELATIVE TO NOW> <at?> <TIME?> <TIMEZONE?>`\n`<in?> #y:#d:#h:#m:#s <RELATIVE TIME> <TIMEZONE?>`"
        + "\ni.e. **now **\|** 1 hour ago **\|** 15.5 minutes ago **\|** in 72 mins **\|** 2.5 hrs from now"
        + "\n**\|** yesterday at 10pm EST **\|** tmrw 9pm **\|** today at 8pm mst"
        + "\n**\|** 2 days ago 6P PST **\|** 1 year ago 13:59 **\|** in 5 months at 830p -130"
        + "\n**\|** last monday at 159 CDT **\|** next friday at 645a **\|** 5 mondays ago 1259a -4:00"
        + "\n**\|** in 5y3d2s +12 **\|** 5d ago **\|** 4h:2m:25s from now EDT**"
        // + "`<DATE SEPARATORS>`: **\. \, \/ \-**\n`<MONTH>`: Name (january/jan, february/feb,..., december/dec) or Number (1-12)"
        // + "\n`<DAY>`: Number - #\n`<YEAR?>`: (OPT.) Number - #"
        + "\n\n***\-\-OR\-\-***"
        + "\n\n__**`Enter precise date and time`**__:\n**FORMAT: <MONTH/DAY/YEAR>** (YEAR is optional, **Default: Current Year**)\n- Each must be **separated** by one of the following: **\. \, \/ \-**"
        // + "\n`<MONTH> <DATE SEPARATOR?> <DAY> <DATE SEPARATOR?> <YEAR?> <at?> <TIME> <TIMEZONE?>`\n"
        + "\ni.e. **3/22/2020 at 10a EST **\|** 3.22.2020 at 9PM **\|** 3-22-2020 120a"
        + "\n**\|** 3.22 9p **\|** 2/28 13:59 +8:00 **\|** 10-1 at 15:00"
        + "\n**\|** Jan 5, 2020 00:00 -5:00 **\|** Aug 31/20 12a PDT **\|** September 8, 2020 559 CDT**"
        + "\n\nRemember **Daylight Saving Time (DST)** when entering **abbreviated timezones**:\n**EST and EDT** for example, are **different** because of DST.",

    userAndBotMutualServerIDs: async function (bot, userID) {
        // Check all of the servers the bot is in
        const botServersIDs = await this.getAllBotServers(bot);
        var botUserServers = new Array();
        for (i = 0; i < botServersIDs.length; i++) {
            const server = await bot.guilds.cache.get(botServersIDs[i]);
            if (server) if (server.member(userID) && botServersIDs[i]) {
                botUserServers.push(botServersIDs[i]);
            }
        }
        return botUserServers;
    },

    getAllBotServers: async function (bot) {
        const botServersIDs = await bot.guilds.cache.map(guild => guild.id);
        return botServersIDs;
    },

    listOfServerNames: async function (bot, serverIDs) {
        var serverListString = "";
        await serverIDs.forEach(async (server, serverIndex) => {
            const serverName = await bot.guilds.cache.get(server).name;
            serverListString = serverListString + `\`${serverIndex + 1}\` - **` + serverName + "**\n";
        });
        return serverListString;
    },

    // Note: This function displays values from 1 onwards but returns a properly indexed value (for arrays)
    userSelectFromList: async function (bot, message, PREFIX, list, numberOfEntries, instructions, selectTitle,
        messageColour = this.defaultEmbedColour, delayTime = 120000, userMessageDeleteDelay = 0, messageAfterList = "") {
        try {
            var targetIndex;
            do {
                var currentTimestamp;
                let targetObject = await this.messageDataCollect(bot, message, PREFIX, `${instructions}\n${list}\n${messageAfterList || ""}`, selectTitle,
                    messageColour, delayTime, false, true, false, false, userMessageDeleteDelay);
                if (!targetObject) return false;
                else currentTimestamp = Date.now();
                targetIndex = targetObject.content;
                const errorMessage = "**Please enter a number on the given list!**";
                const timeout = 15000;
                if (isNaN(targetIndex)) {
                    if (targetIndex.toLowerCase() === "stop") {
                        return false;
                    }
                    else this.sendReplyThenDelete(message, errorMessage, timeout);
                }
                else if (parseInt(targetIndex) > numberOfEntries || parseInt(targetIndex) <= 0) {
                    this.sendReplyThenDelete(message, errorMessage, timeout);
                }
                else {
                    // Minus 1 to convert to back array index (was +1 for user understanding)
                    targetIndex = parseInt(targetIndex) - 1;
                    break;
                }
                if (message.channel.type !== 'dm') {
                    const userSettings = await User.findOne({ discordID: message.author.id }, { _id: 0, deleteRepliesDuringCommand: 1 });
                    if (userSettings) {
                        if (userSettings.deleteRepliesDuringCommand) {
                            targetObject.delete();
                        }
                    }
                }
                if (await this.userIsSpamming(message, currentTimestamp)) return false;
            }
            while (true);
            return targetIndex;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    listOfServerChannels: async function (bot, userOriginalMessageObject, serverID,
        allowTextChannels = true, allowVoiceChannels = false) {
        const channelList = await bot.guilds.cache.get(serverID).channels.cache.map(channel => {
            const userPermissions = channel.permissionsFor(userOriginalMessageObject.author);
            if (!userPermissions) return null;
            else if (userPermissions.has("VIEW_CHANNEL")) {
                if (allowTextChannels && userPermissions.has("SEND_MESSAGES") && channel.type === "text") {
                    return channel.id;
                }
                if (allowVoiceChannels && userPermissions.has("CONNECT") && channel.type === "voice") {
                    return channel.id;
                }
            }
            return null;
        }).filter(element => element !== null);
        return channelList;
    },

    listOfChannelNames: async function (bot, channelList) {
        var channelListDisplay = "";
        await channelList.forEach(async (channel, channelIndex) => {
            let channelName = await bot.channels.cache.get(channel).name;
            channelListDisplay = channelListDisplay + `\`${channelIndex + 1}\` - **` + channelName + "**\n";
        });
        return channelListDisplay;
    },

    sendMessageToChannel: async function (bot, messageToSend, targetChannel) {
        await bot.channels.cache.get(targetChannel).send(messageToSend);
    },

    millisecondsToTimeString: function (milliseconds) {
        if (milliseconds === null || milliseconds === undefined) return null;
        var sign = ""
        if (milliseconds < 0) {
            // sign = "-";
            // milliseconds = Math.abs(milliseconds);
            milliseconds = 0;
        }
        timeArray = this.getHoursMinutesSecondsMillisecondsArray(milliseconds);
        var timeString = "";
        const days = Math.floor(parseInt(timeArray[0]) / 24);
        if (days > 0) {
            timeArray[0] -= days * 24;
            timeString = `${days}d:`;
        }
        timeString += `${timeArray[0]}h:${timeArray[1]}m:${timeArray[2]}s`;
        return `${sign}${timeString}`;
    },


    getSplitTimePeriodAndTimezoneArray: function (timeArray) {
        // timeString = timeString.toLowerCase();
        // timeParseRegex = /(?:(?:(?:(\d{1}(?:\d{1})?)[\:]?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(p|a)?(?:m)?([a-z]{2,5})?)?/;
        // timeParse = timeParseRegex.exec(timeString);
        // console.log({timeParse});
        const hours = timeArray[0] || timeArray[2];
        const minutes = timeArray[1];
        const amPmString = timeArray[3];
        const timezoneString = timeArray[4];
        console.log({ hours, minutes, amPmString, timezoneString });
        return [hours, minutes, amPmString, timezoneString];
    },

    getProperTimezoneString: function (timePeriodAndTimeZoneArgs, originalArgs) {
        timePeriodAndTimeZoneArgs = [this.getElementFromBack(timePeriodAndTimeZoneArgs, 2), this.getElementFromBack(timePeriodAndTimeZoneArgs, 1)];
        originalArgs = [this.getElementFromBack(originalArgs, 2), this.getElementFromBack(originalArgs, 1)];
        if (timePeriodAndTimeZoneArgs[1] && timePeriodAndTimeZoneArgs[1] != originalArgs[1]) {
            // If the am/pm ends with m, then it greedily took the m representing the timezone
            if (/m$/.test(timePeriodAndTimeZoneArgs[0])) {
                timePeriodAndTimeZoneArgs[1] = originalArgs[1];
            }
        }
        return timePeriodAndTimeZoneArgs[1];
    },

    getMultipleAdjacentArrayElements: function (array, startingIndex, numberOfElements) {
        let multipleArray = new Array();
        for (i = startingIndex; i < (startingIndex + numberOfElements); i++) {
            multipleArray.push(array[i]);
        }
        return multipleArray;
    },

    /**
     * 
     * @param {Number} year CE Year: 0000-xxxx
     * @param {Number} targetMonth Month: 0-11, 0 = January, 1 = February,...
     * @param {Number} targetDayOfWeek Day of Week: 0-6, 0 = Sunday, 1 = Monday,...
     * @param {Number} ordinalDayOfWeek First, Second, Third, Fourth... or "Last"
     */
    getUTCTimestampOfDayOfWeek: function (year, targetMonth, targetDayOfWeek, ordinalDayOfWeek) {
        if (isNaN(ordinalDayOfWeek)) if (ordinalDayOfWeek.toLowerCase() === "last") {
            ordinalDayOfWeek = this.getNumberOfDaysOfTheWeek(year, targetMonth, targetDayOfWeek);
            if (ordinalDayOfWeek === false) return false;
        }
        const WEEK_IN_MS = DAY_IN_MS * 7;
        const startOfMonth = new Date(year, targetMonth);
        let targetDate = startOfMonth.getTime();
        while (true) {
            const currentDate = new Date(targetDate);
            if (currentDate.getUTCDay() === targetDayOfWeek) {
                targetDate += WEEK_IN_MS * (ordinalDayOfWeek - 1);
                break;
            }
            else {
                targetDate += DAY_IN_MS;
            }
        }
        return targetDate;
    },

    getNumberOfDaysOfTheWeek: function (year, targetMonth, targetDayOfWeek) {
        const daysInMonth = this.getNumberOfDaysInMonthArray(year);
        const daysInTargetMonth = daysInMonth[targetMonth];
        var firstDayOfWeekInMonth = new Date(this.getUTCTimestampOfDayOfWeek(year, targetMonth, targetDayOfWeek, 1)).getUTCDate();
        var lastDayOfWeekInMonth = firstDayOfWeekInMonth;
        var numberOfDaysOfWeekInMonth = 1;
        if (firstDayOfWeekInMonth) {
            while (true) {
                if (lastDayOfWeekInMonth + 7 <= daysInTargetMonth) {
                    numberOfDaysOfWeekInMonth++;
                    lastDayOfWeekInMonth += 7;
                }
                else return numberOfDaysOfWeekInMonth;
            }
        }
        else return false;
    },

    isSouthernHemisphereDSTTimezone: function (timezone) {
        if (timezone) timezone = timezone.toLowerCase();
        else return false;

        if (timezone === 'aest' || timezone === 'aet' || timezone === 'acst' || timezone === 'nft'
            || timezone === 'lhst' || timezone === 'chast' || timezone === 'nzst' || timezone === 'amt'
            || timezone === 'brt' || timezone === 'clt' || timezone === 'east' || timezone === 'pyt'
            || timezone === 'sst' || timezone === 'wst' || timezone === 'egt') {
            return true;
        }
        else return false;
    },

    /**
     * 
     * @param {Number} targetYear 
     * @param {String} timezone 
     * For timezones which pour into different years, this function will only return the start time of this year only:
     * i.e. targetYear = 2020 - startTime: Oct. 2020 - endTime: Apr. 2021
     */
    getDSTStartAndEndTimeUTC: function (currentTimestamp, timezone) {
        if (isNaN(currentTimestamp)) return false;
        if (timezone) timezone = timezone.toLowerCase();
        else return false;

        const targetYear = new Date(currentTimestamp).getUTCFullYear();
        var daylightStartTimestamp, daylightEndTimestamp;

        /**
         * **NOTE:**
         * For timezones which pour into different years,
         * this function will only return the start time of this year only: 
         * i.e. targetYear = 2020 - startTime: Oct. 2020 - endTime: Apr. 2021
         */

        // ==============
        // LEGEND:
        // * - Southern Hemisphere Regions
        // ==============

        // North America (USA and Canada):
        // Start - Second Sunday of March at 2:00AM
        // End - First Sunday of November at 2:00AM
        if (timezone === 'akst' || timezone === 'ast' || timezone === 'cst' || timezone === 'est'
            || timezone === 'hst' || timezone === 'mst' || timezone === 'nt' || timezone === 'nst'
            || timezone === 'pst' || timezone === 'pmst') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 2, 0, 2) + HOUR_IN_MS * 2;
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 10, 0, 1) + HOUR_IN_MS * 2;
        }

        // Europe (+ West Greenland):
        // Start - Last Sunday of March 1:00AM UTC
        // End - Last Sunday of October 1:00AM UTC
        else if (timezone === 'azot' || timezone === 'gmt' || timezone === 'wet' || timezone === 'cet'
            || timezone === 'eet' || timezone === 'egt' || timezone === 'met' || timezone === 'wgt') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 2, 0, "last") + HOUR_IN_MS;
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 9, 0, "last") + HOUR_IN_MS;
            daylightEndTimestamp += HOUR_IN_MS;
        }

        // Australia*:
        // Start - First Sunday of October at 2:00AM
        // End - First Sunday of April at 2:00AM
        else if (timezone === 'aest' || timezone === 'aet' || timezone === 'acst' || timezone === 'nft'
            || timezone === 'lhst') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 9, 0, 1) + HOUR_IN_MS * 2;
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear + 1, 3, 0, 1) + HOUR_IN_MS * 2;
        }

        // Brazil*:
        // Start - Third Sunday of October 12:00AM
        // End - Third Sunday of February 12:00AM
        else if (timezone === 'amt' || timezone === 'brt') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 9, 0, 3);
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear + 1, 1, 0, 3);
        }

        // Cuba:
        // Start - Second Sunday of March at 12:00AM
        // End - First Sunday of November at 1:00AM
        else if (timezone === 'cust' || timezone === 'cubat' || timezone === 'cubst' || timezone === 'cuba'
            || timezone === 'cub' || timezone === 'cu') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 2, 0, 2);
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 10, 0, 1) + HOUR_IN_MS;
        }

        // New Zealand (and Chatham)*:
        // Start - Last Sunday of September at 2:00AM
        // End - First Sunday of April at 2:00AM
        else if (timezone === 'chast' || timezone === 'nzst') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 8, 0, "last") + HOUR_IN_MS * 2;
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear + 1, 3, 0, 1) + HOUR_IN_MS * 2;
        }

        // Mongolia:
        // Start - Fourth Friday of March at 2:00AM
        // End - Last Friday of September at 12:00AM
        else if (timezone === 'chot' || timezone === 'hovt' || timezone === 'ulat') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 2, 5, 4) + HOUR_IN_MS * 2;
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 8, 5, "last");
        }

        // Chile*:
        // Start - First Sunday of September 12:00AM
        // End - First Sunday of April 12:00AM
        else if (timezone === 'clt') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 8, 0, 1);
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear + 1, 3, 0, 1);
        }

        // Easter Island (of Chile)*:
        // Start - First Saturday of September 10:00PM
        // End - First Saturday of April 10:00PM
        else if (timezone === 'east') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 8, 0, 1) - HOUR_IN_MS * 2;
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear + 1, 3, 0, 1) - HOUR_IN_MS * 2;
        }

        // Israel:
        // Start - Last Friday of March at 2:00AM
        // End - Last Sunday of October at 2:00AM
        else if (timezone === 'isrst' || timezone === 'isst') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 2, 5, "last") + HOUR_IN_MS * 2;
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 9, 0, "last") + HOUR_IN_MS * 2;
        }

        // Iran:
        // Start - March 21-22 at 12:00AM (On the first day of Farvardin)
        // End - September 21-22 at 12:00AM (On the last day Shahrivar)
        else if (timezone === 'irst') {
            const solarHijriDate = targetYear % 4 === 0 ? 21 : 22;
            daylightStartTimestamp = new Date(targetYear, 2, solarHijriDate).getTime();
            daylightEndTimestamp = new Date(targetYear, 9, solarHijriDate).getTime();
        }

        // Paraguay*:
        // Start - First Sunday of September 12:00AM
        // End - Fourth Sunday of March 12:00AM
        else if (timezone === 'pyt') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 8, 0, 1);
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear + 1, 2, 0, 4);
        }

        // Samoa (and West Samoa)*:
        // Start - Last Sunday of September 3:00AM
        // End - First Sunday of April 4:00AM
        else if (timezone === 'sst' || timezone === 'wst') {
            daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 8, 0, "last") + HOUR_IN_MS * 3;
            daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear + 1, 3, 0, 1) + HOUR_IN_MS * 4;
        }

        // // Uruguay*:
        // // Start - Second Sunday of October 2:00AM
        // // End - First Sunday of March 2:00AM
        // else if (timezone === 'uyt') {
        //     daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 9, 0, 2) + HOUR_IN_MS * 2;
        //     daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear + 1, 2, 0, 1) + HOUR_IN_MS * 2;
        // }

        else return false;

        const isDST = currentTimestamp >= daylightStartTimestamp && currentTimestamp < daylightEndTimestamp;
        let timezoneOffset = this.getTimezoneOffset(timezone);
        if (isDST) timezoneOffset += this.getTimezoneDaylightOffset(timezone);

        if (timezone !== 'azot' && timezone !== 'gmt' && timezone !== 'wet' && timezone !== 'cet'
            && timezone !== 'eet' && timezone !== 'egt' && timezone !== 'met' && timezone !== 'wgt') {
            daylightStartTimestamp -= timezoneOffset * HOUR_IN_MS;
            daylightEndTimestamp -= timezoneOffset * HOUR_IN_MS;
        }
        return [daylightStartTimestamp, daylightEndTimestamp];
    },

    /**
     * 
     * @param {Number} targetTimestamp Timezone Adjusted Timestamp to be checked for falling within UTC Daylight Saving Time
     * @param {Boolean} userDaylightSavingSetting If the user opted for having Daylight Saving Time adjustments
     */
    isDaylightSavingTime: function (targetTimestamp, timezone, userDaylightSavingSetting) {
        console.log({ targetTimestamp });
        if (userDaylightSavingSetting === false)
            return false;
        else {
            // If it's the in Southern Hemisphere - the DST time frame
            // will roll over into the next year, so two time periods
            // would need to be checked:
            if (this.isSouthernHemisphereDSTTimezone(timezone)) {
                const daylightSavingTimeFirstArray = this.getDSTStartAndEndTimeUTC(targetTimestamp, timezone);
                if (!daylightSavingTimeFirstArray) return false;
                const [daylightFirstStartTimestamp, daylightFirstEndTimestamp] = daylightSavingTimeFirstArray;
                if (targetTimestamp >= daylightFirstStartTimestamp && targetTimestamp < daylightFirstEndTimestamp)
                    return true;
            }
            const daylightSavingTimeArray = this.getDSTStartAndEndTimeUTC(targetTimestamp, timezone);
            if (!daylightSavingTimeArray) return false;
            const [daylightStartTimestamp, daylightEndTimestamp] = daylightSavingTimeArray;
            if (targetTimestamp >= daylightStartTimestamp && targetTimestamp < daylightEndTimestamp)
                return true;
            else
                return false;
        }
    },

    getNthNumberIndex: function (array, startingIndex = 0, skipToNthIndex = 1) {
        if (skipToNthIndex <= 0 || startingIndex < 0 || startingIndex > array.length - 1) return -1;
        let skipCounter = 0;
        for (i = startingIndex; i < array.length; i++) {
            if (!isNaN(array[i])) skipCounter++;
            if (skipCounter === skipToNthIndex) return i;
        }
        return -1;
    },

    getProperDateAndTimeArray: function (dateTimeArray, adjustedArgs, timezoneOffset, dayYearTimeOffset = 0) {
        const yearIncluded = !!(dateTimeArray[2 + dayYearTimeOffset]);
        const dayIndex = this.getNthNumberIndex(adjustedArgs, dayYearTimeOffset);
        const extractedDay = adjustedArgs[dayIndex];
        console.log({ dayIndex, extractedDay });
        if (dayIndex == -1) return false;
        if (extractedDay.length > 2) return false;
        const day = /(\d{1}(?:\d{1})?)/.exec(adjustedArgs[dayIndex])[1];
        var year;
        if (yearIncluded) {
            console.log({ dateTimeArray });
            const originalYear = dateTimeArray[this.getNthNumberIndex(dateTimeArray, dayIndex + dayYearTimeOffset, 2)];
            console.log({ originalYear })
            if (!originalYear) return false;
            year = /(\d{1,4})/.exec(adjustedArgs[dayIndex + 1])[1];
            if (!year) return false;
            if (year !== originalYear) {
                const yearIndex = year.lastIndexOf(originalYear);
                const yearOverflow = year.substring(yearIndex, yearIndex + originalYear.length);
                // const yearOverflow = originalYear.replace(year, "");
                dateTimeArray[2 + dayYearTimeOffset] = year;
                const combinedHoursAndMins = dateTimeArray[3 + dayYearTimeOffset] ?
                    `${yearOverflow}${dateTimeArray[3 + dayYearTimeOffset]}${dateTimeArray[3 + dayYearTimeOffset]}`
                    : dateTimeArray[5 + dayYearTimeOffset] ? `${yearOverflow}${dateTimeArray[5 + dayYearTimeOffset]}` : `${yearOverflow}`;
                console.log({ yearOverflow, year, dateTimeArray, combinedHoursAndMins });
                if (!combinedHoursAndMins) return false;
                // If the combination is the same as the year, then there was no specified time
                // => Set the time to Midnight - 00:00
                else if (combinedHoursAndMins === year) {
                    dateTimeArray[3 + dayYearTimeOffset] = "00";
                    dateTimeArray[4 + dayYearTimeOffset] = "00";
                    dateTimeArray[5 + dayYearTimeOffset] = undefined;
                }
                // If the combinedHoursAndMins is greater than 2, there are minutes.
                else if (combinedHoursAndMins.length > 2) {
                    const splitHoursAndMins = /(\d{1}(?:\d{1})?)(\d{2})/.exec(combinedHoursAndMins);
                    console.log({ splitHoursAndMins });
                    dateTimeArray[3 + dayYearTimeOffset] = splitHoursAndMins[1];
                    dateTimeArray[4 + dayYearTimeOffset] = splitHoursAndMins[2];
                    dateTimeArray[5 + dayYearTimeOffset] = undefined;
                }
                else {
                    dateTimeArray[3 + dayYearTimeOffset] = undefined;
                    dateTimeArray[4 + dayYearTimeOffset] = undefined;
                    dateTimeArray[5 + dayYearTimeOffset] = combinedHoursAndMins;
                }
            }
        }
        else {
            year = new Date(Date.now() + timezoneOffset * HOUR_IN_MS).getUTCFullYear();
            if (day !== dateTimeArray[2]) {
                const extractedTime = dateTimeArray[2].replace(day, "");
                console.log({ extractedTime, day });
                if (!extractedTime) return false;
                dateTimeArray[2] = day;
                if (dateTimeArray[6]) {
                    if (dateTimeArray[6].length === 2) {
                        dateTimeArray[4] = extractedTime;
                        dateTimeArray[5] = dateTimeArray[6];
                    }
                    // dateTimeArray[6].length === 1
                    else {
                        if (extractedTime.length === 1) {
                            dateTimeArray[6] = `${extractedTime}${dateTimeArray[6]}`;
                        }
                        // extractedTime.length === 2
                        else {
                            dateTimeArray[4] = extractedTime;
                            dateTimeArray[5] = dateTimeArray[6];
                        }
                    }
                }
                else if (dateTimeArray[4]) {
                    dateTimeArray[4] = `${extractedTime}${dateTimeArray[4]}`;
                }
                else dateTimeArray[4] = `${extractedTime}`;
            }
        }
        const timeArray = this.getProperTimeAndTimezoneArray(dateTimeArray, adjustedArgs);
        console.log({ timeArray, year, day });
        let allUndefined = true;
        timeArray.forEach((timeElement) => {
            if (timeElement !== undefined) {
                allUndefined = false;
            }
        });
        var hours, minutes, amPmString, timezoneString;
        if (allUndefined) {
            hours = "12";
            minutes = "00";
            amPmString = "AM";
        }
        else[hours, minutes, amPmString, timezoneString] = timeArray;
        return [year, day, hours, minutes, amPmString, timezoneString];
    },

    // Currently only accepting abbreviations
    // https://en.wikipedia.org/wiki/List_of_time_zone_abbreviations
    // https://www.timetemperature.com/abbreviations/world_time_zone_abbreviations.shtml
    /**
     * 
     * @param {string} timezoneString Give timezone as an abbreviation or in the numerical forms: +8:45, -900, -12:30, 11.5, 11
     */
    getTimezoneOffset: function (timezoneString) {
        if (!timezoneString) return null;
        // Can be a single number, multiple numbers, time, or string of 2-5 letters
        // In the form: 8:45
        const timezoneFormatRegex = /(?:(\-)|(?:\+))(\d{1}(?:\d{1})?)\:?(\d{2})/;
        const timezoneFormat = timezoneFormatRegex.exec(timezoneString);
        if (timezoneFormat) {
            const sign = timezoneFormat[1];
            const hours = parseInt(timezoneFormat[2]);
            if (hours < -12 || hours > 14) return null;
            const minutes = parseInt(timezoneFormat[3]);
            if (minutes >= 60) return null;
            const offset = hours + (minutes / 60);
            if (offset < -12 || offset > 14) return null;
            if (sign) {
                return -offset;
            }
            else {
                return offset;
            }
        }
        // In the form: 11.5, 11 
        if (!isNaN(timezoneString)) {
            const offset = parseFloat(timezoneString);
            // If it is a decimal number, it is properly scaled already
            // https://en.wikipedia.org/wiki/List_of_UTC_time_offsets
            if (offset < -12 || offset > 14) return null;
            else return offset;
        }

        if (timezoneString.length < 1) return null;
        timezoneString = timezoneString.toLowerCase();
        var timezoneOffset;
        const firstLetter = timezoneString[0];
        switch (firstLetter) {
            case 'a':
                switch (timezoneString) {
                    case "a": timezoneOffset = 1;
                        break;
                    case "acdt": timezoneOffset = 10.5;
                        break;
                    case "acst": timezoneOffset = 9.5;
                        break;
                    case "act": timezoneOffset = -5;
                        break;
                    // ASEAN Common Time
                    case "asct": timezoneOffset = 8;
                        break;
                    case "asean": timezoneOffset = 8;
                        break;
                    case "acwt": timezoneOffset = 8.75;
                        break;
                    case "acwst": timezoneOffset = 8.75;
                        break;
                    case "adt": timezoneOffset = -3;
                        break;
                    // Arabia Daylight Time
                    case "ardt": timezoneOffset = 3;
                        break;
                    // Arabia Daylight Time
                    case "aradt": timezoneOffset = 3;
                        break;
                    case "aedt": timezoneOffset = 11;
                        break;
                    case "aest": timezoneOffset = 10;
                        break;
                    case "aet": timezoneOffset = 10;
                        break;
                    case "aft": timezoneOffset = 4.5;
                        break;
                    case "akdt": timezoneOffset = -8;
                        break;
                    case "akst": timezoneOffset = -9;
                        break;
                    case "almt": timezoneOffset = 6;
                        break;
                    case "amst": timezoneOffset = -3;
                        break;
                    case "amt": timezoneOffset = -4;
                        break;
                    // Armenia Time
                    case "armt": timezoneOffset = 4;
                        break;
                    // Armenia Summer Time
                    case "armst": timezoneOffset = 5;
                        break;
                    // Armenia Summer Time
                    case "armdt": timezoneOffset = 5;
                        break;
                    case "anat": timezoneOffset = 12;
                        break;
                    case "anast": timezoneOffset = 12;
                        break;
                    case "aqtt": timezoneOffset = 5;
                        break;
                    case "art": timezoneOffset = -3;
                        break;
                    // Arabia/Arab Standard Time
                    case "arst": timezoneOffset = 3;
                        break;
                    case "ast": timezoneOffset = -4;
                        break;
                    case "awst": timezoneOffset = 8;
                        break;
                    case "awdt": timezoneOffset = 9;
                        break;
                    case "azost": timezoneOffset = 0;
                        break;
                    case "azot": timezoneOffset = -1;
                        break;
                    case "azt": timezoneOffset = 4;
                        break;
                    case "azst": timezoneOffset = 5;
                        break;
                }
                break;
            case 'b':
                switch (timezoneString) {
                    case "b": timezoneOffset = 2;
                        break;
                    case "bdt": timezoneOffset = 8;
                        break;
                    case "bnt": timezoneOffset = 8;
                        break;
                    case "biot": timezoneOffset = 6;
                        break;
                    case "bit": timezoneOffset = -12;
                        break;
                    case "bot": timezoneOffset = -4;
                        break;
                    case "brst": timezoneOffset = -2;
                        break;
                    case "brt": timezoneOffset = -3;
                        break;
                    // Bangladesh Standard Time
                    case "bdst": timezoneOffset = 6;
                        break;
                    // Bangladesh Standard Time
                    case "bast": timezoneOffset = 6;
                        break;
                    // Bangladesh Standard Time
                    case "banst": timezoneOffset = 6;
                        break;
                    // Bougainville Standard Time
                    case "bost": timezoneOffset = 11;
                        break;
                    // Bougainville Standard Time
                    case "boust": timezoneOffset = 11;
                        break;
                    // Bougainville Standard Time
                    case "bvst": timezoneOffset = 11;
                        break;
                    case "bst": timezoneOffset = 1;
                        break;
                    case "btt": timezoneOffset = 6;
                        break;
                }
                break;
            case 'c':
                switch (timezoneString) {
                    case "c": timezoneOffset = 3;
                        break;
                    case "cat": timezoneOffset = 2;
                        break;
                    case "cast": timezoneOffset = 8;
                        break;
                    case "cct": timezoneOffset = 6.5;
                        break;
                    case "cdt": timezoneOffset = -5;
                        break;
                    // Cuba Daylight Time
                    case "cudt": timezoneOffset = -5;
                        break;
                    // Cuba Daylight Time
                    case "cubdt": timezoneOffset = -5;
                        break;
                    // Cuba Daylight Time
                    case "cubad": timezoneOffset = -5;
                        break;
                    case "cest": timezoneOffset = 2;
                        break;
                    case "cet": timezoneOffset = 1;
                        break;
                    case "chadt": timezoneOffset = 13.75;
                        break;
                    case "chast": timezoneOffset = 12.75;
                        break;
                    case "chot": timezoneOffset = 8;
                        break;
                    case "chost": timezoneOffset = 9;
                        break;
                    case "chst": timezoneOffset = 10;
                        break;
                    case "chut": timezoneOffset = 10;
                        break;
                    case "cist": timezoneOffset = -8;
                        break;
                    case "cit": timezoneOffset = 8;
                        break;
                    case "ckt": timezoneOffset = -19;
                        break;
                    case "clst": timezoneOffset = -3;
                        break;
                    case "clt": timezoneOffset = -4;
                        break;
                    case "cost": timezoneOffset = -4;
                        break;
                    case "cot": timezoneOffset = -5;
                        break;
                    case "cst": timezoneOffset = -6;
                        break;
                    // Cuba Standard Time
                    case "cust": timezoneOffset = -5;
                        break;
                    // Cuba Standard Time
                    case "cubat": timezoneOffset = -5;
                        break;
                    // Cuba Standard Time
                    case "cubst": timezoneOffset = -5;
                        break;
                    // Cuba Standard Time
                    case "cuba": timezoneOffset = -5;
                        break;
                    // Cuba Standard Time
                    case "cu": timezoneOffset = -5;
                        break;
                    // Cuba Standard Time
                    case "cub": timezoneOffset = -5;
                        break;
                    // China Standard Time
                    case "ct": timezoneOffset = 8;
                        break;
                    // China Standard Time
                    case "chit": timezoneOffset = 8;
                        break;
                    // China Standard Time
                    case "chst": timezoneOffset = 8;
                        break;
                    case "cvt": timezoneOffset = -1;
                        break;
                    case "cwst": timezoneOffset = 8.75;
                        break;
                    case "cxt": timezoneOffset = 7;
                        break;
                }
                break;
            case 'd':
                switch (timezoneString) {
                    case "d": timezoneOffset = 4;
                        break;
                    case "davt": timezoneOffset = 7;
                        break;
                    case "ddut": timezoneOffset = 10;
                        break;
                    case "dft": timezoneOffset = 1;
                        break;
                }
                break;
            case 'e':
                switch (timezoneString) {
                    case "e": timezoneOffset = 5;
                        break;
                    case "easst": timezoneOffset = -5;
                        break;
                    case "east": timezoneOffset = -6;
                        break;
                    case "eat": timezoneOffset = 3;
                        break;
                    // Eastern Caribbean Time
                    case "eact": timezoneOffset = -4;
                        break;
                    // Eastern Caribbean Time
                    case "eastc": timezoneOffset = -4;
                        break;
                    // Eastern Caribbean Time
                    case "ecabt": timezoneOffset = -4;
                        break;
                    // Eastern Caribbean Time
                    case "ecart": timezoneOffset = -4;
                        break;
                    case "ect": timezoneOffset = -5;
                        break;
                    case "edt": timezoneOffset = -4;
                        break;
                    case "eedt": timezoneOffset = 3;
                        break;
                    case "eest": timezoneOffset = 3;
                        break;
                    case "eet": timezoneOffset = 2;
                        break;
                    case "egst": timezoneOffset = 0;
                        break;
                    case "egt": timezoneOffset = -1;
                        break;
                    case "eit": timezoneOffset = 9;
                        break;
                    case "est": timezoneOffset = -5;
                        break;
                }
                break;
            case 'f':
                switch (timezoneString) {
                    case "f": timezoneOffset = 6;
                        break;
                    case "fet": timezoneOffset = 3;
                        break;
                    case "fjt": timezoneOffset = 12;
                        break;
                    case "fjst": timezoneOffset = 13;
                        break;
                    case "fkst": timezoneOffset = -3;
                        break;
                    case "fkt": timezoneOffset = -4;
                        break;
                    case "fnt": timezoneOffset = -2;
                        break;
                }
                break;
            case 'g':
                switch (timezoneString) {
                    case "g": timezoneOffset = 7;
                        break;
                    case "galt": timezoneOffset = -6;
                        break;
                    case "gamt": timezoneOffset = -9;
                        break;
                    case "get": timezoneOffset = 4;
                        break;
                    case "gft": timezoneOffset = -3;
                        break;
                    case "gilt": timezoneOffset = 12;
                        break;
                    case "git": timezoneOffset = -9;
                        break;
                    case "gmt": timezoneOffset = 0;
                        break;
                    // South Georgia and the South Sandwich Islands Time
                    case "gsit": timezoneOffset = -2;
                        break;
                    case "gst": timezoneOffset = 4;
                        break;
                    case "gyt": timezoneOffset = -4;
                        break;
                }
                break;
            case 'h':
                switch (timezoneString) {
                    case "h": timezoneOffset = 8;
                        break;
                    case "hdt": timezoneOffset = -9;
                        break;
                    case "hadt": timezoneOffset = -9;
                        break;
                    case "hast": timezoneOffset = -10;
                        break;
                    case "haec": timezoneOffset = 2;
                        break;
                    case "hst": timezoneOffset = -10;
                        break;
                    case "hkt": timezoneOffset = 8;
                        break;
                    case "hmt": timezoneOffset = 5;
                        break;
                    // *Hovd Summer Time (not used from 2017-present)
                    case "hovst": timezoneOffset = 8;
                        break;
                    case "hovt": timezoneOffset = 7;
                        break;
                }
                break;
            case 'i':
                switch (timezoneString) {
                    case "i": timezoneOffset = 9;
                        break;
                    case "ict": timezoneOffset = 7;
                        break;
                    case "idlw": timezoneOffset = -12;
                        break;
                    case "idt": timezoneOffset = 3;
                        break;
                    case "iot": timezoneOffset = 6;
                        break;
                    case "irdt": timezoneOffset = 4.5;
                        break;
                    case "irkt": timezoneOffset = 8;
                        break;
                    case "irkst": timezoneOffset = 9;
                        break;
                    case "irst": timezoneOffset = 3.5;
                        break;
                    // Indian Standard Time
                    case "ist": timezoneOffset = 5.5;
                        break;
                    // Israel Standard Time
                    case "isrst": timezoneOffset = 2;
                        break;
                    // Israel Standard Time
                    case "isst": timezoneOffset = 2;
                        break;
                }
                break;
            case 'j':
                if (timezoneString == "jst") timezoneOffset = 9;
                break;
            case 'k':
                switch (timezoneString) {
                    case "k": timezoneOffset = 10;
                        break;
                    case "kalt": timezoneOffset = 2;
                        break;
                    case "kgt": timezoneOffset = 6;
                        break;
                    case "kost": timezoneOffset = 11;
                        break;
                    case "krat": timezoneOffset = 7;
                        break;
                    case "krast": timezoneOffset = 8;
                        break;
                    case "kst": timezoneOffset = 9;
                        break;
                }
                break;
            case 'l':
                switch (timezoneString) {
                    case "l": timezoneOffset = 11;
                        break;
                    // Lord Howe standard Time
                    case "lhst": timezoneOffset = 10.5;
                        break;
                    // Lord Howe Summer Time
                    case "lhsst": timezoneOffset = 11;
                        break;
                    // Lord Howe Summer Time
                    case "lhdt": timezoneOffset = 11;
                        break;
                    case "lint": timezoneOffset = 14;
                        break;
                }
                break;
            case 'm':
                switch (timezoneString) {
                    case "m": timezoneOffset = 12;
                        break;
                    case "magt": timezoneOffset = 11;
                        break;
                    case "magst": timezoneOffset = 12;
                        break;
                    case "mart": timezoneOffset = -9.5;
                        break;
                    case "mawt": timezoneOffset = 5;
                        break;
                    case "mdt": timezoneOffset = -6;
                        break;
                    case "met": timezoneOffset = 1;
                        break;
                    case "mest": timezoneOffset = 2;
                        break;
                    case "mht": timezoneOffset = 12;
                        break;
                    case "mist": timezoneOffset = 11;
                        break;
                    case "mit": timezoneOffset = -9.5;
                        break;
                    case "mmt": timezoneOffset = 6.5;
                        break;
                    case "msk": timezoneOffset = 3;
                        break;
                    // Mountain Standard Time
                    case "mst": timezoneOffset = -7;
                        break;
                    case "mut": timezoneOffset = 4;
                        break;
                    case "mvt": timezoneOffset = 5;
                        break;
                    case "myt": timezoneOffset = 8;
                        break;
                }
                break;
            case 'n':
                switch (timezoneString) {
                    case "n": timezoneOffset = -1;
                        break;
                    case "nct": timezoneOffset = 11;
                        break;
                    case "ndt": timezoneOffset = -2.5;
                        break;
                    case "nft": timezoneOffset = 11;
                        break;
                    case "novt": timezoneOffset = 7;
                        break;
                    case "novst": timezoneOffset = 7;
                        break;
                    case "npt": timezoneOffset = 5.75;
                        break;
                    case "nst": timezoneOffset = -3.5;
                        break;
                    case "nt": timezoneOffset = -3.5;
                        break;
                    case "nut": timezoneOffset = -11;
                        break;
                    case "nzdt": timezoneOffset = 13;
                        break;
                    case "nzst": timezoneOffset = 12;
                        break;
                }
                break;
            case 'o':
                switch (timezoneString) {
                    case "o": timezoneOffset = -2;
                        break;
                    case "omst": timezoneOffset = 6;
                        break;
                    case "omsst": timezoneOffset = 7;
                        break;
                    case "orat": timezoneOffset = 5;
                        break;
                }
                break;
            case 'p':
                switch (timezoneString) {
                    case "p": timezoneOffset = -3;
                        break;
                    case "pdt": timezoneOffset = -7;
                        break;
                    case "pet": timezoneOffset = -5;
                        break;
                    case "pett": timezoneOffset = 12;
                        break;
                    case "petst": timezoneOffset = 12;
                        break;
                    case "pgt": timezoneOffset = 10;
                        break;
                    case "phot": timezoneOffset = 13;
                        break;
                    case "pht": timezoneOffset = 8;
                        break;
                    case "pkt": timezoneOffset = 5;
                        break;
                    case "pmdt": timezoneOffset = -2;
                        break;
                    case "pmst": timezoneOffset = -3;
                        break;
                    case "pont": timezoneOffset = 11;
                        break;
                    case "pst": timezoneOffset = -8;
                        break;
                    case "pwt": timezoneOffset = 9;
                        break;
                    case "pyst": timezoneOffset = -3;
                        break;
                    case "pyt": timezoneOffset = -4;
                        break;
                }
                break;
            case 'q':
                switch (timezoneString) {
                    case "q": timezoneOffset = -4;
                        break;
                    case "qyzt": timezoneOffset = 6;
                        break;
                }
                break;
            case 'r':
                switch (timezoneString) {
                    case "r": timezoneOffset = -5;
                        break;
                    case "ret": timezoneOffset = 4;
                        break;
                    case "rott": timezoneOffset = -3;
                        break;
                }
                break;
            case 's':
                switch (timezoneString) {
                    case "s": timezoneOffset = -6;
                        break;
                    case "sakt": timezoneOffset = 11;
                        break;
                    case "samt": timezoneOffset = 4;
                        break;
                    case "sast": timezoneOffset = 2;
                        break;
                    case "sbt": timezoneOffset = 11;
                        break;
                    case "sct": timezoneOffset = 4;
                        break;
                    case "sgt": timezoneOffset = 8;
                        break;
                    case "slt": timezoneOffset = 5.5;
                        break;
                    case "slst": timezoneOffset = 5.5;
                        break;
                    case "sret": timezoneOffset = 11;
                        break;
                    case "srt": timezoneOffset = -3;
                        break;
                    // Samoa Standard Time
                    case "sst": timezoneOffset = -11;
                        break;
                    case "syot": timezoneOffset = 3;
                        break;
                }
                break;
            case 't':
                switch (timezoneString) {
                    case "t": timezoneOffset = -7;
                        break;
                    case "taht": timezoneOffset = -10;
                        break;
                    case "tha": timezoneOffset = 7;
                        break;
                    case "tft": timezoneOffset = 5;
                        break;
                    case "tjt": timezoneOffset = 5;
                        break;
                    case "tkt": timezoneOffset = 13;
                        break;
                    case "tlt": timezoneOffset = 9;
                        break;
                    case "tmt": timezoneOffset = 5;
                        break;
                    case "trt": timezoneOffset = 3;
                        break;
                    case "trut": timezoneOffset = 10;
                        break;
                    case "tot": timezoneOffset = 13;
                        break;
                    case "tvt": timezoneOffset = 12;
                        break;
                }
                break;
            case 'u':
                switch (timezoneString) {
                    case "u": timezoneOffset = -8;
                        break;
                    case "ulast": timezoneOffset = 9;
                        break;
                    case "ulat": timezoneOffset = 8;
                        break;
                    case "utc": timezoneOffset = 0;
                        break;
                    case "uyst": timezoneOffset = -2;
                        break;
                    case "uyt": timezoneOffset = -3;
                        break;
                    case "uzt": timezoneOffset = 5;
                        break;
                }
                break;
            case 'v':
                switch (timezoneString) {
                    case "v": timezoneOffset = -9;
                        break;
                    case "vet": timezoneOffset = -4;
                        break;
                    case "vlat": timezoneOffset = 10;
                        break;
                    case "vlast": timezoneOffset = 11;
                        break;
                    case "volt": timezoneOffset = 4;
                        break;
                    case "vost": timezoneOffset = 6;
                        break;
                    case "vut": timezoneOffset = 11;
                        break;
                }
                break;
            case 'w':
                switch (timezoneString) {
                    case "w": timezoneOffset = -10;
                        break;
                    case "wakt": timezoneOffset = 12;
                        break;
                    case "wast": timezoneOffset = 2;
                        break;
                    case "wat": timezoneOffset = 1;
                        break;
                    case "wdt": timezoneOffset = 9;
                        break;
                    case "wedt": timezoneOffset = 1;
                        break;
                    case "west": timezoneOffset = 1;
                        break;
                    case "wet": timezoneOffset = 0;
                        break;
                    case "wft": timezoneOffset = 12;
                        break;
                    case "wit": timezoneOffset = 7;
                        break;
                    case "wgst": timezoneOffset = -2;
                        break;
                    case "wgt": timezoneOffset = -3;
                        break;
                    case "wib": timezoneOffset = 7;
                        break;
                    case "wit": timezoneOffset = 9;
                        break;
                    case "wita": timezoneOffset = 8;
                        break;
                    case "wst": timezoneOffset = 13;
                        break;
                    case "wt": timezoneOffset = 0;
                        break;
                }
                break;
            case 'x':
                if (timezoneString == "x") timezoneOffset = -11;
                break;
            case 'y':
                switch (timezoneString) {
                    case "y": timezoneOffset = -12;
                        break;
                    case "yakt": timezoneOffset = 9;
                        break;
                    case "yakst": timezoneOffset = 10;
                        break;
                    case "yap": timezoneOffset = 10;
                        break;
                    case "yekt": timezoneOffset = 5;
                        break;
                    case "yekst": timezoneOffset = 6;
                        break;
                }
                break;
        }
        return timezoneOffset;
    },

    getProperTimeAndTimezoneArray: function (dateAndTimeArray, originalArgs) {
        // The last element in the array is expected to represent the timezone
        const timeArrayLength = dateAndTimeArray.length;
        const NUMBER_OF_TIME_ELEMENTS = 5;
        const timezoneString = this.getProperTimezoneString(dateAndTimeArray, originalArgs);
        // console.log({timezoneString});
        dateAndTimeArray[timeArrayLength - 1] = timezoneString;
        const initialTime = this.getMultipleAdjacentArrayElements(dateAndTimeArray, timeArrayLength - NUMBER_OF_TIME_ELEMENTS, NUMBER_OF_TIME_ELEMENTS);
        // console.log({initialTime});
        const splitTimeAndPeriod = this.getSplitTimePeriodAndTimezoneArray(initialTime);
        return splitTimeAndPeriod;
    },

    /**
     * 
     * @param {number} timestamp
     * NOTE: the returned month ranges from 0-11: 0 = January, 1 = February, and so on... 
     */
    getUTCTimeArray: function (timestamp) {
        const date = new Date(timestamp);
        let timeArray = new Array();
        timeArray.push(date.getUTCFullYear());
        timeArray.push(date.getUTCMonth());
        timeArray.push(date.getUTCDate());
        timeArray.push(date.getUTCHours());
        timeArray.push(date.getUTCMinutes());
        timeArray.push(date.getUTCSeconds());
        timeArray.push(date.getUTCMilliseconds());
        return timeArray;
    },

    daylightSavingTimezones: [
        "acst", "aest", "aet", "akst", "amt", "ast", "azot",
        "brt",
        "cst", "cust", "cubst", "cubat", "cuba", "cu", "cub", "cet", "chast", "chot", "clt",
        "east", "est", "eet", "egt", "gmt",
        "hst", "hovt",
        "isrst", "isst", "irst",
        "lhst",
        "mst", "met",
        "nst", "nt", "nzst", "nft",
        "pst", "pmst", "pyt",
        "sst",
        "ulat",
        "wst", "wet",
    ],

    getTimezoneDaylightOffset: function (timezoneString) {
        /**
        * List of Potential Spring Forward Timezones:
        * Australian Central,g
        * Australian Eastern,g
        * Alaska Standard Time,g
        * Amazon Time (Brazil),g
        * Atlantic Standard Time,g
        * Azores Standard Time,g
        * Brasília Time,g
        * Central Standard Time (North America),g
        * Cuba Standard Time,g
        * Central European Time,g
        * Chatham Standard Time,g
        * Choibalsan Standard Time* (not used from 2017-present),g
        * Chile Standard Time,g
        * Colombia Time** (not used from 1993-present), REMOVED
        * Easter Island Standard Time,g
        * Eastern Standard Time (North America),g
        * Eastern European Time,g
        * Eastern Greenland Time,g
        * Falkland Islands Time** (not used from 2010-present), REMOVED
        * Greenwich Mean Time (GMT),g
        * Hawaii–Aleutian Standard Time,g
        * Hovd Time* (not used from 2017-present),g
        * Israel Daylight Time,g
        * Iran Standard Time,g
        * Lord Howe Standard Time LHST: UTC-10:30-11 (NOT FULL HOUR),g
        * Mountain Standard Time (North America),g
        * Middle European Time,g
        * Newfoundland Daylight Time,g
        * New Zealand Standard Time,g
        * Norfolk Island Standard Time,g
        * Pacific Standard Time (North America),g
        * Saint Pierre and Miquelon Standard Time,g
        * Paraguay Time,g
        * Samoa Time,g
        * Ulaanbaatar Standard Time* (not used from 2017-present),g
        * Uruguay Standard Time** (not used from 2015-present), REMOVED
        * West Africa Time** (not used from 2017-present), REMOVED
        * West Samoa Time,g
        * Western European Time,g
        * West Greenland Time,g
        * 
        * **NOTE:** Some European Timezones have stopped DST as of 2019 (Member State dependent)
        */
        if (timezoneString) {
            timezoneString = timezoneString.toLowerCase();
            const summerTimeTimezoneRegex = /\b(acst|aest|aet|akst|amt|ast|azot|brt|cst|cust|cubst|cubat|cuba|cu|cub|cet|chast|chot|clt|east|est|eet|egt|gmt|hst|hovt|isrst|isst|irst|mst|met|nst|nt|nzst|nft|pst|pmst|pyt|sst|ulat|wst|wet|wgt)\b/i;
            const halfHourSummerRegex = /\b(lhst)\b/i;
            if (summerTimeTimezoneRegex.test(timezoneString)) {
                return 1;
            }
            else if (halfHourSummerRegex.test(timezoneString)) {
                return 0.5;
            }
            else {
                return 0;
            }
        }
        else return 0;
    },

    adjustYearDayHourMinuteTest: function (yearDayHourMinuteTest, adjustedArgs) {
        const numOfDef = this.getNumberOfDefinedElements(yearDayHourMinuteTest);
        const timezone = this.getElementFromBack(yearDayHourMinuteTest, 1);
        // If the only two elements is the input string and the allowed text of the timezone
        if (numOfDef === 2 && timezone) return null;
        if (timezone) if (timezone !== this.getElementFromBack(adjustedArgs, 1)) return null;
        return yearDayHourMinuteTest;
    },
    // For timezones, allow user to select from the basic timezones or enter their own (i.e. Newfoundland And Labrador)
    // Use select from list and have the last option open for manual entry!
    // Have a truth value on for if Daylights Saving Time!!!

    // Using Regular Expressions
    // Assumes that the userTimezone is already daylight-saving adjusted
    timeCommandHandlerToUTC: function (args, messageCreatedTimestamp, userTimezone = -4,
        userDaylightSavingSetting = true, isRelativeToNow = true, forceRelativeTime = false,
        isForInterval = false, isForTimeDuration = false) {
        const startTimestamp = Date.now();
        if (!Array.isArray(args) && typeof args === 'string') {
            args = args.toLowerCase().split(/[\s\n]+/);
        }

        if (args[0].toLowerCase() === "now") {
            if (isRelativeToNow) return this.getCurrentUTCTimestampFlooredToSecond() + HOUR_IN_MS * userTimezone;
            else return this.floorToNearestThousand(messageCreatedTimestamp) + HOUR_IN_MS * userTimezone;
        }

        // Convert from space separated arguments to time arguments
        // Step 1: Combine any Dates/Times space separated
        let adjustedArgs = args.join(" ").split(/[\.\s\/\,\-]/).filter(args => args !== "");
        console.log({ args, adjustedArgs });
        const timeArgs = args.join("").toLowerCase();
        console.log({ timeArgs });

        // Relative Time: Past and Future
        const relativeTimeAgoOrFromNow = /(in)?(\d*\.?\d+|\d+\.?\d*)(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|yrs?)(ago|prior|before|fromnow|later(?:today)?|inthefuture)?(?:at)?(?:(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?)?/;
        const relativeTimeTest = relativeTimeAgoOrFromNow.exec(timeArgs);
        console.log({ relativeTimeTest });
        const dayOfWeekRegex = /(in)?((?:\d+)|(?:last|past|next|(?:every)?other|thisweek|this(?:coming)?|(?:this)?coming|following|previous|prior))?((?:yesterday)|(?:yest?)|(?:thedaybefore)|(?:tod(?:ay)?)|(?:tomorrow)|(?:tom)|(?:tmrw?)|(?:mondays?)|(?:mon)|(?:tuesdays?)|(?:tu(?:es?)?)|(?:wednesdays?)|(?:weds?)|(?:thursdays?)|(?:th(?:urs?)?)|(?:fridays?)|(?:f(?:ri?)?)|(?:saturdays?)|(?:sat)|(?:sundays?)|(?:sun?))(ago|prior|before|fromnow|later|inthefuture)?(?:at)?(?:(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?)?/;
        const dayOfWeekTest = dayOfWeekRegex.exec(timeArgs);
        console.log({ dayOfWeekTest });
        // Absolute Time: Past and Future
        const absoluteTimeRegex = /(\d{1,2})[\/\.\,\-](\d{1,2})(?:[\/\.\,\-](\d{1,4}))?(?:at)?(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))?(pm?|am?)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?/;
        const absoluteTimeTest = absoluteTimeRegex.exec(timeArgs);
        console.log({ absoluteTimeTest });
        // Force the user to separate the date and year (if there is a year - this becomes an indicator for separation)
        const monthTimeRegex = /((?:january)|(?:jan?)|(?:february)|(?:feb?)|f|(?:march)|(?:mar)|(?:april)|(?:apr?)|(?:may)|(?:june?)|(?:july?)|(?:august)|(?:aug?)|(?:september)|(?:sept?)|(?:october)|(?:oct)|(?:november)|(?:nov?)|(?:december)|(?:dec?))[\.\,]?(\d{1}(?:\d{1})?)(?:[\/\.\,\-](\d{1,4}))?(?:at)?(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))?(pm?|am?)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?/;
        const monthTimeTest = monthTimeRegex.exec(timeArgs);
        console.log({ monthTimeTest });
        const yearDayHourMinuteRegex = /(in)?(?:((?:\d*\.?\d+|\d+\.?\d*)y))?\:?(?:((?:\d*\.?\d+|\d+\.?\d*)d))?\:?(?:((?:\d*\.?\d+|\d+\.?\d*)h))?\:?(?:((?:\d*\.?\d+|\d+\.?\d*)m))?\:?(?:((?:\d*\.?\d+|\d+\.?\d*)s))?(?<!\:+|^$)(ago|prior|before|fromnow|later(?:today)?|inthefuture)?(?:at|in|with)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?/;
        const yearDayHourMinuteTest = this.adjustYearDayHourMinuteTest(yearDayHourMinuteRegex.exec(timeArgs), adjustedArgs);
        console.log({ yearDayHourMinuteTest });

        // 1 - Relative Time; 2 - Day Of Week;
        // 3 - Absolute Time; 4 - Month And Time;
        // 5 - Year-Day-Hour-Minute;
        const decision = this.getTimeTestChoice(relativeTimeTest, dayOfWeekTest, absoluteTimeTest, monthTimeTest, yearDayHourMinuteTest, forceRelativeTime);
        console.log({ decision });
        // 0 - All choices we're null or insufficient/not chosen.
        if (!decision) return false;
        else {
            if (isForTimeDuration && decision !== 1 && decision !== 5) return false;
            var timestampOut, timezoneString;
            switch (decision) {
                case 1:
                    if (relativeTimeTest) {
                        console.log("Relative Time test...");
                        // !! To Extract Truthy/Falsey value from each argument
                        // Adjust the timezone as the "m" in am or pm will be greedy
                        const properTimeArray = this.getProperTimeAndTimezoneArray(relativeTimeTest, adjustedArgs);
                        const [properHours, properMinutes, , timezone] = properTimeArray;
                        timezoneString = timezone;
                        console.log({ properTimeArray });
                        const timeScale = relativeTimeTest[3];
                        const argsHaveDefinedTime = (!!(properHours) || !!(properMinutes));
                        const isLongTimeScale = this.isLongTimeScale(timeScale);
                        // Args with no defined time AND Args with defined time having a whole number first argument (i.e. 2 days)
                        let futureTruePastFalse = this.futureTruePastFalseRegexTest(relativeTimeTest[4]);
                        if (futureTruePastFalse === undefined) {
                            if (relativeTimeTest[1]) futureTruePastFalse = true;
                            else return false;
                        }
                        // If Long Relative Time Scale and a Defined Time: Receive Whole Number First Argument
                        let numberOfTimeScales = argsHaveDefinedTime && isLongTimeScale ? parseInt(relativeTimeTest[2]) : parseFloat(relativeTimeTest[2]);
                        if (futureTruePastFalse === false) {
                            numberOfTimeScales = -numberOfTimeScales;
                        }
                        const timeScaleToMultiply = this.getTimeScaleToMultiplyInMs(timeScale);

                        let RELATIVE_ADJUSTMENT = Date.now() - startTimestamp;
                        if (isRelativeToNow) messageCreatedTimestamp = Date.now() + RELATIVE_ADJUSTMENT;

                        const timeArray = this.getUTCTimeArray(messageCreatedTimestamp + HOUR_IN_MS * userTimezone);
                        let [year, month, day, hour, minute, second, millisecond] = timeArray;
                        console.log({ year, month, day, hour, minute, second, millisecond });
                        const militaryTimeString = argsHaveDefinedTime ? this.getMilitaryTimeStringFromProperTimeArray(properTimeArray) : "00:00";
                        console.log({ militaryTimeString });
                        const timeAdjustment = this.getTimePastMidnightInMsFromMilitaryTime(militaryTimeString);
                        console.log({ timeAdjustment });

                        switch (timeScaleToMultiply) {
                            case YEAR_IN_MS: year += numberOfTimeScales;
                                break;
                            case MONTH_IN_MS: month += numberOfTimeScales;
                                break;
                            case WEEK_IN_MS: day += 7 * numberOfTimeScales;
                                break;
                            case DAY_IN_MS: day += numberOfTimeScales;
                                break;
                            case HOUR_IN_MS: hour += numberOfTimeScales;
                                break;
                            case MINUTE_IN_MS: minute += numberOfTimeScales;
                                break;
                            case SECOND_IN_MS: second += numberOfTimeScales;
                                break;
                        }
                        if (argsHaveDefinedTime && isLongTimeScale) {
                            const splitTimeAdjustment = this.getHoursMinutesSecondsMillisecondsArray(timeAdjustment);
                            console.log({ splitTimeAdjustment });
                            [hour, minute, second, millisecond] = splitTimeAdjustment;
                        }
                        console.log({ year, month, day, hour, minute, second, millisecond });
                        timestampOut = new Date(year, month, day, hour, minute, second, millisecond).getTime();
                        // if (timestampOut < 0 && !argsHaveDefinedTime) {
                        //     timestampOut -= HOUR_IN_MS;
                        // }
                        console.log({ timestampOut });
                    }
                    break;
                case 2:
                    if (dayOfWeekTest) {
                        console.log("Day of Week test...");
                        const numberOfTimeScales = this.getRelativeDayTimeScale(dayOfWeekTest, userTimezone, isForInterval);
                        if (numberOfTimeScales === false) return false;
                        console.log({ numberOfTimeScales });
                        // const timeExpression = dayOfWeekTest.slice(5);
                        const timeExpression = this.getProperTimeAndTimezoneArray(dayOfWeekTest, adjustedArgs);
                        const [, , , , timezone] = timeExpression;
                        timezoneString = timezone;
                        console.log({ timeExpression, timezoneString });
                        const timeArray = this.getUTCTimeArray(messageCreatedTimestamp + HOUR_IN_MS * userTimezone);
                        let [year, month, day, hour, minute, seconds, milliseconds] = timeArray;
                        day += numberOfTimeScales;
                        // If no time arguments:
                        if (!this.getNumberOfDefinedElements(timeExpression)) {
                            timestampOut = new Date(year, month, day, hour, minute, seconds, milliseconds).getTime();
                        }
                        else {
                            const militaryTimeString = this.getMilitaryTimeStringFromProperTimeArray(timeExpression);
                            console.log({ militaryTimeString });
                            if (!militaryTimeString) return false;
                            const hoursAndMinutes = this.getHourAndMinuteSeparatedArrayFromMilitaryTime(militaryTimeString);
                            hour = hoursAndMinutes[0];
                            minute = hoursAndMinutes[1];
                            console.log({ year, month, day, hour, minute });
                            timestampOut = new Date(year, month, day, hour, minute).getTime();
                        }
                        console.log({ timestampOut });
                    }
                    break;
                case 3:
                    if (absoluteTimeRegex) {
                        console.log("Absolute Time test...");
                        if (adjustedArgs[0].toLowerCase() === "in") {
                            adjustedArgs = adjustedArgs.slice(1, adjustedArgs.length);
                        }
                        console.log({ adjustedArgs });
                        const properDateTimeArray = this.getProperDateAndTimeArray(absoluteTimeTest, adjustedArgs, userTimezone, 1);
                        console.log({ properDateTimeArray });
                        if (!properDateTimeArray) return false;

                        // Now deal with the validity of the given date and time
                        const yearMonthDay = this.getValidYearMonthDay(properDateTimeArray[0], absoluteTimeTest[1], properDateTimeArray[1], userTimezone);
                        console.log({ yearMonthDay });
                        if (!yearMonthDay) return false;
                        const [year, month, day] = yearMonthDay;
                        const militaryTimeString = this.getMilitaryTimeStringFromProperTimeArray(properDateTimeArray.slice(2));
                        console.log({ militaryTimeString });
                        if (!militaryTimeString) return false;
                        const hoursAndMinutes = this.getHourAndMinuteSeparatedArrayFromMilitaryTime(militaryTimeString);
                        const [hour, minute] = hoursAndMinutes;
                        console.log({ year, month, day, hour, minute });
                        timestampOut = new Date(year, month, day, hour, minute).getTime();
                        console.log({ timestampOut });
                    }
                    break;
                case 4:
                    if (monthTimeTest) {
                        // If the first element is defined: (i.e. the month)
                        if (monthTimeTest[1]) {
                            console.log("Month in Text and Absolute Time test...");
                            if (adjustedArgs[0].toLowerCase() === "in") {
                                adjustedArgs = adjustedArgs.slice(1, adjustedArgs.length);
                            }
                            console.log({ adjustedArgs });
                            const properDateTimeArray = this.getProperDateAndTimeArray(monthTimeTest, adjustedArgs, userTimezone, 1);
                            console.log({ properDateTimeArray });
                            if (!properDateTimeArray) return false;

                            // Now deal with the validity of the given date and time
                            const yearMonthDay = this.getValidYearMonthDay(properDateTimeArray[0], monthTimeTest[1], properDateTimeArray[1], userTimezone);
                            console.log({ yearMonthDay });
                            if (!yearMonthDay) return false;
                            const [year, month, day] = yearMonthDay;
                            const militaryTimeString = this.getMilitaryTimeStringFromProperTimeArray(properDateTimeArray.slice(2));
                            console.log({ militaryTimeString });
                            if (!militaryTimeString) return false;
                            const hoursAndMinutes = this.getHourAndMinuteSeparatedArrayFromMilitaryTime(militaryTimeString);
                            let hour = hoursAndMinutes[0];
                            let minute = hoursAndMinutes[1];
                            console.log({ year, month, day, hour, minute });
                            timestampOut = new Date(year, month, day, hour, minute).getTime();
                            console.log({ timestampOut });
                        }
                    }
                    break;
                case 5:
                    if (yearDayHourMinuteTest) {
                        let futureTruePastFalse = this.futureTruePastFalseRegexTest(yearDayHourMinuteTest[7]);
                        if (futureTruePastFalse === undefined) {
                            if (yearDayHourMinuteTest[1]) futureTruePastFalse = true;
                            else return false;
                        }
                        const futurePastMultiple = futureTruePastFalse ? 1 : -1;

                        let RELATIVE_ADJUSTMENT = Date.now() - startTimestamp;
                        if (isRelativeToNow) messageCreatedTimestamp = Date.now() + RELATIVE_ADJUSTMENT;

                        let timeArray = this.getUTCTimeArray(messageCreatedTimestamp + HOUR_IN_MS * userTimezone);
                        let [year, month, day, hour, minute, second,] = timeArray;
                        var noEntries = true;
                        for (i = 2; i <= 6; i++) {
                            if (yearDayHourMinuteTest[i]) {
                                noEntries = false;
                                // Extract y-h-d-m-s
                                const timeScale = /(\d*\.?\d+|\d+\.?\d*)(\w)/.exec(yearDayHourMinuteTest[i]);
                                console.log({ timeScale });
                                if (timeScale) {
                                    const numberOfPeriods = timeScale[1];
                                    const period = timeScale[2];
                                    switch (period) {
                                        case 'y': year += numberOfPeriods * futurePastMultiple;
                                            break;
                                        case 'd': day += numberOfPeriods * futurePastMultiple;
                                            break;
                                        case 'h': hour += numberOfPeriods * futurePastMultiple;
                                            break;
                                        case 'm': minute += numberOfPeriods * futurePastMultiple;
                                            break;
                                        case 's': second += numberOfPeriods * futurePastMultiple;
                                            break;
                                    }
                                }
                            }
                        }
                        if (noEntries) return false;
                        timestampOut = new Date(year, month, day, hour, minute, second).getTime();
                        timezoneString = yearDayHourMinuteTest[8];
                    }
                    break;
            }
        }

        console.log({ timestampOut, timezoneString, userTimezone, userDaylightSavingSetting });
        if (timestampOut === undefined || isNaN(timestampOut)) timestampOut === false;
        // Round down to the nearest second
        else timestampOut = this.floorToNearestThousand(timestampOut);
        return timestampOut;
    },

    floorToNearestThousand: function (number) {
        return Math.floor(number / 1000) * 1000;
    },

    getCurrentUTCTimestampFlooredToSecond: function () {
        return this.floorToNearestThousand(Date.now());
    },

    /**
     * 
     * @param {Number} year 
     * @param {Number | string} month 
     * @param {Number} day 
     * @param {Number} timezoneOffset
     */
    getValidYearMonthDay: function (year, month, day, timezoneOffset) {
        year = parseInt(year);
        if (year < 0) return false;
        if (year <= 99) {
            const currentMillennium = Math.floor((new Date(Date.now() + timezoneOffset * HOUR_IN_MS).getUTCFullYear()) / 1000) * 1000;
            year += currentMillennium;
        }
        console.log({ year });
        day = parseInt(day);
        if (day <= 0) return false;
        month = isNaN(month) ? this.getUTCMonthFromMonthString(month) : parseInt(month) - 1;
        if (!month) return false;
        if (!this.isValidDate(day, month, year)) return false;
        return [year, month, day];
    },

    getStartOfWeekTimestamp: function (timestamp, timezoneOffset,
        daylightSaving, mondayStart = false) {
        let weekOfDate = this.timeCommandHandlerToUTC(
            `this week ${mondayStart ? "monday" : "sunday"}`, timestamp,
            timezoneOffset, daylightSaving, false);
        if (weekOfDate) {
            weekOfDate -= timezoneOffset * HOUR_IN_MS;
        }
        return weekOfDate;
    },

    /**
     * 
     * @param {RegExpExecArray} relativeTimeTest 1
     * @param {RegExpExecArray} dayOfWeekTest 2
     * @param {RegExpExecArray} absoluteTimeTest 3 
     * @param {RegExpExecArray} monthTimeTest 4
     * @param {RegExpExecArray} yearDayHourMinuteTest 5
     * Will return 0 if all are null.
     */
    getTimeTestChoice: function (relativeTimeTest, dayOfWeekTest, absoluteTimeTest,
        monthTimeTest, yearDayHourMinuteTest, forceRelativeTime = false) {
        // Loop through each array, check if it has enough elements!
        let choice = 0;
        var relativeTimeElements, dayOfWeekElements, absoluteTimeElements, monthTimeElements;
        if (relativeTimeTest) {
            relativeTimeElements = this.getNumberOfDefinedElements(relativeTimeTest);
            if (relativeTimeElements > 3) {
                choice = 1;
            }
        }
        if (dayOfWeekTest) {
            dayOfWeekElements = this.getNumberOfDefinedElements(dayOfWeekTest);
            if (dayOfWeekElements >= 2) {
                if (relativeTimeElements) {
                    if (dayOfWeekElements >= relativeTimeElements) {
                        if (dayOfWeekTest[3] && relativeTimeTest[3]) {
                            // When comparing the Monday and Month
                            if (dayOfWeekTest[3].length > relativeTimeTest[3]) {
                                choice = 2;
                            }
                        }
                        else choice = 2;
                    }
                }
                else choice = 2;
            }
        }
        if (absoluteTimeTest && !forceRelativeTime) {
            absoluteTimeElements = this.getNumberOfDefinedElements(absoluteTimeTest)
            if (absoluteTimeElements >= 3) {
                choice = 3;
            }
        }
        if (monthTimeTest && !forceRelativeTime) {
            monthTimeElements = this.getNumberOfDefinedElements(monthTimeTest);
            if (monthTimeElements >= 3) {
                if (absoluteTimeElements) {
                    if (monthTimeElements >= absoluteTimeElements) {
                        choice = 4;
                    }
                }
                else {
                    choice = 4;
                }
            }
        }
        if (yearDayHourMinuteTest) {
            const yearDayHourMinuteElements = this.getNumberOfDefinedElements(yearDayHourMinuteTest);
            if (yearDayHourMinuteElements >= 2 && yearDayHourMinuteTest[0] !== "in") {
                if (relativeTimeElements) {
                    if (relativeTimeElements < 4) {
                        choice = 5;
                    }
                }
                else if (dayOfWeekElements) {
                    if (dayOfWeekElements < 4 && (yearDayHourMinuteTest[2]
                        || yearDayHourMinuteTest[3] || yearDayHourMinuteTest[4]
                        || yearDayHourMinuteTest[5] || yearDayHourMinuteTest[6])) {
                        choice = 5;
                    }
                }
                else {
                    choice = 5;
                }
            }
        }
        return choice;
    },

    getNumberOfDefinedElements: function (array) {
        let elementCount = 0;
        array.forEach((element) => {
            if (element !== undefined) {
                elementCount++
            }
        });
        return elementCount;
    },

    /**
     * 
     * @param {number} day 
     * @param {number} month Javascript month 0-11: 0 = January, 1 = February,...
     * @param {number} year 
     */
    isValidDate: function (day, month, year) {
        // Month with 31 days: January, March, May, July, August, October, December
        const thirtyOneMonths = [0, 2, 4, 6, 7, 9, 11];
        const thirtyMonths = [3, 5, 8, 10];
        if (thirtyOneMonths.includes(month)) {
            if (day > 31) return false;
        }
        // Month with 30 days: April, June, September, November
        else if (thirtyMonths.includes(month)) {
            if (day > 30) return false;
        }
        // February, check for leap year for valid date
        else if (month === 1) {
            if (this.isLeapYear(year)) {
                if (day > 29) return false;
            }
            else {
                if (day > 28) return false;
            }
        }
        return true;
    },

    isLeapYear: function (year) {
        if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) return true;
        else false;
    },

    getDayOfYear: function (timestamp) {
        const date = new Date(timestamp);
        var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        var month = date.getUTCMonth();
        var day = date.getUTCDate();
        var dayOfYear = dayCount[month] + day;
        if (month > 1 && this.isLeapYear(date.getUTCFullYear())) dayOfYear++;
        return dayOfYear;
    },

    getDayFromStartOfMonthAndCreatedAt: function (timestamp, startTimestamp = false) {
        const currentDate = new Date(timestamp);
        if (startTimestamp) {
            const startDate = new Date(startTimestamp);
            if (startDate.getUTCFullYear() === currentDate.getUTCFullYear()
                && startDate.getUTCMonth() === currentDate.getUTCMonth()) {
                return currentDate.getUTCDate() + 1 - startDate.getUTCDate();
            }
        }
        return currentDate.getUTCDate();
    },

    getUTCMonthFromMonthString: function (monthString) {
        monthString = monthString.toLowerCase();
        var month;
        // First Letter Switch
        switch (monthString[0]) {
            case 'a':
                if (/(?:april)|(?:apr?)/.test(monthString)) month = 3;
                else if (/(?:august)|(?:aug?)/.test(monthString)) month = 7;
                break;
            case 'd':
                if (/(?:december)|(?:dec?)/.test(monthString)) month = 11;
                break;
            case 'f':
                if (/(?:february)|(?:feb?)|f/.test(monthString)) month = 1;
                break;
            case 'j':
                if (/(?:january)|(?:jan?)/.test(monthString)) month = 0;
                else if (/(?:june?)/.test(monthString)) month = 5;
                else if (/(?:july?)/.test(monthString)) month = 6;
                break;
            case 'm':
                if (/(?:march)|(?:mar)/.test(monthString)) month = 2;
                else if (/(?:may)/.test(monthString)) month = 4;
                break;
            case 'n':
                if (/(?:november)|(?:nov?)/.test(monthString)) month = 10;
                break;
            case 'o':
                if (/(?:october)|(?:oct)/.test(monthString)) month = 9;
                break;
            case 's':
                if (/(?:september)|(?:sept?)/.test(monthString)) month = 8;
                break;
        }
        return month;
    },

    getRelativeDayTimeScale: function (relativeTimeExpressionArray, timezone, isForInterval = false) {
        var numberOfTimeScales;
        let relativeTime = /((?:yesterday)|(?:yest?)|(?:thedaybefore)|(?:tod(?:ay)?)|(?:tomorrow)|(?:tom)|(?:tmrw?))/.exec(relativeTimeExpressionArray[3]);
        relativeTime = relativeTime ? relativeTime[1] : undefined;
        let day = /((?:mondays?)|(?:mon)|(?:tuesdays?)|(?:tu(?:es?)?)|(?:wednesdays?)|(?:weds?)|(?:thursdays?)|(?:th(?:urs?)?)|(?:fridays?)|(?:f(?:ri?)?)|(?:saturdays?)|(?:sat)|(?:sundays?)|(?:sun?))/.exec(relativeTimeExpressionArray[3]);
        day = day ? day[1] : undefined;
        console.log({ relativeTimeExpressionArray, day, relativeTime });
        // Assert Mutual Exclusive Expressions
        if (!relativeTime && !day) return false;
        if (relativeTime) {
            if (/(?:yesterday)|(?:yest?)|(?:thedaybefore)/.test(relativeTime)) {
                numberOfTimeScales = -1;
            }
            else if (/(?:tod(?:ay)?)/.test(relativeTime)) {
                numberOfTimeScales = 0;
            }
            // Tomorrow (assumed)
            else {
                numberOfTimeScales = 1;
            }
            console.log({ numberOfTimeScales });
            return numberOfTimeScales;
        }
        else if (day) {
            let isThis = false;
            let relativeDay = /((?:\d+)|(?:last|past|next|(every)?other|thisweek|this(?:coming)?|(?:this)?coming|following|previous|prior))/.exec(relativeTimeExpressionArray[2]);
            let isDigit = /(?:\d+)/.test(relativeDay);
            if (!relativeDay) {
                if (isForInterval) relativeDay = "thiscoming";
                else relativeDay = "this";
            }
            else relativeDay = relativeDay[1];

            if (isDigit) {
                var futureTruePastFalse;
                if (!relativeTimeExpressionArray[4]) {
                    // In...
                    if (relativeTimeExpressionArray[1]) {
                        futureTruePastFalse = true;
                    }
                    else return false;
                }
                else futureTruePastFalse = /(fromnow|later|inthefuture)/.test(relativeTimeExpressionArray[4]);
                console.log({ futureTruePastFalse });
                numberOfTimeScales = parseInt(relativeDay) - 1;
            }
            else if (/last|past|previous|prior/.test(relativeDay)) {
                numberOfTimeScales = -1;
            }
            else if (/next|following/.test(relativeDay)) {
                numberOfTimeScales = 1;
            }
            else if (/(every)?other/.test(relativeDay)) {
                numberOfTimeScales = 2;
            }
            else if (/thiscoming|coming/.test(relativeDay)) {
                numberOfTimeScales = 0;
            }
            else if (/this/.test(relativeDay)) {
                numberOfTimeScales = 0;
                isThis = true;
            }
            else if (!/thisweek/.test(relativeDay)) {
                return false;
            }

            var targetDayOfWeek;
            // First Letter Switch
            switch (day[0]) {
                case 'f':
                    if (/(?:fridays?)|(?:f(?:ri?)?)/.test(day)) targetDayOfWeek = 5;
                    break;
                case 'm':
                    if (/(?:mondays?)|(?:mon)/.test(day)) targetDayOfWeek = 1;
                    break;
                case 's':
                    if (/(?:saturdays?)|(?:sat)/.test(day)) targetDayOfWeek = 6;
                    else if (/(?:sundays?)|(?:sun?)/.test(day)) targetDayOfWeek = 0;
                    break;
                case 't':
                    if (/(?:tuesdays?)|(?:tu(?:es?)?)/.test(day)) targetDayOfWeek = 2;
                    else if (/(?:thursdays?)|(?:th(?:urs?)?)/.test(day)) targetDayOfWeek = 4;
                    break;
                case 'w':
                    if (/(?:wednesdays?)|(?:weds?)/.test(day)) targetDayOfWeek = 3;
                    break;
            }
            if (!targetDayOfWeek && targetDayOfWeek !== 0) return false;

            // Get how far the relative day of week is from the current day of the week
            let currentDate = new Date(Date.now() + timezone * HOUR_IN_MS);
            let currentDayOfWeek = currentDate.getUTCDay();
            const isPastDay = targetDayOfWeek < currentDayOfWeek;
            if (/thisweek/.test(relativeDay)) {
                isThis = true;
                if (isPastDay) numberOfTimeScales = -1;
                else numberOfTimeScales = 0;
            }
            console.log({ isThis, numberOfTimeScales, currentDate, currentDayOfWeek, targetDayOfWeek });


            // Convention: Traverse Forward along the Week, until the 
            // Target Day of Week is found
            var numberOfDaysForward = 0;
            while (true) {
                console.log({ numberOfDaysForward, currentDayOfWeek, targetDayOfWeek })
                if (targetDayOfWeek !== currentDayOfWeek) {
                    numberOfDaysForward++;
                    currentDayOfWeek = (currentDayOfWeek + 1) % 7;
                }
                else {
                    if (numberOfDaysForward === 0 && numberOfTimeScales === 0) {
                        numberOfDaysForward = isThis ? 0 : 7;
                        break;
                    }
                    else break;
                }
            }
            if (numberOfTimeScales === 1 && isPastDay && !isDigit) numberOfTimeScales = 0;
            console.log({ numberOfDaysForward, numberOfTimeScales });
            if (isDigit) {
                if (!futureTruePastFalse) {
                    numberOfTimeScales = -numberOfTimeScales - 1;
                }
            }
            numberOfTimeScales = (numberOfTimeScales * 7) + numberOfDaysForward;
            console.log({ numberOfTimeScales });
            return numberOfTimeScales;
        }
        else return false;

    },

    /**
     * 
     * @param {number} milliseconds Give the a time in milliseconds to be split into hours, minutes, seconds, and remaining milliseconds
     */
    getHoursMinutesSecondsMillisecondsArray: function (milliseconds) {
        const hours = Math.floor(milliseconds / HOUR_IN_MS);
        const minutes = Math.floor((milliseconds - HOUR_IN_MS * hours) / MINUTE_IN_MS);
        const seconds = Math.floor((milliseconds - HOUR_IN_MS * hours - MINUTE_IN_MS * minutes) / SECOND_IN_MS);
        const ms = milliseconds - HOUR_IN_MS * hours - MINUTE_IN_MS * minutes - SECOND_IN_MS * seconds;
        return [hours, minutes, seconds, ms];
    },

    timestampToDateString: function (timestamp, showTime = true, showDayOfWeek = true, monthInText = true) {
        if (timestamp === undefined || timestamp === null || timestamp === false) return null;
        const date = new Date(timestamp);
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        var dateString;
        if (monthInText) dateString = `${this.months[month - 1]} ${day}, ${year}`;
        else dateString = `${month}/${day}/${year}`;
        var dayOfWeekString;
        if (showDayOfWeek) {
            const dayOfWeek = date.getUTCDay();
            dayOfWeekString = `${this.daysOfWeek[dayOfWeek]}, `;
        }
        var timeString;
        if (showTime) {
            const standardTime = this.militaryTimeHoursToStandardTimeHoursArray(date.getUTCHours());
            const hours = standardTime[0];
            const amPmString = standardTime[1];
            const minutes = this.getValidMinutesString(date.getUTCMinutes());
            const seconds = this.getValidMinutesString(date.getUTCSeconds());
            timeString = `, ${hours}:${minutes}:${seconds} ${amPmString}`;
        }
        return `${dayOfWeekString || ""}${dateString || ""}${timeString || ""}`;
    },

    /**
     * 
     * @param {number} yearA 
     * @param {number} yearB 
     */
    numberOfLeapYearsInBetween: function (yearA, yearB) {
        const smallerYear = yearA < yearB ? yearA : yearB;
        const largerYear = yearB === smallerYear ? yearA : yearB;
        return this.numberOfLeapYearsBefore(largerYear) - this.numberOfLeapYearsBefore(smallerYear);
    },

    /**
     * 
     * @param {number} year 
     */
    numberOfLeapYearsBefore: function (year) {
        year = parseInt(year);
        year--;
        return parseInt((year / 4) - (year / 100) + (year / 400));
    },

    /**
     * Includes the last day, thus two dates one week apart will return 7, and 0 days apart will return 0
     * @param {Number} timestampA 
     * @param {Number} timestampB 
     */
    getDaysInBetweenTimestamps: function (timestampA, timestampB) {
        const timeDifference = Math.abs(timestampB - timestampA);
        const daysDifference = Math.floor(timeDifference / DAY_IN_MS);
        return daysDifference;
    },

    // /**
    //  * 
    //  * @param {number} timestamp timestamp to adjust
    //  * @param {number} userDefaultTimezone User Timezone UTC Offset
    //  * @param {boolean} userDaylightSavingSetting 
    //  * @param {number|string} timezone give timezone in string form or UTC integer offset form
    //  */
    // getUTCOffsetAdjustedTimestamp: function (timestamp, userDefaultTimezone, userDaylightSavingSetting, timezone = undefined) {
    //     if (timestamp === undefined || timestamp === null) return undefined;
    //     var timezoneOffset;
    //     timezoneOffset = timezone ? this.getTimezoneOffset(timezone) : userDefaultTimezone;
    //     console.log({ timestamp, timezoneOffset });
    //     timestamp += (timezoneOffset * HOUR_IN_MS);
    //     if (this.isDaylightSavingTime(timestamp, userDaylightSavingSetting)) {
    //         const daylightSavingAdjustment = this.getTimezoneDaylightOffset(timezone);
    //         console.log({ daylightSavingAdjustment });
    //         timestamp += (HOUR_IN_MS * daylightSavingAdjustment);
    //     }
    //     return timestamp;
    // },

    militaryTimeHoursToStandardTimeHoursArray: function (hours) {
        hours = parseInt(hours);
        var amPmString;
        if (hours < 0) return false;
        if (hours >= 12) {
            amPmString = "PM";
            hours -= 12;
        }
        else {
            amPmString = "AM";
        }
        if (hours == 0) {
            hours = 12;
        }
        if (hours < 10) {
            hours = `0${hours}`;
            // hours = hours.replace(/(\d{1})/, "0$1");
        }
        return [hours, amPmString];
    },

    standardTimeHoursToMilitaryTimeHoursString: function (hours, amPmString) {
        hours = parseInt(hours);
        if (hours < 0) return false;
        if (!amPmString) {
            if (hours >= 24) return false;
        }
        else {
            if (hours > 12 || hours == 0) return false;
            if (hours == 12) {
                hours = 0;
            }
            if (/pm?/.test(amPmString)) {
                hours += 12;
            }
        }
        if (hours < 10) {
            hours = `0${hours}`;
            // hours = hours.replace(/(\d{1})/, "0$1");
        }
        return hours;
    },

    getValidMinutesString: function (minutes) {
        minutes = parseInt(minutes);
        if (minutes >= 60) return false;
        else if (minutes < 10) {
            return `0${minutes}`;
            // return minutes.replace(/(\d{1})/, "0$1");
        }
        else {
            return minutes;
        }
    },

    getStandardTimeRegex: function () {
        return /((?:1[0-2])|(?:0?[0-9]))([0-5][0-9])/;
    },

    getHourAndMinuteSeparatedArrayFromStandardTime: function (standardTimeString) {
        const hoursAndMinutes = this.getStandardTimeRegex().exec(standardTimeString);
        hour = parseInt(hoursAndMinutes[1]);
        minute = parseInt(hoursAndMinutes[2]);
        return [hour, minute];
    },

    getHourAndMinuteSeparatedArrayFromMilitaryTime: function (militaryTimeString) {
        const hoursAndMinutes = this.getMilitaryTimeRegex().exec(militaryTimeString);
        hour = parseInt(hoursAndMinutes[1]);
        minute = parseInt(hoursAndMinutes[2]);
        return [hour, minute];
    },

    getMilitaryTimeStringFromProperTimeArray: function (splitTime) {
        const [hours, minutes, amPmString, timezoneOffset] = splitTime;
        console.log({ splitTime });
        // !! To Extract Truthy/Falsey value from each argument,
        // and another ! to negate - time is in hours only when
        // the second argument in undefined
        const timeIsInHoursOnly = !!!(minutes);
        const hoursOut = this.standardTimeHoursToMilitaryTimeHoursString(hours, amPmString);
        const minsOut = this.getValidMinutesString(minutes);
        console.log({ timeIsInHoursOnly, splitTime });
        var extractedTimeString;
        if (timeIsInHoursOnly) {
            extractedTimeString = `${hoursOut}:00`;
        }
        else {
            extractedTimeString = `${hoursOut}:${minsOut}`;
        }
        console.log({ extractedTimeString });
        if (this.getMilitaryTimeRegex().test(extractedTimeString)) {
            return extractedTimeString;
        }
        else {
            return false;
        }
    },

    getMilitaryTimeRegex: function () {
        return /((?:[0-1][0-9])|(?:2[0-3]))\:([0-5][0-9])/;
    },

    getMilitaryTimeHoursAndMinsArray: function (militaryTimeString) {
        militaryTime = this.getMilitaryTimeRegex().exec(militaryTimeString);
        return militaryTime;
    },

    getElementFromBack: function (array, index) {
        return array[array.length - index];
    },

    futureTruePastFalseRegexTest: function (testArgument) {
        var futureTruePastFalse;
        if (/(ago|prior|before)/.test(testArgument)) {
            futureTruePastFalse = false;
        }
        else if (/(fromnow|later|inthefuture)/.test(testArgument)) {
            futureTruePastFalse = true;
        }
        return futureTruePastFalse;
    },

    getTimeScaleToMultiplyInMs: function (relativeTimeScale) {
        var timeScaleToMultiply;
        relativeTimeScale = relativeTimeScale.toLowerCase();
        // First Letter Switch
        switch (relativeTimeScale[0]) {
            case 's':
                if (/(secs?|seconds?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = SECOND_IN_MS;
                }
                break;
            case 'm':
                if (/(mins?|minutes?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = MINUTE_IN_MS;
                }
                else if (/(months?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = MONTH_IN_MS;
                }
                break;
            case 'h':
                if (/(hours?|hrs?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = HOUR_IN_MS;
                }
                break;
            case 'd':
                if (/(days?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = DAY_IN_MS;
                }
                break;
            case 'w':
                if (/(weeks?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = WEEK_IN_MS;
                }
                break;
            case 'y':
                if (/(years?|yrs?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = YEAR_IN_MS;
                }
                break;
        }
        return timeScaleToMultiply;
    },

    isLongTimeScale: function (relativeTimeScale) {
        const longTimeScalesRegex = /(days?|weeks?|months?|years?|yrs?)/;
        return longTimeScalesRegex.test(relativeTimeScale);
    },

    // Assuming the militaryTimeString is correctly formatted.
    getTimePastMidnightInMsFromMilitaryTime: function (militaryTimeString) {
        var timePastMidnight = 0;
        const timeArray = this.getMilitaryTimeHoursAndMinsArray(militaryTimeString);
        timePastMidnight += parseInt(timeArray[1]) * HOUR_IN_MS;
        timePastMidnight += parseInt(timeArray[2]) * MINUTE_IN_MS;
        // console.log({ militaryTimeString, timeArray, timePastMidnight });
        return timePastMidnight;
    },

    getTimePastMidnightInMs: function (timestamp) {
        const date = new Date(timestamp);
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const militaryTime = `${hours < 10 ? `0${hours}` : hours}:${minutes < 10 ? `0${minutes}` : minutes}`;
        const timePastMidnight = this.getTimePastMidnightInMsFromMilitaryTime(militaryTime)
            + date.getUTCSeconds() * SECOND_IN_MS + date.getUTCMilliseconds();
        return timePastMidnight;
    },

    getTimeSinceMidnightInMsUTC: function (timeInMS, UTCHourOffset = 0) {
        const timePastMidnight = Math.abs(timeInMS) % DAY_IN_MS;
        console.log({ timePastMidnight });
        return (DAY_IN_MS + timePastMidnight + (HOUR_IN_MS * parseInt(UTCHourOffset)) % DAY_IN_MS);
    },

    timezoneToString: function (UTCHourOffset) {
        var tz;
        switch (parseInt(UTCHourOffset)) {
            case -12:
                break;
            case -11:
                break;
            case -10:
                break;
            case -9:
                break;
            case -8:
                break;
            case -7:
                break;
            case -6:
                break;
            case -5:
                break;
            case -4:
                break;
            case -3:
                break;
            case -2:
                break;
            case -1:
                break;
            case 0: tz = 'UTC'
                break;
            case 1:
                break;
            case 2:
                break;
            case 3:
                break;
            case 4:
                break;
            case 5:
                break;
            case 6:
                break;
            case 7:
                break;
            case 8:
                break;
            case 9:
                break;
            case 10:
                break;
            case 11:
                break;
            case 12:
                break;
            case 13:
                break;
            case 14:
                break;
            default: tz = 'UTC';
                break;
        }
        return tz;
    },

    msToTimeFromMidnight: function (milliseconds, inMilitaryTime = false) {
        const defaultTime = inMilitaryTime ? "00:00:00" : "12:00 AM";
        if (isNaN(milliseconds)) return defaultTime;
        milliseconds = milliseconds % DAY_IN_MS;
        let [hours, mins, seconds,] = this.getHoursMinutesSecondsMillisecondsArray(milliseconds);
        var timeString;
        hours = hours < 10 ? `0${hours}` : hours;
        mins = mins < 10 ? `0${mins}` : mins;
        seconds = seconds < 10 ? `0${seconds}` : seconds;
        if (!inMilitaryTime) {
            const standardTime = this.militaryTimeHoursToStandardTimeHoursArray(hours);
            if (!standardTime) return defaultTime;
            [hours, amPmString] = standardTime;
            timeString = `${hours}:${mins}:${seconds} ${amPmString}`;
        }
        else timeString = `${hours}:${mins}:${seconds}`;
        return timeString ? timeString : defaultTime;
    },

    hoursToUTCOffset: function (hours) {
        if (!isNaN(hours)) {
            const sign = hours < 0 ? "-" : "+";
            hours = Math.abs(hours);
            let hoursOut = parseInt(hours);
            hoursOut = hoursOut < 10 ? `0${hoursOut}` : hoursOut;
            let minsOut = parseInt((hours - hoursOut) / 60);
            minsOut = minsOut < 10 ? `0${minsOut}` : minsOut;
            return `${sign}${hoursOut}:${minsOut}`;
        }
        else return hours;
    },

    /**
     * 
     * @param {Number} dayOfWeek 0-6: 0 - Sunday, 1 - Monday,..., 6 - Saturday
     */
    getDayOfWeekToString: function (dayOfWeek) {
        if (!isNaN(dayOfWeek)) {
            dayOfWeek = parseInt(dayOfWeek);
            switch (dayOfWeek) {
                case 0: return "Sunday";
                case 1: return "Monday";
                case 2: return "Tuesday";
                case 3: return "Wednesday";
                case 4: return "Thursday";
                case 5: return "Friday";
                case 6: return "Saturday";
            }
        }
        return false;
    },

    getNumberBeforeStringRegex: function () {
        return numberBeforeStringRegex = /(\d+)([^\d\W]+)/;
    },

    containsNumberBeforeString: function (string) {
        return this.getNumberBeforeStringRegex().test(string);
    },

    getSplitNumberBeforeStringToArray: function (string) {
        const numberBeforeString = this.getNumberBeforeStringRegex().exec(string);
        return numberBeforeString;
    },

    sendErrorMessageAndUsage: async function (userOriginalMessageObject, usageMessage, errorMessage = "**INVALID INPUT...**") {
        await userOriginalMessageObject.reply(errorMessage)
            .then(msg => {
                msg.channel.send(usageMessage);
                msg.delete({ timeout: 5000 });
            })
            .catch(err => console.error(err));
    },

    sendErrorMessage: function (userOriginalMessageObject, errorMessage = "**INVALID INPUT...**") {
        userOriginalMessageObject.reply(errorMessage);
    },

    sendDescriptionOnlyEmbed: function (userOriginalMessageObject, embedMessage, embedColour = this.defaultEmbedColour) {
        embedMessage = new Discord.MessageEmbed()
            .setColor(embedColour)
            .setDescription(embedMessage);
        userOriginalMessageObject.channel.send(embedMessage);
    },

    getMessageEmbed: function (embedMessage, embedTitle, embedColour = this.defaultEmbedColour) {
        embedMessage = new Discord.MessageEmbed()
            .setColor(embedColour)
            .setTitle(embedTitle)
            .setDescription(embedMessage);
        return embedMessage;
    },

    getMessageDescriptionOnlyEmbed: function (embedMessage, embedColour = this.defaultEmbedColour) {
        embedMessage = new Discord.MessageEmbed()
            .setColor(embedColour)
            .setDescription(embedMessage);
        return embedMessage;
    },

    getMessageImageEmbed: function (embedImageURL, embedMessage, embedTitle, embedColour = this.defaultEmbedColour) {
        embedMessage = new Discord.MessageEmbed()
            .setColor(embedColour)
            .setTitle(embedTitle)
            .setDescription(embedMessage)
            .setImage(embedImageURL);
        return embedMessage;
    },

    sendDescriptionOnlyMessageEmbed: function (userOriginalMessageObject, embedMessage, embedColour = this.defaultEmbedColour) {
        embedMessage = this.getMessageDescriptionOnlyEmbed(embedMessage, embedColour);
        userOriginalMessageObject.channel.send(embedMessage);
    },

    getDailyJournalMorningTemplate: function (withTitle = true, withMarkdown = true) {
        const dailyJournalMorningTemplate = "**What am I truly grateful for?**\n1.\n2.\n3.\n"
            + "\n**What are 3 things I need to be better at?**\n1.\n2.\n3.\n"
            + "\n**What mindset/actions would make today GREAT?**\n1.\n2.\n3.\n"
            + "\n**Daily Affirmation:**\nI am";
        var journalOut;
        if (withTitle === true) {
            journalOut = `**__MORNING__**\n${dailyJournalMorningTemplate}`;
        }
        else {
            journalOut = dailyJournalMorningTemplate;
        }
        if (withMarkdown === true) {
            journalOut = `\`${journalOut}\``;
        }
        return journalOut;
    },

    getDailyJournalNightTemplate: function (withTitle = true, withMarkdown = true) {
        const dailyJournalNightTemplate = "**List 3 Accomplishments:**\n1.\n2.\n3.\n"
            + "\n**How could I have made today better?**";
        var journalOut;
        if (withTitle === true) {
            journalOut = `**__NIGHT__**\n${dailyJournalNightTemplate}`;
        }
        else {
            journalOut = dailyJournalNightTemplate;
        }
        if (withMarkdown === true) {
            journalOut = `\`${journalOut}\``;
        }
        return journalOut;
    },

    getDailyJournalFullTemplate: function (withTitle = true, withMarkdown = true) {
        const dailyJournalMorningTemplate = this.getDailyJournalMorningTemplate(withTitle, withMarkdown);
        const dailyJournalNightTemplate = this.getDailyJournalNightTemplate(withTitle, withMarkdown);
        let journalOut = `${dailyJournalMorningTemplate}\n\n${dailyJournalNightTemplate}`;
        return journalOut;
    },

    getWeeklyJournalReflectionTemplate: function (withTitles = true, withMarkdown = true) {
        const weeklyReflectionTemplate = "**__Previous Week's Assessment: Habit Adherence + 3+ Observations:__**"
            + "\n\n__**Area of Life That Needs the Most Attention:** __\n__**STOP, START, CONTINUE:** __"
            + "\n**STOP**:\n**START**:\n**CONTINUE**:";
        var journalOut;
        if (withTitles === true) {
            journalOut = `**__WEEKLY REFLECTION:__**\n${weeklyReflectionTemplate}`;
        }
        else {
            journalOut = weeklyReflectionTemplate;
        }
        if (withMarkdown === true) {
            journalOut = `\`${journalOut}\``;
        }
        return journalOut;
    },

    getWeeklyJournalGoalTemplate: function (withTitle = true, withMarkdown = true) {
        const weeklyGoalsTemplate = "__**Next Week's 1-3 ABSOLUTE Goals and WHY:**__"
            + "\n**Weekly Goal 1**:\n**Weekly Goal 2**:\n**Weekly Goal 3**:";
        var journalOut;
        if (withTitle === true) {
            journalOut = `**__WEEKLY GOALS:__**\n${weeklyGoalsTemplate}`;
        }
        else {
            journalOut = weeklyGoalsTemplate;
        }
        if (withMarkdown === true) {
            journalOut = `\`${journalOut}\``;
        }
        return journalOut;
    },

    getWeeklyJournalFullTemplate: function (withTitles = true, withMarkdown = true) {
        const weeklyGoalsTemplate = this.getWeeklyJournalGoalTemplate(withTitles, withMarkdown);
        const weeklyReflectionTemplate = this.getWeeklyJournalReflectionTemplate(withTitles, withMarkdown);
        let journalOut = `${weeklyReflectionTemplate}\n\n${weeklyGoalsTemplate}`;
        return journalOut;
    },

    goalArrayToString: function (goalArray, type = null, doubleSpace = true, showNumber = true, emphasizeNumber = false) {
        if (Array.isArray(goalArray)) {
            if (goalArray.length) {
                if (goalArray.every(goal => typeof goal === 'object')) {
                    if (type) type = `${this.toTitleCase(type)} `; // To add a space at the end
                    else type = "";
                    let goalStringArray = new Array();
                    goalArray.forEach((goal, i) => {
                        const goalNumber = showNumber ? (emphasizeNumber ? ` \`${i + 1}\`` : ` ${i + 1}`) : "";
                        goalStringArray.push(`**${type}Goal${goalNumber}** ${goal.description ? `\n🎯 - ${goal.description}` : ""}${goal.reason ? `\n💭 - ${goal.reason}` : ""}`
                            + `${!isNaN(goal.type) ? `${this.areasOfLifeEmojis[parseInt(goal.type)] ? `\n${this.areasOfLifeEmojis[parseInt(goal.type)]}` : ""}`
                                + `${this.areasOfLife[parseInt(goal.type)] ? ` __${this.areasOfLife[parseInt(goal.type)]}__` : ""}` : ""}`);
                    });
                    const outputString = doubleSpace ? goalStringArray.join('\n\n') : goalStringArray.join('\n');
                    return outputString;
                }
            }
        }
        return false;
    },

    // Function call allows for name to be a Discord user tag! <@!##############>
    mastermindWeeklyJournalEntry: function (name = "NAME", withMarkdown = false, previousWeekReflectionEntry = "", areaOfLifeEntry = { type: null, reason: "" },
        stopEntry = "", startEntry = "", continueEntry = "", weeklyGoals = [{ type: null, description: "", reason: "" }, { type: null, description: "", reason: "" }, { type: null, description: "", reason: "" }]) {
        const doubleSpace = weeklyGoals.some(goal => goal.type);
        const goalString = this.goalArrayToString(weeklyGoals, "Weekly", doubleSpace);
        let weeklyJournalEntry = `${!name ? "" : `__**${name}**__\n`}`
            + `**__Previous Week's Assessment: Habit Adherence + 3+ Observations:__**\n${previousWeekReflectionEntry ? `${previousWeekReflectionEntry}\n` : ""}`
            + `\n__**Area of Life That Needs the Most Attention:**__ `
            + `${!isNaN(areaOfLifeEntry.type) ? `${this.areasOfLifeEmojis[parseInt(areaOfLifeEntry.type)] || ""} ${this.areasOfLife[parseInt(areaOfLifeEntry.type)] || ""}` : ""}`
            + `${areaOfLifeEntry.reason ? `\n${areaOfLifeEntry.reason}\n` : ""}\n__**STOP, START, CONTINUE:** __`
            + `\n**STOP**: ${stopEntry ? `${stopEntry}\n` : ""}\n**START**: ${startEntry ? `${startEntry}\n` : ""}\n**CONTINUE**: ${continueEntry ? `${continueEntry}\n` : ""}`
            + `\n__**Next Week's Goals and WHY:**__${goalString ? `\n${goalString}` : ""}`;
        if (withMarkdown === true) {
            weeklyJournalEntry = `\`${weeklyJournalEntry}\``;
        }
        return weeklyJournalEntry;
    },

    sendReplyThenDelete: async function (userOriginalMessageObject, replyMessage, deleteDelay = 5000) {
        userOriginalMessageObject.reply(replyMessage)
            .then(msg => {
                msg.delete({ timeout: deleteDelay });
            })
            .catch(err => console.error(err));
    },

    sendMessageThenDelete: async function (userOriginalMessageObject, messageToSend, deleteDelay = 5000) {
        userOriginalMessageObject.channel.send(messageToSend)
            .then(msg => {
                msg.delete({ timeout: deleteDelay });
            })
            .catch(err => console.error(err));
    },

    getEditEndConfirmation: async function (bot, message, PREFIX, field, userEdit, type, forceSkip = false) {
        const resetWarningMessage = `**Are you sure you want to change your ${field} to:**\n${userEdit}`;
        let endEditConfirmation = await this.getUserConfirmation(bot, message, PREFIX, resetWarningMessage, forceSkip, `${this.toTitleCase(type)}: Edit ${field} Confirmation`, 60000, 0);
        return endEditConfirmation;
    },

    getBackToMainMenuConfirmation: async function (bot, message, PREFIX, forceSkip) {
        const backToMainEditMessage = "Are you sure you want to go **back to the main edit menu?**";
        const backToMainEdit = await this.getUserConfirmation(bot, message, PREFIX, backToMainEditMessage, forceSkip, "Edit: Back to Main Menu");
        return backToMainEdit;
    },

    /**
     * 
     * @param {Discord.Message} message 
     * @param {String} field 
     * @param {String} instructionPrompt 
     * @param {String} type 
     * @param {Boolean} forceSkip 
     * @param {String} embedColour 
     */
    getUserEditString: async function (bot, message, PREFIX, field, instructionPrompt, type,
        forceSkip = false, embedColour = this.defaultEmbedColour, characterLimit = 2000) {
        var collectedEdit, reset;
        let editMessagePrompt = `**What will you change your *${field}* to?:**${instructionPrompt ? `\n${instructionPrompt}\n` : "\n"}`;
        editMessagePrompt = editMessagePrompt + `\nType \`back\` to go **back to the main edit menu**`;
        do {
            var currentTimestamp;
            reset = false;
            collectedEdit = await this.messageDataCollect(bot, message, PREFIX, editMessagePrompt, `${this.toTitleCase(type)}: Edit`, embedColour, 600000);
            if (collectedEdit === "stop") return false;
            else if (!collectedEdit) return "back";
            else currentTimestamp = Date.now();

            if (collectedEdit.length > characterLimit) {
                message.reply(`**Your edit is too long.** (must be __less than ${characterLimit} characters__ long)`
                    + `\n**__You sent:__** __Word Count - ${collectedEdit.length}__\n${collectedEdit}`);
                reset = true;
            }
            else if (collectedEdit === "back") {
                const backToMainEdit = await this.getBackToMainMenuConfirmation(bot, message, PREFIX, forceSkip);
                if (backToMainEdit === false) reset = true;
                else if (backToMainEdit === null) return false;
                else return collectedEdit;
            }
            if (await this.userIsSpamming(message, currentTimestamp)) return false;
            if (!reset) {
                const confirmEdit = await this.getEditEndConfirmation(bot, message, PREFIX, field, collectedEdit, type, forceSkip);
                if (confirmEdit === false) reset = true;
                else if (confirmEdit === null) return false;
            }
        }
        while (reset);
        return collectedEdit;
    },

    /**
     * 
     * @param {Discord.Message} message 
     * @param {String} field 
     * @param {String} instructionPrompt 
     * @param {[String]} emojiArray Ensure you enter at least 2 emojis (NOT ↩ or ❌ - they are taken for "BACK" and "CANCEL")
     * @param {String} type 
     * @param {Boolean} forceSkip 
     * @param {String} embedColour 
     */
    getUserEditBoolean: async function (bot, message, PREFIX, field, instructionPrompt, emojiArray, type, forceSkip = false, embedColour = this.defaultEmbedColour) {
        var collectedEdit, reset;
        let editMessagePrompt = `**What will you change your *${field}* to?:**${instructionPrompt ? `\n${instructionPrompt}\n` : "\n"}`;
        const backEmoji = '⬅';
        const cancelEmoji = '❌';
        editMessagePrompt = editMessagePrompt + `\nPress ${backEmoji} to go **back to the main edit menu**\nPress ${cancelEmoji} to **cancel**`;
        emojiArray.push(backEmoji);
        emojiArray.push(cancelEmoji);
        do {
            reset = false;
            collectedEdit = await this.reactionDataCollect(bot, message, editMessagePrompt, emojiArray, `${this.toTitleCase(type)}: Edit`, embedColour, 600000);
            if (collectedEdit === "❌") return false;
            else if (!collectedEdit) return "back";
            else if (collectedEdit === backEmoji) {
                const backToMainEdit = await this.getBackToMainMenuConfirmation(bot, message, PREFIX, forceSkip);
                if (backToMainEdit === false) reset = true;
                else if (backToMainEdit === null) return false;
                else return collectedEdit;
            }
            if (!reset) {
                const confirmEdit = await this.getEditEndConfirmation(bot, message, PREFIX, field, collectedEdit, type, forceSkip);
                if (confirmEdit === false) reset = true;
                else if (confirmEdit === null) return false;
            }
        }
        while (reset);
        return collectedEdit;
    },

    /**
     * 
     * @param {Discord.Message} message 
     * @param {String} field 
     * @param {String} instructionPrompt 
     * @param {String} type 
     * @param {Boolean} forceSkip 
     * @param {String} embedColour 
     */
    getUserMultilineEditString: async function (bot, message, PREFIX, field, instructionPrompt, type,
        forceSkip = false, embedColour = this.defaultEmbedColour, characterLimit = 2000) {
        let messageIndex = 0;
        let reset = false;
        var collectedEdit, userEdit = new Array();
        let editMessagePrompt = `**What will you change your *${field}* to?:**${instructionPrompt ? `\n${instructionPrompt}\n` : "\n"}`;
        editMessagePrompt = editMessagePrompt + `\nType \`0\` to **restart/clear** your current edit!`
            + `\nType \`1\` when you're **done!**\nType \`2\` to **undo** the previously typed edit\nType \`back\` to go **back to the main edit menu**`;
        const originalEditMessagePrompt = editMessagePrompt;
        do {
            messageIndex++;
            var currentTimestamp;
            collectedEdit = await this.messageDataCollect(bot, message, PREFIX, editMessagePrompt, `${this.toTitleCase(type)}: Edit`,
                embedColour, 600000, false, false, false, true, 3000, false, `Character Count: ${userEdit.join('\n').length}`);
            if (!collectedEdit || collectedEdit === "stop") {
                if (collectedEdit !== "stop") {
                    message.channel.send(`This was your **${field} edit!**:\n${userEdit.join('\n')}`);
                }
                return false;
            }
            else currentTimestamp = Date.now();

            if (collectedEdit.length + userEdit.join('\n').length > 6000) {
                message.reply("**Your edit was too long** (*over 6000 characters*), so I had to **stop** collecting it.");
                return false;
            }
            if (messageIndex === 1 || reset === true) {
                if (collectedEdit === "1") {
                    if (userEdit.join('\n').length > characterLimit) {
                        message.reply(`**Your edit is too long.** (must be __less than ${characterLimit} characters__ long)`
                            + `\nTry undoing some line entries by typing \`2\` or reset your edit by typing \`0\``);
                        collectedEdit = null;
                    }
                    const endEditConfirmation = await this.getEditEndConfirmation(bot, message, PREFIX, field, userEdit.join('\n'), type, forceSkip);
                    if (endEditConfirmation === true) break;
                    else if (endEditConfirmation === null) return false;
                }
                else if (collectedEdit !== "0" && collectedEdit !== "back" && collectedEdit !== "2") {
                    editMessagePrompt = `${editMessagePrompt}\n\n**Current Edit:**\n${collectedEdit}\n`;
                    userEdit.push(collectedEdit);
                    reset = false;
                }
                else if (collectedEdit === "back") {
                    const backToMainEdit = await this.getBackToMainMenuConfirmation(bot, message, PREFIX, forceSkip);
                    if (backToMainEdit === true) {
                        userEdit = "back";
                        break;
                    }
                    else if (backToMainEdit === null) return false;
                }
                else messageIndex = 0;
            }
            else if (collectedEdit === "back") {
                const backToMainEdit = await this.getBackToMainMenuConfirmation(bot, message, PREFIX, forceSkip);
                if (backToMainEdit === true) {
                    userEdit = "back";
                    break;
                }
                else if (backToMainEdit === null) return false;
            }
            else if (collectedEdit === "1") {
                if (userEdit.join('\n').length > characterLimit) {
                    message.reply(`**Your edit is too long.** (must be __less than ${characterLimit} characters__ long)`
                        + `\nTry undoing some line entries by typing \`2\` or reset your edit by typing \`0\``);
                    collectedEdit = null;
                }
                const endEditConfirmation = await this.getEditEndConfirmation(bot, message, PREFIX, field, userEdit.join('\n'), type, forceSkip);
                if (endEditConfirmation === true) break;
                else if (endEditConfirmation === null) return false;
            }
            else if (collectedEdit === "0") {
                if (userEdit === "") {
                    reset = true;
                }
                else {
                    const resetWarningMessage = "Are you sure you want to __**reset**__ your current edit?\n*(All of your current edit will be lost...)*";
                    const resetConfirmation = await this.getUserConfirmation(bot, message, PREFIX, resetWarningMessage, false, `${this.toTitleCase(type)}: Edit ${field} Reset`);
                    if (resetConfirmation === true) {
                        editMessagePrompt = originalEditMessagePrompt;
                        userEdit = new Array();
                        reset = true;
                    }
                    else if (resetConfirmation === null) return false;
                }
            }
            // Undo Mechanism
            else if (collectedEdit === "2") {
                if (userEdit.length) {
                    let error = false;
                    if (userEdit.length === 1) {
                        editMessagePrompt = originalEditMessagePrompt;
                        reset = true;
                    }
                    else {
                        targetStringIndex = editMessagePrompt.lastIndexOf(userEdit[userEdit.length - 1]);
                        if (targetStringIndex >= 0) {
                            editMessagePrompt = editMessagePrompt.substring(0, targetStringIndex);
                        }
                        else {
                            console.log("Could not undo the last typed edit!");
                            this.sendMessageThenDelete(message, `**Sorry <@!${message.author.id}>, I could not undo the last typed edit!**`, 30000);
                            error = true;
                        }
                    }
                    if (!error) userEdit.pop();
                }
                else {
                    editMessagePrompt = originalEditMessagePrompt;
                    reset = true;
                }
            }
            else {
                editMessagePrompt = editMessagePrompt + collectedEdit + "\n";
                userEdit.push(collectedEdit);
            }
            if (collectedEdit !== "0" && collectedEdit !== "1"
                && collectedEdit !== "2" && collectedEdit !== "stop") {
                if (await this.userIsSpamming(message, currentTimestamp)) {
                    return false;
                }
            }
        }
        while (true)
        if (Array.isArray(userEdit)) userEdit = userEdit.join('\n');
        return userEdit;
    },

    /**
     * 
     * @param {Discord.Message} message 
     * @param {String} field 
     * @param {Number} maxNumber 
     * @param {String} type 
     * @param {[String]} numberMappingArray
     * @param {Boolean} forceSkip 
     * @param {String} embedColour 
     */
    getUserEditNumber: async function (bot, message, PREFIX, field, maxNumber, type,
        numberMappingArray = false, forceSkip = false, embedColour = this.defaultEmbedColour, additionalInstructions = '') {
        var collectedEdit;
        const numberErrorMessage = `**Please Enter a Number from \`1\`-\`${maxNumber}\`**`;
        let editMessagePrompt = `**What will you change your *${field}* to?:**`
        editMessagePrompt += `\n${additionalInstructions === '' ? `(*${numberErrorMessage}*)` : additionalInstructions}`
            + `\n\nType \`back\` to go **back to the main edit menu**`;
        while (true) {
            var currentTimestamp;
            collectedEdit = await this.messageDataCollect(bot, message, PREFIX, editMessagePrompt, `${this.toTitleCase(type)}: Edit`, embedColour, 600000);
            if (collectedEdit === "stop") return false;
            else if (!collectedEdit) return "back";
            else currentTimestamp = Date.now();

            // Check if the given message is a number
            if (isNaN(collectedEdit)) {
                if (collectedEdit === "back") {
                    const backToMainEdit = await this.getBackToMainMenuConfirmation(bot, message, PREFIX, forceSkip);
                    if (backToMainEdit === true) return collectedEdit;
                    else if (backToMainEdit === null) return false;
                }
                else this.sendReplyThenDelete(message, numberErrorMessage, 15000);
            }
            else if (collectedEdit !== undefined) {
                collectedEdit = parseInt(collectedEdit);
                if (collectedEdit < 1 || collectedEdit > maxNumber) {
                    this.sendReplyThenDelete(message, numberErrorMessage, 15000);
                }
                else {
                    let showEdit = collectedEdit;
                    if (Array.isArray(numberMappingArray)) {
                        showEdit = numberMappingArray[collectedEdit - 1] ? numberMappingArray[collectedEdit - 1] : collectedEdit;
                    }
                    let confirmEdit = await this.getEditEndConfirmation(bot, message, PREFIX, field, showEdit, type, forceSkip);
                    if (confirmEdit === true) return collectedEdit;
                    else if (confirmEdit === null) return false;
                }
            }
            if (await this.userIsSpamming(message, currentTimestamp)) return false;
        }
    },

    endTimeAfterStartTime: function (message, startTimestamp, endTimestamp, type) {
        if (endTimestamp) {
            if (endTimestamp < startTimestamp) {
                type = type ? `${this.toTitleCase(type)} ` : "";
                const startTimestampToDate = this.timestampToDateString(startTimestamp);
                const endTimestampToDate = this.timestampToDateString(endTimestamp);
                this.sendMessageThenDelete(message, (this.getMessageEmbed(`**__${type}Start Time:__** ${startTimestampToDate}\n**__${type}End Time:__** ${endTimestampToDate}`
                    + `\n\n**The end time cannot be before the start time...**`, `${type ? `${type}: ` : ""}Invalid Start and End Times`, "#FF0000")), 1800000);
                return false;
            }
        }
        return true;
    },

    getSplitStringByDiscordMaxString: function (string) {
        let splitElements = [string];
        // Split of the string by new lines or end of line punctuation
        if (string.indexOf('\n') !== -1) {
            splitElements = string.split(/(\n\n+)/);
            if (splitElements[0] === string) {
                splitElements = string.split(/(\n)/);
            }
        }
        if (splitElements[0] === string) {
            splitElements = string.split(/([\.\!\?]+)/);
            if (splitElements[0] === string) {
                splitElements = string.split(/([\,\;\:]+)/);
                if (splitElements[0] === string) {
                    splitElements = string.match(/[\s\S]{1,2045}[\s\n]/);
                    if (splitElements[0] === string) {
                        splitElements = string.match(/[\s\S]{1,2046}/);
                    }
                }
            }
        }

        // Check for elements with a length greater than 2046 (2 extra for new-line escaping)
        // The elements would have already been split by new lines and end of line punctuation
        let largeStringElements = splitElements.filter(string => string.length > 2046);
        if (largeStringElements.length) {
            largeStringElements.forEach(element => {
                const splitIndex = splitElements.indexOf(element);
                if (splitIndex !== -1) {
                    const start = splitElements.slice(0, splitIndex);
                    const end = splitIndex !== splitElements.length - 1 ? splitElements.slice(splitIndex + 1, splitElements.length) : [];
                    const splitString = this.getSplitStringByDiscordMaxString(element);
                    splitElements = start.concat(splitString).concat(end);
                }
            });
        }
        return splitElements;
    },

    /**
     * Generates embeds of suitable size for pagination
     * @param {[String] | String} elements 
     * @param {String} title 
     * @param {String} embedColour 
     */
    getEmbedArray: function (elements, title, doubleSpace = true, includesFile = false, embedColour = this.defaultEmbedColour,) {
        try {
            let embedString = new Array();
            let maxString = "";
            if (elements) {
                let isString = false;
                if (typeof elements === 'string') {
                    isString = true;
                    console.log(elements.length);
                    if (elements.length > 2048) {
                        elements = this.getSplitStringByDiscordMaxString(elements);
                    }
                    else elements = [elements];
                }
                if (Array.isArray(elements)) {
                    elements.forEach((element, i) => {
                        const combinedString = maxString + element;
                        if (element.length >= 2046) {
                            if (maxString === "") {
                                embedString.push(element);
                            }
                            else {
                                embedString.push(maxString);
                                embedString.push(element);
                                maxString = "";
                            }
                        }
                        else if (combinedString.length <= 2048 && i !== elements.length - 1) {
                            if (combinedString.length >= 2046) {
                                maxString += element;
                                embedString.push(maxString);
                            }
                            else maxString += isString ? element : (doubleSpace ? `${element}\n\n` : `${element}\n`);
                        }
                        else {
                            if (i === elements.length - 1) {
                                if (combinedString.length <= 2048) {
                                    maxString += element;
                                }
                                else {
                                    embedString.push(maxString);
                                    maxString = element;
                                }
                                embedString.push(maxString);
                            }
                            else {
                                embedString.push(maxString);
                                maxString = isString ? element : (doubleSpace ? `${element}\n\n` : `${element}\n`);
                            }
                        }
                    });
                    // console.log({ embedString });
                    let embedArray = new Array();
                    embedString.forEach(string => {
                        const embed = this.getMessageEmbed(string, title, embedColour);
                        embedArray.push(includesFile ? embed.setFooter(this.fileFooterText) : embed);
                    });
                    return embedArray;
                }
            }
            return false;
        }
        catch (err) {
            console.error(err);
        }
    },

    // With to file capability
    sendPaginationEmbed: async function (bot, channelID, authorID, embedArray, withDelete = true) {
        var embed;
        if (Array.isArray(embedArray)) {
            let currentPage = 0;
            const channel = bot.channels.cache.get(channelID);
            embed = await channel.send(embedArray[currentPage]);
            if (embedArray.length) {
                const left = '⬅';
                const right = '➡';
                const cancel = '🗑️';
                const file = '📎';
                let emojis = embedArray.length > 1 ? [left, right] : [];
                emojis = withDelete ? emojis.concat([cancel]) : emojis;
                emojis = embedArray[0].footer ? (embedArray[0].footer.text === this.fileFooterText ? emojis.concat([file]) : emojis) : emojis;
                emojis.forEach(async (emoji, i) => {
                    await this.quickReact(embed, emoji, i);
                });

                const filter = (reaction, user) => emojis.includes(reaction.emoji.name) && (authorID === user.id);
                const collector = embed.createReactionCollector(filter);

                collector.on('collect', (reaction, user) => {
                    switch (reaction.emoji.name) {
                        case right:
                            if (currentPage < embedArray.length - 1) {
                                currentPage++;
                            }
                            else if (currentPage === embedArray.length - 1) {
                                currentPage = 0;
                            }
                            break;
                        case left:
                            if (currentPage !== 0) {
                                --currentPage;
                            }
                            else if (currentPage === 0) {
                                currentPage = embedArray.length - 1;
                            }
                            break;
                        case cancel:
                            collector.stop();
                            console.log("Stopped pagination");
                            embed.delete();
                            return;
                        // When sending the file, have a flag and ensure that the user only
                        // gets the file sent to them once.
                    }
                    embed.edit(embedArray[currentPage]);
                    if (channel.type !== 'dm') reaction.users.remove(user);
                });
            }
        }
        return embed;
    },

    createUserSettings: async function (bot, userID, timezoneObject) {
        try {
            if (!timezoneObject) return false;
            if (!timezoneObject.name && !timezoneObject.offset && timezoneObject.offset !== 0 && isNaN(timezoneObject.offset)
                && !timezoneObject.daylightSaving && timezoneObject.daylightSaving !== false) {
                return false;
            }
            const user = bot.users.cache.get(userID);
            const userDaylightSavingsSettings = timezoneObject.daylightSaving;
            const daylightOffset = this.isDaylightSavingTime(Date.now() + timezoneObject.offset * HOUR_IN_MS,
                timezoneObject.name, userDaylightSavingsSettings) ? this.getTimezoneDaylightOffset(timezoneObject.name) : 0;
            const mastermindServer = bot.guilds.cache.get('709165601993523233');
            const tier = mastermindServer ? mastermindServer.member(userID) ? 3 : 0 : 0; // User automatically becomes premium if they are in the mastermind group!
            console.log({ tier });
            const userInfo = new User({
                _id: mongoose.Types.ObjectId(),
                discordID: user.id,
                discordTag: `${user.username}#${user.discriminator}`,
                avatar: user.avatar,
                tier,
                timezone: {
                    name: timezoneObject.name.toUpperCase(),
                    offset: timezoneObject.offset + daylightOffset,
                    daylightSaving: userDaylightSavingsSettings,
                },
                habitCron: {
                    daily: 0,
                    weekly: 0,
                },
                getQuote: false,
                likesPesteringAccountability: false,
            });
            const result = await userInfo.save();
            console.log({ result });
            return result;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    getNewUserTimezoneSettings: async function (bot, message, PREFIX, targetUserID = false) {
        const forSelf = targetUserID ? targetUserID === message.author.id : true;
        const userAddressPossessive = forSelf ? "your" : `<@!${targetUserID}>'s`;
        const userAddress = forSelf ? "you" : `<@!${targetUserID}>`;
        const generalAddressPossessive = forSelf ? "your" : "their";
        const userTimezone = await this.messageDataCollect(bot, message, PREFIX,
            `Please enter ${userAddressPossessive} __**current timezone**__ as an **abbreviation** OR **+/- UTC Offset**.\n\n(e.g. \"EST\" | \"+08:45\" | \"-9\")`,
            "User Settings: Setup", this.userSettingsEmbedColour, 300000, false);
        if (!userTimezone || userTimezone === "stop") return false;
        const userTimezoneOffset = this.getTimezoneOffset(userTimezone);
        if (!userTimezoneOffset && userTimezoneOffset !== 0) {
            message.reply("**This __timezone does not exist__... Try again!**");
            return false;
        }
        let userDaylightSavingSetting = await this.reactionDataCollect(bot, message, `Does ${userAddressPossessive} timezone participate in **Daylight Savings Time (DST)?**\n**⌚ - Yes\n⛔ - No\n❌ - Exit**`,
            ['⌚', '⛔', '❌'], "User Settings: Setup", this.userSettingsEmbedColour, 300000);
        switch (userDaylightSavingSetting) {
            case '⌚': userDaylightSavingSetting = true;
                break;
            case '⛔': userDaylightSavingSetting = false;
                break;
            // For the ❌ - return...
            default: userDaylightSavingSetting = null;
                break;
        }
        if (typeof userDaylightSavingSetting === 'boolean') {
            const confirmSettings = await this.getUserConfirmation(bot, message, PREFIX, `**__Are you sure ${userAddress} want${forSelf ? "" : "s"} the following settings?:__**`
                + `\n⌚ - Timezone: **${userTimezone}**`
                + `\n🌄 - Daylight Saving Time (DST)?: **${userDaylightSavingSetting ? "Yes" : "No"}**`
                + `\n\n(**${this.toTitleCase(userAddress)} can always change ${generalAddressPossessive} user settings** with \`${PREFIX}user edit\` OR \`${PREFIX}u e\` for short)`,
                false, "User Settings: Confirmation", 180000);
            if (!confirmSettings) return;
            const timezone = {
                name: userTimezone.toUpperCase(),
                offset: userTimezoneOffset,
                daylightSaving: userDaylightSavingSetting,
            };
            return timezone;
        }
    },

    createGuildSettings: async function (guildID, timezone = "EST", daylightSaving = true) {
        try {
            const initialOffset = this.getTimezoneOffset(timezone);
            const daylightOffset = this.isDaylightSavingTime(Date.now() + initialOffset * HOUR_IN_MS,
                timezone, daylightSaving) ? this.getTimezoneDaylightOffset(timezone) : 0;
            const guildConfig = new Guild({
                _id: mongoose.Types.ObjectId(),
                guildID,
                prefix: DEFAULT_PREFIX,
                timezone: {
                    name: timezone.toUpperCase(),
                    offset: initialOffset + daylightOffset,
                    daylightSaving,
                },
                mastermind: {
                    roles: [],
                    resetDay: 0,
                },
                quote: {
                    roles: [],
                    getQuote: false,
                },
            });
            const result = await guildConfig.save();
            console.log({ result });
            return result;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    getIDArrayFromNames: function (nameString, allMembers, cachedGuild) {
        let allMemberNames = new Array();
        allMembers.forEach(member => {
            allMemberNames.push({
                id: member.id,
                username: member.username,
                discriminator: member.discriminator,
                nickname: cachedGuild.member(member.id).displayName,
            });
        });
        if (!allMemberNames.length) return false;
        console.log({ allMemberNames });
        let targetIDs = new Array();
        const searchNickname = allMemberNames.filter(member => nameString.includes(member.nickname.toLowerCase()));
        console.log({ searchNickname });
        if (searchNickname.length) {
            targetIDs = searchNickname.map(member => member.id);
        }
        const searchUsername = allMemberNames.filter(member => nameString.includes(member.username.toLowerCase()));
        console.log({ searchUsername });
        if (searchUsername.length) {
            searchUsername.map(member => {
                if (!targetIDs.includes(member.id)) {
                    targetIDs.push(member.id);
                    return member.id;
                }
                else return null;
            }).filter(element => element !== null);
        }
        const searchWithDiscriminator = allMemberNames.filter(member => nameString.includes(`${member.username.toLowerCase()}#${member.discriminator}`));
        console.log({ searchWithDiscriminator });
        if (searchWithDiscriminator.length) {
            searchWithDiscriminator.map(member => {
                if (!targetIDs.includes(member.id)) {
                    targetIDs.push(member.id);
                    return member.id;
                }
                else return null;
            }).filter(element => element !== null);
        }
        const searchID = allMemberNames.filter(member => nameString.includes(member.id));
        console.log({ searchID });
        if (searchID.length) {
            searchID.map(member => {
                if (!targetIDs.includes(member.id)) {
                    targetIDs.push(member.id);
                    return member.id;
                }
                else return null;
            }).filter(element => element !== null);
        }
        console.log({ targetIDs });
        return targetIDs;
    },

    getTargetChannel: async function (bot, message, PREFIX, type,
        forceSkip = false, allowTextChannels = true, allowVoiceChannels = false,
        forPosting = true, embedColour = this.defaultEmbedColour, excludedChannels = []) {
        // Find all the mutual servers with the user and bot
        var botUserMutualServerIDs = await this.userAndBotMutualServerIDs(bot, message);
        var targetServerIndex, targetChannelIndex;
        var channelList, channelListDisplay;
        var confirmSendToChannel = false;
        const channelSelectInstructions = `Type the number corresponding to the channel you want`
            + `${forPosting ? ` to post in:` : ""}`;
        const serverSelectInstructions = `Type the number corresponding to the server you want`
            + `${forPosting ? ` to post in:` : ""}`;
        const postToServerTitle = `${type}:${forPosting ? ` Post to` : ""} Server`;
        const postToChannelTitle = `${type}:${forPosting ? ` Post to` : ""} Channel`;
        var serverList = await this.listOfServerNames(bot, botUserMutualServerIDs);
        targetServerIndex = await this.userSelectFromList(bot, message, PREFIX, serverList, botUserMutualServerIDs.length,
            serverSelectInstructions, postToServerTitle, embedColour);
        if (targetServerIndex === false) return false;
        channelList = await this.listOfServerChannels(bot, message, botUserMutualServerIDs[targetServerIndex],
            allowTextChannels, allowVoiceChannels);
        if (channelList.length == 0) {
            this.sendReplyThenDelete(message, "This server has **no channels!** EXITING...");
            return false;
        }
        else {
            channelList = channelList.filter(channel => {
                return !excludedChannels.includes(channel);
            });
        }
        channelListDisplay = await this.listOfChannelNames(bot, channelList);
        while (confirmSendToChannel === false) {
            targetChannelIndex = await this.userSelectFromList(bot, message, PREFIX, channelListDisplay, channelList.length,
                channelSelectInstructions, postToChannelTitle, embedColour, 300000);
            if (targetChannelIndex === false) return false;
            console.log({ targetChannelIndex });
            let targetChannelName = await bot.channels.cache.get(channelList[targetChannelIndex]).name;
            confirmSendToChannel = await this.getUserConfirmation(bot, message, PREFIX,
                `Are you sure you want ${forPosting ? `to send it to ` : ""}**${targetChannelName}**?`,
                forceSkip);
            if (confirmSendToChannel === null) return false;
        }
        return channelList[targetChannelIndex];
    },

    getNumberEntry: async function (bot, message, PREFIX, instructionPrompt, title, forceSkip = false,
        allowNegatives = false, allowDecimals = false, minimumValue = undefined, maximumValue = undefined,
        embedColour = this.defaultEmbedColour, additionalInstructions = "", instructionKeywords = []) {
        try {
            const minimumIsDefined = (minimumValue || minimumValue === 0) && !isNaN(minimumValue);
            const maximumIsDefined = (maximumValue || maximumValue === 0) && !isNaN(maximumValue);
            let boundaryMessage = ".";
            if (minimumIsDefined && maximumIsDefined) {
                boundaryMessage = ` from **${minimumValue}** to **${maximumValue}**.`;
            }
            else if (minimumIsDefined) {
                boundaryMessage = ` greater than or equal to **${minimumValue}**.`;
            }
            else if (maximumIsDefined) {
                boundaryMessage = ` less than or equal to **${maximumValue}**.`;
            }

            const errorMessage = `Please enter a **${allowNegatives ? "" : "positive "}${allowDecimals ? "" : "whole "}number**`
                + boundaryMessage;
            var entry;

            do {
                entry = await this.getSingleEntry(bot, message, PREFIX, instructionPrompt, title,
                    forceSkip, embedColour, additionalInstructions, instructionKeywords);
                if (!entry && entry !== "") return false;
                else if (!isNaN(entry)) {
                    entry = allowDecimals ? parseFloat(entry) : parseInt(entry);
                    if (!allowNegatives && entry < 0) {
                        message.reply(`${errorMessage}\n**__You sent:__** ${entry}`);
                        continue;
                    }
                    if (minimumIsDefined) {
                        if (entry < minimumValue) {
                            message.reply(`${errorMessage}\n**__You sent:__** ${entry}`);
                            continue;
                        }
                    }
                    if (maximumIsDefined) {
                        if (entry > maximumValue) {
                            message.reply(`${errorMessage}\n**__You sent:__** ${entry}`);
                            continue;
                        }
                    }
                    break;
                }
                else {
                    message.reply(`${errorMessage}\n**__You sent:__** ${entry}`);
                }
            }
            while (true)
            return entry;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    getSingleEntry: async function (bot, message, PREFIX, instructionPrompt, title, forceSkip = false,
        embedColour = this.defaultEmbedColour, additionalInstructions = "", instructionKeywords = []) {
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
            collectedEntry = await this.messageDataCollect(bot, message, PREFIX, instructionPrompt, title, embedColour, 600000);
            if (!collectedEntry || collectedEntry === "stop" || await this.userIsSpamming(message)) {
                return false;
            }
            if (hasInstructions) {
                if (instructionKeywords.includes(collectedEntry)) {
                    return collectedEntry;
                }
            }
            if (!reset) {
                const confirmEntry = await this.getUserConfirmation(bot, message, PREFIX, `**__Are you sure you want to enter:__**\n${collectedEntry}`, forceSkip, title);
                if (confirmEntry === false) reset = true;
                else if (confirmEntry === null) return false;
            }
        }
        while (reset);
        return collectedEntry;
    },

    getSingleEntryWithCharacterLimit: async function (bot, message, PREFIX, instructionPrompt, title, characterLimit, entryType, forceSkip = false,
        embedColour = this.defaultEmbedColour, additionalInstructions = "", instructionKeywords = []) {
        try {
            var entry;
            do {
                entry = await this.getSingleEntry(bot, message, PREFIX, instructionPrompt, title,
                    forceSkip, embedColour, additionalInstructions, instructionKeywords);
                if (!entry && entry !== "") return false;
                else if (entry.length <= characterLimit || instructionKeywords.includes(entry)) break;
                else {
                    message.reply(`**Please enter ${entryType ? entryType.toLowerCase() : "something"} less than ${characterLimit || 2000} characters**`
                        + `\n**__You sent:__** __Word Count - ${entry.length}__\n${entry}`);
                }
            }
            while (true)
            return entry;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    getMultilineEntry: async function (bot, message, PREFIX, instructionPrompt, title, forceSkip = false,
        embedColour = this.defaultEmbedColour, characterLimit = 2000, additionalInstructions = "", instructionKeywords = [],
        startingArray = false) {
        let inputIndex = 0;
        let reset = false;
        var collectedEntry, finalEntry = startingArray || new Array();
        instructionPrompt += `\n\nType \`0\` to **restart/clear** your **entire** current entry!`
            + `\nType \`1\` when you're **done!**\nType \`2\` to **undo** the previous entry`;
        instructionPrompt += !additionalInstructions ? "" : `\n${additionalInstructions}`;
        instructionPrompt += startingArray ? `\n\n**Current Entry:**\n${startingArray.join('\n')}\n` : "";
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
            var currentTimestamp;
            collectedEntry = await this.messageDataCollect(bot, message, PREFIX, instructionPrompt, title, embedColour, 600000,
                false, false, false, true, 3000, false, `Character Count: ${finalEntry.join('\n').length}`);
            if (!collectedEntry || collectedEntry === "stop") {
                if (collectedEntry !== "stop") {
                    message.channel.send(`This was your **entry**:\n${finalEntry.join('\n')}`);
                }
                return false;
            }
            else currentTimestamp = Date.now();
            if (collectedEntry.length + finalEntry.join('\n').length > 6000) {
                message.reply("**Your entry was too long** (*over 6000 characters*), so I had to **stop** collecting it.");
                return false;
            }
            if (hasInstructions) {
                if (instructionKeywords.includes(collectedEntry)) {
                    return { message: finalEntry.join('\n'), returnVal: collectedEntry, array: finalEntry };
                }
            }
            if (inputIndex === 1 || reset === true) {
                if (collectedEntry === "1") {
                    if (finalEntry.join('\n').length > characterLimit) {
                        message.reply(`**Your entry is too long** (must be __less than ${characterLimit} characters__ long)`
                            + `\nTry undoing some line entries by typing \`2\` or reset your entry by typing \`0\``);
                        collectedEntry = null;
                    }
                    else {
                        const endConfirmation = await this.getUserConfirmation(bot, message, PREFIX, `**__Are you sure you want to enter:__**\n${finalEntry.join('\n')}`, forceSkip, title, 180000);
                        if (endConfirmation === true) break;
                        else if (endConfirmation === null) return false;
                    }
                }
                else if (collectedEntry !== "0" && collectedEntry !== "2") {
                    instructionPrompt += `\n\n**Current Entry:**\n${collectedEntry}\n`;
                    finalEntry.push(collectedEntry);
                    reset = false;
                }
                else inputIndex = 0;
            }
            else if (collectedEntry === "1") {
                if (finalEntry.join('\n').length > characterLimit) {
                    message.reply(`**Your entry is too long** (must be __less than ${characterLimit} characters__ long)`
                        + `\nTry undoing some line entries by typing \`2\` or reset your entry by typing \`0\``);
                    collectedEntry = null;
                }
                else {
                    const endConfirmation = await this.getUserConfirmation(bot, message, PREFIX, `**__Are you sure you want to enter:__**\n${finalEntry.join('\n')}`, forceSkip, title, 180000);
                    if (endConfirmation === true) break;
                    else if (endConfirmation === null) return false;
                }
            }
            else if (collectedEntry === "0") {
                if (finalEntry === "") {
                    reset = true;
                }
                else {
                    const resetWarningMessage = `__Are you sure you want to **reset** the current entry for this section?:__\n${finalEntry.join('\n')}`;
                    let resetConfirmation = await this.getUserConfirmation(bot, message, PREFIX, resetWarningMessage, false, `${title} Reset`);
                    if (resetConfirmation === true) {
                        instructionPrompt = originalPrompt;
                        finalEntry = new Array();
                        reset = true;
                    }
                    else if (resetConfirmation === null) return false;
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
                            this.sendMessageThenDelete(message, `**Sorry <@!${message.author.id}>, I could not undo the last entry!**`, 30000);
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

            if (collectedEntry !== "0" && collectedEntry !== "1"
                && collectedEntry !== "2" && collectedEntry !== "stop") {
                if (await this.userIsSpamming(message, currentTimestamp)) {
                    return false;
                }
            }
        }
        while (true)
        return { message: finalEntry.join('\n'), returnVal: 1, array: finalEntry };
    },

    /**
     * 
     * @param {String} userID 
     * @param {String} targetID 
     * @param {Number} totalEntries 
     * @param {Function} getOneEntry 
     */
    getEntryIndexByFunction: async function (userID, targetEntryID, totalEntries, getOneEntry) {
        let i = 0;
        while (true) {
            let entry = await getOneEntry(userID, i);
            if (entry === undefined && i === totalEntries) {
                return false;
            }
            else if (entry._id.toString() === targetEntryID.toString()) break;
            i++;
        }
        return i + 1;
    },

    setLongTimeout(callback, delay) {
        var timeout;
        if (delay > MAX_32_BIT_SIGNED_INT) {
            timeout = setTimeout(() => this.setLongTimeout(callback, (delay - MAX_32_BIT_SIGNED_INT)), MAX_32_BIT_SIGNED_INT);
        }
        else timeout = setTimeout(callback, delay);
        return timeout;
    },

    setLongInterval(callback, delay) {
        var interval;
        if (delay > MAX_32_BIT_SIGNED_INT) {
            interval = this.setLongTimeout(callback, delay);
            const next = this.setLongTimeout(() => this.setLongInterval(callback, delay), delay);
        }
        else interval = setInterval(callback, delay);
        return interval;
    },

    getDateAndTimeEntry: async function (bot, message, PREFIX, timezoneOffset, daylightSetting,
        instructions = `**__Enter a Date/Time__**:`, title = "Date and Time Entry", forceFutureTime = false, embedColour = this.defaultEmbedColour,
        dataCollectDelay = 300000, errorReplyDelay = 60000, timeExamples = this.timeExamples,) {
        var time;
        do {
            time = await this.messageDataCollect(bot, message, PREFIX, `${instructions}${timeExamples ? `\n\n${timeExamples}` : ""}`, title, embedColour, dataCollectDelay, false);
            if (!time || time === "stop") return false;
            timeArgs = time.toLowerCase().split(/[\s\n]+/);
            let now = this.getCurrentUTCTimestampFlooredToSecond();
            time = this.timeCommandHandlerToUTC(((forceFutureTime && timeArgs[0] !== "in" && timeArgs[0] !== "now") ?
                (["in"]).concat(timeArgs) : timeArgs), now, timezoneOffset, daylightSetting);
            if (time === false) this.sendReplyThenDelete(message, `Try** \`${PREFIX}date\` **for **help with entering dates and times**`, errorReplyDelay);
            else if (forceFutureTime) {
                now = this.getCurrentUTCTimestampFlooredToSecond();
                if (now + timezoneOffset * HOUR_IN_MS > time) {
                    this.sendReplyThenDelete(message, `Please enter a date/time in the **future**! Try** \`${PREFIX}date\` **for help`, errorReplyDelay);
                }
                else break;
            }
            else break;
        }
        while (true)
        return time;
    },

    changeDSTOffset: async function (isDST, timezone) {
        if (timezone) timezone = timezone.toUpperCase();
        else return false;
        const query = {
            'timezone.name': timezone,
            'timezone.daylightSaving': true,
        };
        const projection = { 'timezone.offset': 1 };
        const allDSTGuilds = await Guild.find(query, projection);
        const allDSTUsers = await User.find(query, projection);
        if (allDSTUsers.length || allDSTGuilds.length) {
            let { offset } = allDSTUsers[0] ? allDSTUsers[0].timezone :
                allDSTGuilds[0] ? allDSTGuilds[0].timezone : false;
            if (!offset && offset !== 0) return false;
            let initialOffset = this.getTimezoneOffset(timezone);
            console.log({ timezone, initialOffset, isDST });
            offset = isDST ? (isNaN(timezone) ?
                initialOffset + this.getTimezoneDaylightOffset(timezone)
                : initialOffset++)
                : initialOffset;
            console.log({ offset });
            await Dst.updateOne({ timezone }, { $set: { isDST } });
            await User.updateMany(query, { $set: { 'timezone.offset': offset } });
            await Guild.updateMany(query, { $set: { 'timezone.offset': offset } });
            return true;
        }
        else return false;
    },

    scheduleOneDST: async function (dstSetting) {
        let { isDST, timezone } = dstSetting;
        let timezoneOffset = this.getTimezoneOffset(timezone)
            + (isDST ? this.getTimezoneDaylightOffset(timezone) : 0);
        let dstEndingYearOffset = 0;
        let now = Date.now() + timezoneOffset * HOUR_IN_MS;
        if (this.isSouthernHemisphereDSTTimezone(timezone)) {
            dstEndingYearOffset = new Date(now).getUTCMonth() < 6 ? 1 : 0;
        }
        let daylightSavingTimeArray = this.getDSTStartAndEndTimeUTC(now, timezone);
        if (!daylightSavingTimeArray) return false;
        let [daylightStartTimestamp, daylightEndTimestamp] = daylightSavingTimeArray;

        // To handle the case when the client is down for an extended period of time

        // Mostly for Southern Hemisphere timezones: If it's past DST for this year
        // Then it is not DST and the next start time is in the next year
        if (now >= daylightEndTimestamp) {
            isDST = false;
            const currentYear = new Date(now);
            const nextYear = new Date(currentYear.getUTCFullYear() - dstEndingYearOffset + 1, currentYear.getUTCMonth(),
                currentYear.getUTCDate(), currentYear.getUTCHours(), currentYear.getUTCMinutes(), currentYear.getUTCSeconds(),
                currentYear.getUTCMilliseconds());
            daylightSavingTimeArray = this.getDSTStartAndEndTimeUTC(nextYear.getTime(), timezone); // Get start time for next year
            if (!daylightSavingTimeArray) return false;
            [daylightStartTimestamp, daylightEndTimestamp] = daylightSavingTimeArray;
        }
        else if (now >= daylightStartTimestamp && now < daylightEndTimestamp) {
            isDST = true;
        }

        // Then update the dst object and reset the scheduling process
        timezoneOffset = this.getTimezoneOffset(timezone) + (isDST ? this.getTimezoneDaylightOffset(timezone) : 0);
        now = Date.now() + timezoneOffset * HOUR_IN_MS;
        let timeToDST = isDST ? daylightEndTimestamp - now : daylightStartTimestamp - now;
        console.log({ timezone, isDST, daylightStartTimestamp, daylightEndTimestamp });
        // console.log(new Date(daylightStartTimestamp));
        // console.log(new Date(daylightEndTimestamp));
        console.log(`DST Start: ${this.timestampToDateString(daylightStartTimestamp + HOUR_IN_MS * timezoneOffset)}`);
        console.log(`DST End: ${this.timestampToDateString(daylightEndTimestamp + HOUR_IN_MS * timezoneOffset)}`);
        console.log(`Now: ${this.timestampToDateString(now)}`);
        console.log(`Time to DST switch: ${this.millisecondsToTimeString(timeToDST)}`);
        await Dst.updateOne({ timezone }, { $set: { isDST } });

        await this.changeDSTOffset(isDST, timezone);
        this.setLongTimeout(async () => {
            dstSetting = await Dst.findOne({ timezone });
            await this.scheduleOneDST(dstSetting);
            return;
        }, timeToDST);
        return;
    },

    // Create another function called schedule all dst
    // Then make this a scheduler for a single DST given the dstSettings object
    rescheduleAllDST: async function () {
        // Start by getting all of the users to get the time until their DST time
        // Set a unique offset for each (make the loop outside)
        let dstSettings = await Dst.find({});
        if (!dstSettings.length) {
            dstSettings = new Array();
            const dstTimezones = this.daylightSavingTimezones;
            dstTimezones.forEach(async timezone => {
                const currentOffset = this.getTimezoneOffset(timezone);
                const newSettings = new Dst({
                    _id: mongoose.Types.ObjectId(),
                    isDST: this.isDaylightSavingTime(Date.now() + HOUR_IN_MS * currentOffset, timezone, true),
                    timezone: timezone.toLowerCase(),
                });
                dstSettings.push(newSettings);
                await newSettings.save()
                    .then(result => console.log(result))
                    .catch(err => console.error(err));
            });
        }
        dstSettings.forEach(async dstSettings => {
            await this.scheduleOneDST(dstSettings);
        });
        return;
    },

    updateAllUsers: async function (bot) {
        const allUsers = await User.find({});
        if (allUsers) {
            if (allUsers.length) {
                allUsers.forEach(async user => {
                    const currentUser = bot.users.cache.get(user.discordID, false);
                    await User.updateOne({ discordID: user.discordID }, {
                        $set:
                        {
                            avatar: currentUser.avatar,
                            discordID: currentUser.id,
                            discordTag: `${currentUser.username}#${currentUser.discriminator}`,
                        }
                    });
                });
            }
        }
        return;
    },

    /**
    * @param {Discord.Collection} cronCollection
    * @param {mongoose.Schema.Types.ObjectId | String} targetID
    */
    cancelCronById: async function (cronCollection, targetID) {
        try {
            if (targetID) {
                targetID = targetID.toString();
                var foundTarget = null;
                cronCollection.each(async cronSubArray => {
                    cronSubArray.forEach(async (cronObject, i) => {
                        const targetObject = cronObject.id === targetID;
                        if (targetObject) {
                            console.log(`Cancelling Cron: _id = ${targetID}`);
                            foundTarget = true;
                            clearTimeout(cronObject.timeout);
                            cronSubArray.splice(i, 1);
                        }
                    });
                });
                return foundTarget;
            }
            else return false;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    /**
    * @param {Discord.Collection} cronCollection
    * @param {mongoose.Schema.Types.ObjectId | String} connectedDocumentId
    */
    cancelCronByConnectedDocument: async function (cronCollection, connectedDocumentId) {
        try {
            if (connectedDocumentId) {
                connectedDocumentId = connectedDocumentId.toString();
                var foundOneReminder = null;
                cronCollection.each(async cronSubArray => {
                    cronSubArray.forEach(async (cronObject, i) => {
                        const targetObject = cronObject.connectedId === connectedDocumentId;
                        if (targetObject) {
                            console.log(`Cancelling Reminder: connectedDocument = ${connectedDocumentId}, _id: = ${cronObject.id.toString()}`);
                            foundOneReminder = true;
                            clearTimeout(cronObject.timeout);
                            cronSubArray.splice(i, 1);
                        }
                    });
                });
                return foundOneReminder;
            }
            else return false;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    getObjectIndexByString: function (object, indexString) {
        // Apply the object dereferencing to each object, one by one
        // Thus reduce is used to iterate through all of the desired
        // properties to dereference the path found in indexString
        // (accumulator, currentValue) => currentObject[at next desired property]
        try {
            if (!indexString) return object;
            else return indexString.split('.').reduce((obj, index) => obj[index], object)
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    /**
     * 
     * @param {[Object]} objectArray 
     * @param {String} propertyToDisplay Enter a string equivalent to the object property
     * you wish to show, separated by periods (i.e. description for document.description
     *  OR journal.goals for document.journal.goals). An empty string or falsey value means
     *  that you wish to display the WHOLE "object" as is - often best for just display a list of
     *  strings or numbers in an array.
     * @param {boolean} doubleSpaceList Enter true if you want the list to be displayed
     * with double spacing or enter false if you want single spacing. (Default: true)
     * * @param {[String]} extraListElements If there are additional options to push to the end
     *  of the selection string
     */
    getSelectionListOutput: function (objectArray, propertyToDisplay, doubleSpaceList = true,
        boldElements = false, extraListElements = []) {
        try {
            var objectList = new Array();
            objectArray.forEach((document, i) => {
                const outputProperty = this.getObjectIndexByString(document, propertyToDisplay);
                if (outputProperty) {
                    objectList.push(
                        `\`${i + 1}\` - ${boldElements ? "**" : ""}${outputProperty}${boldElements ? "**" : ""}`
                    );
                }
            });
            if (Array.isArray(extraListElements)) if (extraListElements.length) {
                extraListElements.forEach((element, i) => {
                    objectList.push(`\`${objectArray.length + i + 1}\` - ${element}`);
                });
            }
            const objectListString = objectList.join(doubleSpaceList ? '\n\n' : '\n');
            return {
                array: objectList,
                string: objectListString,
            };
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    /**
     * Returns the selected document and index
     * @param {Discord.Client} bot 
     * @param {Discord.Message} message 
     * @param {String} PREFIX 
     * @param {String} selectionInstructions 
     * @param {String} selectionTitle 
     * @param {[Object]} objectArray 
     * @param {String} propertyToDisplay Enter a string equivalent to the object property
     * you wish to show, separated by periods (i.e. description for document.description
     *  OR journal.goals for document.journal.goals). An empty string or falsey value means
     *  that you wish to display the WHOLE "object" as is - often best for just display a list of
     *  strings or numbers in an array.
     * @param {boolean} doubleSpaceList Enter true if you want the list to be displayed
     * with double spacing or enter false if you want single spacing. (Default: false)
     * @param {String | Number} embedColour 
     * @param {Number} delayTime Enter the time delay for the user to select a document.
     * (Default: 120000) 
     * @param {Number} userMessageDeleteDelay Enter the delay for deleting the user's
     * message after selection - if it is enabled in their settings. (Default: 0)
     * @param {String} messageAfterList Default: null
     * @param {[String]} extraListElements If there are additional options to push to the end
     *  of the selection string
     */
    getUserSelectedObject: async function (bot, message, PREFIX,
        selectionInstructions, selectionTitle, objectArray, propertyToDisplay,
        doubleSpaceList = false, embedColour = this.defaultEmbedColour, delayTime = 120000,
        userMessageDeleteDelay = 0, messageAfterList = null, extraListElements = []
    ) {
        if (objectArray) if (objectArray.length) {
            const list = this.getSelectionListOutput(objectArray, propertyToDisplay,
                doubleSpaceList, false, extraListElements);
            const targetObjectIndex = await this.userSelectFromList(bot, message, PREFIX,
                list.string + '\n', list.array.length, selectionInstructions, selectionTitle,
                embedColour, delayTime, userMessageDeleteDelay, messageAfterList);
            if (!targetObjectIndex && targetObjectIndex !== 0) return false;
            else {
                const userSelection = {
                    index: targetObjectIndex,
                    object: undefined,
                };
                if (targetObjectIndex < objectArray.length) {
                    userSelection.object = objectArray[targetObjectIndex];
                }
                return userSelection;
            }
        }
        return false;
    },

    resetAllVoiceChannelTracking: async function (bot) {
        const allTracking = await Track.find({});
        if (allTracking) if (allTracking.length) {
            allTracking.forEach(async trackObject => {
                await this.updateVoiceChannelTimeTracked(
                    bot, trackObject.userID, trackObject.voiceChannelID,
                    trackObject.end - trackObject.start, true,
                    trackObject.end);
                await Track.deleteOne({ _id: trackObject._id });
            });
            console.log("Successfully removed all lingering voice channel tracking objects.");
        }
        // Check if the user is currently in a voice channel and setup tracking
        const users = await User.find({});
        if (users) if (users.length) {
            users.forEach(async user => {
                const mutualServers = await this.userAndBotMutualServerIDs(bot, user.discordID);
                if (mutualServers) if (mutualServers.length) {
                    mutualServers.forEach(async serverID => {
                        const server = bot.guilds.cache.get(serverID);
                        const serverMember = server.members.cache.get(user.discordID);
                        if (serverMember.voice.channel) {
                            await this.setupVoiceChannelTracking(
                                bot, user.discordID, serverMember.voice.channel.id
                            );
                        }
                    });
                }
            });
            console.log("Successfully updated voice channel tracking for members in voice channels.");
        }
    },

    getTrackingReportString: async function (bot, userID) {
        // Get the latest information from the user settings
        const userSettings = await User.findOne({ discordID: userID });
        var outputString = "";
        if (userSettings) {
            const { voiceChannels, timezone } = userSettings;
            if (voiceChannels) if (voiceChannels.length) {
                outputString = `**__Week of ${this.timestampToDateString(this.getStartOfWeekTimestamp(Date.now() + timezone.offset,
                    timezone.offset, timezone.daylightSaving, false), false, true, true) || ""}:__**`
                    + `\n${await this.voiceChannelArrayToString(bot, userID, voiceChannels) || ""}`;
            }
        }
        return outputString;
    },

    voiceChannelArrayToString: async function (bot, userID, voiceChannels) {
        var currentTracking = await Track.findOne({ userID });
        if (currentTracking) {
            const update = await this.updateVoiceChannelTimeTracked(
                bot, userID, currentTracking.voiceChannelID,
                this.getCurrentUTCTimestampFlooredToSecond() - currentTracking.start,
                true
            );
            if (update) {
                voiceChannels = update.voiceChannels;
            }
            currentTracking = await Track.findOneAndUpdate({ _id: currentTracking._id },
                {
                    $set: {
                        start: this.getCurrentUTCTimestampFlooredToSecond(),
                        end: this.getCurrentUTCTimestampFlooredToSecond(),
                    },
                }, { new: true });
        }

        const outputString = voiceChannels.map(vcObject => {
            return `- **${bot.channels.cache.get(vcObject.id).name}** `
                + `(${bot.channels.cache.get(vcObject.id).guild.name}): `
                + `**__${this.millisecondsToTimeString(vcObject.timeTracked)}__**`
                + `\n-- **Last Tracked:** ${this.timestampToDateString(vcObject.lastTrackedTimestamp)}`;
        }).join('\n\n');
        return outputString;
    },

    getMatchingVoiceChannelIndex: function (bot, voiceChannelArray, targetChannelID) {
        var returnIndex = false;
        if (voiceChannelArray) if (voiceChannelArray.length) {
            voiceChannelArray.forEach((id, i) => {
                if (targetChannelID === bot.channels.cache.get(id).id) {
                    returnIndex = i;
                }
            });
        }
        return returnIndex;
    },

    getTargetVoiceChannelAndUserSettings: async function (bot, userID, voiceChannelID) {
        const userSettings = await User.findOne({ discordID: userID });
        if (userSettings) {
            const { voiceChannels } = userSettings;
            if (voiceChannels) if (voiceChannels.length) {
                const targetVcIndex = this.getMatchingVoiceChannelIndex(
                    bot, voiceChannels.map(vc => vc.id), voiceChannelID);
                if (targetVcIndex || targetVcIndex === 0) {
                    return {
                        userSettings,
                        voiceChannels: voiceChannels,
                        voiceChannelIndex: targetVcIndex,
                    };
                }
            }
        }
        return false;
    },

    updateVoiceChannelTimeTracked: async function (bot, userID, voiceChannelID,
        durationChange, addDuration = true, lastTracked = undefined) {
        try {
            const vcInformation = await this.getTargetVoiceChannelAndUserSettings(
                bot, userID, voiceChannelID
            );
            if (!vcInformation) return false;
            else {
                const { userSettings, voiceChannels, voiceChannelIndex } = vcInformation;
                voiceChannels[voiceChannelIndex].timeTracked = addDuration ?
                    voiceChannels[voiceChannelIndex].timeTracked + durationChange
                    : durationChange;
                if (voiceChannels[voiceChannelIndex].timeTracked < 0) {
                    voiceChannels[voiceChannelIndex].timeTracked = 0;
                }
                voiceChannels[voiceChannelIndex].lastTrackedTimestamp = lastTracked || lastTracked === 0 ?
                    lastTracked : this.getCurrentUTCTimestampFlooredToSecond() + userSettings.timezone.offset * HOUR_IN_MS;
                const updatedUserSettings = await User.findByIdAndUpdate(userSettings.id, {
                    $set: { voiceChannels: voiceChannels }
                }, { new: true });
                return {
                    userSettings: updatedUserSettings,
                    voiceChannels: voiceChannels,
                };
            }
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    setupVoiceChannelTracking: async function (bot, userID,
        targetChannelID, targetVcAndUserSettings = undefined) {
        try {
            var vcInformation = targetVcAndUserSettings;
            if (!targetVcAndUserSettings) {
                vcInformation = await this.getTargetVoiceChannelAndUserSettings(
                    bot, userID, targetChannelID
                );
            }
            if (!vcInformation) return false;

            var trackingDocument, targetVcIndex, userSettings;
            userSettings = vcInformation.userSettings;
            targetVcIndex = vcInformation.voiceChannelIndex;
            trackingDocument = new Track({
                _id: mongoose.Types.ObjectId(),
                userID,
                voiceChannelID: targetChannelID,
                start: this.getCurrentUTCTimestampFlooredToSecond(),
                end: this.getCurrentUTCTimestampFlooredToSecond(),
            });
            await trackingDocument.save()
                .catch(err => console.error(err));
            if (trackingDocument && (targetVcIndex || targetVcIndex === 0)) {
                var interval = setInterval(async () => {
                    trackingDocument.end = this.getCurrentUTCTimestampFlooredToSecond();
                    await Track.updateOne({ _id: trackingDocument._id }, {
                        $set: { end: trackingDocument.end, }
                    });
                    return;

                    // If you want to continuously update the timeTracked in real time...
                    // trackingDocument.start = trackingDocument.end;
                    // trackingDocument.end = this.getCurrentUTCTimestampFlooredToSecond();
                    // await Track.updateOne({ _id: trackingDocument._id }, {
                    //     $set:
                    //     {
                    //         start: trackingDocument.start,
                    //         end: trackingDocument.end,
                    //     }
                    // });
                    // const updatedObject = await this.updateVoiceChannelTimeTracked(
                    //     bot, userID, targetChannelID,
                    //     trackingDocument.end - trackingDocument.start,
                    // ); 
                    // if (!updatedObject) clearInterval(interval);
                    // else userSettings = updatedObject.userSettings;
                    // return;
                }, TRACKING_INTERVAL)
                tracking.set(userID, interval);
            }
            return true;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    voiceTrackingHasUser: function (userID) {
        return tracking.has(userID);
    },

    voiceTrackingAddCollection: function (key, value) {
        return tracking.set(key, value);
    },

    voiceTrackingClearInterval: function (userID) {
        return clearInterval(tracking.get(userID));
    },

    voiceTrackingGetInterval: function (userID) {
        return tracking.get(userID)
    },

    voiceTrackingDeleteCollection: function (userID) {
        return tracking.delete(userID);
    },


    getTierMaxMessage: function (PREFIX, commandUsed, thresholdValue, type, tier, supportsArchive = false) {
        return `You've ${supportsArchive ? "archived" : "created"} the **__maximum number of ${supportsArchive ? "archived " : ""}${type[0].toLowerCase()} entries__** (**${thresholdValue}**) `
            + `as a **Tier ${tier || 1} user** and cannot ${supportsArchive ? "archive" : "create"} any more ${type[0].toLowerCase()} entries!`
            + `\n\n\`${PREFIX}${commandUsed} post${supportsArchive ? " archive" : ""}\` - to **post**${type[0] ? ` a ${type[0].toLowerCase()} ` : ""}to a **channel**`
            + `\n\`${PREFIX}${commandUsed} see${supportsArchive ? " archive" : ""} all\` - to **get** all of your ${type[1] ? type[1].toLowerCase() : "entries"} in a **.txt file**`
            + `\n\`${PREFIX}${commandUsed} delete${supportsArchive ? " archive" : ""} all\` - to **delete** all of your ${type[1] ? type[1].toLowerCase() : "entries"} to **make space**!`
            + `\n\n**-- OR --**\n\n**__Donate to support the developer__ to get __more storage__ for all of your entries**`;
    },

    getTierStarString: function (tier) {
        tier = tier ? tier : 1;
        var output = "";
        for (i = 0; i < tier; i++) {
            output += "🌟 ";
        }
        for (i = tier; i < 3; i++) {
            output += "⭐ ";
        }
        output += `(${tier}/3)`;
        return output;
    },

    premiumFooterText: "📞 Contact the developer for more details and any inquiries! (in the server below)\n👋 Join the Personal Development Pod (PD Bot Community): https://discord.gg/Czc3CSy"
        + "\n-- 📚 Bring all of your questions, suggestions, and personal development experiences!\n-- ✨ The tier options/donation page will be on the future website",
    // Visit <future website> for more details! (Change footer when ready)


    invalidPrefixes: ['\*', '\_', '\~', '\>', '\\', '\/', '\:', '\`', '\@'],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    daysOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    reminderTypes: ["Reminder", "Fast", "Goal", "Habit", "Journal", "Quote", "Mastermind", "Task"],
    fileFooterText: `🗑 to delete this window (not the entries)\n📎 to get all of this in a text file`,
    timeExamples: `e.g. **now **|** 5 hours ago **|** yesterday at 6pm\n**|** last monday at 8:30p **|** May 4, 2020 1230a`
        + `\n**|** next friday at 3AM **|** March 22, 2027 **|** today 10PM**`,
    futureTimeExamples: `e.g. **in 15 mins **|** next tuesday at 930p **|** 1 month from now 8pm\ntoday at 1:55P **|** July 5 at 9A **|** April 30, 2021 at 8:45am**`,
    intervalExamplesOver1Minute: `⏳ Any period longer than **1 minute** ⏳`
        + `\n\n**__In one of the forms:__\n- # Periods **(years; months; weeks; days; hours; minutes)**`
        + `\n- #y **(years)** : #d **(days)** : #h **(hours)** : #m **(minutes)** : #s **(seconds)**`
        + `\n- # Days of the Week **(mondays; tuesdays; wednesdays; thursdays; fridays; saturdays; sundays)** **`
        + `\n\ne.g. **5 days **|** 12 hours **|** 30 mins **|** 1 week **|** 4 months **|** 2 years`
        + `\n**|** 1y:2d:3h:30m:2s **|** 18h **|** 12m **|** 6m50s **|** 25m 5s **|** 7d:2h **|** 5y 15d 50h 20m 95s`
        + `\n**|** friday **|** mon **|** 1 sat **|** 2 sun **|** tues at 6pm **|** wednesday at 4A **|** thurs at 12P PST**`,
    intervalExamplesOver1Hour: `⏳ Any period longer than **1 hour** ⏳`
        + `\n\n**__In one of the forms:__\n- # Periods **(years; months; weeks; days; hours; minutes)**`
        + `\n- #y **(years)** : #d **(days)** : #h **(hours)** : #m **(minutes)** : #s **(seconds)**`
        + `\n- # Days of the Week **(mondays; tuesdays; wednesdays; thursdays; fridays; saturdays; sundays)** **`
        + `\n\ne.g. **5 days **|** 12 hours **|** 30 mins **|** 1 week **|** 4 months **|** 2 years`
        + `\n**|** 1y:2d:3h:30m:2s **|** 18h **|** 12m **|** 6m50s **|** 25m 5s **|** 7d:2h **|** 5y 15d 50h 20m 95s`
        + `\n**|** friday **|** mon **|** 1 sat **|** 2 sun **|** tues at 6pm **|** wednesday at 4A **|** thurs at 12P PST**`,
    durationExamples: `**__In one of the forms:__\n- # Periods **(years; months; weeks; days; hours; minutes)**`
        + `\n- #y **(years)** : #d **(days)** : #h **(hours)** : #m **(minutes)** : #s **(seconds)** **`
        + `\n\ne.g. **5 days **|** 12 hours **|** 30 mins **|** 1 week **|** 4 months **|** 2 years`
        + `\n**|** 1y:2d:3h:30m:2s **|** 18h **|** 12m **|** 6m50s **|** 25m 5s **|** 7d:2h **|** 5y 15d 50h 20m 95s**`,
    confirmationInstructions: "✅ Accept: \'Y\' \'yes\' \'1\'\n❌ Decline: \'N\' \'no\' \'0\' \'2\'",
    areasOfLifeEmojis: ['🥦', '🧠', '📚', '🙏', '🗣', '💼', '🎓', '💸', '🏠'],
    areasOfLife: ["Physical Health", "Mental/Mindset", "Personal Development", "Spiritual",
        "Social", "Career", "Education", "Finances", "Physical Environment"],
    getAreasOfLifeEmojiCombinedArray: function () {
        var areasOfLifeCombined = new Array();
        this.areasOfLife.forEach((areaOfLife, i) => {
            areasOfLifeCombined.push(`${this.areasOfLifeEmojis[i] ? `${this.areasOfLifeEmojis[i]} ` : ""}${areaOfLife}`);
        });
        return areasOfLifeCombined;
    },
    getAreasOfLifeList: function () {
        var areasOfLifeList = new Array();
        this.getAreasOfLifeEmojiCombinedArray().forEach((areaOfLife, i) => {
            areasOfLifeList.push(`\`${i + 1}\` - **${areaOfLife}**`);
        });
        return areasOfLifeList;
    },
    getNumberOfDaysInMonthArray: function (year) {
        const daysInMonth = [31, 28 + this.isLeapYear(year) ? 1 : 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        return daysInMonth;
    },

    HOUR_IN_MS: HOUR_IN_MS,

    fastEmbedColour: "#32CD32",
    mastermindEmbedColour: "#FF6A00",
    journalEmbedColour: "#EE82EE",
    reminderEmbedColour: "#FFFF00",
    repeatReminderEmbedColour: "#FFFF66",
    goalsEmbedColour: "#007FFF",
    habitEmbedColour: "#0000FF",
    userSettingsEmbedColour: "#778899",
    guildSettingsEmbedColour: "#964b00",
    pesterEmbedColour: "#FF4500",
    quoteEmbedColour: "#FF69B4",
    trackEmbedColour: "#FF6347",
    taskEmbedColour: "#308014",
    defaultEmbedColour: "#ADD8E6",

    mastermindMaxTier1: 12,
    fastMaxTier1: 15,
    journalMaxTier1: 14,
    goalMaxTier1: 10,
    goalArchiveMaxTier1: 8,
    streakHabitMaxTier1: 1,
    habitMaxTier1: 10,
    habitArchiveMaxTier1: 8,
    reminderMaxTier1: 50,
    repeatMaxTier1: 30,

    REFRESH_COMMAND_SPAM_DELAY: 25000,
    REFRESH_MESSAGE_SPAM_DELAY: 30000,
    CLOSE_COMMAND_DELAY: 1800,
    CLOSE_MESSAGE_DELAY: 2500,
    CLOSE_COMMAND_SPAM_NUMBER: 8,
    CLOSE_MESSAGE_SPAM_NUMBER: 5,
};
