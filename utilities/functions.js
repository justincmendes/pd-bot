/**
 * File of all the important and universally reusable functions!
 */
const Discord = require("discord.js");
const e = require("express");
const { off } = require("../djs-bot/database/schemas/fasting");
require("dotenv").config();

module.exports = {
    getUserConfirmation: async function (userOriginalMessageObject, confirmationMessage, forceSkip = false, embedTitle = "Confirmation", delayTime = 60000, deleteDelay = 3000,
        confirmationInstructions = "\n\nSelect ✅ to **proceed**\nSelect ❌ to **cancel**") {
        if (forceSkip === true) {
            return true;
        }
        const agree = "✅";
        const disagree = "❌";
        const userOriginal = userOriginalMessageObject.author.id;
        const MS_TO_SECONDS = 1000;
        const footerText = `\n*(expires in ${delayTime / MS_TO_SECONDS}s)*`;
        var confirmation;
        confirmationMessage = confirmationMessage + confirmationInstructions;
        const embed = this.getMessageEmbed(confirmationMessage, embedTitle, "#FF0000").setFooter(footerText);
        await userOriginalMessageObject.channel.send(embed)
            .then(async confirm => {
                await confirm.react(agree);
                await confirm.react(disagree);
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
                            this.sendMessageThenDelete(userOriginalMessageObject, "Confirmed!", deleteDelay);
                            console.log(`Confirmation Value (in function): true`);
                            return true;
                        }
                        else {
                            confirm.delete();
                            console.log("Ending (confirmationMessage) promise...\nConfirmation Value (in function): false");
                            this.sendMessageThenDelete(userOriginalMessageObject, "Exiting...", deleteDelay);
                            return false;
                        }
                    })
                    // When the user DOESN'T react!
                    .catch(err => {
                        console.error(err);
                        confirm.delete();
                        console.log(`ERROR: User didn't react within ${delayTime / MS_TO_SECONDS}s!`);
                        console.log("Ending (confirmationMessage) promise...\nConfirmation Value (in function): false");
                        this.sendMessageThenDelete(userOriginalMessageObject, "Exiting...", deleteDelay);
                        return false;
                    });
            }).catch(err => console.error(err));
        return confirmation;
    },

    // BUG: When user reacts too soon, the code breaks, figure out how to let it keep running!
    reactionDataCollect: async function (userOriginalMessageObject, prompt, emojiArray, title = "Reaction", colour = "#ADD8E6", delayTime = 60000, promptMessageDelete = true) {
        const userOriginal = userOriginalMessageObject.author.id;
        var result;
        const deleteDelay = 3000;
        const MS_TO_SECONDS = 1000;
        const footerText = `\n*(expires in ${delayTime / MS_TO_SECONDS}s)*`;
        const embed = this.getMessageEmbed(prompt, title, colour).setFooter(footerText);
        await userOriginalMessageObject.channel.send(embed)
            .then(async confirm => {
                await emojiArray.forEach((emoji) => {
                    confirm.react(emoji)
                        .catch(err => console.error(err));
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
                        this.sendMessageThenDelete(userOriginalMessageObject, "Exiting...", deleteDelay);
                        console.log(`Reaction Value (in function): undefined`);
                        return false;
                    });
            }).catch(err => {
                console.error(err);
                return;
            });
        return result;
    },

    messageDataCollectFirst: async function (userOriginalMessageObject, prompt, title = "Message Reaction", colour = "#ADD8E6", delayTime = 60000,
        deleteUserMessage = true, userMessageDeleteDelay = 0, attachImage = false, imageURL = "") {
        const userOriginal = userOriginalMessageObject.author.id;
        var result;
        const deleteDelay = 3000;
        const MS_TO_SECONDS = 1000;
        const footerText = `\n*(expires in ${delayTime / MS_TO_SECONDS}s)*`;
        const textEntryInstructions = `\n\n\*P.S. use \`SHIFT+ENTER\` to enter a newline before sending!\n\\*\\*P.P.S Type \`stop\` to **cancel**`;
        prompt = prompt + textEntryInstructions;
        let embed = this.getMessageEmbed(prompt, title, colour).setFooter(footerText);
        if (attachImage == true) {
            embed = embed.setImage(imageURL);
        }
        await userOriginalMessageObject.channel.send(embed)
            .then(async confirm => {
                const filter = response => {
                    const filterOut = response.author.id == userOriginal;
                    console.log(`For ${response.author.username}'s response, the filter value is: ${filterOut}`);
                    return filterOut;
                };

                // Create the awaitMessages promise object for the confirmation message just sent
                result = await userOriginalMessageObject.channel.awaitMessages(filter, { time: delayTime, max: 1 })
                    .then(async reacted => {
                        console.log(`${reacted.first().author.username}'s message was collected!`);
                        confirm.delete();
                        console.log(`Message Sent (in function): ${reacted.first().content}`);
                        if (deleteUserMessage === true) {
                            reacted.first().delete({ timeout: userMessageDeleteDelay });
                            return reacted.first().content;
                        }
                    })
                    // When the user DOESN'T react!
                    .catch(err => {
                        console.error(err);
                        confirm.delete();
                        console.log(`ERROR: User didn't respond within ${delayTime / MS_TO_SECONDS}s!`);
                        console.log("Ending (messageDataCollect) promise...");
                        this.sendMessageThenDelete(userOriginalMessageObject, "Ending...", deleteDelay);
                        console.log(`Message Sent (in function): false`);
                        return false;
                    });
            }).catch(err => console.error(err));
        return result;
    },

    messageDataCollectFirstObject: async function (userOriginalMessageObject, prompt, title = "Message Reaction", colour = "#ADD8E6", delayTime = 60000, deleteUserMessage = true,
        userMessageDeleteDelay = 0, attachImage = false, imageURL = "") {
        const userOriginal = userOriginalMessageObject.author.id;
        var result;
        const deleteDelay = 3000;
        const MS_TO_SECONDS = 1000;
        const footerText = `\n*(expires in ${delayTime / MS_TO_SECONDS}s)*`;
        const textEntryInstructions = `\n\n\*P.S. use \`SHIFT+ENTER\` to enter a newline before sending!\n\\*\\*P.P.S Type \`stop\` to **cancel**`;
        prompt = prompt + textEntryInstructions;
        let embed = this.getMessageEmbed(prompt, title, colour).setFooter(footerText);
        if (attachImage == true) {
            embed = embed.setImage(imageURL);
        }
        await userOriginalMessageObject.channel.send(embed)
            .then(async confirm => {
                const filter = response => {
                    const filterOut = response.author.id == userOriginal;
                    console.log(`For ${response.author.username}'s response, the filter value is: ${filterOut}`);
                    return filterOut;
                };

                // Create the awaitMessages promise object for the confirmation message just sent
                result = await userOriginalMessageObject.channel.awaitMessages(filter, { time: delayTime, max: 1 })
                    .then(async reacted => {
                        console.log(`${reacted.first().author.username}'s message was collected!`);
                        confirm.delete();
                        console.log(`Message Sent (in function): ${reacted.first().content}`);
                        if (deleteUserMessage === true) {
                            reacted.first().delete({ timeout: userMessageDeleteDelay });
                            return reacted.first();
                        }
                    })
                    // When the user DOESN'T react!
                    .catch(err => {
                        console.error(err);
                        confirm.delete();
                        console.log(`ERROR: User didn't respond within ${delayTime / MS_TO_SECONDS}s!`);
                        console.log("Ending (messageDataCollect) promise...");
                        this.sendMessageThenDelete(userOriginalMessageObject, "Ending...", deleteDelay);
                        console.log(`Message Sent (in function): false`);
                        return false;
                    });
            }).catch(err => console.error(err));
        return result;
    },

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
    userSelectFromList: async function (userOriginalMessageObject, list, numberOfEntries, instructions, selectTitle, messageColour = "#ADD8E6",
        delayTime = 120000, userMessageDeleteDelay = 0, messageAfterList = "") {
        do {
            targetIndex = await this.messageDataCollectFirst(userOriginalMessageObject, `${instructions}\n${list}\n${messageAfterList}`, selectTitle,
                messageColour, delayTime, true, userMessageDeleteDelay);
            if (isNaN(targetIndex)) {
                if (targetIndex.toLowerCase() == "stop") {
                    return false;
                }
                else {
                    userOriginalMessageObject.reply("Please enter a number on the given list!")
                        .then(msg => {
                            msg.delete({ timeout: 5000 });
                        })
                        .catch(err => console.error(err));
                }
            }
            else if (parseInt(targetIndex) > numberOfEntries || parseInt(targetIndex) <= 0) {
                userOriginalMessageObject.reply("Please enter a number on the given list!")
                    .then(msg => {
                        msg.delete({ timeout: 5000 });
                    })
                    .catch(err => console.error(err));
            }
            else {
                // Minus 1 to convert to back array index (was +1 for user understanding)
                targetIndex = parseInt(targetIndex) - 1;
                break;
            }
        }
        while (true);
        return targetIndex;
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
        const MS_PER_HOUR = 3600 * 1000;
        const MS_PER_MINUTE = 60 * 1000;
        const MS_PER_SECOND = 1000;
        var hours, minutes, seconds, timeString;
        hours = Math.floor(milliseconds / MS_PER_HOUR);
        minutes = Math.floor((milliseconds - MS_PER_HOUR * hours) / MS_PER_MINUTE);
        seconds = Math.floor((milliseconds - MS_PER_HOUR * hours - MS_PER_MINUTE * minutes) / MS_PER_SECOND);
        timeString = `${hours}h:${minutes}m:${seconds}s`;
        return (timeString);
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

    // Currently only accepting abbreviations
    // https://en.wikipedia.org/wiki/List_of_time_zone_abbreviations
    // https://www.timetemperature.com/abbreviations/world_time_zone_abbreviations.shtml
    getTimezoneOffset: function (timezoneString) {
        if (!timezoneString) return undefined;
        // Can be a single number, multiple numbers, time, or string of 2-5 letters
        // In the form: 8:45
        const timezoneFormatRegex = /(?:(\-)|(?:\+))(\d{1}(?:\d{1})?)[\:]?(\d{2})/;
        const timezoneFormat = timezoneFormatRegex.exec(timezoneString);
        console.log({ timezoneFormat });
        if (timezoneFormat) {
            const sign = timezoneFormat[1];
            const hours = parseInt(timezoneFormat[2]);
            if (hours < -12 || hours > 14) return undefined;
            const minutes = parseInt(timezoneFormat[3]);
            if (minutes >= 60) return undefined;
            const offset = hours + (minutes / 60);
            console.log({ offset })
            if (offset < -12 || offset > 14) return undefined;
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
            if (offset < -12 || offset > 14) return undefined;
            else return offset;
        }

        if (timezoneString.length < 2) return undefined;
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

    getProperTimeArray: function (dateAndTimeArray, originalArgs, userTimezone, userDaylightSavingSetting) {
        // The last element in the array is expected to represent the timezone
        const timeArrayLength = dateAndTimeArray.length;
        const NUMBER_OF_TIME_ELEMENTS = 5;
        const timezoneString = this.getProperTimezoneString(dateAndTimeArray, originalArgs);
        dateAndTimeArray[timeArrayLength - 1] = timezoneString;
        const initialTime = this.getMultipleAdjacentArrayElements(dateAndTimeArray, timeArrayLength - NUMBER_OF_TIME_ELEMENTS, NUMBER_OF_TIME_ELEMENTS);
        const splitTimeAndPeriod = this.getSplitTimePeriodAndTimezoneArray(initialTime);
        return splitTimeAndPeriod;
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
    },

    // For timezones, allow user to select from the basic timezones or enter their own (i.e. Newfoundland And Labrador)
    // Use select from list and have the last option open for manual entry!
    // Have a truth value on for if Daylights Savings Time!!!

    // Using Regular Expressions
    // Assumes that the userTimezone is NOT already daylight-savings adjusted
    timeCommandHandlerUTC: function (args, messageCreatedTimestamp, userTimezone = -4, userDaylightSavingSetting = true) {
        const HOUR_IN_MS = this.getTimeScaleToMultiplyInMs("hour");
        if (args[0].toLowerCase() == "now") {
            return this.getUTCOffsetAdjustedTimestamp(messageCreatedTimestamp, userTimezone, userDaylightSavingSetting);
        }

        // Get day of week, starting from Sunday
        const currentDate = new Date(messageCreatedTimestamp + (userTimezone * HOUR_IN_MS));
        const currentDayOfWeek = currentDate.getUTCDate();

        // Convert from space separated arguments to time arguments
        // Step 1: Combine any Dates/Times space separated
        console.log({ args });
        const timeArgs = args.join("").toLowerCase();
        console.log({ timeArgs });

        // Relative Time: Past and Future
        const relativeTimeAgoOrFromNow = /(in)?(\d+\.?\d*|\d*\.?\d+)(minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?)(ago|prior|before|fromnow|later(?:today)?|inthefuture)?(?:at)?(?:(?:(?:(\d{1}(?:\d{1})?)[\:]?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]{2,})|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)[\:]?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?)?/;
        const relativeTimeTest = relativeTimeAgoOrFromNow.exec(timeArgs);
        console.log({ relativeTimeTest });
        const dayOfWeekRegex = /((?:\d+)|(?:last|past|next|this(?:coming)?|following|previous|prior)|(?:(?:yest?(?:erday)?)|(?:(?:tod(?:ay)?))|(?:(?:tomm(?:orrow)?))|(?:tmrw)))((?:m(?:on?)?(?:days?)?)|(?:tu(?:es?)?(?:days?)?)|(?:w(?:ed?)?(?:nesdays?)?)|(?:th(?:urs?)?(?:days?)?)|(?:f(?:ri?)?(?:days?)?)|(?:sa(?:t)?(?:urdays?)?)|(?:su(?:n)?(?:days?)?))?(ago|prior|before|fromnow|later|inthefuture)?(?:at)?(?:(?:(?:(\d{1}(?:\d{1})?)[\:]?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]{2,})|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)[\:]?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?)?/;
        const dayOfWeekTest = dayOfWeekRegex.exec(timeArgs);
        console.log({ dayOfWeekTest });
        // Absolute Time: Past and Future
        const absoluteTimeRegex = /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\,\-](\d{2}|\d{4})?(?:at)?(?:(?:(?:(\d{1}(?:\d{1})?)[\:]?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]{2,})|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)[\:]?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?)?/;
        const absoluteTimeTest = absoluteTimeRegex.exec(timeArgs);
        console.log({ absoluteTimeTest });
        const monthTimeRegex = /((?:jan?(?:uary)?)|(?:f(?:eb?)?(?:ruary)?)|(?:mar?(?:ch)?)|(?:apr?(?:il)?)|(?:may?)|(?:jun(?:e)?)|(?:jul(?:y)?)|(?:aug?(?:ust)?)|(?:sept?(?:ember)?)|(?:oct?(?:ober)?)|(?:nov?(?:ember)?)|(?:dec?(?:ember)?))(\d{1}(?:\d{1})?)[\/\.\,\-]?((?:\d{4})|(?:\d{2}))?(?:at)?(?:(?:(?:(\d{1}(?:\d{1})?)[\:]?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?((?:[a-z]{2,})|(?:[\-\+](?:(?:(?:(?:\d{1}(?:\d{1})?)[\:]?(?:\d{2})))|(?:(?:\d*\.?\d+)))))?)?/;
        const monthTimeTest = monthTimeRegex.exec(timeArgs);
        console.log({ monthTimeTest });

        // const timezone = userTimezone || Test[];

        var timestampOut, timezoneString;
        if (relativeTimeTest) {
            if (relativeTimeTest.length > 3) {
                // !! To Extract Truthy/Falsey value from each argument
                // Adjust the timezone as the "m" in am or pm will be greedy
                const properTimeArray = this.getProperTimeArray(relativeTimeTest, args, userTimezone, userDaylightSavingSetting);
                const timeScale = relativeTimeTest[3];
                const [hours, minutes, amPmString, timezone] = properTimeArray;
                timezoneString = timezone;
                console.log({ properTimeArray });
                const argsHaveDefinedTime = (!!(hours) || !!(minutes));
                const militaryTimeString = this.getMilitaryTimeStringFromProperTimeArray(properTimeArray);
                console.log({ militaryTimeString });
                // Args with no defined time AND Args with defined time having a whole number first argument (i.e. 2 days)
                let futureTruePastFalse = this.futureTruePastFalseRegexTest(relativeTimeTest[4]);
                if (futureTruePastFalse === undefined) {
                    if (relativeTimeTest[1]) {
                        futureTruePastFalse = true;
                    }
                    else return false;
                }
                if (militaryTimeString || !argsHaveDefinedTime) {
                    // If Long Relative Time Scale and a Defined Time: Expect Whole Number First Argument
                    if (this.isLongTimeScale(timeScale)) {
                        let numberOfTimeScales = parseFloat(relativeTimeTest[2]);
                        if (argsHaveDefinedTime) {
                            numberOfTimeScales = Math.floor(numberOfTimeScales);
                        }
                        const timeScaleToMultiply = this.getTimeScaleToMultiplyInMs(relativeTimeTest[3]);
                        let timeDifference = numberOfTimeScales * timeScaleToMultiply;
                        console.log({ timeDifference, timeScaleToMultiply, numberOfTimeScales, extractedTimeString: militaryTimeString });
                        if (argsHaveDefinedTime) {
                            timeDifference += this.getTimePastMidnightInMs(militaryTimeString) - this.getTimeSinceMidnightInMsUTC(messageCreatedTimestamp, userTimezone);
                        }
                        console.log({ timeDifference });
                        var timestampOut;
                        if (futureTruePastFalse) {
                            timestampOut = messageCreatedTimestamp + timeDifference;
                        }
                        else {
                            timestampOut = messageCreatedTimestamp - timeDifference;
                        }
                    }
                }
                else {
                    return false;
                }
            }
        }
        else if (dayOfWeekTest) {
            if (dayOfWeekTest.length > 5) {

            }
        }
        else if (absoluteTimeRegex) {

        }
        else {
            return false;
        }

        // Adjust output based on timezone and daylight saving time considerations
        console.log({ timestampOut, timezoneString, userTimezone, userDaylightSavingSetting })
        timestampOut = this.getUTCOffsetAdjustedTimestamp(timestampOut, userTimezone, userDaylightSavingSetting, timezoneString);
        console.log({ timestampOut });
        return timestampOut;
    },

    timestampToDateString: function (timestamp) {
        if (timestamp === undefined || timestamp === null) return null;
        const date = new Date(timestamp);
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const standardTime = this.militaryTimeHoursToStandardTimeHoursArray(date.getUTCHours());
        const hours = standardTime[0];
        const amPmString = standardTime[1];
        const minutes = this.getValidMinutesString(date.getUTCMinutes());
        const seconds = this.getValidMinutesString(date.getUTCSeconds());
        return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${amPmString}`;
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
        timezoneOffset = this.getTimezoneOffset(timezone) || userDefaultTimezone;
        console.log({ timestamp, timezoneOffset });
        timestamp += (HOUR_IN_MS * timezoneOffset)
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

    getHourMinSeparatedArray: function (timeToTest) {
        const separateTimeRegex = /((?:1[0-2])|(?:0?[0-9]))([0-5][0-9])/;
        let separatedTime = separateTimeRegex.exec(timeToTest);
        return separatedTime;
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
        const properMilitaryTimeRegex = /((?:[0-1][0-9])|(?:2[0-3]))\:([0-5][0-9])/;
        return properMilitaryTimeRegex;
    },

    getMilitaryTimeHoursAndMinsArray: function (militaryTimeString) {
        militaryTime = this.getMilitaryTimeRegex().exec(militaryTimeString);
        return militaryTime;
    },

    getElementFromBack: function (array, index) {
        return array[array.length - index];
    },

    futureTruePastFalseRegexTest: function (testArgument) {
        const pastIndicatorRegex = /(ago|prior|before)/;
        const futureIndicatorRegex = /(fromnow|later|inthefuture)/;
        var futureTruePastFalse;
        if (pastIndicatorRegex.test(testArgument)) {
            futureTruePastFalse = false;
        }
        else if (futureIndicatorRegex.test(testArgument)) {
            futureTruePastFalse = true;
        }
        return futureTruePastFalse;
    },

    getTimeScaleToMultiplyInMs: function (relativeTimeScale) {
        const YEAR_IN_MS = 3.154e+10;
        const MONTH_IN_MS = 2.628e+9;
        const WEEK_IN_MS = 6.048e+8;
        const DAY_IN_MS = 8.64e+7;
        const HOUR_IN_MS = 3.6e+6;
        const MIN_IN_MS = 60000;
        const minTestRegex = /(mins?|minutes?)/;
        const hourTestRegex = /(hours?|hrs?)/;
        const dayTestRegex = /(days?)/;
        const weekTestRegex = /(weeks?)/;
        const monthTestRegex = /(months?)/;
        const yearTestRegex = /(years?)/;
        var timeScaleToMultiply;
        if (yearTestRegex.test(relativeTimeScale)) {
            timeScaleToMultiply = YEAR_IN_MS;
        }
        else if (monthTestRegex.test(relativeTimeScale)) {
            timeScaleToMultiply = MONTH_IN_MS;
        }
        else if (weekTestRegex.test(relativeTimeScale)) {
            timeScaleToMultiply = WEEK_IN_MS;
        }
        else if (dayTestRegex.test(relativeTimeScale)) {
            timeScaleToMultiply = DAY_IN_MS;
        }
        else if (hourTestRegex.test(relativeTimeScale)) {
            timeScaleToMultiply = HOUR_IN_MS;
        }
        else if (minTestRegex.test(relativeTimeScale)) {
            timeScaleToMultiply = MIN_IN_MS;
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
        const timePastMidnight = timeInMS % DAY_IN_MS;
        console.log({ timePastMidnight });
        return ((timePastMidnight + (HOUR_IN_MS * parseInt(UTCHourOffset))) % DAY_IN_MS);
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
                msg.delete(5000);
            })
            .catch(err => console.error(err));
    },

    sendErrorMessage: function (userOriginalMessageObject, errorMessage = "**INVALID INPUT...**") {
        userOriginalMessageObject.reply(errorMessage);
    },

    sendDescriptionOnlyEmbed: function (userOriginalMessageObject, embedMessage, embedColour = "#ADD8E6") {
        embedMessage = new Discord.MessageEmbed()
            .setColor(embedColour)
            .setDescription(embedMessage);
        userOriginalMessageObject.channel.send(embedMessage);
    },

    getMessageEmbed: function (embedMessage, embedTitle, embedColour = "#ADD8E6") {
        embedMessage = new Discord.MessageEmbed()
            .setColor(embedColour)
            .setTitle(embedTitle)
            .setDescription(embedMessage);
        return embedMessage;
    },

    getMessageDescriptionOnlyEmbed: function (embedMessage, embedColour = "#ADD8E6") {
        embedMessage = new Discord.MessageEmbed()
            .setColor(embedColour)
            .setDescription(embedMessage);
        return embedMessage;
    },

    getMessageImageEmbed: function (embedImageURL, embedMessage, embedTitle, embedColour = "#ADD8E6") {
        embedMessage = new Discord.MessageEmbed()
            .setColor(embedColour)
            .setTitle(embedTitle)
            .setDescription(embedMessage)
            .setImage(embedImageURL);
        return embedMessage;
    },

    sendDescriptionOnlyMessageEmbed: function (userOriginalMessageObject, embedMessage, embedColour = "#ADD8E6") {
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

    // Function call allows for name to be a Discord user tag! <@##############>
    mastermindWeeklyJournalEntry: function (name = "NAME", withMarkdown = false, previousWeekReflectionEntry = "", areaOfLifeEntry = "",
        stopEntry = "", startEntry = "", continueEntry = "", firstWeeklyGoal = "", secondWeeklyGoal = "", thirdWeeklyGoal = "") {
        let weeklyJournalEntry = `__**${name}**__`
            + `\n**__Previous Week's Assessment: Habit Adherence + 3+ Observations:__**\n${previousWeekReflectionEntry}`
            + `\n__**Area of Life That Needs the Most Attention:**__ ${areaOfLifeEntry}\n__**STOP, START, CONTINUE:** __`
            + `\n**STOP**: ${stopEntry}\n**START**: ${startEntry}\n**CONTINUE**: ${continueEntry}`
            + `\n__**Next Week's 1-3 ABSOLUTE Goals and WHY:**__`
            + `\n**Weekly Goal 1**: ${firstWeeklyGoal}\n**Weekly Goal 2**: ${secondWeeklyGoal}\n**Weekly Goal 3**: ${thirdWeeklyGoal}`;
        if (withMarkdown === true) {
            weeklyJournalEntry = `\`${weeklyJournalEntry}\``;
        }
        return weeklyJournalEntry;
    },

    longTermGoalsTemplate: function () {
        const goalsTemplate = "";
        return goalsTemplate;
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
    }

};
