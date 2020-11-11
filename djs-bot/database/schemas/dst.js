const mongoose = require("mongoose");

const dstSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    timezone: {
        type: String,
        required: true,
    },
    isDST: {
        type: Boolean,
        required: true,
        default: false,
    },
});

module.exports = mongoose.model("DST", dstSchema, "dst");
