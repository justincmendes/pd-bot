const mongoose = require("mongoose");

const habitLogSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    // Ensure there is only one log per cron
    timestamp: {
        type: Number,
        required: true,
    },
    // Allow for Checked: 1 - ✅; Missed: 0 - 🔲; Skip: 2 - ➖ (still counts as a log);
    // Store as a number for making a cheaper habit object
    type: {
        type: Number,
        required: true,
    },
    message: {
        type: String,
        required: false,
    },
    count: {
        type: Number,
        required: false,
    },
    connectedDocument: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    }
});

module.exports = mongoose.model("Log", habitLogSchema, "logs");
