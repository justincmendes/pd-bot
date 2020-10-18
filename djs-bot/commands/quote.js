const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const quotes = require("../../utilities/quotes.json").quotes;
require("dotenv").config();

const quoteEmbedColour = fn.quoteEmbedColour;
const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs('hour');

// Private Function Declarations
function quoteDocumentToString(quoteDocument, offset) {
    const { getQuote, nextQuote, quoteInterval } = quoteDocument;
    return `__**Get Quotes:**__ ${getQuote ? "Yes" : "No"}`
        + `\n- **Next Quote:** ${getQuote ? nextQuote ? fn.timestampToDateString(nextQuote + (offset * HOUR_IN_MS)) : "N/A" : "N/A"}`
        + `\n- **Quote Interval:** ${getQuote ? quoteInterval ? fn.millisecondsToTimeString(quoteInterval) : "N/A" : "N/A"}`;
}

module.exports = {
    name: "quote",
    description: "Get a random quotation or setup a time to get a recurring quotation sent to your DMs!",
    aliases: ["quotation", "quotes", "quo", "q",],
    cooldown: 1,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        const authorUsername = message.author.username;
        const authorID = message.author.id;
        const quoteCommand = args[0] ? args[0].toLowerCase() : false;
        let quoteUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed}\` - **(to get a random quotation)**`
            + `\n\`${PREFIX}${commandUsed} setup\``
            + "\n\n\`setup\`: **To setup when you'd like to receieve quotes regularly**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        quoteUsageMessage = fn.getMessageEmbed(quoteUsageMessage, "Quote: Help", quoteEmbedColour);
        if (quoteCommand === "help") return message.channel.send(quoteUsageMessage);
        else if (quoteCommand === "setup" || quoteCommand === "start" || quoteCommand === "st" || quoteCommand === "s"
            || quoteCommand === "settings" || quoteCommand === "setting" || quoteCommand === "configuration" || quoteCommand === "config"
            || quoteCommand === "c" || quoteCommand === "edit" || quoteCommand === "ed" || quoteCommand === "e"
            || quoteCommand === "change" || quoteCommand === "ch") {
            let quoteSettings = await User.findOne({ discordID: authorID }, { getQuote: 1, quoteInterval: 1, nextQuote: 1 });
            if (!quoteSettings) return message.reply(`Try \`${PREFIX}settings\` to setup your settings!`);

            do {
                var quoteFields = quoteSettings.getQuote ? ["Get Quotes", "Next Quote", "Quote Interval"] : ["Get Quotes"];
                let fieldsList = "";
                quoteFields.forEach((field, i) => {
                    fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
                });
                var continueEdit;
                const fieldToEditInstructions = "**Which field do you want to edit?:**";
                const fieldToEditAdditionalMessage = quoteDocumentToString(quoteSettings, timezoneOffset);
                const fieldToEditTitle = "Quote: Edit Field";
                let fieldToEditIndex = await fn.userSelectFromList(bot, PREFIX, message, fieldsList, quoteFields.length, fieldToEditInstructions,
                    fieldToEditTitle, quoteEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                const type = "Quote";
                const fieldToEdit = quoteFields[fieldToEditIndex];
                continueEdit = false;
                var userEdit, quoteSettingsPrompt = "";
                switch (fieldToEditIndex) {
                    case 0:
                        quoteSettingsPrompt = `Do you want to regularly recieve an **inspirational quote?**\n🙌 - **Yes**\n⛔ - **No**`;
                        userEdit = await fn.getUserEditBoolean(bot, message, fieldToEdit, quoteSettingsPrompt,
                            ['🙌', '⛔'], type, forceSkip, quoteEmbedColour);
                        break;
                    case 1:
                        if (quoteSettings.getQuote) {
                            quoteSettingsPrompt = `__**When do you intend to start the next quote?**__`
                                + "\n\nType `skip` to **start it now**"
                            userEdit = await fn.getUserEditString(bot, message, fieldToEdit, quoteSettingsPrompt, type, forceSkip, quoteEmbedColour);
                        }
                        else {
                            fn.sendReplyThenDelete(message, "Make sure you allow yourself to **Get Quotes** first, before then adjusting the interval", 60000);
                            userEdit = "back";
                            continueEdit = true;
                        }
                        break;
                    case 2:
                        if (quoteSettings.getQuote) {
                            quoteSettingsPrompt = `How often do you want to receive an **inspiration quote?**`
                                + `\nEnter a **time interval** (i.e. 36 hours, 12h:5m:30s, 24 days, etc. - any interval __**> 1 hour**__)`;
                            userEdit = await fn.getUserEditString(bot, message, fieldToEdit, quoteSettingsPrompt, type, forceSkip, quoteEmbedColour);
                        }
                        else {
                            fn.sendReplyThenDelete(message, "Make sure you allow yourself to **Get Quotes** first, before then adjusting the interval", 60000);
                            userEdit = "back";
                            continueEdit = true;
                        }
                        break;
                }
                if (userEdit === false) return;
                else if (userEdit === undefined) userEdit = "back";
                else if (userEdit !== "back") {
                    switch (fieldToEditIndex) {
                        case 0:
                            {
                                switch (userEdit) {
                                    case '🙌': userEdit = true;
                                        break;
                                    case '⛔': userEdit = false;
                                        break;
                                    default: userEdit = null;
                                        break;
                                }
                                // setup interval!
                                if (typeof userEdit === "boolean") {
                                    var interval, firstQuote;
                                    let error = false;
                                    if (userEdit) {
                                        quoteSettingsPrompt = `How often do you want to receive an inspiration quote?`
                                            + `\nEnter a **time interval** (i.e. 36 hours, 12h:5m:30s, 24 days, etc. - any interval __**> 1 hour**__)`;
                                        let intervalInput = await fn.getUserEditString(bot, message, "Quote Interval", quoteSettingsPrompt, type, forceSkip, quoteEmbedColour);
                                        if (!intervalInput) return;
                                        else if (intervalInput === "back") {
                                            continueEdit = true;
                                        }
                                        else {
                                            intervalInput = intervalInput.toLowerCase().split(/[\s\n]+/);
                                            let now = Date.now();
                                            const endTime = fn.timeCommandHandlerToUTC(intervalInput[0] === "in" ? intervalInput
                                                : ["in"].concat(intervalInput), now, timezoneOffset, daylightSavings)
                                                - HOUR_IN_MS * timezoneOffset;
                                            if (!endTime) {
                                                error = true;
                                                continueEdit = true;
                                                interval = false;
                                            }
                                            else {
                                                now = Date.now();
                                                interval = endTime - now;
                                            }
                                            if (!interval) {
                                                fn.sendReplyThenDelete(message, `**INVALID TIME**... ${settingHelpMessage}`, 60000);
                                                error = true;
                                                continueEdit = true;
                                            }
                                            else if (interval < HOUR_IN_MS) {
                                                fn.sendReplyThenDelete(message, "Please enter an interval __**> 1 hour**__");
                                                error = true;
                                                continueEdit = true;
                                            }
                                            else {
                                                quoteSettingsPrompt = `__**When do you intend to start the first quote?**__`
                                                    + "\n\nType `skip` to **start it now**"
                                                let quoteTrigger = await fn.getUserEditString(bot, message, "First Quote Time", quoteSettingsPrompt, type, forceSkip, quoteEmbedColour);
                                                if (!quoteTrigger) return;
                                                else {
                                                    const isCurrent = quoteTrigger === "skip" || quoteTrigger === "now";
                                                    currentTimestamp = Date.now();
                                                    if (isCurrent) firstQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                                    else {
                                                        quoteTrigger = quoteTrigger.toLowerCase().split(/[\s\n]+/);
                                                        firstQuote = fn.timeCommandHandlerToUTC(quoteTrigger[0] === "in" ? quoteTrigger
                                                            : (["in"].concat(quoteTrigger)), currentTimestamp,
                                                            timezoneOffset, daylightSavings);
                                                    }
                                                    if (firstQuote) {
                                                        firstQuote -= HOUR_IN_MS * timezoneOffset;
                                                        if (firstQuote - currentTimestamp >= 0) {
                                                            continueEdit = false;
                                                        }
                                                        else {
                                                            fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                                            continueEdit = true;
                                                            error = true;
                                                        }
                                                    }
                                                    else {
                                                        fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                                        continueEdit = true;
                                                        error = true;
                                                    }
                                                }
                                            }
                                        }
                                        // Get the first instance!
                                    }
                                    else {
                                        console.log(`Deleting ${authorUsername}'s (${authorID}) recurring quotes`);
                                        await Reminder.deleteOne({ userID: authorID, isDM: true, isRecurring: true, type: "Quote" })
                                            .catch(err => {
                                                console.error(err);
                                                console.log("Deletion of recurring quote has failed!");
                                            });
                                    }
                                    if (!error) {
                                        quoteSettings = await User.findOneAndUpdate({ discordID: authorID },
                                            {
                                                $set:
                                                {
                                                    getQuote: userEdit,
                                                    quoteInterval: interval,
                                                    nextQuote: firstQuote,
                                                }
                                            }, { new: true });
                                    }
                                }
                                else continueEdit = true;
                            }
                            break;
                        case 1:
                            {
                                let nextQuote;
                                const isCurrent = userEdit === "skip" || userEdit === "now";
                                currentTimestamp = Date.now();
                                if (isCurrent) nextQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                else {
                                    userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                    nextQuote = fn.timeCommandHandlerToUTC(userEdit[0] === "in" ? userEdit
                                        : (["in"].concat(userEdit)), currentTimestamp,
                                        timezoneOffset, daylightSavings);
                                }
                                if (nextQuote) {
                                    nextQuote -= HOUR_IN_MS * timezoneOffset;
                                    if (nextQuote - currentTimestamp >= 0) {
                                        quoteSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                                            $set:
                                            {
                                                getQuote: true,
                                                quoteInterval: quoteSettings.quoteInterval,
                                                nextQuote,
                                            }
                                        }, { new: true });
                                        continueEdit = false;
                                    }
                                    else {
                                        fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                        continueEdit = true;
                                    }
                                }
                                else {
                                    fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                    continueEdit = true;
                                }
                            }
                            break;
                        case 2:
                            {
                                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                console.log({ userEdit });
                                let currentTimestamp = Date.now();
                                let endInterval = fn.timeCommandHandlerToUTC(userEdit[0] === "in" ? userEdit
                                    : (["in"].concat(userEdit)), currentTimestamp, timezoneOffset, daylightSavings);
                                if (!endInterval) {
                                    fn.sendReplyThenDelete(message, `**INVALID TIME**... ${settingHelpMessage}`, 60000);
                                    continueEdit = true;
                                }
                                else {
                                    endInterval -= HOUR_IN_MS * timezoneOffset;
                                    currentTimestamp = Date.now();
                                    const updatedInterval = endInterval - currentTimestamp;
                                    if (updatedInterval < HOUR_IN_MS) {
                                        fn.sendReplyThenDelete(message, "Please enter an interval __**> 1 hour**__");
                                        continueEdit = true;
                                    }
                                    else {
                                        let { nextQuote } = userSettings;
                                        nextQuote += HOUR_IN_MS * timezoneOffset;
                                        quoteSettingsPrompt = `__**When do you intend to start the first quote?**__`
                                            + `${nextQuote ? !isNaN(nextQuote) ? `\n**Currently**: ${fn.timestampToDateString(nextQuote)}` : "" : ""}`
                                            + "\n\nType `same` to **keep it the same**\nType `skip` to **start it now**"
                                        let quoteTrigger = await fn.getUserEditString(bot, message, "First Quote Time", quoteSettingsPrompt, type, forceSkip, quoteEmbedColour);
                                        if (!quoteTrigger) return;
                                        else {
                                            var firstQuote;
                                            if (quoteTrigger === "same") {
                                                firstQuote = nextQuote;
                                            }
                                            else {
                                                const isCurrent = quoteTrigger === "skip" || quoteTrigger === "now";
                                                currentTimestamp = Date.now();
                                                if (isCurrent) firstQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                                else {
                                                    quoteTrigger = quoteTrigger.toLowerCase().split(/[\s\n]+/);
                                                    firstQuote = fn.timeCommandHandlerToUTC(quoteTrigger[0] === "in" ? quoteTrigger
                                                        : (["in"].concat(quoteTrigger)), currentTimestamp,
                                                        timezoneOffset, daylightSavings);
                                                }
                                            }
                                            if (firstQuote) {
                                                firstQuote -= HOUR_IN_MS * timezoneOffset;
                                                if (firstQuote - currentTimestamp >= 0) {
                                                    quoteSettings = await User.findOneAndUpdate({ discordID: authorID }, {
                                                        $set:
                                                        {
                                                            getQuote: true,
                                                            quoteInterval: updatedInterval,
                                                            nextQuote: firstQuote,
                                                        }
                                                    }, { new: true });
                                                    continueEdit = false;
                                                }
                                                else {
                                                    fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                                    continueEdit = true;
                                                }
                                            }
                                            else {
                                                fn.sendReplyThenDelete(message, "Please enter a **proper trigger time in the future**");
                                                continueEdit = true;
                                            }
                                        }
                                    }
                                }
                            }
                            break;
                    }
                }
                else continueEdit = true;
                if (!continueEdit) {
                    if (userEdit) {
                        await Reminder.deleteMany({ userID: authorID, type: "Quote", isDM: true, });
                        const currentTimestamp = Date.now();
                        var quoteIndex, currentQuote;
                        while (!currentQuote) {
                            quoteIndex = Math.round(Math.random() * quotes.length);
                            currentQuote = quotes[quoteIndex].message;
                        }
                        await rm.setNewDMReminder(bot, authorID, currentTimestamp, currentTimestamp, quoteSettings.nextQuote,
                            currentQuote, "Quote", false, true, quoteSettings.quoteInterval, quoteEmbedColour);
                    }
                    const continueEditMessage = `Do you want to continue **editing your quote settings?**\n\n${quoteDocumentToString(quoteSettings, timezoneOffset)}`;
                    continueEdit = await fn.getUserConfirmation(message, continueEditMessage, forceSkip, `Quote: Continue Editing?`, 300000);
                }
            }
            while (continueEdit === true)
            return;
        }
        else {
            // If no args - send a random quote
            const quoteIndex = Math.round(Math.random() * quotes.length);
            const showQuote = quotes[quoteIndex].message;
            const embed = fn.getMessageEmbed(showQuote, "Quote", quoteEmbedColour)
                .setFooter(`Type: ${PREFIX}quote help - for more ways to get quotes!`);
            return message.channel.send(embed);
        }
    }
};