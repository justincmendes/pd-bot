const mongoose = require("mongoose");

const mastermindSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    createdBy: String,
    createdAt: Number,
    usedTemplate: Boolean,
    journalEntry: [String]
});

module.exports = mongoose.model("Mastermind", mastermindSchema, "dailyJournals");
