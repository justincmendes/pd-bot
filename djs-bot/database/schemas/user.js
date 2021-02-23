const mongoose = require("mongoose");

const userSettingsSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    discordID: {
        type: String,
        required: true,
        unique: true,
    },
    discordTag: {
        type: String,
        required: true,
    },
    avatar: {
        type: String,
        required: false,
    },
    guilds: {
        type: Array,
        required: false,
    },
    tier: {
        type: Number,
        required: true,
        default: 1,
    },
    // Consider mapping the timezone to Integers to save space/data?
    timezone: {
        name: {
            type: String,
            required: true,
            default: "EST",
        },
        offset: {
            type: Number,
            required: true,
            default: -5,
        },
        daylightSaving: {
            type: Boolean,
            required: true,
            default: true,
        },
    },
    habitCron: {
        // The timestamp in ms after 00:00 / 12AM for when to reset the Daily Habits!
        daily: {
            type: Number,
            required: true,
            default: 0,
        },
        // Given as the day of the week
        weekly: {
            type: Number,
            required: true,
            default: 0,
        },
    },
    mastermindCron: {
        type: Number,
        required: true,
        default: 0,
    },
    getQuote: {
        type: Boolean,
        required: true,
        default: false,
    },
    quoteInterval: {
        type: String,
        required: false,
    },
    nextQuote: {
        type: Number,
        required: false,
    },
    likesPesteringAccountability: {
        type: Boolean,
        required: true,
        default: false,
    },
    deleteRepliesDuringCommand: {
        type: Boolean,
        required: true,
        default: false,
    },
    voiceChannels: [{
        id: {
            type: String,
            required: true,
        },
        timeTracked: {
            type: Number,
            required: true,
        },
        lastTrackedTimestamp: {
            type: Number,
            required: true,
        },
        guildName: {
            type: String,
            required: false,
        },
        channelName: {
            type: String,
            required: false,
        },
        autoReset: {
            type: Boolean,
            required: true,
            default: false,
        },
        autoSendDelay: {
            type: Number,
            required: false,
        },
        autoSendReport: {
            type: Boolean,
            required: true,
            default: false,
        },
    }],
});

module.exports = mongoose.model("User", userSettingsSchema, "users");
