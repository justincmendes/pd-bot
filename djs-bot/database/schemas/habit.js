const mongoose = require("mongoose");
// const Reminder = require("./reminder");

// **Finalize the interaction between the log and countHabits

// Last time tracked/checked will be the most recent of: log
// Can map log to checkInMessage and show user all of the past logs!
// Can map log to Total Tracked to show the users the days they hit the goal!

/**
 * Useful Metrics to Calculate:
 * totalTracked
 * totalMissed
 * totalSkip
 * totalDays
 * **Gives week, month and year averages:
 * pastWeek (since weekly cron time)
 * pastMonth
 * pastYear
 * pastXDays (most common 7 and 30)
 * allTimeAvg (checked + skipped / total)
 */
const habitSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: {
        type: String,
        required: true,
    },
    isArchived: {
        type: Boolean,
        required: true,
        default: false,
    },
    // The log timestamps should ALWAYS be
    name: {
        type: String,
        required: true,
    },
    type: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    reason: {
        type: String,
        required: true,
    },
    // For Habits that have a daily/general counter!
    settings: {
        isCountType: {
            type: Boolean,
            required: true,
        },
        // To automatically mark complete or incomplete on day!
        // For streaks - auto-mark completions
        autoMarkCountGoal: {
            type: Boolean,
            required: false,
        },
        // Count Goals: To be used in tandem with auto-mark
        // Or just have stored for the user to have the target set
        dailyGoal: {
            type: Number,
            required: false,
        },
        // If it's a cumulative goal instead of a daily number
        totalGoal: {
            type: Number,
            required: false,
        },
        connectedType: {
            type: Number,
            required: false,
        },
    },
    
});

// habitSchema.pre('remove', (next) => {
//     Reminder.collection.deleteMany({ connectedDocument: this._id }, next);
//     console.log(`Habit: Removing Associated Reminders (${this._id})...`);
// });

// These metrics can be calculated by looking at the habit object
// totalTracked: Number,
// totalMissed: Number,
// totalSkip: Number,
// totalDays: Number,


// Can calculate as counting the number of logs found from 
// the last Habit Cron expected timestamp (saves space)

// Past 7 Days since weekly cron
// pastWeek: Number,

// Past 7 Days
// pastSeven: Number,

// Past 30 Days
// pastThirty: Number,

// How many were tracked
// allTimeAvg: Number,

// monthAvg: Number,

// **FOUND IN USER SETTINGS**
// Relative to January 1, 1970 00:00:00 UTC.
// dailyCronTime: Number,
// weeklyCronDay: Number,

module.exports = mongoose.model("Habit", habitSchema, "habits");
