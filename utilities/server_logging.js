// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const Habit = require("../djs-bot/database/schemas/habit");
const Log = require("../djs-bot/database/schemas/habittracker");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const User = require("../djs-bot/database/schemas/user");
const mongoose = require("mongoose");
const fn = require("./functions");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;

// Private Function Declarations

module.exports = {};
