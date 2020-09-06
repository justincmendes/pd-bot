const mongoose = require("mongoose");
// const Reminder = require("./reminder");

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
    // Past 7 Days since weekly cron
    pastWeek: Number,
    // Past 7 Days
    pastSeven: Number,
    // Past 30 Days
    pastThirty: Number,
    allTimeAvg: Number,
    monthAvg: Number,
    // Relative to January 1, 1970 00:00:00 UTC.
    dailyCronTime: Number,
    weeklyCronDay: Number,

    // For Habits that have a daily/general counter!
    countHabitSettings: {
        "isCountType": {
            type: Boolean,
            required: true,
        },
        // To automatically mark complete or incomplete on day!
        "autoMarkCountGoal": {
            type: Boolean,
            required: false,
        },
        "countValueDailyGoal": {
            type: Number,
            required: false,
        },
        "countValueTotalGoal": {
            type: Number,
            required: false,
        },
    },
    countHabitValue: {
        type: [Number],
        required: false,
    },

    habit: {
        "Title": String,
        "Description": String,
        // Ensure there is only one log per cron
        "log": [Number],
        // Allow for Checked: ✅; Missed: ❌; Skip: ➖ (still counts as a log)
        "checkInType": [String],
        "checkInMessage": [String],
    },
});

// habitSchema.pre('remove', (next) => {
//     Reminder.collection.deleteMany({ connectedDocument: this._id }, next);
//     console.log(`Habit: Removing Associated Reminders (${this._id})...`);
// });

module.exports = mongoose.model("Habit", habitSchema, "habits");
