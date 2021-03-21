const Discord = require("discord.js");
const Habit = require("../database/schemas/habit");
const Log = require("../database/schemas/habittracker");
const User = require("../database/schemas/user");
const Goal = require("../database/schemas/longtermgoals");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const hb = require("../../utilities/habit");
const del = require("../../utilities/deletion");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const timeExamples = fn.timeExamples;
const streakHabitMax = fn.streakHabitMaxTier1;
const habitMax = fn.habitMaxTier1;
const habitArchiveMax = fn.habitArchiveMaxTier1;
const habitEmbedColour = fn.habitEmbedColour;
const areasOfLifeEmojis = fn.areasOfLifeEmojis;
const areasOfLife = fn.areasOfLife;
const areasOfLifeCombinedEmoji = fn.getAreasOfLifeEmojiCombinedArray();
const areasOfLifeList = fn.getAreasOfLifeList().join("\n");
const checkMissedSkipList =
  "\n`1` - **Check** ✅\n`2` - **Missed** ❌\n`3` - **Skip** ⏭ (still counts as a check)";

// Private Function Declarations
async function multipleHabitsToStringArray(
  bot,
  message,
  habitArray,
  numberOfHabits,
  entriesToSkip = 0,
  toString = false,
  showConnectedGoal = false,
  showRecentStats = false,
  showSettings = false,
  showTotalStats = false,
  pastXDays = 0
) {
  var habitsToString = new Array();
  console.log({ numberOfHabits });
  for (let i = 0; i < numberOfHabits; i++) {
    if (habitArray[i] === undefined) {
      numberOfHabits = i;
      fn.sendErrorMessage(
        message,
        `**HABITS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`
      );
      break;
    }
    const habitString = `__**Habit ${
      i + entriesToSkip + 1
    }:**__ ${await hb.habitDocumentToString(
      bot,
      habitArray[i],
      showConnectedGoal,
      showRecentStats,
      showSettings,
      showTotalStats,
      pastXDays
    )}`;
    habitsToString.push(habitString);
  }
  if (toString) habitsToString = habitsToString.join("\n\n");
  return habitsToString;
}

async function getRecentHabit(
  bot,
  userID,
  isArchived,
  embedColour,
  showConnectedGoal = false,
  showRecentStats = false,
  showSettings = false,
  showTotalStats = false
) {
  const recentHabitToString = `__**Habit ${await hb.getRecentHabitIndex(
    userID,
    isArchived
  )}:**__${await hb.habitDocumentToString(
    bot,
    await hb.getOneHabitByRecency(userID, 0, isArchived),
    showConnectedGoal,
    showRecentStats,
    showSettings,
    showTotalStats
  )}`;
  const habitEmbed = fn.getMessageEmbed(
    recentHabitToString,
    `Habit: See Recent Habit`,
    embedColour
  );
  return habitEmbed;
}

async function getHabitsByCreatedAt(
  userID,
  entryIndex,
  numberOfEntries = 1,
  archived = undefined
) {
  try {
    const habits = await Habit.find({ userID, archived })
      .sort({ createdAt: +1 })
      .limit(numberOfEntries)
      .skip(entryIndex);
    return habits;
  } catch (err) {
    console.log(err);
    return false;
  }
}

