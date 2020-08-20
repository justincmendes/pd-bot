// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const DailyJournal = require("../database/schemas/dailyjournal");
const WeeklyJournal = require("../database/schemas/weeklyjournal");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
require("dotenv").config();
const journalEmbedColour = "#EE82EE";

// Function Declarations and Definitions
function getJournalTemplate(args, withMarkdown = true, journalEmbedColour = "#EE82EE") {
    var journalView;
    if (args[1] !== undefined) {
        let journalType = args[1].toLowerCase();
        if (journalType == "weekly" || journalType == "week" || journalType == "w" || journalType == "1") {
            if (args[2] !== undefined) {
                let weeklyType = args[2].toLowerCase();
                if (weeklyType == "goals" || weeklyType == "goal" || weeklyType == "g" || weeklyType == "1") {
                    journalView = fn.getMessageEmbed(fn.getWeeklyJournalGoalTemplate(false, withMarkdown), `Weekly Journal: Weekly Goals`, journalEmbedColour);
                }
                else if (weeklyType == "reflection" || weeklyType == "r" || weeklyType == "re" || weeklyType == "ref" || weeklyType == "refl"
                    || weeklyType == "reflect" || weeklyType == "2") {
                    journalView = fn.getMessageEmbed(fn.getWeeklyJournalReflectionTemplate(false, withMarkdown), `Weekly Journal: Weekly Reflection`, journalEmbedColour);
                }
                else {
                    return false;
                }
            }
            else {
                journalView = fn.getMessageEmbed(fn.getWeeklyJournalFullTemplate(true, withMarkdown), `Weekly Journal Template`, journalEmbedColour);
            }
        }
        else if (journalType == "daily" || journalType == "day" || journalType == "regular" || journalType == "reg" || journalType == "d"
            || journalType == "r" || journalType == "2") {
            if (args[2] !== undefined) {
                let dailyType = args[2].toLowerCase();
                if (dailyType == "morning" || dailyType == "am" || dailyType == "a" || dailyType == "morn" || dailyType == "start"
                    || dailyType == "first" || dailyType == "beginning" || dailyType == "beg" || dailyType == "a" || dailyType == "1" || dailyType == "m") {
                    journalView = fn.getMessageEmbed(fn.getDailyJournalMorningTemplate(true, withMarkdown), `Daily Journal: Morning`, journalEmbedColour);
                }
                else if (dailyType == "night" || dailyType == "evening" || dailyType == "pm" || dailyType == "p" || dailyType == "eve" || dailyType == "end"
                    || dailyType == "last" || dailyType == "final" || dailyType == "2" || dailyType == "n" || dailyType == "e") {
                    journalView = fn.getMessageEmbed(fn.getDailyJournalNightTemplate(true, withMarkdown), `Daily Journal: Night`, journalEmbedColour);
                }
                else {
                    return false;
                }
            }
            else {
                journalView = fn.getMessageEmbed(fn.getDailyJournalFullTemplate(true, withMarkdown), `Daily Journal Template`, journalEmbedColour);
            }
        }
        else {
            return false;
        }
    }
    else {
        return false;
    }
    return journalView;
}

module.exports = {
    name: "journal",
    description: "Daily and Weekly Journaling",
    aliases: ["j", "jour", "journ"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX) {
        //At the end of every week, or when they submit their weekly journal reflection, send them a textfile of their weeks entries (press the paperclip)
        //create, see, edit, end, templates <= return both the weekly reflection/weekly goals and daily journal template!

        // Variable Declarations and Initializations
        let journalUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<ACTION>\`: **template/templates/temp/t; help**"
            + `\n\n*__ALIASES:__* **${this.name}; ${this.aliases.join('; ')}**`
            + "\n\n**FUTURE FEATURES: create; see; edit; end**";
        journalUsageMessage = fn.getMessageEmbed(journalUsageMessage, "Journal: Help", journalEmbedColour);
        const journalHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        const forceSkip = fn.getForceSkip(args);
        let journalCommand = args[0].toLowerCase();
        // Journal Commands
        if (journalCommand == "help") {
            message.channel.send(journalUsageMessage);
            return;
        }


        // SHOWS WEEKLY JOURNAL TEMPLATES!
        else if (journalCommand == "template" || journalCommand == "templates" || journalCommand == "temp" || journalCommand == "t") {
            let templateUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${journalCommand} <DAILY/WEEKLY> <JOURNAL_TYPE>\``
                + "\n\n`<DAILY/WEEKLY>`: **daily/day/d; weekly/week/w**"
                + "\n\n`<JOURNAL_TYPE>`:\nIf `daily`: **morning/m; night/n**\nIf `weekly`: **reflection/r; goals/g**";
            templateUsageMessage = fn.getMessageEmbed(templateUsageMessage, "Journal: Template Help", journalEmbedColour);
            const templateHelpMessage = `Try \`${PREFIX}${commandUsed} ${journalCommand} help\``;
            var journalType;
            if (args[1] !== undefined) {
                journalType = args[1].toLowerCase();
            }
            let journalTemplate = getJournalTemplate(args, true, journalEmbedColour);
            if (journalType == "help") {
                message.channel.send(templateUsageMessage);
                return;
            }
            else if (journalTemplate === false) {
                message.reply(templateHelpMessage);
                return;
            }
            else {
                message.channel.send(journalTemplate);
                return;
            }
        }
    }
};