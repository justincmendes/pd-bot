// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Goal = require("../database/schemas/longtermgoals");
const User = require("../database/schemas/user");
const Habit = require("../database/schemas/habit");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const del = require("../../utilities/deletion");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const timeExamples = fn.timeExamples;
const futureTimeExamples = fn.futureTimeExamples;
const goalEmbedColour = fn.goalsEmbedColour;
const goalMax = fn.goalMaxTier1;
const goalArchiveMax = fn.goalArchiveMaxTier1;
const areasOfLifeEmojis = fn.areasOfLifeEmojis;
const areasOfLife = fn.areasOfLife;
const areasOfLifeCombinedEmoji = fn.getAreasOfLifeEmojiCombinedArray();
const areasOfLifeList = fn.getAreasOfLifeList().join("\n");

// Function Declarations and Definitions

function goalDocumentToString(bot, goalDocument, showType = true) {
  const {
    archived,
    completed,
    type,
    description,
    reason,
    steps,
    checkpoints,
    start,
    end,
  } = goalDocument;
  const areaOfLife = showType
    ? `${areasOfLifeEmojis[type] ? `${areasOfLifeEmojis[type]} ` : ""}${
        areasOfLife[type] ? `__${areasOfLife[type]}__` : ""
      }`
    : false;
  let outputString = `${archived ? "****ARCHIVED****\n" : ""}${
    areaOfLife ? areaOfLife : ""
  }${description ? `\n🎯 - **Description:**\n${description}` : ""}${
    reason ? `\n💭 - **Reason:**\n${reason}` : ""
  }${checkpoints ? `\n🏁 - **Checkpoints:**\n${checkpoints}` : ""}${
    steps ? `\n👣 - **Steps:**\n${steps}` : ""
  }${
    start && !isNaN(start)
      ? `\n**Start:** ${fn.timestampToDateString(start, false, true, true)}`
      : ""
  }${
    end && !isNaN(end)
      ? `\n**Target Completion:** ${fn.timestampToDateString(
          end,
          false,
          true,
          true
        )}`
      : ""
  }\n**Status:** ${completed ? "Completed ✅" : "In Progess 🔲"}`;
  outputString = fn.getRoleMentionToTextString(bot, outputString);
  return outputString;
}

async function getGoalIndexByFunction(
  userID,
  goalID,
  totalGoals,
  archived,
  getOneGoal
) {
  let i = 0;
  while (true) {
    let goal = await getOneGoal(userID, i, archived);
    if (goal === undefined && i === totalGoals) {
      return false;
    } else if (goal._id.toString() === goalID.toString()) break;
    i++;
  }
  return i + 1;
}

async function getOneGoalByRecency(userID, goalIndex, archived = undefined) {
  const goal = await Goal.findOne({ userID, archived })
    .sort({ _id: -1 })
    .skip(goalIndex)
    .catch((err) => {
      console.log(err);
      return false;
    });
  return goal;
}

async function getOneGoalByStartTime(userID, goalIndex, archived = undefined) {
  const goal = await Goal.findOne({ userID, archived })
    .sort({ start: +1 })
    .skip(goalIndex)
    .catch((err) => {
      console.log(err);
      return false;
    });
  return goal;
}

async function getOneGoalByObjectID(goalID) {
  const goal = await Goal.findById(goalID).catch((err) => {
    console.log(err);
    return false;
  });
  return goal;
}

