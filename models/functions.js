/**
 * File of all the important reusable functions!
 */
const Discord = require("discord.js");
const botSettings = require("../botsettings.json");
const prefix = botSettings.PREFIX;

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
        prompt = prompt + `\n\\*P.S. use\`SHIFT+ENTER\` to enter a newline before sending!\n\\*\\*P.P.S Type \`stop\` to **cancel**\n*(expires in ${delayTime / 1000}s)*`;

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
    messageDataCollect: async function (message, prompt, title = "Message Reaction", colour = "#ADD8E6", delayTime = 60000, messageDelete = true) {
        const userOriginal = message.author.id;
        var result;
        const deleteDelay = 3000;
        prompt = prompt + `\n\\*P.S. use\`SHIFT+ENTER\` to enter a newline before sending!\n\\*\\*P.P.S Type \`stop\` to **cancel**\n*(expires in ${delayTime / 1000}s)*`;

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

    sendMessageToChannel: async function (bot, message, toSend) {
        message.reply("In development...");
        // Which Server?
        // Which Channel?
        // Confirmation.
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

    invalidInputError: async function(message, usageMessage, errorMessage = "INVALID INPUT...", usageReply = true) {
        await message.reply(errorMessage)
        .then(msg => {
            if(usageReply) {
            message.reply(usageMessage);
            msg.delete(5000);
            }
        })
        .catch(err => console.error(err));
    }

};
