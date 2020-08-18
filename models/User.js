const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
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
        required: true,
    },
    guilds: {
        type: Array,
        required: true,
    }
});

module.exports = mongoose.model("User", userSchema, "users");
