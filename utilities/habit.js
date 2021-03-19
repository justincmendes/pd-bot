// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const Habit = require("../djs-bot/database/schemas/habit");
const Log = require("../djs-bot/database/schemas/habittracker");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const Goal = require("../djs-bot/database/schemas/longtermgoals");
const User = require("../djs-bot/database/schemas/user");
const mongoose = require("mongoose");
const fn = require("./functions");
const rm = require("./reminder");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const habitEmbedColour = fn.habitEmbedColour;
const mastermindEmbedColour = fn.mastermindEmbedColour;
const areasOfLifeEmojis = fn.areasOfLifeEmojis;
const areasOfLife = fn.areasOfLife;
const areasOfLifeCombinedEmoji = fn.getAreasOfLifeEmojiCombinedArray();
const areasOfLifeList = fn.getAreasOfLifeList().join("\n");
const checkMissedSkipList =
  "\n`1` - **Check** ✅\n`2` - **Missed** ❌\n`3` - **Skip** ⏭ (still counts as a check)";
const habits = new Discord.Collection();

// Private Function Declarations

module.exports = {
  habitDocumentToString: async function (
    bot,
    habitDocument,
    showConnectedGoal = false,
    showRecentStats = false,
    showSettings = false,
    showTotalStats = false,
    showPastXDays = 0
  ) {
    console.log({ habitDocument });
    const {
      _id: habitID,
      userID,
      createdAt,
      archived,
      description,
      specifics,
      areaOfLife,
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
    const userSettings = await User.findOne(
      { discordID: userID },
      { _id: 0, habitCron: 1, "timezone.offset": 1 }
    );
    const { habitCron, timezone } = userSettings;
    const { offset: timezoneOffset } = timezone;
    console.log({ userSettings, timezoneOffset });
    let connectedGoalString = "";
    if (showConnectedGoal) {
      const goalDocument = await Goal.findById(connectedGoal);
      if (goalDocument)
        if (
          goalDocument.description &&
          (goalDocument.type || goalDocument.type === 0)
        ) {
          connectedGoalString = `\n🎯 - **Associated Goal:** ${
            areasOfLifeEmojis[goalDocument.type]
              ? `${areasOfLifeEmojis[goalDocument.type]} `
              : ""
          }${
            areasOfLife[goalDocument.type]
              ? `__${areasOfLife[goalDocument.type]}__`
              : ""
          }\n${goalDocument.description}`;
        }
    }
    let statsString = "";
    if (showRecentStats) {
      statsString = "\n";
      const currentDate = new Date(Date.now() + HOUR_IN_MS * timezoneOffset);
      if (habitCron)
        if (habitCron.weekly || habitCron.weekly === 0) {
          const pastWeekTotal =
            ((6 - (habitCron.weekly - currentDate.getUTCDay())) % 7) + 1 ||
            " N/A";
          const pastWeekPercentage = !isNaN(pastWeekTotal)
            ? ` (${(((pastWeek || 0) / pastWeekTotal) * 100).toFixed(2)}%)`
            : "";
          statsString += `**Past Week:** ${
            pastWeek || 0
          }/${pastWeekTotal}${pastWeekPercentage}\n`;
        }

      const pastMonthTotal =
        fn.getDayFromStartOfMonthAndCreatedAt(
          currentDate.getTime(),
          createdAt
        ) || " N/A";
      const pastMonthPercentage = !isNaN(pastMonthTotal)
        ? ` (${(((pastMonth || 0) / pastMonthTotal) * 100).toFixed(2)}%)`
        : "";
      statsString += `**Past Month:** ${
        pastMonth || 0
      }/${pastMonthTotal}${pastMonthPercentage}`;

      const createdDate = new Date(createdAt);
      var pastYearTotal;
      if (currentDate.getUTCFullYear() === createdDate.getUTCFullYear()) {
        pastYearTotal =
          fn.getDayOfYear(currentDate.getTime()) +
          1 -
          fn.getDayOfYear(createdAt);
        pastYearTotal = pastYearTotal > 0 ? pastYearTotal : " N/A";
      } else {
        pastYearTotal = fn.getDayOfYear(currentDate.getTime());
      }
      const pastYearPercentage = !isNaN(pastYearTotal)
        ? ` (${(((pastYear || 0) / pastYearTotal) * 100).toFixed(2)}%)`
        : "";
      statsString += `\n**Past Year:** ${
        pastYear || 0
      }/${pastYearTotal}${pastYearPercentage}`;
    }

    let pastXDaysString = "";
    if (showPastXDays)
      if (typeof showPastXDays === "number") {
        showPastXDays = parseInt(showPastXDays);
        // Gather all of the logs
        let logs = await Log.find({ connectedDocument: habitID }).sort({
          timestamp: -1,
        });
        if (logs)
          if (logs.length) {
            // Find all of the logs between today's next cron
            // & x days before
            const pastXDaysFinal = this.getPastDaysStreak(
              logs,
              timezoneOffset,
              habitCron,
              showPastXDays
            );
            const pastXDaysPercentage = `${(
              (pastXDaysFinal / showPastXDays) *
              100
            ).toFixed(2)}%`;
            pastXDaysString += `\n**Past ${showPastXDays} Days:** ${pastXDaysFinal}/${showPastXDays} (${pastXDaysPercentage})`;

            // const todaysCronTimestamp = new Date(
            //     currentDate.getUTCFullYear(), currentDate.getUTCMonth(),
            //     currentDate.getUTCDay()).getTime() + habitCron.daily;
            // const pastCronTimestamp = new Date(
            //     currentDate.getUTCFullYear(), currentDate.getUTCMonth(),
            //     currentDate.getUTCDay() - showPastXDays).getTime() + habitCron.daily;
            // logs = logs.map(log => {
            //     const { timestamp } = log;
            //     if (timestamp || timestamp === 0) {
            //         if (timestamp >= pastCronTimestamp
            //             && timestamp < todaysCronTimestamp) {
            //             return log;
            //         }
            //     }
            //     return null;
            // })
            //     // Take note of only the logs that have values of skips or checks!
            //     .filter(log => log !== null).filter(log => log.state !== 0 && log.state !== 2);

            // const pastXDaysPercentage = `${((logs.length / showPastXDays) * 100).toFixed(2)}%`;
            // statsString += `\n**Past ${showPastXDays} Days:** ${logs.length}/${showPastXDays} (${pastXDaysPercentage})`;
          }
      }

    let settingsString = "";
    if (showSettings && settings) {
      settingsString = "\n";
      const cronString = `**Habit Reset Time:** Every ${
        settings.cronPeriods === 1
          ? `${settings.isWeeklyType ? "week" : "day"}`
          : `${settings.cronPeriods || 1} ${
              settings.isWeeklyType ? "week(s)" : "day(s)"
            }`
      } at ${fn.msToTimeFromMidnight(habitCron.daily)}`;
      let countGoalString = "";
      switch (settings.countGoalType) {
        case 1:
          countGoalString = `\n- **Daily Goal:** ${
            settings.countGoal || "None"
          }`;
          break;
        case 2:
          countGoalString = `\n- **Weekly Goal:** ${
            settings.countGoal || "None"
          }`;
          break;
        case 3:
          countGoalString = `\n- **Total/Cumulative Goal:** ${
            settings.countGoal || "None"
          }`;
          break;
      }
      let autoLogString = "No";
      switch (settings.autoLogType) {
        case 1:
          autoLogString = "Streak";
          break;
        case 2:
          autoLogString = "Based on Count Goal";
          break;
      }
      settingsString += `${cronString}\n**Habit Count Value:** ${
        settings.isCountType
          ? `Yes\n- **Metric:** ${settings.countMetric || "N/A"}` +
            countGoalString
          : "No"
      }\n**Auto Complete:** ${autoLogString}`;
      // let integrationType = "";
      // if (settings.integration) {
      //     if (settings.integration.name) {
      //         integrationType = `**Connected Type:** ${fn.toTitleCase(settings.integration.name)}`;
      //         if (settings.integration.type) {
      //             /**
      //              * 1. Check in at least once a day or once a week (Mastermind)
      //              * 2.
      //              */
      //             integrationType += "\n- **Explanation:** ";
      //             switch (settings.integration.name) {
      //                 case 'Fast': {
      //                     switch (settings.integration.type) {
      //                         case 1: integrationType += "Complete a fast at least once a day";
      //                             break;
      //                         case 2: integrationType += "";
      //                             break;
      //                     }
      //                 }
      //                     break;
      //                 case 'Journal': {
      //                     switch (settings.integration.type) {
      //                         case 1: integrationType += "Create at least 1 journal entry once a day";
      //                             break;
      //                         case 2: integrationType += "";
      //                             break;
      //                     }
      //                 }
      //                     break;
      //                 case 'Mastermind': {
      //                     switch (settings.integration.type) {
      //                         case 1: integrationType += "Create at least 1 mastermind entry once a week";
      //                             break;
      //                         case 2: integrationType += "";
      //                             break;
      //                     }
      //                 }
      //                     break;
      //             }
      //         }
      //     }
    }
    var totalStatsString = "";
    if (showTotalStats && habitID) {
      totalStatsString = "\n";
      const totalEntries = await Log.find({
        connectedDocument: habitID,
      }).countDocuments();
      const totalChecked = await Log.find({
        connectedDocument: habitID,
        state: 1,
      }).countDocuments();
      const totalMissed = await Log.find({
        connectedDocument: habitID,
        state: 2,
      }).countDocuments();
      const totalSkipped = await Log.find({
        connectedDocument: habitID,
        state: 3,
      }).countDocuments();
      const totalTracked = totalEntries - totalMissed;
      const averageCheckedPercent = totalEntries
        ? ((totalTracked / totalEntries) * 100).toFixed(2)
        : 0.0;
      const averageMissedPercent = totalEntries
        ? (100 - averageCheckedPercent).toFixed(2)
        : 0.0;
      totalStatsString += `**Total Logged Entries:** ${
        totalEntries || 0
      }\n- **Checked ✅:** ${totalChecked || 0}\n- **Missed ❌:** ${
        totalMissed || 0
      }\n- **Skipped ⏭:** ${
        totalSkipped || 0
      }\n- **Average Checked (includes skips):** ${
        averageCheckedPercent || `0.00`
      }%\n- **Average Missed:** ${averageMissedPercent || `0.00`}%`;
    }
    let currentStateString = `**Current Log:** ${fn.getStateEmoji(
      currentState
    )}`;
    const areaOfLifeString = fn.getAreaOfLifeString(areaOfLife);

    let outputString =
      `${archived ? "****ARCHIVED****\n" : ""}${areaOfLifeString}${
        description ? `\n👣 - **Description:**\n${description}` : ""
      }${specifics ? `\n${fn.habitDocumentSpecifics(habitDocument)}` : ""}${
        reason ? `\n💭 - **Reason:**\n${reason}` : ""
      }${connectedGoalString}\n${currentStateString}\n**Current Streak:** ${
        currentStreak || 0
      }\n**Longest Streak:** ${longestStreak || 0}${
        createdAt || createdAt === 0
          ? `\n**Created At:** ${fn.timestampToDateString(
              createdAt,
              true,
              true,
              true
            )}`
          : ""
      }${
        nextCron || nextCron === 0
          ? `\n**Next Streak Reset:** ${fn.timestampToDateString(
              nextCron + timezoneOffset * HOUR_IN_MS,
              true,
              true,
              true
            )}`
          : ""
      }` +
      statsString +
      pastXDaysString +
      settingsString +
      totalStatsString;

    outputString = fn.getRoleMentionToTextString(bot, outputString);
    return outputString;
  },

  getHabitIndexByFunction: async function (
    userID,
    habitID,
    totalHabits,
    archived,
    getOneHabit
  ) {
    let i = 0;
    while (true) {
      let habit = await getOneHabit(userID, i, archived);
      console.log({ habit, habitID, userID, i, archived, totalHabits });
      if (!habit && i >= totalHabits) {
        return false;
      } else if (habit._id.toString() === habitID.toString()) break;
      i++;
    }
    return i + 1;
  },

  getRecentHabitIndex: async function (userID, archived) {
    try {
      var index;
      const entries = await Habit.find({ userID, archived }).sort({
        createdAt: +1,
      });
      if (entries.length) {
        let targetID = await Habit.findOne({ userID, archived }).sort({
          _id: -1,
        });
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
  },

  getHabitReadOrDeleteHelp: function (PREFIX, commandUsed, crudCommand) {
    return `**USAGE:**\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> past <PAST_#_OF_ENTRIES> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> <ENTRY #> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> many <MANY_ENTRIES> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> <#_OF_ENTRIES> <recent?> past <STARTING_INDEX> <force?>\`\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; 5** (\\*any number); **all** \n(NOTE: ***__any number > 1__* will get more than 1 habit!**)\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\**any number*)\n\n\`<ENTRY_#>\`: **all; recent; 3** (3rd most recent habit, \\**any number*)\n(NOTE: Gets just 1 habit - UNLESS \`all\`)\n\n\`<MANY_ENTRIES>\`: **3,5,recent,7,1,25**\n- **COMMA SEPARATED, NO SPACES:**\n1 being the most recent habit, 25 the 25th most recent, etc.\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<recent?>\`: (OPT.) type **recent** at the indicated spot to sort the habits by **time created instead of the date created property!**\n\n\`<force?>\`: (OPT.) type **force** at the end of your command to **skip all of the confirmation windows!**`;
  },

  setHabitReminder: async function (
    bot,
    timezoneOffset,
    commandUsed,
    userID,
    endTime,
    interval,
    habitID
  ) {
    try {
      const reminderMessage = await fn.getHabitReminderMessage(
        userID,
        timezoneOffset,
        commandUsed,
        habitID
      );
      const now = fn.getCurrentUTCTimestampFlooredToSecond();
      // Delete currently running reminders!
      if (habitID) {
        rm.cancelRemindersByConnectedDocument(habitID);
        await Reminder.deleteMany({ userID, connectedDocument: habitID });
      }
      await rm.setNewDMReminder(
        bot,
        userID,
        now,
        endTime,
        reminderMessage,
        "Habit",
        true,
        habitID,
        true,
        interval,
        false,
        habitEmbedColour
      );
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  setUserHabitReminder: async function (
    bot,
    message,
    PREFIX,
    timezoneOffset,
    daylightSaving,
    commandUsed,
    userID,
    habitDocument,
    showHabitInConfirmation = false
  ) {
    try {
      let interval = await rm.getInterval(
        bot,
        message,
        PREFIX,
        timezoneOffset,
        daylightSaving,
        `__**Please enter the time you'd like in-between recurring reminders (interval):**__${
          showHabitInConfirmation
            ? `\n\n${fn.habitDocumentDescription(habitDocument)}`
            : ""
        }`,
        "Habit: Reminder Interval",
        habitEmbedColour
      );
      if (!interval) return interval;
      let { duration: intervalDuration, args: intervalArgs } = interval;

      let endTime = await fn.getDateAndTimeEntry(
        bot,
        message,
        PREFIX,
        timezoneOffset,
        daylightSaving,
        `**When** would you like to **get your first habit reminder?**${
          showHabitInConfirmation
            ? `\n\n${fn.habitDocumentDescription(habitDocument)}`
            : ""
        }`,
        "Habit: First Reminder Time",
        true,
        habitEmbedColour
      );
      if (!endTime && endTime !== 0) return endTime;
      endTime -= HOUR_IN_MS * timezoneOffset;

      const successfullySetReminder = await this.setHabitReminder(
        bot,
        timezoneOffset,
        commandUsed,
        userID,
        endTime,
        intervalArgs,
        habitDocument._id
      );
      if (successfullySetReminder) {
        console.log("Habit log recurring reminder set.");
        message.reply(
          `Habit log recurring reminder set!${
            showHabitInConfirmation
              ? `\n${fn.habitDocumentDescription(habitDocument)}`
              : ""
          }\n**__First Reminder:__** **${fn.millisecondsToTimeString(
            endTime - fn.getCurrentUTCTimestampFlooredToSecond()
          )}** from now\n**__Interval:__** **${fn.millisecondsToTimeString(
            intervalDuration
          )}**`
        );
      }
      return successfullySetReminder;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  getSelectedPostHabits: async function (bot, message, PREFIX, habits) {
    try {
      console.log({ habits });
      const originalLength = habits.length;
      var reset;
      let finalHabits = new Array();
      do {
        const someHabitsSelected = habits.length !== originalLength;
        reset = false;

        const selectedHabit = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          `**__Select the habit you'd like to post:__**${
            someHabitsSelected
              ? `\n(Type \`${habits.length + 1}\` if you're done)`
              : ""
          }`,
          "Habit: Post - Habit Selection",
          habits,
          "description",
          false,
          habitEmbedColour,
          600000,
          0,
          null,
          someHabitsSelected ? ["**DONE**"] : []
        );
        if (!selectedHabit) return selectedHabit;
        else {
          if (selectedHabit.index !== habits.length) {
            finalHabits.push(habits[selectedHabit.index]);
            habits.splice(selectedHabit.index, 1);
            if (habits.length) {
              const anotherHabit = await fn.getUserConfirmation(
                bot,
                message,
                PREFIX,
                "**__Would you like to add another habit to be posted?__**",
                false,
                "Habit: Post - Add More?"
              );
              if (typeof anotherHabit === "boolean") {
                if (anotherHabit === true) reset = true;
                else reset = false;
              } else return null;
            }
          }
        }
        if (!habits.length) reset = false;
      } while (reset);
      return finalHabits;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  setMastermindHabits: async function (
    bot,
    message,
    PREFIX,
    commandUsed,
    timezoneOffset,
    daylightSaving,
    mastermindDocument,
    userSettings
  ) {
    try {
      var reset;
      let mastermindGoals = [...mastermindDocument.journal.goals];
      console.log({ mastermindGoals });
      console.log(mastermindDocument.journal.goals);
      let finalGoals = new Array();
      do {
        const someGoalsSelected =
          mastermindGoals.length !== mastermindDocument.journal.goals.length;
        reset = false;

        const selectedGoal = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          `**Select the goal you'd like to make into a habit:**${
            someGoalsSelected
              ? `\n(Type \`${mastermindGoals.length + 1}\` if you're done)`
              : ""
          }`,
          "Mastermind: Weekly Goal into Habit Selection",
          mastermindGoals,
          "description",
          false,
          mastermindEmbedColour,
          600000,
          0,
          null,
          someGoalsSelected ? ["**DONE**"] : []
        );
        if (!selectedGoal) return selectedGoal;
        else {
          if (selectedGoal.index !== mastermindGoals.length) {
            finalGoals.push(mastermindGoals[selectedGoal.index]);
            mastermindGoals.splice(selectedGoal.index, 1);
            if (mastermindGoals.length) {
              const anotherHabit = await fn.getUserConfirmation(
                bot,
                message,
                PREFIX,
                `**Would you like to convert another goal into a habit?**\n\n**If you want to setup Weekly Goal habits later**, type \`${PREFIX}${commandUsed} habit\``,
                false,
                "Mastermind: Weekly Goals into Habits"
              );
              if (typeof anotherHabit === "boolean") {
                if (anotherHabit === true) reset = true;
                else reset = false;
              } else return null;
            }
          }
        }
        if (!mastermindGoals.length) reset = false;
      } while (reset);

      const confirmConversion = await fn.getUserConfirmation(
        bot,
        message,
        PREFIX,
        `**Are you sure you want to convert the following goals into habits?**\n(Default settings will be applied: **daily habit, manual entry, no count value** - you can edit these using \`${PREFIX}habit edit\`)\n\n**If you want to setup Weekly Goal habits later**, type \`${PREFIX}${commandUsed} habit\`\n\n${
          fn.goalArrayToString(finalGoals, "Weekly", true, false) || ""
        }`,
        true,
        "Mastermind: Confirm Weekly Goals into Habits",
        600000
      );
      if (!confirmConversion) return confirmConversion;
      else if (confirmConversion) {
        const { habitCron } = userSettings;
        const nextCron = fn.getNextCronTimeUTC(
          timezoneOffset,
          habitCron,
          false,
          1
        );

        const confirmHabitReminders = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          `**Would you like to set a reminder to track your habit for __any__ of the habits you've created?**`,
          true,
          "Mastermind: Weekly Goal Habit Reminder",
          300000
        );
        var keepPromptingReminder = true;

        for (const goal of finalGoals) {
          const habit = new Habit({
            _id: mongoose.Types.ObjectId(),
            userID: mastermindDocument.userID,
            createdAt:
              fn.getCurrentUTCTimestampFlooredToSecond() +
              HOUR_IN_MS * timezoneOffset,
            archived: false,
            description: goal.description,
            areaOfLife: goal.type,
            specifics: goal.specifics,
            reason: goal.reason,
            connectedGoal: goal.connectedGoal,
            nextCron,
            settings: {
              isCountType: false,
              isWeeklyType: false,
              cronPeriods: 1,
            },
            currentStreak: 0,
            currentState: 0,
            longestStreak: 0,
            pastWeek: 0,
            pastMonth: 0,
            pastYear: 0,
          });
          await habit
            .save()
            .then((result) => console.log({ result }))
            .catch((err) => console.error(err));
          await this.habitCron(habit, timezoneOffset, habitCron);

          if (confirmHabitReminders && keepPromptingReminder) {
            const setHabitReminder = await this.setUserHabitReminder(
              bot,
              message,
              PREFIX,
              timezoneOffset,
              daylightSaving,
              "habit",
              mastermindDocument.userID,
              habit,
              true
            );
            if (setHabitReminder === null) keepPromptingReminder = null;
          }
        }
        if (!keepPromptingReminder) return keepPromptingReminder;
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  getHabitSpecifics: async function (
    bot,
    message,
    PREFIX,
    forceSkip,
    title = "Habit: Specifics",
    embedColour = fn.habitEmbedColour,
    additionalInstructions = false,
    instructionKeywords = []
  ) {
    const specifics = await fn.getMultilineEntry(
      bot,
      message,
      PREFIX,
      `**__Answer some or all the following questions regarding your habit:__**\n(Within 1000 characters)\n🔴 - **How** will do your habit?\n🔵 - **Who** do you need help from or who is involved?\n🟢 - **Where** will you do your habit?\n🟡 - **When** will you do your habit?\n\n**__Examples (from *Atomic Habits* by James Clear):__**\n${this.implementationIntentionsExamples}\n\n${this.habitStackingExamples}`,
      `${title} (Who, Where, When, How)`,
      forceSkip,
      embedColour,
      1000,
      additionalInstructions,
      instructionKeywords
    );
    if (!specifics) return specifics;
    else return specifics.message;
  },

  implementationIntentionsExamples:
    "🔵 **__Implementation Intentions__** 🔵\n`I will [BEHAVIOR] at [TIME] in [LOCATION].`\n- I will meditate for one minute at 7 a.m. in my kitchen.\n- I will study Spanish for twenty minutes at 6 p.m. in my bedroom.\n- I will exercise for one hour at 5 p.m. in my local gym.\n- I will make my partner a cup of tea at 8 a.m. in the kitchen.",
  habitStackingExamples:
    "🔴 **__Habit Stacking__** 🔴\n`After/Before [CURRENT HABIT], I will [NEW HABIT].`\n- After I pour my cup of coffee each morning, I will meditate for one minute.\n- After I take off my work shoes, I will immediately change into my workout clothes.\n- After I sit down to dinner, I will say one thing I’m grateful for that happened today.\n- After I get into bed at night, I will give my partner a kiss.\n- After I put on my running shoes, I will text a friend or family member where I am running and how long it will take.",

  getOneHabitByRecency: async function (
    userID,
    habitIndex,
    archived = undefined
  ) {
    const habit = await Habit.findOne({ userID, archived })
      .sort({ _id: -1 })
      .skip(habitIndex)
      .catch((err) => {
        console.log(err);
        return false;
      });
    return habit;
  },

  getOneHabitByCreatedAt: async function (
    userID,
    habitIndex,
    archived = undefined
  ) {
    const habit = await Habit.findOne({ userID, archived })
      .sort({ createdAt: +1 })
      .skip(habitIndex)
      .catch((err) => {
        console.log(err);
        return false;
      });
    return habit;
  },

  getNextDailyCronTimeUTC: function (timezoneOffset, dailyCron) {
    const now = Date.now() + timezoneOffset * HOUR_IN_MS;
    const currentDate = new Date(now);

    // Check if the cron is in the same day
    const sameDayCron =
      new Date(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate()
      ).getTime() + dailyCron;
    if (sameDayCron >= now) {
      return sameDayCron - timezoneOffset * HOUR_IN_MS;
    }

    // Otherwise the cron is on the next day
    const nextDayCron =
      new Date(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate() + 1
      ).getTime() + dailyCron;
    return nextDayCron - timezoneOffset * HOUR_IN_MS;
  },

  habitCron: async function (habit, offset, habitCron) {
    // const { daily: dailyCron } = habitCron;
    var nextCron;
    let { _id, userID } = habit;
    let { settings } = habit;
    let { isWeeklyType, cronPeriods } = settings;
    nextCron = await fn.getNextCronTimeUTC(
      offset,
      habitCron,
      isWeeklyType,
      cronPeriods
    );
    habit.nextCron = nextCron;
    await Habit.updateOne({ _id }, { $set: { nextCron } });
    const now = Date.now();
    const cronDelay = nextCron - now;
    console.log(fn.timestampToDateString(nextCron + offset * HOUR_IN_MS));
    console.log(
      `User Id: ${userID}\nHabit Description: ${
        habit.description
      }\nHabit Cron Delay: ${fn.millisecondsToTimeString(cronDelay)}\n`
    );

    // const nextCronTime = fn.getNextCronTimeUTC(offset, habitCron,
    //     isWeeklyType, cronPeriods, nextCron);
    // console.log({ nextCronTime });
    // console.log(fn.timestampToDateString(nextCronTime + offset * HOUR_IN_MS));

    // const interval = nextCronTime - nextCron;
    // console.log({ interval });
    // console.log(fn.millisecondsToTimeString(interval));
    // console.log(`Habit Cron: User ID - ${userID}.`);
    try {
      if (!habits.has(userID)) {
        habits.set(userID, new Array());
      }
      const userHabits = habits.get(userID);
      userHabits.push({
        id: _id.toString(),
        timeout: fn.setLongTimeout(async () => {
          const updatedHabit = await this.updateHabit(habit, offset, habitCron);
          if (!updatedHabit) return false;
          let updatedOffset = offset;
          let updatedHabitCron = habitCron;
          const userSettings = await User.findOne(
            { discordID: userID },
            { _id: 0, "timezone.offset": 1, habitCron: 1 }
          );
          if (userSettings) {
            updatedOffset = userSettings.timezone.offset;
            updatedHabitCron = userSettings.habitCron;
          }
          await this.habitCron(updatedHabit, updatedOffset, updatedHabitCron);
        }, cronDelay),
      });
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  habitCronUser: async function (userID) {
    // FUTURE SUPPORT: If a habit resets on a weekly basis on a different day
    // this type of behaviour can easily be integrated into the following code
    // by adding an extra input window to the habit creation and adding the
    // weeklyCron field to the habit settings object and resetting each of the
    // habits based on that weekly reset day value instead of the one in the user settings

    // Step 1: Schedule the proper habit allocation to happen at the next cron time
    // Step 2: At the cron time, check each habit one-by-one and set and individually
    // scheduled cron time OR process that habit on the spot if the cron time is active!

    // OR
    // Just gather all of the habits of the user and properly extract the next cron time and
    // just do all of the resets and handling then!

    // The only issue is the difficulty of persistent data when the client is down...
    // It would need to back-track and make sure to cover it's missed spots
    // Especially and primarily for the streak based habits
    // THUS, the habit logs have the unchecked version 🔲,
    // The ❌, ✅, and ⏭ as a skipped entry
    // This is why for the streak based habits in particular
    // UPON RESET BEFORE SETTING THE FIRST CRON.
    // The streak based habits will be filtered and
    // It will attempt to scan all of the previous logs (sorted from recent to oldest)
    // until the logged value isn't of the 3 types above
    // Then that's when we know we are done!

    // What to do at cron time:
    /**
     * Check if the habit's next cron is the same day as today
     * (then you can assume to perform the streak ending and
     * habit processing on the given habit!)
     */
    let userSettings = await User.findOne(
      { discordID: userID },
      { _id: 0, habitCron: 1, "timezone.offset": 1 }
    );
    let { habitCron } = userSettings;
    let offset = userSettings.timezone.offset;

    let userHabits = await Habit.find({ userID, archived: false });
    if (userHabits.length) {
      userHabits.forEach(async (habit) => {
        await this.habitCron(habit, offset, habitCron);
      });
    }
    return;
  },

  updateHabitStats: async function (habitDocument, timezoneOffset, habitCron) {
    var {
      currentState,
      currentStreak,
      longestStreak,
      pastWeek,
      pastMonth,
      pastYear,
    } = habitDocument;
    const currentLogs = await Log.find({
      connectedDocument: habitDocument._id,
    }).sort({ timestamp: -1 });
    const todaysLog = await fn.getTodaysLog(
      currentLogs,
      timezoneOffset,
      habitCron.daily
    );
    if (todaysLog) {
      currentState = todaysLog.state;
    } else currentState = 0;
    currentStreak = fn.calculateCurrentStreak(
      currentLogs,
      timezoneOffset,
      habitCron,
      habitDocument.settings.isWeeklyType,
      habitDocument.settings.cronPeriods
    );
    if (currentStreak > (longestStreak ? longestStreak : 0)) {
      longestStreak = currentStreak;
    }
    pastWeek = this.getPastWeekStreak(
      currentLogs,
      timezoneOffset,
      habitCron,
      habitDocument.createdAt
    );
    pastMonth = this.getPastMonthStreak(
      currentLogs,
      timezoneOffset,
      habitCron,
      habitDocument.createdAt
    );
    pastYear = this.getPastYearStreak(
      currentLogs,
      timezoneOffset,
      habitCron,
      habitDocument.createdAt
    );
    const updatedHabit = await Habit.findOneAndUpdate(
      { _id: habitDocument._id },
      {
        $set: {
          currentState,
          currentStreak,
          longestStreak,
          pastWeek,
          pastMonth,
          pastYear,
        },
      },
      { new: true }
    );
    return updatedHabit;
  },

  updateHabit: async function (habit, timezoneOffset, habitCron) {
    let { _id: habitID } = habit;
    let {
      userID,
      createdAt,
      settings,
      currentState,
      currentStreak,
      longestStreak,
      pastWeek,
      pastMonth,
      pastYear,
      nextCron,
    } = habit;
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
    // Streak - Setup New Log
    if (autoLogType === 1) {
      const logs = await Log.find({ connectedDocument: habitID }).sort({
        timestamp: -1,
      });
      let todaysLog = fn.getTodaysLog(logs, timezoneOffset, habitCron.daily);
      console.log({ todaysLog });
      if (!todaysLog) {
        currentState = 1; //* Reset current state to ✅ (1)
        todaysLog = new Log({
          _id: mongoose.Types.ObjectId(),
          timestamp:
            fn.getCurrentUTCTimestampFlooredToSecond() +
            timezoneOffset * HOUR_IN_MS,
          state: 1,
          connectedDocument: habitID,
        });
        await todaysLog.save().catch((err) => console.error(err));
      }
    }
    //* NOTE: Count Goals logging will be handled in the habit/log commands
    await this.updateHabitStats(habit, timezoneOffset, habitCron);
    nextCron = fn.getNextCronTimeUTC(
      timezoneOffset,
      habitCron,
      isWeeklyType,
      cronPeriods,
      nextCron
    );
    console.log({ nextCron });
    const updatedHabit = await Habit.findOneAndUpdate(
      { _id: habitID },
      { $set: { nextCron } },
      { new: true }
    );
    return updatedHabit;
  },

  setNewHabitCron: async function (habit, timezoneOffset, habitCron) {
    let { nextCron, settings } = habit;
    const { isWeeklyType, cronPeriods } = settings;
    console.log({
      timezoneOffset,
      habitCron,
      isWeeklyType,
      cronPeriods,
    });
    console.log(`Old Habit Cron (UTC): ${fn.timestampToDateString(nextCron)}`);
    nextCron = fn.getNextCronTimeUTC(
      timezoneOffset,
      habitCron,
      isWeeklyType,
      cronPeriods
    );
    console.log(`New Habit Cron (UTC): ${fn.timestampToDateString(nextCron)}`);
    habit = await Habit.findOneAndUpdate(
      { _id: habit._id },
      { $set: { nextCron } },
      { new: true }
    );
    this.cancelHabitById(habit._id);
    await this.habitCron(habit, timezoneOffset, habitCron);
  },

  updateUserHabitCrons: async function (
    userID,
    updatedTimezoneOffset,
    userSettings
  ) {
    try {
      const userHabits = await Habit.find({ userID });
      if (userHabits)
        if (userHabits.length) {
          const { habitCron } = userSettings;
          for (const habit of userHabits) {
            this.setNewHabitCron(habit, updatedTimezoneOffset, habitCron);
          }
        }
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  adjustHabitLogEntries: async function (userID, oldDailyCron, newDailyCron) {
    try {
      const newCronIsAfterOldCron = oldDailyCron < newDailyCron;
      const userHabits = await Habit.find({ userID });
      const habitIDs = userHabits
        .map((habit) => habit._id)
        .filter((habitID) => habitID !== undefined);
      const logs = await Log.find(
        { connectedDocument: { $in: habitIDs } },
        { timestamp: 1 }
      );
      // console.log({ logs });
      if (!logs) return false;
      if (!logs.length) return false;

      for (const log of logs) {
        if (log.timestamp) {
          var needsUpdate = false;
          let { timestamp } = log;
          const timestampsTimePastMidnight = fn.getTimePastMidnightInMs(
            timestamp
          );
          console.log(`Timestamp: ${fn.timestampToDateString(timestamp)}`);
          const date = new Date(timestamp);
          const year = date.getUTCFullYear();
          const month = date.getUTCMonth();
          const day = date.getUTCDate();
          if (newCronIsAfterOldCron) {
            if (
              timestampsTimePastMidnight >= oldDailyCron &&
              timestampsTimePastMidnight < newDailyCron
            ) {
              timestamp = new Date(year, month, day).getTime() + newDailyCron;
              console.log(
                `New Timestamp: ${fn.timestampToDateString(timestamp)}`
              );
              needsUpdate = true;
            }
          } else {
            if (
              timestampsTimePastMidnight >= newDailyCron &&
              timestampsTimePastMidnight < oldDailyCron
            ) {
              // One second before, because on or over the cron time corresponds to the next day
              timestamp =
                new Date(year, month, day).getTime() + newDailyCron - 1000;
              console.log(
                `New Timestamp: ${fn.timestampToDateString(timestamp)}`
              );
              needsUpdate = true;
            }
          }
          if (needsUpdate) {
            console.log(
              `Updating Timestamp at ${fn.msToTimeFromMidnight(
                timestampsTimePastMidnight
              )}!\n`
            );
            await Log.updateOne({ _id: log._id }, { $set: { timestamp } });
          }
        }
      }
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  /**
   * @param {mongoose.Schema.Types.ObjectId | String} habitID
   */
  cancelHabitById: function (habitID) {
    const success = fn.cancelCronById(habits, habitID);
    if (success) {
      console.log(`Successfully cancelled habit ${habitID}.`);
    } else if (success === null) {
      console.log(`Habit ${habitID} does not exist, or is already cancelled.`);
    } else {
      console.log(`Failed to cancel habit ${habitID}.`);
    }
    return success;
  },

  resetAllHabitCrons: async function () {
    const allUsers = await User.find({});
    console.log("Rescheduling all habits.");
    if (allUsers) {
      allUsers.forEach(async (user) => {
        await this.habitCronUser(user.discordID);
      });
    }
  },

  getAllHabits: async function (archived = false) {
    const getAllHabits = await Habit.find({ archived: archived }).catch(
      (err) => {
        console.error(err);
        return false;
      }
    );
    return getAllHabits;
  },

  getPastStreak: function (
    sortedLogs,
    timezoneOffset,
    habitCron,
    startTimestamp,
    endTimestamp,
    createdAt = undefined
  ) {
    sortedLogs = fn.getLogsFromTodayAndThePast(
      sortedLogs,
      timezoneOffset,
      habitCron
    );
    // Have the createdAt there just to make sure that if the
    // streak we are calculating for is partial due to the habit being
    // created in the middle of the given start and end time period
    let checkLogs = new Array();
    for (let i = 0; i < sortedLogs.length; i++) {
      if (sortedLogs[i]) {
        if (sortedLogs[i].timestamp) {
          console.log(
            `Sorted Log ${i + 1}: ${fn.timestampToDateString(
              sortedLogs[i].timestamp
            )}`
          );
          const logTimestamp = sortedLogs[i].timestamp;
          if (logTimestamp <= startTimestamp) break;
          else if (logTimestamp <= endTimestamp) {
            checkLogs.push(sortedLogs[i]);
          }
        }
      }
    }

    let pastStreak = 0;
    // Equivalent to filtering the array based on the state
    // and then taking the length
    for (let i = 0; i < checkLogs.length; i++) {
      if (checkLogs[i]) {
        const isAfterCreation =
          createdAt || createdAt === 0
            ? checkLogs[i].timestamp >= createdAt
            : true;
        if (
          isAfterCreation &&
          (checkLogs[i].state === 1 || checkLogs[i].state === 3)
        ) {
          pastStreak++;
        }
      }
    }
    return pastStreak;
  },

  getPastDaysStreak: function (
    sortedLogs,
    timezoneOffset,
    habitCron,
    pastDays,
    createdAt = undefined
  ) {
    const { daily: dailyCron } = habitCron;
    const currentDate = fn.getCurrentDateByCronTime(timezoneOffset, dailyCron);
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth();
    const currentDay = currentDate.getUTCDate();
    // +1 because a Sunday cron ends on Monday (usually around midnight)
    const firstDayOfPastDays =
      new Date(currentYear, currentMonth, currentDay - pastDays + 1).getTime() +
      dailyCron;
    const lastDayOfPastDays =
      new Date(currentYear, currentMonth, currentDay + 1).getTime() + dailyCron;
    console.log(fn.timestampToDateString(firstDayOfPastDays));
    console.log(fn.timestampToDateString(lastDayOfPastDays));
    const pastDaysStreak = this.getPastStreak(
      sortedLogs,
      timezoneOffset,
      habitCron,
      firstDayOfPastDays,
      lastDayOfPastDays,
      createdAt
    );
    return pastDaysStreak;
  },

  getPastYearStreak: function (
    sortedLogs,
    timezoneOffset,
    habitCron,
    createdAt = undefined
  ) {
    const { daily: dailyCron } = habitCron;
    const currentDate = fn.getCurrentDateByCronTime(timezoneOffset, dailyCron);
    const currentYear = currentDate.getUTCFullYear();
    const firstDayOfYear = new Date(currentYear, 0).getTime() + dailyCron;
    const lastDayOfYear = new Date(currentYear + 1, 0, 1).getTime() + dailyCron;
    console.log(fn.timestampToDateString(firstDayOfYear));
    console.log(fn.timestampToDateString(lastDayOfYear));
    const pastYearStreak = this.getPastStreak(
      sortedLogs,
      timezoneOffset,
      habitCron,
      firstDayOfYear,
      lastDayOfYear,
      createdAt
    );
    return pastYearStreak;
  },

  getPastMonthStreak: function (
    sortedLogs,
    timezoneOffset,
    habitCron,
    createdAt = undefined
  ) {
    const { daily: dailyCron } = habitCron;
    const currentDate = fn.getCurrentDateByCronTime(timezoneOffset, dailyCron);
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth();
    const firstDayOfMonth =
      new Date(currentYear, currentMonth).getTime() + dailyCron;
    // Day 1 because a Sunday cron ends on Monday (usually around midnight)
    const lastDayOfMonth =
      new Date(currentYear, currentMonth + 1, 1).getTime() + dailyCron;
    console.log(fn.timestampToDateString(firstDayOfMonth));
    console.log(fn.timestampToDateString(lastDayOfMonth));
    const pastMonthStreak = this.getPastStreak(
      sortedLogs,
      timezoneOffset,
      habitCron,
      firstDayOfMonth,
      lastDayOfMonth,
      createdAt
    );
    return pastMonthStreak;
  },

  getPastWeekStreak: function (
    sortedLogs,
    timezoneOffset,
    habitCron,
    createdAt = undefined
  ) {
    const { daily: dailyCron, weekly: weeklyCron } = habitCron;
    const currentDate = fn.getCurrentDateByCronTime(timezoneOffset, dailyCron);
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth();
    const currentDay = currentDate.getUTCDate();
    // console.log(currentDate.getUTCDay());
    // console.log({ weeklyCron });
    const daysPastLastCron =
      ((6 - (weeklyCron - currentDate.getUTCDay())) % 7) + 1;
    //* UPDATE: NO +1 because it will be off by one day
    // OLD NOTE: +1 because a Sunday cron ends on Monday (usually around midnight)
    const firstDayOfPastWeek =
      new Date(
        currentYear,
        currentMonth,
        currentDay - daysPastLastCron
      ).getTime() + dailyCron;
    const lastDayOfPastWeek =
      new Date(
        currentYear,
        currentMonth,
        currentDay - daysPastLastCron + 7
      ).getTime() + dailyCron;
    console.log(fn.timestampToDateString(firstDayOfPastWeek));
    console.log(fn.timestampToDateString(lastDayOfPastWeek));
    const pastWeekStreak = this.getPastStreak(
      sortedLogs,
      timezoneOffset,
      habitCron,
      firstDayOfPastWeek,
      lastDayOfPastWeek,
      createdAt
    );
    return pastWeekStreak;
  },

  getOneHabitByObjectID: async function (habitID) {
    const habit = await Habit.findById(habitID).catch((err) => {
      console.log(err);
      return false;
    });
    return habit;
  },
};
