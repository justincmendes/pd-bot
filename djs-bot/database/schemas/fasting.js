const mongoose = require("mongoose");

const fastSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    startTime: Number,
    endTime: Number,
    fastDuration: Number,
    fastBreaker: String,
    mood: Number,
    reflection: String
});

module.exports = mongoose.model("Fast", fastSchema, "fasts");
