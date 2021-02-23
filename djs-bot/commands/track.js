const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const Track = require("../database/schemas/track");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const tr = require("../../utilities/track");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const trackEmbedColour = fn.trackEmbedColour;
const MINIMUM_AUTO_REPORT_DELAY = fn.MINIMUM_AUTO_REPORT_DELAY;
const DEFAULT_AUTO_REPORT_DELAY = fn.DEFAULT_AUTO_REPORT_DELAY;
const MINIMUM_AUTO_REPORT_TRACK_PERIOD = fn.MINIMUM_AUTO_REPORT_TRACK_PERIOD;

// Private Function Declarations

module.exports = {
    name: "track",
    description: "Time spent in voice channels tracking!",
    aliases: ["tracking", "tr", "voice", "v", "vc", "voicechat",
        "voicechannel", "voicec", "voicech", "chat", "ch", "c"],
    cooldown: 2.5,
    args: false,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSaving, forceSkip) {
        const authorID = message.author.id;
        let userSettings = await User.findOne({ discordID: authorID });
        const authorUsername = message.author.username;
        const trackCommand = args[0] ? args[0].toLowerCase() : false;
        let trackUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed}\` - **(to see your time spend in tracked voice channels)**`
            + `\n\`${PREFIX}${commandUsed} <ACTION> <force?>\``
            + "\n\n\`<ACTION>\`: **edit/change; remind/r; auto/a**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`;
        trackUsageMessage = fn.getMessageEmbed(trackUsageMessage, "Voice Channel Tracking: Help", trackEmbedColour);
        const trackHelpMessage = `Try ${PREFIX}${commandUsed} help - for more options (and how to edit and get tracking report reminders)`;
        const username = message.channel.type === 'dm' ? authorUsername
            : bot.guilds.cache.get(message.guild.id).member(authorID).displayName;
        const showTrackedVoiceChannels = fn.getMessageEmbed(
            await fn.voiceChannelArrayToString(bot, authorID, userSettings.voiceChannels),
            `${username}'s Tracked Voice Channels`,
            trackEmbedColour)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setFooter(trackHelpMessage);

        if (trackCommand === "help") {
            return message.channel.send(trackUsageMessage);
        }


        //see, edit (when edit, show see first then usage),
        else if (trackCommand === "edit" || trackCommand === "ed" || trackCommand === "e"
            || trackCommand === "change" || trackCommand === "ch" || trackCommand === "c"
            || trackCommand === "setup" || trackCommand === "set" || trackCommand === "s"
            || trackCommand === "update" || trackCommand === "upd" || trackCommand === "u") {
            do {
                userSettings = await User.findOne({ discordID: authorID });
                let { tier } = userSettings;
                var userFields = ["Tracked Voice Channels"];
                if (userSettings.voiceChannels) if (userSettings.voiceChannels.length) {
                    userFields = userFields.concat(["Time Spent in Voice Channels",
                        "Auto Send Report", "Auto Send Delay", "Auto Reset"]);
                }

                var continueEdit;
                const fieldToEditInstructions = "**__Which field do you want to edit?__**";
                const fieldToEditAdditionalMessage = await fn.voiceChannelArrayToString(bot, authorID, userSettings.voiceChannels);
                const fieldToEditTitle = `${showTrackedVoiceChannels.title}: Edit Field`;
                var fieldToEdit, fieldToEditIndex;
                const selectedField = await fn.getUserSelectedObject(bot, message, PREFIX,
                    `${fieldToEditAdditionalMessage}\n\n\n${fieldToEditInstructions}`, fieldToEditTitle, userFields, "", false,
                    trackEmbedColour, 600000, 0);
                if (!selectedField) return;
                else {
                    fieldToEdit = selectedField.object;
                    fieldToEditIndex = selectedField.index;
                }

                const type = "Voice Channel Tracking";
                continueEdit = false;
                var userEdit, trackPrompt = "",
                    selectVoiceChannel, targetVcObject;
                switch (fieldToEditIndex) {
                    case 0:
                        // Check if the user wants to remove a voice channel or add one.
                        trackPrompt = `\nDo you want to **add** (📊) another voice channel to track or **remove** (🗑️) a voice channel you are currently tracking your time in?`
                            + `\n(**Cap at ${2 * tier}**)\n\n**__Current tracked voice channels:__**\n${await fn.voiceChannelArrayToString(
                                bot, authorID, userSettings.voiceChannels, true, true, false
                            )}`;
                        userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, trackPrompt,
                            ['📊', '🗑️'], type, true, trackEmbedColour);
                        break;
                    case 1:
                        selectVoiceChannel = await tr.userSelectVoiceChannelObject(bot, message, PREFIX,
                            userSettings.voiceChannels, `${type}: Select Voice Channel`, "to edit the time tracked");
                        if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
                        else {
                            targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
                            userEdit = await fn.getUserEditDuration(bot, message, PREFIX, timezoneOffset, daylightSaving,
                                "time tracked", fn.millisecondsToTimeString(targetVcObject.timeTracked),
                                `${type}: Change Time Tracked`, 0, trackEmbedColour);
                        }
                        break;
                    case 2:
                        selectVoiceChannel = await tr.userSelectVoiceChannelObject(bot, message, PREFIX,
                            userSettings.voiceChannels, `${type}: Auto Send Report`, "to edit the auto send report setting");
                        console.log({ selectVoiceChannel });
                        if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
                        else {
                            targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
                            trackPrompt = `\nDo you want to your voice channel tracking to **automatically DM you a report**`
                                + ` of your time spent in **${bot.channels.cache.get(targetVcObject.id) ?
                                    `${bot.channels.cache.get(targetVcObject.id).name}` : "the tracked voice channel"}**`
                                + ` whenever you stay in **${bot.channels.cache.get(targetVcObject.id) ?
                                    `${bot.channels.cache.get(targetVcObject.id).name}` : "the tracked voice channel"}**`
                                + ` for at least ${fn.millisecondsToTimeString(MINIMUM_AUTO_REPORT_TRACK_PERIOD)} long?`
                                + `\n\n**🔁 - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay**`
                                + ` for after you leave the voice channel - in case you come back within that time)`;
                            userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, trackPrompt,
                                ['🔁', '⛔'], type, true, trackEmbedColour);
                        }
                        break;
                    case 3:
                        selectVoiceChannel = await tr.userSelectVoiceChannelObject(bot, message, PREFIX,
                            userSettings.voiceChannels, `${type}: Auto Report Delay`,
                            "to edit the auto report delay");
                        if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
                        else {
                            targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
                            if (!targetVcObject.autoSendReport) {
                                message.reply(`Please enable **Auto Send Report** first to change the **Auto Report Delay**.`
                                    + `\n(Auto Report Delay: The time frame before automatically sending a report of your session in a voice channel)`);
                                userEdit = "back";
                                break;
                            }
                            userEdit = await fn.getUserEditDuration(bot, message, PREFIX, timezoneOffset, daylightSaving,
                                "auto report delay", fn.millisecondsToTimeString(targetVcObject.autoSendDelay || 0),
                                `${type}: Change Auto Report Delay`, MINIMUM_AUTO_REPORT_DELAY,
                                trackEmbedColour, `\n**__Recommended:__** \`15 sec\` \`30s\` \`1 min\` \`5m\` (**Default:** \`15 seconds\`)`);
                        }
                        break;
                    case 4:
                        selectVoiceChannel = await tr.userSelectVoiceChannelObject(bot, message, PREFIX,
                            userSettings.voiceChannels, `${type}: Auto Reset`,
                            "to edit the auto reset");
                        if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
                        else {
                            targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
                            if (!targetVcObject.autoSendReport) {
                                message.reply(`Please enable **Auto Send Report** first to change the **Auto Reset**.`
                                    + `\n(Auto Reset: Reset the tracked time to 0:00 after each session in a voice channel)`);
                                userEdit = "back";
                                break;
                            }
                            trackPrompt = `\nDo you want to your voice channel tracking to **automatically reset**`
                                + ` your time spent in ${bot.channels.cache.get(targetVcObject.id) ?
                                    `**${bot.channels.cache.get(targetVcObject.id).name}**` : "the tracked voice channel"}`
                                + ` to 0:00 whenever you stay in **${bot.channels.cache.get(targetVcObject.id) ?
                                    `${bot.channels.cache.get(targetVcObject.id).name}` : "the tracked voice channel"}**`
                                + ` for at least ${fn.millisecondsToTimeString(MINIMUM_AUTO_REPORT_TRACK_PERIOD)} long?`
                                + `\n\n**0️⃣ - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay**`
                                + ` for after you leave the voice channel - in case you come back within that time)`;
                            userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, trackPrompt,
                                ['0️⃣', '⛔'], type, true, trackEmbedColour);
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
                                    case '📊': userEdit = true;
                                        break;
                                    case '🗑️': userEdit = false;
                                        break;
                                    default: userEdit = null;
                                        break;
                                }
                                if (typeof userEdit === "boolean") {
                                    // Add voice channel
                                    if (userEdit) {
                                        if (userSettings.voiceChannels) if (userSettings.voiceChannels.length >= 2 * tier) {
                                            message.reply("**You cannot track another voice channel because you don't have any more spots!**"
                                                + `\n(**__Tier:__ ${tier}** = ${2 * tier} voice channels allowed in total)`);
                                            continueEdit = true;
                                            break;
                                        }
                                        // If in server, list out all voice channel names and user select from them,
                                        // Or list all across all mutual servers
                                        const targetVoiceChannel = await fn.getTargetChannel(bot, message, PREFIX,
                                            `Add Voice Channel to Track Time Spent`, forceSkip, false, true, false, trackEmbedColour,
                                            userSettings.voiceChannels.map(vc => vc.id));
                                        console.log({ targetVoiceChannel });
                                        if (!targetVoiceChannel && targetVoiceChannel !== 0) return;

                                        // Check if the user wants the auto send report feature:
                                        const autoSendReportPrompt = `\nDo you want to your voice channel tracking to **automatically DM you a report**`
                                            + ` of your time spent in **${bot.channels.cache.get(targetVoiceChannel) ?
                                                `${bot.channels.cache.get(targetVoiceChannel).name}` : "the tracked voice channel"}**`
                                            + ` whenever you stay in **${bot.channels.cache.get(targetVoiceChannel) ?
                                                `${bot.channels.cache.get(targetVoiceChannel).name}` : "the tracked voice channel"}**`
                                            + ` for at least ${fn.millisecondsToTimeString(MINIMUM_AUTO_REPORT_TRACK_PERIOD)} long?`
                                            + `\n\n**🔁 - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay**`
                                            + ` for after you leave the voice channel - in case you come back within that time)`;
                                        var reportDelay;
                                        let autoSendReport = await fn.getUserEditBoolean(bot, message, PREFIX,
                                            "Auto Send Report", autoSendReportPrompt, ['🔁', '⛔'], type, true, trackEmbedColour);
                                        if (!autoSendReport) return;
                                        else if (autoSendReport === "back") {
                                            continueEdit = true;
                                            break;
                                        }
                                        else {
                                            switch (autoSendReport) {
                                                case '🔁': autoSendReport = true;
                                                    break;
                                                case '⛔': autoSendReport = false;
                                                    break;
                                                default: autoSendReport = null;
                                                    break;
                                            }
                                            if (typeof autoSendReport === "boolean") {
                                                if (autoSendReport) {
                                                    // Set the auto reset
                                                    trackPrompt = `\nDo you want to your voice channel tracking to **automatically reset**`
                                                        + ` your time spent in ${bot.channels.cache.get(targetVoiceChannel) ?
                                                            `**${bot.channels.cache.get(targetVoiceChannel).name}**` : "the tracked voice channel"}`
                                                        + ` to 0:00 whenever you stay in **${bot.channels.cache.get(targetVoiceChannel) ?
                                                            `${bot.channels.cache.get(targetVoiceChannel).name}` : "the tracked voice channel"}**`
                                                        + ` for at least ${fn.millisecondsToTimeString(MINIMUM_AUTO_REPORT_TRACK_PERIOD)} long?`
                                                        + `\n\n**0️⃣ - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay**`
                                                        + ` for after you leave the voice channel - in case you come back within that time)`;
                                                    let autoReset = await fn.getUserEditBoolean(bot, message, PREFIX, "Auto Reset", trackPrompt,
                                                        ['0️⃣', '⛔'], type, true, trackEmbedColour);
                                                    if (!autoReset && autoReset !== 0) return;
                                                    else if (autoReset === "back") {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                    else {
                                                        switch (autoReset) {
                                                            case '0️⃣': autoReset = true;
                                                                break;
                                                            case '⛔': autoReset = false;
                                                                break;
                                                            default: autoReset = null;
                                                                break;
                                                        }
                                                        if (!typeof userEdit === "boolean") autoReset = false;
                                                    }
                                                    // Set the report delay
                                                    reportDelay = await fn.getUserEditDuration(bot, message, PREFIX, timezoneOffset, daylightSaving,
                                                        "auto report delay", fn.millisecondsToTimeString(DEFAULT_AUTO_REPORT_DELAY),
                                                        `${type}: Change Auto Report Delay`, MINIMUM_AUTO_REPORT_DELAY,
                                                        trackEmbedColour, `\n**__Recommended:__** \`15 sec\` \`30s\` \`1 min\` \`5m\` (**Default:** \`15 seconds\`)`);
                                                    if (!reportDelay && reportDelay !== 0) return;
                                                    else if (reportDelay === "back") {
                                                        continueEdit = true;
                                                        break;
                                                    }
                                                }
                                            }
                                            else {
                                                continueEdit = true;
                                                break;
                                            }

                                            userSettings = await User.findByIdAndUpdate(userSettings._id, {
                                                $push: {
                                                    voiceChannels: {
                                                        id: targetVoiceChannel,
                                                        timeTracked: 0,
                                                        lastTrackedTimestamp: Date.now() + HOUR_IN_MS * timezoneOffset,
                                                        autoSendReport,
                                                        autoSendDelay: reportDelay,
                                                        autoReset,
                                                    },
                                                },
                                            }, { new: true });
                                            await fn.setupVoiceChannelTracking(
                                                bot, authorID, targetVoiceChannel
                                            );
                                        }
                                    }

                                    // Remove voice channel
                                    else {
                                        if (userSettings.voiceChannels) if (userSettings.voiceChannels.length === 0) {
                                            message.reply("**You cannot remove a voice channel because you are not tracking any right now!**");
                                            continueEdit = true;
                                            break;
                                        }
                                        let vcList = "";
                                        userSettings.voiceChannels.forEach((vc, i) => {
                                            vcList += `\`${i + 1}\` - **${fn.getVoiceChannelNameString(bot, vc)}**`
                                                + ` (${fn.getVoiceChannelServerString(bot, vc)})`;
                                            if (i !== userSettings.voiceChannels.length) {
                                                vcList += '\n';
                                            }
                                        });
                                        const vcTargetIndex = await fn.userSelectFromList(bot, message, PREFIX,
                                            vcList, userSettings.voiceChannels.length,
                                            "**Type the number corresponding to the voice channel you would like to stop tracking:**\n",
                                            `${type}: Removal`, trackEmbedColour, 180000);
                                        if (!vcTargetIndex && vcTargetIndex !== 0) return;
                                        else {
                                            const vcTarget = userSettings.voiceChannels[vcTargetIndex];
                                            console.log({ vcTarget });
                                            if (vcTarget) if (vcTarget.id) {
                                                const confirmDelete = await fn.getUserConfirmation(bot, message, PREFIX,
                                                    `**Are you sure you want to stop tracking this voice channel?**`
                                                    + `\n${await fn.voiceChannelArrayToString(bot, authorID, [vcTarget], false)}`,
                                                    forceSkip, `${type}: Confirm Removal`, 180000);
                                                if (confirmDelete === null) return;
                                                else if (!confirmDelete) continueEdit = true;
                                                else {
                                                    userSettings = await User.findByIdAndUpdate(userSettings._id, {
                                                        $pull: {
                                                            voiceChannels: {
                                                                id: vcTarget.id,
                                                            },
                                                        },
                                                    }, { new: true });
                                                    if (fn.voiceTrackingHasUser(userSettings.discordID)) {
                                                        fn.voiceTrackingClearInterval(userSettings.discordID);
                                                        fn.voiceTrackingDeleteCollection(userSettings.discordID);
                                                        await Track.deleteMany({ userID: userSettings.discordID });
                                                    }

                                                }
                                                break;
                                            }
                                        }
                                    }
                                }
                                continueEdit = true;
                            }
                            break;
                        case 1:
                            if (targetVcObject) if (typeof targetVcObject === 'object') {
                                await Track.updateMany({ userID: authorID }, {
                                    $set: {
                                        start: fn.getCurrentUTCTimestampFlooredToSecond(),
                                        end: fn.getCurrentUTCTimestampFlooredToSecond(),
                                    },
                                });
                                targetVcObject.timeTracked = userEdit;
                                userSettings = await User.findByIdAndUpdate(userSettings._id, {
                                    $set: { voiceChannels: userSettings.voiceChannels }
                                }, { new: true });
                            }
                            continueEdit = true;
                            break;
                        case 2:
                            switch (userEdit) {
                                case '🔁': userEdit = true;
                                    break;
                                case '⛔': userEdit = false;
                                    break;
                                default: userEdit = null;
                                    break;
                            }
                            if (typeof userEdit === "boolean") {
                                if (targetVcObject) if (typeof targetVcObject === 'object') {
                                    targetVcObject.autoSendReport = userEdit;
                                    if (userEdit) {
                                        // Set the auto reset
                                        trackPrompt = `\nDo you want to your voice channel tracking to **automatically reset**`
                                            + ` your time spent in ${bot.channels.cache.get(targetVcObject.id) ?
                                                `**${bot.channels.cache.get(targetVcObject.id).name}**` : "the tracked voice channel"}`
                                            + ` to 0:00 whenever you stay in **${bot.channels.cache.get(targetVcObject.id) ?
                                                `${bot.channels.cache.get(targetVcObject.id).name}` : "the tracked voice channel"}**`
                                            + ` for at least ${fn.millisecondsToTimeString(MINIMUM_AUTO_REPORT_TRACK_PERIOD)} long?`
                                            + `\n\n**0️⃣ - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay**`
                                            + ` for after you leave the voice channel - in case you come back within that time)`;
                                        let autoReset = await fn.getUserEditBoolean(bot, message, PREFIX, "Auto Reset", trackPrompt,
                                            ['0️⃣', '⛔'], type, true, trackEmbedColour);
                                        if (!autoReset && autoReset !== 0) return;
                                        else if (autoReset === "back") {
                                            continueEdit = true;
                                            break;
                                        }
                                        else {
                                            switch (autoReset) {
                                                case '0️⃣': autoReset = true;
                                                    break;
                                                case '⛔': autoReset = false;
                                                    break;
                                                default: autoReset = null;
                                                    break;
                                            }
                                            if (typeof userEdit === "boolean") {
                                                targetVcObject.autoReset = autoReset;
                                            }
                                            else targetVcObject.autoReset = false;
                                        }

                                        // Set the report delay
                                        const reportDelay = await fn.getUserEditDuration(bot, message, PREFIX, timezoneOffset, daylightSaving,
                                            "auto report delay", fn.millisecondsToTimeString(targetVcObject.autoSendDelay || 0),
                                            `${type}: Change Auto Report Delay`, MINIMUM_AUTO_REPORT_DELAY,
                                            trackEmbedColour, `\n**__Recommended:__** \`15 sec\` \`30s\` \`1 min\` \`5m\` (**Default:** \`15 seconds\`)`);
                                        if (!reportDelay && reportDelay !== 0) return;
                                        else if (reportDelay === "back") {
                                            continueEdit = true;
                                            break;
                                        }
                                        else targetVcObject.autoSendDelay = reportDelay;
                                    }
                                    if (targetVcObject.autoReset) {
                                        await fn.sendAutoSendReportToDM(
                                            bot, authorID, userSettings, targetVcObject.id,
                                            targetVcObject.timeTracked
                                        );
                                        targetVcObject.timeTracked = 0;
                                    }
                                    userSettings = await User.findByIdAndUpdate(userSettings._id, {
                                        $set: { voiceChannels: userSettings.voiceChannels }
                                    }, { new: true });
                                    break;
                                }
                            }
                            continueEdit = true;
                            break;
                        case 3:
                            if (targetVcObject) if (typeof targetVcObject === 'object') {
                                targetVcObject.autoSendDelay = userEdit;
                                userSettings = await User.findByIdAndUpdate(userSettings._id, {
                                    $set: { voiceChannels: userSettings.voiceChannels }
                                }, { new: true });
                                break;
                            }
                            continueEdit = true;
                            break;
                        case 4:
                            switch (userEdit) {
                                case '0️⃣': userEdit = true;
                                    break;
                                case '⛔': userEdit = false;
                                    break;
                                default: userEdit = null;
                                    break;
                            }
                            if (typeof userEdit === "boolean") {
                                if (targetVcObject) if (typeof targetVcObject === 'object') {
                                    targetVcObject.autoReset = userEdit;
                                    userSettings = await User.findByIdAndUpdate(userSettings._id, {
                                        $set: { voiceChannels: userSettings.voiceChannels }
                                    }, { new: true });
                                    break;
                                }
                            }
                            continueEdit = true;
                            break;
                    }
                }
                else continueEdit = true;

                if (!continueEdit) {
                    await rm.updateTrackingReportReminder(bot, authorID);
                    const continueEditMessage = `Do you want to continue **editing your settings?**`
                        + `\n\n${await fn.voiceChannelArrayToString(bot, authorID, userSettings.voiceChannels)}`;
                    continueEdit = await fn.getUserConfirmation(bot, message, PREFIX, continueEditMessage, forceSkip, `Voice Channel Tracking: Continue Editing?`, 300000);
                }
            }
            while (continueEdit === true)
            return;
        }

        // Free function if they want to freeze all of their current channel progress
        // IF they have a voice channel with auto send report enabled, just toggle it
        // freeze
        // unfreeze
        // OR just have a simple command that toggles the auto send report to the opposite of what it currently is!
        // auto
        // Find channel they want to toggle it for, then toggle it on or off :)

        else if (trackCommand === "reminder" || trackCommand === "reminders" || trackCommand === "remind"
            || trackCommand === "remindme" || trackCommand === "rem" || trackCommand === "re" || trackCommand === "r"
            || trackCommand === "report" || trackCommand === "rep" || trackCommand === "log") {
            const success = await tr.setUserTrackingReportReminder(bot, message, PREFIX, timezoneOffset, daylightSaving);
            if (success) {
                message.reply("You have successfully set your **Voice Channel Tracking Report Reminder!**"
                    + `\nType** \`${PREFIX}repeat edit recent\` **if you want to change the timing of this reminder.`)
            }
            return;
        }


        else {
            await rm.updateTrackingReportReminder(bot, authorID);
            return message.channel.send(showTrackedVoiceChannels);
        }
    }
};