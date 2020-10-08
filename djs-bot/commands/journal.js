// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Journal = require("../database/schemas/journal");
const Prompt = require("../database/schemas/prompt");
const User = require("../database/schemas/user");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
require("dotenv").config();

const journalEmbedColour = fn.journalEmbedColour;
const HOUR_IN_MS = fn.getTimeScaleToMultiplyInMs("hour");

// Function Declarations and Definitions
function getJournalTemplate(args, withMarkdown = true, journalEmbedColour = fn.journalEmbedColour) {
    var journalView;
    if (args[1] !== undefined) {
        let journalType = args[1].toLowerCase();
        if (journalType === "weekly" || journalType === "week" || journalType === "w" || journalType === "1") {
            if (args[2] !== undefined) {
                let weeklyType = args[2].toLowerCase();
                if (weeklyType == "goals" || weeklyType == "goal" || weeklyType == "g" || weeklyType == "1") {
                    journalView = fn.getMessageEmbed(fn.getWeeklyJournalGoalTemplate(false, withMarkdown), `Weekly Journal: Weekly Goals`, journalEmbedColour);
                }
                else if (weeklyType === "reflection" || weeklyType === "r" || weeklyType === "re" || weeklyType === "ref" || weeklyType === "refl"
                    || weeklyType === "reflect" || weeklyType === "2") {
                    journalView = fn.getMessageEmbed(fn.getWeeklyJournalReflectionTemplate(false, withMarkdown), `Weekly Journal: Weekly Reflection`, journalEmbedColour);
                }
                else return false;
            }
            else journalView = fn.getMessageEmbed(fn.getWeeklyJournalFullTemplate(true, withMarkdown), `Weekly Journal Template`, journalEmbedColour);
        }
        else if (journalType === "daily" || journalType === "day" || journalType === "regular" || journalType === "reg" || journalType === "d"
            || journalType === "r" || journalType === "2") {
            if (args[2] !== undefined) {
                let dailyType = args[2].toLowerCase();
                if (dailyType === "morning" || dailyType === "am" || dailyType === "a" || dailyType === "morn" || dailyType === "start"
                    || dailyType === "first" || dailyType === "beginning" || dailyType === "beg" || dailyType === "a" || dailyType === "1" || dailyType === "m") {
                    journalView = fn.getMessageEmbed(fn.getDailyJournalMorningTemplate(true, withMarkdown), `Daily Journal: Morning`, journalEmbedColour);
                }
                else if (dailyType === "night" || dailyType === "evening" || dailyType === "pm" || dailyType === "p" || dailyType === "eve" || dailyType === "end"
                    || dailyType === "last" || dailyType === "final" || dailyType === "2" || dailyType === "n" || dailyType === "e") {
                    journalView = fn.getMessageEmbed(fn.getDailyJournalNightTemplate(true, withMarkdown), `Daily Journal: Night`, journalEmbedColour);
                }
                else return false;
            }
            else journalView = fn.getMessageEmbed(fn.getDailyJournalFullTemplate(true, withMarkdown), `Daily Journal Template`, journalEmbedColour);
        }
        else return false;
    }
    else return false;
    return journalView;
}

