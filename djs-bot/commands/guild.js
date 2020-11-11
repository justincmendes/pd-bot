const Discord = require("discord.js");
const User = require("../database/schemas/user");
const Guild = require("../database/schemas/guildsettings");
const Reminder = require("../database/schemas/reminder");
const quotes = require("../../utilities/quotes.json").quotes;
const changePrefix = require("./prefix").run;
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
require("dotenv").config();

const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");
const futureTimeExamples = fn.futureTimeExamples;
const timeExamples = fn.timeExamples;
const intervalExamples = fn.intervalExamplesOver1Hour;
const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const daysOfWeekList = daysOfWeek.map((day, i) => {
    return `\`${i + 1}\` - **${day}**`;
}).join(`\n`);
const guildEmbedColour = fn.guildSettingsEmbedColour;

// Private Function Declarations
/**
 * 
 * @param {Discord.Client} bot 
 * @param {Object} guildSettings 
 * @param {Boolean} inGuild 
 */
function guildDocumentToString(bot, guildSettings, inGuild) {
    const { timezone: { name, offset, daylightSaving }, mastermind, quote, prefix, guildID } = guildSettings;
    const guild = bot.guilds.cache.get(guildID);
    let quoteRoles = new Array(),
        mastermindRoles = new Array;
    quote.roles.forEach((roleID) => {
        const role = guild.roles.cache.get(roleID);
        if (role) {
            if (inGuild) quoteRoles.push(`<@&${roleID}>`);
            else quoteRoles.push(`@${role.name}`);
        }
    });
    mastermind.roles.forEach((roleID) => {
        const role = guild.roles.cache.get(roleID);
        if (role) {
            if (inGuild) mastermindRoles.push(`<@&${roleID}>`);
            else mastermindRoles.push(`@${role.name}`);
        }
    });
    let dayOfWeek = fn.getDayOfWeekToString(mastermind.resetDay);
    if (dayOfWeek === false) dayOfWeek = "Sunday";
    console.log({ quoteRoles, mastermindRoles })
    const output = `__**Prefix:**__ ${prefix}`
        + `\n\n__**General Timezone:**__ ${name}\n- **UTC Offset (in hours):** ${fn.hoursToUTCOffset(offset)}`
        + `\n- **Daylight Savings Time:** ${daylightSaving ? "Yes" : "No"}`
        + `\n\n__**Mastermind:**__\n- **Reset Day:** ${dayOfWeek}`
        + `\n- **Facilitator Role**(**s**)**:**\n${mastermindRoles.length ? `${mastermindRoles.join('\n')}\n` : ""}`
        + `\n__**Quote:**__\n- **Get Quotes:** ${quote.getQuote ? "Yes" : "No"}`
        + `\n- **Channel:**${quote.channel ? ` <#${quote.channel}>` : ""}`
        + `\n- **Notify Role**(**s**)**:**\n${quoteRoles.length ? `${quoteRoles.join('\n')}\n` : ""}`
        + `- **Next Quote:** ${quote.getQuote ? quote.nextQuote ? fn.timestampToDateString(quote.nextQuote + (offset * HOUR_IN_MS)) : "N/A" : "N/A"}`
        + `\n- **Quote Interval:** ${quote.getQuote ? quote.quoteInterval ? `Every ${quote.quoteInterval}` : "N/A" : "N/A"}`;
    return output;
}

