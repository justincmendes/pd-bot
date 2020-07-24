/**
 * File of all the important reusable functions!
 */
const Discord = require("discord.js");

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

    reactionDataCollect: async function (message, prompt, emojiArray, title = "Reaction", colour = "#ADD8E6", delayTime = 60000, promptMessageDelete = true) {
        const userOriginal = message.author.id;
        var result;
        const deleteDelay = 3000;
        prompt = prompt + `\n*(expires in ${delayTime / 1000}s)*`;

        const embed = new Discord.MessageEmbed()
            .setColor(colour)
            .setTitle(title)
            .setDescription(prompt);

        await message.channel.send(embed)
            .then(async confirm => {
                emojiArray.forEach(async (emoji, i) => {
                    await confirm.react(emoji);
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
            }).catch(err => console.error(err));
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
    }

};
