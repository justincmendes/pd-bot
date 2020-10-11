const Discord = require("discord.js");
const User = require("../database/schemas/user");
const GuildConfig = require("../database/schemas/guildsettings");
const changePrefix = require("./prefix").run;
const fn = require("../../utilities/functions");
require("dotenv").config();

const guildEmbedColour = fn.guildSettingsEmbedColour;
const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const daysOfWeekList = daysOfWeek.map((day, i) => {
    return `\`${i + 1}\` - **${day}**`;
}).join(`\n`);

// Private Function Declarations
/**
 * 
 * @param {Discord.Client} bot 
 * @param {Object} guildSettings 
 * @param {Boolean} inGuild 
 */
function guildDocumentToString(bot, guildSettings, inGuild) {
    const { timezone: { name, offset, daylightSavings }, mastermind, quote, prefix, guildID } = guildSettings;
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
        + `\n- **Daylight Savings Time:** ${daylightSavings ? "Yes" : "No"}`
        + `\n\n__**Mastermind:**__\n- **Reset Day:** ${dayOfWeek}`
        + `\n- **Facilitator Role**(**s**)**:**\n${mastermindRoles.length ? `${mastermindRoles.join('\n')}\n` : ''}`
        + `\n__**Quote Role**(**s**)**:**__\n${quoteRoles.length ? `${quoteRoles.join('\n')}\n` : ''}`;
    return output;
}

