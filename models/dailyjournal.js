const mongoose = require("mongoose");

const dailyJournalSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    usedTemplate: Boolean,
    journalEntry: String
});

module.exports = mongoose.model("Daily Journal", dailyJournalSchema, "dailyJournals");
