const Discord = require("discord.js");
const DailyJournal = require("../models/dailyjournal.js");
const WeeklyJournal = require("../models/weeklyjournal.js");
const UserSettings = require("../models/usersettings");
const mongoose = require("mongoose");
const fn = require("../utils/functions");
require("dotenv").config();
const prefix = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
    // Will allow for text collection of notes during meeting and output it in a nice format!
    // Allow users with the "mastermind" (captain) role to press the pencil and edit the sent message!
    // User's with mastermind role can EDIT ANYONE'S ENTRIES! **be careful**
    // Others can only edit their own
    // Collect 1 message per user and put it beside their tag!

    // Long-Term Goal Creation (store in DB and allow user to edit it in the channel!)

    // Scriber Mode: Admin team OR a specific role only can add to the messages (when event is called)

    // All Mode: anyone who types can change add to and change their reflection! If they type 1, finalize
    // their contributions. (flag a boolean) But if they type more give them a confirmation warning that
    // they will overwrite their previous progress!
    // edit: allow them to edit their current contribution! running in the channel rn
    // Add contributions to the embed so far so everyone can see.
    // Once it is closed - finalize document and no longer listen to messages
    // React with a pencil so that users can edit the message if they wish in a dm
    // Once the pencil is reacted to, dm the user. Remove reaction
    // Give their current entry markdown in `code`
    // When finished in DM, update the embed in the weekly reflection channel!

    // Solo: They can only edit the things they contribute

    // Faciliator: Anyone can edit the whole embed or certain parts of the embed
    // Can edit/add/start other user's reflections!
    // This is possible through

    // Day collect - allow the bot to listen to messages in a certain channel for a day

    // Type 1 to go to the next prompt as you're filling it out!
    // Type 0 to leave section blank!
    // It will go to weekly goal 1, weekly goal 2 and so on

    //NOTE: when one user is working on their edit, they are only allow to change their part
    // Manage this via a double array and @mention userid
    // Other people's part will not be affected by one user editing theirs!

    // Make array for each user that types (new one if they author id hasn't been seen)
    // Make array of this array holding each user's entries (object oriented) identifiable by the user id
    // NO bots
    // WHILE The user is filling out their prompt DELETE the text they wrote as they go along but update the embed message they see!
    // var currentMessage
    //Add it to each part of the template as one goes along

    // Will allow users to add their own to the mastermind week's message and handle multiple people
    // Adding their own edits at the same time.

    var journalView = "";
    var confirmMastermindTemplate;
    var namesToAdd = new Array();
    
    if (args[0] != undefined) {
        if (args[0].toLowerCase() == "template") {
            const date = new Date();
            if (isNaN(args[1])) {
                message.reply("**INVALID INPUT**... Enter a **positive number > 1!**");
                return;
            }
            else if (parseInt(args[1]) <= 0) {
                message.reply("**INVALID INPUT**... Enter a **positive number > 1!**");
                return;
            }

            numberOfUsers = parseInt(args[1]);
            confirmMastermindTemplate = await fn.confirmationMessage(message, `Are you sure you want to **generate a mastermind template for ${numberOfUsers} users?**`,
                `Mastermind: Confirm ${numberOfUsers} User Template`, 30000);
            if (!confirmMastermindTemplate) return;

            if (args[2] != undefined) {
                namesToAdd = args[2].split(",");
            }
            for (i = 0; i < numberOfUsers; i++) {
                if (namesToAdd[i] == undefined) namesToAdd.push("NAME_");
                if (numberOfUsers == 1) {
                    journalView = "`**__" + date.toString() + "__**\n\n" + fn.mastermindWeeklyJournalTemplate((i + 1), namesToAdd[i]) + "`";
                    break;
                }
                if (i == 0) {
                    journalView = "`**__" + date.toString() + "__**\n\n" + fn.mastermindWeeklyJournalTemplate((i + 1), namesToAdd[i]) + "\n\n\n";
                }
                else if (i == numberOfUsers - 1) {
                    journalView = journalView + fn.mastermindWeeklyJournalTemplate((i + 1), namesToAdd[i]) + "`";
                    journalView = new Discord.MessageEmbed()
                        .setColor("#ADD8E6")
                        .setDescription(journalView);
                    message.channel.send(journalView);
                    break;
                }
                else if (i % 5 == 0) {
                    journalView = journalView + fn.mastermindWeeklyJournalTemplate((i + 1), namesToAdd[i]) + "`";
                    journalView = new Discord.MessageEmbed()
                        .setColor("#ADD8E6")
                        .setDescription(journalView);
                    message.channel.send(journalView);
                    journalView = "`";
                }
                else {
                    journalView = journalView + fn.mastermindWeeklyJournalTemplate((i + 1), namesToAdd[i]) + "\n\n\n";
                }

            }
            return;
        }

        message.reply("Mastermind in development!");
    }
}

module.exports.help = {
    name: "mastermind",
    aliases: ["mm", "master"]
}