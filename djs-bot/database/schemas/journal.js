const mongoose = require("mongoose");

const journalSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    createdAt: Number,
    template: {
        type: Number,
        required: true,
        default: 0,
    },
    entry: {
        message: {
            type: String,
            required: false,
        },
        prompt: {
            type: String,
            required: false,
        },
        gratitudes: {
            type: String,
            required: false,
        },
        actions: {
            type: String,
            required: false,
        },
        affirmations: {
            type: String,
            required: false,
        },
        amazing: {
            type: String,
            required: false,
        },
        betterDay: {
            type: String,
            required: false,
        },
    }
});

module.exports = mongoose.model("Journal", journalSchema, "journals");
