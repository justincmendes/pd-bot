// tr
// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const User = require("../djs-bot/database/schemas/user");
const Track = require("../djs-bot/database/schemas/track");
const mongoose = require("mongoose");
const fn = require("./functions");
const rm = require("./reminder");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const trackEmbedColour = fn.trackEmbedColour;

// Private Function Declarations

module.exports = {
    cancelAndDeleteAllTrackReminders: async function (userID) {
        const currentTrackReminders = await Reminder.find({ userID, title: "Voice Channel Tracking" });
        if (currentTrackReminders) if (currentTrackReminders.length) {
            currentTrackReminders.forEach(async reminder => {
                rm.cancelReminderById(reminder._id);
                await Reminder.deleteOne({ _id: reminder._id });
            });
        }
    },

    setUserTrackingReportReminder: async function (bot, message, PREFIX, timezoneOffset, daylightSaving) {
        let endTime = await fn.getDateAndTimeEntry(bot, message, PREFIX, timezoneOffset, daylightSaving,
            "**When** do you want your **first voice channel time tracking report?**"
            + "\n(Recommended: \`sat at 12pm\` or \`sun at 8a\` or \`next sat at 12pm\`)",
            "Voice Channel Tracking: Tracking Report Time of Day", true, trackEmbedColour);
        if (!endTime && endTime !== 0) return false;
        else endTime -= HOUR_IN_MS * timezoneOffset;
        let interval = await rm.getInterval(bot, message, PREFIX, timezoneOffset, daylightSaving,
            "**How often** do you want the **voice channel time tracking report?**",
            "Voice Channel Tracking: Tracking Report Interval", trackEmbedColour, HOUR_IN_MS,
            300000, 60000, fn.intervalExamplesOver1Hour);
        if (!interval) return false;
        else interval = interval.args;
        // Cancel any on-going Track Reminders:
        await this.cancelAndDeleteAllTrackReminders(message.author.id);

        const userSettings = await User.findOne({ discordID: message.author.id });
        if (userSettings) {
            const { voiceChannels } = userSettings;
            if (voiceChannels) if (voiceChannels.length) {
                for (var i = 0; i < voiceChannels.length; i++) {
                    if (typeof voiceChannels[i].lastReminderTimeTracked === 'number') {
                        voiceChannels[i].lastReminderTimeTracked = voiceChannels[i].timeTracked;
                    }
                    else voiceChannels[i].lastReminderTimeTracked = 0;
                }
                await User.updateOne({ discordID: message.author.id },
                    { $set: { voiceChannels }, });
            }
        }

        await rm.setNewDMReminder(bot, message.author.id, Date.now(), endTime,
            `${await fn.getTrackingReportString(bot, message.author.id, true)}`,
            "Voice Channel Tracking", true, false, true, interval, undefined);
        return true;
    },

    userSelectVoiceChannelObject: async function (bot, message, PREFIX, voiceChannelArray,
        title, purposeOfSelection = "",
    ) {
        let vcList = "";
        voiceChannelArray.forEach((vc, i) => {
            vcList += `\`${i + 1}\` - **${fn.getVoiceChannelNameString(bot, vc)}**`
                + ` (${fn.getVoiceChannelServerString(bot, vc)})`;
            if (i !== voiceChannelArray.length) {
                vcList += '\n';
            }
        });
        const selectVoiceChannel = await fn.userSelectFromList(bot, message, PREFIX,
            vcList, voiceChannelArray.length,
            `**Type the number corresponding to the voice channel you would like`
            + `${purposeOfSelection ? ` ${purposeOfSelection} for` : ""}:**\n`,
            title, trackEmbedColour, 180000);
        if (!selectVoiceChannel && selectVoiceChannel !== 0) return false;
        else return selectVoiceChannel;
    },

    unlinkVoiceChannelTracking: async function (channelObject) {
        // If a user tracked voice channel gets deleted,
        // make the channel name as the id and store the guildName
        console.log({ channelObject });
        if (channelObject) if (channelObject.type === "voice") {
            const allUsersSettings = await User.find({});
            if (allUsersSettings) if (allUsersSettings.length) {
                console.log(`Unlinking any users' voice channel time tracking from`
                    + ` ${channelObject.name} (${channelObject.id})`);
                allUsersSettings.forEach(async userSettings => {
                    const { voiceChannels } = userSettings;
                    if (voiceChannels) if (voiceChannels.length) {
                        voiceChannels.forEach(async (vc, i) => {
                            if (vc.id === channelObject.id) {
                                console.log(`Unlinking ${userSettings.discordTag} from`
                                    + ` ${channelObject.name} (${channelObject.guild.name})`
                                    + ` - channel id: ${channelObject.id}`);
                                voiceChannels[i].channelName = channelObject.name;
                                voiceChannels[i].guildName = channelObject.guild.name;
                                await User.updateOne({ _id: userSettings._id }, {
                                    $set: {
                                        voiceChannels,
                                    },
                                });
                                if (fn.voiceTrackingUserHasChannel(userSettings.discordID, vc.id)) {
                                    fn.voiceTrackingUserClearChannelInterval(userSettings.discordID, vc.id);
                                    fn.voiceTrackingUserDeleteChannel(userSettings.discordID, vc.id);
                                    await Track.deleteOne({
                                        userID: userSettings.discordID,
                                        channelID: vc.id,
                                    });
                                }
                            }
                        });
                    }
                });
            }
        }
    },

};