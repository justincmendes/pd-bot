// gu
// Global Variable Declarations and Initializations
// const Track = require("../djs-bot/database/schemas/track");
// const tr = require("./track");
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const User = require("../djs-bot/database/schemas/user");
const mongoose = require("mongoose");
const fn = require("./functions");
const rm = require("./reminder");
require("dotenv").config();

const DEFAULT_PREFIX = '?';
const HOUR_IN_MS = fn.HOUR_IN_MS;
const guildEmbedColour = fn.guildSettingsEmbedColour;

// Private Function Declarations

module.exports = {
    deleteGuild: async function (guildID, guildName, guildChannelObjectArray) {
        try {
            if (guildID) {
                await Guild.deleteOne({ guildID: guildID });
                const guildReminders = await Reminder.find({ guildID: guildID });
                guildReminders.forEach(async reminder => {
                    await rm.cancelReminderById(reminder._id);
                    await Reminder.findByIdAndDelete(reminder._id);
                });
                // await Reminder.deleteMany({ guildID: guildObject.id });
                console.log(`Removing Guild Settings and Reminders from`
                    + ` ${guildName ? `${guildName} (${guildID || ""})` : guildID || ""}...`);
            }

            // Unlink any users voice channel tracking data:
            console.log({ guildChannelObjectArray });
            if (guildChannelObjectArray) if (guildChannelObjectArray.length) {
                guildChannelObjectArray.forEach(async channel => {
                    console.log({ channel });
                    await fn.unlinkVoiceChannelTracking(channel);
                });
            }
            console.log(`Unlinking any users voice channel tracking data from this server.`);
            return true;
        }
        catch (err) {
            console.log(err);
            return false;
        }
    },

    updateGuilds: async function (bot) {
        try {
            const allGuilds = await fn.getAllBotServers(bot);
            const allGuildSettings = await Guild.find({});
            let guildSettingIDArray = allGuildSettings ? allGuildSettings.length ?
                allGuildSettings.map(guild => guild.guildID) : [] : [];
            if (allGuilds) if (allGuilds.length) {
                allGuilds.forEach(async (guild, i) => {
                    if (guild) {
                        if (!guildSettingIDArray.includes(guild)) {
                            const newGuildSettings = await this.setupNewGuild(
                                bot, guild, bot.guilds.cache.get(guild)
                            );
                            if (newGuildSettings) {
                                guildSettingIDArray[i] = newGuildSettings;
                            }
                        };
                    }
                });
            }
            if (guildSettingIDArray) if (guildSettingIDArray.length) {
                guildSettingIDArray.forEach(async guild => {
                    if (guild) {
                        if (!allGuilds.includes(guild)) {
                            // console.log(`Guild to Delete: ${guild}`);
                            await this.deleteGuild(guild, "", []);
                        }
                    }
                });
            }
            return true;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },

    setupNewGuild: async function (bot, guildID, guildName) {
        try {
            const guildObject = await Guild.findOne({ guildID: guildID });
            // Check if it already exists to avoid duplicates
            if (guildObject) {
                console.log(`${bot.user.username} is already in ${guildName}! Won't create new instance in Database.`);
                return guildObject;
            }
            else {
                const guildSettings = await this.createGuildSettings(guildID, "EST", true);
                if (guildSettings) {
                    console.log(`${bot.user.username} has joined the server ${guildName}! Saved to Database.`);
                    return guildSettings;
                }
                else {
                    console.log(`There was an error adding ${guildName} to the database.`);
                    return null;
                }
            }
        }
        catch (err) {
            return console.error(err);
        }
    },

    createGuildSettings: async function (guildID, timezone = "EST", daylightSaving = true) {
        try {
            const initialOffset = fn.getTimezoneOffset(timezone);
            const daylightOffset = fn.isDaylightSavingTime(Date.now() + initialOffset * HOUR_IN_MS,
                timezone, daylightSaving) ? fn.getTimezoneDaylightOffset(timezone) : 0;
            const guildConfig = new Guild({
                _id: mongoose.Types.ObjectId(),
                guildID,
                prefix: DEFAULT_PREFIX,
                timezone: {
                    name: timezone.toUpperCase(),
                    offset: initialOffset + daylightOffset,
                    daylightSaving,
                },
                mastermind: {
                    roles: [],
                    resetDay: 0,
                },
                quote: {
                    roles: [],
                    getQuote: false,
                },
            });
            const result = await guildConfig.save();
            console.log({ result });
            return result;
        }
        catch (err) {
            console.error(err);
            return false;
        }
    },
};