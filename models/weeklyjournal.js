const mongoose = require("mongoose");

const weeklyJournalSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    usedTemplate: Boolean,
    journalEntry: [String]
});

module.exports = mongoose.model("Weekly Journal", weeklyJournalSchema, "weeklyJournals");
