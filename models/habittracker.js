const mongoose = require("mongoose");

const habitSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    totalTracked: Number,
    totalDays: Number,
    pastWeek: Number
});

module.exports = mongoose.model("Habit", habitSchema, "habits");
