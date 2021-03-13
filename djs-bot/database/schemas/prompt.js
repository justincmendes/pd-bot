const mongoose = require("mongoose");

const promptSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userID: String,
  prompt: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model("Prompt", promptSchema, "prompts");
