const mongoose = require("mongoose");
// const Reminder = require("./reminder");

// Last time tracked/checked will be the most recent of: log
// Can map log to checkInMessage and show user all of the past logs!
// Can map log to Total Tracked to show the users the days they hit the goal!

/**
 * Useful Metrics to Calculate: These metrics can be calculated by looking at the habit object
 * totalTracked
 * totalMissed
 * totalSkip
 * totalDays
 * allTimeAvg (checked + skipped / total) - how many were tracked
 *
 * **Gives week, month and year averages:
 * pastWeek (since weekly cron time)
 * pastMonth
 * pastYear
 * pastXDays (most common 7 and 30)* - to be calculated
 */

// Can calculate as counting the number of logs found from
// the last Habit Cron expected timestamp (saves space)
// However, this reduces the speed of the habit command (cached data vs. reading and computation)

const habitSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userID: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Number,
    required: true,
  },
  archived: {
    type: Boolean,
    required: true,
    default: false,
  },
  description: {
    type: String,
    required: true,
  },
  specifics: {
    type: String,
    required: false,
  },
  areaOfLife: {
    type: Number,
    required: false,
  },
  reason: {
    type: String,
    required: false,
  },
  connectedGoal: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  nextCron: {
    type: Number,
    required: true,
  },
  // For Habits that have a daily/general counter!
  settings: {
    isCountType: {
      type: Boolean,
      required: true,
      default: false,
    },
    countMetric: {
      type: String,
      required: false,
    },
    isWeeklyType: {
      type: Boolean,
      required: true,
      default: false,
    },
    cronPeriods: {
      type: Number,
      required: true,
      default: 1,
    },
    // To automatically mark complete or incomplete on day!
    // For streaks - auto-mark completions
    // 0. None
    // 1. Auto-mark streak (each cron)
    // 2. Auto-mark based on count goal
    autoLogType: {
      type: Number,
      required: false,
    },
    // Count Goals: To be used in tandem with auto-mark
    // Or just have stored for the user to have the target set
    // 0. None
    // 1. Daily
    // 2. Weekly
    // If it's a cumulative goal instead of a daily number
    // 3. Total
    countGoalType: {
      type: Number,
      required: false,
    },
    countGoal: {
      type: Number,
      required: false,
    },
    integration: {
      name: {
        type: String,
        required: false,
      },
      type: {
        type: Number,
        required: false,
      },
      amount: {
        type: Number,
        required: false,
      },
      required: false,
    },
  },
  currentStreak: {
    type: Number,
    required: true,
    default: 0,
  },
  currentState: {
    type: Number,
    required: true,
    default: 0,
  },
  longestStreak: {
    type: Number,
    required: true,
    default: 0,
  },
  pastWeek: {
    type: Number,
    required: true,
    default: 0,
  },
  pastMonth: {
    type: Number,
    required: true,
    default: 0,
  },
  pastYear: {
    type: Number,
    required: true,
    default: 0,
  },
  connectedAccountability: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  }
});

// habitSchema.pre('remove', (next) => {
//     Reminder.collection.deleteMany({ connectedDocument: this._id }, next);
//     console.log(`Habit: Removing Associated Reminders (${this._id})...`);
// });

module.exports = mongoose.model("Habit", habitSchema, "habits");
