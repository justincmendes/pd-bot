const Discord = require("discord.js");
const DailyJournal = require("../models/dailyjournal.js");
const WeeklyJournal = require("../models/weeklyjournal.js");
const mongoose = require("mongoose");
const config = require("../botsettings.json");
const fn = require("../utils/functions");

module.exports.run = async (bot, message, args) => {
    //At the end of every week, or when they submit their weekly journal reflection, send them a textfile of their weeks entries (press the paperclip)
    //create, see, edit, end, templates <= return both the weekly reflection/weekly goals and daily journal template!
    var journalView;

    // SHOWS WEEKLY JOURNAL TEMPLATES!
    // Will handle daily and weekly template handling soon!
    
    if (args[0] != undefined) {
        if (args[0].toLowerCase() == "templates") {
            journalView = new Discord.MessageEmbed()
                .setColor("#ADD8E6")
                .setTitle(`Journal: Weekly Templates`)
                .setDescription(fn.weeklyJournalTemplate());
            message.channel.send(journalView);
            return;
        }
    }
    message.reply("Journal in development!");

}

module.exports.help = {
    name: "journal",
    aliases: ["j", "jour", "journ"]
}