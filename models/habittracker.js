const mongoose = require("mongoose");

    // Last time tracked/checked will be the most recent of: log
    // Can map log to checkInMessage and show user all of the past logs!
    // Can map log to Total Tracked to show the users the days they hit the goal!

const habitSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    isArchived: Boolean,
    totalTracked: Number,
    totalMissed: Number,
    totalSkip: Number,
    totalDays: Number,
    pastWeek: Number,
    allTimeAvg: Number,
    monthAvg : Number,
    cron : Number,

    // For Habits that have a daily counter!
    trackValue: {
        type: Number,
        required: false
    },
    // To automatically mark complete or incomplete on day!
    trackValueGoal: {
        type: Number,
        required: false
    },
    // Ensure there is only one log per cron
    log: [Number],
    
    // Allow for Checked: ✅; Missed: ❌; Skip: ➖ (still counts as a log)
    checkInMessage: [String]
});

module.exports = mongoose.model("Habit", habitSchema, "habits");
