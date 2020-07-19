const mongoose = require("mongoose");

const fastSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: String,
    startTime: Number,
    endTime: Number,
    fastBreaker: String,
    fastDuration: Number,
    mood: Number,
    reflection: String
});

module.exports = mongoose.model("Fast", fastSchema, "fasts");
