/**
 * File of all the important reusable functions!
 */
const Discord = require("discord.js");

module.exports = {
    confirmationMessage: async function (message, confirmMessage) {
        const agree = "✅";
        const disagree = "❌";
        const userOriginal = message.author.id;
        var confirmation;
        const delayTime = 30000;
        const deleteDelay = 3000;
        confirmMessage = confirmMessage + `\n*(expires in ${delayTime / 1000}s)*`;

        const embed = new Discord.MessageEmbed()
            .setColor("#FF0000")
            .setTitle("Confirmation")
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
                        console.log(`ERROR: User didn't react within ${delayTime/1000}s!`);
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

    millisecondsToTimeString: function (milliseconds) {
        var hours, minutes, seconds, timeString;
        hours = Math.floor(milliseconds / 3600 / 1000);
        minutes = Math.floor((milliseconds - hours * 3600 * 1000) / 60 / 1000);
        seconds = Math.floor((milliseconds - hours * 3600 * 1000 - minutes * 60 * 1000) / 1000);

        timeString = `${hours}h:${minutes}m:${seconds}s`;
        return (timeString);
    },

    timeCommandHandler: function (args, messageCreatedTime) {
        if (args[1].toLowerCase() == "now") return messageCreatedTime;
        else return (false);
    }

};
