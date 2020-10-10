// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Journal = require("../database/schemas/journal");
const Prompt = require("../database/schemas/prompt");
const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const prompts = require("../../utilities/prompts.json").prompts;
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

async function getGeneratedPromptAndAnswer(bot, message, prompts) {
    const newPromptInstructions = `Type \`n\` to generate a **new prompt**`;
    const newPromptKeywords = ['n'];
    let newPrompt = true;
    var randomIndex, currentPrompt;
    do {
        if (newPrompt) {
            console.log(prompts.length);
            while (!currentPrompt) {
                randomIndex = Math.round(Math.random() * prompts.length);
                console.log({ randomIndex });
                currentPrompt = prompts[randomIndex].message;
                console.log({ currentPrompt });
            }
        }
        const user = bot.users.cache.get(currentPrompt.userID).username;
        let entry = await fn.getMultilineEntry(bot, message, `**${currentPrompt}**${user ? `\n\nBy: __**${user}**__` : ""}`,
            "Journal: Prompt and Answer", true, journalEmbedColour, newPromptInstructions, newPromptKeywords, newPrompt ? "" : entry.array);
        if (!entry) return false;
        else if (entry.returnVal === 'n') {
            if (entry.message) {
                const confirmNewPrompt = await fn.getUserConfirmation(message,
                    "**__Are you sure you want to generate a new prompt?__**\n\n**Your current journal entry will be lost!**",
                    false, "Journal: New Prompt Confirmation");
                if (confirmNewPrompt) newPrompt = false;
            }
        }
        else return { message: entry, prompt: currentPrompt };
    }
    while (true)
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
        const journalInProgress = await Journal.findOne({ template: 1, userID: authorID, "entry.amazing": undefined, "entry.betterDay": undefined });
        const totalJournalNumber = await Journal.find({ userID: authorID }).countDocuments();
        console.log({ journalInProgress, totalJournalNumber });
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

            if (journalInProgress) return message.reply(`**You already have a journal entry in progress!** Try** \`${PREFIX}${commandUsed} end\` **to **complete** your journal entry`);

            const templateType = await fn.reactionDataCollect(bot, message, `📜 - **Daily (2-part) Journal Template** (*5-Minute Journal*)`
                + `\n🗣 - **Prompt/Question & Answer** (Enter a prompt or get a generated prompt)`
                + `\n✍ - \"**Freehand**\" (No template or prompt)\n❌ - **Exit**`, ['📜', '🗣', '✍', '❌'], "Journal: Template", journalEmbedColour);
            switch (templateType) {
                case '📜': {
                    let gratitudes = await fn.getMultilineEntry(bot, message, "What are **3** things you are **truly __grateful__** for? 🙏\n(big or small)",
                        "Journal: Gratitudes", true, journalEmbedColour);
                    gratitudes = gratitudes.message;
                    console.log({ gratitudes });
                    if (!gratitudes && gratitudes !== '') return;

                    // let improvements = await fn.getMultilineEntry(bot, message, "What are **3** things/areas you feel you should **__improve__** on? 📈",
                    //     "Journal: Improvements", true, journalEmbedColour);
                    // improvements = improvements.message;
                    // console.log({ improvements });
                    // if (!improvements && improvements !== '') return;

                    let actions = await fn.getMultilineEntry(bot, message, "What are **3 __actions or mindset shifts__** that would make **today great**? 🧠‍",
                        "Journal: Actions", true, journalEmbedColour);
                    actions = actions.message;
                    console.log({ actions });
                    if (!actions && actions !== '') return;

                    const affirmations = await fn.getSingleEntry(bot, message, "Complete the affirmation:\n\n**__I am...__**",
                        "Journal: Affirmations", true, journalEmbedColour);
                    console.log({ affirmations });
                    if (!affirmations && affirmations !== '') return;

                    journalDocument = new Journal({
                        _id: mongoose.Types.ObjectId(),
                        userID: authorID,
                        template: 1,
                        entry: {
                            gratitudes,
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
                        + "\n(Ideally for the end of the day, before bed)", false, "Journal: End of Day - Completion Reminder", 180000);
                    if (!confirmEnd) return;

                    let endTime = await fn.getDateAndTimeEntry(bot, message, PREFIX, timezoneOffset, daylightSavings,
                        "**When** would you like to **finish your journal entry?**",
                        "Journal: End of Day - Reflection Time", forceSkip, journalEmbedColour);
                    if (!endTime) return;
                    endTime -= HOUR_IN_MS * timezoneOffset;

                    const now = Date.now();
                    const reminderMessage = `**__Time to complete your journal entry for today!__**`
                        + `\n\nType** \`?${commandUsed} end\` **- to write your **end of day reflection journal**`;
                    await rm.setNewDMReminder(bot, authorID, now, now, endTime, reminderMessage,
                        "Journal", journalDocument._id, false, false, journalEmbedColour);
                    return;
                }
                // If allowing community prompts (with verification system) - adjust code below
                case '🗣': {
                    const promptType = await fn.reactionDataCollect(bot, message, "**Would you like to answer a randomly generated question/prompt or create your own to answer?**"
                        + "\n\n⚙ - **Generate Prompts**\n✒ - **Create Prompt**\n❌ - **Exit**", ['⚙', '🖋', '❌'], "Journal: Prompt", journalEmbedColour);
                    // 🗣 - **Get Prompts** from the **Community**\n
                    if (promptType === '✒') {
                        const userPrompt = await fn.getSingleEntry(bot, message, `**Enter a __question or prompt__ you'd like to explore and answer:**`,
                            "Journal: Create Prompt", forceSkip, journalEmbedColour);
                        if (!userPrompt) return;
                        let journalEntry = await fn.getMultilineEntry(bot, message, userPrompt, "Journal: Prompt and Answer", forceSkip, journalEmbedColour);
                        if (!journalEntry) return;
                        journalEntry = journalEntry.message;
                        journalDocument = new Journal({
                            _id: mongoose.Types.ObjectId(),
                            userID: authorID,
                            template: 2,
                            entry: {
                                message: journalEntry,
                                userPrompt,
                            },
                        });
                        journalDocument.save()
                            .then(result => {
                                message.reply("**Your journal entry was successfully created!**");
                                console.log({ result });
                            })
                            .catch(err => console.error(err));
                    }
                    else if (promptType === '⚙' || promptType === '🗣') {
                        // const getCommunityPrompt = promptType === '🗣';
                        var promptArray;
                        // if (getCommunityPrompt) {
                        //     promptArray = await Prompt.find({}).sort({ _id: +1 });
                        //     if (!promptArray.length) promptArray = prompts;
                        // }
                        // else promptArray = prompts;
                        promptArray = prompts;
                        const journalEntry = await getGeneratedPromptAndAnswer(bot, message, promptArray);
                        if (!journalEntry) return;
                        const { message, prompt } = journalEntry;
                        journalDocument = new Journal({
                            _id: mongoose.Types.ObjectId(),
                            userID: authorID,
                            template: 2,
                            entry: {
                                message,
                                prompt,
                            },
                        });
                        journalDocument.save()
                            .then(result => {
                                message.reply("**Your journal entry was successfully created!**");
                                console.log({ result });
                            })
                            .catch(err => console.error(err));
                    }
                    else return;
                }
                    break;
                case '✍': {
                    let journalEntry = await fn.getMultilineEntry(bot, message, userPrompt, "Journal: Freehand (No Template)", forceSkip, journalEmbedColour);
                    if (!journalEntry) return;
                    journalEntry = journalEntry.message;
                    journalDocument = new Journal({
                        _id: mongoose.Types.ObjectId(),
                        userID: authorID,
                        template: 3,
                        entry: { message: journalEntry, },
                    });
                    journalDocument.save()
                        .then(result => {
                            message.reply("**Your journal entry was successfully created!**");
                            console.log({ result });
                        })
                        .catch(err => console.error(err));
                }
                    break;
                default: return;
            }
            return;
        }



        else if (journalCommand === "end" || journalCommand === "e") {
            if (!journalInProgress) return message.reply(`**No journals in progress...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`);
            let amazing = await fn.getMultilineEntry(bot, message, "List **3 __amazing__** things that happened today ☘ (big or small)", "Journal: The Amazing 3", true, journalEmbedColour);
            if (!amazing) return;
            else amazing = amazing.message;
            // let accomplishments = await fn.getMultilineEntry(bot, message, "List **3 __accomplishments__** today 🏆🥇 (big or small)", "Journal: Accomplishments", true, journalEmbedColour);
            // if (!accomplishments);
            // else accomplishments = accomplishments.message;
            let betterDay = await fn.getMultilineEntry(bot, message, "**__How could you have made today better?__** 📈\n\ne.g. **__Retrospective Journal:__**"
                + "\n**__CM__** - **Critical Moment** of suboptimal behaviour/action. 👀\n**__X__** - The **rationalization/thought pattern** behind it. 🧠"
                + "\n**__\\\$__** - How you want to **think** next time! 🤔💭\n\n[From *Metascript Method* - by Mark Queppet]", "Journal: Retrospective Better Day",
                true, journalEmbedColour);
            if (!betterDay) return;
            else betterDay = betterDay.message;

            let journal = journalInProgress;
            journal.entry.amazing = amazing;
            journal.entry.betterDay = betterDay;
            console.log({ journal })
            const finishedJournal = await Journal.findByIdAndUpdate(journal._id, { $set: { entry: journal.entry } }, { new: true });
            console.log({ finishedJournal });
            if (finishedJournal) {
                console.log(`Completing ${authorUsername}'s (${authorID}) journal entry (Removing Associated Reminders...)`);
                message.reply("**Your journal entry was successfully completed!**");
                const endReminder = await Reminder.deleteMany({ connectedDocument: journal._id });
                console.log({ endReminder });
            }
            else return console.log(`There was an error completing ${authorUsername}'s (${authorID}) journal entry`);
            return;
        }


        else if (journalCommand === "delete" || journalCommand === "remove" || journalCommand === "del" || journalCommand === "d"
            || journalCommand === "rem" || journalCommand === "r") {
            if (!totalJournalNumber) return message.reply(`**No journal entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`);

        }


        else if (journalCommand === "see" || journalCommand === "show") {
            if (!totalJournalNumber) return message.reply(`**No journal entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`);
        }


        else if (journalCommand === "post" || journalCommand === "p") {
            if (!totalJournalNumber) return message.reply(`**No journal entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`);
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