module.exports = {
    name: "guild",
    description: "Guild Settings/Preferences: Default Timezone, Mastermind Cron/Reset Timing and Roles, Reminders, etc.",
    aliases: ["servers", "server", "guilds", "config", "guildconfig", "guildsettings", "guildpreferences"],
    cooldown: 3.5,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
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
        if (guildCommand === "help") {
            return message.channel.send(guildUsageMessage);
        }
        else {
            if (!inGuild) {
                let botServers = await bot.guilds.cache.map(guild => guild.id);
                console.log({ botServers });
                const mutualServers = await fn.userAndBotMutualServerIDs(bot, authorID, botServers);
                const serverSelectInstructions = "Type the **number** corresponding to the **server** you want **settings** for:\n";
                const postToServerTitle = "Guild Settings: Select Server";
                const serverList = await fn.listOfServerNames(bot, mutualServers);
                const targetServerIndex = await fn.userSelectFromList(bot, message, serverList, mutualServers.length,
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
        let guildConfig = await GuildConfig.findOne({ guildID });
        console.log({ guildConfig })
        const guildHelpMessage = `Try \*${PREFIX}${commandUsed} help\* for more options (and how to edit)`;
        const showGuildSettings = fn.getMessageEmbed(guildDocumentToString(bot, guildConfig, inGuild),
            `${guildName}'s Settings`,
            guildEmbedColour)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setFooter(guildHelpMessage);

        //see, edit (when edit, show see first then usage),
        if (guildCommand === "edit" || guildCommand === "ed" || guildCommand === "e"
            || guildCommand === "change" || guildCommand === "ch" || guildCommand === "c") {
            if (authorID !== guild.owner.id) {
                message.channel.send(showGuildSettings);
                return message.reply("Sorry, you do not have permissions to change the **server settings.**");
            }
            var userFields = ["Prefix", "General Timezone", "Daylight Savings Time", "Mastermind Facilitator Roles", "Mastermind Reset Day", "Quote Roles",];
            let fieldsList = "";
            userFields.forEach((field, i) => {
                fieldsList = fieldsList + `\`${i + 1}\` - ${field}\n`;
            });
            var continueEdit;
            do {
                const fieldToEditInstructions = "**Which field do you want to edit?:**";
                const fieldToEditAdditionalMessage = guildDocumentToString(bot, guildConfig, inGuild);
                const fieldToEditTitle = `${showGuildSettings.title}: Edit Field`;
                let fieldToEditIndex = await fn.userSelectFromList(bot, message, fieldsList, userFields.length, fieldToEditInstructions,
                    fieldToEditTitle, guildEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                if (!fieldToEditIndex && fieldToEditIndex !== 0) return;
                const type = "Guild";
                const fieldToEdit = userFields[fieldToEditIndex];
                continueEdit = false;
                var userEdit, userSettingsPrompt = "";
                switch (fieldToEditIndex) {
                    case 0:
                        userSettingsPrompt = `Please enter the server's **new prefix** (currently **${guildConfig.prefix}**):`;
                        userEdit = await fn.getUserEditString(bot, message, fieldToEdit, userSettingsPrompt, type, forceSkip, guildEmbedColour);
                        break;
                    case 1:
                        userSettingsPrompt = `Please enter the server's **__general timezone__** as an **abbreviation** or **+/- UTC Offset**:`;
                        userEdit = await fn.getUserEditString(bot, message, fieldToEdit, userSettingsPrompt, type, forceSkip, guildEmbedColour);
                        break;
                    case 2:
                        userSettingsPrompt = `Does your timezone participate in **Daylight Savings Time (DST)?**\n**⌚ - Yes\n⛔ - No**`;
                        userEdit = await fn.getUserEditBoolean(bot, message, fieldToEdit, userSettingsPrompt,
                            ['⌚', '⛔'], type, forceSkip, guildEmbedColour);
                        break;
                    case 3:
                        userSettingsPrompt = `Please enter one or more **mastermind facilitator roles:**`
                            + `\n(**Current roles:** ${guildConfig.mastermind.roles.map((roleID) => `<@&${roleID}>`).join(', ')})`;
                        userEdit = await fn.getUserEditString(bot, message, fieldToEdit, userSettingsPrompt, type, forceSkip, guildEmbedColour);
                        break;
                    case 4:
                        userSettingsPrompt = `Enter the number corresponding to the __**day of the week**__ when you would like the server's **weekly mastermind reset to happen:**`;
                        userEdit = await fn.getUserEditNumber(bot, message, fieldToEdit, daysOfWeek.length, type, daysOfWeek, forceSkip, userEmbedColour, `${userSettingsPrompt}\n\n${daysOfWeekList}`);
                        if (userEdit !== false && !isNaN(userEdit)) userEdit--;
                        console.log({ userEdit });
                        break;
                    case 5:
                        userSettingsPrompt = `Please enter one or more **quote roles (to get recurring inspiration):**`
                            + `\n(**Current roles:** ${guildConfig.quote.roles.map((roleID) => `<@&${roleID}>`).join(', ')})`;
                        userEdit = await fn.getUserEditString(bot, message, fieldToEdit, userSettingsPrompt, type, forceSkip, guildEmbedColour);
                        break;
                }
                if (userEdit === false) return;
                else if (userEdit === undefined) userEdit = "back";
                else if (userEdit !== "back") {
                    const roleRegex = /\<\@\&(\d+)\>/g;
                    switch (fieldToEditIndex) {
                        case 0:
                            {
                                await changePrefix(bot, message, "", [userEdit],
                                    PREFIX, timezoneOffset, daylightSavings, true);
                                guildConfig = await GuildConfig.findOne({ guildID });
                            }
                            break;
                        case 1:
                            {
                                let updatedTimezone = fn.getTimezoneOffset(userEdit);
                                console.log({ updatedTimezone, continueEdit })
                                if (updatedTimezone || updatedTimezone === 0) {
                                    const daylightSetting = guildConfig.timezone.daylightSavings
                                    if (daylightSetting) {
                                        updatedTimezone += fn.isDaylightSavingTime(Date.now(), true) ?
                                            fn.getTimezoneDaylightOffset(userEdit) : 0;
                                    }
                                    guildConfig = await User.findOneAndUpdate({ guildID }, {
                                        $set: {
                                            timezone: {
                                                name: userEdit,
                                                offset: updatedTimezone,
                                                daylightSavings: daylightSetting,
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
                                        updatedTimezoneOffset += fn.isDaylightSavingTime(Date.now(), true) ?
                                            fn.getTimezoneDaylightOffset(originalTimezone) : 0;
                                    }
                                    guildConfig = await User.findOneAndUpdate({ guildID }, {
                                        $set: {
                                            timezone: {
                                                name: originalTimezone,
                                                offset: updatedTimezoneOffset,
                                                daylightSavings: userEdit,
                                            }
                                        }
                                    }, { new: true });
                                    console.log({ userSettings: guildConfig })
                                }
                                else continueEdit = true;
                            }
                            break;
                        case 3:
                            {
                                var roles = new Array()
                                userEdit.replace(roleRegex, (match, roleID, offset, string) => {
                                    roles.push(roleID);
                                });
                                console.log({ updatedRoles: roles });
                                guildConfig = await GuildConfig.findOneAndUpdate({ guildID },
                                    {
                                        $set: {
                                            mastermind: {
                                                roles,
                                                resetDay: guildConfig.mastermind.resetDay,
                                            }
                                        }
                                    }, { new: true });
                                console.log({ guildConfig });
                            }
                            break;
                        case 4:
                            {
                                guildConfig = await GuildConfig.findOneAndUpdate({ guildID },
                                    {
                                        $set: {
                                            mastermind: {
                                                roles: guildConfig.mastermind.roles,
                                                resetDay: userEdit,
                                            }
                                        }
                                    }, { new: true });
                                break;
                            }
                            break;
                        case 5:
                            {
                                var roles = new Array()
                                userEdit.replace(roleRegex, (match, roleID, offset, string) => {
                                    roles.push(roleID);
                                });
                                console.log({ updatedRoles: roles });
                                guildConfig = await GuildConfig.findOneAndUpdate({ guildID },
                                    {
                                        $set: {
                                            quote: { roles, },
                                        }
                                    }, { new: true });
                                console.log({ guildConfig });
                            }
                            break;
                    }
                }
                else continueEdit = true;
                if (!continueEdit) {
                    const continueEditMessage = `Do you want to continue **editing your settings?**\n\n${guildDocumentToString(bot, guildConfig, inGuild)}`;
                    continueEdit = await fn.getUserConfirmation(message, continueEditMessage, forceSkip, `Guild: Continue Editing?`, 300000);
                }
            }
            while (continueEdit === true)
            return;
        }
        else return message.channel.send(showGuildSettings);
    }
};