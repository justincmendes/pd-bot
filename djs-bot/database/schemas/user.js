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
        required: true,
    },
    // Consider mapping the timezone to Integers to save space/data?
    timeZone: String,
    habitCron: Number,
    likesPesteringAccountability: {
        type: Boolean,
        default: false,
    },
});

module.exports = mongoose.model("User", userSettingsSchema, "user");