module.exports = {
    name: "guild",
    description: "Guild Settings/Preferences: Default Timezone, Mastermind Cron/Reset Timing and Roles, Reminders, etc.",
    aliases: ["servers", "server", "guilds", "config", "guildconfig", "guildsettings", "guildpreferences"],
    cooldown: 2.5,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSaving, forceSkip) {
        // For now, cannot access guild though the dm
        // With the dm - show them the list of mutual guilds
        // and allow them to choose, then make that the guild to show and/or edit
        const authorID = message.author.id;
        var guildID, guildName;
        const inGuild = message.channel.type !== 'dm';
        const guildCommand = args[0] ? args[0].toLowerCase() : false;
        let guildUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed}\` - **(to see guild settings)**`
            + `\n\`${PREFIX}${commandUsed} <ACTION> <force?>\``
            + "\n\n\`<ACTION>\`: **edit/change**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        guildUsageMessage = fn.getMessageEmbed(guildUsageMessage, "Guild Settings: Help", guildEmbedColour);
        if (guildCommand === "help") return message.channel.send(guildUsageMessage);
        else {
            if (!inGuild) {
                let botServers = await bot.guilds.cache.map(guild => guild.id);
                console.log({ botServers });
                const mutualServers = await fn.userAndBotMutualServerIDs(bot, authorID, botServers);
                const serverSelectInstructions = "Type the **number** corresponding to the **server** you want **settings** for:";
                const postToServerTitle = "Guild Settings: Select Server";
                const serverList = await fn.listOfServerNames(bot, mutualServers);
                const targetServerIndex = await fn.userSelectFromList(bot, PREFIX, message, serverList, mutualServers.length,
                    serverSelectInstructions, postToServerTitle, guildEmbedColour, 180000);
                if (targetServerIndex === false) return;
                else {
                    guildID = mutualServers[targetServerIndex];
                    guildName = bot.guilds.cache.get(guildID).name;
                }
            }
            else {
                guildID = message.guild.id;
                guildName = message.guild.name;
            }
        }
        console.log({ guildID, guildName });
        // Show current guild settings by default
        // If in a DM, show the user the list of mutual guilds and ask which one to see/edit
        // See, Edit
        const guild = bot.guilds.cache.get(guildID);
        let guildConfig = await Guild.findOne({ guildID });
        console.log({ guildConfig })
        const guildHelpMessage = `Try \*${PREFIX}${commandUsed} help\* for more options (and how to edit)`;
        const showGuildSettings = fn.getMessageEmbed(guildDocumentToString(bot, guildConfig, inGuild),
            `${guildName}'s Settings`, guildEmbedColour)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter(guildHelpMessage);

        //see, edit (when edit, show see first then usage),
        if (guildCommand === "edit" || guildCommand === "ed" || guildCommand === "e"
            || guildCommand === "change" || guildCommand === "ch" || guildCommand === "c"
            || guildCommand === "setup" || guildCommand === "set" || guildCommand === "s") {
            if (authorID !== guild.owner.id) {
                message.channel.send(showGuildSettings);
                return message.reply("Sorry, you do not have permissions to change the **server settings.**");
            }
            do {
                guildConfig = await Guild.findOne({ guildID });
                var userFields = ["Prefix", "General Timezone", "Daylight Savings Time", "Mastermind Facilitator Roles", "Mastermind Reset Day"];
                var wantsQuote = guildConfig.quote.getQuote;
                if (wantsQuote) userFields = userFields.concat(["Quote Channel", "Quote Roles", "Get Quote", "Next Quote", "Quote Interval"]);
                else userFields = userFields.concat(["Quote Roles", "Get Quote"]);

                let fieldsList = "";
                userFields.forEach((field, i) => {
                    fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
                });
                var continueEdit;
                const fieldToEditInstructions = "**Which field do you want to edit?:**";
                const fieldToEditAdditionalMessage = guildDocumentToString(bot, guildConfig, inGuild);
                const fieldToEditTitle = `${showGuildSettings.title}: Edit Field`;
                let fieldToEditIndex = await fn.userSelectFromList(bot, PREFIX, message, fieldsList, userFields.length, fieldToEditInstructions,
                    fieldToEditTitle, guildEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                const type = "Guild";
                const fieldToEdit = userFields[fieldToEditIndex];
                continueEdit = false;
                var userEdit, guildSettingsPrompt = "";
                let quote = guildConfig.quote;
                switch (fieldToEditIndex) {
                    case 0:
                        guildSettingsPrompt = `Please enter the server's **new prefix** (currently **${guildConfig.prefix}**):`;
                        userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                        break;
                    case 1:
                        guildSettingsPrompt = `Please enter the server's **__general timezone__** as an **abbreviation** or **+/- UTC Offset**:`;
                        userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                        break;
                    case 2:
                        guildSettingsPrompt = `Does your timezone participate in **Daylight Savings Time (DST)?**\n**⌚ - Yes\n⛔ - No**`;
                        userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, guildSettingsPrompt,
                            ['⌚', '⛔'], type, forceSkip, guildEmbedColour);
                        break;
                    case 3:
                        guildSettingsPrompt = `Please enter one or more **mastermind facilitator roles:** (Cap at 5)`
                            + `\n(**Current roles:** ${guildConfig.mastermind.roles.map(roleID => `<@&${roleID}>`).join(', ')})`;
                        userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                        break;
                    case 4:
                        guildSettingsPrompt = `Enter the number corresponding to the __**day of the week**__ when you would like the server's **weekly mastermind reset to happen:**`;
                        userEdit = await fn.getUserEditNumber(bot, message, PREFIX, fieldToEdit, daysOfWeek.length, type, daysOfWeek, forceSkip, guildEmbedColour, `${guildSettingsPrompt}\n\n${daysOfWeekList}`);
                        if (userEdit !== false && !isNaN(userEdit)) userEdit--;
                        console.log({ userEdit });
                        break;
                    case wantsQuote ? 5 : null:
                        guildSettingsPrompt = `Please enter the **target channel (using #)** send quotes to.`;
                        userEdit = await rm.getChannelOrDM(bot, message, PREFIX, guildSettingsPrompt, `Guild: Quote Channel`, false, guildEmbedColour);
                        break;
                    case wantsQuote ? 6 : 5:
                        guildSettingsPrompt = `Please enter one or more **quote roles (to get recurring inspiration):** (Cap at 5)`
                            + `\n(**Current roles:** ${guildConfig.quote.roles.map(roleID => `<@&${roleID}>`).join(', ')})`;
                        userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                        break;
                    case wantsQuote ? 7 : 6:
                        guildSettingsPrompt = `Do you want to regularly receive an **inspirational quote?**\n🙌 - **Yes**\n⛔ - **No**`;
                        userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, guildSettingsPrompt,
                            ['🙌', '⛔'], type, forceSkip, guildEmbedColour);
                        break;
                    case wantsQuote ? 8 : null:
                        if (wantsQuote) {
                            guildSettingsPrompt = `\n__**When do you intend to start the next quote?**__ ⌚\n${futureTimeExamples}`
                                + "\n\nType `skip` to **start it now**"
                            userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                        }
                        else {
                            fn.sendReplyThenDelete(message, "Make sure you allow yourself to **Get Quotes** first, before then adjusting the interval", 60000);
                            userEdit = "back";
                            continueEdit = true;
                        }
                        break;
                    case wantsQuote ? 9 : null:
                        if (wantsQuote) {
                            guildSettingsPrompt = `How often do you want to receive an inspirational quote?\n\n${intervalExamples}`;
                            userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, guildSettingsPrompt, type, forceSkip, guildEmbedColour);
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
                    const roleRegex = /\<\@\&(\d+)\>/g;
                    const channelRegex = /\<\#(\d+)\>/g;
                    switch (fieldToEditIndex) {
                        case 0:
                            {
                                await changePrefix(bot, message, "", [userEdit],
                                    PREFIX, timezoneOffset, daylightSaving, true);
                                guildConfig = await Guild.findOne({ guildID });
                            }
                            break;
                        case 1:
                            {
                                let updatedTimezone = fn.getTimezoneOffset(userEdit);
                                console.log({ updatedTimezone, continueEdit })
                                if (updatedTimezone || updatedTimezone === 0) {
                                    const daylightSetting = guildConfig.timezone.daylightSaving
                                    if (daylightSetting) {
                                        updatedTimezone += fn.isDaylightSavingTime(Date.now() + updatedTimezone * HOUR_IN_MS,
                                            userEdit, true) ? fn.getTimezoneDaylightOffset(userEdit) : 0;
                                    }
                                    guildConfig = await Guild.findOneAndUpdate({ guildID }, {
                                        $set: {
                                            timezone: {
                                                name: userEdit,
                                                offset: updatedTimezone,
                                                daylightSaving: daylightSetting,
                                            }
                                        }
                                    }, { new: true });
                                }
                                else {
                                    fn.sendReplyThenDelete(message, "**This timezone does not exist...**", 60000);
                                    continueEdit = true;
                                }
                                console.log({ continueEdit });
                            }
                            break;
                        case 2:
                            {
                                switch (userEdit) {
                                    case '⌚': userEdit = true;
                                        break;
                                    case '⛔': userEdit = false;
                                        break;
                                    default: userEdit = null;
                                        break;
                                }
                                if (typeof userEdit === "boolean") {
                                    const originalTimezone = guildConfig.timezone.name;
                                    let updatedTimezoneOffset = fn.getTimezoneOffset(originalTimezone);
                                    if (userEdit === true) {
                                        updatedTimezoneOffset += fn.isDaylightSavingTime(Date.now() + updatedTimezoneOffset * HOUR_IN_MS,
                                            originalTimezone, true) ?
                                            fn.getTimezoneDaylightOffset(originalTimezone) : 0;
                                    }
                                    guildConfig = await Guild.findOneAndUpdate({ guildID }, {
                                        $set: {
                                            timezone: {
                                                name: originalTimezone,
                                                offset: updatedTimezoneOffset,
                                                daylightSaving: userEdit,
                                            }
                                        }
                                    }, { new: true });
                                    console.log({ guildConfig });
                                }
                                else continueEdit = true;
                            }
                            break;
                        case 3:
                            {
                                let roles = new Array()
                                userEdit.replace(roleRegex, (match, roleID, offset, string) => {
                                    roles.push(roleID);
                                });
                                roles = roles.slice(0, 5); // Cap at 5
                                console.log({ roles });
                                guildConfig = await Guild.findOneAndUpdate({ guildID },
                                    { $set: { 'mastermind.roles': roles } }, { new: true });
                                console.log({ guildConfig });
                            }
                            break;
                        case 4:
                            {
                                guildConfig = await Guild.findOneAndUpdate({ guildID },
                                    { $set: { 'mastermind.resetDay': userEdit } }, { new: true });
                            }
                            break;
                        case wantsQuote ? 5 : null:
                            {
                                const channel = channelRegex.exec(userEdit);
                                if (channel) {
                                    quote.channel = channel[1];
                                    guildConfig = await Guild.findOneAndUpdate({ guildID },
                                        { $set: { quote } }, { new: true });
                                    console.log({ guildConfig });
                                }
                            }
                            break;
                        case wantsQuote ? 6 : 5:
                            {
                                let roles = new Array()
                                userEdit.replace(roleRegex, (match, roleID, offset, string) => {
                                    roles.push(roleID);
                                });
                                roles = roles.slice(0, 5); // Cap at 5
                                console.log({ roles });
                                quote.roles = roles;
                                guildConfig = await Guild.findOneAndUpdate({ guildID },
                                    { $set: { quote } }, { new: true });
                                console.log({ guildConfig });
                            }
                            break;
                        case wantsQuote ? 7 : 6:
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
                                    quote.getQuote = userEdit;
                                    if (userEdit) {
                                        let targetChannel = await rm.getChannelOrDM(bot, message, PREFIX, `Please enter the **target channel (using #)** send quotes to.`, `Guild: Quote Channel`, false, guildEmbedColour);
                                        targetChannel = channelRegex.exec(targetChannel);
                                        if (!targetChannel) return;
                                        quote.channel = targetChannel[1];

                                        guildSettingsPrompt = `Please enter one or more **quote \@roles (to get notified with the quotes):** (Cap at 5)`
                                            + `\n(**Current roles:** ${guildConfig.quote.roles.map(roleID => `<@&${roleID}>`).join(', ')})`
                                            + `\n\nType \`same\` to **keep the same roles** as shown above`;
                                        const updatedRoles = await fn.getUserEditString(bot, message, PREFIX, "Quote Role(s)", guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                                        if (!updatedRoles) return;
                                        else if (updatedRoles === "back") {
                                            continueEdit = true;
                                            break;
                                        }
                                        if (updatedRoles !== "same") {
                                            let roles = new Array()
                                            updatedRoles.replace(roleRegex, (match, roleID, offset, string) => {
                                                roles.push(roleID);
                                            });
                                            roles = roles.slice(0, 5); // Cap at 5
                                            console.log({ roles });
                                            quote.roles = roles;
                                        }
                                        guildSettingsPrompt = `How often do you want to receive an inspirational quote?\n\n${intervalExamples}`;
                                        let intervalInput = await fn.getUserEditString(bot, message, PREFIX, "Quote Interval", guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                                        if (!intervalInput) return;
                                        else if (intervalInput === "back") {
                                            continueEdit = true;
                                            break;
                                        }
                                        intervalInput = intervalInput.toLowerCase().split(/[\s\n]+/);
                                        let now = Date.now();
                                        const timeArgs = intervalInput[0] === "in" ? intervalInput : ["in"].concat(intervalInput);
                                        let endTime = fn.timeCommandHandlerToUTC(timeArgs, now, timezoneOffset,
                                            daylightSaving, true, true, true);
                                        if (!endTime) {
                                            error = true;
                                            continueEdit = true;
                                            interval = false;
                                        }
                                        else {
                                            endTime -= HOUR_IN_MS * timezoneOffset;
                                            now = fn.getCurrentUTCTimestampFlooredToSecond();
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
                                            quote.quoteInterval = intervalInput.join(' ');
                                            guildSettingsPrompt = `\n__**When do you intend to start the first quote?**__ ⌚\n${futureTimeExamples}`
                                                + "\n\nType `skip` to **start it now**"
                                            let quoteTrigger = await fn.getUserEditString(bot, message, PREFIX, "First Quote Time", guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                                            if (!quoteTrigger) return;
                                            else if (quoteTrigger === "back") {
                                                continueEdit = true;
                                            }
                                            else {
                                                const isCurrent = quoteTrigger === "skip" || quoteTrigger === "now";
                                                currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                                                if (isCurrent) firstQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                                else {
                                                    quoteTrigger = quoteTrigger.toLowerCase().split(/[\s\n]+/);
                                                    const triggerArgs = quoteTrigger[0] === "in" ? quoteTrigger : ["in"].concat(quoteTrigger);
                                                    firstQuote = fn.timeCommandHandlerToUTC(triggerArgs, currentTimestamp, timezoneOffset, daylightSaving);
                                                }
                                                if (firstQuote) {
                                                    firstQuote -= HOUR_IN_MS * timezoneOffset;
                                                    if (firstQuote - currentTimestamp >= 0) {
                                                        continueEdit = false;
                                                        quote.nextQuote = firstQuote;
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
                                        // Get the first instance!
                                    }
                                    else {
                                        console.log(`Deleting ${authorUsername}'s (${authorID}) recurring quotes`);
                                        await Reminder.deleteMany({ isDM: false, isRecurring: true, type: "Quote", guildID })
                                            .catch(err => {
                                                console.error(err);
                                                console.log("Deletion of recurring quote has failed!");
                                            });
                                    }
                                    if (!error) {
                                        guildConfig = await Guild.findOneAndUpdate({ guildID },
                                            { $set: { quote } }, { new: true });
                                    }
                                }
                                else {
                                    guildConfig = await Guild.findOneAndUpdate({ guildID },
                                        { $set: { quote } }, { new: true });
                                    continueEdit = true;
                                }
                            }
                            break;
                        case 8:
                            {
                                let nextQuote;
                                const isCurrent = userEdit === "skip" || userEdit === "now";
                                currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                                if (isCurrent) nextQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                else {
                                    userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                    const timeArgs = userEdit[0] === "in" ? userEdit : ["in"].concat(userEdit);
                                    nextQuote = fn.timeCommandHandlerToUTC(timeArgs, currentTimestamp, timezoneOffset, daylightSaving);
                                }
                                if (nextQuote) {
                                    nextQuote -= HOUR_IN_MS * timezoneOffset;
                                    if (nextQuote - currentTimestamp >= 0) {
                                        quote.nextQuote = nextQuote;
                                        guildConfig = await Guild.findOneAndUpdate({ guildID },
                                            { $set: { quote } }, { new: true });
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
                        case 9:
                            {
                                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                console.log({ userEdit });
                                let currentTimestamp = Date.now();
                                const timeArgs = userEdit[0] === "in" ? userEdit : ["in"].concat(userEdit);
                                let endInterval = fn.timeCommandHandlerToUTC(timeArgs, currentTimestamp,
                                    timezoneOffset, daylightSaving, true, true, true);
                                if (!endInterval) {
                                    fn.sendReplyThenDelete(message, `**INVALID TIME**... ${settingHelpMessage}`, 60000);
                                    continueEdit = true;
                                }
                                else {
                                    endInterval -= HOUR_IN_MS * timezoneOffset;
                                    currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                                    const updatedInterval = endInterval - currentTimestamp;
                                    if (updatedInterval < HOUR_IN_MS) {
                                        fn.sendReplyThenDelete(message, "Please enter an interval __**> 1 hour**__");
                                        continueEdit = true;
                                    }
                                    else {
                                        quote.quoteInterval = userEdit.join(' ');
                                        quote.nextQuote += HOUR_IN_MS * timezoneOffset;
                                        guildSettingsPrompt = `\n__**When do you intend to start the first quote?**__ ⌚`
                                            + `${quote.nextQuote ? !isNaN(quote.nextQuote) ? `\n\n**Currently**: ${fn.timestampToDateString(quote.nextQuote)}` : "" : ""}`
                                            + `\n${futureTimeExamples}\n\nType \`same\` to **keep it the same**\nType \`skip\` to **start it now**`
                                        let quoteTrigger = await fn.getUserEditString(bot, message, PREFIX, "First Quote Time", guildSettingsPrompt, type, forceSkip, guildEmbedColour);
                                        if (!quoteTrigger) return;
                                        else if (quoteTrigger === "back") {
                                            continueEdit = true;
                                        }
                                        else {
                                            var firstQuote;
                                            if (quoteTrigger === "same") {
                                                firstQuote = quote.nextQuote;
                                            }
                                            else {
                                                const isCurrent = quoteTrigger === "skip" || quoteTrigger === "now";
                                                currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                                                if (isCurrent) firstQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                                                else {
                                                    quoteTrigger = quoteTrigger.toLowerCase().split(/[\s\n]+/);
                                                    const triggerArgs = quoteTrigger[0] === "in" ? quoteTrigger : ["in"].concat(quoteTrigger);
                                                    firstQuote = fn.timeCommandHandlerToUTC(triggerArgs, currentTimestamp, timezoneOffset, daylightSaving);
                                                }
                                            }
                                            if (firstQuote) {
                                                firstQuote -= HOUR_IN_MS * timezoneOffset;
                                                if (firstQuote - currentTimestamp >= 0) {
                                                    quote.nextQuote = firstQuote;
                                                    guildConfig = await Guild.findOneAndUpdate({ guildID },
                                                        { $set: { quote } }, { new: true });
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
                    if (guildConfig.quote.getQuote) {
                        if (fieldToEditIndex >= 5 && fieldToEditIndex <= 9) {
                            const now = fn.getCurrentUTCTimestampFlooredToSecond();
                            await Reminder.deleteMany({ type: "Quote", isDM: false, guildID });
                            let currentQuote = null;
                            var quoteIndex;
                            while (!currentQuote) {
                                quoteIndex = Math.round(Math.random() * quotes.length);
                                currentQuote = quotes[quoteIndex].message;
                            }
                            if (guildConfig.quote.roles.length) {
                                currentQuote += '\n';
                                guildConfig.quote.roles.forEach(role => {
                                    currentQuote += `<@&${role}> `;
                                });
                            }
                            await rm.setNewChannelReminder(bot, authorID, guildConfig.quote.channel, now, guildConfig.quote.nextQuote,
                                currentQuote, "Quote", guildConfig._id, true, guildConfig.quote.quoteInterval);
                        }
                    }
                    const continueEditMessage = `Do you want to continue **editing your settings?**\n\n${guildDocumentToString(bot, guildConfig, inGuild)}`;
                    continueEdit = await fn.getUserConfirmation(bot, message, PREFIX, continueEditMessage, forceSkip, `Guild: Continue Editing?`, 300000);
                }
            }
            while (continueEdit === true)
            return;
        }
        else return message.channel.send(showGuildSettings);
    }
};