async function getGoalsByStartTime(
  userID,
  entryIndex,
  numberOfEntries = 1,
  archived = undefined
) {
  try {
    const goals = await Goal.find({ userID, archived })
      .sort({ start: +1 })
      .limit(numberOfEntries)
      .skip(entryIndex);
    return goals;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function getRecentGoalIndex(userID, archived) {
  try {
    var index;
    const entries = await Goal.find({ userID, archived }).sort({ start: +1 });
    if (entries.length) {
      let targetID = await Goal.findOne({ userID, archived }).sort({ _id: -1 });
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

function getGoalReadOrDeleteHelp(PREFIX, commandUsed, crudCommand) {
  return `**USAGE:**\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> past <PAST_#_OF_ENTRIES> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> <ENTRY #> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> many <MANY_ENTRIES> <recent?> <force?>\`\n\`${PREFIX}${commandUsed} ${crudCommand} <archive?> <#_OF_ENTRIES> <recent?> past <STARTING_INDEX> <force?>\`\n\n\`<PAST_#_OF_ENTRIES>\`: **recent; 5** (\\*any number); **all** \n(NOTE: ***__any number > 1__* will get more than 1 goal!**)\n\n\`<#_OF_ENTRIES>\` and \`<STARTING_INDEX>\`: **2** (\\**any number*)\n\n\`<ENTRY_#>\`: **all; recent; 3** (3rd most recent goal, \\**any number*)\n(NOTE: Gets just 1 goal - UNLESS \`all\`)\n\n\`<MANY_ENTRIES>\`: **3,5,recent,7,1,25**\n- **COMMA SEPARATED, NO SPACES:**\n1 being the most recent goal, 25 the 25th most recent, etc.\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived goals!**\n\n\`<recent?>\`: (OPT.) type **recent** at the indicated spot to sort the goals by **time created instead of goal start time!**\n\n\`<force?>\`: (OPT.) type **force** at the end of your command to **skip all of the confirmation windows!**`;
}

function multipleGoalsToStringArray(
  bot,
  message,
  goalArray,
  numberOfGoals,
  entriesToSkip = 0,
  toString = false
) {
  var goalsToString = new Array();
  console.log({ numberOfGoals });
  for (let i = 0; i < numberOfGoals; i++) {
    if (goalArray[i] === undefined) {
      numberOfGoals = i;
      fn.sendErrorMessage(
        message,
        `**GOALS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`
      );
      break;
    }
    const goalString = `__**Goal ${
      i + entriesToSkip + 1
    }:**__ ${goalDocumentToString(bot, goalArray[i])}`;
    goalsToString.push(goalString);
  }
  if (toString) goalsToString = goalsToString.join("\n\n");
  return goalsToString;
}

async function getRecentGoal(bot, userID, isArchived, embedColour) {
  const recentGoalToString = `__**Goal ${await getRecentGoalIndex(
    userID,
    isArchived
  )}:**__${goalDocumentToString(
    bot,
    await getOneGoalByRecency(userID, 0, isArchived)
  )}`;
  const goalEmbed = fn.getMessageEmbed(
    recentGoalToString,
    `Long-Term Goal: See Recent Goal`,
    embedColour
  );
  return goalEmbed;
}

function getGoalEndReminderString(
  commandUsed,
  timezoneOffset,
  startTimeUTC,
  timeScaleString,
  goalDescription
) {
  return `The goal you've started on __${fn.timestampToDateString(
    startTimeUTC + HOUR_IN_MS * timezoneOffset,
    false,
    true,
    true
  )}__ is set for completion **${
    timeScaleString ? timeScaleString.toLowerCase() : "soon"
  }!**:\n🎯 - ${goalDescription}\n\nType \`?${commandUsed} see\` to **see** the full details of this goal\nType \`?${commandUsed} edit\` to **edit** this goal and/or change the goal's set completion date\nType \`?${commandUsed} end\` to mark this goal as **completed**`;
}

async function setGoalEndingReminders(
  bot,
  userID,
  timezoneOffset,
  commandUsed,
  goalDocumentID,
  goalDescription,
  startTime,
  initialMessageTimestamp,
  endTime
) {
  const endDate = new Date(endTime);
  const endYear = endDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const endDay = endDate.getUTCMonth();
  const endHour = endDate.getUTCHours();
  const endMinute = endDate.getUTCMinutes();
  const yearBefore = new Date(
    endYear - 1,
    endMonth,
    endDay,
    endHour,
    endMinute
  ).getTime();
  const semiAnnumBefore = new Date(
    endYear,
    endMonth - 6,
    endDay,
    endHour,
    endMinute
  ).getTime();
  const monthBefore = new Date(
    endYear,
    endMonth - 1,
    endDay,
    endHour,
    endMinute
  ).getTime();
  const weekBefore = new Date(
    endYear,
    endMonth,
    endDay - 7,
    endHour,
    endMinute
  ).getTime();
  const dayBefore = new Date(
    endYear,
    endMonth,
    endDay - 1,
    endHour,
    endMinute
  ).getTime();
  const type = "Goal";
  if (dayBefore >= initialMessageTimestamp) {
    await rm.setNewDMReminder(
      bot,
      userID,
      startTime,
      dayBefore,
      getGoalEndReminderString(
        commandUsed,
        timezoneOffset,
        startTime,
        "by tomorrow",
        goalDescription
      ),
      type,
      true,
      goalDocumentID,
      false,
      false,
      false,
      goalEmbedColour
    );
    if (weekBefore >= initialMessageTimestamp) {
      await rm.setNewDMReminder(
        bot,
        userID,
        startTime,
        weekBefore,
        getGoalEndReminderString(
          commandUsed,
          timezoneOffset,
          startTime,
          "by next week",
          goalDescription
        ),
        type,
        true,
        goalDocumentID,
        false,
        false,
        false,
        goalEmbedColour
      );
      if (monthBefore >= initialMessageTimestamp) {
        await rm.setNewDMReminder(
          bot,
          userID,
          startTime,
          monthBefore,
          getGoalEndReminderString(
            commandUsed,
            timezoneOffset,
            startTime,
            "by next month",
            goalDescription
          ),
          type,
          true,
          goalDocumentID,
          false,
          false,
          false,
          goalEmbedColour
        );
        if (semiAnnumBefore >= initialMessageTimestamp) {
          await rm.setNewDMReminder(
            bot,
            userID,
            startTime,
            semiAnnumBefore,
            getGoalEndReminderString(
              commandUsed,
              timezoneOffset,
              startTime,
              "6 months from now",
              goalDescription
            ),
            type,
            true,
            goalDocumentID,
            false,
            false,
            false,
            goalEmbedColour
          );
          if (yearBefore >= initialMessageTimestamp) {
            await rm.setNewDMReminder(
              bot,
              userID,
              startTime,
              yearBefore,
              getGoalEndReminderString(
                commandUsed,
                timezoneOffset,
                startTime,
                "by next year",
                goalDescription
              ),
              type,
              true,
              goalDocumentID,
              false,
              false,
              false,
              goalEmbedColour
            );
          }
        }
      }
    }
  }
  await rm.setNewDMReminder(
    bot,
    userID,
    startTime,
    yearBefore,
    getGoalEndReminderString(
      commandUsed,
      timezoneOffset,
      startTime,
      "right now",
      goalDescription
    ),
    type,
    true,
    goalDocumentID,
    false,
    false,
    false,
    goalEmbedColour
  );
}

async function setGoalsReminder(
  bot,
  userID,
  startTime,
  endTime,
  isRecurring,
  interval,
  remainingOccurrences
) {
  try {
    const type = "Goals";
    const goalReminderString = await fn.getGoalsReminderMessage(userID);
    await rm.setNewDMReminder(
      bot,
      userID,
      startTime,
      endTime,
      goalReminderString,
      type,
      true,
      undefined,
      isRecurring,
      interval,
      remainingOccurrences,
      goalEmbedColour
    );
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function setUserGoalsReminder(
  bot,
  message,
  PREFIX,
  timezoneOffset,
  daylightSaving,
  forceSkip,
  userID,
  helpMessage,
  type = "Long-Term Goal"
) {
  try {
    let interval = await rm.getInterval(
      bot,
      message,
      PREFIX,
      timezoneOffset,
      daylightSaving,
      `__**Please enter the time you'd like in-between recurring reminders (interval):**__`,
      `${type}: Recurring Reminder Interval`,
      goalEmbedColour
    );
    if (!interval) return false;
    let { duration: intervalDuration, args: intervalArgs } = interval;
    console.log(fn.millisecondsToTimeString(intervalDuration));

    let remainingOccurrences = await rm.getRemainingOccurrences(
      bot,
      message,
      PREFIX,
      `${type} Recurring Reminder`,
      goalEmbedColour
    );
    if (!remainingOccurrences && remainingOccurrences !== undefined) return;
    if (!remainingOccurrences) remainingOccurrences = undefined;

    let duration = await rm.getUserFirstRecurringEndDuration(
      bot,
      message,
      PREFIX,
      helpMessage,
      timezoneOffset,
      daylightSaving,
      true,
      "Long-Term Goal",
      goalEmbedColour
    );
    console.log({ duration });
    if (!duration && duration !== 0) return false;
    const currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
    duration = duration > 0 ? duration : 0;
    const confirmCreationMessage = `Are you sure you want to get **__long-term goal (DM) reminders__ ${fn.millisecondsToTimeString(
      duration
    )} from now**, repeating every **${fn.millisecondsToTimeString(
      intervalDuration
    )}**?`;
    const confirmCreation = await fn.getUserConfirmation(
      bot,
      message,
      PREFIX,
      confirmCreationMessage,
      forceSkip,
      `${type}: Confirm Reminder`,
      180000
    );
    if (!confirmCreation) return confirmCreation;
    await setGoalsReminder(
      bot,
      userID,
      currentTimestamp,
      currentTimestamp + duration,
      true,
      intervalArgs,
      remainingOccurrences
    );
  } catch (err) {
    console.log(err);
    return false;
  }
}

module.exports = {
  name: "goals",
  description: "Long-term goal setting handler",
  aliases: ["goal", "g"],
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
    // Variable Declarations and Initializations
    // See - with markdown option!
    // Edit includes the ability to add
    const authorID = message.author.id;
    const authorUsername = message.author.username;
    const userSettings = await User.findOne({ discordID: authorID });
    const { tier } = userSettings;
    let goalUsageMessage =
      `**USAGE**\n\`${PREFIX}${commandUsed} <ACTION>\`` +
      `\n\n\`<ACTION>\`: **add; see; edit; end; archive; delete; post; reminder**\n\n*__ALIASES:__* **${
        this.name
      } - ${this.aliases.join("; ")}**`;
    goalUsageMessage = fn.getMessageEmbed(
      goalUsageMessage,
      "Goals: Help",
      goalEmbedColour
    );
    const goalHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
    const goalCommand = args[0].toLowerCase();
    const goalActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${goalCommand} help\``;
    let goalType = args[1] ? args[1].toLowerCase() : false;
    let totalGoalNumber = await Goal.find({
      userID: authorID,
      archived: false,
    }).countDocuments();
    let totalArchiveNumber = await Goal.find({
      userID: authorID,
      archived: true,
    }).countDocuments();
    const archiveRegex = /^(archive[ds]?|arch|ar?)$/i;
    let isArchived = archiveRegex.test(goalType);
    const archiveShift = isArchived ? 1 : 0;
    console.log({ isArchived, archiveShift });

    if (goalCommand === "help") return message.channel.send(goalUsageMessage);
    else if (
      goalCommand === "start" ||
      goalCommand === "create" ||
      goalCommand === "s" ||
      goalCommand === "st" ||
      goalCommand === "set" ||
      goalCommand === "c" ||
      goalCommand === "make" ||
      goalCommand === "m" ||
      goalCommand === "add"
    ) {
      if (tier === 1) {
        if (totalGoalNumber >= goalMax) {
          return message.channel.send(
            fn
              .getMessageEmbed(
                fn.getTierMaxMessage(
                  PREFIX,
                  commandUsed,
                  goalMax,
                  ["Goal", "Goals"],
                  1,
                  false
                ),
                `Long-Term Goal: Tier 1 Maximum`,
                goalEmbedColour
              )
              .setFooter(fn.premiumFooterText)
          );
        }
      }
      /**
       * Iteratively create new long-term goals until the user is finished!
       */

      var goalDocument, reset;
      const additionalInstructions = `Type \`reset\` to **reset** your current long-term goal entry`;
      const additionalKeywords = ["reset"];
      do {
        reset = false;
        const goalType = await fn.userSelectFromList(
          bot,
          message,
          PREFIX,
          areasOfLifeList,
          areasOfLife.length,
          `**__Which area of life does your long-term goal fall under?__** 🌱`,
          `Long-Term Goal: Creation - Area of Life`,
          goalEmbedColour
        );
        if (!goalType && goalType !== 0) return;

        const goalTypeString = `__**Type:**__ ${areasOfLifeEmojis[goalType]} **${areasOfLife[goalType]}**`;
        const goalDescription = await fn.getSingleEntryWithCharacterLimit(
          bot,
          message,
          PREFIX,
          `${goalTypeString}\n\n🎯 **What is your __long-term goal__?**\n(Within 250 characters)\n\n*Write a brief and concise description of your goal (in very simple terms), you will get into the specifics in the next few pages.*`,
          `Long-Term Goal: Creation - Set Goal`,
          250,
          "a long-term goal",
          forceSkip,
          goalEmbedColour,
          additionalInstructions,
          additionalKeywords
        );
        if (!goalDescription && goalDescription !== "") return;
        else if (goalDescription === "reset") {
          reset = true;
          continue;
        }

        const goalDescriptionString = `__**Goal:**__${
          goalDescription === "" ? "" : `\n${goalDescription}`
        }`;
        let goalCheckpoints = await fn.getMultilineEntry(
          bot,
          message,
          PREFIX,
          `${goalTypeString}\n${goalDescriptionString}\n\n🏁 **What are some __checkpoints or milestones__ that would indicate progress on this goal?**\n(Within 1000 characters)`,
          `Long-Term Goal: Creation - Checkpoints/Milestones`,
          true,
          goalEmbedColour,
          1000,
          additionalInstructions,
          additionalKeywords
        );
        if (!goalCheckpoints.message && goalCheckpoints.message !== "") return;
        else if (goalCheckpoints.returnVal === "reset") {
          reset = true;
          continue;
        } else goalCheckpoints = goalCheckpoints.message;

        const goalCheckpointsString = `__**Checkpoints:**__${
          goalCheckpoints === "" ? "" : `\n${goalCheckpoints}`
        }`;
        let goalSteps = await fn.getMultilineEntry(
          bot,
          message,
          PREFIX,
          `${goalTypeString}\n${goalDescriptionString}\n\n${goalCheckpointsString}\n\n👣 **What are some __actionable steps__ for this goal?**\n(Within 1000 characters)\n\n**__Examples (from *Atomic Habits* by James Clear):__**`,
          `Long-Term Goal: Creation - Actionable Steps`,
          true,
          goalEmbedColour,
          1000,
          additionalInstructions,
          additionalKeywords
        );
        if (!goalSteps.message && goalSteps.message !== "") return;
        else if (goalSteps.returnVal === "reset") {
          reset = true;
          continue;
        } else goalSteps = goalSteps.message;

        const goalStepsString = `__**Steps:**__${
          goalSteps === "" ? "" : `\n${goalSteps}`
        }`;
        let goalReason = await fn.getMultilineEntry(
          bot,
          message,
          PREFIX,
          `${goalTypeString}\n${goalDescriptionString}\n\n${goalCheckpointsString}\n\n${goalStepsString}\n\n💭 **__Why__ do you want to accomplish this goal?**\n(Within 1000 characters)`,
          `Long-Term Goal: Creation - Reason`,
          true,
          goalEmbedColour,
          1000,
          additionalInstructions,
          additionalKeywords
        );
        if (!goalReason.message && goalReason.message !== "") return;
        else if (goalReason.returnVal === "reset") {
          reset = true;
          continue;
        } else goalReason = goalReason.message;

        const timeField = ["started", "plan to have finished"];
        let time = [undefined, undefined];
        for (let i = 0; i < 2; i++) {
          do {
            let goalsTimePrompt = `**Please enter the date and time when you __${
              timeField[i]
            }__ this goal:**\n${i === 0 ? timeExamples : futureTimeExamples}`;
            let timeInput = await fn.getSingleEntry(
              bot,
              message,
              PREFIX,
              goalsTimePrompt,
              "Long-Term Goal: Creation - Set Time",
              forceSkip,
              goalEmbedColour,
              additionalInstructions,
              additionalKeywords
            );
            if (!timeInput) return;
            else if (timeInput === "reset") {
              reset = true;
              break;
            }
            timeInput = timeInput.toLowerCase().split(/[\s\n]+/);
            const now = Date.now();
            timeInput = fn.timeCommandHandlerToUTC(
              timeInput,
              now,
              timezoneOffset,
              daylightSaving
            );
            if (!timeInput && timeInput !== 0) {
              fn.sendReplyThenDelete(
                message,
                `**INVALID DATE/TIME**...`,
                60000
              );
              continue;
            } else time[i] = timeInput - HOUR_IN_MS * timezoneOffset;
          } while (!time[i]);
          if (reset) break;
        }
        if (reset) continue;
        console.log({ time });

        console.log(
          `Start: ${fn.timestampToDateString(
            time[0]
          )}\nEnd: ${fn.timestampToDateString(time[1])}`
        );
        if (
          fn.endTimeAfterStartTime(message, time[0], time[1], "Long-Term Goal")
        ) {
          goalDocument = new Goal({
            _id: mongoose.Types.ObjectId(),
            userID: authorID,
            completed: false,
            archived: false,
            start: time[0],
            end: time[1],
            type: goalType,
            description: goalDescription,
            checkpoints: goalCheckpoints,
            steps: goalSteps,
            reason: goalReason,
          });
          await goalDocument
            .save()
            .then(async (result) => {
              console.log({ result });
              totalGoalNumber++;
              message.reply(
                `**Long-Term Goal ${await getGoalIndexByFunction(
                  authorID,
                  goalDocument._id,
                  totalGoalNumber,
                  false,
                  getOneGoalByStartTime
                )} Saved!**`
              );
            })
            .catch((err) => console.error(err));

          // Setup end reminders!
          const confirmEndReminders = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            "__Would you like to be **notified before this goal ends?:**__\n\n**1 year, 6 months, 1 month, 1 week, and 1 day before**",
            false,
            "Long-Term Goal: Goal End Notification",
            180000
          );
          if (confirmEndReminders) {
            await setGoalEndingReminders(
              bot,
              authorID,
              timezoneOffset,
              commandUsed,
              goalDocument._id,
              goalDescription,
              time[0],
              message.createdAt,
              time[1]
            );
          }
        } else if (confirmEndReminders === null) return;

        // Setup reminder!
        const confirmGoalsReminder = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          "__**Would you like recurring reminders of your goal so you don't forget about your important goals?**__\n\n(The more you see your goals, the more you act in such a way that faciliates progress towards your goals)\n\nRecommended: `Weekly`, `Bi-Weekly`, or `Monthly` Goal Reminders",
          false,
          "Long-Term Goal: Reminders",
          180000
        );
        if (confirmGoalsReminder) {
          const setGoalsReminder = await setUserGoalsReminder(
            bot,
            message,
            PREFIX,
            timezoneOffset,
            daylightSaving,
            forceSkip,
            authorID,
            goalHelpMessage
          );
          if (setGoalsReminder === null) return;
        } else if (confirmGoalsReminder === null) return;

        let habits = await Habit.find(
          { userID: authorID, archived: false },
          { _id: 1, description: 1, areaOfLife: 1 }
        );
        if (habits)
          if (habits.length) {
            const connectHabits = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              "Would you like to **connect habits** to this goal? 🔗",
              false,
              "Long-Term Goal: Connect Habits",
              180000
            );
            if (connectHabits) {
              do {
                let habitList = "";
                habits.forEach((habit, i) => {
                  habitList += `\`${i + 1}\` - ${
                    areasOfLifeEmojis[habit.areaOfLife]
                  } **${areasOfLife[habit.areaOfLife]}**\n${
                    habit.description
                  }\n`;
                });

                let targetHabitIndex = await fn.userSelectFromList(
                  bot,
                  message,
                  PREFIX,
                  habitList,
                  habits.length,
                  "__**Which habit would you like to connect to this goal?:**__",
                  "Long-Term Goal: Habit Connection Selection",
                  goalEmbedColour,
                  600000,
                  0
                );
                if (!targetHabitIndex) break;
                const targetHabit = habits[targetHabitIndex];
                await Habit.updateOne(
                  { _id: targetHabit._id },
                  { $set: { connectedGoal: goalDocument._id } }
                );
                const confirmEnd = await fn.getUserConfirmation(
                  bot,
                  message,
                  PREFIX,
                  `**Is there __another habit__ you would like to connect to this goal?** 🔗`,
                  forceSkip,
                  "Long-Term Goal: Another Habit Connection"
                );
                if (!confirmEnd) break;
              } while (true);
            } else if (connectHabits === null) return;
          }
        const createAnother = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          "Would you like to create another **long-term goal?**",
          false,
          "Long-Term Goal: Create Another",
          180000
        );
        console.log({ createAnother });
        if (!createAnother) return;
        else reset = true;
      } while (reset);
      return;
    } else if (
      goalCommand === "delete" ||
      goalCommand === "remove" ||
      goalCommand === "del" ||
      goalCommand === "d"
    ) {
      /**
       * Allow them to delete any goals - archived or not
       */

      let goalDeleteUsageMessage = getGoalReadOrDeleteHelp(
        PREFIX,
        commandUsed,
        goalCommand
      );
      goalDeleteUsageMessage = fn.getMessageEmbed(
        goalDeleteUsageMessage,
        "Long-Term Goal: Delete Help",
        goalEmbedColour
      );
      const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see ${
        isArchived ? `archive ` : ""
      }help\``;

      if (goalType) {
        if (goalType === "help") {
          return message.channel.send(goalDeleteUsageMessage);
        }
        if (!totalGoalNumber && !isArchived) {
          return message.reply(
            `**NO GOALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (!totalArchiveNumber && isArchived) {
          return message.reply(
            `**NO ARCHIVED GOALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        }
      } else return message.reply(goalActionHelpMessage);

      // delete past #:
      if (args[2 + archiveShift] !== undefined) {
        const deleteType = args[1 + archiveShift]
          ? args[1 + archiveShift].toLowerCase()
          : false;
        if (deleteType === "past") {
          // If the following argument is not a number, exit!
          if (isNaN(args[2 + archiveShift])) {
            return fn.sendErrorMessageAndUsage(message, goalActionHelpMessage);
          }
          var numberArg = parseInt(args[2 + archiveShift]);
          if (numberArg <= 0) {
            return fn.sendErrorMessageAndUsage(message, goalActionHelpMessage);
          }
          let indexByRecency = false;
          if (args[3 + archiveShift] !== undefined) {
            if (args[3 + archiveShift].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          const sortType = indexByRecency ? "By Recency" : "By Start Time";
          var goalCollection;
          if (indexByRecency)
            goalCollection = await fn.getEntriesByRecency(
              Goal,
              { userID: authorID, archived: isArchived },
              0,
              numberArg
            );
          else
            goalCollection = await getGoalsByStartTime(
              authorID,
              0,
              numberArg,
              isArchived
            );
          const goalArray = fn.getEmbedArray(
            multipleGoalsToStringArray(
              bot,
              message,
              goalCollection,
              numberArg,
              0
            ),
            "",
            true,
            false,
            goalEmbedColour
          );
          const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} goals?**`;
          const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            goalArray,
            multipleDeleteMessage,
            forceSkip,
            `Long-Term Goal${
              isArchived ? ` Archive` : ""
            }: Delete Past ${numberArg} Goals (${sortType})`,
            600000
          );
          if (!multipleDeleteConfirmation) return;
          const targetIDs = await goalCollection.map((entry) => entry._id);
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Goals (${sortType})`
          );
          targetIDs.forEach((id) => {
            rm.cancelReminderById(id);
          });
          await del.deleteManyByIDAndConnectedReminders(Goal, targetIDs);
          if (targetIDs)
            if (targetIDs.length) {
              await Habit.updateMany(
                { connectedGoal: { $in: { targetIDs } } },
                { $set: { connectedGoal: undefined } }
              );
            }
          return;
        }
        if (deleteType === "many") {
          if (args[2 + archiveShift] === undefined) {
            return message.reply(goalActionHelpMessage);
          }
          // Get the arguments after keyword MANY
          // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
          // Convert String of Numbers array into Integer array
          // Check which goals exist, remove/don't add those that don't
          let toDelete = args[2 + archiveShift].split(",").filter((index) => {
            if (!isNaN(index)) {
              numberIndex = parseInt(index);
              if (numberIndex > 0 && numberIndex <= totalGoalNumber) {
                return numberIndex;
              }
            } else if (index === "recent") {
              return true;
            }
          });
          const recentIndex = await getRecentGoalIndex(authorID, isArchived);
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
              }goals DO NOT exist**...`
            );
          }
          var indexByRecency = false;
          if (args[3 + archiveShift] !== undefined) {
            if (args[3 + archiveShift].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          var goalTargetIDs = new Array();
          var habits = new Array();
          for (let i = 0; i < toDelete.length; i++) {
            var goalView;
            if (indexByRecency) {
              goalView = await getOneGoalByRecency(
                authorID,
                toDelete[i] - 1,
                isArchived
              );
            } else {
              goalView = await getOneGoalByStartTime(
                authorID,
                toDelete[i] - 1,
                isArchived
              );
            }
            goalTargetIDs.push(goalView._id);
            habits.push(
              `__**Goal ${toDelete[i]}:**__ ${goalDocumentToString(
                bot,
                goalView
              )}`
            );
          }
          const deleteConfirmMessage = `Are you sure you want to **delete goals ${toDelete.toString()}?**`;
          const sortType = indexByRecency ? "By Recency" : "By Start Time";
          habits = fn.getEmbedArray(habits, "", true, false, goalEmbedColour);
          const confirmDeleteMany = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            habits,
            deleteConfirmMessage,
            forceSkip,
            `Long-Term Goal${
              isArchived ? ` Archive` : ""
            }: Delete Goals ${toDelete} (${sortType})`,
            600000
          );
          if (confirmDeleteMany) {
            console.log(
              `Deleting ${authorID}'s Goals ${toDelete} (${sortType})`
            );
            goalTargetIDs.forEach((id) => {
              rm.cancelReminderById(id);
            });
            await del.deleteManyByIDAndConnectedReminders(Goal, goalTargetIDs);
            if (goalTargetIDs)
              if (goalTargetIDs.length) {
                await Habit.updateMany(
                  { connectedGoal: { $in: { goalTargetIDs } } },
                  { $set: { connectedGoal: undefined } }
                );
              }
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
                  skipEntries = await getRecentGoalIndex(authorID, isArchived);
                } else return message.reply(goalActionHelpMessage);
              } else
                skipEntries = parseInt(args[3 + archiveShift + shiftIndex]);
              const pastNumberOfEntries = parseInt(args[1 + archiveShift]);
              if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                return fn.sendErrorMessageAndUsage(
                  message,
                  goalActionHelpMessage
                );
              }
              var goalCollection;
              if (indexByRecency)
                goalCollection = await fn.getEntriesByRecency(
                  Goal,
                  { userID: authorID, archived: isArchived },
                  skipEntries,
                  pastNumberOfEntries
                );
              else
                goalCollection = await getGoalsByStartTime(
                  authorID,
                  skipEntries,
                  pastNumberOfEntries,
                  isArchived
                );
              const goalArray = fn.getEmbedArray(
                multipleGoalsToStringArray(
                  bot,
                  message,
                  goalCollection,
                  pastNumberOfEntries,
                  skipEntries
                ),
                "",
                true,
                false,
                goalEmbedColour
              );
              if (skipEntries >= totalGoalNumber) return;
              const sortType = indexByRecency ? "By Recency" : "By Start Time";
              const multipleDeleteMessage = `Are you sure you want to **delete ${goalCollection.length} goals past goal ${skipEntries}?**`;
              const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
                bot,
                message,
                PREFIX,
                goalArray,
                multipleDeleteMessage,
                forceSkip,
                `Long-Term Goal${
                  isArchived ? ` Archive` : ""
                }: Multiple Delete Warning! (${sortType})`
              );
              console.log({ multipleDeleteConfirmation });
              if (!multipleDeleteConfirmation) return;
              const targetIDs = await goalCollection.map((entry) => entry._id);
              console.log(
                `Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} goals past ${skipEntries} (${sortType})`
              );
              targetIDs.forEach((id) => {
                rm.cancelReminderById(id);
              });
              await del.deleteManyByIDAndConnectedReminders(Goal, targetIDs);
              if (targetIDs)
                if (targetIDs.length) {
                  await Habit.updateMany(
                    { connectedGoal: { $in: { targetIDs } } },
                    { $set: { connectedGoal: undefined } }
                  );
                }
              return;
            }

            // They haven't specified the field for the goal delete past function
            else if (deleteType === "past")
              return message.reply(goalActionHelpMessage);
            else return message.reply(goalActionHelpMessage);
          }
        }
      }
      // Next: GOAL DELETE ALL
      // Next: GOAL DELETE MANY
      // Next: GOAL DELETE

      // goal delete <NUMBER/RECENT/ALL>
      const noGoalsMessage = `**NO ${
        isArchived ? "ARCHIVED " : ""
      }GOALS**... try \`${PREFIX}${commandUsed} start help\``;
      if (isNaN(args[1 + archiveShift])) {
        const deleteType = goalType;
        if (deleteType === "recent") {
          const goalView = await getOneGoalByRecency(authorID, 0, isArchived);
          if (!goalView) return fn.sendErrorMessage(message, noGoalsMessage);
          const goalTargetID = goalView._id;
          console.log({ goalTargetID });
          const goalIndex = await getRecentGoalIndex(authorID, isArchived);
          const goalEmbed = fn.getEmbedArray(
            `__**Goal ${goalIndex}:**__ ${goalDocumentToString(bot, goalView)}`,
            `Long-Term Goal${isArchived ? ` Archive` : ""}: Delete Recent Goal`,
            true,
            false,
            goalEmbedColour
          );
          const deleteConfirmMessage = `Are you sure you want to **delete your most recent goal?:**`;
          const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            goalEmbed,
            deleteConfirmMessage,
            forceSkip,
            `Long-Term Goal${isArchived ? ` Archive` : ""}: Delete Recent Goal`,
            600000
          );
          if (deleteIsConfirmed) {
            await del.deleteOneByIDAndConnectedReminders(Goal, goalTargetID);
            if (goalTargetID) {
              await Habit.updateMany(
                { connectedGoal: goalTargetID },
                { $set: { connectedGoal: undefined } }
              );
            }
            return;
          }
        } else if (deleteType === "all") {
          const confirmDeleteAllMessage = `Are you sure you want to **delete all** of your recorded goals?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          const pastNumberOfEntriesIndex = totalGoalNumber;
          if (pastNumberOfEntriesIndex === 0) {
            return fn.sendErrorMessage(message, noGoalsMessage);
          }
          let confirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            confirmDeleteAllMessage,
            forceSkip,
            `Long-Term Goal${
              isArchived ? ` Archive` : ""
            }: Delete All Goals WARNING!`
          );
          if (!confirmDeleteAll) return;
          const finalDeleteAllMessage = `Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR GOALS ON RECORD**?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          let finalConfirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            finalDeleteAllMessage,
            `Long-Term Goal${
              isArchived ? ` Archive` : ""
            }: Delete ALL Goals FINAL Warning!`
          );
          if (!finalConfirmDeleteAll) return;

          console.log(
            `Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Goals`
          );
          const allQuery = { userID: authorID };
          await del.deleteManyAndConnectedReminders(Goal, allQuery);
          await Habit.updateMany(allQuery, {
            $set: { connectedGoal: undefined },
          });
          return;
        } else return message.reply(goalActionHelpMessage);
      } else {
        const pastNumberOfEntriesIndex = parseInt(args[1 + archiveShift]);
        let indexByRecency = false;
        if (args[2 + archiveShift] !== undefined) {
          if (args[2 + archiveShift].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }
        var goalView;
        if (indexByRecency)
          goalView = await getOneGoalByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1,
            isArchived
          );
        else
          goalView = await getOneGoalByStartTime(
            authorID,
            pastNumberOfEntriesIndex - 1,
            isArchived
          );
        if (!goalView) {
          return fn.sendErrorMessageAndUsage(
            message,
            trySeeCommandMessage,
            `**${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST**...`
          );
        }
        const goalTargetID = goalView._id;
        const sortType = indexByRecency ? "By Recency" : "By Start Time";
        const goalEmbed = fn.getEmbedArray(
          `__**Goal ${pastNumberOfEntriesIndex}:**__ ${goalDocumentToString(
            bot,
            goalView
          )}`,
          `Long-Term Goal${
            isArchived ? ` Archive` : ""
          }: Delete Goal ${pastNumberOfEntriesIndex} (${sortType})`,
          true,
          false,
          goalEmbedColour
        );
        const deleteConfirmMessage = `Are you sure you want to **delete Goal ${pastNumberOfEntriesIndex}?**`;
        const deleteConfirmation = await fn.getPaginatedUserConfirmation(
          bot,
          message,
          PREFIX,
          goalEmbed,
          deleteConfirmMessage,
          forceSkip,
          `Long-Term Goal${
            isArchived ? ` Archive` : ""
          }: Delete Goal ${pastNumberOfEntriesIndex} (${sortType})`,
          600000
        );
        if (deleteConfirmation) {
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Goal ${sortType}`
          );
          await del.deleteOneByIDAndConnectedReminders(Goal, goalTargetID);
          if (goalTargetID) {
            await Habit.updateMany(
              { connectedGoal: goalTargetID },
              { $set: { connectedGoal: undefined } }
            );
          }
          return;
        }
      }
    } else if (goalCommand === "see" || goalCommand === "show") {
      let goalSeeUsageMessage = getGoalReadOrDeleteHelp(
        PREFIX,
        commandUsed,
        goalCommand
      );
      goalSeeUsageMessage = fn.getMessageEmbed(
        goalSeeUsageMessage,
        `Long-Term Goal${isArchived ? ` Archive` : ""}: See Help`,
        goalEmbedColour
      );

      const seeCommands = ["past", "recent", "all"];

      if (goalType) {
        if (goalType === "help") {
          return message.channel.send(goalSeeUsageMessage);
        }
        if (!totalGoalNumber && !isArchived) {
          return message.reply(
            `**NO GOALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (!totalArchiveNumber && isArchived) {
          return message.reply(
            `**NO ARCHIVED GOALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (
          (args[1 + archiveShift]
            ? args[1 + archiveShift].toLowerCase()
            : false) === "number"
        ) {
          console.log(args[1 + archiveShift].toLowerCase());
          if (isArchived)
            return message.reply(
              `You have **${totalArchiveNumber} archived goal entries** on record.`
            );
          else
            return message.reply(
              `You have **${totalGoalNumber} goal entries** on record.`
            );
        }
      } else return message.reply(goalActionHelpMessage);

      // Show the user the last goal with the most recent end time (by sorting from largest to smallest end time and taking the first):
      // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort.
      // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
      if (
        !seeCommands.includes(goalType) &&
        !archiveRegex.test(goalType) &&
        isNaN(goalType)
      ) {
        return message.reply(goalActionHelpMessage);
      }
      // Do not show the most recent goal embed, when a valid command is called
      // it will be handled properly later based on the values passed in!
      else {
        const seeType = args[1 + archiveShift]
        ? args[1 + archiveShift].toLowerCase()
        : false;
        var pastFunctionality, goalIndex;
        let indexByRecency = false;
        // To check if the given argument is a number!
        // If it's not a number and has passed the initial
        // filter, then use the "past" functionality
        // Handling Argument 1:
        const isNumberArg = !isNaN(args[1 + archiveShift]);
        if (seeType === "recent") {
          return message.channel.send(
            await getRecentGoal(bot, authorID, isArchived, goalEmbedColour)
          );
        } else if (seeType === "all") {
          if (isArchived) {
            if (totalArchiveNumber) {
              goalIndex = totalArchiveNumber;
            }
          } else {
            if (totalGoalNumber) {
              goalIndex = totalGoalNumber;
            }
          }
          pastFunctionality = true;
          if (goalIndex === undefined) {
            return fn.sendErrorMessageAndUsage(
              message,
              goalActionHelpMessage,
              `**You have NO ${isArchived ? "ARCHIVED " : ""}GOALS**...`
            );
          }
        } else if (isNumberArg) {
          goalIndex = parseInt(args[1 + archiveShift]);
          if (goalIndex <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              goalActionHelpMessage,
              `**${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST**...`
            );
          } else pastFunctionality = false;
        } else if (seeType === "past") {
          pastFunctionality = true;
        }
        // After this filter:
        // If the first argument after "see" is not past, then it is not a valid call
        else return message.reply(goalActionHelpMessage);
        console.log({ pastNumberOfEntriesIndex: goalIndex, pastFunctionality });
        if (pastFunctionality) {
          // Loop through all of the given fields, account for aliases and update fields
          // Find Goals, toArray, store data in meaningful output
          if (args[3 + archiveShift] !== undefined) {
            if (args[3 + archiveShift].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          const sortType = indexByRecency ? "By Recency" : "By Start Time";
          if (args[2 + archiveShift] !== undefined) {
            // If the next argument is NotaNumber, invalid "past" command call
            if (isNaN(args[2 + archiveShift]))
              return message.reply(goalActionHelpMessage);
            if (parseInt(args[2 + archiveShift]) <= 0)
              return message.reply(goalActionHelpMessage);
            const confirmSeeMessage = `Are you sure you want to **see ${
              args[2 + archiveShift]
            } goals?**`;
            let confirmSeeGoals = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeMessage,
              forceSkip,
              `Long-Term Goal${isArchived ? ` Archive` : ""}: See ${
                args[2 + archiveShift]
              } Goals (${sortType})`
            );
            if (!confirmSeeGoals) return;
          } else {
            // If the next argument is undefined, implied "see all" command call unless "all" was not called:
            // => empty "past" command call
            if (seeType !== "all") return message.reply(goalActionHelpMessage);
            const confirmSeeAllMessage =
              "Are you sure you want to **see all** of your goal history?";
            let confirmSeeAll = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeAllMessage,
              forceSkip,
              `Long-Term Goal${isArchived ? ` Archive` : ""}: See All Goals`
            );
            if (!confirmSeeAll) return;
          }
          // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
          if (goalIndex === undefined) {
            goalIndex = parseInt(args[2 + archiveShift]);
          }
          var goalView;
          if (indexByRecency)
            goalView = await fn.getEntriesByRecency(
              Goal,
              { userID: authorID, archived: isArchived },
              0,
              goalIndex
            );
          else
            goalView = await getGoalsByStartTime(
              authorID,
              0,
              goalIndex,
              isArchived
            );
          console.log({ goalView, pastNumberOfEntriesIndex: goalIndex });
          const goalArray = multipleGoalsToStringArray(
            bot,
            message,
            goalView,
            goalIndex,
            0
          );
          await fn.sendPaginationEmbed(
            bot,
            message.channel.id,
            authorID,
            fn.getEmbedArray(
              goalArray,
              `Long-Term Goal${
                isArchived ? ` Archive` : ""
              }: See ${goalIndex} Goals (${sortType})`,
              true,
              `Goals ${fn.timestampToDateString(
                Date.now() + timezoneOffset * HOUR_IN_MS,
                false,
                false,
                true,
                true
              )}`,
              goalEmbedColour
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
                  : "By Start Time";
                var entriesToSkip;
                // If the argument after past is a number, valid command call!
                if (!isNaN(args[3 + archiveShift + shiftIndex])) {
                  entriesToSkip = parseInt(args[3 + archiveShift + shiftIndex]);
                } else if (
                  args[3 + archiveShift + shiftIndex].toLowerCase() === "recent"
                ) {
                  entriesToSkip = await getRecentGoal(
                    bot,
                    authorID,
                    isArchived,
                    goalEmbedColour
                  );
                } else return message.reply(goalActionHelpMessage);
                if (entriesToSkip < 0 || entriesToSkip > totalGoalNumber) {
                  return fn.sendErrorMessageAndUsage(
                    message,
                    goalActionHelpMessage,
                    `**${
                      isArchived ? "ARCHIVED " : ""
                    }GOAL(S) DO NOT EXIST**...`
                  );
                }
                const confirmSeePastMessage = `Are you sure you want to **see ${
                  args[1 + archiveShift]
                } entries past ${entriesToSkip}?**`;
                const confirmSeePast = await fn.getUserConfirmation(
                  bot,
                  message,
                  PREFIX,
                  confirmSeePastMessage,
                  forceSkip,
                  `Long-Term Goal${isArchived ? ` Archive` : ""}: See ${
                    args[1 + archiveShift]
                  } Goals Past ${entriesToSkip} (${sortType})`
                );
                if (!confirmSeePast) return;
                var goalView;
                if (indexByRecency)
                  goalView = await fn.getEntriesByRecency(
                    Goal,
                    { userID: authorID, archived: isArchived },
                    entriesToSkip,
                    goalIndex
                  );
                else
                  goalView = await getGoalsByStartTime(
                    authorID,
                    entriesToSkip,
                    goalIndex,
                    isArchived
                  );
                console.log({ goalView });
                const goalStringArray = multipleGoalsToStringArray(
                  bot,
                  message,
                  goalView,
                  goalIndex,
                  entriesToSkip
                );
                await fn.sendPaginationEmbed(
                  bot,
                  message.channel.id,
                  authorID,
                  fn.getEmbedArray(
                    goalStringArray,
                    `Long-Term Goal${
                      isArchived ? ` Archive` : ""
                    }: See ${goalIndex} Goals Past ${entriesToSkip} (${sortType})`,
                    true,
                    `Goals ${fn.timestampToDateString(
                      Date.now() + timezoneOffset * HOUR_IN_MS,
                      false,
                      false,
                      true,
                      true
                    )}`,
                    goalEmbedColour
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
        var goalView;
        if (indexByRecency)
          goalView = await getOneGoalByRecency(
            authorID,
            goalIndex - 1,
            isArchived
          );
        else
          goalView = await getOneGoalByStartTime(
            authorID,
            goalIndex - 1,
            isArchived
          );
        console.log({ goalView });
        if (!goalView) {
          return fn.sendErrorMessage(
            message,
            `**${
              isArchived ? "ARCHIVED " : ""
            }GOAL ${goalIndex} DOES NOT EXIST**...`
          );
        }
        // NOT using the past functionality:
        const sortType = indexByRecency ? "By Recency" : "By Start Time";
        const goalString = `__**Goal ${goalIndex}:**__ ${goalDocumentToString(
          bot,
          goalView
        )}`;
        const goalEmbed = fn.getEmbedArray(
          goalString,
          `Long-Term Goal${
            isArchived ? ` Archive` : ""
          }: See Goal ${goalIndex} (${sortType})`,
          true,
          `Goal ${fn.timestampToDateString(
            Date.now() + timezoneOffset * HOUR_IN_MS,
            false,
            false,
            true,
            true
          )}`,
          goalEmbedColour
        );
        await fn.sendPaginationEmbed(
          bot,
          message.channel.id,
          authorID,
          goalEmbed
        );
      }
    } else if (
      goalCommand === "edit" ||
      goalCommand === "change" ||
      goalCommand === "ed" ||
      goalCommand === "ch" ||
      goalCommand === "c"
    ) {
      let goalEditUsageMessage =
        `**USAGE:**\n\`${PREFIX}${commandUsed} ${goalCommand} <archive?> <GOAL #> <recent?> <force?>\`` +
        `\n\n\`<GOAL #>\`: **recent; 3** (3rd most recent entry, \\**any number*)\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived goals!**\n\n\`<recent?>\`(OPT.): type **recent** at the indicated spot to sort the goals by **actual time created instead of goal start time!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      goalEditUsageMessage = fn.getMessageEmbed(
        goalEditUsageMessage,
        `Long-Term Goal: Edit Help`,
        goalEmbedColour
      );
      if (goalType) {
        if (goalType === "help") {
          return message.channel.send(goalEditUsageMessage);
        }
        if (!totalGoalNumber && !isArchived) {
          return message.reply(
            `**NO GOALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (!totalArchiveNumber && isArchived) {
          return message.reply(
            `**NO ARCHIVED GOALS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        }
        if (
          isNaN(goalType) &&
          goalType !== "recent" &&
          !archiveRegex.test(goalType)
        ) {
          return message.reply(goalActionHelpMessage);
        }
      }
      goalType = isArchived
        ? args[2]
          ? args[2].toLowerCase()
          : false
        : goalType;
      if (goalType) {
        var goalIndex;
        if (goalType === "recent") {
          goalIndex = await getRecentGoalIndex(authorID, isArchived);
        } else {
          goalIndex = parseInt(goalType);
          if (goalIndex <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              goalActionHelpMessage,
              `**${isArchived ? "ARCHIVED " : ""}GOAL DOES NOT EXIST**...`
            );
          }
        }

        var indexByRecency = false;
        if (args[2 + archiveShift] !== undefined) {
          if (args[2 + archiveShift].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }
        var goalDocument;
        if (indexByRecency)
          goalDocument = await getOneGoalByRecency(
            authorID,
            goalIndex - 1,
            isArchived
          );
        else
          goalDocument = await getOneGoalByStartTime(
            authorID,
            goalIndex - 1,
            isArchived
          );
        if (!goalDocument) {
          return fn.sendErrorMessageAndUsage(
            message,
            goalActionHelpMessage,
            `**${
              isArchived ? "ARCHIVED " : ""
            }GOAL ${goalIndex} DOES NOT EXIST**...`
          );
        }
        const sortType = indexByRecency ? "By Recency" : "By Start Time";
        var goalFields = [
          "Start Time",
          "End Time",
          "Area of Life",
          "Description",
          "Reason",
          "Checkpoints",
          "Actionable Steps",
          "Completed",
          "Archived",
        ];
        const goalTargetID = goalDocument._id;
        var showGoal, continueEdit;
        do {
          const initialEditTimestamp = Date.now();
          const checkGoal = await getOneGoalByObjectID(goalTargetID);
          if (!checkGoal) return;
          continueEdit = false;
          showGoal = goalDocumentToString(bot, goalDocument);
          // Field the user wants to edit
          const fieldToEditInstructions =
            "**Which field do you want to edit?**";
          const fieldToEditAdditionalMessage = `__**Goal ${goalIndex} (${sortType}):**__ ${showGoal}`;
          const fieldToEditTitle = `Long-Term Goal${
            isArchived ? " Archive" : ""
          }: Edit Field`;
          var fieldToEdit, fieldToEditIndex;
          const selectedField = await fn.getUserSelectedObject(
            bot,
            message,
            PREFIX,
            fieldToEditInstructions,
            fieldToEditTitle,
            goalFields,
            "",
            false,
            goalEmbedColour,
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
            goalEditMessagePrompt = "";
          const titleType = `Long-Term Goal${isArchived ? " Archive" : ""}`;
          let {
            completed,
            archived,
            type,
            description,
            reason,
            steps,
            checkpoints,
            start,
            end,
          } = goalDocument;
          switch (fieldToEditIndex) {
            case 0:
              goalEditMessagePrompt = `\n__**Please enter the date/time of when you started this goal:**__ ⌚\n${timeExamples}`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                goalEditMessagePrompt,
                titleType,
                forceSkip,
                goalEmbedColour
              );
              break;
            case 1:
              goalEditMessagePrompt = `\n__**Please enter the date/time of when you ended or intend to end this goal:**__ ⌚\n${timeExamples}`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                goalEditMessagePrompt,
                titleType,
                forceSkip,
                goalEmbedColour
              );
              break;
            case 2:
              goalEditMessagePrompt = `\n**__Which area of life does your long-term goal fall under?__ 🌱**\n${areasOfLifeList}`;
              userEdit = await fn.getUserEditNumber(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                areasOfLife.length,
                titleType,
                areasOfLifeCombinedEmoji,
                forceSkip,
                goalEmbedColour,
                goalEditMessagePrompt
              );
              if (!userEdit && userEdit !== 0) return;
              else if (userEdit === "back") break;
              else {
                userEdit--; // Minus 1 for array offset
                type = userEdit;
              }
              break;
            case 3:
              goalEditMessagePrompt =
                "\n🎯 **What is your __long-term goal__?**\n(Within 250 characters)";
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                goalEditMessagePrompt,
                titleType,
                forceSkip,
                goalEmbedColour,
                250
              );
              description = userEdit;
              break;
            case 4:
              goalEditMessagePrompt =
                "\n💭 **__Why__ do you want to accomplish this goal?**\n(Within 1000 characters)";
              userEdit = await fn.getUserMultilineEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                goalEditMessagePrompt,
                titleType,
                forceSkip,
                goalEmbedColour,
                1000
              );
              reason = userEdit;
              break;
            case 5:
              goalEditMessagePrompt =
                "\n🏁 **What are some __checkpoints__ that would indicate progress on this goal?**\n(Within 1000 characters)";
              userEdit = await fn.getUserMultilineEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                goalEditMessagePrompt,
                titleType,
                forceSkip,
                goalEmbedColour,
                1000
              );
              checkpoints = userEdit;
              break;
            case 6:
              goalEditMessagePrompt =
                "\n👣 **What are some __actionable steps__ for this goal?**\n(Within 1000 characters)";
              userEdit = await fn.getUserMultilineEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                goalEditMessagePrompt,
                titleType,
                forceSkip,
                goalEmbedColour,
                1000
              );
              steps = userEdit;
              break;
            case 7:
              goalEditMessagePrompt = `\n**__Currently:__ ${
                completed ? "Completed" : "In Progress"
              }\n\n✅ - Completed\n\n🏃‍♂️ - In Progress**`;
              userEdit = await fn.getUserEditBoolean(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                goalEditMessagePrompt,
                ["✅", "🏃‍♂️"],
                titleType,
                forceSkip,
                goalEmbedColour
              );
              break;
            case 8:
              goalEditMessagePrompt = `\n**__Currently:__ ${
                archived ? "Archived" : "NOT Archived"
              }\n\n📁 - Archive\n\n📜 - No Archive**`;
              userEdit = await fn.getUserEditBoolean(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                goalEditMessagePrompt,
                ["📁", "📜"],
                titleType,
                forceSkip,
                goalEmbedColour
              );
              break;
          }
          console.log({ userEdit });
          if (userEdit === false) return;
          else if (userEdit === undefined) userEdit = "back";
          else if (userEdit !== "back") {
            // Parse User Edit
            if (fieldToEditIndex === 0 || fieldToEditIndex === 1) {
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
                  `**INVALID TIME**... ${goalHelpMessage}`,
                  60000
                );
                continueEdit = true;
              }
              switch (fieldToEditIndex) {
                case 0:
                  start = userEdit;
                  break;
                case 1:
                  end = userEdit;
                  break;
                default:
                  continueEdit = true;
                  break;
              }
            } else if (fieldToEditIndex === 7) {
              switch (userEdit) {
                case "✅":
                  userEdit = true;
                  break;
                case "🏃‍♂️":
                  userEdit = false;
                  break;
                default:
                  continueEdit = true;
                  break;
              }
              completed = userEdit;
            } else if (fieldToEditIndex === 8) {
              switch (userEdit) {
                case "📁":
                  userEdit = true;
                  break;
                case "📜":
                  userEdit = false;
                  break;
                default:
                  continueEdit = true;
                  break;
              }
              archived = userEdit;
              isArchived = userEdit;
            }
          } else continueEdit = true;
          console.log({ userEdit });
          if (!continueEdit) {
            try {
              console.log(
                `Editing ${authorID}'s Goal ${goalIndex} (${sortType})`
              );
              goalDocument = await Goal.findOneAndUpdate(
                { _id: goalTargetID },
                {
                  $set: {
                    completed,
                    archived,
                    type,
                    description,
                    reason,
                    steps,
                    checkpoints,
                    start,
                    end,
                  },
                },
                { new: true }
              );
              console.log({ continueEdit });
              if (goalDocument) {
                if (
                  fieldToEditIndex === 0 ||
                  fieldToEditIndex === 1 ||
                  fieldToEditIndex === 3 ||
                  fieldToEditIndex === 7 ||
                  fieldToEditIndex === 8
                ) {
                  if (goalTargetID) {
                    rm.cancelRemindersByConnectedDocument(goalTargetID);
                    const removeOldReminders = await Reminder.deleteMany({
                      connectedDocument: goalTargetID,
                    });
                    if (removeOldReminders)
                      if (removeOldReminders.deletedCount > 0) {
                        if (
                          fieldToEditIndex === 0 ||
                          fieldToEditIndex === 1 ||
                          fieldToEditIndex === 3 ||
                          (fieldToEditIndex === 7 && completed === false) ||
                          (fieldToEditIndex === 8 && archived === false)
                        ) {
                          await setGoalEndingReminders(
                            bot,
                            authorID,
                            timezoneOffset,
                            commandUsed,
                            goalDocument._id,
                            goalDocument.description,
                            goalDocument.start - HOUR_IN_MS * timezoneOffset,
                            initialEditTimestamp,
                            goalDocument.end - HOUR_IN_MS * timezoneOffset
                          );
                        }
                      }
                  }
                }
                goalIndex = indexByRecency
                  ? await getGoalIndexByFunction(
                      authorID,
                      goalTargetID,
                      isArchived ? totalArchiveNumber : totalGoalNumber,
                      isArchived,
                      getOneGoalByRecency
                    )
                  : await getGoalIndexByFunction(
                      authorID,
                      goalTargetID,
                      isArchived ? totalArchiveNumber : totalGoalNumber,
                      isArchived,
                      getOneGoalByStartTime
                    );
                console.log({ goalDocument, goalTargetID, fieldToEditIndex });
                showGoal = goalDocumentToString(bot, goalDocument);
                const continueEditMessage = `Do you want to continue **editing Goal ${goalIndex}?:**\n\n__**Goal ${goalIndex}:**__ ${showGoal}`;
                continueEdit = await fn.getUserConfirmation(
                  bot,
                  message,
                  PREFIX,
                  continueEditMessage,
                  forceSkip,
                  `Long-Term Goal${
                    isArchived ? " Archive" : ""
                  }: Continue Editing Goal ${goalIndex}?`,
                  300000
                );
              } else {
                message.reply("**Goal not found...**");
                continueEdit = false;
              }
            } catch (err) {
              return console.log(err);
            }
          } else {
            console.log({ continueEdit, userEdit });
            goalDocument = await Goal.findById(goalTargetID);
            if (goalDocument) {
              goalIndex = indexByRecency
                ? await getGoalIndexByFunction(
                    authorID,
                    goalTargetID,
                    isArchived ? totalArchiveNumber : totalGoalNumber,
                    isArchived,
                    getOneGoalByStartTime
                  )
                : await getGoalIndexByFunction(
                    authorID,
                    goalTargetID,
                    isArchived ? totalArchiveNumber : totalGoalNumber,
                    isArchived,
                    getOneGoalByRecency
                  );
              console.log({ goalDocument, goalTargetID, fieldToEditIndex });
              showGoal = goalDocumentToString(bot, goalDocument);
            } else {
              message.reply(
                `**${isArchived ? "Archived " : ""}Goal not found...**`
              );
              continueEdit = false;
            }
          }
        } while (continueEdit === true);
        return;
      } else return message.reply(goalActionHelpMessage);
    } else if (goalCommand === "post" || goalCommand === "p") {
      let goals = await Goal.find({ userID: authorID, archived: false }).sort({
        start: +1,
      });
      if (!goals)
        return message.reply(
          `**You don't have any goals**, try \`${PREFIX}${commandUsed} start\``
        );
      const targetChannel = await fn.getTargetChannel(
        bot,
        message,
        PREFIX,
        `Long-Term Goal`,
        forceSkip,
        true,
        false,
        true,
        goalEmbedColour
      );
      if (!targetChannel) return;
      const member = bot.channels.cache
        .get(targetChannel)
        .guild.member(authorID);
      const goalStringArray = multipleGoalsToStringArray(
        bot,
        message,
        goals,
        totalGoalNumber,
        0
      );
      if (goalStringArray.length)
        goalStringArray[0] = `<@!${authorID}>\n${goalStringArray[0]}`;
      const posts = fn.getEmbedArray(
        goalStringArray,
        `${
          member ? `${member.displayName}'s ` : ""
        }Long-Term Goals (as of ${new Date(
          Date.now() + HOUR_IN_MS * timezoneOffset
        ).getUTCFullYear()})`,
        true,
        false,
        goalEmbedColour
      );
      posts.forEach(async (post) => {
        await fn.sendMessageToChannel(bot, post, targetChannel);
      });
      return;
    } else if (
      goalCommand === "end" ||
      goalCommand === "e" ||
      goalCommand === "complete" ||
      goalCommand === "log"
    ) {
      // (similar indexing to edit, recent or #) + archive
      // Make a list - similar to archive
      let goalEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${goalCommand} <archive?> <recent?> <force?>\`\n\n\`<archive?>\`: (OPT.) type **archive** after the command action to apply your command to your **archived goals!**\n\n\`<recent?>\`(OPT.): type **recent** to order the goals by **actual time created instead of goal start time!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      goalEditUsageMessage = fn.getMessageEmbed(
        goalEditUsageMessage,
        `Long-Term Goal: End Help`,
        goalEmbedColour
      );
      if (goalType === "help")
        return message.channel.send(goalEditUsageMessage);

      var indexByRecency = false;
      if (args[2 + archiveShift] !== undefined) {
        if (args[2 + archiveShift].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }

      do {
        var habits;
        if (indexByRecency)
          habits = await Goal.find(
            { archived: isArchived, completed: false },
            { _id: 1, description: 1 }
          ).sort({ _id: -1 });
        else
          habits = await Goal.find(
            { archived: isArchived, completed: false },
            { _id: 1, description: 1 }
          ).sort({ start: +1 });
        if (!habits.length)
          return message.reply(
            `**No ${
              isArchived ? "archived " : ""
            }goals** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
          );

        let targetGoal = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          "__**Which goal would you like to end?:**__",
          `Long-Term Goal${isArchived ? " Archive" : ""}: End Selection`,
          habits,
          "description",
          false,
          goalEmbedColour,
          600000
        );
        if (!targetGoal) return;
        else targetGoal = targetGoal.object;

        const confirmEnd = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          `**Are you sure you want to mark this goal as complete?**\n🎯 - __**Description:**__\n${targetGoal.description}`,
          forceSkip,
          `Long-Term Goal${isArchived ? " Archive" : ""}: End Confirmation`
        );
        if (confirmEnd)
          await Goal.updateOne(
            { _id: targetGoal._id },
            {
              $set: {
                completed: true,
                end:
                  fn.getCurrentUTCTimestampFlooredToSecond() +
                  HOUR_IN_MS * timezoneOffset,
              },
            },
            async (err, result) => {
              if (err) return console.error(err);
              console.log({ result });
              if (targetGoal._id) {
                rm.cancelRemindersByConnectedDocument(targetGoal._id);
                await Reminder.deleteMany({
                  connectedDocument: targetGoal._id,
                });
              }
            }
          );
        else continue;
      } while (true);
    } else if (
      goalCommand === "reminder" ||
      goalCommand === "reminders" ||
      goalCommand === "remind" ||
      goalCommand === "remindme" ||
      goalCommand === "rem" ||
      goalCommand === "re" ||
      goalCommand === "r"
    ) {
      const userGoals = await Goal.find({
        userID: authorID,
        archived: false,
      }).sort({ start: +1 });
      if (userGoals)
        if (userGoals.length) {
          var reset;
          do {
            reset = false;

            const selectReminderType = await fn.userSelectFromList(
              bot,
              message,
              PREFIX,
              `\`1\` - Recurring Long-Term Goal Reminders\n\`2\` - Goal Ending Reminders`,
              2,
              `**Please enter the number corresponding to the type of reminder you'd like to set:**`,
              `Long-Term Goal: Reminder Type`,
              goalEmbedColour,
              600000
            );
            if (!selectReminderType && selectReminderType !== 0) return;

            const reminderTypeString = selectReminderType === 1 ? "ending" : "";
            var selectedGoal;
            if (selectReminderType === 1) {
              const selectedGoal = await fn.getUserSelectedObject(
                bot,
                message,
                PREFIX,
                `**Enter the number corresponding to the long-term goal you want ${
                  reminderTypeString ? `${reminderTypeString} ` : ""
                }reminders for:**${
                  selectReminderType === 1
                    ? `\n(1 year, 6 months, 1 month, 1 week, and 1 day before expected goal end time)`
                    : ""
                }`,
                "Long-Term Goal: Select Goal For Reminder",
                userGoals,
                "description",
                false,
                goalEmbedColour,
                600000
              );
              if (!selectedGoal) return;
            }

            if (selectReminderType === 0) {
              const setGoalsReminder = await setUserGoalsReminder(
                bot,
                message,
                PREFIX,
                timezoneOffset,
                daylightSaving,
                forceSkip,
                authorID,
                goalHelpMessage
              );
              if (!setGoalsReminder) return;
            } else if (selectReminderType === 1) {
              const confirmSelection = await fn.getUserConfirmation(
                bot,
                message,
                PREFIX,
                `**Are you sure you want reminders for this long-term goal?**` +
                  `\n(1 year, 6 months, 1 month, 1 week, and 1 day before expected goal end time)\n\n${selectedGoal.object.description}`,
                forceSkip,
                "Long-Term Goal: Goal Reminder Confirmation",
                180000
              );
              if (confirmSelection === false) break;
              else if (confirmSelection === null) return;

              if (selectedGoal.object._id) {
                const currentReminders = await Reminder.find({
                  connectedDocument: selectedGoal.object._id,
                });
                if (currentReminders)
                  if (currentReminders.length) {
                    rm.cancelRemindersByConnectedDocument(
                      selectedGoal.object._id
                    );
                    await Reminder.deleteMany({
                      connectedDocument: selectedGoal.object._id,
                    });
                  }
                await setGoalEndingReminders(
                  bot,
                  authorID,
                  timezoneOffset,
                  commandUsed,
                  selectedGoal.object._id,
                  selectedGoal.object.description,
                  selectedGoal.object.start - HOUR_IN_MS * timezoneOffset,
                  message.createdTimestamp,
                  selectedGoal.object.end - HOUR_IN_MS * timezoneOffset
                );
              }
            }

            const setMoreReminders = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              "Would you like to set another long-term goal reminder?",
              false,
              "Long-Term Goal: Another Reminder",
              180000
            );
            if (!setMoreReminders) return;
            else reset = true;
          } while (reset);
          return;
        }
      return message.reply(
        `**No long-term goals...** Try \`${PREFIX}${commandUsed} start\` to **start** one!`
      );
    } else if (
      archiveRegex.test(goalCommand) ||
      goalCommand === "stash" ||
      goalCommand === "store"
    ) {
      if (tier === 1) {
        if (totalArchiveNumber >= goalArchiveMax) {
          return message.channel.send(
            fn
              .getMessageEmbed(
                fn.getTierMaxMessage(
                  PREFIX,
                  commandUsed,
                  goalArchiveMax,
                  ["Goal", "Goals"],
                  1,
                  true
                ),
                `Long-Term Goal Archive: Tier 1 Maximum`,
                goalEmbedColour
              )
              .setFooter(fn.premiumFooterText)
          );
        }
      }

      // Allows for archive - indexing by unarchived entries only!
      let goalEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${goalCommand} <recent?> <force?>\`\n\n\`<recent?>\`(OPT.): type **recent** to order the goals by **actual time created instead of goal start time!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      goalEditUsageMessage = fn.getMessageEmbed(
        goalEditUsageMessage,
        `Long-Term Goal: Archive Help`,
        goalEmbedColour
      );
      if (goalType === "help")
        return message.channel.send(goalEditUsageMessage);

      var indexByRecency = false;
      if (args[1] !== undefined) {
        if (args[1].toLowerCase() === "recent") {
          indexByRecency = true;
        }
      }

      do {
        var habits;
        if (indexByRecency)
          habits = await Goal.find(
            { userID: authorID, archived: false },
            { _id: 1, description: 1 }
          ).sort({ _id: -1 });
        else
          habits = await Goal.find(
            { userID: authorID, archived: false },
            { _id: 1, description: 1 }
          ).sort({ start: +1 });
        if (!habits.length)
          return message.reply(
            `**No ${
              isArchived ? "archived " : ""
            }goals** were found... Try \`${PREFIX}${commandUsed} help\` for help!`
          );

        let targetGoal = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          "__**Which goal would you like to archive?:**__",
          `Long-Term Goal${isArchived ? " Archive" : ""}: Archive Selection`,
          habits,
          "description",
          false,
          goalEmbedColour,
          600000
        );
        if (!targetGoal) return;
        else targetGoal = targetGoal.object;

        const confirmEnd = await fn.getUserConfirmation(
          bot,
          message,
          PREFIX,
          `**Are you sure you want to archive this goal?**\n(it will not be deleted, but won't show up in your \`${PREFIX}${commandUsed} post\`\nand you won't get reminders for it anymore)\n\n🎯 - __**Description:**__\n${targetGoal.description}`,
          forceSkip,
          `Long-Term Goal${isArchived ? " Archive" : ""}: Archive Confirmation`
        );
        if (confirmEnd)
          await Goal.updateOne(
            { _id: targetGoal._id },
            { $set: { archived: true } },
            async (err, result) => {
              if (err) return console.error(err);
              console.log({ result });
              if (targetGoal._id) {
                rm.cancelRemindersByConnectedDocument(targetGoal._id);
                await Reminder.deleteMany({
                  connectedDocument: targetGoal._id,
                });
              }
            }
          );
        else continue;
      } while (true);
    } else return message.reply(goalHelpMessage);
  },
};
