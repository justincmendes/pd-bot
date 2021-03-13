// or record/records

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
async function habitDocumentToString(
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
      fn.getDayFromStartOfMonthAndCreatedAt(currentDate.getTime(), createdAt) ||
      " N/A";
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
        fn.getDayOfYear(currentDate.getTime()) + 1 - fn.getDayOfYear(createdAt);
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
          const pastXDaysFinal = hb.getPastDaysStreak(
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
        countGoalString = `\n- **Daily Goal:** ${settings.countGoal || "None"}`;
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
  let currentStateString = `**Current Log:** ${hb.getStateEmoji(currentState)}`;
  const areaOfLifeString = `${
    areasOfLifeEmojis[areaOfLife] ? `${areasOfLifeEmojis[areaOfLife]} ` : ""
  }${areasOfLife[areaOfLife] ? `__${areasOfLife[areaOfLife]}__` : ""}`;

  let outputString =
    `${archived ? "****ARCHIVED****\n" : ""}${areaOfLifeString}${
      description ? `\n👣 - **Description:**\n${description}` : ""
    }${
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
}

function multipleLogsToStringArray(
  message,
  logArray,
  numberOfLogs,
  entriesToSkip = 0,
  toString = false
) {
  var logsToString = new Array();
  console.log({ numberOfLogs });
  for (let i = 0; i < numberOfLogs; i++) {
    if (logArray[i] === undefined) {
      numberOfLogs = i;
      fn.sendErrorMessage(
        message,
        `**LOGS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`
      );
      break;
    }
    const logString = hb.logDocumentToString(logArray[i]);
    logsToString.push(logString);
  }
  if (toString) logsToString = logsToString.join("\n\n");
  return logsToString;
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
  const recentHabitToString = `__**Habit ${await getRecentHabitIndex(
    userID,
    isArchived
  )}:**__${await habitDocumentToString(
    bot,
    await hb.getOneHabitByRecency(userID, 0, isArchived),
    showConnectedGoal,
    showRecentStats,
    showSettings,
    showTotalStats
  )}`;
  const habitEmbed = fn.getMessageEmbed(
    recentHabitToString,
    `Log: See Recent Habit`,
    embedColour
  );
  return habitEmbed;
}

async function getHabitIndexByFunction(
  userID,
  habitID,
  totalLogs,
  archived,
  getOneHabit
) {
  let i = 0;
  while (true) {
    let habit = await getOneHabit(userID, i, archived);
    console.log({ habit, habitID, userID, i, archived, totalLogs });
    if (!habit && i >= totalLogs) {
      return false;
    } else if (habit._id.toString() === habitID.toString()) break;
    i++;
  }
  return i + 1;
}

async function getOneHabitByObjectID(habitID) {
  const habit = await Habit.findById(habitID).catch((err) => {
    console.log(err);
    return false;
  });
  return habit;
}

async function getLogsByCreatedAt(
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

async function getRecentHabitIndex(userID, archived) {
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
}

function getGoalTypeString(goalType) {
  var goalTypeString;
  switch (goalType) {
    case 1:
      goalTypeString = "daily goal";
      break;
    case 2:
      goalTypeString = "weekly goal";
      break;
    case 3:
      goalTypeString = "total/cumulative goal";
      break;
    default:
      goalTypeString = "goal";
      break;
  }
  return goalTypeString;
}

module.exports = {
  name: "log",
  description: "Habit Tracker Logs",
  aliases: [
    "logs",
    "lg",
    "l",
    "hl",
    "hlog",
    "hlogs",
    "habitlogs",
    "habitlog",
    "record",
    "rec",
  ],
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
    const authorID = message.author.id;
    const authorUsername = message.author.username;
    let userSettings = await User.findOne({ discordID: authorID });
    const { tier } = userSettings;
    let logUsageMessage =
      `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\`` +
      `\n\n\`<ACTION>\`: **add/start; see; delete; edit**\n\n*__ALIASES:__* **${
        this.name
      } - ${this.aliases.join("; ")}**`;
    logUsageMessage = fn.getMessageEmbed(
      logUsageMessage,
      "Log: Help",
      habitEmbedColour
    );
    const habitHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
    const logCommand = args[0].toLowerCase();
    const habitActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${logCommand} help\``;
    let logType = args[1] ? args[1].toLowerCase() : false;
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
    let isArchived = archiveRegex.test(logType);
    const archiveShift = isArchived ? 1 : 0;
    console.log({ isArchived, archiveShift });

    if (logCommand === "help") return message.channel.send(logUsageMessage);
    // Allow the user to specify the timestamp of the log! (now, today, tomorrow, yesterday)
    else if (
      logCommand === "start" ||
      logCommand === "create" ||
      logCommand === "s" ||
      logCommand === "set" ||
      logCommand === "st" ||
      logCommand === "c" ||
      logCommand === "make" ||
      logCommand === "m" ||
      logCommand === "add" ||
      logCommand === "a"
    ) {
      // (similar indexing to edit, recent or #) + archive
      // Make a list - similar to archive
      let logStartUsageMessage =
        `**USAGE:**\n\`${PREFIX}${commandUsed} ${logCommand} <archive?> <recent?> <force?>\`\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<recent?>\`(OPT.): type **recent** to order the habits by **actual time created instead of the date created property!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      logStartUsageMessage = fn.getMessageEmbed(
        logStartUsageMessage,
        `Log: Start Help`,
        habitEmbedColour
      );
      if (logType === "help") return message.channel.send(logStartUsageMessage);

      var indexByRecency = false;
      if (args[1 + archiveShift] !== undefined) {
        if (args[1 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }
      var logArray;
      if (indexByRecency)
        logArray = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ _id: -1 });
      else
        logArray = await Habit.find({
          archived: isArchived,
          userID: authorID,
        }).sort({ createdAt: +1 });
      if (!logArray.length)
        return message.reply(
          `**No ${
            isArchived ? "archived " : ""
          }habits** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
        );

      do {
        let targetHabit = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          "__**Which habit would you like to log?**__",
          `Log${isArchived ? " Archive" : ""}: Select Habit To Log`,
          logArray,
          "description",
          false,
          habitEmbedColour,
          600000
        );
        if (!targetHabit) return;
        else targetHabit = targetHabit.object;

        const logTimestamp = await fn.getDateAndTimeEntry(
          bot,
          message,
          PREFIX,
          timezoneOffset,
          daylightSaving,
          "**__When do you want to log this habit for?__**",
          `Log${isArchived ? " Archive" : ""}: Timestamp`,
          false,
          habitEmbedColour,
          600000
        );
        if (!logTimestamp && logTimestamp !== 0) return;
        const logTimestampString = `\n**Current Timestamp:** ${fn.timestampToDateString(
          logTimestamp
        )}`;

        // If it is a count habit, get the count input first.
        const { habitCron } = userSettings;
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
          getGoalTypeString(countGoalType)
        );
        if (isCountType) {
          countValue = await fn.getNumberEntry(
            bot,
            message,
            PREFIX,
            `Enter your **${countMetric}** (${countGoalTypeString}: **${countGoal}**)\n${logTimestampString}`,
            `Log${isArchived ? " Archive" : ""}: ${countGoalTypeString}`,
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
          ? `\n\n**${countMetric}:** ${hb.getStateEmoji(
              countValue >= countGoal ? 1 : 2
            )}\nCurrent Value (**${countValue}**) vs. ${countGoalTypeString} (**${countGoal}**)`
          : "";

        let currentLogs = await Log.find({
          connectedDocument: targetHabit._id,
        }).sort({ timestamp: -1 });
        let existingLog = hb.getHabitLogOnTimestampDay(
          currentLogs,
          logTimestamp,
          habitCron.daily
        );

        let habitLog = await fn.userSelectFromList(
          bot,
          message,
          PREFIX,
          checkMissedSkipList,
          3,
          `__**What will you set the status of your habit to?**__\n${logTimestampString}\n**Currently:** ${hb.getStateEmoji(
            existingLog ? existingLog.state : 0
          )}${suggestedLogFromCountGoal}`,
          `Log${isArchived ? " Archive" : ""}: Status`,
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
        var reflectionMessage;
        const confirmReflection = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          `Would you like to **__add a${
            currentReflection ? " new" : ""
          } reflection message__** to go with your habit log?\n*If yes, you will type in your reflection in the next window!*\n${logTimestampString}\n**Current Log: ${hb.getStateEmoji(
            habitLog
          )}**\n**Current Reflection Message:**${
            currentReflection ? `\n${currentReflection}` : " N/A"
          }`,
          forceSkip,
          `Log${
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
            `Log${isArchived ? " Archive" : ""}: Reflection Message`,
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
          `**__Are you sure you want to log this habit as:__** ${hb.getStateEmoji(
            habitLog
          )}\n**Previously:** ${hb.getStateEmoji(
            existingLog ? existingLog.state : 0
          )}\n\n🎯 - __**Description:**__\n${targetHabit.description}${
            isCountType && (countValue || countValue === 0)
              ? `\n__**${countMetric}:**__ Current Value (**${countValue}**) vs. ${countGoalTypeString} (**${countGoal}**)`
              : ""
          }${
            reflectionMessage
              ? `\n__**Reflection Message:**__\n${reflectionMessage}`
              : ""
          }`,
          forceSkip,
          `Log${isArchived ? " Archive" : ""}: Confirmation`
        );
        if (confirmEnd) {
          // 1. Check if there has already been a log for the given date.
          // 2. If so, find it and edit it, otherwise create a new one with the desired log
          // If no logs
          currentLogs = await Log.find({
            connectedDocument: targetHabit._id,
          }).sort({ timestamp: -1 });
          existingLog = hb.getHabitLogOnTimestampDay(
            currentLogs,
            timezoneOffset,
            habitCron.daily
          );
          const isTodaysLog = !!(hb.getTodaysLog(
            currentLogs,
            timezoneOffset,
            habitCron.daily
          ));
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
          currentLogs = await Log.find({
            connectedDocument: targetHabit._id,
          }).sort({ timestamp: -1 });
          currentStreak = hb.calculateCurrentStreak(
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
          // // Going from unchecked to check: increment streak
          // if (previousState === 0 || previousState === 2) {
          //     if (habitLog === 1 || habitLog === 3) {
          //         if (longestStreak === currentStreak) {
          //             longestStreak++;
          //         }
          //         currentStreak++;
          //     }
          // }
          // // Going from check to unchecked: decrement streak
          // else if (previousState === 1 || previousState === 3) {
          //     if (habitLog === 0 || habitLog === 2) {
          //         if (longestStreak === currentStreak) {
          //             if (longestStreak <= 0) {
          //                 longestStreak = 0;
          //             }
          //             else longestStreak--;
          //         }
          //         if (currentStreak <= 0) {
          //             currentStreak = 0;
          //         }
          //         else currentStreak--;
          //     }
          // }
          await Habit.updateOne(
            { _id: targetHabit._id },
            {
              $set: {
                currentState: isTodaysLog ? currentState : habitLog,
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
        } else continue;
      } while (true);

      // This function: updateCountLog
      // switch (countGoalType) {
      //     // Daily
      //     case 1: {
      //         const todaysLog = this.getLogToday(logs, timezoneOffset, dailyCron);
      //         if (!todaysLog) currentState = 0;
      //         else {
      //             const { count } = todaysLog;
      //             if (count) if (count.length) {
      //                 const finalCount = count[count.length - 1];
      //                 if (finalCount >= countGoal) {
      //                     const targetIndex = logs.findIndex(
      //                         log => log._id.toString() === todaysLog._id.toString());
      //                     if (targetIndex >= 0) {
      //                         logs[targetIndex].state = 1;
      //                         await Log.updateOne({ _id: logs[targetIndex]._id },
      //                             { $set: { state: 1 } });
      //                     }
      //                 }
      //             }
      //         }
      //     }
      //         break;
      //     // Weekly
      //     case 2: {

      //     }
      //         break;
      //     // Total
      //     case 3: {

      //     }
      //         break;
      // }

      return;
    } else if (
      logCommand === "delete" ||
      logCommand === "del" ||
      logCommand === "d" ||
      logCommand === "remove" ||
      logCommand === "rem" ||
      logCommand === "r"
    ) {
      /**
       * Allow them to delete any habits - archived or not
       */

      let habitDeleteUsageMessage = hb.getHabitReadOrDeleteHelp(
        PREFIX,
        commandUsed,
        logCommand
      );
      habitDeleteUsageMessage = fn.getMessageEmbed(
        habitDeleteUsageMessage,
        "Log: Delete Help",
        habitEmbedColour
      );
      const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see ${
        isArchived ? `archive ` : ""
      }help\``;

      if (logType) {
        if (logType === "help") {
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
            habitCollection = await getLogsByCreatedAt(
              authorID,
              0,
              numberArg,
              isArchived
            );
          const habitArray = fn.getEmbedArray(
            multipleLogsToStringArray(
              message,
              habitCollection,
              numberArg,
              0,
              false
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
            `Log${
              isArchived ? ` Archive` : ""
            }: Delete Past ${numberArg} Logs (${sortType})`,
            600000
          );
          if (!multipleDeleteConfirmation) return;
          const targetIDs = await habitCollection.map((entry) => entry._id);
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Logs (${sortType})`
          );
          targetIDs.forEach(async (id) => {
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
          const recentIndex = await getRecentHabitIndex(authorID, isArchived);
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
          var logArray = new Array();
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
            const habitLogs = await Log.find({
              connectedDocument: habitView._id,
            });
            if (habitLogs)
              if (habitLogs.length) {
                logArray.push(
                  `__**Habit ${toDelete[i]}:**__ ${hb.habitDocumentDescription(
                    habitView
                  )}`
                );
                habitLogs.forEach((log) => {
                  logArray.push(hb.logDocumentToString(habit));
                });
              }
          }
          const deleteConfirmMessage = `Are you sure you want to **delete logs for habits ${toDelete.toString()}?**`;
          const sortType = indexByRecency ? "By Recency" : "By Date Created";
          logArray = fn.getEmbedArray(
            logArray,
            "",
            true,
            false,
            habitEmbedColour
          );
          const confirmDeleteMany = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            logArray,
            deleteConfirmMessage,
            forceSkip,
            `Log${
              isArchived ? ` Archive` : ""
            }: Delete Logs ${toDelete} (${sortType})`,
            600000
          );
          if (confirmDeleteMany) {
            console.log(
              `Deleting ${authorID}'s Logs ${toDelete} (${sortType})`
            );
            habitTargetIDs.forEach(async (id) => {
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
                  skipEntries = await getRecentHabitIndex(authorID, isArchived);
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
                habitCollection = await getLogsByCreatedAt(
                  authorID,
                  skipEntries,
                  pastNumberOfEntries,
                  isArchived
                );
              const habitArray = fn.getEmbedArray(
                multipleLogsToStringArray(
                  message,
                  habitCollection,
                  pastNumberOfEntries,
                  skipEntries,
                  false
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
                `Log${
                  isArchived ? ` Archive` : ""
                }: Multiple Delete Warning! (${sortType})`
              );
              console.log({ multipleDeleteConfirmation });
              if (!multipleDeleteConfirmation) return;
              const targetIDs = await habitCollection.map((entry) => entry._id);
              console.log(
                `Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} habits past ${skipEntries} (${sortType})`
              );
              targetIDs.forEach(async (id) => {
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
      const noLogsMessage = `**NO ${
        isArchived ? "ARCHIVED " : ""
      }HABITS**... try \`${PREFIX}${commandUsed} start help\``;
      if (isNaN(args[1 + archiveShift])) {
        const deleteType = logType;
        if (deleteType === "recent") {
          const habitView = await hb.getOneHabitByRecency(
            authorID,
            0,
            isArchived
          );
          if (!habitView) return fn.sendErrorMessage(message, noLogsMessage);
          const habitTargetID = habitView._id;
          console.log({ habitTargetID });
          const habitIndex = await getRecentHabitIndex(authorID, isArchived);
          const habitEmbed = fn.getEmbedArray(
            hb.logDocumentToString(habitView),
            `Log${isArchived ? " Archive" : ""}: Delete Recent Habit`,
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
            `Log${isArchived ? " Archive" : ""}: Delete Recent Habit`,
            600000
          );
          if (deleteIsConfirmed) {
            hb.cancelHabitById(habitTargetID);
            await del.deleteOneByIDAndConnectedReminders(Habit, habitTargetID);
            return;
          }
        } else if (deleteType === "all") {
          const confirmDeleteAllMessage =
            `Are you sure you want to **delete all** of your recorded habits?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
          const pastNumberOfEntriesIndex = totalHabitNumber;
          if (pastNumberOfEntriesIndex === 0) {
            return fn.sendErrorMessage(message, noLogsMessage);
          }
          let confirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            confirmDeleteAllMessage,
            forceSkip,
            `Log${isArchived ? ` Archive` : ""}: Delete All Logs WARNING!`
          );
          if (!confirmDeleteAll) return;
          const finalDeleteAllMessage = `Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR HABITS ON RECORD**?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *or* \`${PREFIX}${commandUsed} archive all\` *first)*`;
          let finalConfirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            finalDeleteAllMessage,
            `Log${isArchived ? ` Archive` : ""}: Delete ALL Logs FINAL Warning!`
          );
          if (!finalConfirmDeleteAll) return;

          console.log(
            `Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Logs`
          );
          const reminderQuery = { userID: authorID };
          const userLogs = await Reminder.find(reminderQuery);
          userLogs.forEach(async (habit) => {
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
          `__**Habit ${pastNumberOfEntriesIndex}:**__ ${await habitDocumentToString(
            bot,
            habitView,
            true,
            true,
            true,
            true
          )}`,
          `Log${
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
          `Log${
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
    } else if (logCommand === "see" || logCommand === "show") {
      let habitSeeUsageMessage = hb.getHabitReadOrDeleteHelp(
        PREFIX,
        commandUsed,
        logCommand
      );
      habitSeeUsageMessage = fn.getMessageEmbed(
        habitSeeUsageMessage,
        `Log${isArchived ? ` Archive` : ""}: See Help`,
        habitEmbedColour
      );

      const seeCommands = ["past", "recent", "all"];

      if (logType) {
        if (logType === "help") {
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
        !seeCommands.includes(logType) &&
        !archiveRegex.test(logType) &&
        isNaN(logType)
      ) {
        return message.reply(habitActionHelpMessage);
      }
      // Do not show the most recent habit embed, when a valid command is called
      // it will be handled properly later based on the values passed in!
      else {
        const seeType = logType;
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
              `** ${isArchived ? "ARCHIVED " : ""}HABIT DOES NOT EXIST **...`
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
          // Find Logs, toArray, store data in meaningful output
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
            let confirmSeeLogs = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeMessage,
              forceSkip,
              `Log${isArchived ? ` Archive` : ""}: See ${
                args[2 + archiveShift]
              } Logs(${sortType})`
            );
            if (!confirmSeeLogs) return;
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
              `Log${isArchived ? ` Archive` : ""}: See All Logs`
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
            habitView = await getLogsByCreatedAt(
              authorID,
              0,
              habitIndex,
              isArchived
            );
          console.log({ habitView, pastNumberOfEntriesIndex: habitIndex });
          const habitArray = multipleLogsToStringArray(
            message,
            habitView,
            habitIndex,
            0,
            false
          );
          await fn.sendPaginationEmbed(
            bot,
            message.channel.id,
            authorID,
            fn.getEmbedArray(
              habitArray,
              `Log${
                isArchived ? ` Archive` : ""
              }: See ${habitIndex} Logs(${sortType})`,
              true,
              `Logs ${fn.timestampToDateString(
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
                    `** ${
                      isArchived ? "ARCHIVED " : ""
                    } HABITS(S) DO NOT EXIST **...`
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
                  `Log${isArchived ? ` Archive` : ""}: See ${
                    args[1 + archiveShift]
                  } Logs Past ${entriesToSkip} (${sortType})`
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
                  habitView = await getLogsByCreatedAt(
                    authorID,
                    entriesToSkip,
                    habitIndex,
                    isArchived
                  );
                console.log({ habitView });
                const habitStringArray = multipleLogsToStringArray(
                  message,
                  habitView,
                  habitIndex,
                  entriesToSkip,
                  false
                );
                await fn.sendPaginationEmbed(
                  bot,
                  message.channel.id,
                  authorID,
                  fn.getEmbedArray(
                    habitStringArray,
                    `Log${
                      isArchived ? ` Archive` : ""
                    }: See ${habitIndex} Logs Past ${entriesToSkip} (${sortType})`,
                    true,
                    `Logs ${fn.timestampToDateString(
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
            } HABIT ${habitIndex} DOES NOT EXIST **...`
          );
        }
        // NOT using the past functionality:
        const sortType = indexByRecency ? "By Recency" : "By Date Created";
        const habitString = `__ ** Habit ${habitIndex}:** __ ${await habitDocumentToString(
          bot,
          habitView,
          true,
          false,
          false,
          false
        )} `;
        const habitEmbed = fn.getEmbedArray(
          habitString,
          `Log${
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
      logCommand === "edit" ||
      logCommand === "change" ||
      logCommand === "ed" ||
      logCommand === "ch" ||
      logCommand === "c"
    ) {
      let habitEditUsageMessage =
        `** USAGE:**\n\`${PREFIX}${commandUsed} ${logCommand} <archive?> <HABIT #> <recent?> <force?>\`` +
        `\n\n\`<HABIT #>\`: **recent; 3** (3rd most recent entry, \\**any number*)\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<recent?>\`(OPT.): type **recent** at the indicated spot to sort the habits by **actual time created instead of habit created time!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      habitEditUsageMessage = fn.getMessageEmbed(
        habitEditUsageMessage,
        `Log: Edit Help`,
        habitEmbedColour
      );
      if (logType) {
        if (logType === "help") {
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
          isNaN(logType) &&
          logType !== "recent" &&
          !archiveRegex.test(logType)
        ) {
          return message.reply(habitActionHelpMessage);
        }
      }
      logType = isArchived
        ? args[2]
          ? args[2].toLowerCase()
          : false
        : logType;
      if (logType) {
        var habitIndex;
        if (logType === "recent") {
          habitIndex = await getRecentHabitIndex(authorID, isArchived);
        } else {
          habitIndex = parseInt(logType);
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
          const checkHabit = await getOneHabitByObjectID(habitTargetID);
          if (!checkHabit) return;
          continueEdit = false;
          showHabit = await habitDocumentToString(
            bot,
            habitDocument,
            true,
            true,
            true,
            true
          );
          const type = `Log${isArchived ? " Archive" : ""}`;

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
          const goalTypeString = getGoalTypeString(countGoalType);
          switch (fieldToEditIndex) {
            case 0:
              if (logs)
                if (logs.length) {
                  let logList = `👣 - **__Habit Description:__**\n${habitDocument.description}\n\n`;
                  logs.forEach((log, i) => {
                    logList += `\`${i + 1}\`\: ${hb.logDocumentToString(
                      log
                    )}\n`;
                  });
                  targetLogIndex = await fn.userSelectFromList(
                    bot,
                    message,
                    PREFIX,
                    `\n${logList}`,
                    logs.length,
                    "**Please enter the number corresponding to the habit log you'd like to edit.**",
                    `${type}: Log Field`,
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
                    `${type}: Log Field`,
                    logFields,
                    null,
                    false,
                    habitEmbedColour,
                    600000,
                    0,
                    hb.logDocumentToString(logs[targetLogIndex])
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
                      let currentStateEmoji = hb.getStateEmoji(currentState);
                      habitEditMessagePrompt = checkMissedSkipList;
                      userEdit = await fn.userSelectFromList(
                        bot,
                        message,
                        PREFIX,
                        habitEditMessagePrompt,
                        3,
                        `**Current State:** ${currentStateEmoji}`,
                        `${type}: Log Field`,
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
                          `${type}: Log Count Value Edit`,
                          logs[targetLogIndex].count,
                          null,
                          false,
                          habitEmbedColour,
                          600000,
                          0,
                          `\n${hb.logDocumentToString(logs[targetLogIndex])}`
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
            case 3:
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
            case 4:
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
            case 5:
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
            case 6:
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
            case 7:
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
            case 8:
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
            case 9:
              habitEditMessagePrompt = `**__Do you want the habit to automatically log/complete?__**`;
              const hasCountGoal = countGoal && countGoal !== 0;
              var noMoreStreakLogsAtTier;
              switch (tier) {
                case 1:
                  noMoreStreakLogsAtTier =
                    totalStreakNumber >= streakHabitMax && tier === 1;
                  break;
                case 3:
                  noMoreStreakLogsAtTier = false;
                  break;
                default:
                  noMoreStreakLogsAtTier = true;
                  break;
              }
              userEdit = await fn.userSelectFromList(
                bot,
                message,
                PREFIX,
                `\n\`1\` - **No** ⛔${
                  noMoreStreakLogsAtTier
                    ? ""
                    : `\n\`2\` - **Yes, As a Streak** (Every Reset Time) 🔄`
                }${
                  hasCountGoal
                    ? `\n\`3\` - **Yes, Based on Count Goal** (When goal is reached after logging habit) 🔢`
                    : ""
                }`,
                (hasCountGoal ? 2 : 1) + (noMoreStreakLogsAtTier ? 0 : 1),
                `**__Do you want the habit to automatically log/complete?__**\n(You can still manually log/edit your entries)\n${
                  noMoreStreakLogsAtTier
                    ? `P.S. You've reached your **maximum number of streak habits (${streakHabitMax}) for your tier level (${tier})**`
                    : ""
                }`,
                `${type}: Auto-Complete Type`,
                habitEmbedColour
              );
              autoLogType = userEdit;
              break;
            case 10:
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
            case 11:
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
            case 12:
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
            case 13:
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
                      } else targetLog.timestamp = userEdit;
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
              case 5:
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
              case 6:
                if (userEdit === goals.length) {
                  connectedGoal = undefined;
                } else connectedGoal = goals[userEdit]._id;
                break;
              case 7:
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
              case 8:
                if (!isNaN(userEdit)) cronPeriods = parseFloat(userEdit);
                else {
                  message.reply(
                    `**Please enter a number for your __streak reset period__ entry.**(Currently: __${cronPeriods} ${
                      isWeeklyType ? "week(s)" : "day(s)"
                    }__)`
                  );
                }
                break;
              case 10:
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
              case 13:
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
              // Update Stats!
              const { habitCron } = userSettings;
              const currentLogs = await Log.find({
                connectedDocument: habitDocument._id,
              }).sort({ timestamp: -1 });
              currentStreak = hb.calculateCurrentStreak(
                currentLogs,
                timezoneOffset,
                habitCron,
                isWeeklyType,
                cronPeriods
              );
              if (currentStreak > (longestStreak ? longestStreak : 0)) {
                longestStreak = currentStreak;
              }
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
                let { habitCron } = userSettings;
                hb.cancelHabitById(habitDocument._id);
                await hb.habitCron(habitDocument, timezoneOffset, habitCron);

                habitIndex = indexByRecency
                  ? await getHabitIndexByFunction(
                      authorID,
                      habitTargetID,
                      isArchived ? totalArchiveNumber : totalHabitNumber,
                      isArchived,
                      hb.getOneHabitByRecency
                    )
                  : await getHabitIndexByFunction(
                      authorID,
                      habitTargetID,
                      isArchived ? totalArchiveNumber : totalHabitNumber,
                      isArchived,
                      hb.getOneHabitByCreatedAt
                    );
                console.log({ habitDocument, habitTargetID, fieldToEditIndex });
                showHabit = await habitDocumentToString(
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
                }Habit ${habitIndex}:**__ ${showHabit}${
                  fieldToEditIndex === 0
                    ? `\n\n__**Edited Log:**__\n${hb.logDocumentToString(
                        logs[targetLogIndex]
                      )}`
                    : ""
                }`;
                continueEdit = await fn.getUserConfirmation(
                  bot,
                  message,
                  PREFIX,
                  continueEditMessage,
                  forceSkip,
                  `Log${
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
                ? await getHabitIndexByFunction(
                    authorID,
                    habitTargetID,
                    isArchived ? totalArchiveNumber : totalHabitNumber,
                    isArchived,
                    hb.getOneHabitByCreatedAt
                  )
                : await getHabitIndexByFunction(
                    authorID,
                    habitTargetID,
                    isArchived ? totalArchiveNumber : totalHabitNumber,
                    isArchived,
                    hb.getOneHabitByRecency
                  );
              console.log({ habitDocument, habitTargetID, fieldToEditIndex });
              showHabit = await habitDocumentToString(
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
    } else return message.reply(habitHelpMessage);
  },
};
