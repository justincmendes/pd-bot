// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const User = require("../database/schemas/user");
const Guild = require("../database/schemas/guildsettings");
const Mastermind = require("../database/schemas/mastermind");
const Goal = require("../database/schemas/longtermgoals");
const Habit = require("../database/schemas/habit");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const hb = require("../../utilities/habit");
const del = require("../../utilities/deletion");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const timeExamples = fn.timeExamples;
const mastermindMax = fn.mastermindMaxTier1;
const mastermindEmbedColour = fn.mastermindEmbedColour;
const areasOfLifeEmojis = fn.areasOfLifeEmojis;
const areasOfLife = fn.areasOfLife;
const daysOfWeek = fn.daysOfWeek;
const areasOfLifeCombinedEmoji = fn.getAreasOfLifeEmojiCombinedArray();
const areasOfLifeList = fn.getAreasOfLifeList().join("\n");

// Function Declarations and Initializations
// Use WeeklyJournalEntry function to create empty entries and format in backticks for Discord markdown

// FUTURE FEATURE: Create .txt file with FULL entry and react with paperclip for user to download the file

async function sendGeneratedTemplate(
  bot,
  message,
  numberOfUsers,
  namesForTemplate,
  withMarkdown = true,
  templateEmbedColour = mastermindEmbedColour
) {
  const date = new Date();
  let templateArray = new Array();
  for (templateIndex = 0; templateIndex < numberOfUsers; templateIndex++) {
    if (namesForTemplate[templateIndex] == undefined) {
      namesForTemplate.push(`NAME_${templateIndex + 1}`);
    }
    if (templateIndex === 0) {
      templateArray.push(
        `\`**__${date.toString()}__**\`\n\n${fn.mastermindWeeklyJournalEntry(
          namesForTemplate[templateIndex],
          withMarkdown
        )}`
      );
    } else
      templateArray.push(
        fn.mastermindWeeklyJournalEntry(
          namesForTemplate[templateIndex],
          withMarkdown
        )
      );
  }
  await fn.sendPaginationEmbed(
    bot,
    message.channel.id,
    message.author.id,
    fn.getEmbedArray(
      templateArray,
      "Mastermind: Weekly Reflection And Goals Template",
      true,
      "Mastermind Weekly Reflection and Weekly Goals Template",
      templateEmbedColour
    )
  );
}

async function getOneMastermindByCreatedTime(userID, mastermindIndex) {
  const mastermind = await Mastermind.findOne({ userID })
    .sort({ createdAt: -1 })
    .skip(mastermindIndex)
    .catch((err) => {
      console.log(err);
      return false;
    });
  return mastermind;
}

async function getOneMastermindByRecency(userID, mastermindIndex) {
  const mastermind = await Mastermind.findOne({ userID })
    .sort({ _id: -1 })
    .skip(mastermindIndex)
    .catch((err) => {
      console.log(err);
      return false;
    });
  return mastermind;
}

async function getOneMastermindByObjectID(mastermindTargetID) {
  try {
    const entries = await Mastermind.findById(mastermindTargetID);
    console.log(entries);
    return entries;
  } catch (err) {
    console.log(err);
    return false;
  }
}

function mastermindDocumentToString(bot, mastermindDoc) {
  const {
    userID,
    createdAt,
    createdBy,
    guildID,
    usedTemplate,
    journal,
  } = mastermindDoc;
  const guildString = guildID
    ? `\n**Server:** ${bot.guilds.cache.get(guildID).name}`
    : "";
  // const guild = bot.guilds.cache.get(guildID);
  // ${guild.member(createdBy).displayName}
  const username = `<@!${userID}>`;
  const creatorUsername = `<@!${createdBy}>`;
  var entryString;
  if (usedTemplate) {
    const {
      observations,
      areaOfLife,
      stopEntry,
      startEntry,
      continueEntry,
      goals,
    } = journal;
    entryString = fn.mastermindWeeklyJournalEntry(
      false,
      false,
      observations,
      areaOfLife,
      stopEntry,
      startEntry,
      continueEntry,
      goals
    );
  } else entryString = journal.entry;
  entryString = fn.getRoleMentionToTextString(bot, entryString);
  return (
    `**User:** ${username}\n**Created At:** ${fn.timestampToDateString(
      createdAt
    )}` +
    guildString +
    `\n**Created By:** ${creatorUsername}\n\n${entryString}`
  );
}

function multipleMastermindsToString(
  bot,
  message,
  mastermindArray,
  numberOfMasterminds,
  entriesToSkip = 0,
  toArray = false
) {
  var entriesToString = new Array();
  console.log({ numberOfMasterminds });
  for (let i = 0; i < numberOfMasterminds; i++) {
    if (mastermindArray[i] === undefined) {
      numberOfMasterminds = i;
      fn.sendErrorMessage(
        message,
        `**MASTERMINDS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`
      );
      break;
    }
    const mastermindString = `__**Mastermind ${
      i + entriesToSkip + 1
    }:**__\n${mastermindDocumentToString(bot, mastermindArray[i])}`;
    entriesToString.push(mastermindString);
  }
  if (!toArray) entriesToString = entriesToString.join("\n\n");
  return entriesToString;
}

async function getMostRecentMastermind(
  bot,
  userID,
  embedColour = mastermindEmbedColour
) {
  const recentMastermindToString = `__**Mastermind ${await getRecentMastermindIndex(
    userID
  )}:**__\n${mastermindDocumentToString(
    bot,
    await getOneMastermindByRecency(userID, 0)
  )}`;
  const mastermindEmbed = fn.getMessageEmbed(
    recentMastermindToString,
    `Mastermind: See Recent Entry`,
    embedColour
  );
  return mastermindEmbed;
}

