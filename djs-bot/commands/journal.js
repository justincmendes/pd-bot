// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Journal = require("../database/schemas/journal");
const Prompt = require("../database/schemas/prompt");
const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const del = require("../../utilities/deletion");
const prompts = require("../../utilities/prompts.json").prompts;
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const timeExamples = fn.timeExamples;
const journalEmbedColour = fn.journalEmbedColour;
const journalMax = fn.journalMaxTier1;

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

async function getGeneratedPromptAndAnswer(bot, message, PREFIX, prompts) {
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
        const user = bot.users.cache.get(currentPrompt.userID);
        let entry = await fn.getMultilineEntry(bot, message, PREFIX, `**__${currentPrompt || ""}__**${user ? `\n\nBy: __**${user.username}**__` : ""}`,
            "Journal: Prompt and Answer", true, journalEmbedColour, newPromptInstructions, newPromptKeywords, newPrompt ? "" : entry.array);
        if (!entry) return false;
        else if (entry.returnVal === 'n') {
            if (entry.message) {
                const confirmNewPrompt = await fn.getUserConfirmation(bot, message, PREFIX,
                    "**__Are you sure you want to generate a new prompt?__**\n\n**Your current journal entry will be lost!**",
                    false, "Journal: New Prompt Confirmation");
                if (confirmNewPrompt) newPrompt = false;
            }
            else {
                newPrompt = true;
                currentPrompt = false;
            }
        }
        else return { message: entry.message, prompt: currentPrompt };
    }
    while (true)
}

