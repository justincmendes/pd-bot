// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const Habit = require("../djs-bot/database/schemas/habit");
const Log = require("../djs-bot/database/schemas/habittracker");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const User = require("../djs-bot/database/schemas/user");
const mongoose = require("mongoose");
const fn = require("./functions");
const rm = require("./reminder");
const habit = require("../djs-bot/database/schemas/habit");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const habitEmbedColour = fn.habitEmbedColour;
const mastermindEmbedColour = fn.mastermindEmbedColour;
const habits = new Discord.Collection();

// Private Function Declarations

module.exports = {
  logDocumentToString: function (log) {
    const state = this.getStateEmoji(log.state);
    var messageString = log.message ? `\n**Message:** ${log.message}` : "";
    var countString = "";
    if (log.count) {
      const count = log.count;
      if (count.length) {
        count.forEach((value, i) => {
          if (i === count.length - 1 && count.length > 1) {
            countString = `\~\~${countString}\~\~ ${value}`;
          } else countString += `${value} `;
        });
        countString = `\n**Count:** ${countString}`;
      }
    }
    return (
      `${state} - ${fn.timestampToDateString(log.timestamp)}` +
      messageString +
      countString
    );
  },

  habitDocumentDescription: function (habitDocument) {
    console.log({ habitDocument });
    const { archived, description, areaOfLife } = habitDocument;
    const areaOfLifeString = fn.getAreaOfLifeString(areaOfLife);
    const outputString = `${
      archived ? "****ARCHIVED****\n" : ""
    }${areaOfLifeString}${
      description ? `\n👣 - **Description:**\n${description}` : ""
    }`;
    return outputString;
  },

  getHabitReadOrDeleteHelp: function (PREFIX, commandUsed, crudCommand) {
    return `**USAGE:**\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> past <PAST_#_OF_ENTRIES> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> <ENTRY #> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> many <MANY_ENTRIES> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> <#_OF_ENTRIES> <recent?> past <STARTING_INDEX> <force?>\`\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; 5** (\\*any number); **all** \n(NOTE: ***__any number > 1__* will get more than 1 habit!**)\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\**any number*)\n\n\`<ENTRY_#>\`: **all; recent; 3** (3rd most recent habit, \\**any number*)\n(NOTE: Gets just 1 habit - UNLESS \`all\`)\n\n\`<MANY_ENTRIES>\`: **3,5,recent,7,1,25**\n- **COMMA SEPARATED, NO SPACES:**\n1 being the most recent habit, 25 the 25th most recent, etc.\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<recent?>\`: (OPT.) type **recent** at the indicated spot to sort the habits by **time created instead of the date created property!**\n\n\`<force?>\`: (OPT.) type **force** at the end of your command to **skip all of the confirmation windows!**`;
  },

  setHabitReminder: async function (
    bot,
    commandUsed,
    userID,
    endTime,
    interval,
    habitDescription,
    habitID,
    countGoal = false,
    goalType = false,
    countMetric = false
  ) {
    try {
      const reminderMessage = `**__Reminder to track your habit__** 😁.\n\n**Habit:** ${habitDescription}${
        countGoal || countGoal === 0
          ? `\n**Current${
              goalType ? ` ${fn.toTitleCase(getGoalTypeString(goalType))}` : ""
            }:**` + ` ${countGoal}${countMetric ? ` (${countMetric})` : ""}`
          : ""
      }\n\nType** \`?${commandUsed} log\` **- to **track your habit**`;
      const now = fn.getCurrentUTCTimestampFlooredToSecond();
      // Delete currently running reminders!
      if (habitID) {
        rm.cancelReminderByConnectedDocument(habitID);
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
            ? `\n\n${this.habitDocumentDescription(habitDocument)}`
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
            ? `\n\n${this.habitDocumentDescription(habitDocument)}`
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
        commandUsed,
        userID,
        endTime,
        intervalArgs,
        habitDocument.description,
        habitDocument._id,
        habitDocument.settings.countGoal,
        habitDocument.settings.countGoalType,
        habitDocument.settings.countMetric
      );
      if (successfullySetReminder) {
        console.log("Habit log recurring reminder set.");
        message.reply(
          `Habit log recurring reminder set!${
            showHabitInConfirmation
              ? `\n${this.habitDocumentDescription(habitDocument)}`
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
          `**Select the habit you'd like to post:**${
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
                "**Would you like to add another habit to be posted?**",
                false,
                "Habit: Weekly Goals into Habits"
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
        const nextCron = this.getNextCronTimeUTC(
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

  // You may need the current nextCron object to make this work
  // Issue: If the client goes down for a long while, how will the system pinpoint the exact
  // next cron time given the information from the habit and user objects?

  // (i.e. if I have a cron ev 3 days and the system goes down for 2 days,
  // the next cron is NOT in the next 3 days from then, but in the next day)

  // How do you figure out where to scale from?
  // Based on the last nextCron object, if you add the respective amount of days
  // to it, keep doing so until the time you get it past the time of now
  // Also be aware that the cron can either be same day or next day depending on the time from midnight

  // Is next cron in utc?
  // ${fn.timestampToDateString(nextCron - timezoneOffset * HOUR_IN_MS, true, true, true)}` : ""}`
  // Apparently not. look into it!
  // I would make the nextCron object UTC, then offset it manually by the user timezone!
  // So fix this in the habits toString document

  getNextCronTimeUTC: function (
    timezoneOffset,
    habitCron,
    isWeeklyType,
    cronPeriods,
    nextCron = null
  ) {
    if (!nextCron) nextCron = Date.now();
    const lastCronDate = new Date(nextCron);
    const { daily: dailyCron, weekly: weeklyCron } = habitCron;
    let cronPeriodsMultiplier = 0;
    var newNextCron;
    do {
      if (isWeeklyType) {
        const daysToNextWeeklyCronDay =
          ((7 - (lastCronDate.getUTCDay() - weeklyCron)) % 7) + 1; // +1 for the next day (past midnight)
        newNextCron =
          new Date(
            lastCronDate.getUTCFullYear(),
            lastCronDate.getUTCMonth(),
            lastCronDate.getUTCDate() +
              7 * (cronPeriods * cronPeriodsMultiplier - 1 || 0) +
              daysToNextWeeklyCronDay
          ).getTime() + dailyCron;
      } else {
        newNextCron =
          new Date(
            lastCronDate.getUTCFullYear(),
            lastCronDate.getUTCMonth(),
            lastCronDate.getUTCDate() + cronPeriods * cronPeriodsMultiplier,
            0
          ).getTime() + dailyCron;
      }
      cronPeriodsMultiplier++;
      newNextCron -= timezoneOffset * HOUR_IN_MS;
      // console.log(`New Next Cron: ${fn.timestampToDateString(newNextCron)}`)
      // console.log(`Next Cron: ${fn.timestampToDateString(nextCron)}`)
    } while (newNextCron <= nextCron);
    return newNextCron;
  },

  habitCron: async function (habit, offset, habitCron) {
    // const { daily: dailyCron } = habitCron;
    var nextCron;
    let { _id, userID } = habit;
    let { settings } = habit;
    let { isWeeklyType, cronPeriods } = settings;
    nextCron = await this.getNextCronTimeUTC(
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

    // const nextCronTime = this.getNextCronTimeUTC(offset, habitCron,
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
    autoLogType = 1;
    let logs = await Log.find({ connectedDocument: habitID }).sort({
      timestamp: -1,
    });
    // console.log({ logs })
    // let logs = [
    //   {
    //     timestamp: new Date(2021, 2, 14, 4).getTime(),
    //     state: 3,
    //   },
    //   {
    //     timestamp: new Date(2021, 2, 13, 0).getTime(),
    //     state: 2,
    //   },
    //   {
    //     timestamp: new Date(2021, 2, 12, 4).getTime(),
    //     state: 1,
    //   },
    //   {
    //     timestamp: new Date(2021, 2, 3, 4).getTime(),
    //     state: 1,
    //   },
    //   {
    //     timestamp: new Date(2021, 2, 2, 4).getTime(),
    //     state: 1,
    //   },
    //   {
    //     timestamp: new Date(2021, 2, 1, 4).getTime(),
    //     state: 1,
    //   },
    //   {
    //     timestamp: new Date(2021, 2, 0, 4).getTime(),
    //     state: 1,
    //   },
    // ];
    pastWeek = this.getPastWeekStreak(
      logs,
      timezoneOffset,
      habitCron,
      createdAt
    );
    pastMonth = this.getPastMonthStreak(
      logs,
      timezoneOffset,
      habitCron,
      createdAt
    );
    pastYear = this.getPastYearStreak(
      logs,
      timezoneOffset,
      habitCron,
      createdAt
    );
    // Streak
    if (autoLogType === 1) {
      let todaysLog = this.getTodaysLog(logs, timezoneOffset, habitCron.daily);
      console.log({ todaysLog });
      if (todaysLog) {
        currentState = todaysLog.state || 0;
      } else {
        currentState = 1; // Reset current state to ✅
        todaysLog = new Log({
          _id: mongoose.Types.ObjectId(),
          timestamp:
            fn.getCurrentUTCTimestampFlooredToSecond() +
            timezoneOffset * HOUR_IN_MS +
            1000,
          state: 1,
          connectedDocument: habitID,
        });
        await todaysLog.save().catch((err) => console.error(err));

        // Find the correct spot to insert today's new log.
        // The logs are currently sorted from newest to oldest (timestamp)
        // Taking the index of the first log that has a timestamp older than today
        // allows proper placement of today's log right after the one just older than it - to maintain the sorted order.
        const todaysIndex = logs.findIndex(
          (log) => todaysLog.timestamp >= log.timestamp
        );
        // console.log({ todaysLog, logs, todaysIndex });

        // If no success finding a log older than today's log, today is the oldest log.
        if (todaysIndex === -1) logs = [todaysLog].concat(logs);
        else logs.splice(todaysIndex, 0, todaysLog);
        // console.log({ logs });
      }
    }
    // Count Goals and Regular Goals
    //* NOTE: Count Goals logging will be handled in the commands
    else currentState = 0;
    console.log({ currentState });
    if (logs.length) {
      currentStreak = this.calculateCurrentStreak(
        logs,
        timezoneOffset,
        habitCron,
        isWeeklyType,
        cronPeriods
      );
    } else currentStreak = 0;
    // console.log({ currentStreak });
    if (currentStreak > (longestStreak || 0)) {
      longestStreak = currentStreak;
    }
    console.log({ currentStreak, longestStreak });
    nextCron = this.getNextCronTimeUTC(
      timezoneOffset,
      habitCron,
      isWeeklyType,
      cronPeriods,
      nextCron
    );
    console.log({ nextCron });
    const updatedHabit = await Habit.findOneAndUpdate(
      { _id: habitID },
      {
        $set: {
          currentState,
          currentStreak,
          longestStreak,
          pastWeek,
          pastMonth,
          pastYear,
          nextCron,
        },
      }
    );
    return updatedHabit;
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

  getOneHabitByObjectID: async function (habitID) {
    if (habitID) {
      console.log({ habitID });
      const reminder = await Habit.findById(habitID).catch((err) => {
        console.error(err);
        return false;
      });
      console.log({ reminder });
      return reminder;
    } else return null;
  },

  getActualDateLogged: function (timestamp, dailyCron) {
    // If the timestamp is on the intended day of the cron
    // i.e. If it's a cron at 12:00AM Midnight, then the reset is intended for the
    // habit log of the PREVIOUS DAY:
    // - hence removal of the cron time past midnight and 1 second
    //   to get 11:59 of the PREVIOUS DAY
    const timePastMidnight = fn.getTimePastMidnightInMs(timestamp);
    const isBeforeCronTime = timePastMidnight < dailyCron;
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    var day = date.getUTCDate();
    if (isBeforeCronTime) day--;
    const finalDate = new Date(year, month, day);
    return finalDate.getTime();
  },

  calculateCurrentStreak: function (
    sortedLogs,
    timezoneOffset,
    habitCron,
    isWeeklyType,
    cronPeriods
  ) {
    const dailyCron = habitCron.daily;
    let streakReset = cronPeriods;
    var currentStreak = 0;
    // Filter all of the future logs (i.e. the logs beyond today's cron)
    // Get the cron time of today (end of day)
    let upcomingCron = this.getNextCronTimeUTC(
      timezoneOffset,
      habitCron,
      false,
      1
    );
    if (!upcomingCron && upcomingCron !== 0) return false;
    else upcomingCron += timezoneOffset * HOUR_IN_MS;
    sortedLogs = sortedLogs.filter((log) => log.timestamp < upcomingCron);

    var lastCheckedDay, lastCheckedLog;
    for (let i = 0; i < sortedLogs.length; i++) {
      if (sortedLogs[i]) {
        const latestLog = sortedLogs[i];
        if (sortedLogs[i + 1]) {
          const previousLog = sortedLogs[i + 1];
          const latestTimestamp = latestLog.timestamp;
          const previousTimestamp = previousLog.timestamp;
          const adjustedLatestDay = this.getActualDateLogged(
            latestTimestamp,
            dailyCron
          );
          const adjustedPreviousDay = this.getActualDateLogged(
            previousTimestamp,
            dailyCron
          );
          if (!lastCheckedDay && lastCheckedDay !== 0) {
            lastCheckedDay = adjustedLatestDay;
            lastCheckedLog = latestLog;
          }
          const latestCron =
            this.getNextCronTimeUTC(
              timezoneOffset,
              habitCron,
              isWeeklyType,
              cronPeriods,
              latestTimestamp - timezoneOffset * HOUR_IN_MS
            ) +
            timezoneOffset * HOUR_IN_MS;
          const previousCron =
            this.getNextCronTimeUTC(
              timezoneOffset,
              habitCron,
              isWeeklyType,
              cronPeriods,
              previousTimestamp - timezoneOffset * HOUR_IN_MS
            ) +
            timezoneOffset * HOUR_IN_MS;
          const adjustedLatestCronDay = this.getActualDateLogged(
            latestCron,
            dailyCron
          );
          const adjustedPreviousCronDay = this.getActualDateLogged(
            previousCron,
            dailyCron
          );
          // console.log(fn.timestampToDateString(previousTimestamp));
          // console.log(fn.timestampToDateString(latestTimestamp));
          // console.log(fn.timestampToDateString(previousCron));
          // console.log(fn.timestampToDateString(latestCron));
          console.log(
            `Latest Timestamp: ${fn.timestampToDateString(latestTimestamp)}`
          );
          console.log(
            `Previous Timestamp: ${fn.timestampToDateString(previousTimestamp)}`
          );
          console.log(
            `Latest Cron Day: ${fn.timestampToDateString(
              adjustedLatestCronDay
            )}`
          );
          console.log(
            `Previous Cron Day: ${fn.timestampToDateString(
              adjustedPreviousCronDay
            )}\n`
          );
          if (isWeeklyType) {
            if (
              (latestLog.state === 1 || latestLog.state === 3) &&
              fn.getDaysInBetweenTimestamps(
                adjustedLatestDay,
                adjustedPreviousCronDay
              ) >= 0 &&
              fn.getDaysInBetweenTimestamps(
                adjustedLatestCronDay,
                adjustedLatestDay
              ) >= 0
            ) {
              if (!currentStreak) currentStreak = 1;
              var scanIndex = 1;
              do {
                if (sortedLogs[i + scanIndex]) {
                  const check = sortedLogs[i + scanIndex];
                  const checkDay = this.getActualDateLogged(
                    check.timestamp,
                    dailyCron
                  );
                  const daysBetweenCrons = fn.getDaysInBetweenTimestamps(
                    adjustedLatestCronDay,
                    adjustedPreviousCronDay
                  );
                  if (
                    checkDay < adjustedPreviousCronDay &&
                    (check.state === 1 || check.state === 3) &&
                    daysBetweenCrons === cronPeriods * 7
                  ) {
                    currentStreak++;
                    // console.log(`Check: ${fn.timestampToDateString(checkDay)}`);
                    // console.log(`Prev Cron: ${fn.timestampToDateString(adjustedPreviousCronDay)}`);
                    // console.log(`Next Cron: ${fn.timestampToDateString(adjustedLatestCronDay)}`);
                    break;
                  } else scanIndex++;
                } else break;
              } while (true);
            }
          } else {
            // console.log(fn.timestampToDateString(lastCheckedDay));
            // console.log(fn.timestampToDateString(adjustedLatestDay));
            const daysDifference = fn.getDaysInBetweenTimestamps(
              lastCheckedDay,
              adjustedLatestDay
            );
            // console.log(`First Check for Days Difference: ${daysDifference}`);
            if (latestLog.state === 1 || latestLog.state === 3) {
              // console.log({
              //   latestLog,
              //   lastCheckedLog,
              //   daysDifference,
              //   streakReset,
              // });
              if (
                lastCheckedLog._id.toString() !== latestLog._id.toString() &&
                (lastCheckedLog.state === 1 || lastCheckedLog.state === 3) &&
                daysDifference <= streakReset
              ) {
                // console.log(`Streak Before: ${currentStreak}`);
                if (!currentStreak) currentStreak = 1;
                currentStreak++;
                // console.log(`Streak After: ${currentStreak}`);
                // console.log(
                //   `Prev Last Checked: ${fn.timestampToDateString(
                //     lastCheckedDay
                //   )}`
                // );
                lastCheckedDay = adjustedLatestDay;
                lastCheckedLog = latestLog;
                // console.log(
                //   `Updated Last Checked: ${fn.timestampToDateString(
                //     lastCheckedDay
                //   )}`
                // );
              } else {
                if (!currentStreak) currentStreak = 1;
                if (daysDifference > streakReset) break;
              }
            }
          }
        } else if (
          (latestLog.state === 1 || latestLog.state === 3) &&
          sortedLogs.length === 1
        ) {
          currentStreak = 1;
          break;
        } else break;
      } else break;
    }
    return currentStreak;
  },

  getPastStreak: function (
    sortedLogs,
    startTimestamp,
    endTimestamp,
    createdAt = undefined
  ) {
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

  getCurrentDateByCronTime: function (timezoneOffset, dailyCronMsPastMidnight) {
    const currentDate = new Date(
      this.getActualDateLogged(
        Date.now() + timezoneOffset * HOUR_IN_MS,
        dailyCronMsPastMidnight,
        timezoneOffset
      )
    );
    return currentDate;
  },

  getPastDaysStreak: function (
    sortedLogs,
    timezoneOffset,
    habitCron,
    pastDays,
    createdAt = undefined
  ) {
    const { daily: dailyCron } = habitCron;
    const currentDate = this.getCurrentDateByCronTime(
      timezoneOffset,
      dailyCron
    );
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
    const currentDate = this.getCurrentDateByCronTime(
      timezoneOffset,
      dailyCron
    );
    const currentYear = currentDate.getUTCFullYear();
    const firstDayOfYear = new Date(currentYear, 0).getTime() + dailyCron;
    const lastDayOfYear = new Date(currentYear + 1, 0, 1).getTime() + dailyCron;
    console.log(fn.timestampToDateString(firstDayOfYear));
    console.log(fn.timestampToDateString(lastDayOfYear));
    const pastYearStreak = this.getPastStreak(
      sortedLogs,
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
    const currentDate = this.getCurrentDateByCronTime(
      timezoneOffset,
      dailyCron
    );
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
    const currentDate = this.getCurrentDateByCronTime(
      timezoneOffset,
      dailyCron
    );
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
      firstDayOfPastWeek,
      lastDayOfPastWeek,
      createdAt
    );
    return pastWeekStreak;
  },

  getTodaysLog: function (presentToPastSortedLogs, timezoneOffset, dailyCron) {
    const currentHabitDate = this.getCurrentDateByCronTime(
      timezoneOffset,
      dailyCron
    );
    const nextHabitDate = new Date(
      currentHabitDate.getUTCFullYear(),
      currentHabitDate.getUTCMonth(),
      currentHabitDate.getUTCDate() + 1
    );
    // console.log({ presentToPastSortedLogs, dailyCron });
    // console.log(`Current Habit Date: ${fn.timestampToDateString(currentHabitDate.getTime())}`);
    // console.log(`Next Habit Date: ${fn.timestampToDateString(nextHabitDate.getTime())}`);
    const nearestLog = presentToPastSortedLogs.find(
      (log) =>
        log.timestamp < nextHabitDate.getTime() + dailyCron &&
        log.timestamp >= currentHabitDate.getTime() + dailyCron
    );
    // console.log({ nearestLog });
    if (nearestLog) return nearestLog;
    else return null;
  },

  getHabitLogOnTimestampDay: function (
    presentToPastSortedLogs,
    targetTimestamp,
    dailyCron
  ) {
    const targetDate = new Date(
      this.getActualDateLogged(targetTimestamp, dailyCron)
    );
    const nextCronDate = new Date(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate() + 1
    );
    // console.log({ presentToPastSortedLogs, dailyCron });
    // console.log(`Current Habit Date: ${fn.timestampToDateString(currentHabitDate.getTime())}`);
    // console.log(`Next Habit Date: ${fn.timestampToDateString(nextHabitDate.getTime())}`);
    const targetLog = presentToPastSortedLogs.find(
      (log) =>
        log.timestamp < nextCronDate.getTime() + dailyCron &&
        log.timestamp >= targetDate.getTime() + dailyCron
    );
    // console.log({ nearestLog });
    if (targetLog) return targetLog;
    else return null;
  },

  getStateEmoji: function (state) {
    var stateEmoji;
    switch (state) {
      case 1:
        stateEmoji = "✅";
        break;
      case 2:
        stateEmoji = "❌";
        break;
      case 3:
        stateEmoji = "⏭";
        break;
      default:
        stateEmoji = "🔲";
        break;
    }
    return stateEmoji;
  },
};
