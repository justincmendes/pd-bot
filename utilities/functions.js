/**
 * File of all the important and universally reusable functions!
 */
const Discord = require("discord.js");
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

    // Using Regular Expressions
    timeCommandHandler: function (args, messageCreatedTime) {
        // Convert from space separated arguments to time arguments
        // Step 1: Combine any Dates/Times space separated
        console.log({args});
        const argsString = args.join("");
        console.log(argsString);
        var timeArgs;
        // Allows for handling past and future dates (passing in a boolean)
        if (args[0].toLowerCase() == "now") return messageCreatedTime;
        // else if(past)
        // {

        // }
        // else if(future)
        // {

        // }
        else return (false);
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
