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
    userID: String,
    goals: {
        goalCategory: [Number],
        goalEntry: [String]
    },
    categories: {
        categoryNumber: [Number],
        categoryName: [String],

        // Set the default to those shown above!**
    }
});

module.exports = mongoose.model("Long-Term Goal", goalSchema, "goals");