module.exports = {
  name: "habit",
  description: "Habit Tracker",
  aliases: ["habits", "hab", "ha", "h"],
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
    // create, archive, current, see <progress for this habit>, pastweek (as per Sunday reset), past <number>
    // see - show stats
    // Allow users to check habit ✅, 🔲, *SKIP habit if something happends (leave a ⏭)
    // Set Habit Description - 50 words or less!
    // LAST Habit check-in time/date

    // When posting or editing habit: Allow them to choose to repost or just edit existing and
    // Prompt users to strike through their previous number count (for number based habits)!

    // Connect with mastermind to be able to make a few weekly habits into a habit (comma separate which habits to transform)
    // FOR SUPER quick and easy habit logging for the week!

    const authorID = message.author.id;
    const authorUsername = message.author.username;
    let userSettings = await User.findOne({ discordID: authorID });
    const { tier } = userSettings;
    let { habitCron } = userSettings;
    let habitUsageMessage =
      `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\`` +
      `\n\n\`<ACTION>\`: **add; see; log/end; delete; edit; archive; post; today; stats/statistics; past (stats on past x days);**\n\n*__ALIASES:__* **${
        this.name
      } - ${this.aliases.join("; ")}**`;
    habitUsageMessage = fn.getMessageEmbed(
      habitUsageMessage,
      "Habit: Help",
      habitEmbedColour
    );
    const habitHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
    const habitCommand = args[0].toLowerCase();
    const habitActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${habitCommand} help\``;
    let habitType = args[1] ? args[1].toLowerCase() : false;
    let totalStreakNumber = await Habit.find({
      userID: authorID,
      archived: false,
      "settings.autoLogType": 1,
    }).countDocuments();
    let totalHabitNumber = await Habit.find({
      userID: authorID,
      archived: false,
    }).countDocuments();
    let totalArchiveNumber = await Habit.find({
      userID: authorID,
      archived: true,
    }).countDocuments();
    const archiveRegex = /^(archive[ds]?|arch|ar?)$/i;
    let isArchived = archiveRegex.test(habitType);
    const archiveShift = isArchived ? 1 : 0;
    console.log({ isArchived, archiveShift });

    if (habitCommand === "help") return message.channel.send(habitUsageMessage);
    else if (
      habitCommand === "start" ||
      habitCommand === "create" ||
      habitCommand === "s" ||
      habitCommand === "set" ||
      habitCommand === "st" ||
      habitCommand === "c" ||
      habitCommand === "cr" ||
      habitCommand === "make" ||
      habitCommand === "m" ||
      habitCommand === "add" ||
      habitCommand === "a"
    ) {
      if (tier === 1) {
        if (totalHabitNumber >= habitMax) {
          return message.channel.send(
            fn
              .getMessageEmbed(
                fn.getTierMaxMessage(
                  PREFIX,
                  commandUsed,
                  habitMax,
                  ["Habit", "Habits"],
                  1,
                  false
                ),
                `Habit: Tier 1 Maximum`,
                habitEmbedColour
              )
              .setFooter(fn.premiumFooterText)
          );
        }
      }
      /**
       * Iteratively create new habits until the user is finished!
       */

      // message.channel.send(await hb.habitDocumentToString(bot, await Habit.findOne({ userID: authorID, archived: false, }), true, true));
      var habitDocument, reset;
      const additionalInstructions = `Type \`reset\` to **reset** your current habit entry`;
      const additionalKeywords = ["reset"];
      do {
        reset = false;
        // Type Integration?: Give a selection if yes show all of the options, automark ✅
        // else: proceed with the following
        const habitDescription = await fn.getSingleEntryWithCharacterLimit(
          bot,
          message,
          PREFIX,
          "👣 **What is the __habit__ you'd like to track?** 📈\n(Within 100 characters)",
          "Habit: Creation - Description",
          100,
          "a habit description",
          forceSkip,
          habitEmbedColour,
          additionalInstructions,
          additionalKeywords
        );
        if (!habitDescription && habitDescription !== "") return;
        else if (habitDescription === "reset") {
          reset = true;
          continue;
        }

        const habitDescriptionString = `__**Description:**__\n${habitDescription}`;
        const habitAreaOfLife = await fn.userSelectFromList(
          bot,
          message,
          PREFIX,
          areasOfLifeList,
          areasOfLife.length,
          `${habitDescriptionString}\n\n**__Which area of life does your habit fall under?__** 🌱`,
          `Habit: Creation - Area of Life`,
          habitEmbedColour
        );
        if (!habitAreaOfLife && habitAreaOfLife !== 0) return;

        const habitTypeString = `__**Type:**__ ${areasOfLifeEmojis[habitAreaOfLife]} **${areasOfLife[habitAreaOfLife]}**\n${habitDescriptionString}`;

        let specifics = await hb.getHabitSpecifics(
          bot,
          message,
          PREFIX,
          forceSkip,
          "Habit: Creation - Specifics",
          habitEmbedColour,
          `${habitTypeString}`
        );
        if (!specifics) return;
        else specifics = specifics.message;

        let habitReason = await fn.getMultilineEntry(
          bot,
          message,
          PREFIX,
          habitTypeString +
            "\n\n💭 **__Why__ do you want to incorporate this habit into your lifestyle?**\n(Within 1000 characters)",
          "Habit: Creation - Reason",
          true,
          habitEmbedColour,
          1000,
          additionalInstructions,
          additionalKeywords
        );
        if (!habitReason.message && habitReason.message !== "") return;
        else if (habitReason.returnVal === "reset") {
          reset = true;
          continue;
        } else habitReason = habitReason.message;

        const goalDocuments = await Goal.find(
          { userID: authorID, archived: false, completed: false },
          { _id: 1, description: 1 }
        ).sort({ start: +1 });
        var connectedGoal;
        if (goalDocuments)
          if (goalDocuments.length) {
            const selectionInstructions = `${habitDescriptionString}\n\n**__Which goal is this habit connected to, if any?__** 🔗`;
            const selectionTitle = "Habit: Creation - Connected Goal";
            const selectedGoal = await fn.getUserSelectedObject(
              bot,
              message,
              PREFIX,
              selectionInstructions,
              selectionTitle,
              goalDocuments,
              "description",
              false,
              habitEmbedColour,
              600000,
              0,
              null,
              ["**Skip/None**"]
            );
            if (!selectedGoal) return;
            else {
              if (selectedGoal.index === goalDocuments.length + 1)
                connectedGoal = undefined;
              // Assuming this is the skip option
              else
                connectedGoal = selectedGoal.object
                  ? selectedGoal.object._id
                  : undefined;
            }
          }

        userSettings = await User.findOne({ discordID: authorID });
        habitCron = userSettings.habitCron;
        let cronSettings = `**Daily Streak Reset Time:** ${fn.msToTimeFromMidnight(
          habitCron.daily
        )}\n**Weekly Reset Day:** ${fn.getDayOfWeekToString(habitCron.weekly)}`;

        let cronType = await fn.userSelectFromList(
          bot,
          message,
          PREFIX,
          "\n`1` - **Daily Reset** 🌇\n`2` - **Weekly Reset** 📅",
          2,
          `**__When do you want this habit's streaks to reset?__** ⌚\n(You can specify after how many reset days or weeks the streak should reset in the next window)\n\n${cronSettings}\n\nType** \`${PREFIX}user edit\` **after finishing creating this habit - to change the settings shown above`,
          "Habit: Creation - Streak Reset",
          habitEmbedColour
        );
        if (!cronType && cronType !== 0) return;
        let isWeeklyType = false;
        if (cronType === 1) isWeeklyType = true;

        cronSettings = isWeeklyType
          ? `**Weekly Reset Day:** ${fn.getDayOfWeekToString(
              habitCron.weekly
            )} at ${fn.msToTimeFromMidnight(habitCron.daily)}`
          : `**Daily Streak Reset Time:** ${fn.msToTimeFromMidnight(
              habitCron.daily
            )}`;
        const advancedSettings = await fn.userSelectFromList(
          bot,
          message,
          PREFIX,
          "\n`1` - **Default Settings**\n`2` - **Advanced Settings**",
          2,
          `**__Would you like to use the default settings or change them?__** ⚙\n\n${cronSettings}\n**Habit Streak Reset Period:** Every ${
            isWeeklyType ? "1 Week" : "1 Day"
          }\n**Includes Value to Count:** No\n- **Auto-Complete Based on Count:** No\n- **Auto-Complete as Streak:** No`,
          "Habit: Creation - Settings",
          habitEmbedColour
        );
        if (!advancedSettings && advancedSettings !== 0) return;

        var cronPeriods,
          isCountType,
          autoLogType,
          countGoal,
          countGoalType,
          countMetric;
        let goalTypeString = "";
        if (advancedSettings === 1) {
          cronPeriods = await fn.getNumberEntry(
            bot,
            message,
            PREFIX,
            `**__After how many ${
              isWeeklyType ? "weeks" : "days"
            } do you want this habit's streak to reset?__**\n\n${cronSettings}\n\n(Enter a number greater than 0)`,
            `Habit: Creation - Advanced Settings: Streak Reset ${
              isWeeklyType ? "Weeks" : "Days"
            }`,
            forceSkip,
            false,
            false,
            1,
            undefined,
            habitEmbedColour,
            additionalInstructions,
            additionalKeywords
          );
          if (!cronPeriods && cronPeriods !== "") return;
          else if (cronPeriods === "reset") {
            reset = true;
            continue;
          } else if (!isNaN(cronPeriods)) cronPeriods = parseInt(cronPeriods);
          else cronPeriods = 1;

          isCountType = await fn.userSelectFromList(
            bot,
            message,
            PREFIX,
            "\n`1` - **Yes** ✅\n`2` - **No** ❌",
            2,
            `**__Does this habit include a number value to track?__** 📈\n(e.g. number of pushups, minutes spent studying, etc.)`,
            "Habit: Creation - Advanced Settings: Count Value",
            habitEmbedColour
          );
          if (!isCountType && isCountType !== 0) return;
          if (isCountType === 0) isCountType = true;
          else isCountType = false;

          if (isCountType) {
            countMetric = await fn.getSingleEntryWithCharacterLimit(
              bot,
              message,
              PREFIX,
              "**__What metric are you tracking for this habit?__** 📏\n(Within 30 characters)\ne.g. Pushups, Hours Spend Studying",
              "Habit: Creation - Advanced Settings: Count Metric",
              30,
              "a count metric",
              forceSkip,
              habitEmbedColour,
              additionalInstructions,
              additionalKeywords
            );
            if (!countMetric && countMetric !== "") return;
            else if (countMetric === "reset") {
              reset = true;
              continue;
            }

            countGoalType = await fn.userSelectFromList(
              bot,
              message,
              PREFIX,
              "\n`1` - **Daily Goal** 🌇\n`2` - **Weekly Goal** 📅\n`3` - **Total/Cumulative Goal** 🔢",
              3,
              `**What kind of goal do you have for __${countMetric}__?**`,
              "Habit: Creation - Advanced Settings: Count Goal Type",
              habitEmbedColour
            );
            if (!countGoalType && countGoalType !== 0) return;
            else countGoalType++;
            goalTypeString = fn.getGoalTypeString(countGoalType);
            countGoal = await fn.getNumberEntry(
              bot,
              message,
              PREFIX,
              `**What is your ${goalTypeString} for __${countMetric}?__**\n\n(Enter a number)`,
              `Habit: Creation - Advanced Settings: Count Goal`,
              forceSkip,
              true,
              true,
              undefined,
              undefined,
              habitEmbedColour,
              additionalInstructions,
              additionalKeywords
            );
            if (!countGoal && countGoal !== 0) return;
            else if (countGoal === "reset") {
              reset = true;
              continue;
            }
          }
          const hasCountGoal = countGoal && countGoal !== 0;
          var noMoreStreakHabitsAtTier;
          switch (tier) {
            case 1:
              noMoreStreakHabitsAtTier =
                totalStreakNumber >= streakHabitMax && tier === 1;
              break;
            case 3:
              noMoreStreakHabitsAtTier = false;
              break;
            default:
              noMoreStreakHabitsAtTier = true;
              break;
          }
          if (!hasCountGoal && noMoreStreakHabitsAtTier) autoLogType = 0;
          else {
            autoLogType = await fn.userSelectFromList(
              bot,
              message,
              PREFIX,
              `\n\`1\` - **No** ⛔${
                noMoreStreakHabitsAtTier
                  ? ""
                  : `\n\`2\` - **Yes, As a Streak** (Every Reset Time) 🔄`
              }${
                hasCountGoal
                  ? `\n\`3\` - **Yes, Based on Count Goal** (When goal is reached after logging habit) 🔢`
                  : ""
              }`,
              (hasCountGoal ? 2 : 1) + (noMoreStreakHabitsAtTier ? 0 : 1),
              `**__Do you want the habit to automatically log/complete?__**\n(You can still manually log/edit your entries)\n${
                noMoreStreakHabitsAtTier
                  ? `P.S. You've reached your **maximum number of streak habits (${streakHabitMax}) for your tier level (${tier})**`
                  : ""
              }`,
              "Habit: Creation - Auto-Complete",
              habitEmbedColour
            );
            if (!autoLogType && autoLogType !== 0) return;
          }
        } else {
          cronPeriods = 1;
          isCountType = false;
        }

        userSettings = await User.findOne({ discordID: authorID });
        habitCron = userSettings.habitCron;
        timezoneOffset = userSettings.timezone.offset;
        const currentTimestamp = Date.now() + timezoneOffset * HOUR_IN_MS;
        const nextCron = fn.getNextCronTimeUTC(
          timezoneOffset,
          habitCron,
          isWeeklyType,
          cronPeriods,
          currentTimestamp
        );

        const habitID = mongoose.Types.ObjectId();
        let currentState = 0,
          currentStreak = 0,
          longestStreak = 0,
          pastWeek = 0,
          pastMonth = 0,
          pastYear = 0;
        if (autoLogType === 1) {
          currentState = 1;
          const log = new Log({
            _id: mongoose.Types.ObjectId(),
            timestamp:
              fn.getCurrentUTCTimestampFlooredToSecond() +
              timezoneOffset * HOUR_IN_MS,
            state: currentState,
            connectedDocument: habitID,
          });
          await log
            .save()
            .then((result) => {
              console.log({ result });
            })
            .catch((err) => console.error(err));
          longestStreak++;
          currentStreak++;
          pastWeek++;
          pastMonth++;
          pastYear++;
        }

        // Daily Reset or Weekly Reset?
        // Count Habit or Just check-in
        // Auto check based on count or streak

        /**
         * What type of habit is it?
         * What goal does this relate to?
         * Daily Reset or Weekly Reset?
         * Count Habit or Just check-in
         * Auto check based on count or streak
         *
         * INTEGRATION: Connect it to Fasts, Journals, Masterminds (DO LAST - as a final connection)
         * Fast:
         * Auto - Track when you fasted for X hours on that given day
         * Auto - Track if you've checked-in your fast
         * Auto - Track if you've entered something (at least started/ended your fast)
         * Journal:
         * Auto - Track when you just create and entry for the day
         * Auto - Track when you start and/or finish a template
         * Auto - Track when you enter X journal entries
         * Mastermind:
         * Auto - When you make an entry (weekly entry)
         * Auto - Ask if they'd like to track any number of their weekly habits as habit
         *
         * FOR ALL:
         * - Track when you just use it - X entries
         * -- Weekly or daily
         * - Check if there is an entry
         * - Track when you post an entry X times per day
         *
         * Goal:
         * - Ask them if they'd like to create a habit for the goal that they enter
         * -
         *
         * Will need to refactor the code for each command (for integration):
         * - Each start/end/edit/post command needs to update or create a log value
         *
         */

        habitDocument = new Habit({
          _id: habitID,
          userID: authorID,
          createdAt:
            fn.getCurrentUTCTimestampFlooredToSecond() +
            HOUR_IN_MS * timezoneOffset,
          archived: false,
          description: habitDescription,
          specifics,
          areaOfLife: habitAreaOfLife,
          reason: habitReason,
          connectedGoal,
          settings: {
            isCountType,
            countMetric,
            isWeeklyType,
            cronPeriods,
            autoLogType,
            countGoalType,
            countGoal,
          },
          nextCron,
          currentStreak,
          currentState,
          longestStreak,
          pastWeek,
          pastMonth,
          pastYear,
        });
        await habitDocument
          .save()
          .then(async (result) => {
            console.log({ result });
            await hb.habitCron(habitDocument, timezoneOffset, habitCron);
            totalHabitNumber++;
            message.reply(
              `**Habit ${await hb.getHabitIndexByFunction(
                authorID,
                habitDocument._id,
                totalHabitNumber,
                false,
                hb.getOneHabitByCreatedAt
              )} Saved!**`
            );
          })
          .catch((err) => console.error(err));

        const confirmReminder = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          `Do you want to set a **recurring reminder** for when you want to **log/complete this habit?**\n\n${habitDescription}`,
          false,
          "Habit: Completion Reminder",
          180000
        );
        if (!confirmReminder) return;
        await hb.setUserHabitReminder(
          bot,
          message,
          PREFIX,
          timezoneOffset,
          daylightSaving,
          commandUsed,
          authorID,
          habitDocument
        );
        return;
      } while (reset);
      return;
    } else if (
      habitCommand === "delete" ||
      habitCommand === "del" ||
      habitCommand === "d" ||
      habitCommand === "remove"
    ) {
      /**
       * Allow them to delete any habits - archived or not
       */

      let habitDeleteUsageMessage = hb.getHabitReadOrDeleteHelp(
        PREFIX,
        commandUsed,
        habitCommand
      );
      habitDeleteUsageMessage = fn.getMessageEmbed(
        habitDeleteUsageMessage,
        "Habit: Delete Help",
        habitEmbedColour
      );
      const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see ${
        isArchived ? `archive ` : ""
      }help\``;

      if (habitType) {
        if (habitType === "help") {
          return message.channel.send(habitDeleteUsageMessage);
        }
        if (!totalHabitNumber && !isArchived) {
          return message.reply(
            `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (!totalArchiveNumber && isArchived) {
          return message.reply(
            `**NO ARCHIVED HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        }
      } else return message.reply(habitActionHelpMessage);

      // delete past #:
      if (args[2 + archiveShift] !== undefined) {
        const deleteType = args[1 + archiveShift]
          ? args[1 + archiveShift].toLowerCase()
          : false;
        if (deleteType === "past") {
          // If the following argument is not a number, exit!
          if (isNaN(args[2 + archiveShift])) {
            return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage);
          }
          var numberArg = parseInt(args[2 + archiveShift]);
          if (numberArg <= 0) {
            return fn.sendErrorMessageAndUsage(message, habitActionHelpMessage);
          }
          let indexByRecency = false;
          if (args[3 + archiveShift] !== undefined) {
            if (args[3 + archiveShift].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          const sortType = indexByRecency ? "By Recency" : "By Date Created";
          var habitCollection;
          if (indexByRecency)
            habitCollection = await fn.getEntriesByRecency(
              Habit,
              { userID: authorID, archived: isArchived },
              0,
              numberArg
            );
          else
            habitCollection = await getHabitsByCreatedAt(
              authorID,
              0,
              numberArg,
              isArchived
            );
          const habitArray = fn.getEmbedArray(
            await multipleHabitsToStringArray(
              bot,
              message,
              habitCollection,
              numberArg,
              0,
              false,
              true,
              true,
              true,
              true
            ),
            "",
            true,
            false,
            habitEmbedColour
          );
          const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} habits?**`;
          const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            habitArray,
            multipleDeleteMessage,
            forceSkip,
            `Habit${
              isArchived ? ` Archive` : ""
            }: Delete Past ${numberArg} Habits (${sortType})`,
            600000
          );
          if (!multipleDeleteConfirmation) return;
          const targetIDs = await habitCollection.map((entry) => entry._id);
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Habits (${sortType})`
          );
          targetIDs.forEach((id) => {
            hb.cancelHabitById(id);
          });
          await del.deleteManyByIDAndConnectedReminders(Habit, targetIDs);
          return;
        }
        if (deleteType === "many") {
          if (args[2 + archiveShift] === undefined) {
            return message.reply(habitActionHelpMessage);
          }
          // Get the arguments after keyword MANY
          // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
          // Convert String of Numbers array into Integer array
          // Check which habits exist, remove/don't add those that don't
          let toDelete = args[2 + archiveShift].split(",").filter((index) => {
            if (!isNaN(index)) {
              numberIndex = parseInt(index);
              if (numberIndex > 0 && numberIndex <= totalHabitNumber) {
                return numberIndex;
              }
            } else if (index === "recent") {
              return true;
            }
          });
          const recentIndex = await hb.getRecentHabitIndex(
            authorID,
            isArchived
          );
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
              `All of these **${
                isArchived ? "archived " : ""
              }habits DO NOT exist**...`
            );
          }
          var indexByRecency = false;
          if (args[3 + archiveShift] !== undefined) {
            if (args[3 + archiveShift].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          var habitTargetIDs = new Array();
          var habitArray = new Array();
          for (let i = 0; i < toDelete.length; i++) {
            var habitView;
            if (indexByRecency) {
              habitView = await hb.getOneHabitByRecency(
                authorID,
                toDelete[i] - 1,
                isArchived
              );
            } else {
              habitView = await hb.getOneHabitByCreatedAt(
                authorID,
                toDelete[i] - 1,
                isArchived
              );
            }
            habitTargetIDs.push(habitView._id);
            habitArray.push(
              `__**Habit ${toDelete[i]}:**__ ${await hb.habitDocumentToString(
                bot,
                habitView,
                true,
                true,
                true,
                true
              )}`
            );
          }
          const deleteConfirmMessage = `Are you sure you want to **delete habits ${toDelete.toString()}?**`;
          const sortType = indexByRecency ? "By Recency" : "By Date Created";
          habitArray = fn.getEmbedArray(
            habitArray,
            "",
            true,
            false,
            habitEmbedColour
          );
          const confirmDeleteMany = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            habitArray,
            deleteConfirmMessage,
            forceSkip,
            `Habit${
              isArchived ? ` Archive` : ""
            }: Delete Habits ${toDelete} (${sortType})`,
            600000
          );
          if (confirmDeleteMany) {
            console.log(
              `Deleting ${authorID}'s Habits ${toDelete} (${sortType})`
            );
            habitTargetIDs.forEach((id) => {
              hb.cancelHabitById(id);
            });
            await del.deleteManyByIDAndConnectedReminders(
              Habit,
              habitTargetIDs
            );
            return;
          } else return;
        } else {
          var shiftIndex;
          let indexByRecency = false;
          if (args[2 + archiveShift].toLowerCase() === "past") {
            shiftIndex = 0;
            indexByRecency = false;
          } else if (args[2 + archiveShift].toLowerCase() === "recent") {
            shiftIndex = 1;
            indexByRecency = true;
          }
          console.log({ shiftIndex });
          if (args[2 + archiveShift + shiftIndex]) {
            if (args[2 + archiveShift + shiftIndex].toLowerCase() === "past") {
              var skipEntries;
              if (isNaN(args[3 + archiveShift + shiftIndex])) {
                if (
                  args[3 + archiveShift + shiftIndex].toLowerCase() === "recent"
                ) {
                  skipEntries = await hb.getRecentHabitIndex(
                    authorID,
                    isArchived
                  );
                } else return message.reply(habitActionHelpMessage);
              } else
                skipEntries = parseInt(args[3 + archiveShift + shiftIndex]);
              const pastNumberOfEntries = parseInt(args[1 + archiveShift]);
              if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                return fn.sendErrorMessageAndUsage(
                  message,
                  habitActionHelpMessage
                );
              }
              var habitCollection;
              if (indexByRecency)
                habitCollection = await fn.getEntriesByRecency(
                  Habit,
                  { userID: authorID, archived: isArchived },
                  skipEntries,
                  pastNumberOfEntries
                );
              else
                habitCollection = await getHabitsByCreatedAt(
                  authorID,
                  skipEntries,
                  pastNumberOfEntries,
                  isArchived
                );
              const habitArray = fn.getEmbedArray(
                await multipleHabitsToStringArray(
                  bot,
                  message,
                  habitCollection,
                  pastNumberOfEntries,
                  skipEntries,
                  false,
                  true,
                  true,
                  true,
                  true
                ),
                "",
                true,
                false,
                habitEmbedColour
              );
              if (skipEntries >= totalHabitNumber) return;
              const sortType = indexByRecency
                ? "By Recency"
                : "By Date Created";
              const multipleDeleteMessage = `Are you sure you want to **delete ${habitCollection.length} habits past habit ${skipEntries}?**`;
              const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
                bot,
                message,
                PREFIX,
                habitArray,
                multipleDeleteMessage,
                forceSkip,
                `Habit${
                  isArchived ? ` Archive` : ""
                }: Multiple Delete Warning! (${sortType})`
              );
              console.log({ multipleDeleteConfirmation });
              if (!multipleDeleteConfirmation) return;
              const targetIDs = await habitCollection.map((entry) => entry._id);
              console.log(
                `Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} habits past ${skipEntries} (${sortType})`
              );
              targetIDs.forEach((id) => {
                hb.cancelHabitById(id);
              });
              await del.deleteManyByIDAndConnectedReminders(Habit, targetIDs);
              return;
            }

            // They haven't specified the field for the habit delete past function
            else if (deleteType === "past")
              return message.reply(habitActionHelpMessage);
            else return message.reply(habitActionHelpMessage);
          }
        }
      }
      // Next: HABIT DELETE ALL
      // Next: HABIT DELETE MANY
      // Next: HABIT DELETE

      // habit delete <NUMBER/RECENT/ALL>
      const noHabitsMessage = `**NO ${
        isArchived ? "ARCHIVED " : ""
      }HABITS**... try \`${PREFIX}${commandUsed} start help\``;
      if (isNaN(args[1 + archiveShift])) {
        const deleteType = habitType;
        if (deleteType === "recent") {
          const habitView = await hb.getOneHabitByRecency(
            authorID,
            0,
            isArchived
          );
          if (!habitView) return fn.sendErrorMessage(message, noHabitsMessage);
          const habitTargetID = habitView._id;
          console.log({ habitTargetID });
          const habitIndex = await hb.getRecentHabitIndex(authorID, isArchived);
          const habitEmbed = fn.getEmbedArray(
            `__**Habit ${habitIndex}:**__ ${await hb.habitDocumentToString(
              bot,
              habitView,
              true,
              true,
              true,
              true
            )}`,
            `Habit${isArchived ? " Archive" : ""}: Delete Recent Habit`,
            true,
            false,
            habitEmbedColour
          );
          const deleteConfirmMessage = `Are you sure you want to **delete your most recent habit?**`;
          const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            habitEmbed,
            deleteConfirmMessage,
            forceSkip,
            `Habit${isArchived ? " Archive" : ""}: Delete Recent Habit`,
            600000
          );
          if (deleteIsConfirmed) {
            hb.cancelHabitById(habitTargetID);
            await del.deleteOneByIDAndConnectedReminders(Habit, habitTargetID);
            return;
          }
        } else if (deleteType === "all") {
          const confirmDeleteAllMessage = `Are you sure you want to **delete all** of your recorded habits?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          const pastNumberOfEntriesIndex = totalHabitNumber;
          if (pastNumberOfEntriesIndex === 0) {
            return fn.sendErrorMessage(message, noHabitsMessage);
          }
          let confirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            confirmDeleteAllMessage,
            forceSkip,
            `Habit${isArchived ? ` Archive` : ""}: Delete All Habits WARNING!`
          );
          if (!confirmDeleteAll) return;
          const finalDeleteAllMessage = `Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR HABITS ON RECORD**?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          let finalConfirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            finalDeleteAllMessage,
            `Habit${
              isArchived ? ` Archive` : ""
            }: Delete ALL Habits FINAL Warning!`
          );
          if (!finalConfirmDeleteAll) return;

          console.log(
            `Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Habits`
          );
          const reminderQuery = { userID: authorID };
          const userHabits = await Reminder.find(reminderQuery);
          userHabits.forEach(async (habit) => {
            hb.cancelHabitById(habit._id);
          });
          await del.deleteManyAndConnectedReminders(Habit, reminderQuery);
          return;
        } else return message.reply(habitActionHelpMessage);
      } else {
        const pastNumberOfEntriesIndex = parseInt(args[1 + archiveShift]);
        let indexByRecency = false;
        if (args[2 + archiveShift] !== undefined) {
          if (args[2 + archiveShift].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }
        var habitView;
        if (indexByRecency)
          habitView = await hb.getOneHabitByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1,
            isArchived
          );
        else
          habitView = await hb.getOneHabitByCreatedAt(
            authorID,
            pastNumberOfEntriesIndex - 1,
            isArchived
          );
        if (!habitView) {
          return fn.sendErrorMessageAndUsage(
            message,
            trySeeCommandMessage,
            `**${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST**...`
          );
        }
        const habitTargetID = habitView._id;
        const sortType = indexByRecency ? "By Recency" : "By Date Created";
        const habitEmbed = fn.getEmbedArray(
          `__**Habit ${pastNumberOfEntriesIndex}:**__ ${await hb.habitDocumentToString(
            bot,
            habitView,
            true,
            true,
            true,
            true
          )}`,
          `Habit${
            isArchived ? ` Archive` : ""
          }: Delete Habit ${pastNumberOfEntriesIndex} (${sortType})`,
          true,
          false,
          habitEmbedColour
        );
        const deleteConfirmMessage = `Are you sure you want to **delete Habit ${pastNumberOfEntriesIndex}?**`;
        const deleteConfirmation = await fn.getPaginatedUserConfirmation(
          bot,
          message,
          PREFIX,
          habitEmbed,
          deleteConfirmMessage,
          forceSkip,
          `Habit${
            isArchived ? ` Archive` : ""
          }: Delete Habit ${pastNumberOfEntriesIndex} (${sortType})`,
          600000
        );
        if (deleteConfirmation) {
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Habit ${sortType}`
          );
          hb.cancelHabitById(habitTargetID);
          await del.deleteOneByIDAndConnectedReminders(Habit, habitTargetID);
          return;
        }
      }
    } else if (habitCommand === "see" || habitCommand === "show") {
      let habitSeeUsageMessage = hb.getHabitReadOrDeleteHelp(
        PREFIX,
        commandUsed,
        habitCommand
      );
      habitSeeUsageMessage = fn.getMessageEmbed(
        habitSeeUsageMessage,
        `Habit${isArchived ? ` Archive` : ""}: See Help`,
        habitEmbedColour
      );

      const seeCommands = ["past", "recent", "all"];

      if (habitType) {
        if (habitType === "help") {
          return message.channel.send(habitSeeUsageMessage);
        }
        if (!totalHabitNumber && !isArchived) {
          return message.reply(
            `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (!totalArchiveNumber && isArchived) {
          return message.reply(
            `**NO ARCHIVED HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (
          (args[1 + archiveShift]
            ? args[1 + archiveShift].toLowerCase()
            : false) === "number"
        ) {
          if (isArchived)
            return message.reply(
              `You have **${totalArchiveNumber} archived habits entries** on record.`
            );
          else
            return message.reply(
              `You have **${totalHabitNumber} habits entries** on record.`
            );
        }
      } else return message.reply(habitActionHelpMessage);

      // Show the user the last habit with the most recent end time (by sorting from largest to smallest end time and taking the first):
      // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort.
      // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
      if (
        !seeCommands.includes(habitType) &&
        !archiveRegex.test(habitType) &&
        isNaN(habitType)
      ) {
        return message.reply(habitActionHelpMessage);
      }
      // Do not show the most recent habit embed, when a valid command is called
      // it will be handled properly later based on the values passed in!
      else {
        const seeType = args[1 + archiveShift]
          ? args[1 + archiveShift].toLowerCase()
          : false;
        var pastFunctionality, habitIndex;
        let indexByRecency = false;
        // To check if the given argument is a number!
        // If it's not a number and has passed the initial
        // filter, then use the "past" functionality
        // Handling Argument 1:
        const isNumberArg = !isNaN(args[1 + archiveShift]);
        if (seeType === "recent") {
          return message.channel.send(
            await getRecentHabit(
              bot,
              authorID,
              isArchived,
              habitEmbedColour,
              true,
              true
            )
          );
        } else if (seeType === "all") {
          if (isArchived) {
            if (totalArchiveNumber) {
              habitIndex = totalArchiveNumber;
            }
          } else {
            if (totalHabitNumber) {
              habitIndex = totalHabitNumber;
            }
          }
          pastFunctionality = true;
          if (habitIndex === undefined) {
            return fn.sendErrorMessageAndUsage(
              message,
              habitActionHelpMessage,
              `**You have NO ${isArchived ? "ARCHIVED " : ""}HABITS**...`
            );
          }
        } else if (isNumberArg) {
          habitIndex = parseInt(args[1 + archiveShift]);
          if (habitIndex <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              habitActionHelpMessage,
              `**${isArchived ? "ARCHIVED " : ""}HABIT DOES NOT EXIST **...`
            );
          } else pastFunctionality = false;
        } else if (seeType === "past") {
          pastFunctionality = true;
        }
        // After this filter:
        // If the first argument after "see" is not past, then it is not a valid call
        else return message.reply(habitActionHelpMessage);
        console.log({
          pastNumberOfEntriesIndex: habitIndex,
          pastFunctionality,
        });
        if (pastFunctionality) {
          // Loop through all of the given fields, account for aliases and update fields
          // Find Habits, toArray, store data in meaningful output
          if (args[3 + archiveShift] !== undefined) {
            if (args[3 + archiveShift].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          const sortType = indexByRecency ? "By Recency" : "By Date Created";
          if (args[2 + archiveShift] !== undefined) {
            // If the next argument is NotaNumber, invalid "past" command call
            if (isNaN(args[2 + archiveShift]))
              return message.reply(habitActionHelpMessage);
            if (parseInt(args[2 + archiveShift]) <= 0)
              return message.reply(habitActionHelpMessage);
            const confirmSeeMessage = `Are you sure you want to ** see ${
              args[2 + archiveShift]
            } habits?** `;
            let confirmSeeHabits = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeMessage,
              forceSkip,
              `Habit${isArchived ? ` Archive` : ""}: See ${
                args[2 + archiveShift]
              } Habits(${sortType})`
            );
            if (!confirmSeeHabits) return;
          } else {
            // If the next argument is undefined, implied "see all" command call unless "all" was not called:
            // => empty "past" command call
            if (seeType !== "all") return message.reply(habitActionHelpMessage);
            const confirmSeeAllMessage =
              "Are you sure you want to **see all** of your habit history?";
            let confirmSeeAll = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeAllMessage,
              forceSkip,
              `Habit${isArchived ? ` Archive` : ""}: See All Habits`
            );
            if (!confirmSeeAll) return;
          }
          // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
          if (habitIndex === undefined) {
            habitIndex = parseInt(args[2 + archiveShift]);
          }
          var habitView;
          if (indexByRecency)
            habitView = await fn.getEntriesByRecency(
              Habit,
              { userID: authorID, archived: isArchived },
              0,
              habitIndex
            );
          else
            habitView = await getHabitsByCreatedAt(
              authorID,
              0,
              habitIndex,
              isArchived
            );
          console.log({ habitView, pastNumberOfEntriesIndex: habitIndex });
          const habitArray = await multipleHabitsToStringArray(
            bot,
            message,
            habitView,
            habitIndex,
            0,
            false,
            true,
            false,
            false,
            false
          );
          await fn.sendPaginationEmbed(
            bot,
            message.channel.id,
            authorID,
            fn.getEmbedArray(
              habitArray,
              `Habit${
                isArchived ? ` Archive` : ""
              }: See ${habitIndex} Habits(${sortType})`,
              true,
              `Habits ${fn.timestampToDateString(
                Date.now() + timezoneOffset * HOUR_IN_MS,
                false,
                false,
                true,
                true
              )}`,
              habitEmbedColour
            )
          );
          return;
        }
        // see <PAST_#_OF_ENTRIES> <recent> past <INDEX>
        if (args[2 + archiveShift] !== undefined) {
          var shiftIndex;
          if (args[2 + archiveShift].toLowerCase() === "past") {
            shiftIndex = 0;
            indexByRecency = false;
          } else if (args[2 + archiveShift].toLowerCase() === "recent") {
            shiftIndex = 1;
            indexByRecency = true;
          }
          if (args[2 + archiveShift + shiftIndex]) {
            if (args[2 + archiveShift + shiftIndex].toLowerCase() === "past") {
              if (args[3 + archiveShift + shiftIndex] !== undefined) {
                const sortType = indexByRecency
                  ? "By Recency"
                  : "By Date Created";
                var entriesToSkip;
                // If the argument after past is a number, valid command call!
                if (!isNaN(args[3 + archiveShift + shiftIndex])) {
                  entriesToSkip = parseInt(args[3 + archiveShift + shiftIndex]);
                } else if (
                  args[3 + archiveShift + shiftIndex].toLowerCase() === "recent"
                ) {
                  entriesToSkip = await getRecentHabit(
                    bot,
                    authorID,
                    isArchived,
                    habitEmbedColour,
                    true,
                    true
                  );
                } else return message.reply(habitActionHelpMessage);
                if (entriesToSkip < 0 || entriesToSkip > totalHabitNumber) {
                  return fn.sendErrorMessageAndUsage(
                    message,
                    habitActionHelpMessage,
                    `**${
                      isArchived ? "ARCHIVED " : ""
                    }HABITS(S) DO NOT EXIST **...`
                  );
                }
                const confirmSeePastMessage = `Are you sure you want to ** see ${
                  args[1 + archiveShift]
                } entries past ${entriesToSkip}?** `;
                const confirmSeePast = await fn.getUserConfirmation(
                  bot,
                  message,
                  PREFIX,
                  confirmSeePastMessage,
                  forceSkip,
                  `Habit${isArchived ? ` Archive` : ""}: See ${
                    args[1 + archiveShift]
                  } Habits Past ${entriesToSkip} (${sortType})`
                );
                if (!confirmSeePast) return;
                var habitView;
                if (indexByRecency)
                  habitView = await fn.getEntriesByRecency(
                    Habit,
                    { userID: authorID, archived: isArchived },
                    entriesToSkip,
                    habitIndex
                  );
                else
                  habitView = await getHabitsByCreatedAt(
                    authorID,
                    entriesToSkip,
                    habitIndex,
                    isArchived
                  );
                console.log({ habitView });
                const habitStringArray = await multipleHabitsToStringArray(
                  bot,
                  message,
                  habitView,
                  habitIndex,
                  entriesToSkip,
                  false,
                  true,
                  false,
                  false,
                  false
                );
                await fn.sendPaginationEmbed(
                  bot,
                  message.channel.id,
                  authorID,
                  fn.getEmbedArray(
                    habitStringArray,
                    `Habit${
                      isArchived ? ` Archive` : ""
                    }: See ${habitIndex} Habits Past ${entriesToSkip} (${sortType})`,
                    true,
                    `Habits ${fn.timestampToDateString(
                      Date.now() + timezoneOffset * HOUR_IN_MS,
                      false,
                      false,
                      true,
                      true
                    )}`,
                    habitEmbedColour
                  )
                );
                return;
              }
            }
          }
        }
        if (args[2 + archiveShift] !== undefined) {
          if (args[2 + archiveShift].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }
        var habitView;
        if (indexByRecency)
          habitView = await hb.getOneHabitByRecency(
            authorID,
            habitIndex - 1,
            isArchived
          );
        else
          habitView = await hb.getOneHabitByCreatedAt(
            authorID,
            habitIndex - 1,
            isArchived
          );
        console.log({ habitView });
        if (!habitView) {
          return fn.sendErrorMessage(
            message,
            `**${
              isArchived ? "ARCHIVED " : ""
            }HABIT ${habitIndex} DOES NOT EXIST **...`
          );
        }
        // NOT using the past functionality:
        const sortType = indexByRecency ? "By Recency" : "By Date Created";
        const habitString = `__ ** Habit ${habitIndex}:** __ ${await hb.habitDocumentToString(
          bot,
          habitView,
          true,
          false,
          false,
          false
        )} `;
        const habitEmbed = fn.getEmbedArray(
          habitString,
          `Habit${
            isArchived ? ` Archive` : ""
          }: See Habit ${habitIndex} (${sortType})`,
          true,
          `Habit ${fn.timestampToDateString(
            Date.now() + timezoneOffset * HOUR_IN_MS,
            false,
            false,
            true,
            true
          )}`,
          habitEmbedColour
        );
        await fn.sendPaginationEmbed(
          bot,
          message.channel.id,
          authorID,
          habitEmbed
        );
      }
    } else if (
      habitCommand === "edit" ||
      habitCommand === "change" ||
      habitCommand === "ed" ||
      habitCommand === "ch" ||
      habitCommand === "c"
    ) {
      let habitEditUsageMessage =
        `** USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <archive?> <HABIT #> <recent?> <force?>\`` +
        `\n\n\`<HABIT #>\`: **recent; 3** (3rd most recent entry, \\**any number*)\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<recent?>\`(OPT.): type **recent** at the indicated spot to sort the habits by **actual time created instead of habit created time!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      habitEditUsageMessage = fn.getMessageEmbed(
        habitEditUsageMessage,
        `Habit: Edit Help`,
        habitEmbedColour
      );
      if (habitType) {
        if (habitType === "help") {
          return message.channel.send(habitEditUsageMessage);
        }
        if (!totalHabitNumber) {
          return message.reply(
            `**NO ${
              isArchived ? "ARCHIVED " : ""
            }HABITS**... try \`${PREFIX}${commandUsed} start\` to set one up!`
          );
        }
        if (
          isNaN(habitType) &&
          habitType !== "recent" &&
          !archiveRegex.test(habitType)
        ) {
          return message.reply(habitActionHelpMessage);
        }
      }
      habitType = isArchived
        ? args[2]
          ? args[2].toLowerCase()
          : false
        : habitType;
      if (habitType) {
        var habitIndex;
        if (habitType === "recent") {
          habitIndex = await hb.getRecentHabitIndex(authorID, isArchived);
        } else {
          habitIndex = parseInt(habitType);
          if (habitIndex <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              habitActionHelpMessage,
              `**${isArchived ? "ARCHIVED " : ""}HABIT DOES NOT EXIST**...`
            );
          }
        }

        var indexByRecency = false;
        if (args[2 + archiveShift] !== undefined) {
          if (args[2 + archiveShift].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }
        var habitDocument;
        if (indexByRecency)
          habitDocument = await hb.getOneHabitByRecency(
            authorID,
            habitIndex - 1,
            isArchived
          );
        else
          habitDocument = await hb.getOneHabitByCreatedAt(
            authorID,
            habitIndex - 1,
            isArchived
          );
        if (!habitDocument) {
          return fn.sendErrorMessageAndUsage(
            message,
            habitActionHelpMessage,
            `**${
              isArchived ? "ARCHIVED " : ""
            }HABIT ${habitIndex} DOES NOT EXIST**...`
          );
        }

        do {
          let {
            createdAt,
            archived,
            description,
            areaOfLife,
            specifics,
            reason,
            currentStreak,
            currentState,
            longestStreak,
            connectedGoal,
            settings,
            pastWeek,
            pastMonth,
            pastYear,
            nextCron,
          } = habitDocument;
          let {
            isCountType,
            countMetric,
            isWeeklyType,
            cronPeriods,
            autoLogType,
            countGoalType,
            countGoal,
            integration,
          } = settings;
          const sortType = indexByRecency ? "By Recency" : "By Date Created";
          var habitFields = [
            "Logs/Entries",
            "Date Created",
            "Description",
            "Specifics",
            "Reason",
            "Area Of Life",
            "Archived",
            "Connected Goal",
            "Daily/Weekly Reset",
            "Streak Reset Periods",
            "Auto-Complete Type",
            "Has Value to Count",
          ];
          if (isCountType) {
            habitFields = habitFields.concat([
              "Count Metric",
              "Count Goal Type",
              "Count Goal",
            ]);
          }

          const habitTargetID = habitDocument._id;
          var showHabit, continueEdit;
          var targetLogIndex, targetLogField, targetCountIndex, logs;
          if (habitTargetID) {
            logs = await Log.find({ connectedDocument: habitTargetID }).sort({
              timestamp: -1,
            });
          }
          var goals = await Goal.find({ userID: authorID });
          const checkHabit = await hb.getOneHabitByObjectID(habitTargetID);
          if (!checkHabit)
            return message.channel.send(
              `Habit ${targetHabitIndex + 1} does not exist anymore!`
            );
          continueEdit = false;
          showHabit = await hb.habitDocumentToString(
            bot,
            habitDocument,
            true,
            true,
            true,
            true
          );
          const type = `Habit${isArchived ? " Archive" : ""}`;

          // Field the user wants to edit
          const fieldToEditInstructions =
            "**Which field do you want to edit?**";
          const fieldToEditAdditionalMessage = `__**Habit ${habitIndex} (${sortType}):**__ ${showHabit}`;
          const fieldToEditTitle = `${type}: Edit Field`;
          var fieldToEdit, fieldToEditIndex;
          const selectedField = await fn.getUserSelectedObject(
            bot,
            message,
            PREFIX,
            fieldToEditInstructions,
            fieldToEditTitle,
            habitFields,
            "",
            false,
            habitEmbedColour,
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
            habitEditMessagePrompt = "";
          const goalTypeString = fn.getGoalTypeString(countGoalType);
          switch (fieldToEditIndex) {
            case 0:
              //// ADD support for Add/Delete options too! List out all of the logs, if any, then 1 add, 2 delete, 3 edit (if logs.length)
              if (logs)
                if (logs.length) {
                  let logList = `👣 - **__Habit Description:__**\n${habitDocument.description}\n\n`;
                  logs.forEach((log, i) => {
                    logList += `\`${i + 1}\`\: ${fn.logDocumentToString(
                      log,
                      habitCron
                    )}\n`;
                    if (i !== logs.length - 1) logList += "\n";
                  });
                  targetLogIndex = await fn.userSelectFromList(
                    bot,
                    message,
                    PREFIX,
                    `\n${logList}`,
                    logs.length,
                    "**Please enter the number corresponding to the habit log you'd like to edit.**",
                    `${type}: Select Log To Edit`,
                    habitEmbedColour,
                    600000,
                    0
                  );
                  if (!targetLogIndex && targetLogIndex !== 0) return;
                  var logFields = ["Timestamp", "State", "Reflection"];
                  if (isCountType) {
                    logFields.push("Count");
                  }

                  const selectedLogField = await fn.getUserSelectedObject(
                    bot,
                    message,
                    PREFIX,
                    "**Please enter the number corresponding to the field you'd like to edit.**",
                    `${type}: Log Edit Field`,
                    logFields,
                    null,
                    false,
                    habitEmbedColour,
                    600000,
                    0,
                    fn.logDocumentToString(logs[targetLogIndex], habitCron)
                  );
                  if (!selectedLogField) return;
                  else targetLogField = selectedLogField.index;

                  switch (targetLogField) {
                    // Created At (Timestamp)
                    case 0:
                      habitEditMessagePrompt = `\n__**Please enter the date/time of when you created this log:**__ ⌚\n${timeExamples}`;
                      userEdit = await fn.getUserEditString(
                        bot,
                        message,
                        PREFIX,
                        "Date Created",
                        habitEditMessagePrompt,
                        type,
                        forceSkip,
                        habitEmbedColour
                      );
                      break;
                    // State
                    case 1:
                      let currentStateEmoji = fn.getStateEmoji(currentState);
                      habitEditMessagePrompt = checkMissedSkipList;
                      userEdit = await fn.userSelectFromList(
                        bot,
                        message,
                        PREFIX,
                        habitEditMessagePrompt,
                        3,
                        `**Current State:** ${currentStateEmoji}`,
                        `${type}: Edit Log State`,
                        habitEmbedColour
                      );
                      break;
                    // Reflection
                    case 2:
                      habitEditMessagePrompt =
                        "\n__**Please enter the reflection message you'd like to enter for this log:**__ ✍\n(Within 1000 characters)";
                      userEdit = await fn.getUserMultilineEditString(
                        bot,
                        message,
                        PREFIX,
                        "Reflection Message",
                        habitEditMessagePrompt,
                        type,
                        forceSkip,
                        habitEmbedColour,
                        1000
                      );
                      break;
                    // Count
                    case 3:
                      if (isCountType) {
                        // Let user select which count value they want to edit
                        const selectedCount = await fn.getUserSelectedObject(
                          bot,
                          message,
                          PREFIX,
                          "**Please enter the number corresponding to the count value you'd like to edit.**",
                          `${type}: Edit Log Count Value`,
                          logs[targetLogIndex].count,
                          null,
                          false,
                          habitEmbedColour,
                          600000,
                          0,
                          `\n${fn.logDocumentToString(
                            logs[targetLogIndex],
                            habitCron
                          )}`
                        );
                        if (!selectedCount) return;
                        else targetCountIndex = selectedCount.index;

                        habitEditMessagePrompt = `__**Please enter the ${
                          countMetric ? `"${countMetric}"` : "value"
                        } you'd like to enter for this log:**__\n**Currently: ** ${
                          selectedCount.object || "N/A"
                        }\n\nType \`delete\` to **delete this count entry**\nType \`add #\` where __**# = a number**__: To **add the number to the current count**\nType \`sub #\` where __**# = a number**__: To **subtract the number from the current count**`;
                        userEdit = await fn.getUserEditString(
                          bot,
                          message,
                          PREFIX,
                          "Count",
                          habitEditMessagePrompt,
                          type,
                          forceSkip,
                          habitEmbedColour
                        );
                      }
                      break;
                  }
                } else
                  fn.sendReplyThenDelete(
                    message,
                    `**There are __no entries/logs__ for this current habit!**`
                  );
              break;
            case 1:
              habitEditMessagePrompt = `\n__**Please enter the date/time of when you created this habit:**__ ⌚\n${timeExamples}`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                type,
                forceSkip,
                habitEmbedColour
              );
              break;
            case 2:
              habitEditMessagePrompt =
                "\n👣 **What is the __habit__ you'd like to track?** 📈\n(Within 100 characters)";
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                type,
                forceSkip,
                habitEmbedColour,
                100
              );
              description = userEdit;
              break;
            case 3: {
              let editInstructions =
                "\nType `back` to go **back to the main edit menu**";
              userEdit = await hb.getHabitSpecifics(
                bot,
                message,
                PREFIX,
                forceSkip,
                `${type}: Edit`,
                habitEmbedColour,
                editInstructions,
                ["back"]
              );
              if (!userEdit) return;
              else if (userEdit.returnVal === "back") userEdit = "back";
              else specifics = userEdit.message;
              break;
            }
            case 4:
              habitEditMessagePrompt =
                "\n💭 **__Why__ do you want to incorporate this habit into your lifestyle?**\n(Within 1000 characters)";
              userEdit = await fn.getUserMultilineEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                type,
                forceSkip,
                habitEmbedColour,
                1000
              );
              reason = userEdit;
              break;
            case 5:
              habitEditMessagePrompt = `\n**__Which area of life does this habit fall under? 🌱__**\n${areasOfLifeList}`;
              userEdit = await fn.getUserEditNumber(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                areasOfLife.length,
                type,
                areasOfLifeCombinedEmoji,
                forceSkip,
                habitEmbedColour,
                habitEditMessagePrompt
              );
              if (!userEdit && userEdit !== 0) return;
              else if (userEdit === "back") break;
              else {
                userEdit--; // Minus 1 for array offset
                areaOfLife = userEdit;
              }
              break;
            case 6:
              habitEditMessagePrompt = `\n**__Currently:__ ${
                archived ? "Archived" : "NOT Archived"
              }\n\n📁 - Archive\n\n📜 - No Archive**`;
              userEdit = await fn.getUserEditBoolean(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                ["📁", "📜"],
                type,
                forceSkip,
                habitEmbedColour
              );
              break;
            case 7:
              let connectedGoalString = "**Currently:** ";
              if (connectedGoal) {
                const connectedGoalDocument = goals.find(
                  (goal) => goal._id.toString() === connectedGoal.toString()
                );
                if (connectedGoalDocument) {
                  connectedGoalString += `${connectedGoalDocument.description}`;
                } else connectedGoalString += "NONE";
              } else connectedGoalString += "NONE";

              let goalList = "";
              let outputArray = new Array();
              goals.forEach((goal, i) => {
                goalList = `\`${i + 1}\` - ${goal.description}\n`;
                outputArray.push(goal.description);
              });
              goalList += `\`${outputArray.length + 1}\` - NONE`;
              outputArray.push("NONE");
              habitEditMessagePrompt = `\n**__Which goal is this habit connected to?__**\n${connectedGoalString}${
                connectedGoal
                  ? `\n(Enter \`${
                      outputArray.length + 1
                    }\` to remove the connection)`
                  : ""
              }\n\n${goalList}`;
              userEdit = await fn.getUserEditNumber(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                outputArray.length,
                type,
                outputArray,
                forceSkip,
                habitEmbedColour,
                habitEditMessagePrompt
              );
              if (!userEdit && userEdit !== 0) return;
              else if (userEdit === "back") break;
              else userEdit--; // Minus 1 for array offset
              break;
            case 8:
              habitEditMessagePrompt = `\n**__When do you want this habit's streaks to reset?__** ⌚\n**Currently:** ${
                isWeeklyType ? "Weekly" : "Daily"
              }\n\n🌇 - **Daily Reset**\n📅 - **Weekly Reset**`;
              userEdit = await fn.getUserEditBoolean(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                ["🌇", "📅"],
                type,
                forceSkip,
                habitEmbedColour
              );
              break;
            case 9:
              habitEditMessagePrompt = `**__After how many ${
                isWeeklyType ? "weeks" : "days"
              } do you want your habit streak to reset__**\n(Enter a number)`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                type,
                forceSkip,
                habitEmbedColour
              );
              break;
            case 10:
              habitEditMessagePrompt = `**__Do you want the habit to automatically log/complete?__**`;
              const hasCountGoal = countGoal && countGoal !== 0;
              var noMoreStreakHabitsAtTier;
              switch (tier) {
                case 1:
                  noMoreStreakHabitsAtTier =
                    totalStreakNumber >= streakHabitMax && tier === 1;
                  break;
                case 3:
                  noMoreStreakHabitsAtTier = false;
                  break;
                default:
                  noMoreStreakHabitsAtTier = true;
                  break;
              }
              userEdit = await fn.userSelectFromList(
                bot,
                message,
                PREFIX,
                `\n\`1\` - **No** ⛔${
                  noMoreStreakHabitsAtTier
                    ? ""
                    : `\n\`2\` - **Yes, As a Streak** (Every Reset Time) 🔄`
                }${
                  hasCountGoal
                    ? `\n\`3\` - **Yes, Based on Count Goal** (When goal is reached after logging habit) 🔢`
                    : ""
                }`,
                (hasCountGoal ? 2 : 1) + (noMoreStreakHabitsAtTier ? 0 : 1),
                `**__Do you want the habit to automatically log/complete?__**\n(You can still manually log/edit your entries)\n${
                  noMoreStreakHabitsAtTier
                    ? `P.S. You've reached your **maximum number of streak habits (${streakHabitMax}) for your tier level (${tier})**`
                    : ""
                }`,
                `${type}: Auto-Complete Type`,
                habitEmbedColour
              );
              autoLogType = userEdit;
              break;
            case 11:
              habitEditMessagePrompt = `\n**__Currently:__ ${
                isCountType ? "Yes" : "No"
              }\n\n🔢 - Has a value to count\n\n⛔ - No value to count**`;
              userEdit = await fn.getUserEditBoolean(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                ["🔢", "⛔"],
                type,
                forceSkip,
                habitEmbedColour
              );
              break;
            case 12:
              habitEditMessagePrompt = `\n**__What metric are you tracking for this habit?__** 📏\n(Within 30 characters)\ne.g. Pushups, Hours Spend Studying`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                type,
                forceSkip,
                habitEmbedColour,
                30
              );
              countMetric = userEdit;
              break;
            case 13:
              habitEditMessagePrompt = `**What kind of goal do you have for __${
                countMetric || "this count-based habit"
              }__?**`;
              userEdit = await fn.userSelectFromList(
                bot,
                message,
                PREFIX,
                "\n`1` - **Daily Goal** 🌇\n`2` - **Weekly Goal** 📅\n`3` - **Total/Cumulative Goal** 🔢",
                3,
                habitEditMessagePrompt,
                `${type}: Count Goal Type`,
                habitEmbedColour
              );
              if (!userEdit && userEdit !== 0) return;
              else if (userEdit === "back") break;
              else {
                userEdit++; // Plus 1 for array offset
                countGoalType = userEdit;
              }
              break;
            case 14:
              habitEditMessagePrompt = `**What is your ${
                goalTypeString || "goal"
              } for __${countMetric || "this count-based habit"}?__**`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                habitEditMessagePrompt,
                type,
                forceSkip,
                habitEmbedColour
              );
              break;
          }
          console.log({ userEdit });
          if (userEdit === false) return;
          else if (userEdit === undefined) userEdit = "back";
          else if (userEdit !== "back") {
            // Parse User Edit
            switch (fieldToEditIndex) {
              case 0:
                let targetLog = logs[targetLogIndex];
                if (targetLog) {
                  switch (targetLogField) {
                    // Created At (Timestamp)
                    case 0:
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
                          `**INVALID TIME**... ${habitHelpMessage}`,
                          60000
                        );
                        continueEdit = true;
                      } else {
                        // Log date collisions
                        const collisionLog = fn.getHabitLogOnTimestampDay(
                          logs,
                          userEdit,
                          userSettings.habitCron.daily
                        );
                        if (
                          !collisionLog ||
                          (collisionLog &&
                            collisionLog._id.toString() ===
                              targetLog._id.toString())
                        ) {
                          targetLog.timestamp = userEdit;
                          break;
                        }
                        const confirmOverwiteLog = await fn.getUserConfirmation(
                          bot,
                          message,
                          PREFIX,
                          `**Another habit log exists on your intended date** (based on habit reset time).\n__**${fn.timestampToDateString(
                            userEdit,
                            true,
                            true,
                            true,
                            false
                          )}**__.\n\n__**Would you like to overwrite the existing log with the one you are currently editing?**__\n*If **no**, the current log will not be changed.\nIf **yes**, the current log's timestamp will be changed to ${fn.timestampToDateString(
                            userEdit,
                            true,
                            true,
                            true,
                            false
                          )}, and **the other log will be deleted***\n\n__**Current Log:**__ (Timestamp Unchanged)\n${fn.logDocumentToString(
                            targetLog,
                            habitCron
                          )}\n\n__**Log to Overwrite:**__\n${fn.logDocumentToString(
                            collisionLog,
                            habitCron
                          )}`,
                          false,
                          `${type}: Overwrite Log? (Date Conflict)`,
                          300000
                        );
                        if (confirmOverwiteLog) {
                          await Log.deleteOne({ _id: collisionLog._id });
                          targetLog.timestamp = userEdit;
                          break;
                        } else if (confirmOverwiteLog === null) return;
                        else {
                          continueEdit = true;
                          break;
                        }
                      }
                      break;
                    // State
                    case 1:
                      targetLog.state = userEdit + 1;
                      break;
                    // Reflection
                    case 2:
                      targetLog.message = userEdit;
                      break;
                    // Count
                    case 3:
                      if (!isNaN(userEdit)) {
                        targetLog.count[targetCountIndex] = parseFloat(
                          userEdit
                        );
                      } else if (userEdit.toLowerCase() === "delete") {
                        targetLog.count.splice(targetCountIndex, 1);
                      } else if (!isNaN(targetLog.count[targetCountIndex])) {
                        const splitUserArgs = userEdit.split(/[\s\n]+/);
                        if (splitUserArgs[0]) {
                          const operation = splitUserArgs[0];
                          var multiplier;
                          if (operation.toLowerCase() === "add") multiplier = 1;
                          else if (operation.toLowerCase() === "sub")
                            multiplier = -1;
                          if (splitUserArgs[1]) {
                            let amount = parseFloat(splitUserArgs[1]);
                            if (!isNaN(amount)) {
                              targetLog.count[targetCountIndex] +=
                                amount * multiplier;
                            }
                          }
                        }
                      }
                      break;
                  }
                  logs[targetLogIndex] = targetLog;
                  const {
                    timestamp,
                    state,
                    message: logMessage,
                    count,
                  } = targetLog;
                  await Log.updateOne(
                    { _id: targetLog._id },
                    { $set: { timestamp, state, message: logMessage, count } }
                  );
                }
                break;
              case 1:
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
                    `**INVALID TIME**... ${habitHelpMessage}`,
                    60000
                  );
                  continueEdit = true;
                } else createdAt = userEdit;
                break;
              case 6:
                switch (userEdit) {
                  case "📁":
                    userEdit = true;
                    totalHabitNumber--;
                    totalArchiveNumber++;
                    break;
                  case "📜":
                    userEdit = false;
                    totalArchiveNumber--;
                    totalHabitNumber++;
                    break;
                  default:
                    continueEdit = true;
                    break;
                }
                if (typeof userEdit === "boolean") {
                  archived = userEdit;
                  isArchived = userEdit;
                }
                break;
              case 7:
                if (userEdit === goals.length) {
                  connectedGoal = undefined;
                } else connectedGoal = goals[userEdit]._id;
                break;
              case 8:
                switch (userEdit) {
                  case "📅":
                    userEdit = true;
                    break;
                  case "🌇":
                    userEdit = false;
                    break;
                  default:
                    continueEdit = true;
                    break;
                }
                if (typeof userEdit === "boolean") {
                  isWeeklyType = userEdit;
                }
                break;
              case 9:
                if (!isNaN(userEdit)) cronPeriods = parseFloat(userEdit);
                else {
                  message.reply(
                    `**Please enter a number for your __streak reset period__ entry.**(Currently: __${cronPeriods} ${
                      isWeeklyType ? "week(s)" : "day(s)"
                    }__)`
                  );
                }
                break;
              case 11:
                switch (userEdit) {
                  case "🔢":
                    userEdit = true;
                    break;
                  case "⛔":
                    userEdit = false;
                    break;
                  default:
                    continueEdit = true;
                    break;
                }
                if (typeof userEdit === "boolean") {
                  if (
                    userEdit === false &&
                    isCountType === true &&
                    autoLogType === 2
                  ) {
                    const confirmRemoveCount = await fn.getUserConfirmation(
                      bot,
                      message,
                      PREFIX,
                      "**Removing the count-based functionality automatically disables auto completion based on count.**\n\n**__Current Auto Complete:__** Based on Count Value\n\nAccordingly, the **__auto complete will be removed__**.\n(You can change it again in the main edit menu)",
                      forceSkip,
                      `${type}: Auto Complete Based on Count Value - Automatically Disabled`
                    );
                    if (!confirmRemoveCount) {
                      continueEdit = true;
                      break;
                    } else autoLogType = 0;
                  }
                  isCountType = userEdit;
                }
                break;
              case 14:
                if (!isNaN(userEdit)) countGoal = parseFloat(userEdit);
                else {
                  message.reply(
                    `**Please enter a number for your __${
                      countMetric || "count-based habit"
                    } ${goalTypeString || "goal"}__.**(Currently: __${
                      countGoal || countGoal === 0 ? countGoal : "nothing"
                    }__)`
                  );
                }
                break;
            }
          } else continueEdit = true;
          console.log({ userEdit });
          if (!continueEdit) {
            try {
              if (
                fieldToEditIndex === 2 ||
                fieldToEditIndex === 12 ||
                fieldToEditIndex === 13 ||
                fieldToEditIndex === 14
              ) {
                if (habitTargetID) {
                  const currentHabitReminders = await Reminder.find({
                    connectedDocument: habitTargetID,
                  });
                  if (currentHabitReminders)
                    if (currentHabitReminders.length) {
                      rm.cancelRemindersByConnectedDocument(habitTargetID);
                      await Reminder.deleteMany({
                        connectedDocument: habitTargetID,
                      });
                      currentHabitReminders.forEach(async (reminder) => {
                        await hb.setHabitReminder(
                          bot,
                          timezoneOffset,
                          commandUsed,
                          userID,
                          reminder.endTime,
                          reminder.interval,
                          habitTargetID
                        );
                      });
                    }
                }
              }

              // Update Stats!
              habitCron = userSettings.habitCron;
              const currentLogs = await Log.find({
                connectedDocument: habitDocument._id,
              }).sort({ timestamp: -1 });
              currentStreak = fn.calculateCurrentStreak(
                currentLogs,
                timezoneOffset,
                habitCron,
                isWeeklyType,
                cronPeriods
              );
              if (currentStreak > (longestStreak ? longestStreak : 0)) {
                longestStreak = currentStreak;
              }
              const todaysLog = fn.getTodaysLog(
                currentLogs,
                timezoneOffset,
                habitCron.daily
              );
              if (todaysLog) currentState = todaysLog.state;
              else currentState = 0;
              pastWeek = hb.getPastWeekStreak(
                currentLogs,
                timezoneOffset,
                habitCron,
                createdAt
              );
              pastMonth = hb.getPastMonthStreak(
                currentLogs,
                timezoneOffset,
                habitCron,
                createdAt
              );
              pastYear = hb.getPastYearStreak(
                currentLogs,
                timezoneOffset,
                habitCron,
                createdAt
              );

              console.log(
                `Editing ${authorID}'s Habit ${habitIndex} (${sortType})`
              );
              habitDocument = await Habit.findOneAndUpdate(
                { _id: habitTargetID },
                {
                  $set: {
                    createdAt,
                    archived,
                    description,
                    areaOfLife,
                    specifics,
                    reason,
                    connectedGoal,
                    nextCron,
                    settings: {
                      isCountType,
                      countMetric,
                      isWeeklyType,
                      cronPeriods,
                      autoLogType,
                      countGoalType,
                      countGoal,
                      integration,
                    },
                    currentStreak,
                    currentState,
                    longestStreak,
                    pastWeek,
                    pastMonth,
                    pastYear,
                  },
                },
                { new: true }
              );
              console.log({ continueEdit });
              if (habitDocument) {
                userSettings = await User.findOne({ discordID: authorID });
                habitCron = userSettings.habitCron;
                hb.cancelHabitById(habitDocument._id);
                await hb.habitCron(habitDocument, timezoneOffset, habitCron);

                habitIndex = indexByRecency
                  ? await hb.getHabitIndexByFunction(
                      authorID,
                      habitTargetID,
                      isArchived ? totalArchiveNumber : totalHabitNumber,
                      isArchived,
                      hb.getOneHabitByRecency
                    )
                  : await hb.getHabitIndexByFunction(
                      authorID,
                      habitTargetID,
                      isArchived ? totalArchiveNumber : totalHabitNumber,
                      isArchived,
                      hb.getOneHabitByCreatedAt
                    );
                console.log({ habitDocument, habitTargetID, fieldToEditIndex });
                const showEditedLog =
                  fieldToEditIndex === 0
                    ? `\n\n__**Edited Log:**__\n${fn.logDocumentToString(
                        logs[targetLogIndex],
                        habitCron
                      )}`
                    : "";
                showHabit = await hb.habitDocumentToString(
                  bot,
                  habitDocument,
                  true,
                  true,
                  true,
                  true
                );
                const continueEditMessage = `Do you want to continue **editing ${
                  isArchived ? "Archived " : ""
                }Habit ${habitIndex}?**\n\n__**${
                  isArchived ? "Archived " : ""
                }Habit ${habitIndex}:**__ ${showHabit}${showEditedLog}`;
                continueEdit = await fn.getUserConfirmation(
                  bot,
                  message,
                  PREFIX,
                  continueEditMessage,
                  forceSkip,
                  `Habit${
                    isArchived ? " Archive" : ""
                  }: Continue Editing Habit ${habitIndex}?`,
                  300000
                );
              } else {
                message.reply(
                  `**${isArchived ? "Archived " : ""}Habit not found...**`
                );
                continueEdit = false;
              }
            } catch (err) {
              return console.log(err);
            }
          } else {
            console.log({ continueEdit, userEdit });
            habitDocument = await Habit.findById(habitTargetID);
            if (habitDocument) {
              habitIndex = indexByRecency
                ? await hb.getHabitIndexByFunction(
                    authorID,
                    habitTargetID,
                    isArchived ? totalArchiveNumber : totalHabitNumber,
                    isArchived,
                    hb.getOneHabitByCreatedAt
                  )
                : await hb.getHabitIndexByFunction(
                    authorID,
                    habitTargetID,
                    isArchived ? totalArchiveNumber : totalHabitNumber,
                    isArchived,
                    hb.getOneHabitByRecency
                  );
              console.log({ habitDocument, habitTargetID, fieldToEditIndex });
              showHabit = await hb.habitDocumentToString(
                bot,
                habitDocument,
                true,
                true,
                true,
                true
              );
            } else {
              message.reply(
                `**${isArchived ? "Archived " : ""}Habit not found...**`
              );
              continueEdit = false;
            }
          }
        } while (continueEdit === true);
        return;
      } else return message.reply(habitActionHelpMessage);
    }

    // If there are arguments after the post (that are not force)
    // Then allow the posting of 1 habit, otherwise post all habits
    // Only display the description, current streak, current state, today's count* (if any)
    // Of the non-archived ones
    else if (habitCommand === "post" || habitCommand === "p") {
      if (isArchived) {
        if (totalArchiveNumber <= 0) {
          return message.reply(
            `**No archived habit entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`
          );
        }
      } else {
        if (totalHabitNumber <= 0) {
          return message.reply(
            `**No habit entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`
          );
        }
      }

      const userHabits = await Habit.find({
        userID: authorID,
        archived: isArchived,
      }).sort({ createdAt: +1 });
      if (userHabits)
        if (userHabits.length) {
          const targetHabits = await hb.getSelectedPostHabits(
            bot,
            message,
            PREFIX,
            userHabits
          );
          if (!targetHabits) return;
          else {
            if (!targetHabits.length) return;
          }
          const targetChannel = await fn.getTargetChannel(
            bot,
            message,
            PREFIX,
            `Habit`,
            forceSkip,
            true,
            false,
            true,
            habitEmbedColour
          );
          if (!targetChannel) return;
          const member = bot.channels.cache
            .get(targetChannel)
            .guild.member(authorID);

          let habitStringArray = new Array();
          for (const habit of targetHabits) {
            // Get the index of the habit
            let habitIndex = 1;
            for (let i = 0; i < userHabits.length; i++) {
              if (userHabits[i]._id.toString() === habit._id.toString()) {
                break;
              } else habitIndex++;
            }
            habitStringArray.push(
              `**__Habit ${habitIndex}:__** ${await hb.habitDocumentToString(
                bot,
                habit,
                true,
                false,
                false,
                false,
                false
              )}`
            );
          }

          if (habitStringArray.length)
            habitStringArray[0] = `<@!${authorID}>\n${habitStringArray[0]}`;
          const posts = fn.getEmbedArray(
            habitStringArray,
            `${member ? `${member.displayName}'s` : ""} Habits`,
            true,
            false,
            habitEmbedColour
          );
          posts.forEach(async (post) => {
            await fn.sendMessageToChannel(bot, post, targetChannel);
          });
          return;
        }
      return message.reply(
        `**No ${
          isArchived ? "archived " : ""
        }habit entries...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`
      );

      // // For posting all of the user's current habits (not archived) to a channel.
      // let habits = await Habit.find({ userID: authorID, archived: false }).sort({ createdAt: +1 });
      // if (!habits) return message.reply(`**You don't have any habits**, try \`${PREFIX}${commandUsed} start\``);
      // const targetChannel = await fn.getTargetChannel(bot, message, PREFIX, `Habit`,
      //     forceSkip, true, false, true, habitEmbedColour);
      // if (!targetChannel) return;
      // const member = bot.channels.cache.get(targetChannel).guild.member(authorID);
      // const habitStringArray = await multipleHabitsToStringArray(bot, message, habits, totalHabitNumber, 0,
      //     false, true, false, false, false);
      // if (habitStringArray.length) habitStringArray[0] = `<@!${authorID}>\n${habitStringArray[0]}`;
      // const posts = fn.getEmbedArray(habitStringArray, `${member ? `${member.displayName}'s` : ""} Habits`
      //     + ` (as of ${new Date(Date.now() + HOUR_IN_MS * timezoneOffset).getUTCFullYear()})`, true, false, habitEmbedColour);
      // posts.forEach(async post => {
      //     await fn.sendMessageToChannel(bot, post, targetChannel);
      // });
      // return;
    } else if (
      habitCommand === "log" ||
      habitCommand === "track" ||
      habitCommand === "check" ||
      habitCommand === "complete" ||
      habitCommand === "end" ||
      habitCommand === "e"
    ) {
      // (similar indexing to edit, recent or #) + archive
      // Make a list - similar to archive
      let habitLogUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <archive?> <recent?> <force?>\`\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<recent?>\`(OPT.): type **recent** to order the habits by **actual time created instead of the date created property!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      habitLogUsageMessage = fn.getMessageEmbed(
        habitLogUsageMessage,
        `Habit: Log Help`,
        habitEmbedColour
      );
      if (habitType === "help")
        return message.channel.send(habitLogUsageMessage);

      var indexByRecency = false;
      if (args[2 + archiveShift] !== undefined) {
        if (args[2 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }
      const sortType = indexByRecency ? "By Recency" : "By Date Created";

      var habitArray;
      if (indexByRecency)
        habitArray = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ _id: -1 });
      else
        habitArray = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ createdAt: +1 });
      if (!habitArray.length)
        return message.reply(
          `**No ${
            isArchived ? "archived " : ""
          }habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
        );

      var onFirst = true;
      do {
        var targetHabit, targetHabitIndex;
        // If the user entered an index, use that, otherwise let them select from a list.
        if (onFirst && habitType) {
          if (!isNaN(habitType)) {
            targetHabitIndex = parseInt(habitType);
            if (targetHabitIndex <= 0 || targetHabitIndex > habitArray.length) {
              return message.reply(
                `**${isArchived ? "Archived " : ""}Habit ${parseInt(
                  habitType
                )}** does not exist... Try \`${PREFIX}${commandUsed} ${logCommand} help\` for help!`
              );
            } else {
              targetHabitIndex--;
              targetHabit = habitArray[targetHabitIndex];
            }
          } else if (habitType === "recent") {
            const recentHabit = await Habit.findOne({ userID: authorID }).sort({
              _id: -1,
            });
            if (recentHabit) {
              const recentHabitId = recentHabit._id.toString();
              const recentHabitIndex = habitArray.findIndex(
                (habit) => habit._id.toString() === recentHabitId
              );
              if (recentHabitIndex === -1) return;
              targetHabit = habitArray[recentHabitIndex];
              targetHabitIndex = recentHabitIndex;
            }
          }
        }

        if (targetHabitIndex === undefined) {
          targetHabit = await fn.getUserSelectedObject(
            bot,
            message,
            PREFIX,
            "__**Which habit would you like to log?**__",
            `Habit${
              isArchived ? " Archive" : ""
            }: Select Habit To Log (${sortType})`,
            habitArray,
            "description",
            false,
            habitEmbedColour,
            600000
          );
          if (!targetHabit) return;
          else {
            targetHabitIndex = targetHabit.index;
            targetHabit = targetHabit.object;
          }
        }

        const logTimestamp = await fn.getDateAndTimeEntry(
          bot,
          message,
          PREFIX,
          timezoneOffset,
          daylightSaving,
          `**__When do you want to log this habit for?__**\n\n**__Habit ${
            targetHabitIndex + 1
          } (${sortType}):__**\n${fn.habitDocumentDescription(targetHabit)}`,
          `Habit ${targetHabitIndex + 1}${
            isArchived ? " Archive" : ""
          }: Log Timestamp`,
          false,
          habitEmbedColour,
          600000
        );
        if (!logTimestamp && logTimestamp !== 0) return;

        // If it is a count habit, get the count input first.
        const { settings } = targetHabit;
        const {
          isCountType,
          countGoal,
          countMetric,
          countGoalType,
          autoLogType,
        } = settings;
        var countValue;
        const countGoalTypeString = fn.toTitleCase(
          fn.getGoalTypeString(countGoalType)
        );

        let currentLogs = await Log.find({
          connectedDocument: targetHabit._id,
        }).sort({ timestamp: -1 });
        let existingLog = fn.getHabitLogOnTimestampDay(
          currentLogs,
          logTimestamp,
          habitCron.daily
        );
        if (existingLog && autoLogType !== 1) {
          const confirmOverwiteLog = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            `__**You already have a habit log on this day, are you sure you would like to overwrite it?**__\n*If yes, you can start creating the new log which will replace the old one.\nOtherwise, it will exit the log creation.*\n(**You can edit it instead using: \`${PREFIX}habit edit${
              targetHabitIndex || targetHabitIndex === 0
                ? ` ${targetHabitIndex + 1}`
                : ""
            }\`**)\n\n**Old Log:** ${fn.logDocumentToString(
              existingLog,
              habitCron
            )}\n\n**Desired Timestamp:** ${fn.timestampToDateString(
              logTimestamp
            )}`,
            false,
            `Habit${
              isArchived ? " Archive" : ""
            }: Overwrite Log? (Date Conflict)`,
            600000
          );
          if (!confirmOverwiteLog) return;
        }

        const logTimestampString = existingLog
          ? `\n**Previous Timestamp:** ${fn.timestampToDateString(
              existingLog.timestamp
            )}\n(Actual Habit Day: ${fn.timestampToDateString(
              fn.getActualDateLogged(existingLog.timestamp, habitCron.daily),
              false
            )})\n**Current Timestamp:** ${fn.timestampToDateString(
              logTimestamp
            )}\n(Actual Habit Day: ${fn.timestampToDateString(
              fn.getActualDateLogged(logTimestamp, habitCron.daily),
              false
            )})`
          : `\n**Current Timestamp:** ${fn.timestampToDateString(
              logTimestamp
            )}\n(Actual Habit Day: ${fn.timestampToDateString(
              fn.getActualDateLogged(logTimestamp, habitCron.daily),
              false
            )})`;
        const previousCountTypeString = existingLog
          ? `**Previous ${countMetric}:** ${fn.countArrayToString(
              existingLog.count
            )}`
          : "";

        if (isCountType) {
          countValue = await fn.getNumberEntry(
            bot,
            message,
            PREFIX,
            `Enter your **${countMetric}** (${countGoalTypeString}: **${countGoal}**)\n${logTimestampString}\n${previousCountTypeString}`,
            `Habit${isArchived ? " Archive" : ""}: ${countGoalTypeString}`,
            true,
            true,
            true,
            undefined,
            undefined,
            habitEmbedColour
          );
          if (!countValue && countValue !== 0) countValue = undefined;
        }
        // Then based on the user's countValue (if any), show the suggested log based on their goal
        const suggestedLogFromCountGoal = isCountType
          ? `\n\n**${countMetric}:** ${fn.getStateEmoji(
              countValue >= countGoal ? 1 : 2
            )}\nCurrent Value (**${countValue}**) vs. ${countGoalTypeString} (**${countGoal}**)`
          : "";

        let habitLog = await fn.userSelectFromList(
          bot,
          message,
          PREFIX,
          checkMissedSkipList,
          3,
          `__**What will you set the status of your habit to?**__\n${logTimestampString}\n**Currently:** ${fn.getStateEmoji(
            existingLog ? existingLog.state : 0
          )}${suggestedLogFromCountGoal}`,
          `Habit${isArchived ? " Archive" : ""}: Log Status`,
          habitEmbedColour,
          600000,
          0
        );
        if (!habitLog && habitLog !== 0) return;
        habitLog++;

        var currentReflection = "";
        if (existingLog) {
          currentReflection = existingLog.message || "";
        }
        const currentReflectionString = `**Current Reflection Message:**${
          currentReflection ? `\n${currentReflection}` : " N/A"
        }`;
        var reflectionMessage;
        const confirmReflection = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          `Would you like to **__add a${
            currentReflection ? " new" : ""
          } reflection message__** to go with your habit log?\n*If yes, you will type in your reflection in the next window!\nOtherwise, the reflection will not be changed.*\n${logTimestampString}\n**Current Log: ${fn.getStateEmoji(
            habitLog
          )}**\n${currentReflectionString}`,
          forceSkip,
          `Habit${
            isArchived ? " Archive" : ""
          }: Write Reflection Message? (Optional)`,
          300000
        );
        if (confirmReflection) {
          reflectionMessage = await fn.getMultilineEntry(
            bot,
            message,
            PREFIX,
            `**Write a reflection message to go with your habit log.**\n(Within 1000 characters)`,
            `Habit${isArchived ? " Archive" : ""}: Reflection Message`,
            true,
            habitEmbedColour,
            1000
          );
          if (!reflectionMessage) reflectionMessage = undefined;
          else reflectionMessage = reflectionMessage.message;
        } else if (confirmReflection === null) return;
        else reflectionMessage = currentReflection;

        const confirmEnd = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          `**__Are you sure you want to log this habit as:__** ${fn.getStateEmoji(
            habitLog
          )}\n**Previous State:** ${fn.getStateEmoji(
            existingLog ? existingLog.state : 0
          )}${
            existingLog
              ? `\n**Previous Timestamp:** ${fn.timestampToDateString(
                  existingLog.timestamp
                )}\n(Actual Habit Day: ${fn.timestampToDateString(
                  fn.getActualDateLogged(
                    existingLog.timestamp,
                    habitCron.daily
                  ),
                  false
                )})`
              : ""
          }${
            isCountType ? `\n${previousCountTypeString}` : ""
          }\n**Previous Reflection:** ${
            currentReflection ? `\n${currentReflection}` : " N/A"
          }\n\n__**New Log:**__\n**State:** ${fn.getStateEmoji(
            habitLog
          )}\n**Timestamp:** ${fn.timestampToDateString(
            logTimestamp
          )}\n(Actual Habit Day: ${fn.timestampToDateString(
            fn.getActualDateLogged(logTimestamp, habitCron.daily),
            false
          )})${
            isCountType && (countValue || countValue === 0)
              ? `\n**${countMetric}:** Current Value (**${countValue}**) vs. ${countGoalTypeString} (**${countGoal}**)`
              : ""
          }${
            reflectionMessage
              ? `\n**Reflection Message:**\n${reflectionMessage}`
              : ""
          }`,
          forceSkip,
          `Habit${isArchived ? " Archive" : ""}: Log Confirmation`,
          600000
        );
        if (confirmEnd) {
          // 1. Check if there has already been a log for the given date.
          // 2. If so, find it and edit it, otherwise create a new one with the desired log
          // If no logs
          currentLogs = await Log.find({
            connectedDocument: targetHabit._id,
          }).sort({ timestamp: -1 });
          existingLog = fn.getHabitLogOnTimestampDay(
            currentLogs,
            logTimestamp,
            habitCron.daily
          );
          const overwriteLog = !!existingLog;
          const isTodaysLog = !!fn.getTodaysLog(
            currentLogs,
            timezoneOffset,
            habitCron.daily
          );
          console.log({ existingLog, isTodaysLog });
          if (existingLog) {
            console.log("Includes logs");
            // const recentLog = await Log.findOne({ connectedDocument: targetHabit._id })
            //     .sort({ _id: -1 });
            // if (!recentLog) return;

            existingLog = await Log.findOneAndUpdate(
              { _id: existingLog._id },
              {
                $set: {
                  timestamp: logTimestamp,
                  state: habitLog,
                  message: reflectionMessage,
                },
              },
              { new: true }
            );
            currentLogs = await Log.find({
              connectedDocument: targetHabit._id,
            }).sort({ timestamp: -1 });

            // else return console.error(`Today's Log has no connectedDocument!`);
          } else {
            console.log("No logs");
            const newLog = new Log({
              _id: mongoose.Types.ObjectId(),
              timestamp: logTimestamp,
              state: habitLog,
              message: reflectionMessage,
              connectedDocument: targetHabit._id,
            });
            if (!newLog) return;
            await newLog
              .save()
              .then((result) => console.log({ result }))
              .catch((err) => {
                console.error(err);
                return;
              });
            existingLog = newLog;
            currentLogs = await Log.find({
              connectedDocument: targetHabit._id,
            }).sort({ timestamp: -1 });
          }
          if (isCountType && (countValue || countValue === 0)) {
            await Log.updateOne(
              { _id: existingLog._id },
              { $push: { count: countValue } }
            );
          }

          console.log({ targetHabit });
          var {
            currentState,
            currentStreak,
            longestStreak,
            pastWeek,
            pastMonth,
            pastYear,
          } = targetHabit;
          currentStreak = fn.calculateCurrentStreak(
            currentLogs,
            timezoneOffset,
            habitCron,
            targetHabit.settings.isWeeklyType,
            targetHabit.settings.cronPeriods
          );
          if (currentStreak > (longestStreak ? longestStreak : 0)) {
            longestStreak = currentStreak;
          }
          pastWeek = hb.getPastWeekStreak(
            currentLogs,
            timezoneOffset,
            habitCron,
            targetHabit.createdAt
          );
          pastMonth = hb.getPastMonthStreak(
            currentLogs,
            timezoneOffset,
            habitCron,
            targetHabit.createdAt
          );
          pastYear = hb.getPastYearStreak(
            currentLogs,
            timezoneOffset,
            habitCron,
            targetHabit.createdAt
          );
          await Habit.updateOne(
            { _id: targetHabit._id },
            {
              $set: {
                currentState:
                  isTodaysLog && !overwriteLog ? currentState : habitLog,
                currentStreak,
                longestStreak,
                pastWeek,
                pastMonth,
                pastYear,
              },
            },
            (err) => {
              if (err) return console.error(err);
            }
          );
          return;
        } else return;
      } while (true);
      return;
    }

    // Show all of the stats for each of the user's habits that are not archived
    else if (
      habitCommand === "today" ||
      habitCommand === "tod" ||
      habitCommand === "to" ||
      habitCommand === "t" ||
      habitCommand === "current" ||
      habitCommand === "cu" ||
      habitCommand === "cur" ||
      habitCommand === "curr" ||
      habitCommand === "now" ||
      habitCommand === "nw" ||
      habitCommand === "n"
    ) {
      var habitIndex;
      let indexByRecency = false;
      if (args[2 + archiveShift] !== undefined) {
        if (args[2 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }
      const sortType = indexByRecency ? "By Recency" : "By Date Created";

      var targetHabit;
      if (indexByRecency)
        targetHabit = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ _id: -1 });
      else
        targetHabit = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ createdAt: +1 });
      if (!targetHabit)
        return message.reply(
          `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
        );
      if (!targetHabit.length)
        return message.reply(
          `**No ${
            isArchived ? "archived " : ""
          }habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
        );

      // If the user enters "recent" or a number, only show information for that one specific habit, otherwise show stats for all habits!
      const targetHabitParam = args[1 + archiveShift]
        ? args[1 + archiveShift].toLowerCase()
        : false;
      if (targetHabitParam) {
        const isNumberArg = !isNaN(args[1 + archiveShift]);
        if (targetHabitParam === "recent") {
          const recentHabit = await Habit.findOne({ userID: authorID }).sort({
            _id: -1,
          });
          if (recentHabit) {
            const recentHabitId = recentHabit._id.toString();
            const recentHabitIndex = targetHabit.findIndex(
              (habit) => habit._id.toString() === recentHabitId
            );
            if (recentHabitIndex === -1) return;
            targetHabit = [targetHabit[recentHabitIndex]];
            habitIndex = recentHabitIndex;
          }
        } else if (isNumberArg) {
          habitIndex = parseInt(args[1 + archiveShift]);
          if (habitIndex <= 0 || habitIndex > targetHabit.length) {
            return fn.sendErrorMessageAndUsage(
              message,
              habitActionHelpMessage,
              `**${
                isArchived ? "Archived " : ""
              }Habit ${habitIndex} does not exist **...`
            );
          } else {
            habitIndex--;
            targetHabit = [targetHabit[habitIndex]];
          }
        }
      }

      var habitOutputArray = new Array();
      var i = habitIndex || 0;
      for (const habit of targetHabit) {
        i++;
        habitOutputArray.push(
          `__**Habit ${i} (${sortType}):**__\n${await hb.habitDocumentToString(
            bot,
            habit,
            true,
            false,
            false,
            false
          )}`
        );
      }
      if (habitOutputArray.length) {
        const currentTimestamp = Date.now() + timezoneOffset * HOUR_IN_MS;
        await fn.sendPaginationEmbed(
          bot,
          message.channel.id,
          authorID,
          fn.getEmbedArray(
            habitOutputArray,
            `Today's Habits: ${fn.timestampToDateString(
              currentTimestamp,
              false,
              true,
              true,
              false
            )}`,
            true,
            `Habits ${fn.timestampToDateString(
              currentTimestamp,
              false,
              false,
              true,
              true
            )}`,
            habitEmbedColour
          ),
          true
        );
        return;
      }
    } else if (
      habitCommand === "stats" ||
      habitCommand === "statistics" ||
      habitCommand === "stat" ||
      habitCommand === "state" ||
      habitCommand === "states" ||
      habitCommand === "status" ||
      habitCommand === "i" ||
      habitCommand === "in" ||
      habitCommand === "inf" ||
      habitCommand === "info" ||
      habitCommand === "inform" ||
      habitCommand === "information" ||
      habitCommand === "data" ||
      habitCommand === "dat" ||
      habitCommand === "da"
    ) {
      var habitIndex;
      let indexByRecency = false;
      if (args[2 + archiveShift] !== undefined) {
        if (args[2 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }
      const sortType = indexByRecency ? "By Recency" : "By Date Created";

      var targetHabit;
      if (indexByRecency)
        targetHabit = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ _id: -1 });
      else
        targetHabit = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ createdAt: +1 });
      if (!targetHabit)
        return message.reply(
          `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
        );
      if (!targetHabit.length)
        return message.reply(
          `**No ${
            isArchived ? "archived " : ""
          }habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
        );

      // If the user enters "recent" or a number, only show information for that one specific habit, otherwise show stats for all habits!
      const targetHabitParam = args[1 + archiveShift]
        ? args[1 + archiveShift].toLowerCase()
        : false;
      if (targetHabitParam) {
        const isNumberArg = !isNaN(args[1 + archiveShift]);
        if (targetHabitParam === "recent") {
          const recentHabit = await Habit.findOne({ userID: authorID }).sort({
            _id: -1,
          });
          if (recentHabit) {
            const recentHabitId = recentHabit._id.toString();
            const recentHabitIndex = targetHabit.findIndex(
              (habit) => habit._id.toString() === recentHabitId
            );
            if (recentHabitIndex === -1) return;
            targetHabit = [targetHabit[recentHabitIndex]];
            habitIndex = recentHabitIndex;
          }
        } else if (isNumberArg) {
          habitIndex = parseInt(args[1 + archiveShift]);
          if (habitIndex <= 0 || habitIndex > targetHabit.length) {
            return fn.sendErrorMessageAndUsage(
              message,
              habitActionHelpMessage,
              `**${
                isArchived ? "Archived " : ""
              }Habit ${habitIndex} does not exist **...`
            );
          } else {
            habitIndex--;
            targetHabit = [targetHabit[habitIndex]];
          }
        }
      }

      var habitOutputArray = new Array();
      var i = habitIndex || 0;
      for (const habit of targetHabit) {
        i++;
        habitOutputArray.push(
          `__**Habit ${i} (${sortType}):**__\n${await hb.habitDocumentToString(
            bot,
            habit,
            true,
            true,
            false,
            true
          )}`
        );
      }
      if (habitOutputArray.length) {
        const currentTimestamp = Date.now() + timezoneOffset * HOUR_IN_MS;
        await fn.sendPaginationEmbed(
          bot,
          message.channel.id,
          authorID,
          fn.getEmbedArray(
            habitOutputArray,
            habitOutputArray.length === 1
              ? `Habit ${i}: Stats (${sortType})`
              : `Habits: Stats (${sortType})`,
            true,
            `Habits ${fn.timestampToDateString(
              currentTimestamp,
              false,
              false,
              true,
              true
            )}`,
            habitEmbedColour
          ),
          true
        );
        return;
      }
    }

    // Get the stats for the Past X Days
    // Show for ALL (non-archived) habits!
    else if (
      habitCommand === "past" ||
      habitCommand === "pas" ||
      habitCommand === "pa" ||
      habitCommand === "pst" ||
      habitCommand === "ps" ||
      habitCommand === "pt" ||
      habitCommand === "prev" ||
      habitCommand === "pre" ||
      habitCommand === "pr"
    ) {
      var habitIndex;
      let indexByRecency = false;
      if (args[3 + archiveShift] !== undefined) {
        if (args[3 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }
      const sortType = indexByRecency ? "By Recency" : "By Date Created";

      var targetHabit;
      if (indexByRecency)
        targetHabit = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ _id: -1 });
      else
        targetHabit = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ createdAt: +1 });
      if (!targetHabit)
        return message.reply(
          `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
        );
      if (!targetHabit.length)
        return message.reply(
          `**No ${
            isArchived ? "archived " : ""
          }habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
        );

      // If the user enters "recent" or a number, only show information for that one specific habit, otherwise show stats for all habits!
      const targetHabitParam = args[2 + archiveShift]
        ? args[2 + archiveShift].toLowerCase()
        : false;
      if (targetHabitParam) {
        const isNumberArg = !isNaN(args[2 + archiveShift]);
        if (targetHabitParam === "recent") {
          const recentHabit = await Habit.findOne({ userID: authorID }).sort({
            _id: -1,
          });
          if (recentHabit) {
            const recentHabitId = recentHabit._id.toString();
            const recentHabitIndex = targetHabit.findIndex(
              (habit) => habit._id.toString() === recentHabitId
            );
            if (recentHabitIndex === -1) return;
            targetHabit = [targetHabit[recentHabitIndex]];
            habitIndex = recentHabitIndex;
          }
        } else if (isNumberArg) {
          habitIndex = parseInt(args[2 + archiveShift]);
          if (habitIndex <= 0 || habitIndex > targetHabit.length) {
            return fn.sendErrorMessageAndUsage(
              message,
              habitActionHelpMessage,
              `**${
                isArchived ? "Archived " : ""
              }Habit ${habitIndex} does not exist **...`
            );
          } else {
            habitIndex--;
            targetHabit = [targetHabit[habitIndex]];
          }
        }
      }

      const pastXDays = parseInt(args[1 + archiveShift]);
      if (pastXDays) {
        var habitOutputArray = new Array();
        var i = habitIndex || 0;
        for (const habit of targetHabit) {
          i++;
          habitOutputArray.push(
            `__**Habit ${i} (${sortType}):**__\n${await hb.habitDocumentToString(
              bot,
              habit,
              true,
              true,
              false,
              false,
              pastXDays
            )}`
          );
        }
        if (habitOutputArray.length) {
          const currentTimestamp = Date.now() + timezoneOffset * HOUR_IN_MS;
          await fn.sendPaginationEmbed(
            bot,
            message.channel.id,
            authorID,
            fn.getEmbedArray(
              habitOutputArray,
              `Habits: Past ${pastXDays} Days Stats`,
              true,
              `Habits ${fn.timestampToDateString(
                currentTimestamp,
                false,
                false,
                true,
                true
              )}`,
              habitEmbedColour
            ),
            true
          );
          return;
        }
      }
      message.reply(
        `**Please enter a number __> 0__**: \`${PREFIX}${commandUsed} ${habitCommand} <NUMBER>\``
      );
      return;
    }

    // Set one or more reminders for a specific habit
    // Or get a weekly update like Track (screen time)
    else if (
      habitCommand === "reminder" ||
      habitCommand === "remindme" ||
      habitCommand === "remind" ||
      habitCommand === "remindme" ||
      habitCommand === "remin" ||
      habitCommand === "rem" ||
      habitCommand === "re" ||
      habitCommand === "r"
    ) {
      let habitReminderUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <archive?> <recent?> <force?>\`\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<recent?>\`(OPT.): type **recent** to order the habits by **actual time created instead of the date created property!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      habitReminderUsageMessage = fn.getMessageEmbed(
        habitReminderUsageMessage,
        `Habit: Reminder Help`,
        habitEmbedColour
      );
      if (habitType === "help")
        return message.channel.send(habitReminderUsageMessage);

      let indexByRecency = false;
      if (args[2 + archiveShift] !== undefined) {
        if (args[2 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }
      const sortType = indexByRecency ? "By Recency" : "By Date Created";

      var targetHabit;
      if (indexByRecency)
        habitArray = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ _id: -1 });
      else
        habitArray = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ createdAt: +1 });
      if (!habitArray)
        return message.reply(
          `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
        );
      if (!habitArray.length)
        return message.reply(
          `**No ${
            isArchived ? "archived " : ""
          }habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
        );

      // If the user enters "recent" or a number, only show information for that one specific habit, otherwise show stats for all habits!
      const targetHabitParam = args[1 + archiveShift]
        ? args[1 + archiveShift].toLowerCase()
        : false;
      if (targetHabitParam) {
        const isNumberArg = !isNaN(args[1 + archiveShift]);
        if (targetHabitParam === "recent") {
          const recentHabit = await Habit.findOne({ userID: authorID }).sort({
            _id: -1,
          });
          if (recentHabit) {
            const recentHabitId = recentHabit._id.toString();
            const recentHabitIndex = habitArray.findIndex(
              (habit) => habit._id.toString() === recentHabitId
            );
            if (recentHabitIndex === -1) return;
            targetHabit = habitArray[recentHabitIndex];
          }
        } else if (isNumberArg) {
          const habitIndex = parseInt(args[1 + archiveShift]);
          if (habitIndex <= 0 || habitIndex > habitArray.length) {
            return fn.sendErrorMessageAndUsage(
              message,
              habitActionHelpMessage,
              `**${
                isArchived ? "Archived " : ""
              }Habit ${habitIndex} does not exist **...`
            );
          } else {
            targetHabit = habitArray[habitIndex - 1];
          }
        }
      }

      if (!targetHabit) {
        targetHabit = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          "__**Which habit would you like to set a recurring reminder for?**__",
          `Habit${isArchived ? " Archive" : ""}: Select Habit For Reminder`,
          habitArray,
          "description",
          false,
          habitEmbedColour,
          600000
        );
        if (!targetHabit) return;
        else targetHabit = targetHabit.object;
      }

      await hb.setUserHabitReminder(
        bot,
        message,
        PREFIX,
        timezoneOffset,
        daylightSaving,
        commandUsed,
        authorID,
        targetHabit,
        true
      );
      return;
    } else if (
      archiveRegex.test(habitCommand) ||
      habitCommand === "stash" ||
      habitCommand === "store" ||
      habitCommand === "stall" ||
      habitCommand === "rest" ||
      habitCommand === "pause" ||
      habitCommand === "freeze" ||
      habitCommand === "free" ||
      habitCommand === "fr" ||
      habitCommand === "f"
    ) {
      if (tier === 1) {
        if (totalArchiveNumber >= habitArchiveMax) {
          return message.channel.send(
            fn
              .getMessageEmbed(
                fn.getTierMaxMessage(
                  PREFIX,
                  commandUsed,
                  habitArchiveMax,
                  ["Habit", "Habits"],
                  1,
                  true
                ),
                `Habit Archive: Tier 1 Maximum`,
                habitEmbedColour
              )
              .setFooter(fn.premiumFooterText)
          );
        }
      }

      // Allows for archive - indexing by unarchived entries only!
      let habitArchiveUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${habitCommand} <recent?> <force?>\`\n\n\`<recent?>\`(OPT.): type **recent** to order the habits by **actual time created instead of the date created property!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      habitArchiveUsageMessage = fn.getMessageEmbed(
        habitArchiveUsageMessage,
        `Habit: Archive Help`,
        habitEmbedColour
      );
      if (habitType === "help")
        return message.channel.send(habitArchiveUsageMessage);

      var habitIndex;
      let indexByRecency = false;
      if (args[2 + archiveShift] !== undefined) {
        if (args[2 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }
      const sortType = indexByRecency ? "By Recency" : "By Date Created";

      var targetHabitParam =
        args[1 + archiveShift] && args[1 + archiveShift].toLowerCase();
      do {
        var targetHabit, habitArray;
        if (indexByRecency)
          habitArray = await Habit.find({
            archived: isArchived,
            userID: authorID,
          }).sort({ _id: -1 });
        else
          habitArray = await Habit.find({
            archived: isArchived,
            userID: authorID,
          }).sort({ createdAt: +1 });
        if (!habitArray)
          return message.reply(
            `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        if (!habitArray.length)
          return message.reply(
            `**No ${
              isArchived ? "archived " : ""
            }habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
          );

        // If the user enters "recent" or a number, only show information for that one specific habit, otherwise show stats for all habits!
        if (targetHabitParam) {
          const isNumberArg = !isNaN(args[1 + archiveShift]);
          if (targetHabitParam === "recent") {
            const recentHabit = await Habit.findOne({ userID: authorID }).sort({
              _id: -1,
            });
            if (recentHabit) {
              const recentHabitId = recentHabit._id.toString();
              const recentHabitIndex = habitArray.findIndex(
                (habit) => habit._id.toString() === recentHabitId
              );
              if (recentHabitIndex === -1) return;
              targetHabit = habitArray[recentHabitIndex];
            }
          } else if (isNumberArg) {
            let habitIndex = parseInt(args[1 + archiveShift]);
            if (habitIndex <= 0 || habitIndex > habitArray.length) {
              return fn.sendErrorMessageAndUsage(
                message,
                habitActionHelpMessage,
                `**${
                  isArchived ? "Archived " : ""
                }Habit ${habitIndex} does not exist **...`
              );
            } else {
              targetHabit = habitArray[habitIndex - 1];
            }
          }
        }

        if (!targetHabit) {
          const selectedHabit = await fn.getUserSelectedObject(
            bot,
            message,
            PREFIX,
            "__**Which habit would you like to archive?**__",
            `Habit${isArchived ? " Archive" : ""}: Archive Selection`,
            habitArray,
            "description",
            false,
            habitEmbedColour,
            600000,
            0
          );
          if (!selectedHabit) return;
          else targetHabit = selectedHabit.object;
        }

        const confirmEnd = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          `**__Are you sure you want to archive this habit?__**\n\n❄ - **Your current streak will be frozen and stopped.**\n🕵️‍♀️ - **This habit won't show up in your regular commands:**\n\`${PREFIX}${commandUsed} see\` \`${PREFIX}${commandUsed} edit\` \`${PREFIX}${commandUsed} post\` \`${PREFIX}${commandUsed} delete\`\n⏲ - **You won't get reminders for it anymore.** (if any)\n\n${fn.habitDocumentDescription(
            targetHabit
          )}`,
          forceSkip,
          `Habit${isArchived ? " Archive" : ""}: Archive Confirmation`,
          600000
        );
        if (!confirmEnd) return;
        await Habit.updateOne(
          { _id: targetHabit._id },
          { $set: { archived: true } },
          async (err, result) => {
            if (err) return console.error(err);
            console.log({ result });
            if (targetHabit._id) {
              rm.cancelRemindersByConnectedDocument(targetHabit._id);
              await Reminder.deleteMany({
                connectedDocument: targetHabit._id,
              });
              hb.cancelHabitById(targetHabit._id);
            }
          }
        );
        targetHabitParam = undefined;
      } while (true);
    } else return message.reply(habitHelpMessage);
  },
};
