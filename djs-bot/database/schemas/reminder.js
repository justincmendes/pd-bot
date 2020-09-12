const mongoose = require("mongoose");

const reminderSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    channel: String,
    startTime: Number,
    endTime: Number,
    message: String,
    isDM: {
        type: Boolean,
        required: true,
        default: false,
    },
    isRecurring: {
        type: Boolean,
        required: true,
        default: false,
    },
    interval: {
        type: Number,
        required: false,
    },
    type: String,
    // Delete the reminder if a connectedDocument get deleted
    connectedDocument: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
    },
    guildID: {
        type: String,
        required: false,
    },
    lastEdited: {
        type: Number,
        required: false,
    }
});

module.exports = mongoose.model("Reminder", reminderSchema, "reminders");
