const Discord = require("discord.js");
const DailyJournal = require("../models/dailyjournal.js");
const WeeklyJournal = require("../models/weeklyjournal.js");
const UserSettings = require("../models/usersettings");
const mongoose = require("mongoose");
const fn = require("../utils/functions");
require("dotenv").config();
const PREFIX = process.env.PREFIX;

module.exports.run = async (bot, message, args) => {
    // FUTURE FEATURE: Cap mastermind at 6 maximum, any more => Create .txt file with FULL entry and react with paperclip for user to download the file

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


    // Function Declarations and Initializations

    // Use WeeklyJournalEntry function to create empty entries and format in backticks for Discord markdown

    function sendGeneratedTemplate (numberOfUsers, namesForTemplate) {
        const date = new Date();
        for (templateIndex = 0; templateIndex < numberOfUsers; templateIndex++) {
            if (namesForTemplate[templateIndex] == undefined) namesForTemplate.push(`NAME_${templateIndex + 1}`);
            if (numberOfUsers == 1) {
                templateOutput = "`**__" + date.toString() + "__**\n\n" + fn.mastermindWeeklyJournalEntry(namesForTemplate[templateIndex]) + "`";
                fn.sendDescriptionOnlyEmbed(message, templateOutput);
                break;
            }
            if (templateIndex == 0) {
                templateOutput = "`**__" + date.toString() + "__**\n\n" + fn.mastermindWeeklyJournalEntry(namesForTemplate[templateIndex]) + "\n\n";
            }
            else if (templateIndex == numberOfUsers - 1) {
                templateOutput = templateOutput + fn.mastermindWeeklyJournalEntry(namesForTemplate[templateIndex]) + "`";
                fn.sendDescriptionOnlyEmbed(message, templateOutput);
                break;
            }
            else if (templateIndex % 5 == 0) {
                templateOutput = templateOutput + fn.mastermindWeeklyJournalEntry(namesForTemplate[templateIndex]) + "`";
                fn.sendDescriptionOnlyEmbed(message, templateOutput);
                templateOutput = "`";
            }
            else {
                templateOutput = templateOutput + fn.mastermindWeeklyJournalEntry(namesForTemplate[templateIndex]) + "\n\n";
            }
        }
    }


    // Variable Declarations and Initializations
    const invalidTemplateNumber = "**INVALID INPUT**... Enter a **positive number > 1!**";
    let mastermindCommand = args[0];
    if (mastermindCommand != undefined) {
        mastermindCommand = mastermindCommand.toLowerCase();
        if (mastermindCommand == "template" || mastermindCommand == "templates") {
            let numberOfUsers = args[1];
            if (isNaN(numberOfUsers)) {
                fn.sendErrorMessage(message, invalidTemplateNumber);
                return;
            }
            else {
                numberOfUsers = parseInt(numberOfUsers);
                if (numberOfUsers <= 0) {
                    fn.sendErrorMessage(message, invalidTemplateNumber);
                    return;
                }
            }
            // "Template" Variable Declarations
            const confirmTemplateGenerationMessage = `Are you sure you want to **generate a mastermind template for ${numberOfUsers} user(s)?**`;
            const confirmTemplateGenerationTitle = `Mastermind: Confirm ${numberOfUsers} User Template`;
            var namesForTemplate = new Array();
            var templateOutput = "";
            console.log({ numberOfUsers });
            let userConfirmation = await fn.getUserConfirmation(message, confirmTemplateGenerationMessage, confirmTemplateGenerationTitle, 30000);
            if (userConfirmation == false) {
                return;
            }
            if (args[2] != undefined) {
                // Filter out the empty inputs due to multiple commas (e.g. ",,,, ,,, ,   ,")
                namesForTemplate = args.slice(2).join("").split(',').filter(name => name != "");
                console.log({ namesForTemplate });
            }
            // Use WeeklyJournalEntry function to create empty entries and format in backticks for Discord markdown
            sendGeneratedTemplate(numberOfUsers, namesForTemplate);
            return;
        }

        message.reply("Mastermind in development!");
    }
}

module.exports.help = {
    name: "mastermind",
    aliases: ["mm", "master"]
}