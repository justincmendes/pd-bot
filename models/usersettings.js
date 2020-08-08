const mongoose = require("mongoose");

const userSettings = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    // Consider mapping the timezone to Integers to save space/data?
    timeZone: String,
    habitCron: Number,
    likesBeingPushed: Boolean
});

module.exports = mongoose.model("Setting", userSettings, "settings");