module.exports = {
    name: "journal",
    description: "Daily Journaling (with Weekly journal template)",
    aliases: ["j", "jour", "journ", "scribe", "scribing", "write", "w"],
    cooldown: 5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSavings, forceSkip) {
        // At the end of every week/Weekly habit cron time, or when they submit their weekly journal reflection, send them a textfile of their weeks entries (press the paperclip)
        // create, see, edit, end, templates <= return both the weekly reflection/weekly goals and daily journal template!

        // Variable Declarations and Initializations
        let journalUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<ACTION>\`: **start/s; end/e; see; edit; delete/d; post; template/t**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`
        journalUsageMessage = fn.getMessageEmbed(journalUsageMessage, "Journal: Help", journalEmbedColour);
        const journalHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        const journalCommand = args[0].toLowerCase();
        const authorID = message.author.id;
        const authorUsername = message.author.username;
        // Journal Commands
        if (journalCommand === "help") return message.channel.send(journalUsageMessage);


        else if (journalCommand === "start" || journalCommand === "st" || journalCommand === "s" || journalCommand === "set" || journalCommand === "create"
            || journalCommand === "c" || journalCommand === "make" || journalCommand === "m" || journalCommand === "add" || journalCommand === "a") {
            var journalDocument;
            const targetUserSettings = await User.findOne({ discordID: authorID });

            // Create new User Settings - can be changed by the user themselves if it's incorrect!
            if (!targetUserSettings) {
                const timezone = await fn.getNewUserTimezoneSettings(bot, message, PREFIX, authorID);
                await fn.createUserSettings(bot, authorID, timezone);
            }

            let templateType = await fn.reactionDataCollect(bot, message, `📜 - **Daily (2-part) Journal Template**`
                + `\n🗣 - **Prompt/Question & Answer**\n✍ - \"**Freehand**\" (No template or prompt)`, ['📜', '🗣', '✍'],
                "Journal: Template", journalEmbedColour);
            switch (templateType) {
                case '📜': templateType = 1;
                    break;
                case '🗣': templateType = 2;
                    break;
                case '✍': templateType = 3;
                    break;
                default: templateType = false;
                    break;
            }
            if (!templateType) return;

            if (templateType === 1) {
                const gratitudes = await fn.getMultilineEntry(bot, message, "What are **3** things you are **truly grateful** for? 🙏",
                    "Journal: Gratitudes", true, journalEmbedColour);
                console.log({ gratitudes });
                if (!gratitudes && gratitudes !== '') return;

                const improvements = await fn.getMultilineEntry(bot, message, "What are **3** things you feel you should **improve** on? 📈",
                    "Journal: Improvements", true, journalEmbedColour);
                console.log({ improvements });
                if (!improvements && improvements !== '') return;

                const actions = await fn.getMultilineEntry(bot, message, "What are **3 actions or mindset shifts** that would make **today great**? 🧠‍",
                    "Journal: Actions", true, journalEmbedColour);
                console.log({ actions });
                if (!actions && actions !== '') return;

                const affirmations = await fn.getSingleEntry(bot, message, "**I am...**",
                    "Journal: Affirmation", true, journalEmbedColour);
                console.log({ affirmations });
                if (!affirmations && affirmations !== '') return;

                journalDocument = new Journal({
                    _id: mongoose.Types.ObjectId(),
                    userID: authorID,
                    template: templateType,
                    entry: {
                        gratitudes,
                        improvements,
                        actions,
                        affirmations,
                    },
                });

                journalDocument.save()
                    .then(result => {
                        message.reply("**Your journal entry was successfully created!**");
                        console.log({ result });
                    })
                    .catch(err => console.error(err));

                const confirmEnd = await fn.getUserConfirmation(message, "**Do you want to set a reminder for when you finish your journal entry?**"
                    + "\n(Ideally for the end of the day, before bed)", forceSkip, "Journal: End of Day - Completion Reminder", 180000);
                if (!confirmEnd) return;

                let endTime = await fn.getDateAndTimeEntry(bot, message, PREFIX, timezoneOffset, daylightSavings,
                    "**When** would you like to **finish your journal entry?**",
                    "Journal: End of Day - Reflection Time", true, journalEmbedColour);
                if (!endTime) return;
                endTime -= HOUR_IN_MS * timezoneOffset;

                const now = Date.now();
                const reminderMessage = `**__Time to complete your journal entry for today!__**`
                    + `\n\nType** \`?${commandUsed} end\` **- to write your **end of day reflection journal**`;
                await rm.setNewDMReminder(bot, authorID, now, now, endTime, reminderMessage,
                    "Journal", journalDocument._id, false, false, journalEmbedColour);
                return;
            }
        }


        else if (journalCommand === "delete" || journalCommand === "remove" || journalCommand === "del" || journalCommand === "d"
            || journalCommand === "rem" || journalCommand === "r") {

        }


        else if (journalCommand === "see" || journalCommand === "show") {

        }


        else if (journalCommand === "post" || journalCommand === "p") {

        }


        // SHOWS WEEKLY JOURNAL TEMPLATES!
        else if (journalCommand === "template" || journalCommand === "templates" || journalCommand === "temp" || journalCommand === "t") {
            let templateUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${journalCommand} <DAILY/WEEKLY> <TYPE?>\``
                + "\n\n`<DAILY/WEEKLY>`: **daily/d; weekly/w**"
                + "\n\n`<TYPE?>`: (OPT.)\nIf `daily`: **morning/m; night/n**\nIf `weekly`: **reflection/r; goals/g**";
            templateUsageMessage = fn.getMessageEmbed(templateUsageMessage, "Journal: Template Help", journalEmbedColour);
            const templateHelpMessage = `Try \`${PREFIX}${commandUsed} ${journalCommand} help\``;
            var journalType;
            if (args[1] !== undefined) {
                journalType = args[1].toLowerCase();
            }
            let journalTemplate = getJournalTemplate(args, true, journalEmbedColour);
            if (journalType === "help") return message.channel.send(templateUsageMessage);
            else if (!journalTemplate) return message.reply(templateHelpMessage);
            else return message.channel.send(journalTemplate);
        }


        else return message.reply(journalHelpMessage);
    }
};