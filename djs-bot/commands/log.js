const Discord = require("discord.js");
const Habit = require("../database/schemas/habit");
const Log = require("../database/schemas/habittracker");
const User = require("../database/schemas/user");
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
const checkMissedSkipList =
  "\n`1` - **Check** ✅\n`2` - **Missed** ❌\n`3` - **Skip** ⏭ (still counts as a check)";

// Private Function Declarations
function multipleLogsToStringArray(
  message,
  habitCron,
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
    const logString = fn.logDocumentToString(
      logArray[i],
      habitCron,
      true,
      true
    );
    logsToString.push(logString);
  }
  if (toString) logsToString = logsToString.join("\n\n");
  return logsToString;
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
    "records",
    "recs",
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
    let { habitCron } = userSettings;
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
    const logActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${logCommand} help\``;
    const logActionUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${logCommand} <archive?> <HABIT #?> <recent?> <force?>\`\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived habits!**\n\n\`<HABIT #?>:\` (OPT.) type the (index) **number of the habit which contains the logs** or **recent** you'd like to apply the command to! (i.e. \`recent\` \`1\` \`3\` \`4\` \`10\`)\n\n\`<recent?>\`(OPT.): type **recent** to order the habits by **actual time created instead of the date created property!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
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
        if (onFirst && logType) {
          if (!isNaN(logType)) {
            targetHabitIndex = parseInt(logType);
            if (targetHabitIndex <= 0 || targetHabitIndex > habitArray.length) {
              return message.reply(
                `**${isArchived ? "Archived " : ""}Habit ${parseInt(
                  logType
                )}** does not exist... Try \`${PREFIX}${commandUsed} ${logCommand} help\` for help!`
              );
            } else {
              targetHabitIndex--;
              targetHabit = habitArray[targetHabitIndex];
            }
          } else if (logType === "recent") {
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
          `Log${isArchived ? " Archive" : ""}:${
            onFirst ? ` Habit ${targetHabitIndex + 1}` : ""
          } Timestamp`,
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
                ? indexByRecency
                  ? ` ${targetHabitIndex + 1} recent`
                  : ` ${targetHabitIndex + 1}`
                : ""
            }\`**)\n\n**Old Log:** ${fn.logDocumentToString(
              existingLog,
              habitCron
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
          } reflection message__** to go with your habit log?\n*If yes, you will type in your reflection in the next window!\nOtherwise, the reflection will not be changed.*\n${logTimestampString}\n**Current Log: ${fn.getStateEmoji(
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
          existingLog = fn.getHabitLogOnTimestampDay(
            currentLogs,
            logTimestamp,
            habitCron.daily
          );
          // const overwriteLog = !!existingLog;
          // const isTodaysLog = !!fn.getTodaysLog(
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
          onFirst = false;
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
        `Log: Delete Help`,
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

      // If the user entered an index, use that, otherwise let them select from a list.
      var targetHabit, targetHabitIndex;
      if (logType) {
        if (!isNaN(logType)) {
          targetHabitIndex = parseInt(logType);
          if (targetHabitIndex <= 0 || targetHabitIndex > habitArray.length) {
            return message.reply(
              `**${isArchived ? "Archived " : ""}Habit ${parseInt(
                logType
              )}** does not exist... Try \`${PREFIX}${commandUsed} ${logCommand} help\` for help!`
            );
          } else {
            targetHabitIndex--;
            targetHabit = habitArray[targetHabitIndex];
          }
        } else if (logType === "recent") {
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

        let logList = `**__Habit ${
          targetHabitIndex + 1
        } (${sortType}):__**\n${fn.habitDocumentDescription(targetHabit)}\n\n`;
        habitLogs.forEach((log, i) => {
          logList += `\`${i + 1}\`\: ${fn.logDocumentToString(
            log,
            habitCron
          )}\n`;
          if (i !== habitLogs.length - 1) logList += "\n";
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
          return fn.logDocumentToString(log, habitCron);
        })
        .join("\n");
      const confirmDeletion = await fn.getUserConfirmation(
        bot,
        message,
        PREFIX,
        `**__Are you sure you want to delete the following habit logs?__**\n${fn.habitDocumentDescription(
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
          habitCron = userSettings.habitCron;
          await hb.updateHabitStats(targetHabit, timezoneOffset, habitCron);
        }
      }
      return;
    } else if (logCommand === "see" || logCommand === "show") {
      logSeeUsageMessage = fn.getMessageEmbed(
        logActionUsageMessage,
        `Log: See Help`,
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

      // If the user entered an index, use that, otherwise let them select from a list.
      var targetHabit, targetHabitIndex;
      if (logType) {
        if (!isNaN(logType)) {
          targetHabitIndex = parseInt(logType);
          if (targetHabitIndex <= 0 || targetHabitIndex > habitArray.length) {
            return message.reply(
              `**${isArchived ? "Archived " : ""}Habit ${parseInt(
                logType
              )}** does not exist... Try \`${PREFIX}${commandUsed} ${logCommand} help\` for help!`
            );
          } else {
            targetHabitIndex--;
            targetHabit = habitArray[targetHabitIndex];
          }
        } else if (logType === "recent") {
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
        habitCron,
        logView,
        totalLogs,
        0,
        false
      );
      // Add the habit to the top of the display.
      logArray.unshift([
        `**__Habit ${
          targetHabitIndex + 1
        } (${sortType}):__**\n${fn.habitDocumentDescription(targetHabit)}`,
      ]);
      await fn.sendPaginationEmbed(
        bot,
        message.channel.id,
        authorID,
        fn.getEmbedArray(
          logArray,
          `Habit${isArchived ? ` Archive` : ""} ${
            targetHabitIndex + 1
          }: All ${totalLogs} Logs`,
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
      const logEditUsageMessage = fn.getMessageEmbed(
        logActionUsageMessage,
        `Log: Edit Help`,
        habitEmbedColour
      );
      if (logType === "help") {
        return message.channel.send(logEditUsageMessage);
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

      // If the user entered an index, use that, otherwise let them select from a list.
      var targetHabit, targetHabitIndex;
      if (logType) {
        if (!isNaN(logType)) {
          targetHabitIndex = parseInt(logType);
          if (targetHabitIndex <= 0 || targetHabitIndex > habitArray.length) {
            return message.reply(
              `**${isArchived ? "Archived " : ""}Habit ${parseInt(
                logType
              )}** does not exist... Try \`${PREFIX}${commandUsed} ${logCommand} help\` for help!`
            );
          } else {
            targetHabitIndex--;
            targetHabit = habitArray[targetHabitIndex];
          }
        } else if (logType === "recent") {
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
          "__**Which habit has the log you want to edit?**__",
          `Log${isArchived ? " Archive" : ""}: Select Habit To Edit Log`,
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

      let logs = await Log.find({ connectedDocument: targetHabit._id }).sort({
        timestamp: -1,
      });
      if ((logs && !logs.length) || !logs) {
        return fn.sendReplyThenDelete(
          message,
          `**There are __no entries/logs__ for this current habit!**`
        );
      }

      let logList = `**__Habit ${
        targetHabitIndex + 1
      } (${sortType}):__**\n${fn.habitDocumentDescription(targetHabit)}\n\n`;
      logs.forEach((log, i) => {
        logList += `\`${i + 1}\`\: ${fn.logDocumentToString(log, habitCron)}\n`;
        if (i !== logs.length - 1) logList += "\n";
      });

      const type = `Log${isArchived ? " Archive" : ""}`;
      var targetLog;
      let targetLogIndex = await fn.userSelectFromList(
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
      else targetLog = logs[targetLogIndex];
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
        } = targetHabit;
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

        var logFields = ["Timestamp", "State", "Reflection"];
        if (isCountType) {
          logFields.push("Count");
        }

        const habitTargetID = targetHabit._id;
        var showHabit, showLog, continueEdit, targetCountIndex;
        // if (habitTargetID) {
        //   logs = await Log.find({ connectedDocument: habitTargetID }).sort({
        //     timestamp: -1,
        //   });
        // }
        const checkHabit = await hb.getOneHabitByObjectID(habitTargetID);
        if (!checkHabit)
          return message.channel.send(
            `Habit ${targetHabitIndex + 1} does not exist anymore!`
          );
        continueEdit = false;
        showHabit = fn.habitDocumentDescription(targetHabit);
        showLog = fn.logDocumentToString(targetLog, habitCron);

        // Field the user wants to edit
        const fieldToEditInstructions = "**Which field do you want to edit?**";
        const fieldToEditAdditionalMessage = `__**Log ${
          targetLogIndex + 1
        }:**__\n${fn.logDocumentToString(logs[targetLogIndex], habitCron)}`;
        const fieldToEditTitle = `${type}: Edit Field`;
        var fieldToEdit, fieldToEditIndex;

        const selectedField = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          fieldToEditInstructions,
          fieldToEditTitle,
          logFields,
          null,
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
        switch (fieldToEditIndex) {
          case 0:
            habitEditMessagePrompt = `\n__**Please enter the date/time of when you created this log:**__ ⌚\n${timeExamples}`;
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
              `${type}: Edit State`,
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
              fieldToEdit,
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
                `${type}: Edit Count Value`,
                logs[targetLogIndex].count,
                null,
                false,
                habitEmbedColour,
                600000,
                0,
                `\n${fn.logDocumentToString(logs[targetLogIndex], habitCron)}`
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
        console.log({ userEdit });
        if (userEdit === false) return;
        else if (userEdit === undefined) userEdit = "back";
        else if (userEdit !== "back") {
          // Parse User Edit
          switch (fieldToEditIndex) {
            // Created At (Timestamp)
            case 0:
              userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
              const now = Date.now();
              userEdit = fn.timeCommandHandlerToUTC(
                userEdit,
                now,
                timezoneOffset,
                daylightSaving
              );
              console.log({ userEdit });
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
                    collisionLog._id.toString() === targetLog._id.toString())
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
                  console.log(`Deleting Collision Log: ${collisionLog._id}`);
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
                targetLog.count[targetCountIndex] = parseFloat(userEdit);
              } else if (userEdit.toLowerCase() === "delete") {
                targetLog.count.splice(targetCountIndex, 1);
              } else if (!isNaN(targetLog.count[targetCountIndex])) {
                const splitUserArgs = userEdit.split(/[\s\n]+/);
                if (splitUserArgs[0]) {
                  const operation = splitUserArgs[0];
                  var multiplier;
                  if (operation.toLowerCase() === "add") multiplier = 1;
                  else if (operation.toLowerCase() === "sub") multiplier = -1;
                  if (splitUserArgs[1]) {
                    let amount = parseFloat(splitUserArgs[1]);
                    if (!isNaN(amount)) {
                      targetLog.count[targetCountIndex] += amount * multiplier;
                    }
                  }
                }
              }
              break;
          }
        } else continueEdit = true;
        console.log({ userEdit });
        if (!continueEdit) {
          try {
            const { timestamp, state, message: logMessage, count } = targetLog;
            console.log(
              `Editing ${authorID}'s Log ${targetLogIndex + 1} of Habit ${
                targetHabitIndex + 1
              } (${sortType})`
            );
            targetLog = await Log.findOneAndUpdate(
              { _id: targetLog._id },
              { $set: { timestamp, state, message: logMessage, count } },
              { new: true }
            );
            console.log({ targetLog });
            if (targetLog) {
              logs = await Log.find({
                connectedDocument: targetHabit._id,
              }).sort({
                timestamp: -1,
              });
            }
            // If the timestamp is changed, update the log array and get the new order! (Also keep track of the current log we are editing.)
            if (fieldToEditIndex === 0 && targetLog && logs) {
              const oldTargetLogIndex = targetLogIndex;
              targetLogIndex = logs.findIndex(
                (log) => log._id.toString() === targetLog._id.toString()
              );
              if (targetLogIndex === -1) targetLogIndex = oldTargetLogIndex;
              // console.log({ logs, targetLogIndex, oldTargetLogIndex });
            }

            // Update Habit Stats!
            targetHabit = await Habit.findById(habitTargetID);

            //* Assumption: The Habit index should not change during the edit because it's createdAt property cannot be changed through the logs.
            console.log({ continueEdit });

            if (targetHabit) {
              userSettings = await User.findOne({ discordID: authorID });
              habitCron = userSettings;
              targetHabit = await hb.updateHabitStats(
                targetHabit,
                timezoneOffset,
                habitCron
              );
              habitArray[targetHabitIndex] = targetHabit;
              console.log(
                `Updating ${authorID}'s Habit ${targetHabitIndex + 1}`
              );
              // targetHabitIndex = indexByRecency ? await hb.getHabitIndexByFunction(
              //       authorID,
              //       habitTargetID,
              //       isArchived ? totalArchiveNumber : totalHabitNumber,
              //       isArchived,
              //       hb.getOneHabitByRecency
              //     )
              //   : await hb.getHabitIndexByFunction(
              //       authorID,
              //       habitTargetID,
              //       isArchived ? totalArchiveNumber : totalHabitNumber,
              //       isArchived,
              //       hb.getOneHabitByCreatedAt
              //     );
              showLog = fn.logDocumentToString(logs[targetLogIndex], habitCron);
              showHabit = fn.habitDocumentDescription(targetHabit);
              const continueEditMessage = `Do you want to continue **editing ${
                isArchived ? "Archived " : ""
              }Habit ${targetHabitIndex + 1}'s Log ${
                targetLogIndex + 1
              }?**\n\n__**${isArchived ? "Archived " : ""}Habit ${
                targetHabitIndex + 1
              }:**__ ${showHabit}\n\n__**Log ${
                targetLogIndex + 1
              }:**__\n${showLog}`;
              continueEdit = await fn.getUserConfirmation(
                bot,
                message,
                PREFIX,
                continueEditMessage,
                forceSkip,
                `Log${isArchived ? " Archive" : ""}: Continue Editing Log ${
                  targetLogIndex + 1
                }?`,
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
          targetHabit = await Habit.findById(habitTargetID);

          if (targetHabit) {
            // targetHabitIndex = indexByRecency
            //   ? await hb.getHabitIndexByFunction(
            //       authorID,
            //       habitTargetID,
            //       isArchived ? totalArchiveNumber : totalHabitNumber,
            //       isArchived,
            //       hb.getOneHabitByCreatedAt
            //     )
            //   : await hb.getHabitIndexByFunction(
            //       authorID,
            //       habitTargetID,
            //       isArchived ? totalArchiveNumber : totalHabitNumber,
            //       isArchived,
            //       hb.getOneHabitByRecency
            //     );
            // console.log({ targetHabit, habitTargetID, fieldToEditIndex });
            showLog = fn.logDocumentToString(logs[targetLogIndex], habitCron);
            showHabit = fn.habitDocumentDescription(targetHabit);
          } else {
            message.reply(
              `**${isArchived ? "Archived " : ""}Habit not found...**`
            );
            continueEdit = false;
          }
        }
      } while (continueEdit === true);
      return;
    } else return message.reply(logUsageMessage);
  },
};
