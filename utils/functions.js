/**
 * File of all the important reusable functions!
 */
const Discord = require("discord.js");
require("dotenv").config();
const prefix = process.env.PREFIX;

module.exports = {
    confirmationMessage: async function (message, confirmMessage, title = "Confirmation", delayTime = 60000, deleteDelay = 3000,
        confirmationInstructions = "\n\nSelect ✅ to **proceed**\nSelect ❌ to **cancel**") {
        const agree = "✅";
        const disagree = "❌";
        const userOriginal = message.author.id;
        var confirmation;
        confirmMessage = confirmMessage + confirmationInstructions + `\n*(expires in ${delayTime / 1000}s)*`;

        const embed = new Discord.MessageEmbed()
            .setColor("#FF0000")
            .setTitle(title)
            .setDescription(confirmMessage);

        await message.channel.send(embed)
            .then(async confirm => {
                await confirm.react(agree);
                await confirm.react(disagree);

                const filter = (reaction, user) => {
                    const filterOut = user.id == userOriginal && (reaction.emoji.name == agree || reaction.emoji.name == disagree);
                    console.log(`For ${user.username}'s ${reaction.emoji.name} reaction, the filter value is: ${filterOut}`);
                    return filterOut;
                };

                // Create the awaitReactions promise object for the confirmation message just sent
                confirmation = await confirm.awaitReactions(filter, { time: delayTime, max: 1 })
                    .then(reacted => {
                        console.log(`User's ${reacted.first().emoji.name} collected!`);
                        if (reacted.first().emoji.name == agree) {
                            confirm.delete();
                            message.channel.send("Confirmed!")
                                .then(exitMessage => {
                                    exitMessage.delete({ timeout: deleteDelay });
                                }).catch(err => console.error(err));
                            console.log(`Confirmation Value (in function): true`);
                            return true;
                        }
                        else {
                            confirm.delete();
                            console.log("Ending (confirmationMessage) promise...");
                            message.channel.send("Exiting...")
                                .then(exitMessage => {
                                    exitMessage.delete({ timeout: deleteDelay });
                                }).catch(err => console.error(err));
                            console.log(`Confirmation Value (in function): false`);
                            return false;
                        }
                    })
                    // When the user DOESN'T react!
                    .catch(err => {
                        console.error(err);
                        confirm.delete();
                        console.log(`ERROR: User didn't react within ${delayTime / 1000}s!`);
                        console.log("Ending (confirmationMessage) promise...");
                        message.channel.send("Exiting...")
                            .then(exitMessage => {
                                exitMessage.delete({ timeout: deleteDelay });
                            }).catch(err => console.error(err));
                        console.log(`Confirmation Value (in function): false`);
                        return false;
                    });
            }).catch(err => console.error(err));
        return confirmation;
    },

    // BUG: When user reacts too soon, the code breaks, figure out how to let it keep running!
    reactionDataCollect: async function (message, prompt, emojiArray, title = "Reaction", colour = "#ADD8E6", delayTime = 60000, promptMessageDelete = true) {
        const userOriginal = message.author.id;
        var result;
        const deleteDelay = 3000;
        prompt = prompt + `\n*(expires in ${delayTime / 1000}s)*`;

        const embed = new Discord.MessageEmbed()
            .setColor(colour)
            .setTitle(title + "\n(*PLEASE WAIT UNTIL ALL REACTIONS SHOW* or else it will EXIT)")
            .setDescription(prompt);

        await message.channel.send(embed)

            // FIX BUG WHEN USER REACTS TOO SOON! Allow the code to keep running!
            .then(async confirm => {
                emojiArray.forEach((emoji, i) => {
                    confirm.react(emoji)
                        .catch(err => console.error(err));
                });

                const filter = (reaction, user) => {
                    const filterOut = user.id == userOriginal && (emojiArray.includes(reaction.emoji.name));
                    console.log(`For ${user.username}'s ${reaction.emoji.name} reaction, the filter value is: ${filterOut}`);
                    return filterOut;
                };

                // Create the awaitReactions promise object for the confirmation message just sent
                result = await confirm.awaitReactions(filter, { time: delayTime, max: 1 })
                    .then(reacted => {
                        console.log(`User's ${reacted.first().emoji.name} collected!`);
                        if (promptMessageDelete) confirm.delete();
                        console.log(`Reaction Value (in function): ${reacted.first().emoji.name}`);
                        return reacted.first().emoji.name;
                    })
                    // When the user DOESN'T react!
                    .catch(err => {
                        console.error(err);
                        confirm.delete();
                        console.log(`ERROR: User didn't react within ${delayTime / 1000}s!`);
                        console.log("Ending (reactionDataCollect) promise...");
                        message.channel.send("Exiting...")
                            .then(exitMessage => {
                                exitMessage.delete({ timeout: deleteDelay });
                            }).catch(err => console.error(err));
                        console.log(`Reaction Value (in function): undefined`);
                        return false;
                    });
            }).catch(err => {
                console.error(err);
                return;
            });
        return result;
    },

    messageDataCollectFirst: async function (message, prompt, title = "Message Reaction", colour = "#ADD8E6", delayTime = 60000, messageDelete = true) {
        const userOriginal = message.author.id;
        var result;
        const deleteDelay = 3000;
        prompt = prompt + `\n\n\\*P.S. use\`SHIFT+ENTER\` to enter a newline before sending!\n\\*\\*P.P.S Type \`stop\` to **cancel**\n*(expires in ${delayTime / 1000}s)*`;

        const embed = new Discord.MessageEmbed()
            .setColor(colour)
            .setTitle(title)
            .setDescription(prompt);

        await message.channel.send(embed)
            .then(async confirm => {
                const filter = response => {
                    const filterOut = response.author.id == userOriginal;
                    console.log(`For ${response.author.id}'s response, the filter value is: ${filterOut}`);
                    return filterOut;
                };

                // Create the awaitMessages promise object for the confirmation message just sent
                result = await message.channel.awaitMessages(filter, { time: delayTime, max: 1 })
                    .then(async reacted => {
                        console.log(`${reacted.first().author.id}'s message was collected!`);
                        confirm.delete();
                        console.log(`Message Sent (in function): ${reacted.first().content}`);
                        if (messageDelete) {
                            reacted.first().delete();
                            return reacted.first().content;
                        }
                    })
                    // When the user DOESN'T react!
                    .catch(err => {
                        console.error(err);
                        confirm.delete();
                        console.log(`ERROR: User didn't respond within ${delayTime / 1000}s!`);
                        console.log("Ending (messageDataCollect) promise...");
                        message.channel.send("Ending...")
                            .then(exitMessage => {
                                exitMessage.delete({ timeout: deleteDelay });
                            }).catch(err => console.error(err));
                        console.log(`Message Sent (in function): false`);
                        return false;
                    });
            }).catch(err => console.error(err));
        return result;
    },

    // Copied from messageDataCollectFirst - need to make it function properly!
    // messageDataCollect: async function (message, prompt, title = "Message Reaction", colour = "#ADD8E6", delayTime = 60000, messageDelete = true) {
    //     const userOriginal = message.author.id;
    //     var result;
    //     const deleteDelay = 3000;
    //     prompt = prompt + `\n\\*P.S. use\`SHIFT+ENTER\` to enter a newline before sending!\n\\*\\*P.P.S Type \`stop\` to **cancel**\n*(expires in ${delayTime / 1000}s)*`;

    //     const embed = new Discord.MessageEmbed()
    //         .setColor(colour)
    //         .setTitle(title)
    //         .setDescription(prompt);

    //     await message.channel.send(embed)
    //         .then(async confirm => {
    //             const filter = response => {
    //                 const filterOut = response.author.id == userOriginal;
    //                 console.log(`For ${response.author.id}'s response, the filter value is: ${filterOut}`);
    //                 return filterOut;
    //             };

    //             // Create the awaitMessages promise object for the confirmation message just sent
    //             result = await message.channel.awaitMessages(filter, { time: delayTime, max: 1 })
    //                 .then(async reacted => {
    //                     console.log(`${reacted.first().author.id}'s message was collected!`);
    //                     confirm.delete();
    //                     console.log(`Message Sent (in function): ${reacted.first().content}`);
    //                     if (messageDelete) {
    //                         reacted.first().delete();
    //                         return reacted.first().content;
    //                     }
    //                 })
    //                 // When the user DOESN'T react!
    //                 .catch(err => {
    //                     console.error(err);
    //                     confirm.delete();
    //                     console.log(`ERROR: User didn't respond within ${delayTime / 1000}s!`);
    //                     console.log("Ending (messageDataCollect) promise...");
    //                     message.channel.send("Ending...")
    //                         .then(exitMessage => {
    //                             exitMessage.delete({ timeout: deleteDelay });
    //                         }).catch(err => console.error(err));
    //                     console.log(`Message Sent (in function): false`);
    //                     return false;
    //                 });
    //         }).catch(err => console.error(err));
    //     return result;
    // },

    sendMessageToChannel: async function (bot, message, toSend, mistakeMessage, messageColour = "#ADD8E6", 
    postToServerTitle, postToChannelTitle, postTitle) {
        // Check all the servers the bot is in
        let botServers = await bot.guilds.cache.map(guild => guild.id);
        console.log(botServers);

        // Find all the mutual servers with the user and bot
        var botUserServers = new Array();
        var targetServer, targetChannel;
        var channelList, confirmSend, messageEmbed;
        var channelListDisplay = "Type the number corresponding to the channel you want to post in:"
        var serverList = "Type the number corresponding to the server you want to post in:";
        for (i = 0; i < botServers.length; i++) {
            if (await bot.guilds.cache.get(botServers[i]).member(message.author.id)) {
                botUserServers.push(botServers[i]);
                serverList = serverList + `\n\`${i + 1}\` - **` + await bot.guilds.cache.get(botServers[i]).name + "**";
            }
        }

        // Expecting a response from index 0-botUserServers.length - 1
        // List servers: Let user select the server they wish to send their message to
        do {
            targetServer = await this.messageDataCollectFirst(message, serverList, postToServerTitle, messageColour, 120000);
            if (isNaN(targetServer)) {
                if (targetServer.toLowerCase() == "stop") {
                    break;
                }
                else {
                    message.reply("Please enter a number on the given list!")
                        .then(msg => {
                            msg.delete({ timeout: 5000 });
                        })
                        .catch(err => console.error(err));
                }
            }
            else if (parseInt(targetServer) > botUserServers.length || parseInt(targetServer) <= 0) {
                message.reply("Please enter a number on the given list!")
                    .then(msg => {
                        msg.delete({ timeout: 5000 });
                    })
                    .catch(err => console.error(err));
            }
            else {
                // Minus 1 to convert to back array index (was +1 for user understanding)
                targetServer = parseInt(targetServer) - 1;
                break;
            }
        }
        while (true);

        // List channels in the server: Let the user select the server they with to send their message to
        // ONLY the channels that user is able to see
        channelList = await bot.guilds.cache.get(botServers[targetServer]).channels.cache.map(channel => {
            if (channel.permissionsFor(message.author).has("VIEW_CHANNEL") && channel.type !== "category" && channel.type !== "voice") {
                return channel.id;
            }
            else return null;
        }).filter(element => element != null);

        if (channelList.length == 0) {
            message.reply("This server has **no channels!** EXITING...")
                .then(msg => {
                    msg.delete({ timeout: 5000 });
                })
                .catch(err => console.error(err));
            return;
        }
        for (i = 0; i < channelList.length; i++) {
            channelListDisplay = channelListDisplay + `\n\`${i + 1}\` - **` + bot.channels.cache.get(channelList[i]).name + "**";
        }

        do {
            targetChannel = await this.messageDataCollectFirst(message, channelListDisplay, postToChannelTitle, messageColour, 180000);
            if (isNaN(targetChannel)) {
                if (targetChannel.toLowerCase() == "stop") {
                    break;
                }
                else {
                    message.reply("Please enter a number on the given list!")
                        .then(msg => {
                            msg.delete({ timeout: 5000 });
                        })
                        .catch(err => console.error(err));
                }
            }
            else if (parseInt(targetChannel) > channelList.length || parseInt(targetChannel) <= 0) {
                message.reply("Please enter a number on the given list!")
                    .then(msg => {
                        msg.delete({ timeout: 5000 });
                    })
                    .catch(err => console.error(err));
            }
            else {
                targetChannel = parseInt(targetChannel) - 1;
                break;
            }
        }
        while (true);

        confirmSend = await this.confirmationMessage(message, `Are you sure you want to send it to **#${bot.channels.cache.get(channelList[targetChannel]).name}**?`);
        if (!confirmSend) {
            message.reply("Here was your post: (deleting in 10 minutes)\n" + toSend)
            .then(msg => {
                msg.delete({ timeout: 600000 });
            })
            .catch(err => console.error(err));
            message.reply(mistakeMessage)
                .then(msg => {
                    msg.delete({ timeout: 600000 });
                })
                .catch(err => console.error(err));
            return;
        }

        messageEmbed = new Discord.MessageEmbed()
        .setColor(messageColour)
        .setTitle(postTitle)
        .setDescription(toSend);

        bot.channels.cache.get(channelList[targetChannel]).send(messageEmbed);
        return;
    },

    millisecondsToTimeString: function (milliseconds) {
        var hours, minutes, seconds, timeString;
        hours = Math.floor(milliseconds / 3600 / 1000);
        minutes = Math.floor((milliseconds - hours * 3600 * 1000) / 60 / 1000);
        seconds = Math.floor((milliseconds - hours * 3600 * 1000 - minutes * 60 * 1000) / 1000);

        timeString = `${hours}h:${minutes}m:${seconds}s`;
        return (timeString);
    },

    timeCommandHandler: function (args, messageCreatedTime, past = true, future = true) {
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

    fastCursorToString: function (startTimeToDate, endTimeToDate, fastDuration, fastBreaker, moodRating, reflectionText) {
        let fastData = `**Start Time:** ${startTimeToDate}\n` +
            `**End Time:** ${endTimeToDate}\n` +
            `**Fast Duration:** ${this.millisecondsToTimeString(fastDuration)}\n` +
            `**Fast Breaker:** ${fastBreaker}\n` +
            `**Mood Rating (1-5):** ${moodRating}\n` +
            `**Reflection:** ${reflectionText}\n`;
        return fastData;
    },

    showRecentFast: async function (message, fast, fastsInProgress, currentTimestamp, usageMessage) {
        var fastView, fastIndex, startTimeToDate, endTimeToDate, fastDuration;
        var fastBreaker, moodRating, reflectionText, fastData, fastEmbed;
        if (fastsInProgress >= 1) {
            // Show the user the current fast
            fastView = await fast.collection.findOne({
                userID: message.author.id,
                endTime: null
            })
                .catch(err => console.error(err));
            fastIndex = "Current";
            endTimeToDate = fastView.endTime;
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
            fastIndex = "Previous";
            endTimeToDate = new Date(fastView.endTime).toLocaleString();
        }
        startTimeToDate = new Date(fastView.startTime).toLocaleString();
        fastDuration = currentTimestamp - fastView.startTime;
        fastBreaker = fastView.fastBreaker;
        moodRating = fastView.mood;
        reflectionText = fastView.reflection;
        fastData = this.fastCursorToString(startTimeToDate, endTimeToDate, fastDuration,
            fastBreaker, moodRating, reflectionText)
        if (fastsInProgress >= 1) {
            fastData = fastData + `\n(Want to end your fast? \`${prefix}fast end\`)`;
        }
        fastEmbed = new Discord.MessageEmbed()
            .setColor("#00FF00")
            .setTitle(`Fast: See ${fastIndex} Fast`)
            .setDescription(fastData);
        message.channel.send(fastEmbed);
    },

    invalidInputError: async function (message, usageMessage, errorMessage = "INVALID INPUT...", usageReply = true) {
        await message.reply(errorMessage)
            .then(msg => {
                if (usageReply) {
                    message.reply(usageMessage);
                    msg.delete(5000);
                }
            })
            .catch(err => console.error(err));
    },

    weeklyJournalTemplate: function () {
        const weeklyGoalsTemplate = "**__WEEKLY GOALS:__**\n`__**Week:**__\n__**Next Week's 1-3 ABSOLUTE Goals and WHY:**__"
            + "\n**Weekly Goal 1**:\n**Weekly Goal 2**:\n**Weekly Goal 3**:`";
        const weeklyReflectionTemplate = "**__WEEKLY REFLECTION:__**\n`__**Week:**__"
            + "\n**__Previous Week's Assessment: Habit Adherence + 3+ Observations:__**"
            + "\n\n__**Area of Life That Needs the Most Attention:** __\n__**STOP, START, CONTINUE:** __"
            + "\n**STOP**:\n**START**:\n**CONTINUE**:`";
        return weeklyGoalsTemplate + "\n\n" + weeklyReflectionTemplate;
    },

    mastermindWeeklyJournalTemplate: function (i, name = "NAME_") {
        if (name == "NAME_") name = name + i;
        const weeklyJournalTemplate = `__**${name}**__`
            + "\n**__Previous Week's Assessment: Habit Adherence + 3+ Observations:__** "
            + "\n\n__**Area of Life That Needs the Most Attention:**__ \n__**STOP, START, CONTINUE:** __"
            + "\n**STOP**: \n**START**: \n**CONTINUE**: "
            + `\n__**Next Week's 1-3 ABSOLUTE Goals and WHY:**__`
            + "\n**Weekly Goal 1**:\n**Weekly Goal 2**:\n**Weekly Goal 3**:";
        return weeklyJournalTemplate;
    }

};
