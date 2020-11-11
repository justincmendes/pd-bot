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
        required: true,
        default: '?',
    },
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
    // The role that allows others to write the mastermind reflection for each other!
    mastermind: {
        roles: {
            type: [String],
            required: true,
            default: [],
        },
        resetDay: {
            type: Number,
            required: true,
            default: 0,
        },
    },

    quote: {
        roles: {
            type: [String],
            required: true,
            default: [],
        },
        channel: {
            type: String,
            required: false,
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
    },

});

module.exports = mongoose.model("GuildSetting", guildSettingsSchema, "guildsettings");
