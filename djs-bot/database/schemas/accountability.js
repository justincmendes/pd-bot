const mongoose = require("mongoose");

const accountabilitySchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  users: [
    {
      userID: {
        type: String,
        required: true,
      },
      showReflection: {
        type: Boolean,
        required: true,
        default: false,
      },
    },
  ],
  // Reference to the accountability event creator's habit._id
  connectedHabit: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  connectedReminder: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  autoLogAtLatestUserCron: {
    type: Boolean,
    required: true,
    default: true,
  },
});

module.exports = mongoose.model(
  "Accountability",
  accountabilitySchema,
  "accountability events"
);
