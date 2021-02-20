const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const Track = require("../database/schemas/track");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const trackEmbedColour = fn.trackEmbedColour;

// Private Function Declarations
async function cancelAndDeleteAllTrackReminders(userID) {
    const currentTrackReminders = await Reminder.find({ userID, title: "Voice Channel Tracking" });
    if (currentTrackReminders) if (currentTrackReminders.length) {
        currentTrackReminders.forEach(async reminder => {
            await rm.cancelReminderById(reminder._id);
            await Reminder.deleteOne({ _id: reminder._id });
        });
    }
}

async function updateTrackingReportReminder(bot, userID) {
    const currentTrackReminders = await Reminder.find({ userID, title: "Voice Channel Tracking" });
    if (currentTrackReminders) if (currentTrackReminders.length) {
        currentTrackReminders.forEach(async reminder => {
            const newReminder = await Reminder.findByIdAndUpdate(reminder._id,
                {
                    $set: { message: await fn.getTrackingReportString(bot, userID) }
                }, { new: true });
            if (newReminder) {
                await rm.cancelReminderById(reminder._id);
                await rm.sendReminderByObject(bot, newReminder);
            }
        });
        return true;
    }
    return false;
}

async function setUserTrackingReportReminder(bot, message, PREFIX, timezoneOffset, daylightSaving) {
    let endTime = await fn.getDateAndTimeEntry(bot, message, PREFIX, timezoneOffset, daylightSaving,
        "**When** do you want your **first voice channel time tracking report?**"
        + "\n(Recommended: \`sat at 12pm\` or \`sun at 8a\`)",
        "Voice Channel Tracking: Tracking Report Time of Day", true, trackEmbedColour);
    if (!endTime && endTime !== 0) return false;
    else endTime -= HOUR_IN_MS * timezoneOffset;
    let interval = await rm.getInterval(bot, message, PREFIX, timezoneOffset, daylightSaving,
        "**How often** do you want the **voice channel time tracking report?**",
        "Voice Channel Tracking: Tracking Report Interval", trackEmbedColour, 300000);
    if (!interval) return false;
    else interval = interval.args;
    // Cancel any on-going Track Reminders:
    await cancelAndDeleteAllTrackReminders(message.author.id);

    await rm.setNewDMReminder(bot, message.author.id, Date.now(), endTime,
        `${await fn.getTrackingReportString(bot, message.author.id)}`, "Voice Channel Tracking",
        true, false, true, interval, undefined);
    return true;
}

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
            + "\n\n\`<ACTION>\`: **edit/change; remind/r**"
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
                    userFields = userFields.concat(["Time Spent in Voice Channels"]);
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
                var userEdit, trackPrompt = "";
                switch (fieldToEditIndex) {
                    case 0:
                        // Check if the user wants to remove a voice channel or add one.
                        trackPrompt = `\nDo you want to **add** (📊) another voice channel to track or **remove** (🗑️) a voice channel you are currently tracking your time in?`
                            + `\n(**Cap at ${2 * tier}**)\n\n**__Current tracked voice channels:__**\n${userSettings.voiceChannels.map(vcObject => {
                                return `${fn.getVoiceChannelNameString(bot, vcObject)}`
                                    + ` (${fn.getVoiceChannelServerString(bot, vcObject)})`;
                            }).join('\n')}`;
                        userEdit = await fn.getUserEditBoolean(bot, message, PREFIX, fieldToEdit, trackPrompt,
                            ['📊', '🗑️'], type, forceSkip, trackEmbedColour);
                        break;
                    case 1:
                        let vcList = "";
                        userSettings.voiceChannels.forEach((vc, i) => {
                            vcList += `\`${i + 1}\` - ${fn.getVoiceChannelNameString(bot, vc)}`
                            + ` (${fn.getVoiceChannelServerString(bot, vc)})`;
                            if (i !== userSettings.voiceChannels.length) {
                                vcList += '\n';
                            }
                        });
                        const selectVoiceChannel = await fn.userSelectFromList(bot, message, PREFIX,
                            vcList, userSettings.voiceChannels.length,
                            "**Type the number corresponding to the voice channel you would like to edit the time tracked for:**\n",
                            `${type}: Select Voice Channel`, trackEmbedColour, 180000);
                        if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
                        else {
                            const targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
                            trackPrompt = `\nWhat do you want to change the **time tracked** to?`
                                + `\n\n**__Current time tracked:__** ${fn.millisecondsToTimeString(targetVcObject.timeTracked)}`
                                + `\n\nType \`back\` to go **back to the main edit menu**`
                                + `\n\n${fn.durationExamples}`;
                            do {
                                const userTimeInput = await fn.messageDataCollect(bot, message, PREFIX, trackPrompt,
                                    `${type}: Change Time Tracked`, trackEmbedColour, 180000, false);
                                if (userTimeInput === "back") break;
                                if (userTimeInput === "stop" || !userTimeInput) return;
                                const timeArgs = userTimeInput.toLowerCase().split(/[\s\n]+/);
                                let now = Date.now();
                                endTime = fn.timeCommandHandlerToUTC(timeArgs[0] !== "in" ? (["in"]).concat(timeArgs) : timeArgs, now,
                                    timezoneOffset, daylightSaving, true, true, false, true);
                                if (endTime || endTime === 0) {
                                    now = fn.getCurrentUTCTimestampFlooredToSecond();
                                    endTime -= HOUR_IN_MS * timezoneOffset;
                                    userEdit = endTime - now;
                                    break;
                                }
                                else fn.sendReplyThenDelete(message, `**Please enter a proper time duration __> 0d:0h:0m:0s__!**...\nTry \`${PREFIX}date\` for **valid time inputs!**`, 30000);
                            }
                            while (true)
                            if (userEdit || userEdit === 0) {
                                if (!isNaN(userEdit)) if (userEdit >= 0) {
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
                            }
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
                                                + `\n(Tier: ${tier} - ${2 * tier} voice channels allowed in total)`);
                                            continueEdit = true;
                                            break;
                                        }
                                        // If in server, list out all voice channel names and user select from them,
                                        // Or list all across all mutual servers
                                        const targetVoiceChannel = await fn.getTargetChannel(bot, message, PREFIX,
                                            `Add Voice Channel to Track Time Spent`, forceSkip, false, true, false, trackEmbedColour,
                                            userSettings.voiceChannels.map(vc => vc.id));
                                        if (!targetVoiceChannel) return;
                                        console.log({ targetVoiceChannel });
                                        userSettings = await User.findByIdAndUpdate(userSettings._id, {
                                            $push: {
                                                voiceChannels: {
                                                    id: targetVoiceChannel,
                                                    timeTracked: 0,
                                                    lastTrackedTimestamp: Date.now() + HOUR_IN_MS * timezoneOffset,
                                                },
                                            },
                                        }, { new: true });
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
                                            vcList += `\`${i + 1}\` - ${fn.getVoiceChannelNameString(bot, vc)}`;
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
                                            userSettings = await User.findByIdAndUpdate(userSettings._id, {
                                                $pull: {
                                                    voiceChannels: {
                                                        id: vcTarget.id,
                                                    },
                                                },
                                            }, { new: true });
                                        }
                                    }
                                }
                                else continueEdit = true;
                            }
                            break;
                    }
                }
                else continueEdit = true;

                if (!continueEdit) {
                    await updateTrackingReportReminder(bot, authorID);
                    const continueEditMessage = `Do you want to continue **editing your settings?**`
                        + `\n\n${await fn.voiceChannelArrayToString(bot, authorID, userSettings.voiceChannels)}`;
                    continueEdit = await fn.getUserConfirmation(bot, message, PREFIX, continueEditMessage, forceSkip, `Voice Channel Tracking: Continue Editing?`, 300000);
                }
            }
            while (continueEdit === true)
            return;
        }

        else if (trackCommand === "reminder" || trackCommand === "reminders" || trackCommand === "remind"
            || trackCommand === "remindme" || trackCommand === "rem" || trackCommand === "re" || trackCommand === "r"
            || trackCommand === "report" || trackCommand === "rep" || trackCommand === "log") {
            const success = await setUserTrackingReportReminder(bot, message, PREFIX, timezoneOffset, daylightSaving);
            if (success) {
                message.reply("You have successfully set your **Voice Channel Tracking Report Reminder!**"
                    + `\nType** \`${PREFIX}repeat edit recent\` **if you want to change the timing of this reminder.`)
            }
            return;
        }


        else return message.channel.send(showTrackedVoiceChannels);
    }
};