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
    const logString = hb.logDocumentToString(logArray[i], true, true);
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

async function getLogsByTimestamp(
  connectedDocument,
  entryIndex,
  numberOfEntries = 1
) {
  try {
    const logs = await Log.find({ connectedDocument })
      .sort({ timestamp: -1 })
      .limit(numberOfEntries)
      .skip(entryIndex);
    return logs;
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
    const logActionUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${logCommand} <archive?> <recent?> <force?>\`\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<recent?>\`(OPT.): type **recent** to order the habits by **actual time created instead of the date created property!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
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
      const logStartUsageMessage = fn.getMessageEmbed(
        logActionUsageMessage,
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

      do {
        var targetHabitIndex;
        let targetHabit = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          "__**Which habit would you like to log?**__",
          `Log${isArchived ? " Archive" : ""}: Select Habit To Log`,
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

        let currentLogs = await Log.find({
          connectedDocument: targetHabit._id,
        }).sort({ timestamp: -1 });
        let existingLog = hb.getHabitLogOnTimestampDay(
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
            }\`**)\n\n**Old Log:** ${hb.logDocumentToString(
              existingLog
            )}\n\n**Desired Timestamp:** ${fn.timestampToDateString(
              logTimestamp
            )}`,
            false,
            `Log${
              isArchived ? " Archive" : ""
            }: Overwrite Log? (Date Conflict)`,
            600000
          );
          if (!confirmOverwiteLog) return;
        }

        const logTimestampString = existingLog
          ? `\n**Previous Timestamp:** ${fn.timestampToDateString(
              existingLog.timestamp
            )}\n**Current Timestamp:** ${fn.timestampToDateString(
              logTimestamp
            )}`
          : `\n**Current Timestamp:** ${fn.timestampToDateString(
              logTimestamp
            )}`;
        const previousCountTypeString = existingLog
          ? `**Previous ${countMetric}:** ${hb.countArrayToString(
              existingLog.count
            )}`
          : "";

        if (isCountType) {
          countValue = await fn.getNumberEntry(
            bot,
            message,
            PREFIX,
            `Enter your **${countMetric}** (${countGoalTypeString}: **${countGoal}**)\n${logTimestampString}\n${previousCountTypeString}`,
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
          } reflection message__** to go with your habit log?\n*If yes, you will type in your reflection in the next window!\nOtherwise, the reflection will not be changed.*\n${logTimestampString}\n**Current Log: ${hb.getStateEmoji(
            habitLog
          )}**\n${currentReflectionString}`,
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
          )}\n**Previous State:** ${hb.getStateEmoji(
            existingLog ? existingLog.state : 0
          )}${
            existingLog
              ? `\n**Previous Timestamp:** ${fn.timestampToDateString(
                  existingLog.timestamp
                )}`
              : ""
          }${
            isCountType ? `\n${previousCountTypeString}` : ""
          }\n**Previous Reflection:** ${
            currentReflection ? `\n${currentReflection}` : " N/A"
          }\n\n__**New Log:**__\n**State:** ${hb.getStateEmoji(
            habitLog
          )}\n**Timestamp:** ${fn.timestampToDateString(logTimestamp)}${
            isCountType && (countValue || countValue === 0)
              ? `\n**${countMetric}:** Current Value (**${countValue}**) vs. ${countGoalTypeString} (**${countGoal}**)`
              : ""
          }${
            reflectionMessage
              ? `\n**Reflection Message:**\n${reflectionMessage}`
              : ""
          }`,
          forceSkip,
          `Log${isArchived ? " Archive" : ""}: Confirmation`,
          600000
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
            logTimestamp,
            habitCron.daily
          );
          // const overwriteLog = !!existingLog;
          // const isTodaysLog = !!hb.getTodaysLog(
          //   currentLogs,
          //   timezoneOffset,
          //   habitCron.daily
          // );
          console.log({ existingLog });
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
          await hb.updateHabitStats(
            targetHabit,
            timezoneOffset,
            habitCron
            // isTodaysLog && !overwriteLog
          );
          return;
        } else return;
      } while (true);
      return;
    } else if (
      logCommand === "delete" ||
      logCommand === "del" ||
      logCommand === "d" ||
      logCommand === "remove" ||
      logCommand === "rem" ||
      logCommand === "r"
    ) {
      const logDeleteUsageMessage = fn.getMessageEmbed(
        logActionUsageMessage,
        `Log: Start Help`,
        habitEmbedColour
      );
      if (logType === "help")
        return message.channel.send(logDeleteUsageMessage);

      if (!totalHabitNumber && !isArchived) {
        return message.reply(
          `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
        );
      } else if (!totalArchiveNumber && isArchived) {
        return message.reply(
          `**NO ARCHIVED HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
        );
      }

      var indexByRecency = false;
      if (args[1 + archiveShift] !== undefined) {
        if (args[1 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }

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

      var targetHabitIndex;
      let targetHabit = await fn.getUserSelectedObject(
        bot,
        message,
        PREFIX,
        "__**Which habit has the log**(**s**)** you want to delete?**__",
        `Log${isArchived ? " Archive" : ""}: Select Habit To Delete Logs`,
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

      let habitLogs = await Log.find({
        connectedDocument: targetHabit._id,
      }).sort({ timestamp: -1 });
      const originalLength = habitLogs.length;
      var reset;
      let targetLogs = new Array();

      do {
        const someLogsSelected = habitLogs.length !== originalLength;
        reset = false;

        let logList = `👣 - **__Habit Description:__**\n${targetHabit.description}\n\n`;
        habitLogs.forEach((log, i) => {
          logList += `\`${i + 1}\`\: ${hb.logDocumentToString(log)}\n`;
        });
        if (someLogsSelected) {
          logList += `\`${habitLogs.length + 1}\`: **DONE**`;
        }
        const targetLogIndex = await fn.userSelectFromList(
          bot,
          message,
          PREFIX,
          `\n${logList}`,
          habitLogs.length + 1,
          `**Please enter the number corresponding to the log you'd like to delete.**${
            someLogsSelected
              ? `\n(Type \`${habitLogs.length + 1}\` if you're done)`
              : ""
          }`,
          `Log${isArchived ? " Archive" : ""}: Select Log to Delete`,
          habitEmbedColour,
          600000,
          0
        );
        if (!targetLogIndex && targetLogIndex !== 0) return;
        else {
          if (targetLogIndex !== habitLogs.length) {
            targetLogs.push(habitLogs[targetLogIndex]);
            habitLogs.splice(targetLogIndex, 1);
            if (habitLogs.length) {
              const anotherLog = await fn.getUserConfirmation(
                bot,
                message,
                PREFIX,
                "**Would you like to delete another log?**",
                false,
                `Log${
                  isArchived ? " Archive" : ""
                }: Select More Logs to Delete?`
              );
              if (typeof anotherLog === "boolean") {
                if (anotherLog === true) reset = true;
                else reset = false;
              } else return;
            }
          }
        }
        if (!habitLogs.length) reset = false;
      } while (reset);
      console.log({ targetLogs });
      const finalLogsString = targetLogs
        .map((log) => {
          return hb.logDocumentToString(log);
        })
        .join("\n");
      const confirmDeletion = await fn.getUserConfirmation(
        bot,
        message,
        PREFIX,
        `**__Are you sure you want to delete the following habit logs?__**\n${hb.habitDocumentDescription(
          targetHabit
        )}\n\n**__Logs to be Deleted:__**\n${finalLogsString}`,
        false,
        `Log${isArchived ? " Archive" : ""}: Confirm Logs to Delete`,
        600000
      );
      if (!confirmDeletion) return;
      else {
        const targetLogIds = targetLogs.map((log) => log._id);
        await Log.deleteMany({ _id: { $in: targetLogIds } });
        const userSettings = await User.findOne({ discordID: authorID });
        if (userSettings) {
          const { habitCron } = userSettings;
          await hb.updateHabitStats(targetHabit, timezoneOffset, habitCron);
        }
      }
      return;
    } else if (logCommand === "see" || logCommand === "show") {
      logSeeUsageMessage = fn.getMessageEmbed(
        logActionUsageMessage,
        `Log: Start Help`,
        habitEmbedColour
      );
      if (logType === "help") return message.channel.send(logSeeUsageMessage);

      if (!totalHabitNumber && !isArchived) {
        return message.reply(
          `**NO HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
        );
      } else if (!totalArchiveNumber && isArchived) {
        return message.reply(
          `**NO ARCHIVED HABITS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
        );
      }

      var indexByRecency = false;
      if (args[1 + archiveShift] !== undefined) {
        if (args[1 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }
      const sortType = indexByRecency ? "By Recency" : "By Timestamp";

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

      var targetHabitIndex;
      let targetHabit = await fn.getUserSelectedObject(
        bot,
        message,
        PREFIX,
        "__**Which habit do you want to see logs for?**__",
        `Log${isArchived ? " Archive" : ""}: Select Habit To See Logs`,
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

      // Show all of the logs for the given habit
      const totalLogs = await Log.find({
        connectedDocument: targetHabit._id,
      }).countDocuments();
      var logView;
      if (indexByRecency)
        logView = await fn.getEntriesByRecency(
          Log,
          { connectedDocument: targetHabit._id },
          0,
          totalLogs
        );
      else logView = await getLogsByTimestamp(targetHabit._id, 0, totalLogs);
      console.log({ logView, totalLogs });
      const logArray = multipleLogsToStringArray(
        message,
        logView,
        totalLogs,
        0,
        false
      );
      await fn.sendPaginationEmbed(
        bot,
        message.channel.id,
        authorID,
        fn.getEmbedArray(
          logArray,
          `Habit${isArchived ? ` Archive` : ""} ${
            targetHabitIndex + 1
          }: All ${totalLogs} Logs (${sortType})`,
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
