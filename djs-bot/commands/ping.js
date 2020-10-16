module.exports = {
    name: "ping",
    description: "Ping command to show user the bot's response time!",
    cooldown: 2,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        //Show time between user command and bot reply = ping time!
        let pingTime = message.createdTimestamp;
        let pingMessage = await message.channel.send("Pong!");
        let botSendTime = pingMessage.createdTimestamp;
        pingTime = botSendTime - pingTime;
        pingMessage.edit(`Pong! \`${pingTime}ms\``).catch(console.error);
    }
};