async function getJournalByCreatedAt(userID, entryIndex, numberOfEntries = 1) {
    try {
        const entries = await Journal
            .find({ userID })
            .sort({ createdAt: -1 })
            .limit(numberOfEntries)
            .skip(entryIndex);
        return entries;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

async function getOneJournalByCreatedTime(userID, journalIndex) {
    const journal = await Journal
        .findOne({ userID })
        .sort({ createdAt: -1 })
        .skip(journalIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return journal;
}

async function getOneJournalByRecency(userID, journalIndex) {
    const journal = await Journal
        .findOne({ userID })
        .sort({ _id: -1 })
        .skip(journalIndex)
        .catch(err => {
            console.log(err);
            return false;
        });
    return journal;
}

async function getOneJournalByObjectID(journalTargetID) {
    try {
        const entries = await Journal
            .findById(journalTargetID);
        console.log(entries);
        return entries;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

async function getMostRecentJournal(userID, embedColour = journalEmbedColour) {
    const recentJournalToString = `__**Journal ${await getRecentJournalIndex(userID)}:**__`
        + `\n${journalDocumentToString(await getOneJournalByRecency(userID, 0))}`;
    const journalEmbed = fn.getMessageEmbed(recentJournalToString, `Journal See Recent Entry`, embedColour);
    return journalEmbed;
}

function journalDocumentToString(journalDoc) {
    const { createdAt, template, entry, } = journalDoc;
    let entryString = `**Created At:** ${createdAt ? fn.timestampToDateString(createdAt) : ""}\n**Type: **`;
    switch (template) {
        case 1:
            entryString += "Daily (5-Minute) Journal"
                + `${entry.gratitudes ? `\n🙏 **Gratitudes:**\n${entry.gratitudes}` : ""}`
                + `${entry.actions ? `\n✊ **Actions/Mindsets for a Great Day:**\n${entry.actions}` : ""}`
                + `${entry.affirmations ? `\n🗣 **Affirmations:** ***I am...***\n${entry.affirmations}` : ""}`
                + `${entry.amazing ? `\n🍀 **Amazing Things That Happened:**\n${entry.amazing}` : ""}`
                + `${entry.betterDay ? `\n📈 **Could Have Done These Better:**\n${entry.betterDay}` : ""}`;
            break;
        case 2:
            entryString += "Prompt & Answer"
                + `${entry.prompt ? `\n🗣 **Prompt:**\n${entry.prompt}` : ""}`
                + `${entry.message ? `\n💬 **Entry:**\n${entry.message}` : ""}`;
            break;
        case 3:
            entryString += "Freehand" + `${entry.message ? `\n💬 **Entry:**\n${entry.message}` : ""}`;
            break;
    }
    return entryString;
}

function multipleJournalsToString(message, journalArray, numberOfJournals, entriesToSkip = 0, toArray = false) {
    var entriesToString = new Array();
    console.log({ numberOfJournals });
    for (i = 0; i < numberOfJournals; i++) {
        if (journalArray[i] === undefined) {
            numberOfJournals = i;
            fn.sendErrorMessage(message, `**JOURNALS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`);
            break;
        }
        const journalString = `__**Journal ${i + entriesToSkip + 1}:**__`
            + `\n${journalDocumentToString(journalArray[i])}`;
        entriesToString.push(journalString);
    }
    if (!toArray) entriesToString = entriesToString.join('\n\n');
    return entriesToString;
}

async function getRecentJournalIndex(userID) {
    try {
        var index;
        const entries = await Journal
            .find({ userID })
            .sort({ createdAt: -1 });
        if (entries.length) {
            let targetID = await Journal
                .findOne({ userID })
                .sort({ _id: -1 });
            targetID = targetID._id.toString();
            console.log({ targetID });
            for (i = 0; i < entries.length; i++) {
                if (entries[i]._id.toString() === targetID) {
                    index = i + 1;
                    return index;
                }
            }
        }
        else return -1;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}


module.exports = {
    name: "journal",
    description: "Daily Journaling (with Weekly journal template)",
    aliases: ["j", "jour", "journ", "scribe", "scribing", "write", "w"],
    cooldown: 1.5,
    args: true,
    run: async function run(bot, message, commandUsed, args, PREFIX,
        timezoneOffset, daylightSaving, forceSkip) {
        // At the end of every week/Weekly habit cron time, or when they submit their weekly journal reflection, send them a textfile of their weeks entries (press the paperclip)
        // create, see, edit, end, templates <= return both the weekly reflection/weekly goals and daily journal template!

        // Variable Declarations and Initializations
        let journalUsageMessage = `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\``
            + "\n\n\`<ACTION>\`: **start/s; end/e; see; edit; delete/d; post; template/t**"
            + `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join('; ')}**`
        journalUsageMessage = fn.getMessageEmbed(journalUsageMessage, "Journal: Help", journalEmbedColour);
        const journalCommand = args[0].toLowerCase();
        const journalHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
        const journalActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${journalCommand} help\``;
        const journalType = args[1] ? args[1].toLowerCase() : false;
        const guildID = message.guild.id || false;
        const authorID = message.author.id;
        const authorUsername = message.author.username;
        const userSettings = await User.findOne({ discordID: authorID });
        const { tier } = userSettings;
        const journalInProgress = await Journal.findOne({ template: 1, userID: authorID, "entry.amazing": undefined, "entry.betterDay": undefined });
        const totalJournalNumber = await Journal.find({ userID: authorID }).countDocuments();
        console.log({ journalInProgress, totalJournalNumber });
        // Journal Commands
        if (journalCommand === "help") return message.channel.send(journalUsageMessage);


        else if (journalCommand === "start" || journalCommand === "st" || journalCommand === "s" || journalCommand === "set" || journalCommand === "create"
            || journalCommand === "make" || journalCommand === "m" || journalCommand === "add" || journalCommand === "a") {
            var journalDocument;

            // Create new User Settings - can be changed by the user themselves if it's incorrect!
            if (!userSettings) {
                const timezone = await fn.getNewUserTimezoneSettings(bot, message, PREFIX, authorID);
                await fn.createUserSettings(bot, authorID, timezone);
            }

            if (tier === 1) {
                if (totalJournalNumber >= journalMax) {
                    return message.channel.send(fn.getMessageEmbed(fn.getTierMaxMessage(PREFIX, commandUsed, journalMax, ["Journal", "Journals"], 1, false),
                        `Journal: Tier 1 Maximum`, journalEmbedColour).setFooter(fn.premiumFooterText));
                }
            }

            const templateType = await fn.reactionDataCollect(bot, message, `📜 - **Daily (2-part) Journal Template** (*5-Minute Journal*)`
                + `\n🗣 - **Prompt/Question & Answer** (Enter a prompt or get a generated prompt)`
                + `\n✍ - \"**Freehand**\" (No template or prompt)\n❌ - **Exit**`, ['📜', '🗣', '✍', '❌'], "Journal: Template", journalEmbedColour);
            switch (templateType) {
                case '📜': {
                    if (journalInProgress) return message.reply(`**You already have a journal entry in progress!** Try** \`${PREFIX}${commandUsed} end\` **to **complete** your journal entry`);

                    let gratitudes = await fn.getMultilineEntry(bot, message, PREFIX, "What are **3** things you are **truly __grateful__** for? 🙏\n(big or small)"
                        + "\n(Within 1000 characters)", "Journal: Gratitudes", true, journalEmbedColour, 1000);
                    gratitudes = gratitudes.message;
                    console.log({ gratitudes });
                    if (!gratitudes && gratitudes !== '') return;

                    // let improvements = await fn.getMultilineEntry(bot, message, "What are **3** things/areas you feel you should **__improve__** on? 📈",
                    //     "Journal: Improvements", true, journalEmbedColour);
                    // improvements = improvements.message;
                    // console.log({ improvements });
                    // if (!improvements && improvements !== '') return;

                    let actions = await fn.getMultilineEntry(bot, message, PREFIX, "What are **3 __actions or mindset shifts__** that would make **today great**? 🧠‍"
                        + "\n(Within 1000 characters)", "Journal: Actions", true, journalEmbedColour, 1000);
                    actions = actions.message;
                    console.log({ actions });
                    if (!actions && actions !== '') return;

                    const affirmations = await fn.getSingleEntry(bot, message, PREFIX, "Complete the affirmation:\n\n**__I am...__**",
                        "Journal: Affirmations", true, journalEmbedColour);
                    console.log({ affirmations });
                    if (!affirmations && affirmations !== '') return;

                    journalDocument = new Journal({
                        _id: mongoose.Types.ObjectId(),
                        userID: authorID,
                        createdAt: fn.getCurrentUTCTimestampFlooredToSecond() + HOUR_IN_MS * timezoneOffset,
                        template: 1,
                        entry: {
                            gratitudes,
                            actions,
                            affirmations,
                        },
                    });

                    await journalDocument.save()
                        .then(result => {
                            message.reply("**Your journal entry was successfully created!**");
                            console.log({ result });
                        })
                        .catch(err => console.error(err));

                    const confirmEndReminder = await fn.getUserConfirmation(bot, message, PREFIX, "**Do you want to set a reminder for when you want to finish your journal entry?**"
                        + "\n(Ideally for the end of the day, before bed)", false, "Journal: End of Day - Completion Reminder", 180000);
                    if (!confirmEndReminder) return;

                    let endTime = await fn.getDateAndTimeEntry(bot, message, PREFIX, timezoneOffset, daylightSaving,
                        "**When** would you like to **finish your journal entry?**",
                        "Journal: End of Day - Reflection Time", true, journalEmbedColour);
                    if (!endTime) return;
                    endTime -= HOUR_IN_MS * timezoneOffset;

                    const reminderMessage = `**__Time to complete your journal entry for today!__**`
                        + `\n\nType** \`?${commandUsed} end\` **- to write your **end of day reflection journal**`;
                    const now = fn.getCurrentUTCTimestampFlooredToSecond();
                    await rm.setNewDMReminder(bot, authorID, now, endTime, reminderMessage,
                        "Journal", true, journalDocument._id, false, false, false, journalEmbedColour);
                    console.log("Journal end reminder set.");
                    message.reply(`Journal end reminder set for **${fn.millisecondsToTimeString(endTime - fn.getCurrentUTCTimestampFlooredToSecond())}** from now!`);
                    return;
                }
                // If allowing community prompts (with verification system) - adjust code below
                case '🗣': {
                    const promptType = await fn.reactionDataCollect(bot, message, "**Would you like to answer a randomly generated question/prompt or create your own to answer?**"
                        + "\n\n⚙ - **Generate Prompts**\n🖋 - **Create Prompt**\n❌ - **Exit**", ['⚙', '🖋', '❌'], "Journal: Prompt", journalEmbedColour);
                    // 🗣 - **Get Prompts** from the **Community**\n
                    if (promptType === '🖋') {
                        const userPrompt = await fn.getSingleEntryWithCharacterLimit(bot, message, PREFIX, `**Enter a __question or prompt__ you'd like to explore and answer:**`
                            + "\n(Within 1000 characters)", "Journal: Create Prompt", 1000, "a prompt", forceSkip, journalEmbedColour);
                        if (!userPrompt) return;
                        let journalEntry = await fn.getMultilineEntry(bot, message, PREFIX, userPrompt, "Journal: Prompt and Answer", forceSkip, journalEmbedColour);
                        if (!journalEntry) return;
                        journalEntry = journalEntry.message;
                        journalDocument = new Journal({
                            _id: mongoose.Types.ObjectId(),
                            userID: authorID,
                            createdAt: fn.getCurrentUTCTimestampFlooredToSecond() + HOUR_IN_MS * timezoneOffset,
                            template: 2,
                            entry: {
                                message: journalEntry,
                                prompt: userPrompt,
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
                        const journalEntry = await getGeneratedPromptAndAnswer(bot, message, PREFIX, promptArray);
                        if (!journalEntry) return;
                        const { message: entry, prompt } = journalEntry;
                        journalDocument = new Journal({
                            _id: mongoose.Types.ObjectId(),
                            userID: authorID,
                            createdAt: fn.getCurrentUTCTimestampFlooredToSecond() + HOUR_IN_MS * timezoneOffset,
                            template: 2,
                            entry: {
                                message: entry,
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
                    let journalEntry = await fn.getMultilineEntry(bot, message, PREFIX, "\n**__Type in your journal entry:__**", "Journal: Freehand (No Template)", forceSkip, journalEmbedColour);
                    if (!journalEntry) return;
                    journalEntry = journalEntry.message;
                    journalDocument = new Journal({
                        _id: mongoose.Types.ObjectId(),
                        userID: authorID,
                        createdAt: fn.getCurrentUTCTimestampFlooredToSecond() + HOUR_IN_MS * timezoneOffset,
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
            let amazing = await fn.getMultilineEntry(bot, message, PREFIX, "List **3 __amazing__** things that happened today ☘ (big or small)"
                + "\n(Within 1500 Characters)", "Journal: The Amazing 3", true, journalEmbedColour, 1500);
            if (!amazing) return;
            else amazing = amazing.message;
            // let accomplishments = await fn.getMultilineEntry(bot, message, "List **3 __accomplishments__** today 🏆🥇 (big or small)", "Journal: Accomplishments", true, journalEmbedColour);
            // if (!accomplishments);
            // else accomplishments = accomplishments.message;
            let betterDay = await fn.getMultilineEntry(bot, message, PREFIX, "**__How could you have made today better?__** 📈\n\ne.g. **__Retrospective Journal:__**"
                + "\n👀 - **Critical Moment** of suboptimal behaviour/action.\n🧠 - The **rationalization/thought pattern** behind it."
                + "\n🤔 - How you want to **think** next time! 💭\n\n[From *Metascript Method* - by Mark Queppet]\n(Within 1500 Characters)",
                "Journal: Retrospective Better Day", true, journalEmbedColour, 1500);
            if (!betterDay) return;
            else betterDay = betterDay.message;

            const finishedJournal = await Journal.findByIdAndUpdate(journalInProgress._id,
                { $set: { "entry.amazing": amazing, "entry.betterDay": betterDay } }, { new: true });
            console.log({ finishedJournal });
            if (finishedJournal) {
                console.log(`Completing ${authorUsername}'s (${authorID}) journal entry!`);
                message.reply("**Your journal entry was successfully completed!**");
                if (journalInProgress._id) {
                    await rm.cancelRemindersByConnectedDocument(journalInProgress._id);
                    await Reminder.deleteMany({ connectedDocument: journalInProgress._id });
                    console.log(`Removing Associated Reminders....`);
                }
            }
            else return console.log(`There was an error completing ${authorUsername}'s (${authorID}) journal entry`);
            return;
        }


        else if (journalCommand === "delete" || journalCommand === "remove" || journalCommand === "del" || journalCommand === "d"
            || journalCommand === "rem" || journalCommand === "r") {
            let journalDeleteUsageMessage = fn.getReadOrDeleteUsageMessage(PREFIX, commandUsed, journalCommand, true, ["Entry", "Entries"]);
            journalDeleteUsageMessage = fn.getMessageEmbed(journalDeleteUsageMessage, "Journal: Delete Help", journalEmbedColour);
            const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see help\``;

            if (journalType) {
                if (journalType === "help") {
                    return message.channel.send(journalDeleteUsageMessage);
                }
                if (!totalJournalNumber) {
                    return message.reply(`**NO JOURNALS...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`);
                }
            }
            else return message.reply(journalActionHelpMessage);

            // delete past #:
            if (args[2] !== undefined) {
                const deleteType = journalType;
                if (deleteType === "past") {
                    // If the following argument is not a number, exit!
                    if (isNaN(args[2])) {
                        return fn.sendErrorMessageAndUsage(message, journalActionHelpMessage);
                    }
                    var numberArg = parseInt(args[2]);
                    if (numberArg <= 0) {
                        return fn.sendErrorMessageAndUsage(message, journalActionHelpMessage);
                    }
                    let indexByRecency = false;
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    var journalCollection;
                    if (indexByRecency) journalCollection = await fn.getEntriesByRecency(Journal, { userID: authorID }, 0, numberArg);
                    else journalCollection = await getJournalByCreatedAt(authorID, 0, numberArg);
                    const journalStringArray = fn.getEmbedArray(multipleJournalsToString(message, journalCollection, numberArg, 0, true),
                        '', true, false, journalEmbedColour);
                    console.log({ journalStringArray });
                    const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} entries?** `;
                    const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, journalStringArray, multipleDeleteMessage, forceSkip,
                        `Journal: Delete Past ${numberArg} Entries (${sortType})`, 600000);
                    if (!multipleDeleteConfirmation) return;
                    const targetIDs = await journalCollection.map(entry => entry._id);
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Entries (${sortType})`);
                    await del.deleteManyByIDAndConnectedReminders(Journal, targetIDs);
                    return;
                }
                if (deleteType === "many") {
                    if (args[2] === undefined) {
                        return message.reply(journalActionHelpMessage);
                    }
                    // Get the arguments after keyword MANY
                    // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
                    // Convert String of Numbers array into Integer array
                    // Check which journals exist, remove/don't add those that don't
                    let toDelete = args[2].split(',').filter(index => {
                        if (!isNaN(index)) {
                            numberIndex = parseInt(index);
                            if (numberIndex > 0 && numberIndex <= totalJournalNumber) {
                                return numberIndex;
                            }
                        }
                        else if (index === "recent") {
                            return true;
                        }
                    });
                    const recentIndex = await getRecentJournalIndex(authorID);
                    toDelete = Array.from(new Set(toDelete.map((number) => {
                        if (number === "recent") {
                            if (recentIndex !== -1) return recentIndex;
                        }
                        else return +number;
                    })));
                    console.log({ toDelete });
                    // Send error message if none of the given reminders exist
                    if (!toDelete.length) {
                        return fn.sendErrorMessage(message, "All of these **journals DO NOT exist**...");
                    }
                    var indexByRecency = false;
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var journalTargetIDs = new Array();
                    var journalStringArray = new Array();
                    for (i = 0; i < toDelete.length; i++) {
                        var journalView;
                        if (indexByRecency) {
                            journalView = await getOneJournalByRecency(authorID, toDelete[i] - 1);
                        }
                        else {
                            journalView = await getOneJournalByCreatedTime(authorID, toDelete[i] - 1);
                        }
                        journalTargetIDs.push(journalView._id);
                        journalStringArray.push(`__**Journal ${toDelete[i]}:**__\n${journalDocumentToString(journalView)}`);
                    }
                    const deleteConfirmMessage = `Are you sure you want to **delete entries ${toDelete.toString()}?**`;
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    journalStringArray = fn.getEmbedArray(journalStringArray, '', true, false, journalEmbedColour);
                    const confirmDeleteMany = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, journalStringArray, deleteConfirmMessage,
                        forceSkip, `Journal: Delete Entries ${toDelete} (${sortType})`, 600000);
                    if (confirmDeleteMany) {
                        console.log(`Deleting ${authorID}'s Entries ${toDelete} (${sortType})`);
                        await del.deleteManyByIDAndConnectedReminders(Journal, journalTargetIDs);
                        return;
                    }
                    else return;
                }
                else {
                    var shiftIndex;
                    let indexByRecency = false;
                    if (args[2].toLowerCase() === "past") {
                        shiftIndex = 0;
                        indexByRecency = false;
                    }
                    else if (args[2].toLowerCase() === "recent") {
                        shiftIndex = 1;
                        indexByRecency = true;
                    }
                    console.log({ shiftIndex });
                    if (args[2 + shiftIndex]) {
                        if (args[2 + shiftIndex].toLowerCase() === "past") {
                            var skipEntries;
                            if (isNaN(args[3 + shiftIndex])) {
                                if (args[3 + shiftIndex].toLowerCase() === "recent") {
                                    skipEntries = await getRecentJournalIndex(authorID);
                                }
                                else return message.reply(journalActionHelpMessage);
                            }
                            else skipEntries = parseInt(args[3 + shiftIndex]);
                            const pastNumberOfEntries = parseInt(args[1]);
                            if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                                return fn.sendErrorMessageAndUsage(message, journalActionHelpMessage);
                            }
                            var journalCollection;
                            if (indexByRecency) journalCollection = await fn.getEntriesByRecency(Journal, { userID: authorID }, skipEntries, pastNumberOfEntries);
                            else journalCollection = await getJournalByCreatedAt(authorID, skipEntries, pastNumberOfEntries);
                            const journalStringArray = fn.getEmbedArray(multipleJournalsToString(message, journalCollection, pastNumberOfEntries, skipEntries, true),
                                '', true, false, journalEmbedColour);
                            if (skipEntries >= totalJournalNumber) return;
                            const sortType = indexByRecency ? "By Recency" : "By Date Created";
                            const multipleDeleteMessage = `Are you sure you want to **delete ${journalCollection.length} entries past entry ${skipEntries}?**`;
                            const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, journalStringArray, multipleDeleteMessage,
                                forceSkip, `Journal: Multiple Delete Warning! (${sortType})`);
                            console.log({ multipleDeleteConfirmation });
                            if (!multipleDeleteConfirmation) return;
                            console.log({ multipleDeleteConfirmation });
                            const targetIDs = await journalCollection.map(entry => entry._id);
                            console.log(`Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} entries past ${skipEntries} (${sortType})`);
                            await del.deleteManyByIDAndConnectedReminders(Journal, targetIDs);
                            return;
                        }

                        // They haven't specified the field for the journal delete past function
                        else if (deleteType === "past") return message.reply(journalActionHelpMessage);
                        else return message.reply(journalActionHelpMessage);
                    }
                }
            }
            // Next: JOURNAL DELETE ALL
            // Next: JOURNAL DELETE MANY
            // Next: JOURNAL DELETE

            // journal delete <NUMBER/RECENT/ALL>
            const noJournalsMessage = `**NO JOURNALS**... try \`${PREFIX}${commandUsed} start help\``;
            if (isNaN(args[1])) {
                const deleteType = journalType;
                if (deleteType === "recent") {
                    const journalView = await getOneJournalByRecency(authorID, 0, false);
                    if (!journalView) return fn.sendErrorMessage(message, noJournalsMessage);
                    const journalTargetID = journalView._id;
                    console.log({ journalTargetID });
                    const journalIndex = await getRecentJournalIndex(authorID);
                    const journalEmbed = fn.getEmbedArray(`__**Journal ${journalIndex}:**__\n${journalDocumentToString(journalView)}`,
                        `Journal: Delete Recent Entry`, true, true, journalEmbedColour);
                    const deleteConfirmMessage = `Are you sure you want to **delete your most recent entry?:**`;
                    const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, journalEmbed, deleteConfirmMessage, forceSkip,
                        `Journal: Delete Recent Entry`, 600000);
                    if (deleteIsConfirmed) {
                        await del.deleteOneByIDAndConnectedReminders(Journal, journalTargetID);
                        return;
                    }
                }
                else if (deleteType === "all") {
                    const confirmDeleteAllMessage = "Are you sure you want to **delete all** of your recorded journals?\n\nYou **cannot UNDO** this!" +
                        `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    const pastNumberOfEntriesIndex = totalJournalNumber;
                    if (pastNumberOfEntriesIndex === 0) {
                        return fn.sendErrorMessage(message, noJournalsMessage);
                    }
                    let confirmDeleteAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmDeleteAllMessage, forceSkip, "Journal: Delete All Entries WARNING!");
                    if (!confirmDeleteAll) return;
                    const finalDeleteAllMessage = "Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR JOURNALS ON RECORD**?\n\nYou **cannot UNDO** this!"
                        + `\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
                    let finalConfirmDeleteAll = await fn.getUserConfirmation(bot, message, PREFIX, finalDeleteAllMessage, "Journal: Delete ALL Entries FINAL Warning!");
                    if (!finalConfirmDeleteAll) return;
                    console.log(`Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Entries`);
                    const allQuery = { userID: authorID };
                    await del.deleteManyAndConnectedReminders(Journal, allQuery);
                    return;
                }
                else return message.reply(journalActionHelpMessage);
            }
            else {
                const pastNumberOfEntriesIndex = parseInt(args[1]);
                let indexByRecency = false;
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var journalView;
                if (indexByRecency) journalView = await getOneJournalByRecency(authorID, pastNumberOfEntriesIndex - 1);
                else journalView = await getOneJournalByCreatedTime(authorID, pastNumberOfEntriesIndex - 1);
                if (!journalView) {
                    return fn.sendErrorMessageAndUsage(message, trySeeCommandMessage, `**JOURNAL ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                }
                const journalTargetID = journalView._id;
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const deleteConfirmMessage = `Are you sure you want to **delete Entry ${pastNumberOfEntriesIndex}?**`;
                const journalEmbed = fn.getEmbedArray(`__**Journal ${pastNumberOfEntriesIndex}:**__\n${journalDocumentToString(journalView)}`,
                    `Journal: Delete Entry ${pastNumberOfEntriesIndex} (${sortType})`, true, true, journalEmbedColour);
                const deleteConfirmation = await fn.getPaginatedUserConfirmation(bot, message, PREFIX, journalEmbed, deleteConfirmMessage, forceSkip,
                    `Journal: Delete Entry ${pastNumberOfEntriesIndex} (${sortType})`, 600000);
                if (deleteConfirmation) {
                    console.log(`Deleting ${authorUsername}'s (${authorID}) Entry ${sortType}`);
                    await del.deleteOneByIDAndConnectedReminders(Journal, journalTargetID);
                    return;
                }
            }
        }


        else if (journalCommand === "see" || journalCommand === "show") {
            let journalSeeUsageMessage = fn.getReadOrDeleteUsageMessage(PREFIX, commandUsed, journalCommand, true, ["Entry", "Entries"]);
            journalSeeUsageMessage = fn.getMessageEmbed(journalSeeUsageMessage, "Journal: See Help", journalEmbedColour);

            const seeCommands = ["past", "recent", "all"];

            if (journalType) {
                if (journalType === "help") {
                    return message.channel.send(journalSeeUsageMessage);
                }
                if (!totalJournalNumber) {
                    return message.reply(`**NO JOURNALS...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`);
                }
                else if (journalType === "number") {
                    return message.reply(`You have **${totalJournalNumber} journal entries** on record.`);
                }
            }
            else return message.reply(journalActionHelpMessage);

            // Show the user the last journal with the most recent end time (by sorting from largest to smallest end time and taking the first):
            // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort. 
            // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
            if (!seeCommands.includes(journalType) && isNaN(journalType)) {
                return message.reply(journalActionHelpMessage);
            }
            // Do not show the most recent journal embed, when a valid command is called
            // it will be handled properly later based on the values passed in!
            else {
                const seeType = journalType;
                var pastFunctionality,
                    pastNumberOfEntriesIndex;
                let indexByRecency = false;
                // To check if the given argument is a number!
                // If it's not a number and has passed the initial 
                // filter, then use the "past" functionality
                // Handling Argument 1:
                const isNumberArg = !isNaN(args[1]);
                if (seeType === "recent") {
                    return message.channel.send(await getMostRecentJournal(authorID, journalEmbedColour));
                }
                else if (seeType === "all") {
                    pastNumberOfEntriesIndex = totalJournalNumber;
                    pastFunctionality = true;
                }
                else if (isNumberArg) {
                    pastNumberOfEntriesIndex = parseInt(args[1]);
                    if (pastNumberOfEntriesIndex <= 0) {
                        return fn.sendErrorMessageAndUsage(message, journalActionHelpMessage, `**JOURNAL ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                    }
                    else pastFunctionality = false;
                }
                else if (seeType === "past") {
                    pastFunctionality = true;
                }
                // After this filter:
                // If the first argument after "see" is not past, then it is not a valid call
                else return message.reply(journalActionHelpMessage);
                console.log({ pastNumberOfEntriesIndex, pastFunctionality });
                if (pastFunctionality) {
                    // Loop through all of the given fields, account for aliases and update fields
                    // Find Entries, toArray, store data in meaningful output
                    if (args[3] !== undefined) {
                        if (args[3].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    if (args[2] !== undefined) {
                        // If the next argument is NotaNumber, invalid "past" command call
                        if (isNaN(args[2])) return message.reply(journalActionHelpMessage);
                        if (parseInt(args[2]) <= 0) return message.reply(journalActionHelpMessage);
                        const confirmSeeMessage = `Are you sure you want to **see ${args[2]} journals?**`;
                        let confirmSeeAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeeMessage, forceSkip, `Journal: See ${args[2]} Entries (${sortType})`);
                        if (!confirmSeeAll) return;
                    }
                    else {
                        // If the next argument is undefined, implied "see all" command call unless "all" was not called:
                        // => empty "past" command call
                        if (seeType !== "all") return message.reply(journalActionHelpMessage);
                        const confirmSeeAllMessage = "Are you sure you want to **see all** of your journal history?";
                        let confirmSeeAll = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeeAllMessage, forceSkip, "Journal: See All Entries");
                        if (!confirmSeeAll) return;
                    }
                    // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
                    if (pastNumberOfEntriesIndex === undefined) {
                        pastNumberOfEntriesIndex = parseInt(args[2]);
                    }
                    var journalView;
                    if (indexByRecency) journalView = await fn.getEntriesByRecency(Journal, { userID: authorID }, 0, pastNumberOfEntriesIndex);
                    else journalView = await getJournalByCreatedAt(authorID, 0, pastNumberOfEntriesIndex);
                    console.log({ journalView, pastNumberOfEntriesIndex });
                    const journalStringArray = multipleJournalsToString(message, journalView, pastNumberOfEntriesIndex, 0, true);
                    await fn.sendPaginationEmbed(bot, message.channel.id, authorID, fn.getEmbedArray(journalStringArray, `Journal: See ${pastNumberOfEntriesIndex} Entries (${sortType})`, true, true, journalEmbedColour));
                    return;
                }
                // see <PAST_#_OF_ENTRIES> <recent> past <INDEX>
                if (args[2] !== undefined) {
                    var shiftIndex;
                    if (args[2].toLowerCase() === "past") {
                        shiftIndex = 0;
                        indexByRecency = false;
                    }
                    else if (args[2].toLowerCase() === "recent") {
                        shiftIndex = 1;
                        indexByRecency = true;
                    }
                    if (args[2 + shiftIndex]) {
                        if (args[2 + shiftIndex].toLowerCase() === "past") {
                            if (args[3 + shiftIndex] !== undefined) {
                                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                                var entriesToSkip;
                                // If the argument after past is a number, valid command call!
                                if (!isNaN(args[3 + shiftIndex])) {
                                    entriesToSkip = parseInt(args[3 + shiftIndex]);
                                }
                                else if (args[3 + shiftIndex].toLowerCase() === "recent") {
                                    entriesToSkip = await getRecentJournalIndex(authorID);
                                }
                                else return message.reply(journalActionHelpMessage);
                                if (entriesToSkip < 0 || entriesToSkip > totalJournalNumber) {
                                    return fn.sendErrorMessageAndUsage(message, journalActionHelpMessage, "**JOURNAL(S) DO NOT EXIST**...");
                                }
                                const confirmSeePastMessage = `Are you sure you want to **see ${args[1]} entries past ${entriesToSkip}?**`;
                                const confirmSeePast = await fn.getUserConfirmation(bot, message, PREFIX, confirmSeePastMessage, forceSkip, `Journal: See ${args[1]} Entries Past ${entriesToSkip} (${sortType})`);
                                if (!confirmSeePast) return;
                                var journalView;
                                if (indexByRecency) journalView = await fn.getEntriesByRecency(Journal, { userID: authorID }, entriesToSkip, pastNumberOfEntriesIndex);
                                else journalView = await getJournalByCreatedAt(authorID, entriesToSkip, pastNumberOfEntriesIndex);
                                console.log({ journalView });
                                const journalStringArray = multipleJournalsToString(message, journalView, pastNumberOfEntriesIndex, entriesToSkip, true);
                                await fn.sendPaginationEmbed(bot, message.channel.id, authorID, fn.getEmbedArray(journalStringArray, `Journal: See ${pastNumberOfEntriesIndex} Entries Past ${entriesToSkip} (${sortType})`, true, true, journalEmbedColour));
                                return;
                            }
                        }
                    }
                }
                if (args[2] !== undefined) {
                    if (args[2].toLowerCase() === "recent") {
                        indexByRecency = true;
                    }
                }
                var journalView;
                if (indexByRecency) journalView = await getOneJournalByRecency(authorID, pastNumberOfEntriesIndex - 1);
                else journalView = await getOneJournalByCreatedTime(authorID, pastNumberOfEntriesIndex - 1);
                console.log({ journalView });
                if (!journalView) {
                    return fn.sendErrorMessage(message, `**JOURNAL ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                }
                // NOT using the past functionality:
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const journalString = `__**Journal ${pastNumberOfEntriesIndex}:**__\n${journalDocumentToString(journalView)}`;
                const journalEmbed = fn.getEmbedArray(journalString, `Journal: See Entry ${pastNumberOfEntriesIndex} (${sortType})`, true, true, journalEmbedColour);
                await fn.sendPaginationEmbed(bot, message.channel.id, authorID, journalEmbed);
            }
        }


        else if (journalCommand === "edit" || journalCommand === "ed" || journalCommand === "change" || journalCommand === "c"
            || journalCommand === "update" || journalCommand === "upd" || journalCommand === "ch") {
            let journalEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${journalCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\``
                + "\n\n`<#_MOST_RECENT_ENTRY>`: **recent; 3** (3rd most recent entry, \\**any number*)"
                + "\n\n`<recent?>`(OPT.): type **recent** at the indicated spot to sort the journals by **actual time created instead of journal created time!**"
                + "\n\n`<force?>`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**";
            journalEditUsageMessage = fn.getMessageEmbed(journalEditUsageMessage, `Journal: Edit Help`, journalEmbedColour);
            if (journalType) {
                if (journalType === "help") {
                    return message.channel.send(journalEditUsageMessage);
                }
                if (!totalJournalNumber) {
                    return message.reply(`**NO JOURNALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`);
                }
                if (isNaN(journalType) && journalType !== "recent") {
                    return message.reply(journalActionHelpMessage);
                }
                else {
                    var pastNumberOfEntriesIndex;
                    if (journalType === "recent") {
                        pastNumberOfEntriesIndex = await getRecentJournalIndex(authorID);
                    }
                    else {
                        pastNumberOfEntriesIndex = parseInt(journalType);
                        if (pastNumberOfEntriesIndex <= 0) {
                            return fn.sendErrorMessageAndUsage(message, journalActionHelpMessage, `**JOURNAL ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                        }
                    }
                    var indexByRecency = false;
                    if (args[2] !== undefined) {
                        if (args[2].toLowerCase() === "recent") {
                            indexByRecency = true;
                        }
                    }
                    var journalDocument;
                    if (indexByRecency) journalDocument = await getOneJournalByRecency(authorID, pastNumberOfEntriesIndex - 1);
                    else journalDocument = await getOneJournalByCreatedTime(authorID, pastNumberOfEntriesIndex - 1);
                    if (!journalDocument) {
                        return fn.sendErrorMessageAndUsage(message, journalActionHelpMessage, `**JOURNAL ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`);
                    }
                    const sortType = indexByRecency ? "By Recency" : "By Date Created";
                    const { template } = journalDocument;
                    if (!template) return;
                    let journalFields = ["Created Date"];
                    switch (template) {
                        case 1:
                            journalFields = journalFields.concat(["Gratitudes", "Actions/Mindsets for Great Day", "Affirmations", "Amazing Things", "Retrospective Better Day"]);
                            break;
                        case 2:
                            journalFields = journalFields.concat(["Prompt", "Entry"]);
                            break;
                        case 3:
                            journalFields = journalFields.concat(["Entry"]);
                            break;
                        default: return;
                    }
                    const journalTargetID = journalDocument._id;
                    var showJournal, continueEdit;
                    do {
                        const checkJournal = await getOneJournalByObjectID(journalTargetID);
                        if (!checkJournal) return;
                        continueEdit = false;
                        showJournal = journalDocumentToString(journalDocument);
                        // Field the user wants to edit
                        const fieldToEditInstructions = "**Which field do you want to edit?**";
                        const fieldToEditAdditionalMessage = `__**Journal ${pastNumberOfEntriesIndex} (${sortType}):**__\n${showJournal}`;
                        const fieldToEditTitle = `Journal: Edit Field`;
                        var fieldToEdit, fieldToEditIndex;
                        const selectedField = await fn.getUserSelectedObject(bot, message, PREFIX,
                            fieldToEditInstructions, fieldToEditTitle, journalFields, "", false,
                            journalEmbedColour, 600000, 0, fieldToEditAdditionalMessage);
                        if (!selectedField) return;
                        else {
                            fieldToEdit = selectedField.object;
                            fieldToEditIndex = selectedField.index;
                        }

                        var userEdit, journalEditMessagePrompt = "";
                        const type = "Journal";
                        let { entry, createdAt } = journalDocument;

                        if (fieldToEditIndex === 0) {
                            journalEditMessagePrompt = `**__Please enter the date and time when this journal entry was created:__** ⌚\n${timeExamples}`;
                            userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                        }
                        else switch (template) {
                            case 1: {
                                switch (fieldToEditIndex) {
                                    case 1: {
                                        journalEditMessagePrompt = `\nWhat are **3** things you are **truly __grateful__** for? 🙏\n(big or small)`;
                                        userEdit = await fn.getUserMultilineEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                                        entry.gratitudes = userEdit;
                                    }
                                        break;
                                    case 2: {
                                        journalEditMessagePrompt = `\nWhat are **3 __actions or mindset shifts__** that would make **today great**? 🧠`;
                                        userEdit = await fn.getUserMultilineEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                                        entry.actions = userEdit;
                                    }
                                        break;
                                    case 3: {
                                        journalEditMessagePrompt = `\nComplete the affirmation:\n\n**__I am...__**`;
                                        userEdit = await fn.getUserMultilineEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                                        entry.affirmations = userEdit;
                                    }
                                        break;
                                    case 4: {
                                        journalEditMessagePrompt = `\nList **3 __amazing__** things that happened today ☘ (big or small)`;
                                        userEdit = await fn.getUserMultilineEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                                        entry.amazing = userEdit;
                                    }
                                        break;
                                    case 5: {
                                        journalEditMessagePrompt = `\n**__How could you have made today better?__** 📈\n\ne.g. **__Retrospective Journal:__**`
                                            + "\n**__CM__** - **Critical Moment** of suboptimal behaviour/action. 👀\n**__X__** - The **rationalization/thought pattern** behind it. 🧠"
                                            + "\n**__\\\$__** - How you want to **think** next time! 🤔💭\n\n[From *Metascript Method* - by Mark Queppet]";
                                        userEdit = await fn.getUserMultilineEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                                        entry.betterDay = userEdit;
                                    }
                                        break;
                                }
                            }
                                break;
                            case 2: {
                                switch (fieldToEditIndex) {
                                    case 1: {
                                        journalEditMessagePrompt = "\n**Enter the __question or prompt__ you'd like to explore and answer 💭**: ";
                                        userEdit = await fn.getUserEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                                        entry.prompt = userEdit;
                                    }
                                        break;
                                    case 2: {
                                        journalEditMessagePrompt = `\n${entry.prompt || "**Enter your new answer to the prompt ✍:**"}`;
                                        userEdit = await fn.getUserMultilineEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                                        entry.message = userEdit;
                                    }
                                        break;
                                    default: return;
                                }
                            }
                                break;
                            case 3: {
                                journalEditMessagePrompt = "\n**__Enter your new journal entry__**✍: ";
                                userEdit = await fn.getUserMultilineEditString(bot, message, PREFIX, fieldToEdit, journalEditMessagePrompt, type, forceSkip, journalEmbedColour);
                                entry.message = userEdit;
                                break;
                            }
                            default: return;
                        }

                        console.log({ userEdit });
                        if (userEdit === false) return;
                        else if (userEdit === undefined) userEdit = "back";
                        else if (userEdit !== "back") {
                            // Parse User Edit
                            if (fieldToEditIndex === 0) {
                                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                                console.log({ userEdit });
                                const now = Date.now();
                                userEdit = fn.timeCommandHandlerToUTC(userEdit, now, timezoneOffset, daylightSaving);
                                if (!userEdit) {
                                    fn.sendReplyThenDelete(message, `**INVALID TIME**... Try** \`${PREFIX}date\` **for help with **dates and times!**`, 60000);
                                    continueEdit = true;
                                }
                                else userEdit -= HOUR_IN_MS * timezoneOffset;
                                createdAt = userEdit;
                            }
                        }
                        else continueEdit = true;
                        console.log({ userEdit });

                        if (!continueEdit) {
                            try {
                                console.log(`Editing ${authorID}'s Journal ${pastNumberOfEntriesIndex} (${sortType})`);
                                if (fieldToEditIndex === 0) {
                                    journalDocument = await Journal.findOneAndUpdate({ _id: journalTargetID }, { $set: { createdAt } }, { new: true });
                                }
                                else journalDocument = await Journal.findOneAndUpdate({ _id: journalTargetID }, { $set: { entry } }, { new: true });
                                console.log({ continueEdit });
                                if (journalDocument) {
                                    pastNumberOfEntriesIndex = indexByRecency ?
                                        await fn.getEntryIndexByFunction(authorID, journalTargetID, totalJournalNumber, getOneJournalByRecency)
                                        : await fn.getEntryIndexByFunction(authorID, journalTargetID, totalJournalNumber, getOneJournalByCreatedTime);
                                    console.log({ journalDocument, journalTargetID, fieldToEditIndex });
                                    showJournal = journalDocumentToString(journalDocument);
                                    const continueEditMessage = `Do you want to continue **editing Journal ${pastNumberOfEntriesIndex}?:**\n\n__**Journal ${pastNumberOfEntriesIndex}:**__\n${showJournal}`;
                                    continueEdit = await fn.getUserConfirmation(bot, message, PREFIX, continueEditMessage, forceSkip, `Journal: Continue Editing Journal ${pastNumberOfEntriesIndex}?`, 300000);
                                }
                                else {
                                    message.reply("**Journal not found...**");
                                    continueEdit = false;
                                }
                            }
                            catch (err) {
                                return console.log(err);
                            }
                        }
                        else {
                            console.log({ continueEdit, userEdit });
                            journalDocument = await Journal.findById(journalTargetID);
                            if (journalDocument) {
                                pastNumberOfEntriesIndex = indexByRecency ?
                                    await fn.getEntryIndexByFunction(authorID, journalTargetID, totalJournalNumber, getOneJournalByRecency)
                                    : await fn.getEntryIndexByFunction(authorID, journalTargetID, totalJournalNumber, getOneJournalByCreatedTime);
                                console.log({ journalDocument, journalTargetID, fieldToEditIndex });
                                showJournal = journalDocumentToString(journalDocument);
                            }
                            else {
                                message.reply("**Journal not found...**");
                                continueEdit = false;
                            }
                        }
                    }
                    while (continueEdit === true);
                    return;
                }
            }
            else return message.reply(journalActionHelpMessage);
        }

        else if (journalCommand === "post" || journalCommand === "p") {
            if (!totalJournalNumber) return message.reply(`**No journal entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`);
            if (args[1] !== undefined) {
                let journalIndex = isNaN(args[1]) ? args[1].toLowerCase() : parseInt(args[1]);
                let indexByRecency = false;
                if (journalIndex === "recent") {
                    journalIndex = 1;
                    indexByRecency = true;
                }
                else if (args[2] !== undefined) {
                    if (isNaN(args[2])) {
                        if (args[2].toLowerCase === "recent") {
                            indexByRecency = true;
                        }
                    }
                }
                else if (isNaN(args[1])) return message.reply(`**Please enter a number or \"recent\" after \`${PREFIX}${commandUsed} ${journalCommand} <# | recent>\`**`);
                journalIndex--;
                if (journalIndex < 0 || journalIndex >= totalJournalNumber) {
                    return message.reply(`**Journal ${journalIndex + 1} does not exist**`);
                }
                var journal;
                if (indexByRecency) journal = await getOneJournalByRecency(authorID, journalIndex);
                else journal = await getOneJournalByCreatedTime(authorID, journalIndex);
                const sortType = indexByRecency ? "By Recency" : "By Date Created";
                const targetChannel = await fn.getTargetChannel(bot, message, PREFIX, `Journal ${sortType}`,
                forceSkip, true, false, true, journalEmbedColour);
                if (!targetChannel) return;
                const member = bot.guilds.cache.get(guildID).member(authorID);
                const posts = fn.getEmbedArray(journalDocumentToString(journal), `${member ? `${member.displayName}'s ` : ""}Journal Entry`
                    + ` - ${fn.timestampToDateString(journal.createdAt, false, true, true)}`, true, false, journalEmbedColour);
                posts.forEach(async post => {
                    await fn.sendMessageToChannel(bot, post, targetChannel);
                });
            }
            else message.channel.send(journalActionHelpMessage);
        }


        // SHOWS WEEKLY JOURNAL TEMPLATES!
        else if (journalCommand === "template" || journalCommand === "templates" || journalCommand === "temp" || journalCommand === "t") {
            let templateUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${journalCommand} <DAILY/WEEKLY> <TYPE?>\``
                + "\n\n`<DAILY/WEEKLY>`: **daily/d; weekly/w**"
                + "\n\n`<TYPE?>`: (OPT.)\nIf `daily`: **morning/m; night/n**\nIf `weekly`: **reflection/r; goals/g**";
            templateUsageMessage = fn.getMessageEmbed(templateUsageMessage, "Journal: Template Help", journalEmbedColour);
            const templateHelpMessage = `Try \`${PREFIX}${commandUsed} ${journalCommand} help\``;
            let journalTemplate = getJournalTemplate(args, true, journalEmbedColour);
            if (journalType === "help") return message.channel.send(templateUsageMessage);
            else if (!journalTemplate) return message.reply(templateHelpMessage);
            else return message.channel.send(journalTemplate);
        }


        else return message.reply(journalHelpMessage);
    }
};
