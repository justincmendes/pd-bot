const mongoose = require("mongoose");

const trackSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: {
        type: String,
        required: true,
    },
    voiceChannelID: {
        type: String,
        required: true,
    },
    start: {
        type: Number,
        required: true,
    },
    end: {
        type: Number,
        required: true,
    },
    finishedSession: {
        type: Boolean,
        required: false,
    },
    originalTimeTracked: {
        type: Number,
        required: false,
    },
});

module.exports = mongoose.model("Track", trackSchema, "tracking");
