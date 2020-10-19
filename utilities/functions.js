/**
 * File of all the important and universally reusable functions!
 */
const Discord = require("discord.js");
const mongoose = require('mongoose');
const Reminder = require('../djs-bot/database/schemas/reminder');
const User = require('../djs-bot/database/schemas/user');
const Guild = require('../djs-bot/database/schemas/guildsettings');
const user = require("../djs-bot/database/schemas/user");
const DEFAULT_PREFIX = '?';
const TIMEOUT_MS = 375
require("dotenv").config();

// Private Function Declarations

module.exports = {
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

    getUserConfirmation: async function (message, confirmationMessage, forceSkip = false, embedTitle = "Confirmation", delayTime = 60000, deleteDelay = 3000,
        confirmationInstructions = "✅ to proceed\n❌ to cancel") {
        if (forceSkip === true) return true;
        const agree = "✅";
        const disagree = "❌";
        const userOriginal = message.author.id;
        const MS_TO_SECONDS = 1000;
        const footerText = `${confirmationInstructions}\n*(expires in ${delayTime / MS_TO_SECONDS}s)*`;
        var confirmation;
        const embed = this.getMessageEmbed(confirmationMessage, embedTitle, "#FF0000").setFooter(footerText);
        await message.channel.send(embed)
            .then(async confirm => {
                await this.quickReact(confirm, agree, 1);
                await this.quickReact(confirm, disagree, 2);
                const filter = (reaction, user) => {
                    const filterOut = user.id == userOriginal && (reaction.emoji.name == agree || reaction.emoji.name == disagree);
                    // console.log(`For ${user.username}'s ${reaction.emoji.name} reaction, the filter value is: ${filterOut}`);
                    return filterOut;
                };

                // Create the awaitReactions promise object for the confirmation message just sent
                confirmation = await confirm.awaitReactions(filter, { time: delayTime, max: 1 })
                    .then(reacted => {
                        console.log(`User's ${reacted.first().emoji.name} collected!`);
                        if (reacted.first().emoji.name == agree) {
                            confirm.delete();
                            this.sendMessageThenDelete(message, "Confirmed!", deleteDelay);
                            console.log(`Confirmation Value (in function): true`);
                            return true;
                        }
                        else {
                            confirm.delete();
                            console.log("Ending (confirmationMessage) promise...\nConfirmation Value (in function): false");
                            this.sendMessageThenDelete(message, "Exiting...", deleteDelay);
                            return false;
                        }
                    })
                    // When the user DOESN'T react!
                    .catch(err => {
                        console.error(err);
                        confirm.delete();
                        console.log(`ERROR: User didn't react within ${delayTime / MS_TO_SECONDS}s!`);
                        console.log("Ending (confirmationMessage) promise...\nConfirmation Value (in function): false");
                        this.sendMessageThenDelete(message, "Exiting...", deleteDelay);
                        return false;
                    });
            }).catch(err => console.error(err));
        return confirmation;
    },

    getPaginatedUserConfirmation: async function (bot, message, embedArray, confirmationMessage, forceSkip = false,
        embedTitle = "Confirmation", delayTime = 60000, deleteDelay = 3000,
        confirmationInstructions = "✅ to proceed\n❌ to cancel") {
        try {
            if (forceSkip === true) return true;
            const MS_TO_SECONDS = 1000;
            if (embedArray) {
                if (embedArray.length) {
                    confirmationInstructions += embedArray.length > 1 ? `\n⬅ to scroll left\n➡ to scroll right` : "";
                    const footerText = `${confirmationInstructions}\n*(expires in ${delayTime / MS_TO_SECONDS}s)*`;
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
            const confirmation = await this.getUserConfirmation(message, confirmationMessage, forceSkip,
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
            console.error(err);
            embed.delete();
            console.log(`ERROR: User didn't react within ${delayTime / MS_TO_SECONDS}s!`);
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
     * @param {String} prompt 
     * @param {String} title Default: "Message Reaction"
     * @param {String} colour Default: "#ADD8E6"
     * @param {Number} delayTime Default: 60000
     * @param {Boolean} showNewLineInstructions Default: true
     * @param {Boolean} getObject Default: false
     * @param {Boolean} deleteUserMessage Default: true
     * @param {Number} userMessageDeleteDelay Default: 0
     * @param {String | null} imageURL Default: null (No image will be attached) 
     * @param {String | null} additionalFooterText Default: null
     */
    messageDataCollect: async function (bot, message, prompt, title = "Message Reaction", colour = this.defaultEmbedColour, delayTime = 60000,
        showNewLineInstructions = true, getObject = false, deleteUserMessage = true, userMessageDeleteDelay = 0, imageURL = null, additionalFooterText = null) {
        const userOriginal = message.author.id;
        var result;
        const deleteDelay = 3000;
        const MS_TO_SECONDS = 1000;
        const footerText = `*(expires in ${delayTime / MS_TO_SECONDS}s)*${additionalFooterText ? `\n${additionalFooterText}` : ""}`;
        let textEntryInstructions = `🛑 - Type \`stop\` to **cancel**`;
        textEntryInstructions = `${showNewLineInstructions ? `\n\n↩ - Press \`SHIFT+ENTER\` to enter a **newline** before sending!` : "\n"}\n${textEntryInstructions}`;
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
                        if (deleteUserMessage) {
                            reacted.first().delete({ timeout: userMessageDeleteDelay });
                        }
                        if (getObject) return reacted.first();
                        else return reacted.first().content;
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

    // START of Mongoose Functions

    /**
     * 
     * @param {mongoose.Model} Model 
     * @param {[mongoose.objectId]} objectID 
     * Delete many by Object ID and each of the associated reminders.
     * _id - field for ObjectId convention (Parent)
     * connectedDocument - field for ObjectId reference to parent document (Child)
     */
    deleteManyByIDAndConnectedReminders: async function (Model, objectID) {
        try {
            const query = { _id: { $in: objectID } };
            const documents = await Model.find(query);
            console.log({ documents });
            if (!documents) {
                console.log(`No ${Model.modelName} documents (${objectID}) can be found...`);
                return false;
            }
            else {
                console.log(`Deleting ${Model.modelName} documents (${objectID}) and it's associated reminders...`);
                await Model.deleteMany(query);
            }
            documents.forEach(async (document, i) => {
                const reminders = await Reminder.deleteMany({ connectedDocument: documents[i]._id });
                if (reminders.deletedCount === 0) {
                    console.log(`No reminders associated to ${documents[i]._id.toString()}`);
                }
                else console.log(`Deleted ${reminders.deletedCount} reminders associated to ${documents[i]._id.toString()}`);
            });
            return true;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    /**
     * 
     * @param {mongoose.Model} Model 
     * @param {import("mongoose").MongooseFilterQuery} query In the form of an object (i.e. - {colour: red, objectType: "Function", count: 5})
     */
    deleteManyAndConnectedReminders: async function (Model, query) {
        try {
            console.log(`Deleting a ${Model.modelName} document and it's associated reminders\nQuery: ${query}`);
            const documents = await Model.find(query);
            console.log({ documents });
            if (!documents) {
                console.log(`No ${Model.modelName} documents found with query: ${query}, can be found...`);
                return false;
            }
            else {
                console.log(`Deleting a ${Model.modelName} document and it's associated reminders\nQuery: ${query}`);
                await Model.deleteMany(query);
            }
            documents.forEach(async (document, i) => {
                const reminders = await Reminder.deleteMany({ connectedDocument: documents[i]._id });
                if (reminders.deletedCount === 0) {
                    console.log(`No reminders associated to ${documents[i]._id.toString()}`);
                }
                else console.log(`Deleted ${reminders.deletedCount} reminders associated to ${documents[i]._id.toString()}`);
            });
            return true;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    /**
     * 
     * @param {mongoose.Model} Model 
     * @param {mongoose.objectId} objectID 
     * Delete one by Object ID and each of the associated reminders. Assumed Convention:
     * _id - field for ObjectId convention (Parent)
     * connectedDocument - field for reference to parent document (Child: ObjectId)
     */
    deleteOneByIDAndConnectedReminders: async function (Model, objectID) {
        try {
            const documents = await Model.findByIdAndDelete(objectID);
            console.log({ documents });
            if (!documents) {
                console.log(`No ${Model.modelName} document (${objectID.toString()}) can be found...`);
                return false;
            }
            else {
                console.log(`Deleting ${Model.modelName} document (${objectID.toString()}) and it's associated reminders...`);
            }

            const reminders = await Reminder.deleteMany({ connectedDocument: documents._id });
            if (reminders.deletedCount === 0) {
                console.log(`No reminders associated to ${documents._id.toString()}`);
            }
            else console.log(`Deleted ${reminders.deletedCount} reminders associated to ${documents._id.toString()}`);

            return true;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    /**
     * 
     * @param {mongoose.Model} Model 
     * @param {import("mongoose").MongooseFilterQuery} query In the form of an object (i.e. - {colour: red, objectType: "Function", count: 5})
     */
    deleteOneAndConnectedReminders: async function (Model, query) {
        try {
            console.log(`Deleting a ${Model.modelName} document and it's associated reminders\nQuery: ${query}`);
            const documents = await Model.findOneAndDelete(query);
            console.log({ documents });
            if (!documents) {
                console.log(`No ${Model.modelName} document found with query: ${query}, can be found...`);
                return false;
            }
            else {
                console.log(`Deleting a ${Model.modelName} document and it's associated reminders\nQuery: ${query}`);
            }

            const reminders = await Reminder.deleteMany({ connectedDocument: documents._id });
            const deletedCount = reminders.deletedCount;
            if (deletedCount === 0) {
                console.log(`No reminders associated to ${documents._id.toString()}`);
            }
            else console.log(`Deleted ${deletedCount} reminders associated to ${documents._id.toString()}`);

            return true;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    // END of Mongoose Functions

    /**
     * @param {String} string
     */
    toTitleCase: function (string) {
        try {
            if (string && typeof string === "string") {
                if (string.length > 0) {
                    string = string.replace(/(.+)([\s\n]+)/, (match, word, spacing, offset, string) => {
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

    userAndBotMutualServerIDs: async function (bot, userID, botServersIDs) {
        var botUserServers = new Array();
        for (i = 0; i < botServersIDs.length; i++) {
            if (await bot.guilds.cache.get(botServersIDs[i]).member(userID)) {
                botUserServers.push(botServersIDs[i]);
            }
        }
        return botUserServers;
    },

    listOfServerNames: async function (bot, serverIDs) {
        var serverListString = "";
        await serverIDs.forEach(async (server, serverIndex) => {
            let serverName = await bot.guilds.cache.get(server).name;
            serverListString = serverListString + `\`${serverIndex + 1}\` - **` + serverName + "**\n";
        });
        return serverListString;
    },

    // Note: This function displays values from 1 onwards but returns a properly indexed value (for arrays)
    userSelectFromList: async function (bot, PREFIX, message, list, numberOfEntries, instructions, selectTitle,
        messageColour = this.defaultEmbedColour, delayTime = 120000, userMessageDeleteDelay = 0, messageAfterList = "") {
        try {
            let spamDetails = {
                lastTimestamp: null,
                closeMessageCount: 0,
            };
            do {
                targetIndex = await this.messageDataCollect(bot, message, `${instructions}\n${list}\n${messageAfterList}`, selectTitle,
                    messageColour, delayTime, false, false, true, userMessageDeleteDelay);
                if (targetIndex.startsWith(PREFIX) && targetIndex !== PREFIX) {
                    message.reply(`Any **command calls** while writing a message will **stop** the collection process.\n**__Command Entered:__**\n${targetIndex}`);
                    targetIndex = "stop";
                }
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
                // Spam Prevention:
                if (spamDetails) {
                    const messageSendDelay = Date.now() - spamDetails.lastTimestamp || 0;
                    console.log({ messageSendDelay });
                    spamDetails.lastTimestamp = Date.now();
                    if (messageSendDelay < 2500) {
                        spamDetails.closeMessageCount++;
                    }
                    if (spamDetails.closeMessageCount >= 5) {
                        console.log("Exiting due to spam...");
                        message.reply("**Exiting... __Please don't spam!__**");
                        return false;
                    }
                    if (spamDetails.closeMessageCount === 0) {
                        setTimeout(() => {
                            if (spamDetails) spamDetails.closeMessageCount = 0;
                        }, 30000);
                    }
                    console.log({ spamDetails })
                }
            }
            while (true);
            return targetIndex;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    listOfServerTextChannelsUserCanSendTo: async function (bot, userOriginalMessageObject, serverID) {
        const channelList = await bot.guilds.cache.get(serverID).channels.cache.map(channel => {
            const userPermissions = channel.permissionsFor(userOriginalMessageObject.author);
            if (!userPermissions) return null;
            else if (userPermissions.has("SEND_MESSAGES") && userPermissions.has("VIEW_CHANNEL") && channel.type === "text") {
                return channel.id;
            }
            else return null;
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
     * @param {Number} ordinalDayOfWeek First, Second, Third, Fourth...
     */
    getUTCTimestampOfDayOfWeek: function (year, targetMonth, targetDayOfWeek, ordinalDayOfWeek) {
        const DAY_IN_MS = this.getTimeScaleToMultiplyInMs("day");
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

    getDaylightSavingTimeStartAndEndTimestampInMs: function (targetTimestamp) {
        if (isNaN(targetTimestamp)) return false;
        // Step 1: Convert the timestamp to since since Jan 1, xxxx (of the given timestamp's year!)
        const HOUR_IN_MS = this.getTimeScaleToMultiplyInMs("hour");
        const targetDate = new Date(targetTimestamp);
        const targetYear = targetDate.getUTCFullYear();
        // Step 2: Find the timestamp of the second Sunday of March at 2:00AM
        // And first Sunday of November at 2:00AM
        let daylightStartTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 2, 0, 2) + (2 * HOUR_IN_MS);
        let daylightEndTimestamp = this.getUTCTimestampOfDayOfWeek(targetYear, 10, 0, 1) + (2 * HOUR_IN_MS);
        daylightEndTimestamp += 2 * HOUR_IN_MS;
        console.log({ targetDate, daylightStartTimestamp, daylightEndTimestamp });
        return [daylightStartTimestamp, daylightEndTimestamp];
    },

    /**
     * 
     * @param {Number} targetTimestamp UTC Timestamp to be checked for falling within UTC Daylight Saving Time
     * @param {Boolean} userDaylightSavingSetting If the user opted for having Daylight Saving Time adjustments
     */
    isDaylightSavingTime: function (targetTimestamp, userDaylightSavingSetting) {
        console.log({ targetTimestamp });
        if (userDaylightSavingSetting === false)
            return false;
        else {
            const daylightSavingTimeArray = this.getDaylightSavingTimeStartAndEndTimestampInMs(targetTimestamp);
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
        for (i = startingIndex; i < array.length - 1; i++) {
            if (!isNaN(array[i])) skipCounter++;
            if (skipCounter === skipToNthIndex) return i;
        }
        return -1;
    },

    getProperDateAndTimeArray: function (dateTimeArray, adjustedArgs, dayYearTimeOffset = 0) {
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
            // **POTENTIAL PROBLEM/ISSUE** - the year will be off at New Year's when different people are in different
            // years depending on their timezone offset
            year = new Date().getUTCFullYear();
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
        if (allUndefined) return false;
        else {
            const [hours, minutes, amPmString, timezoneString] = timeArray;
            return [year, day, hours, minutes, amPmString, timezoneString];
        }
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
        console.log({ timezoneFormat });
        if (timezoneFormat) {
            const sign = timezoneFormat[1];
            const hours = parseInt(timezoneFormat[2]);
            if (hours < -12 || hours > 14) return null;
            const minutes = parseInt(timezoneFormat[3]);
            if (minutes >= 60) return null;
            const offset = hours + (minutes / 60);
            console.log({ offset })
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
                    // Irish Standard Time
                    case "irst": timezoneOffset = 1;
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
                    case "wst": timezoneOffset = 8;
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
        console.log({ timezoneOffset });
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

    getTimezoneDaylightOffset: function (timezoneString) {
        /**
         * List of Potential Spring Forward Timezones:
         * Australian Central,
         * Australian Eastern,
         * Alaska Standard Time,
         * Amazon Time (Brazil),
         * Atlantic Standard Time,
         * Azores Standard Time,
         * Brasília Time,
         * British Summer Time?**,
         * Central Standard Time (North America),
         * Cuba Standard Time,
         * Central European Time,
         * Chatham Standard Time,
         * Choibalsan Standard Time,
         * Chile Standard Time,
         * Colombia Time,
         * Easter Island Standard Time,
         * Eastern Standard Time (North America),
         * Eastern European Time,
         * Eastern Greenland Time,
         * Falkland Islands Time,
         * Hawaii–Aleutian Standard Time,
         * Hovd Time (not used from 2017-present)**,
         * Israel Daylight Time,
         * Iran Standard Time,
         * Lord Howe Standard Time** LHST: UTC-10:30-11 (NOT FULL HOUR),
         * Mountain Standard Time (North America),
         * Middle European Time,
         * Newfoundland Daylight Time,
         * New Zealand Standard Time,
         * Pacific Standard Time (North America),
         * Saint Pierre and Miquelon Standard Time,
         * Paraguay Time,
         * Samoa Time,
         * Ulaanbaatar Standard Time,
         * Uruguay Standard Time,
         * West Africa Time,
         * Western European Time,
         * West Greenland Time,
         */
        if (timezoneString) {
            timezoneString = timezoneString.toLowerCase();
            const summerTimeTimezoneRegex = /(acst|aest|aet|akst|amt|ast|azot|brt|cst|cust|cubst|cubat|cuba|cet|chast|chot|clt|cot|east|est|eet|egt|fkt|hst|hovt|isrst|isst|irst|mst|met|nst|nt|nzst|pst|pmst|pyt|sst|ulat|uyt|wat|wet|wgt)/;
            const halfHourSummerRegex = /(lhst)/;
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
    // Have a truth value on for if Daylights Savings Time!!!

    // Using Regular Expressions
    // Assumes that the userTimezone is already daylight-savings adjusted
    timeCommandHandlerToUTC: function (args, messageCreatedTimestamp, userTimezone = -4, userDaylightSavingSetting = true) {
        if (!Array.isArray(args) && typeof args === 'string') {
            args = args.toLowerCase().split(/[\s\n]+/);
        }

        const HOUR_IN_MS = this.getTimeScaleToMultiplyInMs("hour");
        if (args[0].toLowerCase() === "now") {
            return this.getUTCOffsetAdjustedTimestamp(messageCreatedTimestamp, userTimezone, userDaylightSavingSetting);
        }

        // Convert from space separated arguments to time arguments
        // Step 1: Combine any Dates/Times space separated
        const adjustedArgs = args.join(" ").split(/[\.\s\/\,\-]/).filter(args => args != "");
        console.log({ args, adjustedArgs });
        const timeArgs = args.join("").toLowerCase();
        console.log({ timeArgs });

        // Relative Time: Past and Future
        const relativeTimeAgoOrFromNow = /(in)?(\d+\.?\d*|\d*\.?\d+)(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|yrs?)(ago|prior|before|fromnow|later(?:today)?|inthefuture)?(?:at)?(?:(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?)?/;
        const relativeTimeTest = relativeTimeAgoOrFromNow.exec(timeArgs);
        console.log({ relativeTimeTest });
        const dayOfWeekRegex = /(in)?((?:\d+)|(?:last|past|next|this(?:coming)?|following|previous|prior))?((?:yesterday)|(?:yest?)|(?:thedaybefore)|(?:tod(?:ay)?)|(?:tomorrow)|(?:tom)|(?:tmrw?)|(?:mondays?)|(?:mon)|(?:tuesdays?)|(?:tu(?:es?)?)|(?:wednesdays?)|(?:weds?)|(?:thursdays?)|(?:th(?:urs?)?)|(?:fridays?)|(?:f(?:ri?)?)|(?:saturdays?)|(?:sat)|(?:sundays?)|(?:sun?))(ago|prior|before|fromnow|later|inthefuture)?(?:at)?(?:(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?)?/;
        const dayOfWeekTest = dayOfWeekRegex.exec(timeArgs);
        console.log({ dayOfWeekTest });
        // Absolute Time: Past and Future
        const absoluteTimeRegex = /(\d{1,2})[\/\.\,\-](\d{1,2})(?:[\/\.\,\-](\d{1,4}))?(?:at)?(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?/;
        const absoluteTimeTest = absoluteTimeRegex.exec(timeArgs);
        console.log({ absoluteTimeTest });
        // Force the user to separate the date and year (if there is a year - this becomes an indicator for separation)
        const monthTimeRegex = /((?:january)|(?:jan?)|(?:february)|(?:feb?)|f|(?:march)|(?:mar)|(?:april)|(?:apr?)|(?:may)|(?:june?)|(?:july?)|(?:august)|(?:aug?)|(?:september)|(?:sept?)|(?:october)|(?:oct)|(?:november)|(?:nov?)|(?:december)|(?:dec?))[\.\,]?(\d{1}(?:\d{1})?)(?:[\/\.\,\-](\d{1,4}))?(?:at)?(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?/;
        const monthTimeTest = monthTimeRegex.exec(timeArgs);
        console.log({ monthTimeTest });
        const yearDayHourMinuteRegex = /(in)?(?:((?:\d+\.?\d*|\d*\.?\d+)y))?\:?(?:((?:\d+\.?\d*|\d*\.?\d+)d))?\:?(?:((?:\d+\.?\d*|\d*\.?\d+)h))?\:?(?:((?:\d+\.?\d*|\d*\.?\d+)m))?\:?(?:((?:\d+\.?\d*|\d*\.?\d+)s))?(?<!\:+|^$)(ago|prior|before|fromnow|later(?:today)?|inthefuture)?(?:at|in|with)?((?:[a-z]+)|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)\:?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?/;
        const yearDayHourMinuteTest = this.adjustYearDayHourMinuteTest(yearDayHourMinuteRegex.exec(timeArgs), adjustedArgs);
        console.log({ yearDayHourMinuteTest });

        // 1 - Relative Time; 2 - Day Of Week;
        // 3 - Absolute Time; 4 - Month And Time;
        // 5 - Year-Day-Hour-Minute;
        const decision = this.getTimeTestChoice(relativeTimeTest, dayOfWeekTest, absoluteTimeTest, monthTimeTest, yearDayHourMinuteTest);
        console.log({ decision });
        // 0 - All choices we're null or insufficient/not chosen.
        if (!decision) return false;
        else {
            const RELATIVE_ADJUSTMENT = 700;
            if (decision === 1 || decision === 5) messageCreatedTimestamp = Date.now() + RELATIVE_ADJUSTMENT;
            var timestampOut, timezoneString, timeWasCalculated;
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
                        let timeDifference = numberOfTimeScales * timeScaleToMultiply;

                        if (isLongTimeScale) {
                            const timeArray = this.getUTCTimeArray(messageCreatedTimestamp + HOUR_IN_MS * userTimezone);
                            let [year, month, day, hour, minute, second, millisecond] = timeArray;
                            console.log({ year, month, day, hour, minute, second, millisecond });
                            const militaryTimeString = argsHaveDefinedTime ? this.getMilitaryTimeStringFromProperTimeArray(properTimeArray) : "00:00";
                            console.log({ militaryTimeString });
                            const timeAdjustment = this.getTimePastMidnightInMs(militaryTimeString);
                            console.log({ timeAdjustment });
                            // For the case of Days, timeDifference is simply numberOfTimeScales * timeScaleToMultiply
                            // But for the case of Months and Years, proper adjustments must be made.
                            const isYearTimeScale = timeScaleToMultiply === this.getTimeScaleToMultiplyInMs("year");
                            const isMonthTimeScale = timeScaleToMultiply === this.getTimeScaleToMultiplyInMs("month");
                            if (isYearTimeScale || isMonthTimeScale) {
                                // Mutually Exclusive Conditions
                                if (isYearTimeScale) {
                                    year += numberOfTimeScales;
                                }
                                else {
                                    month += numberOfTimeScales;
                                    // The month auto-adjust to negative values of hours
                                }
                                if (argsHaveDefinedTime) {
                                    const splitTimeAdjustment = this.getHoursMinutesSecondsMillisecondsArray(timeAdjustment);
                                    console.log({ splitTimeAdjustment });
                                    hour = splitTimeAdjustment[0];
                                    minute = splitTimeAdjustment[1];
                                    second = splitTimeAdjustment[2];
                                    millisecond = splitTimeAdjustment[3];
                                }
                                console.log({ year, month, day, hour, minute, second, millisecond });
                                timestampOut = new Date(year, month, day, hour, minute, second, millisecond).getTime();
                                if (timestampOut < 0 && !argsHaveDefinedTime) {
                                    timestampOut -= HOUR_IN_MS;
                                }
                                timeWasCalculated = true;
                                console.log({ timestampOut });
                            }
                            // Days and Weeks:
                            else {
                                if (argsHaveDefinedTime) {
                                    const DAY_IN_MS = this.getTimeScaleToMultiplyInMs("day");
                                    timeDifference += DAY_IN_MS + timeAdjustment - this.getTimeSinceMidnightInMsUTC(messageCreatedTimestamp, userTimezone);
                                }
                            }
                        }

                        console.log({ timestampOut, timeDifference, timeScaleToMultiply, numberOfTimeScales });
                        if (timestampOut === undefined) {
                            timestampOut = messageCreatedTimestamp + timeDifference;
                        }
                    }
                    break;
                case 2:
                    if (dayOfWeekTest) {
                        console.log("Day of Week test...");
                        const numberOfTimeScales = this.getRelativeDayTimeScale(dayOfWeekTest, userTimezone);
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
                        // const timezoneOffset = timezoneString ? this.getTimezoneOffset(timezoneString) : userTimezone;
                        // If no time arguments:
                        if (!this.getNumberOfDefinedElements(timeExpression)) {
                            // hour += timezoneOffset;
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
                        timeWasCalculated = true;
                        console.log({ timestampOut });
                    }
                    break;
                case 3:
                    if (absoluteTimeRegex) {
                        console.log("Absolute Time test...");
                        const properDateTimeArray = this.getProperDateAndTimeArray(absoluteTimeTest, adjustedArgs, 1);
                        console.log({ properDateTimeArray });
                        if (!properDateTimeArray) return false;

                        // Now deal with the validity of the given date and time
                        const yearMonthDay = this.getValidYearMonthDay(properDateTimeArray[0], absoluteTimeTest[1], properDateTimeArray[1]);
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
                        timeWasCalculated = true;
                    }
                    break;
                case 4:
                    if (monthTimeTest) {
                        // If the first element is defined: (i.e. the month)
                        if (monthTimeTest[1]) {
                            console.log("Relative Month and Absolute Time test...");
                            const properDateTimeArray = this.getProperDateAndTimeArray(monthTimeTest, adjustedArgs, 1);
                            console.log({ properDateTimeArray });
                            if (!properDateTimeArray) return false;

                            // Now deal with the validity of the given date and time
                            const yearMonthDay = this.getValidYearMonthDay(properDateTimeArray[0], monthTimeTest[1], properDateTimeArray[1]);
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
                            timeWasCalculated = true;
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
                        const date = new Date(messageCreatedTimestamp);
                        let year = date.getUTCFullYear();
                        const month = date.getUTCMonth();
                        let day = date.getUTCDate();
                        let hour = date.getUTCHours() + userTimezone;
                        let minute = date.getUTCMinutes();
                        let second = date.getUTCSeconds();
                        for (i = 2; i <= 6; i++) {
                            if (yearDayHourMinuteTest[i]) {
                                // Extract y-h-d-m-s
                                const timeScale = /(\d+\.?\d*|\d*\.?\d+)(\w)/.exec(yearDayHourMinuteTest[i]);
                                if (timeScale) {
                                    switch (timeScale[2]) {
                                        case 'y': year += timeScale[1] * futurePastMultiple;
                                            break;
                                        case 'd': day += timeScale[1] * futurePastMultiple;
                                            break;
                                        case 'h': hour += timeScale[1] * futurePastMultiple;
                                            break;
                                        case 'm': minute += timeScale[1] * futurePastMultiple;
                                            break;
                                        case 's': second += timeScale[1] * futurePastMultiple;
                                            break;
                                    }
                                }
                            }
                        }
                        timestampOut = new Date(year, month, day, hour, minute, second).getTime();
                        timezoneString = yearDayHourMinuteTest[8];
                        timeWasCalculated = true;
                    }
                    break;
            }
        }

        // Daylights Savings Adjustment:
        if (timeWasCalculated && userDaylightSavingSetting) {
            const userCurrentTimeIsDaylight = this.isDaylightSavingTime(messageCreatedTimestamp, userDaylightSavingSetting);
            const outputTimeIsDaylight = this.isDaylightSavingTime(timestampOut, userDaylightSavingSetting);
            console.log({ outputTimeIsDaylight, userCurrentTimeIsDaylight });
            if (userCurrentTimeIsDaylight) {
                if (!outputTimeIsDaylight) {
                    timestampOut -= HOUR_IN_MS;
                }
            }
            else {
                if (outputTimeIsDaylight) {
                    timestampOut += HOUR_IN_MS;
                }
            }
        }

        // Adjust output based on timezone and daylight saving time considerations
        if (timestampOut !== undefined) {
            console.log({ timestampOut, timezoneString, userTimezone, userDaylightSavingSetting });
            timestampOut = this.getUTCOffsetAdjustedTimestamp(timestampOut, userTimezone, userDaylightSavingSetting, timezoneString);
            console.log({ timestampOut });
            if (isNaN(timestampOut)) return false;
            else return timestampOut;
        }
        else timestampOut = false;
    },

    /**
     * 
     * @param {number} year 
     * @param {number | string} month 
     * @param {number} day 
     */
    getValidYearMonthDay: function (year, month, day) {
        year = parseInt(year);
        if (year < 0) return false;
        if (year <= 99) {
            const currentMillennium = Math.floor((new Date().getUTCFullYear()) / 1000) * 1000;
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

    /**
     * 
     * @param {RegExpExecArray} relativeTimeTest 1
     * @param {RegExpExecArray} dayOfWeekTest 2
     * @param {RegExpExecArray} absoluteTimeTest 3 
     * @param {RegExpExecArray} monthTimeTest 4
     * @param {RegExpExecArray} yearDayHourMinuteTest 5
     * Will return 0 if all are null.
     */
    getTimeTestChoice: function (relativeTimeTest, dayOfWeekTest, absoluteTimeTest, monthTimeTest, yearDayHourMinuteTest) {
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
        if (absoluteTimeTest) {
            absoluteTimeElements = this.getNumberOfDefinedElements(absoluteTimeTest)
            if (absoluteTimeElements > 3) {
                choice = 3;
            }
        }
        if (monthTimeTest) {
            monthTimeElements = this.getNumberOfDefinedElements(monthTimeTest);
            if (monthTimeElements > 3) {
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
            if (yearDayHourMinuteElements >= 2) {
                if (relativeTimeElements) {
                    if (relativeTimeElements < 4) {
                        choice = 5;
                    }
                }
                else if (dayOfWeekElements) {
                    if (dayOfWeekElements < 4) {
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

    getRelativeDayTimeScale: function (relativeTimeExpressionArray, timezone) {
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
            let relativeDay = /((?:\d+)|(?:last|past|next|this(?:coming)?|following|previous|prior))/.exec(relativeTimeExpressionArray[2]);
            let isDigit = /(?:\d+)/.test(relativeDay);
            if (!relativeDay) {
                relativeDay = "this";
                isThis = true;
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
            else if (/thiscoming/.test(relativeDay)) {
                numberOfTimeScales = 0;
            }
            else if (/this/.test(relativeDay)) {
                numberOfTimeScales = 0;
                isThis = true;
            }
            else return false;

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
            const HOUR_IN_MS = this.getTimeScaleToMultiplyInMs("hour");
            let currentDate = new Date(Date.now() + timezone * HOUR_IN_MS);
            let currentDayOfWeek = currentDate.getUTCDay();
            console.log({ currentDate, currentDayOfWeek, targetDayOfWeek });
            const isPastDay = targetDayOfWeek < currentDayOfWeek;

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
        const MS_PER_HOUR = this.getTimeScaleToMultiplyInMs("hour");
        const MS_PER_MINUTE = this.getTimeScaleToMultiplyInMs("minute");
        const MS_PER_SECOND = this.getTimeScaleToMultiplyInMs("second");
        const hours = Math.floor(milliseconds / MS_PER_HOUR);
        const minutes = Math.floor((milliseconds - MS_PER_HOUR * hours) / MS_PER_MINUTE);
        const seconds = Math.floor((milliseconds - MS_PER_HOUR * hours - MS_PER_MINUTE * minutes) / MS_PER_SECOND);
        const ms = milliseconds - MS_PER_HOUR * hours - MS_PER_MINUTE * minutes - MS_PER_SECOND * seconds;
        return [hours, minutes, seconds, ms];
    },

    timestampToDateString: function (timestamp, showTime = true, showDayOfWeek = false, monthInText = false) {
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
     * 
     * @param {number} timestamp timestamp to adjust
     * @param {number} userDefaultTimezone User Timezone UTC Offset
     * @param {boolean} userDaylightSavingSetting 
     * @param {number|string} timezone give timezone in string form or UTC integer offset form
     */
    getUTCOffsetAdjustedTimestamp: function (timestamp, userDefaultTimezone, userDaylightSavingSetting, timezone = undefined) {
        if (timestamp === undefined || timestamp === null) return undefined;
        const HOUR_IN_MS = this.getTimeScaleToMultiplyInMs("hour");
        var timezoneOffset;
        timezoneOffset = timezone ? this.getTimezoneOffset(timezone) : userDefaultTimezone;
        console.log({ timestamp, timezoneOffset });
        timestamp += (HOUR_IN_MS * timezoneOffset);
        if (this.isDaylightSavingTime(timestamp, userDaylightSavingSetting)) {
            const daylightSavingAdjustment = this.getTimezoneDaylightOffset(timezone);
            console.log({ daylightSavingAdjustment });
            timestamp += (HOUR_IN_MS * daylightSavingAdjustment);
        }
        return timestamp;
    },

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
        const SECOND_IN_MS = 1000;
        const MINUTE_IN_MS = 60000;
        const HOUR_IN_MS = 3.6e+6;
        const DAY_IN_MS = 8.64e+7;
        const WEEK_IN_MS = 6.048e+8;
        const MONTH_IN_MS = 2.628e+9;
        // const YEAR_IN_MS = DAY_IN_MS * 365;
        const YEAR_IN_MS = 3.154e+10;
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
            case 'm':
                if (/(months?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = MONTH_IN_MS;
                }
                break;
            case 'y':
                if (/(years?)/.test(relativeTimeScale)) {
                    timeScaleToMultiply = YEAR_IN_MS;
                }
                break;
        }
        return timeScaleToMultiply;
    },

    isLongTimeScale: function (relativeTimeScale) {
        const longTimeScalesRegex = /(days?|weeks?|months?|years?)/;
        return longTimeScalesRegex.test(relativeTimeScale);
    },

    // Assuming the militaryTimeString is correctly formatted.
    getTimePastMidnightInMs: function (militaryTimeString) {
        const HOUR_IN_MS = 3.6e+6;
        const MINUTE_IN_MS = 60000;
        var timePastMidnight = 0;
        const timeArray = this.getMilitaryTimeHoursAndMinsArray(militaryTimeString);
        timePastMidnight += parseInt(timeArray[1]) * HOUR_IN_MS;
        timePastMidnight += parseInt(timeArray[2]) * MINUTE_IN_MS;
        console.log({ militaryTimeString, timeArray, timePastMidnight });
        return timePastMidnight;
    },

    getTimeSinceMidnightInMsUTC: function (timeInMS, UTCHourOffset = 0) {
        const DAY_IN_MS = 8.64e+7;
        const HOUR_IN_MS = 3.6e+6;
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
        const defaultTime = "00:00:00";
        if (isNaN(milliseconds)) return defaultTime;
        const DAY_IN_MS = this.getTimeScaleToMultiplyInMs("day");
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
                    type = this.toTitleCase(type);
                    if (type) type += " "; // To add a space at the end
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

    getEditEndConfirmation: async function (message, field, userEdit, type, forceSkip = false) {
        const resetWarningMessage = `**Are you sure you want to change your ${field} to:**\n${userEdit}`;
        let endEditConfirmation = await this.getUserConfirmation(message, resetWarningMessage, forceSkip, `${this.toTitleCase(type)}: Edit ${field} Confirmation`, 60000, 0);
        return endEditConfirmation;
    },

    getBackToMainMenuConfirmation: async function (message, forceSkip) {
        const backToMainEditMessage = "Are you sure you want to go **back to the main edit menu?**";
        const backToMainEdit = await this.getUserConfirmation(message, backToMainEditMessage, forceSkip, "Edit: Back to Main Menu");
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
    getUserEditString: async function (bot, message, field, instructionPrompt, type, forceSkip = false, embedColour = this.defaultEmbedColour) {
        var collectedEdit, reset;
        let editMessagePrompt = `**What will you change your *${field}* to?:**${instructionPrompt ? `\n${instructionPrompt}\n` : "\n"}`;
        editMessagePrompt = editMessagePrompt + `\nType \`back\` to go **back to the main edit menu**`;
        do {
            reset = false;
            collectedEdit = await this.messageDataCollect(bot, message, editMessagePrompt, `${this.toTitleCase(type)}: Edit`, embedColour, 600000);
            if (collectedEdit === "stop") return false;
            else if (!collectedEdit) return "back";
            else if (collectedEdit === "back") {
                const backToMainEdit = await this.getBackToMainMenuConfirmation(message, forceSkip);
                if (backToMainEdit === false) reset = true;
                else return collectedEdit;
            }
            if (!reset) {
                const confirmEdit = await this.getEditEndConfirmation(message, field, collectedEdit, type, forceSkip);
                if (!confirmEdit) {
                    reset = true;
                }
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
    getUserEditBoolean: async function (bot, message, field, instructionPrompt, emojiArray, type, forceSkip = false, embedColour = this.defaultEmbedColour) {
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
                const backToMainEdit = await this.getBackToMainMenuConfirmation(message, forceSkip);
                if (backToMainEdit === false) reset = true;
                else return collectedEdit;
            }
            if (!reset) {
                const confirmEdit = await this.getEditEndConfirmation(message, field, collectedEdit, type, forceSkip);
                if (!confirmEdit) {
                    reset = true;
                }
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
    getUserMultilineEditString: async function (bot, PREFIX, message, field, instructionPrompt, type, forceSkip = false, embedColour = this.defaultEmbedColour) {
        let spamDetails = {
            lastTimestamp: null,
            closeMessageCount: 0,
        };
        let messageIndex = 0;
        let reset = false;
        var collectedEdit, userEdit = new Array();
        let editMessagePrompt = `**What will you change your *${field}* to?:**${instructionPrompt ? `\n${instructionPrompt}\n` : "\n"}`;
        editMessagePrompt = editMessagePrompt + `\nType \`0\` to **restart/clear** your current edit!`
            + `\nType \`1\` when you're **done!**\nType \`2\` to **undo** the previously typed edit\nType \`back\` to go **back to the main edit menu**`;
        const originalEditMessagePrompt = editMessagePrompt;
        do {
            messageIndex++;
            collectedEdit = await this.messageDataCollect(bot, message, editMessagePrompt, `${this.toTitleCase(type)}: Edit`,
                embedColour, 600000, false, false, true, 3000, false, `Character Count: ${userEdit.join('\n').length}`);
            if (collectedEdit) {
                if (collectedEdit.startsWith(PREFIX) && collectedEdit !== PREFIX) {
                    message.reply(`Any **command calls** while writing a message will **stop** the collection process.\n**__Command Entered:__**\n${collectedEdit}`);
                    collectedEdit = false;
                }
                // Spam Prevention:
                else if (spamDetails && collectedEdit !== "0" && collectedEdit !== "1"
                    && collectedEdit !== "2" && collectedEdit !== "stop") {
                    const messageSendDelay = Date.now() - spamDetails.lastTimestamp || 0;
                    console.log({ messageSendDelay });
                    spamDetails.lastTimestamp = Date.now();
                    if (messageSendDelay < this.CLOSE_MESSAGE_DELAY) {
                        spamDetails.closeMessageCount++;
                    }
                    if (spamDetails.closeMessageCount >= this.CLOSE_MESSAGE_SPAM_NUMBER) {
                        console.log("Exiting due to spam...");
                        message.reply("**Exiting... __Please don't spam!__**");
                        return false;
                    }
                    if (spamDetails.closeMessageCount === 0) {
                        setTimeout(() => {
                            if (spamDetails) spamDetails.closeMessageCount = 0;
                        }, this.REFRESH_SPAM_DELAY);
                    }
                }
            }
            if (!collectedEdit || collectedEdit === "stop") {
                if (collectedEdit !== "stop") {
                    message.channel.send(`This was your **${field} edit!**:\n${userEdit.join('\n')}`);
                }
                return false;
            }
            else if (collectedEdit.length + userEdit.join('\n').length > 6000) {
                message.reply("Your edit was **too long** (*over 6000 characters*), so I had to **stop** collecting it.");
                return false;
            }
            if (messageIndex === 1 || reset === true) {
                if (collectedEdit === "1") {
                    if (userEdit.join('\n').length > 2000) {
                        message.reply(`Your edit is too long (must be __less than 2000 characters__ long)`
                            + `\nTry undoing some line entries by typing \`2\` or reset your edit by typing \`0\``);
                    }
                    const endEditConfirmation = await this.getEditEndConfirmation(message, field, userEdit.join('\n'), type, forceSkip);
                    if (endEditConfirmation === true) {
                        break;
                    }
                }
                else if (collectedEdit !== "0" && collectedEdit !== "back" && collectedEdit !== "2") {
                    editMessagePrompt = `${editMessagePrompt}\n\n**Current Edit:**\n${collectedEdit}\n`;
                    userEdit.push(collectedEdit);
                    reset = false;
                }
                else if (collectedEdit === "back") {
                    const backToMainEdit = await this.getBackToMainMenuConfirmation(message, forceSkip);
                    if (backToMainEdit === true) {
                        userEdit = "back";
                        break;
                    }
                }
                else messageIndex = 0;
            }
            else if (collectedEdit === "back") {
                const backToMainEdit = await this.getBackToMainMenuConfirmation(message, forceSkip);
                if (backToMainEdit === true) {
                    userEdit = "back";
                    break;
                }
            }
            else if (collectedEdit === "1") {
                if (userEdit.join('\n').length > 2000) {
                    message.reply(`Your edit is too long (must be __less than 2000 characters__ long)`
                        + `\nTry undoing some line entries by typing \`2\` or reset your edit by typing \`0\``);
                }
                const endEditConfirmation = await this.getEditEndConfirmation(message, field, userEdit.join('\n'), type, forceSkip);
                if (endEditConfirmation === true) {
                    break;
                }
            }
            else if (collectedEdit === "0") {
                if (userEdit === "") {
                    reset = true;
                }
                else {
                    const resetWarningMessage = "Are you sure you want to __**reset**__ your current edit?\n*(All of your current edit will be lost...)*";
                    const resetConfirmation = await getUserConfirmation(message, resetWarningMessage, false, `${this.toTitleCase(type)}: Edit ${field} Reset`);
                    if (resetConfirmation === true) {
                        editMessagePrompt = originalEditMessagePrompt;
                        userEdit = new Array();
                        reset = true;
                    }
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
                            fn.sendMessageThenDelete(message, `**Sorry <@!${message.author.id}>, I could not undo the last typed edit!**`, 30000);
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
    getUserEditNumber: async function (bot, message, field, maxNumber, type, numberMappingArray = false, forceSkip = false, embedColour = this.defaultEmbedColour, additionalInstructions = '') {
        var collectedEdit;
        const numberErrorMessage = `**Please Enter a Number from 1-${maxNumber}**`;
        let editMessagePrompt = `**What will you change your *${field}* to?:**`
        editMessagePrompt += `\n${additionalInstructions === '' ? `***(Please enter a number from \`1-${maxNumber}\`)***` : additionalInstructions}`
            + `\n\nType \`back\` to go **back to the main edit menu**`;
        while (true) {
            collectedEdit = await this.messageDataCollect(bot, message, editMessagePrompt, `${this.toTitleCase(type)}: Edit`, embedColour, 600000);
            if (collectedEdit === "stop") return false;
            else if (!collectedEdit) return "back";
            // Check if the given message is a number
            else if (isNaN(collectedEdit)) {
                if (collectedEdit === "back") {
                    const backToMainEdit = await this.getBackToMainMenuConfirmation(message, forceSkip);
                    if (backToMainEdit === true) return collectedEdit;
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
                    let confirmEdit = await this.getEditEndConfirmation(message, field, showEdit, type, forceSkip);
                    if (confirmEdit === true) return collectedEdit;
                }
            }
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

                collector.on('collect', async (reaction, user) => {
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
                            await embed.delete();
                            return;
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
                && !timezoneObject.daylightSavings && timezoneObject.daylightSavings !== false) {
                return false;
            }
            const user = bot.users.cache.get(userID);
            userDaylightSavingsSettings = timezoneObject.daylightSavings;
            const daylightOffset = this.isDaylightSavingTime(Date.now(), userDaylightSavingsSettings) ?
                this.getTimezoneDaylightOffset(timezoneObject.name) : 0;
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
                    name: timezoneObject.name,
                    offset: timezoneObject.offset + daylightOffset,
                    daylightSavings: userDaylightSavingsSettings,
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
        const userTimezone = await this.messageDataCollect(bot, message, `Please enter ${userAddressPossessive} __**current timezone**__ as an **abbreviation** OR **+/- UTC Offset**.\n\n(e.g. EST or +08:45 or -9)`,
            "User Settings: Setup", this.userSettingsEmbedColour, 300000, false);
        if (!userTimezone || userTimezone === "stop") return false;
        const userTimezoneOffset = this.getTimezoneOffset(userTimezone);
        if (!userTimezoneOffset && userTimezoneOffset !== 0) {
            message.reply("**This __timezone does not exist__... Try again!**");
            return false;
        }
        let userDaylightSavingsSetting = await this.reactionDataCollect(bot, message, `Does ${userAddressPossessive} timezone participate in **Daylight Savings Time (DST)?**\n**⌚ - Yes\n⛔ - No\n❌ - Exit**`,
            ['⌚', '⛔', '❌'], "User Settings: Setup", this.userSettingsEmbedColour, 300000);
        switch (userDaylightSavingsSetting) {
            case '⌚': userDaylightSavingsSetting = true;
                break;
            case '⛔': userDaylightSavingsSetting = false;
                break;
            // For the ❌ - return...
            default: userDaylightSavingsSetting = null;
                break;
        }
        if (typeof userDaylightSavingsSetting === 'boolean') {
            const confirmSettings = await this.getUserConfirmation(message, `**__Are you sure ${userAddress} want${forSelf ? "" : "s"} the following settings?:__**`
                + `\n⌚ - Timezone: **${userTimezone}**`
                + `\n🌄 - Daylight Savings Time (DST)?: **${userDaylightSavingsSetting ? "Yes" : "No"}**`
                + `\n\n(**${this.toTitleCase(userAddress)} can always change ${generalAddressPossessive} user settings** with \`${PREFIX}user edit\` OR \`${PREFIX}u e\` for short)`,
                false, "User Settings: Confirmation", 180000);
            if (!confirmSettings) return;
            const timezone = {
                name: userTimezone,
                offset: userTimezoneOffset,
                daylightSavings: userDaylightSavingsSetting,
            };
            return timezone;
        }
    },

    createGuildSettings: async function (guildID, timezone = "EST", daylightSavings = true) {
        try {
            const initialOffset = this.getTimezoneOffset(timezone);
            const daylightOffset = this.isDaylightSavingTime(Date.now(), daylightSavings) ?
                this.getTimezoneDaylightOffset(timezone) : 0;
            const guildConfig = new Guild({
                _id: mongoose.Types.ObjectId(),
                guildID,
                prefix: DEFAULT_PREFIX,
                timezone: {
                    name: timezone,
                    offset: initialOffset + daylightOffset,
                    daylightSavings,
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


    getPostChannel: async function (bot, PREFIX, message, type, forceSkip = false, embedColour = this.defaultEmbedColour) {
        // Check all of the servers the bot is in
        let botServers = await bot.guilds.cache.map(guild => guild.id);
        console.log({ botServers });

        // Find all the mutual servers with the user and bot
        var botUserMutualServerIDs = await this.userAndBotMutualServerIDs(bot, message, botServers);
        var targetServerIndex, targetChannelIndex;
        var channelList, channelListDisplay;
        var confirmSendToChannel = false;
        const channelSelectInstructions = "Type the number corresponding to the channel you want to post in:";
        const serverSelectInstructions = "Type the number corresponding to the server you want to post in:";
        const postToServerTitle = `${type}: Post to Server`;
        const postToChannelTitle = `${type}: Post to Channel`;
        var serverList = await this.listOfServerNames(bot, botUserMutualServerIDs);
        targetServerIndex = await this.userSelectFromList(bot, PREFIX, message, serverList, botUserMutualServerIDs.length,
            serverSelectInstructions, postToServerTitle, embedColour);
        if (targetServerIndex === false) return false;
        channelList = await this.listOfServerTextChannelsUserCanSendTo(bot, message, botUserMutualServerIDs[targetServerIndex]);
        if (channelList.length == 0) {
            this.sendReplyThenDelete(message, "This server has **no channels!** EXITING...");
            return false;
        }
        channelListDisplay = await this.listOfChannelNames(bot, channelList);
        while (!confirmSendToChannel) {
            targetChannelIndex = await this.userSelectFromList(bot, PREFIX, message, channelListDisplay, channelList.length,
                channelSelectInstructions, postToChannelTitle, embedColour, 300000);
            if (targetChannelIndex === false) return false;
            console.log({ targetChannelIndex });
            let targetChannelName = await bot.channels.cache.get(channelList[targetChannelIndex]).name;
            confirmSendToChannel = await this.getUserConfirmation(message, `Are you sure you want to send it to **#${targetChannelName}**?`, forceSkip);
        }
        return channelList[targetChannelIndex];
    },

    getSingleEntry: async function (bot, message, instructionPrompt, title, forceSkip = false, embedColour = this.defaultEmbedColour, additionalInstructions = "", instructionKeywords = []) {
        let reset = false;
        var collectedEdit;
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
            collectedEdit = await this.messageDataCollect(bot, message, instructionPrompt, title, embedColour, 600000);
            if (!collectedEdit || collectedEdit === "stop") return false;
            if (hasInstructions) {
                if (instructionKeywords.includes(collectedEdit)) {
                    return collectedEdit;
                }
            }
            if (!reset) {
                const confirmEntry = await this.getUserConfirmation(message, `**__Are you sure you want to enter:__**\n${collectedEdit}`, forceSkip, title);
                if (!confirmEntry) {
                    reset = true;
                }
            }
        }
        while (reset);
        return collectedEdit;
    },

    getMultilineEntry: async function (bot, PREFIX, message, instructionPrompt, title, forceSkip = false,
        embedColour = this.defaultEmbedColour, additionalInstructions = "", instructionKeywords = [],
        startingArray = false) {
        let spamDetails = {
            lastTimestamp: null,
            closeMessageCount: 0,
        };
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
            collectedEntry = await this.messageDataCollect(bot, message, instructionPrompt, title, embedColour, 600000,
                false, false, true, 3000, false, `Character Count: ${finalEntry.join('\n').length}`);
            if (collectedEntry) {
                if (collectedEntry.startsWith(PREFIX) && collectedEntry !== PREFIX) {
                    message.reply(`Any **command calls** while writing a message will **stop** the collection process.\n**__Command Entered:__**\n${collectedEntry}`);
                    collectedEntry = false;
                }
                // Spam Prevention:
                else if (spamDetails && collectedEntry !== "0" && collectedEntry !== "1"
                    && collectedEntry !== "2" && collectedEntry !== "stop") {
                    const messageSendDelay = Date.now() - spamDetails.lastTimestamp || 0;
                    console.log({ messageSendDelay });
                    spamDetails.lastTimestamp = Date.now();
                    if (messageSendDelay < this.CLOSE_MESSAGE_DELAY) {
                        spamDetails.closeMessageCount++;
                    }
                    if (spamDetails.closeMessageCount >= this.CLOSE_MESSAGE_SPAM_NUMBER) {
                        console.log("Exiting due to spam...");
                        message.reply("**Exiting... __Please don't spam!__**");
                        return false;
                    }
                    if (spamDetails.closeMessageCount === 0) {
                        setTimeout(() => {
                            if (spamDetails) spamDetails.closeMessageCount = 0;
                        }, this.REFRESH_SPAM_DELAY);
                    }
                }
            }
            if (!collectedEntry || collectedEntry === "stop") {
                if (collectedEntry !== "stop") {
                    message.channel.send(`This was your **entry**:\n${finalEntry.join('\n')}`);
                }
                return false;
            }
            else if (collectedEntry.length + finalEntry.join('\n').length > 6000) {
                message.reply("Your entry was **too long** (*over 6000 characters*), so I had to **stop** collecting it.");
                return false;
            }
            if (hasInstructions) {
                if (instructionKeywords.includes(collectedEntry)) {
                    return { message: finalEntry.join('\n'), returnVal: collectedEntry, array: finalEntry };
                }
            }
            if (inputIndex === 1 || reset === true) {
                if (collectedEntry === "1") {
                    if (finalEntry.join('\n').length > 2000) {
                        message.reply(`Your entry is too long (must be __less than 2000 characters__ long)`
                            + `\nTry undoing some line entries by typing \`2\` or reset your entry by typing \`0\``);
                    }
                    else {
                        const endConfirmation = await this.getUserConfirmation(message, `**__Are you sure you want to enter:__**\n${finalEntry.join('\n')}`, forceSkip, title, 180000);
                        if (endConfirmation === true) break;
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
                if (finalEntry.join('\n').length > 2000) {
                    message.reply(`Your entry is too long (must be __less than 2000 characters__ long)`
                        + `\nTry undoing some line entries by typing \`2\` or reset your entry by typing \`0\``);
                }
                else {
                    const endConfirmation = await this.getUserConfirmation(message, `**__Are you sure you want to enter:__**\n${finalEntry.join('\n')}`, forceSkip, title, 180000);
                    if (endConfirmation === true) break;
                }
            }
            else if (collectedEntry === "0") {
                if (finalEntry === "") {
                    reset = true;
                }
                else {
                    const resetWarningMessage = `__Are you sure you want to **reset** the current entry for this section?:__\n${finalEntry.join('\n')}`;
                    let resetConfirmation = await this.getUserConfirmation(message, resetWarningMessage, false, `${title} Reset`);
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
        const MAX_32_BIT_SIGNED_INT = 2147483647;
        if (delay > MAX_32_BIT_SIGNED_INT) {
            timeout = setTimeout(() => this.setLongTimeout(callback, (delay - MAX_32_BIT_SIGNED_INT)), MAX_32_BIT_SIGNED_INT);
        }
        else timeout = setTimeout(callback, delay);
        return timeout;
    },

    setLongInterval(callback, delay) {
        var interval;
        const MAX_32_BIT_SIGNED_INT = 2147483647;
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
            const initialTimestamp = Date.now();
            time = await this.messageDataCollect(bot, message, `${instructions}${timeExamples ? `\n\n${timeExamples}` : ""}`, title, embedColour, dataCollectDelay, false);
            if (!time || time === "stop") return false;
            timeArgs = time.toLowerCase().split(/[\s\n]+/);
            time = this.timeCommandHandlerToUTC(forceFutureTime && timeArgs[0] !== "in" && timeArgs[0] !== "now" ?
                (["in"]).concat(timeArgs) : timeArgs, initialTimestamp, timezoneOffset, daylightSetting);
            if (time === false) this.sendReplyThenDelete(message, `Try** \`${PREFIX}date\` **for **help with entering dates and times**`, errorReplyDelay);
            else if (forceFutureTime) {
                if (initialTimestamp + this.getTimeScaleToMultiplyInMs("hour") * timezoneOffset > time) {
                    this.sendReplyThenDelete(message, `Please enter a date/time in the **future**! Try** \`${PREFIX}date\` **for help`, errorReplyDelay);
                }
                else break;
            }
            else break;
        }
        while (true)
        return time;
    },

    getTierMaxMessage: function (PREFIX, commandUsed, thresholdValue, type, tier, supportsArchive = false) {
        return `You've ${supportsArchive ? "archived" : "created"} the **__maximum number of ${supportsArchive ? "archived " : ""}${type[0].toLowerCase()} entries__** (**${thresholdValue}**) `
            + `as a **Tier ${tier || 1} user** and cannot ${supportsArchive ? "archive" : "create"} any more ${type[0].toLowerCase()} entries!`
            + `\n\n\`${PREFIX}${commandUsed} post${supportsArchive ? " archive" : ""}\` - to **post**${type[0] ? ` a ${type[0].toLowerCase()} ` : ""}to a **channel**`
            + `\n\`${PREFIX}${commandUsed} see${supportsArchive ? " archive" : ""} all\` - to **get** all of your ${type[1] ? type[1].toLowerCase() : "entries"} in a **.txt file**`
            + `\n\`${PREFIX}${commandUsed} delete${supportsArchive ? " archive" : ""} all\` - to **delete** all of your ${type[1] ? type[1].toLowerCase() : "entries"} to **make space**!`
            + `\n\n**-- OR --**\n\n**__Donate to support the developer__ to get __more storage__ for all of your entries**`;
    },

    premiumFooterText: "📞 Contact the developer for more details and any inquiries! (in the server below)\n👋 Join the Personal Development Pod (PD Bot Community): https://discord.gg/Czc3CSy"
        + "\n-- 📚 Bring all of your questions, suggestions, and personal development experiences!\n-- ✨ The tier options/donation page will be on the future website",
    // Visit <future website> for more details! (Change footer when ready)


    invalidPrefixes: ['\*', '\_', '\~', '\>', '\\', '\/', '\:', '\`', '\@'],
    reminderTypes: ["Reminder", "Habit", "Fast", "Quote", "Goal", "Journal"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    daysOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    fileFooterText: `🗑 to delete this window (not the entries)\n📎 to get all of this in a text file`,
    timeExamples: `e.g. **now **|** 5 hours ago **|** yesterday at 6pm\n**|** last monday at 8:30p **|** May 4, 2020 1230a**`,
    futureTimeExamples: `e.g. **in 15 mins **|** next tuesday at 930p **|** 1 month from now 8pm\ntoday at 1:55P **|** July 5 at 9A **|** April 30, 2021 at 8:45am**`,
    intervalExamples: `⏳ Any period longer than **1 minute** ⏳`
        + `\n\n**__In one of the forms:__\n- # Periods **(years; months; weeks; days; hours; minutes)**`
        + `\n- #y **(years)** : #d **(days)** : #h **(hours)** : #m **(minutes)** : #s **(seconds)** **`
        + `\n\ne.g. **5 days **|** 12 hours **|** 30 mins **|** 1 week **|** 4 months **|** 2.5 years`
        + `\n**|** 1y:2d:3h:30m:2s **|** 18h **|** 12.75m **|** 6m50s **|** 25m 5s **|** 7d:2h **|** 5y 15d 50.5h 20m 95s**`,
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
    defaultEmbedColour: "#ADD8E6",

    mastermindMaxTier1: 12,
    fastMaxTier1: 15,
    journalMaxTier1: 14,
    goalMaxTier1: 10,
    goalArchiveMaxTier1: 8,
    habitMaxTier1: 10,
    habitArchiveMaxTier1: 8,

    REFRESH_SPAM_DELAY: 20000,
    CLOSE_MESSAGE_DELAY: 2000,
    CLOSE_MESSAGE_SPAM_NUMBER: 7,
};
