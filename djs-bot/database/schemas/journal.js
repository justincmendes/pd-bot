const mongoose = require("mongoose");

const journalSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    usedTemplate: {
        type: Boolean,
        required: true,
        default: false,
    },
    entry: {
        text: {
            type: String,
            required: false,
        },
        gratitudes: {
            type: String,
            required: false,
        },
        improvements: {
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
        accomplishments: {
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
