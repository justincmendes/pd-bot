const mongoose = require("mongoose");

const mastermindSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    userID: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Number,
        required: true,
    },
    createdBy: {
        type: String,
        required: true,
    },
    usedTemplate: {
        type: Boolean,
        required: true,
    },
    guildID: {
        type: String,
        required: false,
    },
    journal: {
        // If entry is undefined, show the string adjusted mastermind entry!
        // This implies that a template was used
        entry: {
            type: String,
            required: false,
        },
        observations: {
            type: String,
            required: false,
        },
        areaOfLife: {
            type: {
                type: Number,
                required: false,
            },
            reason: {
                type: String,
                required: false,
            },
        },
        stopEntry: {
            type: String,
            required: false,
        },
        startEntry: {
            type: String,
            required: false,
        },
        continueEntry: {
            type: String,
            required: false,
        },
        goals: [{
            type: {
                type: Number,
                required: false,
            },
            description: {
                type: String,
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
        }],
    },
});

module.exports = mongoose.model("Mastermind", mastermindSchema, "masterminds");
