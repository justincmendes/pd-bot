const mongoose = require("mongoose");

const userSettingsSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    // Consider mapping the timezone to Integers to save space/data?
    timeZone: String,
    habitCron: Number,
    likesPesteringAccountability: Boolean,
});

module.exports = mongoose.model("User Setting", userSettingsSchema, "settings");
