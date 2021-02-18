const mongoose = require("mongoose");

const reminderSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: {
        type: String,
        required: true,
    },
    channel: {
        type: String,
        required: true,
    },
    startTime: {
        type: Number,
        required: true,
    },
    endTime: {
        type: Number,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    isDM: {
        type: Boolean,
        required: true,
        default: false,
    },
    sendAsEmbed: {
        type: Boolean,
        required: true,
        default: false,
    },
    embedColour: {
        type: String,
        required: false,
    },
    isRecurring: {
        type: Boolean,
        required: true,
        default: false,
    },
    interval: {
        type: String,
        required: false,
    },
    remainingOccurrences: {
        type: Number,
        required: false,
    },
    title: {
        type: String,
        required: true,
    },
    // Delete the reminder if a connectedDocument get deleted
    connectedDocument: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
    },
    guildID: {
        type: String,
        required: false,
    },
});

module.exports = mongoose.model("Reminder", reminderSchema, "reminders");
