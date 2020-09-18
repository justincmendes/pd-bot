const mongoose = require("mongoose");

const userSettingsSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    discordID: {
        type: String,
        require: true,
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
        daylightSavings: {
            type: Boolean,
            required: true,
            default: true,
        },
    },
    // The timestamp in ms after 00:00 / 12AM for when to reset the Daily Habits!
    habitCron: Number,
    likesPesteringAccountability: {
        type: Boolean,
        required: true,
        default: false,
    },
});

module.exports = mongoose.model("User", userSettingsSchema, "users");
