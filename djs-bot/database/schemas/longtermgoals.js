const mongoose = require("mongoose");

// Store each goal in an array and map it a number representing a specific category:
/**
 * 🙏 __Spiritual Development__
 * 🥦 __Health__
 * 💼 __Career__
 * 💸 __Finances__
 * ♥ __Relationships__
 * 🧘‍♂️ __Personal Development__
 * */


const goalSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: {
        type: String,
        required: true,
    },
    completed: {
        type: Boolean,
        required: true,
        default: false,
    },
    archived: {
        type: Boolean,
        required: true,
        default: false,
    },
    goal: {
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
            required: false,
        },
        steps: {
            type: String,
            required: false,
        },
    },
});

module.exports = mongoose.model("Goal", goalSchema, "goals");
