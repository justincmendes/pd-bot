const mongoose = require("mongoose");

// STORE MASTERMIND SETTINGS AS WELL! (i.e. what is the mastermind role?)

const guildSettingsSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    guildID: {
        type: mongoose.SchemaTypes.String,
        required: true,
        unique: true,
    },
    prefix: {
        type: mongoose.SchemaTypes.String,
        required: false,
        default: "?",
    },
    defaultRole: {
        type: mongoose.SchemaTypes.String,
        required: false,
    },
    memberLogChannel: {
        type: mongoose.SchemaTypes.String,
        required: false,
    }
});

module.exports = mongoose.model("GuildSetting", guildSettingsSchema, "guildsettings");