async function getRecentMastermindIndex(userID) {
  try {
    var index;
    const entries = await Mastermind.find({ userID }).sort({ createdAt: -1 });
    if (entries.length) {
      let targetID = await Mastermind.findOne({ userID }).sort({ _id: -1 });
      targetID = targetID._id.toString();
      console.log({ targetID });
      for (let i = 0; i < entries.length; i++) {
        if (entries[i]._id.toString() === targetID) {
          index = i + 1;
          return index;
        }
      }
    } else return -1;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function getMastermindByCreatedAt(
  userID,
  entryIndex,
  numberOfEntries = 1
) {
  try {
    const entries = await Mastermind.find({ userID })
      .sort({ createdAt: -1 })
      .limit(numberOfEntries)
      .skip(entryIndex);
    return entries;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function setMastermindWeeklyGoalReminder(
  bot,
  userID,
  reminderEndTime,
  weeklyGoals,
  mastermindCreatedTime,
  mastermindID,
  recurrences
) {
  const reminderString = fn.goalArrayToString(
    weeklyGoals,
    "Weekly",
    true,
    true,
    false
  );
  const weekOfString = fn.timestampToDateString(
    mastermindCreatedTime,
    false,
    true,
    true
  )
    ? ` (Week of ${fn.timestampToDateString(
        mastermindCreatedTime,
        false,
        true,
        true
      )})`
    : "";
  const titleString = `Mastermind: Weekly Goals${weekOfString}`;
  await rm.setNewDMReminder(
    bot,
    userID,
    Date.now(),
    reminderEndTime,
    reminderString || "",
    titleString,
    true,
    mastermindID,
    true,
    "1 day",
    recurrences || undefined,
    mastermindEmbedColour
  );
}

async function setUserMastermindReminder(
  bot,
  message,
  PREFIX,
  timezoneOffset,
  daylightSaving,
  mastermindDocument
) {
  let endTime = await fn.getDateAndTimeEntry(
    bot,
    message,
    PREFIX,
    timezoneOffset,
    daylightSaving,
    "**When** do you want your **first weekly goal reminder?**\n(Recommended: `tomorrow at 12pm` or `tom at 8a`)",
    "Mastermind: Weekly Goals Daily Reminder Time of Day",
    true,
    mastermindEmbedColour
  );
  if (!endTime && endTime !== 0) return false;
  else endTime -= HOUR_IN_MS * timezoneOffset;
  var repetitions = await fn.getNumberEntry(
    bot,
    message,
    PREFIX,
    `**How many times** do you want to be **reminded?** (1 per day)\n\nEnter a whole number, or \`0\` if you want to continue being **reminded indefinitely.**\n(You can always use \`${PREFIX}repeat edit recent\` or \`${PREFIX}repeat delete recent\`)\n\n(Recommended: \`7\` or \`14\` - for a full week or two of goal reminders until next mastermind)`,
    "Mastermind: Weekly Goals Daily Reminder Repetitions",
    true,
    false,
    false,
    0,
    undefined,
    mastermindEmbedColour
  );
  if (!repetitions && repetitions !== 0) return false;
  if (repetitions === 0) repetitions = undefined;
  console.log({ repetitions });
  const mastermindReminders = await getCurrentMastermindReminders(
    message.author.id
  );
  if (mastermindReminders)
    if (mastermindReminders.length) {
      const confirmOverride = await fn.getUserConfirmation(
        bot,
        message,
        PREFIX,
        `Do you want to **cancel** any **older Mastermind reminders** that are **currently ongoing**?\n(There are currently **${mastermindReminders.length} reminder(s)** ongoing)`,
        false,
        "Mastermind: Weekly Goals Daily Reminder Override"
      );
      if (confirmOverride) {
        await deleteCurrentMastermindReminders(message.author.id);
      }
    }
  await setMastermindWeeklyGoalReminder(
    bot,
    message.author.id,
    endTime,
    mastermindDocument.journal.goals,
    mastermindDocument.createdAt,
    mastermindDocument._id,
    repetitions
  );
  return true;
}

async function getCurrentMastermindReminders(userID) {
  try {
    const userReminders = await Reminder.find({ userID });
    var mastermindReminders = new Array();
    if (userReminders)
      if (userReminders.length) {
        userReminders.forEach(async (reminder) => {
          if (reminder.title.startsWith("Mastermind: Weekly Goals")) {
            mastermindReminders.push(reminder);
          }
        });
      }
    return mastermindReminders;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function deleteCurrentMastermindReminders(userID) {
  try {
    const mastermindReminders = await getCurrentMastermindReminders(userID);
    var foundOneReminder = null;
    if (mastermindReminders)
      if (mastermindReminders.length) {
        foundOneReminder = true;
        mastermindReminders.forEach(async (reminder) => {
          rm.cancelReminderById(reminder._id);
          await Reminder.findByIdAndDelete(reminder._id);
        });
      }
    return foundOneReminder;
  } catch (err) {
    console.log(err);
    return false;
  }
}

module.exports = {
  name: "mastermind",
  description: "Mastermind Meeting/Group Helper",
  aliases: ["m", "mm", "mas", "mast", "master", "masterminds"],
  cooldown: 1.5,
  args: true,
  run: async function run(
    bot,
    message,
    commandUsed,
    args,
    PREFIX,
    timezoneOffset,
    daylightSaving,
    forceSkip
  ) {
    // Will allow for text collection of notes during meeting and output it in a nice format!
    // Allow users with the mastermind facilitator role to press the pencil and edit the sent message!
    // User's with mastermind role can ADD TO ANYONE'S ENTRIES! **be careful**
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

    // Post, Edit, start/create, delete

    // Variable Declarations and Initializations
    let mastermindUsageMessage =
      `**USAGE:**\n\`${PREFIX}${commandUsed} <ACTION>\`` +
      `\n\n\`<ACTION>\`: **start/s; delete/d; edit; post/p; template/t; reminder;r; habit/h**\n\n*__ALIASES:__* **${
        this.name
      } - ${this.aliases.join("; ")}**`;
    mastermindUsageMessage = fn.getMessageEmbed(
      mastermindUsageMessage,
      "Mastermind: Help",
      mastermindEmbedColour
    );
    const mastermindHelpMessage = `Try \`${PREFIX}${commandUsed} help\`...`;
    const mastermindCommand = args[0].toLowerCase(); // Args are expected to be defined!
    if (mastermindCommand === "help")
      return message.channel.send(mastermindUsageMessage);

    const mastermindType = args[1] ? args[1].toLowerCase() : false;
    const authorID = message.author.id;
    const authorUsername = message.author.username;
    const userSettings = await User.findOne({ discordID: authorID });
    const { tier } = userSettings;
    let guildID = message.channel.type === "dm" ? undefined : message.guild.id;
    const isInGuild = !!guildID;
    const totalMastermindNumber = await Mastermind.find({
      userID: authorID,
    }).countDocuments();
    const mastermindActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${mastermindCommand} help\``;
    if (
      mastermindCommand === "start" ||
      mastermindCommand === "st" ||
      mastermindCommand === "s" ||
      mastermindCommand === "set" ||
      mastermindCommand === "create" ||
      mastermindCommand === "c" ||
      mastermindCommand === "make" ||
      mastermindCommand === "m" ||
      mastermindCommand === "add" ||
      mastermindCommand === "a"
    ) {
      /**
       * 0. If they are not premium and they've reached the max number of entries, limit them!
       *
       * 1. Check if the user has the mastermind facilitator role: prompt them to enter the name of ther person
       * they are making the entry for - if it's themselves they can type me/myself
       * -- allow them to enter the user similar to how the pester function works (maybe make it a universal function)
       *
       * 2. Dive right into the first prompt 1. Previous Week's Assessment (Multiple line entry)
       * 1 when finished and stop to stop (OR instead of stop 🛑- react with an emoji and create a reaction collector)
       *
       * 3. continue to the rest of the prompts. Add in the footer - you can make changes to it at the end before submitting
       *
       * 4. Confirm that the document is good to go - give them the list of prompts they have answered from userSelectFromList()
       * -- otherwise type done to finish. (this will be its own function, with similar functionality to the userSelectFromList with text support)
       * ---- or utilise another function and if they type
       * ---- when going back show the user the previous entry so that they have a reference (then include the current edit)
       *
       * 5. Send confirmation reply that the entry for *username* on (now in guild local time) -- 09/21/2020 5:46:32PM -04:00/EST/PST...-- was collected!
       * IF the user is self-creating - say that "your entry was collected (time in user local time)"
       *
       * 6. POST: Ask if they would like to post it to a specific channel.
       * Footer: if they want to post it to multiple channels they can do so as well! By ?PREFIX commandused post recent
       */

      // 0. Limit Entries
      if (tier === 1) {
        if (totalMastermindNumber >= mastermindMax) {
          return message.channel.send(
            fn
              .getMessageEmbed(
                fn.getTierMaxMessage(
                  PREFIX,
                  commandUsed,
                  mastermindMax,
                  ["Mastermind", "Masterminds"],
                  1,
                  false
                ),
                `Mastermind: Tier 1 Maximum`,
                mastermindEmbedColour
              )
              .setFooter(fn.premiumFooterText)
          );
        }
      }

      // 1. Check if the user has the mastermind facilitator role: prompt them to enter the name of the person
      // they are making the entry for - if it's themselves they can type me/myself
      // -- allow them to enter the user similar to how the pester function works (maybe make it a universal function)
      var targetUser;
      if (isInGuild) {
        const guildSettings = await Guild.findOne({ guildID });
        const mastermindRoles = guildSettings
          ? guildSettings.mastermind.roles
          : null;
        if (mastermindRoles) {
          const permissions = message.guild
            .member(authorID)
            .roles.cache.some((role) => mastermindRoles.includes(role));
          if (permissions) {
            let chooseUser = await fn.messageDataCollect(
              bot,
              message,
              PREFIX,
              "**Who are you writing the mastermind weekly reflection for?**\n(Type `me` or `myself` if it's you)",
              "Mastermind Entry: User",
              mastermindEmbedColour,
              60000
            );
            if (!chooseUser || chooseUser === "stop") return;
            chooseUser = chooseUser.toLowerCase();
            if (chooseUser === "me" || chooseUser === "myself") {
              targetUser = authorID;
            } else {
              const guild = bot.guilds.cache.get(guildID);
              const allMembers = guild.members.cache.map(
                (member) => member.user
              );
              targetUser = fn.getIDArrayFromNames(
                chooseUser,
                allMembers,
                guild
              );
              if (!targetUser)
                return message.reply(
                  `**No users in __${guild.name}__ exist on file...**`
                );
              else if (targetUser.length === 0) {
                return message.channel.send(
                  fn.getMessageEmbed(
                    `Could not find user \"**${chooseUser}**\" (${mastermindActionHelpMessage})`,
                    "Mastermind Entry: User",
                    mastermindEmbedColour
                  )
                );
              }
              targetUser = targetUser[0];
              if (guild.member(targetUser).user.bot) {
                return message.channel.send(
                  fn.getMessageEmbed(
                    `**You __cannot__ create entries for 🤖 bots (non-users): <@!${targetUser}>**`,
                    "Mastermind Entry: User",
                    mastermindEmbedColour
                  )
                );
              }
            }
          }
        }
      }
      if (!targetUser) targetUser = authorID;
      console.log({ targetUser });

      // 1.5. Check if the user wants to use the template or not
      const thumbsUp = "👍";
      const thumbsDown = "👎";
      let userWantsTemplate = await fn.reactionDataCollect(
        bot,
        message,
        `**Would you like to use a mastermind reflection __template__  ${thumbsUp} or __not__ ${thumbsDown}?**`,
        [thumbsUp, thumbsDown],
        "Mastermind Entry: Template?",
        mastermindEmbedColour
      );
      switch (userWantsTemplate) {
        case thumbsUp:
          userWantsTemplate = true;
          break;
        case thumbsDown:
          userWantsTemplate = false;
          break;
        default:
          userWantsTemplate = null;
          break;
      }

      // 2. Create a function for the data collection loop function.
      var mastermindDocument, targetUserTimezoneOffset, targetUserTimezone;
      const targetUserSettings = await User.findOne({ discordID: targetUser });

      // Create new User Settings - can be changed by the user themselves if it's incorrect!
      if (!targetUserSettings) {
        const timezone = await fn.getNewUserTimezoneSettings(
          bot,
          message,
          PREFIX,
          targetUser
        );
        await fn.createUserSettings(bot, targetUser, timezone);
        targetUserTimezoneOffset = timezone.offset;
        targetUserTimezone = timezone.name;
      } else {
        targetUserTimezoneOffset = targetUserSettings.timezone.offset;
        targetUserTimezone = targetUserSettings.timezone.name;
      }

      if (userWantsTemplate) {
        let observations = await fn.getMultilineEntry(
          bot,
          message,
          PREFIX,
          "**__Look back at the previous week ↩:__**\n**- 📈 How much did you stick to your habits and/or progress on your goals this week?\n- 💭 Make 3 observations.**",
          "Mastermind Entry: Observations",
          true,
          mastermindEmbedColour
        );
        observations = observations.message;
        console.log({ observations });
        if (!observations && observations !== "") return;

        const areaOfLifeIndex = await fn.userSelectFromList(
          bot,
          message,
          PREFIX,
          areasOfLifeList,
          areasOfLife.length,
          "**__Which area of life needs the most attention this week? 🌱__**",
          "Mastermind Entry: Area of Life Assessment",
          mastermindEmbedColour
        );
        console.log({ areaOfLifeIndex });
        if (!areaOfLifeIndex && areaOfLifeIndex !== 0) return;

        const areaOfLifeReason = await fn.getSingleEntryWithCharacterLimit(
          bot,
          message,
          PREFIX,
          `**Why does ${areasOfLifeEmojis[areaOfLifeIndex]} __${areasOfLife[areaOfLifeIndex]}__ need the most attention this week?**\n(Within 1000 characters)`,
          "Mastermind Entry: Area of Life Assessment",
          1000,
          "an area of life reason",
          forceSkip,
          mastermindEmbedColour
        );
        console.log({ areaOfLifeReason });
        if (!areaOfLifeReason && areaOfLifeReason !== "") return;

        const stopEntry = await fn.getSingleEntryWithCharacterLimit(
          bot,
          message,
          PREFIX,
          "**What do you want to __stop__ doing this week?**\n(Within 1000 characters)",
          "Mastermind Entry: Stop",
          1000,
          "a stop reflection",
          forceSkip,
          mastermindEmbedColour
        );
        console.log({ stopEntry });
        if (!stopEntry && stopEntry !== "") return;

        const startEntry = await fn.getSingleEntryWithCharacterLimit(
          bot,
          message,
          PREFIX,
          "**What do you want to __start__ doing this week?**\n(Within 1000 characters)",
          "Mastermind Entry: Start",
          1000,
          "a start reflection",
          forceSkip,
          mastermindEmbedColour
        );
        console.log({ startEntry });
        if (!startEntry && startEntry !== "") return;

        const continueEntry = await fn.getSingleEntryWithCharacterLimit(
          bot,
          message,
          PREFIX,
          "**What went well this past week that you want to __continue__ doing for this week?**\n(Within 1000 characters)",
          "Mastermind Entry: Continue",
          1000,
          "a continue reflection",
          forceSkip,
          mastermindEmbedColour
        );
        console.log({ continueEntry });
        if (!continueEntry && continueEntry !== "") return;

        let goalCount = 1;
        var weeklyGoals = new Array();
        do {
          const weeklyGoalEntryTitle = `Mastermind Entry: Weekly Goal ${goalCount}`;
          const completionInstructions = `${
            goalCount !== 1
              ? goalCount === 2
                ? `Type \`set\` to **submit** all goals entered so far (**Goal ${
                    goalCount - 1
                  }**)`
                : `Type \`set\` to **submit** all goals entered so far (**Goals 1-${
                    goalCount - 1
                  }**)`
              : `Type \`set\` to **skip** entering any goals`
          }\nType \`reset\` to **reset** all of your current **weekly goals**`;
          const completionKeywords = ["set", "reset"];
          const weeklyGoalDescription = await fn.getSingleEntryWithCharacterLimit(
            bot,
            message,
            PREFIX,
            `**🎯 What is __Goal #${goalCount}__ of this week's goals?**\n(Within 100 characters)\n\n*Write a brief description of your weekly goal (in very simple terms), you will get into the specifics in the next few pages.*`,
            weeklyGoalEntryTitle,
            100,
            "a goal",
            forceSkip,
            mastermindEmbedColour,
            completionInstructions,
            completionKeywords
          );
          if (!weeklyGoalDescription && weeklyGoalDescription !== "") return;
          else if (weeklyGoalDescription === "set") break;
          else if (weeklyGoalDescription === "reset") {
            goalCount = 1;
            weeklyGoals = new Array();
            continue;
          }

          const goalDescriptionString = `__**Goal #${goalCount}:**__${
            weeklyGoalDescription === "" ? "" : `\n${weeklyGoalDescription}`
          }`;
          const weeklyGoalType = await fn.userSelectFromList(
            bot,
            message,
            PREFIX,
            `${areasOfLifeList}\n\n${goalDescriptionString}`,
            areasOfLife.length,
            `**__Which area of life does Goal #${goalCount} fall under?__**`,
            weeklyGoalEntryTitle,
            mastermindEmbedColour
          );
          if (!weeklyGoalType && weeklyGoalType !== 0) return;

          const goalTypeString = `__**Type:**__ ${areasOfLifeEmojis[weeklyGoalType]} ${areasOfLife[weeklyGoalType]}`;

          const weeklyGoalSpecifics = await hb.getHabitSpecifics(
            bot,
            message,
            PREFIX,
            forceSkip,
            weeklyGoalEntryTitle,
            mastermindEmbedColour,
            `\n${goalDescriptionString}\n${goalTypeString}`
          );
          if (!weeklyGoalSpecifics && weeklyGoalSpecifics !== "") return;

          const weeklyGoalReason = await fn.getSingleEntryWithCharacterLimit(
            bot,
            message,
            PREFIX,
            `${goalDescriptionString}\n${goalTypeString}\n\n**__💭 Why do you want to accomplish this goal?__**\n(Within 1000 characters)`,
            weeklyGoalEntryTitle,
            1000,
            "a goal reason",
            forceSkip,
            mastermindEmbedColour,
            completionInstructions,
            completionKeywords
          );
          if (!weeklyGoalReason && weeklyGoalReason !== "") return;
          else if (weeklyGoalReason === "set") break;
          else if (weeklyGoalReason === "reset") {
            goalCount = 1;
            weeklyGoals = new Array();
            continue;
          }

          // Ask which goal this is connected to if the user has any long-term goals setup
          // And have a connection to the given goals _id, then send that in to the habit
          const goals = await Goal.find({ userID: targetUser });
          var connectedGoal;
          if (goals)
            if (goals.length) {
              const goalReasonString = `__**Reason:**__${
                weeklyGoalReason === "" ? "" : `\n${weeklyGoalReason}`
              }`;
              const selectedGoal = await fn.getUserSelectedObject(
                bot,
                message,
                PREFIX,
                `**__Which long-term goal is related to Goal #${goalCount}?__**\n(Type \`${
                  goals.length + 1
                }\` if none.)`,
                `Mastermind Entry: Weekly Goal ${goalCount} - Connected Long-Term Goal`,
                goals,
                "description",
                false,
                mastermindEmbedColour,
                600000,
                0,
                `\n${goalDescriptionString}\n${goalTypeString}\n${goalReasonString}`,
                ["**NONE**"]
              );
              if (!selectedGoal) return;
              else if (selectedGoal.index !== goals.length) {
                connectedGoal = selectedGoal.object
                  ? selectedGoal.object._id
                  : undefined;
              }
            }
          weeklyGoals.push({
            type: weeklyGoalType,
            description: weeklyGoalDescription,
            specifics: weeklyGoalSpecifics,
            reason: weeklyGoalReason,
            connectedGoal,
          });
          goalCount++;
          if (goalCount >= 10) break;
        } while (true);
        console.log({ weeklyGoals });

        mastermindDocument = new Mastermind({
          _id: mongoose.Types.ObjectId(),
          userID: targetUser,
          createdAt:
            fn.getCurrentUTCTimestampFlooredToSecond() +
            HOUR_IN_MS * targetUserTimezoneOffset,
          createdBy: authorID,
          usedTemplate: userWantsTemplate,
          guildID,
          journal: {
            observations,
            areaOfLife: {
              type: areaOfLifeIndex,
              reason: areaOfLifeReason,
            },
            stopEntry,
            startEntry,
            continueEntry,
            goals: weeklyGoals,
          },
        });
      } else if (userWantsTemplate === false) {
        let entry = await fn.getMultilineEntry(
          bot,
          message,
          PREFIX,
          "**Enter your mastermind entry:**",
          "Mastermind Entry: No Template",
          forceSkip,
          mastermindEmbedColour
        );
        if (entry.message) {
          entry = entry.message;
          mastermindDocument = new Mastermind({
            _id: mongoose.Types.ObjectId(),
            userID: targetUser,
            createdAt:
              fn.getCurrentUTCTimestampFlooredToSecond() +
              HOUR_IN_MS * targetUserTimezoneOffset,
            createdBy: authorID,
            usedTemplate: userWantsTemplate,
            guildID,
            journal: { entry },
          });
        } else return;
      } else return;

      const isUserCreating =
        mastermindDocument.userID === mastermindDocument.createdBy;
      if (mastermindDocument) {
        await mastermindDocument
          .save()
          .then((result) => console.log({ result }))
          .catch((err) => console.error(err));
        if (isUserCreating) {
          message.channel.send(
            fn.getMessageEmbed(
              `Your mastermind entry was **successfully logged!**\n(${fn.timestampToDateString(
                mastermindDocument.createdAt,
                true,
                true,
                true
              )} ${targetUserTimezone})`,
              "Mastermind Entry",
              mastermindEmbedColour
            )
          );
          if (userWantsTemplate) {
            const goalsToReminderConfirmation = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              `Would you like to be **reminded** of your **Mastermind Weekly Goals** each day this upcoming week?\n(If yes, you can choose if you want to be reminded of them for 7 days or more)\n\n**If you want to setup Weekly Goal reminders later**, type \`${PREFIX}${commandUsed} reminder\``,
              forceSkip,
              "Mastermind: Weekly Goals Daily Reminder",
              300000
            );
            if (goalsToReminderConfirmation) {
              await setUserMastermindReminder(
                bot,
                message,
                PREFIX,
                timezoneOffset,
                daylightSaving,
                mastermindDocument
              );
            }

            const goalsToHabitConfirmation = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              `**Would you like to set any of this week's goal(s) as a habit?:**\n\n${
                fn.goalArrayToString(
                  mastermindDocument.journal.goals,
                  "Weekly",
                  true,
                  true
                ) || ""
              }\n\n**If you want to setup Weekly Goal habits later**, type \`${PREFIX}${commandUsed} habit\``,
              forceSkip,
              "Mastermind: Weekly Goals into Habits",
              600000
            );
            if (goalsToHabitConfirmation) {
              const successfullySetHabits = await hb.setMastermindHabits(
                bot,
                message,
                PREFIX,
                commandUsed,
                timezoneOffset,
                daylightSaving,
                mastermindDocument,
                userSettings
              );
              if (!successfullySetHabits) return;
            }

            // 6. Post
            const postConfirmation = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              "**Would you like to __post__ your mastermind entry to a __server's channel?__**",
              false,
              "Mastermind: Post",
              180000
            );
            if (!postConfirmation) return;
            else
              await this.run(
                bot,
                message,
                commandUsed,
                ["post", "recent"],
                PREFIX,
                timezoneOffset,
                daylightSaving,
                forceSkip
              );
          }
        } else {
          message.channel.send(
            fn
              .getMessageEmbed(
                `<@!${targetUser}>'s mastermind entry was **successfully logged!**\n(${fn.timestampToDateString(
                  mastermindDocument.createdAt,
                  true,
                  true,
                  true
                )} ${targetUserTimezone})\n\n__**Creator:**__ <@!${authorID}>`,
                "Mastermind Entry",
                mastermindEmbedColour
              )
              .setFooter(
                `${targetUser} can post this mastermind using \`${PREFIX}${commandUsed} post recent\``
              )
          );
        }
      }
      return;
    } else if (
      mastermindCommand === "delete" ||
      mastermindCommand === "remove" ||
      mastermindCommand === "del" ||
      mastermindCommand === "d"
    ) {
      /**
       * 1. Format - delete 1/55/recent <recent>, delete many 1,2,3,recent <recent>, delete past #, delete # past #,
       * Similar to reminders/fasts
       */
      let mastermindDeleteUsageMessage = fn.getReadOrDeleteUsageMessage(
        PREFIX,
        commandUsed,
        mastermindCommand,
        true,
        ["Entry", "Entries"]
      );
      mastermindDeleteUsageMessage = fn.getMessageEmbed(
        mastermindDeleteUsageMessage,
        "Mastermind: Delete Help",
        mastermindEmbedColour
      );
      const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see help\``;

      if (mastermindType) {
        if (mastermindType === "help") {
          return message.channel.send(mastermindDeleteUsageMessage);
        }
        if (!totalMastermindNumber) {
          return message.reply(
            `**NO ENTRIES**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        }
      } else return message.reply(mastermindActionHelpMessage);

      // delete past #:
      if (args[2] !== undefined) {
        const deleteType = mastermindType;
        if (deleteType === "past") {
          // If the following argument is not a number, exit!
          if (isNaN(args[2])) {
            return fn.sendErrorMessageAndUsage(
              message,
              mastermindActionHelpMessage
            );
          }
          var numberArg = parseInt(args[2]);
          if (numberArg <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              mastermindActionHelpMessage
            );
          }
          let indexByRecency = false;
          if (args[3] !== undefined) {
            if (args[3].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          const sortType = indexByRecency ? "By Recency" : "By Date Created";
          var mastermindCollection;
          if (indexByRecency)
            mastermindCollection = await fn.getEntriesByRecency(
              Mastermind,
              { userID: authorID },
              0,
              numberArg
            );
          else
            mastermindCollection = await getMastermindByCreatedAt(
              authorID,
              0,
              numberArg
            );
          const mastermindStringArray = fn.getEmbedArray(
            multipleMastermindsToString(
              bot,
              message,
              mastermindCollection,
              numberArg,
              0,
              true
            ),
            "",
            true,
            false,
            mastermindEmbedColour
          );
          const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} entries?**`;
          const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            mastermindStringArray,
            multipleDeleteMessage,
            forceSkip,
            `Mastermind: Delete Past ${numberArg} Entries (${sortType})`,
            600000
          );
          if (!multipleDeleteConfirmation) return;
          const targetIDs = await mastermindCollection.map(
            (entry) => entry._id
          );
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Entries (${sortType})`
          );
          await del.deleteManyByIDAndConnectedReminders(Mastermind, targetIDs);
          return;
        }
        if (deleteType === "many") {
          if (args[2] === undefined) {
            return message.reply(mastermindActionHelpMessage);
          }
          // Get the arguments after keyword MANY
          // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
          // Convert String of Numbers array into Integer array
          // Check which masterminds exist, remove/don't add those that don't
          let toDelete = args[2].split(",").filter((index) => {
            if (!isNaN(index)) {
              numberIndex = parseInt(index);
              if (numberIndex > 0 && numberIndex <= totalMastermindNumber) {
                return numberIndex;
              }
            } else if (index === "recent") {
              return true;
            }
          });
          const recentIndex = await getRecentMastermindIndex(authorID);
          toDelete = Array.from(
            new Set(
              toDelete.map((number) => {
                if (number === "recent") {
                  if (recentIndex !== -1) return recentIndex;
                } else return +number;
              })
            )
          );
          console.log({ toDelete });
          // Send error message if none of the given reminders exist
          if (!toDelete.length) {
            return fn.sendErrorMessage(
              message,
              "All of these **masterminds DO NOT exist**..."
            );
          }
          var indexByRecency = false;
          if (args[3] !== undefined) {
            if (args[3].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          var mastermindTargetIDs = new Array();
          var mastermindStringArray = new Array();
          for (let i = 0; i < toDelete.length; i++) {
            var mastermindView;
            if (indexByRecency) {
              mastermindView = await getOneMastermindByRecency(
                authorID,
                toDelete[i] - 1
              );
            } else {
              mastermindView = await getOneMastermindByCreatedTime(
                authorID,
                toDelete[i] - 1
              );
            }
            mastermindTargetIDs.push(mastermindView._id);
            mastermindStringArray.push(
              `__**Mastermind ${toDelete[i]}:**__\n${mastermindDocumentToString(
                bot,
                mastermindView
              )}`
            );
          }
          const deleteConfirmMessage = `Are you sure you want to **delete entries ${toDelete.toString()}?**`;
          const sortType = indexByRecency ? "By Recency" : "By Date Created";
          mastermindStringArray = fn.getEmbedArray(
            mastermindStringArray,
            "",
            true,
            false,
            mastermindEmbedColour
          );
          const confirmDeleteMany = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            mastermindStringArray,
            deleteConfirmMessage,
            forceSkip,
            `Mastermind: Delete Entries ${toDelete} (${sortType})`,
            600000
          );
          if (confirmDeleteMany) {
            console.log(
              `Deleting ${authorID}'s Entries ${toDelete} (${sortType})`
            );
            await del.deleteManyByIDAndConnectedReminders(
              Mastermind,
              mastermindTargetIDs
            );
            return;
          } else return;
        } else {
          var shiftIndex;
          let indexByRecency = false;
          if (args[2].toLowerCase() === "past") {
            shiftIndex = 0;
            indexByRecency = false;
          } else if (args[2].toLowerCase() === "recent") {
            shiftIndex = 1;
            indexByRecency = true;
          }
          console.log({ shiftIndex });
          if (args[2 + shiftIndex]) {
            if (args[2 + shiftIndex].toLowerCase() === "past") {
              var skipEntries;
              if (isNaN(args[3 + shiftIndex])) {
                if (args[3 + shiftIndex].toLowerCase() === "recent") {
                  skipEntries = await getRecentMastermindIndex(authorID);
                } else return message.reply(mastermindActionHelpMessage);
              } else skipEntries = parseInt(args[3 + shiftIndex]);
              const pastNumberOfEntries = parseInt(args[1]);
              if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                return fn.sendErrorMessageAndUsage(
                  message,
                  mastermindActionHelpMessage
                );
              }
              var mastermindCollection;
              if (indexByRecency)
                mastermindCollection = await fn.getEntriesByRecency(
                  Mastermind,
                  { userID: authorID },
                  skipEntries,
                  pastNumberOfEntries
                );
              else
                mastermindCollection = await getMastermindByCreatedAt(
                  authorID,
                  skipEntries,
                  pastNumberOfEntries
                );
              const mastermindStringArray = fn.getEmbedArray(
                multipleMastermindsToString(
                  bot,
                  message,
                  mastermindCollection,
                  pastNumberOfEntries,
                  skipEntries,
                  true
                ),
                "",
                true,
                false,
                mastermindEmbedColour
              );
              if (skipEntries >= totalMastermindNumber) return;
              const sortType = indexByRecency
                ? "By Recency"
                : "By Date Created";
              const multipleDeleteMessage = `Are you sure you want to **delete ${mastermindCollection.length} entries past entry ${skipEntries}?**`;
              const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
                bot,
                message,
                PREFIX,
                mastermindStringArray,
                multipleDeleteMessage,
                forceSkip,
                `Mastermind: Multiple Delete Warning! (${sortType})`
              );
              console.log({ multipleDeleteConfirmation });
              if (!multipleDeleteConfirmation) return;
              console.log({ multipleDeleteConfirmation });
              const targetIDs = await mastermindCollection.map(
                (entry) => entry._id
              );
              console.log(
                `Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} entries past ${skipEntries} (${sortType})`
              );
              await del.deleteManyByIDAndConnectedReminders(
                Mastermind,
                targetIDs
              );
              return;
            }

            // They haven't specified the field for the mastermind delete past function
            else if (deleteType === "past")
              return message.reply(mastermindActionHelpMessage);
            else return message.reply(mastermindActionHelpMessage);
          }
        }
      }
      // Next: MASTERMIND DELETE ALL
      // Next: MASTERMIND DELETE MANY
      // Next: MASTERMIND DELETE

      // mastermind delete <NUMBER/RECENT/ALL>
      const noMastermindsMessage = `**NO MASTERMINDS**... try \`${PREFIX}${commandUsed} start help\``;
      if (isNaN(args[1])) {
        const deleteType = mastermindType;
        if (deleteType === "recent") {
          const mastermindView = await getOneMastermindByRecency(
            authorID,
            0,
            false
          );
          if (!mastermindView)
            return fn.sendErrorMessage(message, noMastermindsMessage);
          const mastermindTargetID = mastermindView._id;
          console.log({ mastermindTargetID });
          const mastermindIndex = await getRecentMastermindIndex(authorID);
          const mastermindEmbed = fn.getEmbedArray(
            `__**Mastermind ${mastermindIndex}:**__\n${mastermindDocumentToString(
              bot,
              mastermindView
            )}`,
            `Mastermind: Delete Recent Entry`,
            true,
            false,
            mastermindEmbedColour
          );
          const deleteConfirmMessage = `Are you sure you want to **delete your most recent entry?:**`;
          const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            mastermindEmbed,
            deleteConfirmMessage,
            forceSkip,
            `Mastermind: Delete Recent Entry`,
            600000
          );
          if (deleteIsConfirmed) {
            await del.deleteOneByIDAndConnectedReminders(
              Mastermind,
              mastermindTargetID
            );
            return;
          }
        } else if (deleteType === "all") {
          const confirmDeleteAllMessage = `Are you sure you want to **delete all** of your recorded masterminds?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          const pastNumberOfEntriesIndex = totalMastermindNumber;
          if (pastNumberOfEntriesIndex === 0) {
            return fn.sendErrorMessage(message, noMastermindsMessage);
          }
          let confirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            confirmDeleteAllMessage,
            forceSkip,
            "Mastermind: Delete All Entries WARNING!"
          );
          if (!confirmDeleteAll) return;
          const finalDeleteAllMessage = `Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR MASTERMINDS ON RECORD**?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          let finalConfirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            finalDeleteAllMessage,
            "Mastermind: Delete ALL Entries FINAL Warning!"
          );
          if (!finalConfirmDeleteAll) return;
          console.log(
            `Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Entries`
          );
          const allQuery = { userID: authorID };
          await del.deleteManyAndConnectedReminders(Mastermind, allQuery);
          return;
        } else return message.reply(mastermindActionHelpMessage);
      } else {
        const pastNumberOfEntriesIndex = parseInt(args[1]);
        let indexByRecency = false;
        if (args[2] !== undefined) {
          if (args[2].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }
        var mastermindView;
        if (indexByRecency)
          mastermindView = await getOneMastermindByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        else
          mastermindView = await getOneMastermindByCreatedTime(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        if (!mastermindView) {
          return fn.sendErrorMessageAndUsage(
            message,
            trySeeCommandMessage,
            `**MASTERMIND ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
          );
        }
        const mastermindTargetID = mastermindView._id;
        const sortType = indexByRecency ? "By Recency" : "By Date Created";
        const deleteConfirmMessage = `Are you sure you want to **delete Entry ${pastNumberOfEntriesIndex}?**`;
        const mastermindEmbed = fn.getEmbedArray(
          `__**Mastermind ${pastNumberOfEntriesIndex}:**__\n${mastermindDocumentToString(
            bot,
            mastermindView
          )}`,
          `Mastermind: Delete Entry ${pastNumberOfEntriesIndex} (${sortType})`,
          true,
          false,
          mastermindEmbedColour
        );
        const deleteConfirmation = await fn.getPaginatedUserConfirmation(
          bot,
          message,
          PREFIX,
          mastermindEmbed,
          deleteConfirmMessage,
          forceSkip,
          `Mastermind: Delete Entry ${pastNumberOfEntriesIndex} (${sortType})`,
          600000
        );
        if (deleteConfirmation) {
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Entry ${sortType}`
          );
          await del.deleteOneByIDAndConnectedReminders(
            Mastermind,
            mastermindTargetID
          );
          return;
        }
      }
    } else if (mastermindCommand === "see" || mastermindCommand === "show") {
      let mastermindSeeUsageMessage = fn.getReadOrDeleteUsageMessage(
        PREFIX,
        commandUsed,
        mastermindCommand,
        true,
        ["Entry", "Entries"]
      );
      mastermindSeeUsageMessage = fn.getMessageEmbed(
        mastermindSeeUsageMessage,
        "Mastermind: See Help",
        mastermindEmbedColour
      );

      const seeCommands = ["past", "recent", "all"];

      if (mastermindType) {
        if (mastermindType === "help") {
          return message.channel.send(mastermindSeeUsageMessage);
        }
        if (!totalMastermindNumber) {
          return message.reply(
            `**NO MASTERMINDS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (mastermindType === "number") {
          return message.reply(
            `You have **${totalMastermindNumber} mastermind entries** on record.`
          );
        }
      } else return message.reply(mastermindActionHelpMessage);

      // Show the user the last mastermind with the most recent end time (by sorting from largest to smallest end time and taking the first):
      // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort.
      // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
      if (!seeCommands.includes(mastermindType) && isNaN(mastermindType)) {
        return message.reply(mastermindActionHelpMessage);
      }
      // Do not show the most recent mastermind embed, when a valid command is called
      // it will be handled properly later based on the values passed in!
      else {
        const seeType = mastermindType;
        var pastFunctionality, pastNumberOfEntriesIndex;
        let indexByRecency = false;
        // To check if the given argument is a number!
        // If it's not a number and has passed the initial
        // filter, then use the "past" functionality
        // Handling Argument 1:
        const isNumberArg = !isNaN(args[1]);
        if (seeType === "recent") {
          return message.channel.send(
            await getMostRecentMastermind(bot, authorID, mastermindEmbedColour)
          );
        } else if (seeType === "all") {
          pastNumberOfEntriesIndex = totalMastermindNumber;
          pastFunctionality = true;
        } else if (isNumberArg) {
          pastNumberOfEntriesIndex = parseInt(args[1]);
          if (pastNumberOfEntriesIndex <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              mastermindActionHelpMessage,
              `**MASTERMIND ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
            );
          } else pastFunctionality = false;
        } else if (seeType === "past") {
          pastFunctionality = true;
        }
        // After this filter:
        // If the first argument after "see" is not past, then it is not a valid call
        else return message.reply(mastermindActionHelpMessage);
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
            if (isNaN(args[2]))
              return message.reply(mastermindActionHelpMessage);
            if (parseInt(args[2]) <= 0)
              return message.reply(mastermindActionHelpMessage);
            const confirmSeeMessage = `Are you sure you want to **see ${args[2]} masterminds?**`;
            let confirmSeeAll = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeMessage,
              forceSkip,
              `Mastermind: See ${args[2]} Entries (${sortType})`
            );
            if (!confirmSeeAll) return;
          } else {
            // If the next argument is undefined, implied "see all" command call unless "all" was not called:
            // => empty "past" command call
            if (seeType !== "all")
              return message.reply(mastermindActionHelpMessage);
            const confirmSeeAllMessage =
              "Are you sure you want to **see all** of your mastermind history?";
            let confirmSeeAll = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeAllMessage,
              forceSkip,
              "Mastermind: See All Entries"
            );
            if (!confirmSeeAll) return;
          }
          // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
          if (pastNumberOfEntriesIndex === undefined) {
            pastNumberOfEntriesIndex = parseInt(args[2]);
          }
          var mastermindView;
          if (indexByRecency)
            mastermindView = await fn.getEntriesByRecency(
              Mastermind,
              { userID: authorID },
              0,
              pastNumberOfEntriesIndex
            );
          else
            mastermindView = await getMastermindByCreatedAt(
              authorID,
              0,
              pastNumberOfEntriesIndex
            );
          console.log({ mastermindView, pastNumberOfEntriesIndex });
          const mastermindStringArray = multipleMastermindsToString(
            bot,
            message,
            mastermindView,
            pastNumberOfEntriesIndex,
            0,
            true
          );
          await fn.sendPaginationEmbed(
            bot,
            message.channel.id,
            authorID,
            fn.getEmbedArray(
              mastermindStringArray,
              `Mastermind: See ${pastNumberOfEntriesIndex} Entries (${sortType})`,
              true,
              `Mastermind Reflections ${fn.timestampToDateString(
                Date.now() + timezoneOffset * HOUR_IN_MS,
                false,
                false,
                true,
                true
              )}`,
              mastermindEmbedColour
            )
          );
          return;
        }
        // see <PAST_#_OF_ENTRIES> <recent> past <INDEX>
        if (args[2] !== undefined) {
          var shiftIndex;
          if (args[2].toLowerCase() === "past") {
            shiftIndex = 0;
            indexByRecency = false;
          } else if (args[2].toLowerCase() === "recent") {
            shiftIndex = 1;
            indexByRecency = true;
          }
          if (args[2 + shiftIndex]) {
            if (args[2 + shiftIndex].toLowerCase() === "past") {
              if (args[3 + shiftIndex] !== undefined) {
                const sortType = indexByRecency
                  ? "By Recency"
                  : "By Date Created";
                var entriesToSkip;
                // If the argument after past is a number, valid command call!
                if (!isNaN(args[3 + shiftIndex])) {
                  entriesToSkip = parseInt(args[3 + shiftIndex]);
                } else if (args[3 + shiftIndex].toLowerCase() === "recent") {
                  entriesToSkip = await getRecentMastermindIndex(authorID);
                } else return message.reply(mastermindActionHelpMessage);
                if (
                  entriesToSkip < 0 ||
                  entriesToSkip > totalMastermindNumber
                ) {
                  return fn.sendErrorMessageAndUsage(
                    message,
                    mastermindActionHelpMessage,
                    "**MASTERMIND(S) DO NOT EXIST**..."
                  );
                }
                const confirmSeePastMessage = `Are you sure you want to **see ${args[1]} entries past ${entriesToSkip}?**`;
                const confirmSeePast = await fn.getUserConfirmation(
                  bot,
                  message,
                  PREFIX,
                  confirmSeePastMessage,
                  forceSkip,
                  `Mastermind: See ${args[1]} Entries Past ${entriesToSkip} (${sortType})`
                );
                if (!confirmSeePast) return;
                var mastermindView;
                if (indexByRecency)
                  mastermindView = await fn.getEntriesByRecency(
                    Mastermind,
                    { userID: authorID },
                    entriesToSkip,
                    pastNumberOfEntriesIndex
                  );
                else
                  mastermindView = await getMastermindByCreatedAt(
                    authorID,
                    entriesToSkip,
                    pastNumberOfEntriesIndex
                  );
                console.log({ mastermindView });
                const mastermindStringArray = multipleMastermindsToString(
                  bot,
                  message,
                  mastermindView,
                  pastNumberOfEntriesIndex,
                  entriesToSkip,
                  true
                );
                await fn.sendPaginationEmbed(
                  bot,
                  message.channel.id,
                  authorID,
                  fn.getEmbedArray(
                    mastermindStringArray,
                    `Mastermind: See ${pastNumberOfEntriesIndex} Entries Past ${entriesToSkip} (${sortType})`,
                    true,
                    `Mastermind Reflections ${fn.timestampToDateString(
                      Date.now() + timezoneOffset * HOUR_IN_MS,
                      false,
                      false,
                      true,
                      true
                    )}`,
                    mastermindEmbedColour
                  )
                );
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
        var mastermindView;
        if (indexByRecency)
          mastermindView = await getOneMastermindByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        else
          mastermindView = await getOneMastermindByCreatedTime(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        console.log({ mastermindView });
        if (!mastermindView) {
          return fn.sendErrorMessage(
            message,
            `**MASTERMIND ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
          );
        }
        // NOT using the past functionality:
        const sortType = indexByRecency ? "By Recency" : "By Date Created";
        const mastermindString = `__**Mastermind ${pastNumberOfEntriesIndex}:**__\n${mastermindDocumentToString(
          bot,
          mastermindView
        )}`;
        const mastermindEmbed = fn.getEmbedArray(
          mastermindString,
          `Mastermind: See Entry ${pastNumberOfEntriesIndex} (${sortType})`,
          true,
          `Mastermind Reflection ${fn.timestampToDateString(
            Date.now() + timezoneOffset * HOUR_IN_MS,
            false,
            false,
            true,
            true
          )}`,
          mastermindEmbedColour
        );
        await fn.sendPaginationEmbed(
          bot,
          message.channel.id,
          authorID,
          mastermindEmbed
        );
      }
    } else if (
      mastermindCommand === "edit" ||
      mastermindCommand === "change" ||
      mastermindCommand === "ed" ||
      mastermindCommand === "e" ||
      mastermindCommand === "ch"
    ) {
      let mastermindEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${mastermindCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\`\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; 3** (3rd most recent entry, \\**any number*)\n\n\`<recent?>\`(OPT.): type **recent** at the indicated spot to sort the masterminds by **actual time created instead of mastermind created time!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      mastermindEditUsageMessage = fn.getMessageEmbed(
        mastermindEditUsageMessage,
        `Mastermind: Edit Help`,
        mastermindEmbedColour
      );
      if (mastermindType) {
        if (mastermindType === "help") {
          return message.channel.send(mastermindEditUsageMessage);
        }
        if (!totalMastermindNumber) {
          return message.reply(
            `**NO MASTERMINDS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        }
        if (isNaN(mastermindType) && mastermindType !== "recent") {
          return message.reply(mastermindActionHelpMessage);
        } else {
          var pastNumberOfEntriesIndex;
          if (mastermindType === "recent") {
            pastNumberOfEntriesIndex = await getRecentMastermindIndex(authorID);
          } else {
            pastNumberOfEntriesIndex = parseInt(mastermindType);
            if (pastNumberOfEntriesIndex <= 0) {
              return fn.sendErrorMessageAndUsage(
                message,
                mastermindActionHelpMessage,
                `**MASTERMIND ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
              );
            }
          }
          var indexByRecency = false;
          if (args[2] !== undefined) {
            if (args[2].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          var mastermindDocument;
          if (indexByRecency)
            mastermindDocument = await getOneMastermindByRecency(
              authorID,
              pastNumberOfEntriesIndex - 1
            );
          else
            mastermindDocument = await getOneMastermindByCreatedTime(
              authorID,
              pastNumberOfEntriesIndex - 1
            );
          if (!mastermindDocument) {
            return fn.sendErrorMessageAndUsage(
              message,
              mastermindActionHelpMessage,
              `**MASTERMIND ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
            );
          }
          const sortType = indexByRecency ? "By Recency" : "By Date Created";
          const { usedTemplate } = mastermindDocument;
          var mastermindFields = usedTemplate
            ? [
                "Created Date",
                "Observations",
                "Area of Life Assessment",
                "Stop",
                "Start",
                "Continue",
                "Weekly Goals",
              ]
            : ["Created Date", "Entry"];
          const mastermindTargetID = mastermindDocument._id;
          var showMastermind, continueEdit;
          do {
            const checkMastermind = await getOneMastermindByObjectID(
              mastermindTargetID
            );
            if (!checkMastermind) return;
            continueEdit = false;
            showMastermind = mastermindDocumentToString(
              bot,
              mastermindDocument
            );
            // Field the user wants to edit
            const fieldToEditInstructions =
              "**Which field do you want to edit?**";
            const fieldToEditAdditionalMessage = `__**Mastermind ${pastNumberOfEntriesIndex} (${sortType}):**__\n${showMastermind}`;
            const fieldToEditTitle = `Mastermind: Edit Field`;
            var fieldToEdit, fieldToEditIndex;
            const selectedField = await fn.getUserSelectedObject(
              bot,
              message,
              PREFIX,
              fieldToEditInstructions,
              fieldToEditTitle,
              mastermindFields,
              "",
              false,
              mastermindEmbedColour,
              600000,
              0,
              fieldToEditAdditionalMessage
            );
            if (!selectedField) return;
            else {
              fieldToEdit = selectedField.object;
              fieldToEditIndex = selectedField.index;
            }

            var userEdit,
              mastermindEditMessagePrompt = "";
            const type = "Mastermind Entry";
            const editInstructions =
              "\nType `back` to go **back to the main edit menu**";
            let { journal, createdAt } = mastermindDocument;
            if (fieldToEditIndex === 0) {
              mastermindEditMessagePrompt = `\n**__Please enter the date and time when this mastermind entry was created:__** ⌚\n${timeExamples}`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                mastermindEditMessagePrompt,
                type,
                forceSkip,
                mastermindEmbedColour
              );
            } else if (!usedTemplate) {
              if (fieldToEditIndex === 1) {
                mastermindEditMessagePrompt = `\n**__Please enter your new mastermind entry:__**`;
                userEdit = await fn.getUserMultilineEditString(
                  bot,
                  message,
                  fieldToEdit,
                  mastermindEditMessagePrompt,
                  type,
                  forceSkip,
                  mastermindEmbedColour
                );
                journal.entry = userEdit;
              }
            } else
              switch (fieldToEditIndex) {
                case 1:
                  mastermindEditMessagePrompt =
                    "\n**__Look back at the previous week ↩:__**\n**- 📈 How much did you stick to your habits and/or progress on your goals?\n- 💭 Make 3 observations.**";
                  userEdit = await fn.getUserMultilineEditString(
                    bot,
                    message,
                    fieldToEdit,
                    mastermindEditMessagePrompt,
                    type,
                    forceSkip,
                    mastermindEmbedColour
                  );
                  journal.observations = userEdit;
                  break;
                case 2: {
                  mastermindEditMessagePrompt = `\n**__Which area of life needs the most attention? 🌱__**\n${areasOfLifeList}`;
                  let areaOfLifeType = await fn.getUserEditNumber(
                    bot,
                    message,
                    PREFIX,
                    fieldToEdit,
                    areasOfLife.length,
                    type,
                    areasOfLifeCombinedEmoji,
                    forceSkip,
                    mastermindEmbedColour,
                    mastermindEditMessagePrompt
                  );
                  if (!areaOfLifeType) return;
                  else if (areaOfLifeType === "back") break;
                  areaOfLifeType--;

                  mastermindEditMessagePrompt = `\n**Why does ${areasOfLifeEmojis[areaOfLifeType]} __${areasOfLife[areaOfLifeType]}__ need the most attention this week?`;
                  // let additionalInstructions = `Type \`same\` to keep the previous entry you've had`;
                  // let additionalKeywords = ["same"];
                  let areaOfLifeReason = await fn.getUserEditString(
                    bot,
                    message,
                    PREFIX,
                    fieldToEdit,
                    mastermindEditMessagePrompt,
                    type,
                    forceSkip,
                    mastermindEmbedColour
                  );
                  console.log({ areaOfLifeReason });
                  if (!areaOfLifeReason) return;
                  else if (areaOfLifeReason === "back") break;

                  if (areaOfLifeReason !== "same")
                    userEdit = journal.areaOfLife;
                  else
                    userEdit = {
                      type: areaOfLifeType,
                      reason: areaOfLifeReason,
                    };
                  journal.areaOfLife = userEdit;
                  break;
                }
                case 3:
                  mastermindEditMessagePrompt =
                    "What do you want to __stop__ doing?";
                  userEdit = await fn.getUserEditString(
                    bot,
                    message,
                    PREFIX,
                    fieldToEdit,
                    mastermindEditMessagePrompt,
                    type,
                    forceSkip,
                    mastermindEmbedColour
                  );
                  journal.stopEntry = userEdit;
                  break;
                case 4:
                  mastermindEditMessagePrompt =
                    "What do you want to __start__ doing?";
                  userEdit = await fn.getUserEditString(
                    bot,
                    message,
                    PREFIX,
                    fieldToEdit,
                    mastermindEditMessagePrompt,
                    type,
                    forceSkip,
                    mastermindEmbedColour
                  );
                  journal.startEntry = userEdit;
                  break;
                case 5:
                  mastermindEditMessagePrompt =
                    "What went well in the previous week that you want to __continue__ doing for?";
                  userEdit = await fn.getUserEditString(
                    bot,
                    message,
                    PREFIX,
                    fieldToEdit,
                    mastermindEditMessagePrompt,
                    type,
                    forceSkip,
                    mastermindEmbedColour
                  );
                  journal.continueEntry = userEdit;
                  break;
                case 6: {
                  let goalsArray = mastermindDocument.journal.goals;
                  // let additionalInstructions = `Type \`add\` to add a new goal`;
                  // let additionalKeyword = ["add"];
                  mastermindEditMessagePrompt = `\n**__Please enter the \`number\` of the goal you'd like to change__**:\n${fn.goalArrayToString(
                    goalsArray,
                    "Weekly",
                    true,
                    true,
                    true
                  )}`;
                  let goalIndex = await fn.userSelectFromList(
                    bot,
                    message,
                    PREFIX,
                    fn.goalArrayToString(
                      goalsArray,
                      "Weekly",
                      true,
                      true,
                      true
                    ),
                    goalsArray.length,
                    `\n**__Please enter the \`number\` of the goal you'd like to change__:**`,
                    "Mastermind Entry: Weekly Goal Edit",
                    mastermindEmbedColour
                  );
                  if (!goalIndex && goalIndex !== 0) return;

                  // let extraInstructions = `Type \`delete\` to **delete** this particular goal (**Goal ${goalIndex + 1}**)`
                  // + `Type \`same\` to **keep this category the same** as it was before`;
                  // let extraKeywords = ["delete", "same"];
                  let weeklyGoalDescription = await fn.getUserEditString(
                    bot,
                    message,
                    PREFIX,
                    "Goal Description",
                    `\n**🎯 What is __Goal #${goalIndex + 1}__?:**`,
                    type,
                    forceSkip,
                    mastermindEmbedColour
                  );
                  if (!weeklyGoalDescription && weeklyGoalDescription !== "")
                    return;
                  else if (weeklyGoalDescription === "back") break;
                  // else if (weeklyGoalDescription === "delete") {
                  //     const confirmGoalDeletion = await fn.getUserConfirmation(bot, message, PREFIX,
                  //         `Are you sure you want to delete **Goal ${goalIndex + 1}?**\n${fn.goalArrayToString([goalsArray[goalIndex]], "Weekly", false)}`,
                  //         false, `Mastermind: Delete Weekly Goal ${goalIndex + 1}`);

                  // }
                  // else if(weeklyGoalDescription === "same") {

                  // }

                  let goalDescriptionString = `__**Goal #${goalIndex + 1}:**__${
                    weeklyGoalDescription === ""
                      ? ""
                      : `\n${weeklyGoalDescription}`
                  }`;
                  let weeklyGoalType = await fn.getUserEditNumber(
                    bot,
                    message,
                    PREFIX,
                    "Goal Category",
                    areasOfLife.length,
                    type,
                    areasOfLifeCombinedEmoji,
                    forceSkip,
                    mastermindEmbedColour,
                    `\n**__Which area of life does Goal #${
                      goalIndex + 1
                    } fall under?__**\n${areasOfLifeList}\n\n${goalDescriptionString}`
                  );
                  console.log({ weeklyGoalType });
                  if (!weeklyGoalType && weeklyGoalType !== 0) break;
                  else if (weeklyGoalType === "back") break;
                  weeklyGoalType--;

                  let goalTypeString = `__**Type:**__ ${areasOfLifeEmojis[weeklyGoalType]} ${areasOfLife[weeklyGoalType]}`;

                  let weeklyGoalSpecifics = await hb.getHabitSpecifics(
                    bot,
                    message,
                    PREFIX,
                    forceSkip,
                    `${type}: Goal Specifics`,
                    mastermindEmbedColour,
                    editInstructions,
                    ["back"]
                  );
                  if (!weeklyGoalSpecifics && weeklyGoalSpecifics !== "")
                    return;
                  else if (weeklyGoalSpecifics === "back") break;

                  let weeklyGoalReason = await fn.getUserEditString(
                    bot,
                    message,
                    PREFIX,
                    "Goal Reason",
                    `${goalTypeString}\n${goalDescriptionString}\n\n**__💭 Why do you want to accomplish this goal?__**`,
                    type,
                    forceSkip,
                    mastermindEmbedColour
                  );
                  if (!weeklyGoalReason && weeklyGoalReason !== "") return;
                  else if (weeklyGoalReason === "back") break;
                  // else if (weeklyGoalReason === "delete") {
                  //     const confirmGoalDeletion = await fn.getUserConfirmation(bot, message, PREFIX,
                  //         `Are you sure you want to delete **Goal ${goalIndex + 1}?**\n${fn.goalArrayToString([goalsArray[goalIndex]], "Weekly", false)}`,
                  //         false, `Mastermind: Delete Weekly Goal ${goalIndex + 1}`);

                  // }
                  // else if(weeklyGoalReason === "same") {

                  // }

                  userEdit = {
                    type: weeklyGoalType,
                    description: weeklyGoalDescription,
                    specifics: weeklyGoalSpecifics,
                    reason: weeklyGoalReason,
                  };
                  journal.goals = userEdit;

                  // Update any Mastermind goals weekly reminders:
                  if (mastermindDocument._id) {
                    const reminderCancelled = rm.cancelRemindersByConnectedDocument(
                      mastermindDocument._id
                    );
                    const mastermindReminders = await Reminder.find({
                      isRecurring: true,
                      connectedDocument: mastermindDocument._id,
                    });
                    mastermindReminders.forEach(async (reminder) => {
                      await Reminder.findByIdAndDelete(reminder._id);
                      // Restart the reminders with the new goals
                      await setMastermindWeeklyGoalReminder(
                        bot,
                        authorID,
                        reminder.endTime,
                        journal.goals,
                        mastermindDocument.createdAt,
                        mastermindDocument._id,
                        reminder.remainingOccurrences
                      );
                    });
                  }

                  break;
                }
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
                userEdit = fn.timeCommandHandlerToUTC(
                  userEdit,
                  now,
                  timezoneOffset,
                  daylightSaving
                );
                if (!userEdit) {
                  fn.sendReplyThenDelete(
                    message,
                    `**INVALID TIME**... Try** \`${PREFIX}date\` **for help with **dates and times!**`,
                    60000
                  );
                  continueEdit = true;
                } else userEdit -= HOUR_IN_MS * timezoneOffset;
                createdAt = userEdit;
              }
            } else continueEdit = true;
            console.log({ userEdit });
            if (!continueEdit) {
              try {
                console.log(
                  `Editing ${authorID}'s Mastermind ${pastNumberOfEntriesIndex} (${sortType})`
                );
                if (fieldToEditIndex === 0) {
                  mastermindDocument = await Mastermind.findOneAndUpdate(
                    { _id: mastermindTargetID },
                    { $set: { createdAt } },
                    { new: true }
                  );
                } else
                  mastermindDocument = await Mastermind.findOneAndUpdate(
                    { _id: mastermindTargetID },
                    { $set: { journal } },
                    { new: true }
                  );
                console.log({ continueEdit });
                if (mastermindDocument) {
                  pastNumberOfEntriesIndex = indexByRecency
                    ? await fn.getEntryIndexByFunction(
                        authorID,
                        mastermindTargetID,
                        totalMastermindNumber,
                        getOneMastermindByRecency
                      )
                    : await fn.getEntryIndexByFunction(
                        authorID,
                        mastermindTargetID,
                        totalMastermindNumber,
                        getOneMastermindByCreatedTime
                      );
                  console.log({
                    mastermindDocument,
                    mastermindTargetID,
                    fieldToEditIndex,
                  });
                  showMastermind = mastermindDocumentToString(
                    bot,
                    mastermindDocument
                  );
                  const continueEditMessage = `Do you want to continue **editing Mastermind ${pastNumberOfEntriesIndex}?:**\n\n__**Mastermind ${pastNumberOfEntriesIndex}:**__\n${showMastermind}`;
                  continueEdit = await fn.getUserConfirmation(
                    bot,
                    message,
                    PREFIX,
                    continueEditMessage,
                    forceSkip,
                    `Mastermind: Continue Editing Mastermind ${pastNumberOfEntriesIndex}?`,
                    300000
                  );
                } else {
                  message.reply("**Mastermind not found...**");
                  continueEdit = false;
                }
              } catch (err) {
                return console.log(err);
              }
            } else {
              console.log({ continueEdit, userEdit });
              mastermindDocument = await Mastermind.findById(
                mastermindTargetID
              );
              if (mastermindDocument) {
                pastNumberOfEntriesIndex = indexByRecency
                  ? await fn.getEntryIndexByFunction(
                      authorID,
                      mastermindTargetID,
                      totalMastermindNumber,
                      getOneMastermindByRecency
                    )
                  : await fn.getEntryIndexByFunction(
                      authorID,
                      mastermindTargetID,
                      totalMastermindNumber,
                      getOneMastermindByCreatedTime
                    );
                console.log({
                  mastermindDocument,
                  mastermindTargetID,
                  fieldToEditIndex,
                });
                showMastermind = mastermindDocumentToString(
                  bot,
                  mastermindDocument
                );
              } else {
                message.reply("**Mastermind not found...**");
                continueEdit = false;
              }
            }
          } while (continueEdit === true);
          return;
        }
      } else return message.reply(mastermindActionHelpMessage);
    } else if (
      mastermindCommand === "habit" ||
      mastermindCommand === "habits" ||
      mastermindCommand === "hab" ||
      mastermindCommand === "hb" ||
      mastermindCommand === "h"
    ) {
      const userMasterminds = await Mastermind.find({ userID: authorID }).sort({
        _id: -1,
      });
      if (userMasterminds)
        if (userMasterminds.length) {
          var reset;
          do {
            reset = false;
            var mastermindList = "";
            userMasterminds.forEach((mastermind, i) => {
              mastermindList += `\`${i + 1}\` - **__${fn.timestampToDateString(
                mastermind.createdAt,
                true,
                true,
                true
              )}__**\n${fn.goalArrayToString(
                mastermind.journal.goals,
                "Weekly",
                false,
                true,
                false
              )}`;
              if (i !== userMasterminds.length - 1) {
                mastermindList += "\n\n";
              }
            });
            const targetMastermindIndex = await fn.userSelectFromList(
              bot,
              message,
              PREFIX,
              mastermindList,
              userMasterminds.length,
              "**Enter the number corresponding to the mastermind entry for which you want to convert the weekly goals into habits:**\n",
              "Mastermind: Weekly Goals To Habits",
              mastermindEmbedColour,
              600000
            );
            if (!targetMastermindIndex && targetMastermindIndex !== 0) return;
            else {
              const successfullySetHabits = await hb.setMastermindHabits(
                bot,
                message,
                PREFIX,
                commandUsed,
                timezoneOffset,
                daylightSaving,
                userMasterminds[targetMastermindIndex],
                userSettings
              );
              if (!successfullySetHabits) return;
            }
            const setMoreHabits = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              "Would you like to convert another mastermind weekly goal into a habit?",
              false,
              "Mastermind: Weekly Goal Convert Another Habit",
              180000
            );
            if (!setMoreHabits) return;
            else reset = true;
          } while (reset);
          return;
        }
      return message.reply(
        `**No mastermind entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`
      );
    } else if (
      mastermindCommand === "reminder" ||
      mastermindCommand === "reminders" ||
      mastermindCommand === "remind" ||
      mastermindCommand === "remindme" ||
      mastermindCommand === "rem" ||
      mastermindCommand === "re" ||
      mastermindCommand === "r"
    ) {
      const userMasterminds = await Mastermind.find({ userID: authorID }).sort({
        _id: -1,
      });
      if (userMasterminds)
        if (userMasterminds.length) {
          var reset;
          do {
            reset = false;
            var mastermindList = "";
            userMasterminds.forEach((mastermind, i) => {
              mastermindList += `\`${i + 1}\` - **__${fn.timestampToDateString(
                mastermind.createdAt,
                true,
                true,
                true
              )}__**\n${fn.goalArrayToString(
                mastermind.journal.goals,
                "Weekly",
                false,
                true,
                false
              )}`;
              if (i !== userMasterminds.length - 1) {
                mastermindList += "\n\n";
              }
            });
            const targetMastermindIndex = await fn.userSelectFromList(
              bot,
              message,
              PREFIX,
              mastermindList,
              userMasterminds.length,
              "**Enter the number corresponding to the mastermind entry you want weekly goal reminders for:**\n",
              "Mastermind: Weekly Goal Reminder",
              mastermindEmbedColour,
              600000
            );
            if (!targetMastermindIndex && targetMastermindIndex !== 0) return;
            else {
              const targetMastermind = userMasterminds[targetMastermindIndex];
              const confirmSelection = await fn.getUserConfirmation(
                bot,
                message,
                PREFIX,
                `Are you sure you want reminders for the mastermind created on **__${fn.timestampToDateString(
                  targetMastermind.createdAt,
                  true,
                  true,
                  true
                )}__**?\n\n${fn.goalArrayToString(
                  targetMastermind.journal.goals,
                  "Weekly",
                  false,
                  true,
                  false
                )}\n\n**(If yes, you can adjust when you want the reminder to start and how many times you want it)**`,
                forceSkip,
                "Mastermind: Weekly Goal Reminder Confirmation",
                180000
              );
              if (confirmSelection === false) break;
              else if (confirmSelection === null) return;
              else {
                const setReminder = await setUserMastermindReminder(
                  bot,
                  message,
                  PREFIX,
                  timezoneOffset,
                  daylightSaving,
                  targetMastermind
                );
                if (!setReminder) return;
              }
            }
            const setMoreReminders = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              "Would you like to set another mastermind weekly goal reminder?",
              false,
              "Mastermind: Weekly Goal Reminder Continue",
              180000
            );
            if (!setMoreReminders) return;
            else reset = true;
          } while (reset);
          return;
        }
      return message.reply(
        `**No mastermind entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`
      );
    } else if (mastermindCommand === "post" || mastermindCommand === "p") {
      if (!totalMastermindNumber)
        return message.reply(
          `**No mastermind entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`
        );
      if (args[1] !== undefined) {
        let mastermindIndex = isNaN(args[1])
          ? args[1].toLowerCase()
          : parseInt(args[1]);
        let indexByRecency = false;
        if (mastermindIndex === "recent") {
          mastermindIndex = 1;
          indexByRecency = true;
        } else if (args[2] !== undefined) {
          if (isNaN(args[2])) {
            if (args[2].toLowerCase === "recent") {
              indexByRecency = true;
            }
          }
        } else if (isNaN(args[1]))
          return message.reply(
            `**Please enter a number or \"recent\" after \`${PREFIX}${commandUsed} ${mastermindCommand} <# | recent>\`**`
          );
        mastermindIndex--;
        if (mastermindIndex < 0 || mastermindIndex >= totalMastermindNumber) {
          return message.reply(
            `**Mastermind ${mastermindIndex + 1} does not exist**`
          );
        }
        var mastermind;
        if (indexByRecency)
          mastermind = await getOneMastermindByRecency(
            authorID,
            mastermindIndex
          );
        else
          mastermind = await getOneMastermindByCreatedTime(
            authorID,
            mastermindIndex
          );
        const sortType = indexByRecency ? "By Recency" : "By Date Created";
        const targetChannel = await fn.getTargetChannel(
          bot,
          message,
          PREFIX,
          `Mastermind ${sortType}`,
          forceSkip,
          true,
          false,
          true,
          mastermindEmbedColour
        );
        if (!targetChannel) return;
        console.log({ targetChannel });
        if (!guildID) guildID = bot.channels.cache.get(targetChannel).guild.id;
        console.log({ guildID });
        const member = bot.guilds.cache.get(guildID).member(authorID);
        const posts = fn.getEmbedArray(
          mastermindDocumentToString(bot, mastermind),
          `${
            member ? `${member.displayName}'s ` : ""
          }Mastermind Reflection - ${fn.timestampToDateString(
            mastermind.createdAt,
            false,
            true,
            true
          )}`,
          true,
          false,
          mastermindEmbedColour
        );
        posts.forEach(async (post) => {
          await fn.sendMessageToChannel(bot, post, targetChannel);
        });
      } else message.channel.send(mastermindActionHelpMessage);
      return;
    } else if (
      mastermindCommand === "template" ||
      mastermindCommand === "templates" ||
      mastermindCommand === "temp" ||
      mastermindCommand === "t"
    ) {
      let templateUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${mastermindCommand} <NUMBER_OF_USERS> <NAMES>\`\n\n\`<NUMBER_OF_USERS>\`: **10** (**any number**)\n\n\`<NAMES>\`: Enter names of people in mastermind meeting\n***(COMMA SEPARATED, spaces in between are optional)***\n(i.e. \`Paul, Radeesh, David, Kenneth, Kurt, Angel, Luke, Josh, Ragel, Sharran, Justin\`)`;
      templateUsageMessage = fn.getMessageEmbed(
        templateUsageMessage,
        "Mastermind: Help",
        mastermindEmbedColour
      );
      const templateHelpMessage = `Try \`${PREFIX}${commandUsed} ${mastermindCommand} help\``;
      const invalidTemplateNumber =
        "**INVALID INPUT**... Enter a **positive number > 1!**";
      let numberOfUsers = args[1];
      if (isNaN(numberOfUsers)) {
        if (numberOfUsers !== undefined) {
          numberOfUsers = numberOfUsers.toLowerCase();
          if (numberOfUsers == "help") {
            message.channel.send(templateUsageMessage);
            return;
          }
        } else {
          message.reply(templateHelpMessage);
          return;
        }
      } else {
        numberOfUsers = parseInt(numberOfUsers);
        if (numberOfUsers <= 0) {
          fn.sendErrorMessageAndUsage(
            message,
            templateHelpMessage,
            invalidTemplateNumber
          );
          return;
        }
      }
      // "Template" Variable Declarations
      const confirmTemplateGenerationMessage = `Are you sure you want to **generate a mastermind template for ${numberOfUsers} user(s)?**`;
      const confirmTemplateGenerationTitle = `Mastermind: Confirm ${numberOfUsers} User Template`;
      var namesForTemplate = new Array();
      console.log({ numberOfUsers });
      let userConfirmation = await fn.getUserConfirmation(
        bot,
        message,
        PREFIX,
        confirmTemplateGenerationMessage,
        forceSkip,
        confirmTemplateGenerationTitle,
        30000
      );
      if (userConfirmation === false) return;
      if (args[2] !== undefined) {
        var names = args;
        // Filter out the empty inputs due to multiple commas (e.g. ",,,, ,,, ,   ,")
        namesForTemplate = names
          .slice(2)
          .join("")
          .split(",")
          .filter((name) => name != "");
        console.log({ namesForTemplate });
      }
      // Use WeeklyJournalEntry function to create empty entries and format in backticks for Discord markdown
      await sendGeneratedTemplate(
        bot,
        message,
        numberOfUsers,
        namesForTemplate,
        true,
        mastermindEmbedColour
      );
      return;
    } else return message.reply(mastermindHelpMessage);
  },
};
