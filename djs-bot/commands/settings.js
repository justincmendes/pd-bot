const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const Habit = require("../database/schemas/habit");
const Log = require("../database/schemas/habittracker");
const Track = require("../database/schemas/track");
const quotes = require("../../utilities/quotes.json").quotes;
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const hb = require("../../utilities/habit");
const tr = require("../../utilities/track");
const { authorize } = require("passport");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const futureTimeExamples = fn.futureTimeExamples;
const timeExamples = fn.timeExamples;
const intervalExamples = fn.intervalExamplesOver1Hour;
const daysOfWeek = fn.daysOfWeek;
const daysOfWeekList = daysOfWeek
  .map((day, i) => {
    return `\`${i + 1}\` - **${day}**`;
  })
  .join(`\n`);
const userEmbedColour = fn.userSettingsEmbedColour;
const quoteEmbedColour = fn.quoteEmbedColour;
const trackEmbedColour = fn.trackEmbedColour;
const habitEmbedColour = fn.habitEmbedColour;
const pesterEmbedColour = fn.pesterEmbedColour;

const MINIMUM_AUTO_REPORT_DELAY = fn.MINIMUM_AUTO_REPORT_DELAY;
const DEFAULT_AUTO_REPORT_DELAY = fn.DEFAULT_AUTO_REPORT_DELAY;
const MINIMUM_AUTO_REPORT_TRACK_PERIOD = fn.MINIMUM_AUTO_REPORT_TRACK_PERIOD;

// Private Function Declarations
async function userDocumentToString(bot, userSettings) {
  const {
    timezone: { name, offset, daylightSaving },
    likesPesteringAccountability: likesAccountability,
    habitCron,
    getQuote,
    quoteInterval,
    nextQuote,
    tier,
    deleteRepliesDuringCommand,
    voiceChannels,
    discordID: userID,
  } = userSettings;
  const voiceChannelString = await fn.voiceChannelArrayToString(
    bot,
    userID,
    voiceChannels
  );
  const output = `__**Timezone:**__ ${name}\n- **UTC Offset (in hours):** ${fn.hoursToUTCOffset(
    offset
  )}\n- **Daylight Savings Time:** ${
    daylightSaving ? "Yes" : "No"
  }\n\n__**Habit Reset Time:**__\n- **Daily:** ${fn.msToTimeFromMidnight(
    habitCron.daily
  )}\n- **Weekly:** ${fn.getDayOfWeekToString(
    habitCron.weekly
  )}\n\n__**Voice Channels Tracked:**__\n${voiceChannelString}${
    voiceChannelString === "" ? "" : "\n"
  }\n__**Get Quotes:**__ ${getQuote ? "Yes" : "No"}\n- **Next Quote:** ${
    getQuote
      ? nextQuote
        ? fn.timestampToDateString(nextQuote + offset * HOUR_IN_MS)
        : "N/A"
      : "N/A"
  }\n- **Quote Interval:** ${
    getQuote ? (quoteInterval ? `Every ${quoteInterval}` : "N/A") : "N/A"
  }\n\n__**Delete Replies Sent During Commands:**__ ${
    deleteRepliesDuringCommand ? "Yes" : "No"
  }\n\n__**Likes Pestering Accountability:**__ ${
    likesAccountability ? "YES!!!" : "No"
  }\n\n__**Account Premium Level:**__ ${fn.getTierStarString(tier)}`;
  return output;
}

module.exports = {
  name: "settings",
  description: "User Settings/Preferences: Timezone, Habits, Reminders, etc.",
  aliases: [
    "setting",
    "set",
    "s",
    "preferences",
    "user",
    "u",
    "usersettings",
    "userconfig",
  ],
  cooldown: 2.5,
  args: false,
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
    let userSettings = await User.findOne({ discordID: authorID });
    const authorUsername = message.author.username;
    const settingCommand = args[0] ? args[0].toLowerCase() : false;
    let settingUsageMessage =
      `**USAGE**\n\`${PREFIX}${commandUsed}\` - **(to see your settings)**\n\`${PREFIX}${commandUsed} <ACTION> <force?>\`` +
      `\n\n\`<ACTION>\`: **edit/change**\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join("; ")}**`;
    settingUsageMessage = fn.getMessageEmbed(
      settingUsageMessage,
      "User Settings: Help",
      userEmbedColour
    );
    const settingHelpMessage = `Try ${PREFIX}${commandUsed} help - for more options (and how to edit)`;
    const username =
      message.channel.type === "dm"
        ? authorUsername
        : bot.guilds.cache.get(message.guild.id).member(authorID).displayName;
    const showUserSettings = fn
      .getMessageEmbed(
        await userDocumentToString(bot, userSettings),
        `${username}'s Settings`,
        userEmbedColour
      )
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setFooter(settingHelpMessage);

    if (settingCommand === "help") {
      return message.channel.send(settingUsageMessage);
    }

    //see, edit (when edit, show see first then usage),
    else if (
      settingCommand === "edit" ||
      settingCommand === "ed" ||
      settingCommand === "e" ||
      settingCommand === "change" ||
      settingCommand === "ch" ||
      settingCommand === "c" ||
      settingCommand === "setup" ||
      settingCommand === "set" ||
      settingCommand === "s"
    ) {
      do {
        userSettings = await User.findOne({ discordID: authorID });
        let { tier } = userSettings;
        var userFields = userSettings.getQuote
          ? [
              "Timezone",
              "Daylight Savings Time",
              "Habit Daily Reset Time",
              "Habit Weekly Reset Time",
              "Get Quotes",
              "Next Quote",
              "Quote Interval",
              "Delete Replies Sent During Commands",
              "Likes Pestering Accountability",
              "Tracked Voice Channels",
            ]
          : [
              "Timezone",
              "Daylight Savings Time",
              "Habit Daily Reset Time",
              "Habit Weekly Reset Time",
              "Get Quotes",
              "Delete Replies Sent During Commands",
              "Likes Pestering Accountability",
              "Tracked Voice Channels",
            ];
        if (userSettings.voiceChannels)
          if (userSettings.voiceChannels.length) {
            userFields = userFields.concat([
              "Time Spent in Voice Channels",
              "Auto Send Report",
              "Auto Send Delay",
              "Auto Reset",
            ]);
          }
        const quoteAdjustment = userSettings.getQuote ? 0 : 2;
        var continueEdit;
        const fieldToEditInstructions = "**Which field do you want to edit?**";
        const fieldToEditAdditionalMessage = await userDocumentToString(
          bot,
          userSettings
        );
        const fieldToEditTitle = `${showUserSettings.title}: Edit Field`;
        var fieldToEdit, fieldToEditIndex;
        const selectedField = await fn.getUserSelectedObject(
          bot,
          message,
          PREFIX,
          `${fieldToEditAdditionalMessage}\n\n\n${fieldToEditInstructions}`,
          fieldToEditTitle,
          userFields,
          "",
          false,
          userEmbedColour,
          600000,
          0
        );
        if (!selectedField) return;
        else {
          fieldToEdit = selectedField.object;
          fieldToEditIndex = selectedField.index;
        }

        const type = "Settings";
        continueEdit = false;
        const originalTimezone = userSettings.timezone.name;
        var userEdit,
          updatedTimezoneOffset = timezoneOffset,
          updatedDaylightSaving = daylightSaving,
          updatedTimezone = originalTimezone,
          userSettingsPrompt = "",
          selectVoiceChannel,
          targetVcObject;
        let { habitCron } = userSettings;
        switch (fieldToEditIndex) {
          case 0:
            userSettingsPrompt = `Please enter your **__timezone__** as an **abbreviation** or **+/- UTC Offset**:`;
            userEdit = await fn.getUserEditString(
              bot,
              message,
              PREFIX,
              fieldToEdit,
              userSettingsPrompt,
              type,
              forceSkip,
              userEmbedColour
            );
            break;
          case 1:
            userSettingsPrompt = `Does your timezone participate in **Daylight Savings Time (DST)?**\n**⌚ - Yes\n⛔ - No**`;
            userEdit = await fn.getUserEditBoolean(
              bot,
              message,
              PREFIX,
              fieldToEdit,
              userSettingsPrompt,
              ["⌚", "⛔"],
              type,
              forceSkip,
              userEmbedColour
            );
            break;
          case 2:
            userSettingsPrompt = `Enter the **time of day** (i.e. 1a, 3:30AM, etc.) you would like your **habits to reset daily:**`;
            userEdit = await fn.getUserEditString(
              bot,
              message,
              PREFIX,
              fieldToEdit,
              userSettingsPrompt,
              type,
              forceSkip,
              habitEmbedColour
            );
            break;
          case 3:
            userSettingsPrompt = `Enter the number corresponding to the __**day of the week**__ when you would like your **weekly habits counter to reset:**`;
            userEdit = await fn.getUserEditNumber(
              bot,
              message,
              PREFIX,
              fieldToEdit,
              daysOfWeek.length,
              type,
              daysOfWeek,
              forceSkip,
              habitEmbedColour,
              `${userSettingsPrompt}\n\n${daysOfWeekList}`
            );
            if (userEdit !== false && !isNaN(userEdit)) userEdit--;
            console.log({ userEdit });
            break;
          case 4:
            userSettingsPrompt = `Do you want to regularly receive an **inspirational quote?**\n🙌 - **Yes**\n⛔ - **No**`;
            userEdit = await fn.getUserEditBoolean(
              bot,
              message,
              PREFIX,
              fieldToEdit,
              userSettingsPrompt,
              ["🙌", "⛔"],
              type,
              forceSkip,
              quoteEmbedColour
            );
            break;
          case 7 - quoteAdjustment:
            userSettingsPrompt = `Do you want me to delete your replies to my commands?\n(To keep servers/channels clean and/or hide your entries while typing in a server)\n\n👍 - **Yes**\n\n👎 - **No**`;
            userEdit = await fn.getUserEditBoolean(
              bot,
              message,
              PREFIX,
              fieldToEdit,
              userSettingsPrompt,
              ["👍", "👎"],
              type,
              forceSkip,
              userEmbedColour
            );
            break;
          case 8 - quoteAdjustment:
            userSettingsPrompt = `Are you into **pestering accountability** (💪) or not so much (🙅‍♀️)?`;
            userEdit = await fn.getUserEditBoolean(
              bot,
              message,
              PREFIX,
              fieldToEdit,
              userSettingsPrompt,
              ["💪", "🙅‍♀️"],
              type,
              forceSkip,
              pesterEmbedColour
            );
            break;
          case 9 - quoteAdjustment:
            // Check if the user wants to remove a voice channel or add one.
            userSettingsPrompt = `\nDo you want to **add** (📊) another voice channel to track or **remove** (🗑️) a voice channel you are currently tracking your time in?\n(**Cap at ${
              2 * tier
            }**)\n\n**__Current tracked voice channels:__**\n${await fn.voiceChannelArrayToString(
              bot,
              authorID,
              userSettings.voiceChannels,
              true,
              true,
              false
            )}`;
            userEdit = await fn.getUserEditBoolean(
              bot,
              message,
              PREFIX,
              fieldToEdit,
              userSettingsPrompt,
              ["📊", "🗑️"],
              `Track ${type}`,
              true,
              trackEmbedColour
            );
            break;
          case 10 - quoteAdjustment:
            selectVoiceChannel = await tr.userSelectVoiceChannelObject(
              bot,
              message,
              PREFIX,
              userSettings.voiceChannels,
              `Track ${type}: Select Voice Channel`,
              "to edit the time tracked"
            );
            if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
            else {
              targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
              userEdit = await fn.getUserEditDuration(
                bot,
                message,
                PREFIX,
                timezoneOffset,
                daylightSaving,
                "time tracked",
                fn.millisecondsToTimeString(targetVcObject.timeTracked),
                `Track ${type}: Change Time Tracked`,
                0,
                trackEmbedColour
              );
            }
            break;
          case 11 - quoteAdjustment:
            selectVoiceChannel = await tr.userSelectVoiceChannelObject(
              bot,
              message,
              PREFIX,
              userSettings.voiceChannels,
              `Track ${type}: Auto Send Report`,
              "to edit the auto send report setting"
            );
            console.log({ selectVoiceChannel });
            if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
            else {
              targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
              trackPrompt = `\nDo you want to your voice channel tracking to **automatically DM you a report** of your time spent in **${
                bot.channels.cache.get(targetVcObject.id)
                  ? `${bot.channels.cache.get(targetVcObject.id).name}`
                  : "the tracked voice channel"
              }** whenever you stay in **${
                bot.channels.cache.get(targetVcObject.id)
                  ? `${bot.channels.cache.get(targetVcObject.id).name}`
                  : "the tracked voice channel"
              }** for at least ${fn.millisecondsToTimeString(
                MINIMUM_AUTO_REPORT_TRACK_PERIOD
              )} long?\n\n**🔁 - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay** for after you leave the voice channel - in case you come back within that time)`;
              userEdit = await fn.getUserEditBoolean(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                trackPrompt,
                ["🔁", "⛔"],
                `Track ${type}`,
                true,
                trackEmbedColour
              );
            }
            break;
          case 12 - quoteAdjustment:
            selectVoiceChannel = await tr.userSelectVoiceChannelObject(
              bot,
              message,
              PREFIX,
              userSettings.voiceChannels,
              `Track ${type}: Auto Report Delay`,
              "to edit the auto report delay"
            );
            if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
            else {
              targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
              if (!targetVcObject.autoSendReport) {
                message.reply(
                  `Please enable **Auto Send Report** first to change the **Auto Report Delay**.\n(Auto Report Delay: The time frame before automatically sending a report of your session in a voice channel)`
                );
                userEdit = "back";
                break;
              }
              userEdit = await fn.getUserEditDuration(
                bot,
                message,
                PREFIX,
                timezoneOffset,
                daylightSaving,
                "auto report delay",
                fn.millisecondsToTimeString(targetVcObject.autoSendDelay || 0),
                `Track ${type}: Change Auto Report Delay`,
                MINIMUM_AUTO_REPORT_DELAY,
                trackEmbedColour,
                `\n**__Recommended:__** \`15 sec\` \`30s\` \`1 min\` \`5m\` (**Default:** \`15 seconds\`)`
              );
            }
            break;
          case 13 - quoteAdjustment:
            selectVoiceChannel = await tr.userSelectVoiceChannelObject(
              bot,
              message,
              PREFIX,
              userSettings.voiceChannels,
              `Track ${type}: Auto Reset`,
              "to edit the auto reset"
            );
            if (!selectVoiceChannel && selectVoiceChannel !== 0) return;
            else {
              targetVcObject = userSettings.voiceChannels[selectVoiceChannel];
              if (!targetVcObject.autoSendReport) {
                message.reply(
                  `Please enable **Auto Send Report** first to change the **Auto Reset**.\n(Auto Reset: Reset the tracked time to 0:00 after each session in a voice channel)`
                );
                userEdit = "back";
                break;
              }
              trackPrompt = `\nDo you want to your voice channel tracking to **automatically reset** your time spent in ${
                bot.channels.cache.get(targetVcObject.id)
                  ? `**${bot.channels.cache.get(targetVcObject.id).name}**`
                  : "the tracked voice channel"
              } to 0:00 whenever you stay in **${
                bot.channels.cache.get(targetVcObject.id)
                  ? `${bot.channels.cache.get(targetVcObject.id).name}`
                  : "the tracked voice channel"
              }** for at least ${fn.millisecondsToTimeString(
                MINIMUM_AUTO_REPORT_TRACK_PERIOD
              )} long?\n\n**0️⃣ - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay** for after you leave the voice channel - in case you come back within that time)`;
              userEdit = await fn.getUserEditBoolean(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                trackPrompt,
                ["0️⃣", "⛔"],
                `Track ${type}`,
                true,
                trackEmbedColour
              );
            }
            break;

          case 5:
            if (userSettings.getQuote) {
              userSettingsPrompt =
                `\n__**When do you intend to start the next quote?**__ ⌚\n${futureTimeExamples}\n\nType \`skip\` to **start it now**`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                userSettingsPrompt,
                type,
                forceSkip,
                quoteEmbedColour
              );
            } else {
              fn.sendReplyThenDelete(
                message,
                "Make sure you allow yourself to **Get Quotes** first, before then adjusting the interval",
                60000
              );
              userEdit = "back";
              continueEdit = true;
            }
            break;
          case 6:
            if (userSettings.getQuote) {
              userSettingsPrompt = `How often do you want to receive an inspirational quote?\n\n${intervalExamples}`;
              userEdit = await fn.getUserEditString(
                bot,
                message,
                PREFIX,
                fieldToEdit,
                userSettingsPrompt,
                type,
                forceSkip,
                quoteEmbedColour
              );
            } else {
              fn.sendReplyThenDelete(
                message,
                "Make sure you allow yourself to **Get Quotes** first, before then adjusting the interval",
                60000
              );
              userEdit = "back";
              continueEdit = true;
            }
            break;
        }
        if (userEdit === false) return;
        else if (userEdit === undefined) userEdit = "back";
        else if (userEdit !== "back") {
          switch (fieldToEditIndex) {
            case 0:
              {
                updatedTimezoneOffset = fn.getTimezoneOffset(userEdit);
                console.log({ updatedTimezoneOffset });
                if (updatedTimezoneOffset || updatedTimezoneOffset === 0) {
                  updatedTimezone = userEdit;
                  if (updatedDaylightSaving) {
                    updatedTimezoneOffset += fn.isDaylightSavingTime(
                      Date.now() + updatedTimezoneOffset * HOUR_IN_MS,
                      updatedTimezone,
                      true
                    )
                      ? fn.getTimezoneDaylightOffset(updatedTimezone)
                      : 0;
                  }
                } else {
                  fn.sendReplyThenDelete(
                    message,
                    "**This timezone does not exist...**",
                    60000
                  );
                  continueEdit = true;
                }
              }
              break;
            case 1:
              {
                switch (userEdit) {
                  case "⌚":
                    userEdit = true;
                    break;
                  case "⛔":
                    userEdit = false;
                    break;
                  default:
                    userEdit = null;
                    break;
                }
                if (typeof userEdit === "boolean") {
                  updatedDaylightSaving = userEdit;
                  updatedTimezoneOffset = fn.getTimezoneOffset(
                    originalTimezone
                  );
                  if (updatedDaylightSaving === true) {
                    updatedTimezoneOffset += fn.isDaylightSavingTime(
                      Date.now() + updatedTimezoneOffset * HOUR_IN_MS,
                      originalTimezone,
                      true
                    )
                      ? fn.getTimezoneDaylightOffset(originalTimezone)
                      : 0;
                  }
                } else continueEdit = true;
              }
              break;
            case 2:
              {
                const timeArgs = userEdit.toLowerCase().split(/[\s\n]+/);
                const timeRegex = /^(?:(?:(\d{1}(?:\d{1})?)\:?(\d{2}))|(?:(\d{1}(?:\d{1})?)))(pm?|am?)?$/;
                const joinedArgs = timeArgs.join("");
                const ensureTime = timeRegex.exec(joinedArgs);
                const errorMessage =
                  "**Please enter a proper time in the given format...**";
                console.log({ ensureTime });
                if (!ensureTime) {
                  fn.sendReplyThenDelete(message, errorMessage, 30000);
                  continueEdit = true;
                } else {
                  const startTimestamp = new Date(Date.now());
                  let endTime = fn.timeCommandHandlerToUTC(
                    timeArgs[0] !== "today"
                      ? ["today"].concat(timeArgs)
                      : timeArgs,
                    startTimestamp.getTime(),
                    timezoneOffset,
                    daylightSaving
                  );
                  if (!endTime) {
                    fn.sendReplyThenDelete(message, errorMessage, 30000);
                    continueEdit = true;
                  } else {
                    const todayMidnight = new Date(
                      startTimestamp.getUTCFullYear(),
                      startTimestamp.getUTCMonth(),
                      startTimestamp.getUTCDate()
                    ).setUTCHours(0);
                    // Should not need to modulus the difference, but in case
                    // the logic above fails..
                    const DAY_IN_MS = fn.getTimeScaleToMultiplyInMs("day");
                    var timeAfterMidnight =
                      endTime - todayMidnight < 0
                        ? userSettings.habitCron.daily
                        : (endTime - todayMidnight) % DAY_IN_MS;
                    console.log({ endTime, startTimestamp, todayMidnight });
                    console.log({ timeAfterMidnight });
                    const oldDailyCron = userSettings.habitCron.daily;
                    // Prompt user if they want to adapt their logs to this new timestamp (i.e. bring the later logs back into the next day)
                    // If yes, bring the logs which are between midnight and the old cron time, and move them backwards
                    // Otherwise, if the new cron time is later, find all of the entries between the old cron time and the new cron time
                    // and bring the cron times in the other section backwards
                    if (oldDailyCron !== timeAfterMidnight) {
                      userSettings = await User.findOneAndUpdate(
                        { discordID: authorID },
                        { $set: { "habitCron.daily": timeAfterMidnight } },
                        { new: true }
                      );
                      const habits = await Habit.find({ userID: authorID });
                      if (habits)
                        if (habits.length) {
                          const newCronIsAfterOldCron =
                            oldDailyCron < timeAfterMidnight;
                          if (
                            (!newCronIsAfterOldCron && oldDailyCron >= 1000) ||
                            newCronIsAfterOldCron
                          ) {
                            let confirmationMessage =
                              "**Would you like to adjust your habit logs to fall within the __same day as they previously were?__**";
                            if (newCronIsAfterOldCron) {
                              confirmationMessage += `\n\ne.g. If you had a habit entry on **Monday** between **${fn.msToTimeFromMidnight(
                                oldDailyCron
                              )} and ${fn.msToTimeFromMidnight(
                                timeAfterMidnight
                              )}**, it should still correspond to **Monday, instead of Sunday** - since the entry would now be *before the new reset time (${fn.msToTimeFromMidnight(
                                timeAfterMidnight
                              )}) for Sunday*`;
                            } else if (
                              !newCronIsAfterOldCron &&
                              oldDailyCron >= 1000
                            ) {
                              confirmationMessage += `\n\ne.g. If you had a habit entry on **Monday** between **${fn.msToTimeFromMidnight(
                                timeAfterMidnight
                              )} and ${fn.msToTimeFromMidnight(
                                oldDailyCron
                              )}**, it should still correspond to **Sunday, instead of Monday** - since the entry would now be *after the new reset time (${fn.msToTimeFromMidnight(
                                timeAfterMidnight
                              )}) for Sunday*`;
                            } else break;
                            const confirmAdjust = await fn.getUserConfirmation(
                              bot,
                              message,
                              PREFIX,
                              confirmationMessage,
                              false,
                              `${type}: Adjust Previous Habit Times`,
                              600000
                            );
                            // If it's null, the user did not type anything automatically adjust
                            if (confirmAdjust || confirmAdjust === null) {
                              const habitIDs = habits
                                .map((habit) => habit._id)
                                .filter((habitID) => habitID !== undefined);
                              const logs = await Log.find(
                                { connectedDocument: { $in: habitIDs } },
                                { timestamp: 1 }
                              );
                              if (logs)
                                if (logs.length) {
                                  logs.forEach(async (log) => {
                                    if (log.timestamp) {
                                      var needsUpdate = false;
                                      let { timestamp } = log;
                                      const timestampsTimePastMidnight = fn.getTimePastMidnightInMs(
                                        timestamp
                                      );
                                      console.log(
                                        `Timestamp: ${fn.timestampToDateString(
                                          timestamp
                                        )}`
                                      );
                                      const date = new Date(timestamp);
                                      const year = date.getUTCFullYear();
                                      const month = date.getUTCMonth();
                                      const day = date.getUTCDate();
                                      if (newCronIsAfterOldCron) {
                                        if (
                                          timestampsTimePastMidnight >=
                                            oldDailyCron &&
                                          timestampsTimePastMidnight <
                                            timeAfterMidnight
                                        ) {
                                          timestamp =
                                            new Date(
                                              year,
                                              month,
                                              day
                                            ).getTime() + timeAfterMidnight;
                                          console.log(
                                            `New Timestamp: ${fn.timestampToDateString(
                                              timestamp
                                            )}`
                                          );
                                          needsUpdate = true;
                                        }
                                      } else {
                                        if (
                                          timestampsTimePastMidnight >=
                                            timeAfterMidnight &&
                                          timestampsTimePastMidnight <
                                            oldDailyCron
                                        ) {
                                          // One second before, because on or over the cron time corresponds to the next day
                                          timestamp =
                                            new Date(
                                              year,
                                              month,
                                              day
                                            ).getTime() +
                                            timeAfterMidnight -
                                            1000;
                                          console.log(
                                            `New Timestamp: ${fn.timestampToDateString(
                                              timestamp
                                            )}`
                                          );
                                          needsUpdate = true;
                                        }
                                      }
                                      if (needsUpdate) {
                                        console.log("UPDATING TIMESTAMP!\n");
                                        const { connectedDocument } = log;
                                        await Log.updateOne(
                                          { connectedDocument },
                                          { $set: { timestamp } }
                                        );
                                      }
                                    }
                                  });
                                }
                            } else if (confirmAdjust === false) {
                              let {
                                habitCron: updatedHabitCron,
                              } = userSettings;
                              if (habits)
                                if (habits.length) {
                                  habits.forEach(async (habit) => {
                                    if (habit) {
                                      const updatedHabit = await hb.updateHabit(
                                        habit,
                                        timezoneOffset,
                                        updatedHabitCron
                                      );
                                      hb.cancelHabitById(habit._id);
                                      await hb.habitCron(
                                        updatedHabit,
                                        timezoneOffset,
                                        updatedHabitCron
                                      );
                                    }
                                  });
                                }
                            }
                          }
                        }
                    }
                    // WITH Time collection
                    // Allow bot to make a new locked channel which will show the time based on the user settings - (ticking every 5 secs) then
                    // upon start up deletes all remaining timer channels if any - 3 per server/guild! (Allows for pomodoro!)
                  }
                }
              }
              break;
            case 3:
              habitCron = {
                daily: userSettings.habitCron.daily,
                weekly: userEdit,
              };
              userSettings = await User.findOneAndUpdate(
                { discordID: authorID },
                { $set: { habitCron } },
                { new: true }
              );
              break;
            case 4:
              {
                switch (userEdit) {
                  case "🙌":
                    userEdit = true;
                    break;
                  case "⛔":
                    userEdit = false;
                    break;
                  default:
                    userEdit = null;
                    break;
                }
                // setup interval!
                if (typeof userEdit === "boolean") {
                  var interval, firstQuote;
                  let error = false;
                  if (userEdit) {
                    userSettingsPrompt = `How often do you want to receive an inspirational quote?\n\n${intervalExamples}`;
                    let intervalInput = await fn.getUserEditString(
                      bot,
                      message,
                      PREFIX,
                      "Quote Interval",
                      userSettingsPrompt,
                      type,
                      forceSkip,
                      quoteEmbedColour
                    );
                    if (!intervalInput) return;
                    else if (intervalInput === "back") {
                      continueEdit = true;
                    } else {
                      intervalInput = intervalInput
                        .toLowerCase()
                        .split(/[\s\n]+/);
                      const timeArgs =
                        intervalInput[0] === "in"
                          ? intervalInput
                          : ["in"].concat(intervalInput);
                      let now = Date.now();
                      let endTime = fn.timeCommandHandlerToUTC(
                        timeArgs,
                        now,
                        timezoneOffset,
                        daylightSaving,
                        true,
                        true,
                        true
                      );
                      if (!endTime) {
                        error = true;
                        continueEdit = true;
                        interval = false;
                      } else {
                        now = fn.getCurrentUTCTimestampFlooredToSecond();
                        endTime -= HOUR_IN_MS * timezoneOffset;
                        interval = endTime - now;
                      }
                      if (!interval) {
                        fn.sendReplyThenDelete(
                          message,
                          `**INVALID TIME**... ${settingHelpMessage}`,
                          60000
                        );
                        error = true;
                        continueEdit = true;
                      } else if (interval < HOUR_IN_MS) {
                        fn.sendReplyThenDelete(
                          message,
                          "Please enter an interval __**> 1 hour**__"
                        );
                        error = true;
                        continueEdit = true;
                      } else {
                        interval = intervalInput;
                        userSettingsPrompt =
                          `\n__**When do you intend to start the first quote?**__ ⌚\n${futureTimeExamples}\n\nType \`skip\` to **start it now**`;
                        let quoteTrigger = await fn.getUserEditString(
                          bot,
                          message,
                          PREFIX,
                          "First Quote Time",
                          userSettingsPrompt,
                          type,
                          forceSkip,
                          quoteEmbedColour
                        );
                        if (!quoteTrigger) return;
                        else if (quoteTrigger === "back") {
                          continueEdit = true;
                        } else {
                          const isCurrent =
                            quoteTrigger === "skip" || quoteTrigger === "now";
                          currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                          if (isCurrent)
                            firstQuote =
                              currentTimestamp + HOUR_IN_MS * timezoneOffset;
                          else {
                            quoteTrigger = quoteTrigger
                              .toLowerCase()
                              .split(/[\s\n]+/);
                            const triggerArgs =
                              quoteTrigger[0] === "in"
                                ? quoteTrigger
                                : ["in"].concat(quoteTrigger);
                            firstQuote = fn.timeCommandHandlerToUTC(
                              triggerArgs,
                              currentTimestamp,
                              timezoneOffset,
                              daylightSaving
                            );
                          }
                          if (firstQuote) {
                            firstQuote -= HOUR_IN_MS * timezoneOffset;
                            if (firstQuote - currentTimestamp >= 0) {
                              continueEdit = false;
                            } else {
                              fn.sendReplyThenDelete(
                                message,
                                "Please enter a **proper trigger time in the future**"
                              );
                              continueEdit = true;
                              error = true;
                            }
                          } else {
                            fn.sendReplyThenDelete(
                              message,
                              "Please enter a **proper trigger time in the future**"
                            );
                            continueEdit = true;
                            error = true;
                          }
                        }
                      }
                    }
                    // Get the first instance!
                  } else {
                    try {
                      console.log(
                        `Deleting ${authorUsername}'s (${authorID}) recurring quotes`
                      );
                      const reminderQuery = {
                        userID: authorID,
                        isDM: true,
                        isRecurring: true,
                        title: "Quote",
                      };
                      const reminders = await Reminder.find(reminderQuery);
                      reminders.forEach(async (reminder) => {
                        rm.cancelReminderById(reminder._id);
                      });
                      await Reminder.deleteMany(reminderQuery);
                    } catch (err) {
                      console.error(err);
                      console.log("Deletion of recurring quote has failed!");
                    }
                  }
                  if (!error) {
                    userSettings = await User.findOneAndUpdate(
                      { discordID: authorID },
                      {
                        $set: {
                          getQuote: userEdit,
                          quoteInterval:
                            userEdit && interval
                              ? interval.join(" ")
                              : undefined,
                          nextQuote: userEdit ? firstQuote : undefined,
                        },
                      },
                      { new: true }
                    );
                  }
                } else continueEdit = true;
              }
              break;
            case 7 - quoteAdjustment:
              {
                switch (userEdit) {
                  case "👍":
                    userEdit = true;
                    break;
                  case "👎":
                    userEdit = false;
                    break;
                  default:
                    userEdit = null;
                    break;
                }
                if (typeof userEdit === "boolean") {
                  userSettings = await User.findOneAndUpdate(
                    { discordID: authorID },
                    { $set: { deleteRepliesDuringCommand: userEdit } },
                    { new: true }
                  );
                } else continueEdit = true;
              }
              break;
            case 8 - quoteAdjustment:
              {
                switch (userEdit) {
                  case "💪":
                    userEdit = true;
                    break;
                  case "🙅‍♀️":
                    userEdit = false;
                    break;
                  default:
                    userEdit = null;
                    break;
                }
                if (typeof userEdit === "boolean") {
                  userSettings = await User.findOneAndUpdate(
                    { discordID: authorID },
                    { $set: { likesPesteringAccountability: userEdit } },
                    { new: true }
                  );
                } else continueEdit = true;
              }
              break;
            case 9 - quoteAdjustment:
              {
                switch (userEdit) {
                  case "📊":
                    userEdit = true;
                    break;
                  case "🗑️":
                    userEdit = false;
                    break;
                  default:
                    userEdit = null;
                    break;
                }
                if (typeof userEdit === "boolean") {
                  // Add voice channel
                  if (userEdit) {
                    if (userSettings.voiceChannels)
                      if (userSettings.voiceChannels.length >= 2 * tier) {
                        message.reply(
                          `**You cannot track another voice channel because you don't have any more spots!**\n(**__Tier:__ ${tier}** = ${
                              2 * tier
                            } voice channels allowed in total)`
                        );
                        continueEdit = true;
                        break;
                      }
                    // If in server, list out all voice channel names and user select from them,
                    // Or list all across all mutual servers
                    const targetVoiceChannel = await fn.getTargetChannel(
                      bot,
                      message,
                      PREFIX,
                      `Add Voice Channel to Track Time Spent`,
                      forceSkip,
                      false,
                      true,
                      false,
                      trackEmbedColour,
                      userSettings.voiceChannels.map((vc) => vc.id)
                    );
                    console.log({ targetVoiceChannel });
                    if (!targetVoiceChannel) return;

                    // Check if the user wants the auto reset feature:
                    const autoSendReportPrompt = `\nDo you want to your voice channel tracking to **automatically DM you a report** of your time spent in **${
                      bot.channels.cache.get(targetVoiceChannel)
                        ? `${bot.channels.cache.get(targetVoiceChannel).name}`
                        : "the tracked voice channel"
                    }** whenever you stay in **${
                      bot.channels.cache.get(targetVoiceChannel)
                        ? `${bot.channels.cache.get(targetVoiceChannel).name}`
                        : "the tracked voice channel"
                    }** for at least ${fn.millisecondsToTimeString(
                      MINIMUM_AUTO_REPORT_TRACK_PERIOD
                    )} long?\n\n**🔁 - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay** for after you leave the voice channel - in case you come back within that time)`;
                    var reportDelay;
                    let autoSendReport = await fn.getUserEditBoolean(
                      bot,
                      message,
                      PREFIX,
                      "Auto Send Report",
                      autoSendReportPrompt,
                      ["🔁", "⛔"],
                      `Track ${type}`,
                      true,
                      trackEmbedColour
                    );
                    if (!autoSendReport) return;
                    else if (autoSendReport === "back") {
                      continueEdit = true;
                      break;
                    } else {
                      switch (autoSendReport) {
                        case "🔁":
                          autoSendReport = true;
                          break;
                        case "⛔":
                          autoSendReport = false;
                          break;
                        default:
                          autoSendReport = null;
                          break;
                      }
                      var autoReset = false;
                      if (typeof autoSendReport === "boolean") {
                        if (autoSendReport) {
                          // Set the auto reset
                          trackPrompt = `\nDo you want to your voice channel tracking to **automatically reset** your time spent in ${
                            bot.channels.cache.get(targetVoiceChannel)
                              ? `**${
                                  bot.channels.cache.get(targetVoiceChannel)
                                    .name
                                }**`
                              : "the tracked voice channel"
                          } to 0:00 whenever you stay in **${
                            bot.channels.cache.get(targetVoiceChannel)
                              ? `${
                                  bot.channels.cache.get(targetVoiceChannel)
                                    .name
                                }`
                              : "the tracked voice channel"
                          }** for at least ${fn.millisecondsToTimeString(
                            MINIMUM_AUTO_REPORT_TRACK_PERIOD
                          )} long?\n\n**0️⃣ - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay** for after you leave the voice channel - in case you come back within that time)`;
                          autoReset = await fn.getUserEditBoolean(
                            bot,
                            message,
                            PREFIX,
                            "Auto Reset",
                            trackPrompt,
                            ["0️⃣", "⛔"],
                            `Track ${type}`,
                            true,
                            trackEmbedColour
                          );
                          if (!autoReset && autoReset !== 0) return;
                          else if (autoReset === "back") {
                            continueEdit = true;
                            break;
                          } else {
                            switch (autoReset) {
                              case "0️⃣":
                                autoReset = true;
                                break;
                              case "⛔":
                                autoReset = false;
                                break;
                              default:
                                autoReset = null;
                                break;
                            }
                            if (!typeof userEdit === "boolean")
                              autoReset = false;
                          }
                          // Set the report delay
                          reportDelay = await fn.getUserEditDuration(
                            bot,
                            message,
                            PREFIX,
                            timezoneOffset,
                            daylightSaving,
                            "auto report delay",
                            fn.millisecondsToTimeString(
                              DEFAULT_AUTO_REPORT_DELAY
                            ),
                            `Track ${type}: Change Auto Report Delay`,
                            MINIMUM_AUTO_REPORT_DELAY,
                            trackEmbedColour,
                            `\n**__Recommended:__** \`15 sec\` \`30s\` \`1 min\` \`5m\` (**Default:** \`15 seconds\`)`
                          );
                          if (!reportDelay && reportDelay !== 0) return;
                          else if (reportDelay === "back") {
                            continueEdit = true;
                            break;
                          }
                        }
                      } else {
                        continueEdit = true;
                        break;
                      }

                      userSettings = await User.findByIdAndUpdate(
                        userSettings._id,
                        {
                          $push: {
                            voiceChannels: {
                              id: targetVoiceChannel,
                              timeTracked: 0,
                              lastTrackedTimestamp:
                                Date.now() + HOUR_IN_MS * timezoneOffset,
                              autoSendReport,
                              autoSendDelay: reportDelay,
                              autoReset,
                            },
                          },
                        },
                        { new: true }
                      );
                      await fn.setupVoiceChannelTracking(
                        bot,
                        authorID,
                        targetVoiceChannel
                      );
                    }
                  }

                  // Remove voice channel
                  else {
                    if (userSettings.voiceChannels)
                      if (userSettings.voiceChannels.length === 0) {
                        message.reply(
                          "**You cannot remove a voice channel because you are not tracking any right now!**"
                        );
                        continueEdit = true;
                        break;
                      }
                    let vcList = "";
                    userSettings.voiceChannels.forEach((vc, i) => {
                      vcList += `\`${
                        i + 1
                      }\` - **${fn.getVoiceChannelNameString(
                        bot,
                        vc
                      )}** (${fn.getVoiceChannelServerString(bot, vc)})`;
                      if (i !== userSettings.voiceChannels.length) {
                        vcList += "\n";
                      }
                    });
                    const vcTargetIndex = await fn.userSelectFromList(
                      bot,
                      message,
                      PREFIX,
                      vcList,
                      userSettings.voiceChannels.length,
                      "**Type the number corresponding to the voice channel you would like to stop tracking:**\n",
                      `${type}: Removal`,
                      trackEmbedColour,
                      180000
                    );
                    if (!vcTargetIndex && vcTargetIndex !== 0) return;
                    else {
                      const vcTarget =
                        userSettings.voiceChannels[vcTargetIndex];
                      if (vcTarget)
                        if (vcTarget.id) {
                          const confirmDelete = await fn.getUserConfirmation(
                            bot,
                            message,
                            PREFIX,
                            `**Are you sure you want to stop tracking this voice channel?**\n${await fn.voiceChannelArrayToString(
                              bot,
                              authorID,
                              [vcTarget],
                              false
                            )}`,
                            forceSkip,
                            `${type}: Confirm Removal`,
                            180000
                          );
                          if (confirmDelete === null) return;
                          else if (!confirmDelete) continueEdit = true;
                          else {
                            userSettings = await User.findByIdAndUpdate(
                              userSettings._id,
                              {
                                $pull: {
                                  voiceChannels: {
                                    id: vcTarget.id,
                                  },
                                },
                              },
                              { new: true }
                            );
                            if (
                              fn.voiceTrackingUserHasChannel(
                                authorID,
                                vcTarget.id
                              )
                            ) {
                              fn.voiceTrackingUserClearChannelInterval(
                                authorID,
                                vcTarget.id
                              );
                              fn.voiceTrackingUserDeleteChannel(
                                authorID,
                                vcTarget.id
                              );
                              await Track.deleteOne({
                                userID: userSettings.discordID,
                                channelID: vcTarget.id,
                              });
                            }
                          }
                          break;
                        }
                    }
                  }
                }
                continueEdit = true;
              }
              break;
            case 10 - quoteAdjustment:
              {
                if (targetVcObject)
                  if (typeof targetVcObject === "object") {
                    await Track.updateOne(
                      { userID: authorID, voiceChannelID: targetVcObject.id },
                      {
                        $set: {
                          start: fn.getCurrentUTCTimestampFlooredToSecond(),
                          end: fn.getCurrentUTCTimestampFlooredToSecond(),
                        },
                      }
                    );
                    targetVcObject.timeTracked = userEdit;
                    userSettings = await User.findByIdAndUpdate(
                      userSettings._id,
                      {
                        $set: { voiceChannels: userSettings.voiceChannels },
                      },
                      { new: true }
                    );
                  }
                continueEdit = true;
              }
              break;
            case 11 - quoteAdjustment:
              {
                switch (userEdit) {
                  case "🔁":
                    userEdit = true;
                    break;
                  case "⛔":
                    userEdit = false;
                    break;
                  default:
                    userEdit = null;
                    break;
                }
                if (typeof userEdit === "boolean") {
                  if (targetVcObject)
                    if (typeof targetVcObject === "object") {
                      targetVcObject.autoSendReport = userEdit;
                      if (userEdit) {
                        // Set the auto reset
                        trackPrompt = `\nDo you want to your voice channel tracking to **automatically reset** your time spent in ${
                          bot.channels.cache.get(targetVcObject.id)
                            ? `**${
                                bot.channels.cache.get(targetVcObject.id).name
                              }**`
                            : "the tracked voice channel"
                        } to 0:00 whenever you stay in **${
                          bot.channels.cache.get(targetVcObject.id)
                            ? `${
                                bot.channels.cache.get(targetVcObject.id).name
                              }`
                            : "the tracked voice channel"
                        }** for at least ${fn.millisecondsToTimeString(
                          MINIMUM_AUTO_REPORT_TRACK_PERIOD
                        )} long?\n\n**0️⃣ - Yes**\n**⛔ - No**\n\n(If yes, you can specify the **auto report delay** for after you leave the voice channel - in case you come back within that time)`;
                        let autoReset = await fn.getUserEditBoolean(
                          bot,
                          message,
                          PREFIX,
                          "Auto Reset",
                          trackPrompt,
                          ["0️⃣", "⛔"],
                          `Track ${type}`,
                          true,
                          trackEmbedColour
                        );
                        if (!autoReset && autoReset !== 0) return;
                        else if (autoReset === "back") {
                          continueEdit = true;
                          break;
                        } else {
                          switch (autoReset) {
                            case "0️⃣":
                              autoReset = true;
                              break;
                            case "⛔":
                              autoReset = false;
                              break;
                            default:
                              autoReset = null;
                              break;
                          }
                          if (typeof userEdit === "boolean") {
                            targetVcObject.autoReset = autoReset;
                          } else targetVcObject.autoReset = false;
                        }

                        // Set the report delay
                        const reportDelay = await fn.getUserEditDuration(
                          bot,
                          message,
                          PREFIX,
                          timezoneOffset,
                          daylightSaving,
                          "auto report delay",
                          fn.millisecondsToTimeString(
                            targetVcObject.autoSendDelay || 0
                          ),
                          `Track ${type}: Change Auto Report Delay`,
                          MINIMUM_AUTO_REPORT_DELAY,
                          trackEmbedColour,
                          `\n**__Recommended:__** \`15 sec\` \`30s\` \`1 min\` \`5m\` (**Default:** \`15 seconds\`)`
                        );
                        if (!reportDelay && reportDelay !== 0) return;
                        else if (reportDelay === "back") {
                          continueEdit = true;
                          break;
                        } else targetVcObject.autoSendDelay = reportDelay;
                      }
                      if (targetVcObject.autoReset) {
                        await fn.sendAutoSendReportToDM(
                          bot,
                          authorID,
                          userSettings,
                          targetVcObject.id,
                          targetVcObject.timeTracked
                        );
                        targetVcObject.timeTracked = 0;
                      }
                      userSettings = await User.findByIdAndUpdate(
                        userSettings._id,
                        {
                          $set: { voiceChannels: userSettings.voiceChannels },
                        },
                        { new: true }
                      );
                      break;
                    }
                }
                continueEdit = true;
              }
              break;
            case 12 - quoteAdjustment:
              {
                if (targetVcObject)
                  if (typeof targetVcObject === "object") {
                    targetVcObject.autoSendDelay = userEdit;
                    userSettings = await User.findByIdAndUpdate(
                      userSettings._id,
                      {
                        $set: { voiceChannels: userSettings.voiceChannels },
                      },
                      { new: true }
                    );
                    break;
                  }
                continueEdit = true;
              }
              break;
            case 13 - quoteAdjustment:
              switch (userEdit) {
                case "0️⃣":
                  userEdit = true;
                  break;
                case "⛔":
                  userEdit = false;
                  break;
                default:
                  userEdit = null;
                  break;
              }
              if (typeof userEdit === "boolean") {
                if (targetVcObject)
                  if (typeof targetVcObject === "object") {
                    targetVcObject.autoReset = userEdit;
                    // If Auto Reset: Send them their current value and reset!
                    if (targetVcObject.autoReset) {
                      if (targetVcObject.timeTracked !== 0) {
                        await fn.sendAutoSendReportToDM(
                          bot,
                          authorID,
                          userSettings,
                          targetVcObject.id,
                          targetVcObject.timeTracked
                        );
                        targetVcObject.timeTracked = 0;
                      }
                    }
                    userSettings = await User.findByIdAndUpdate(
                      userSettings._id,
                      {
                        $set: { voiceChannels: userSettings.voiceChannels },
                      },
                      { new: true }
                    );
                    break;
                  }
              }
              continueEdit = true;
              break;

            case 5:
              {
                let nextQuote;
                const isCurrent = userEdit === "skip" || userEdit === "now";
                currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                if (isCurrent)
                  nextQuote = currentTimestamp + HOUR_IN_MS * timezoneOffset;
                else {
                  userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                  const timeArgs =
                    userEdit[0] === "in" ? userEdit : ["in"].concat(userEdit);
                  nextQuote = fn.timeCommandHandlerToUTC(
                    timeArgs,
                    currentTimestamp,
                    timezoneOffset,
                    daylightSaving
                  );
                }
                if (nextQuote) {
                  nextQuote -= HOUR_IN_MS * timezoneOffset;
                  if (nextQuote - currentTimestamp >= 0) {
                    userSettings = await User.findOneAndUpdate(
                      { discordID: authorID },
                      {
                        $set: {
                          getQuote: true,
                          quoteInterval: userSettings.quoteInterval,
                          nextQuote,
                        },
                      },
                      { new: true }
                    );
                    continueEdit = false;
                  } else {
                    fn.sendReplyThenDelete(
                      message,
                      "Please enter a **proper trigger time in the future**"
                    );
                    continueEdit = true;
                  }
                } else {
                  fn.sendReplyThenDelete(
                    message,
                    "Please enter a **proper trigger time in the future**"
                  );
                  continueEdit = true;
                }
              }
              break;
            case 6:
              {
                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                console.log({ userEdit });
                let currentTimestamp = Date.now();
                const intervalArgs =
                  userEdit[0] === "in" ? userEdit : ["in"].concat(userEdit);
                let endInterval = fn.timeCommandHandlerToUTC(
                  intervalArgs,
                  currentTimestamp,
                  timezoneOffset,
                  daylightSaving,
                  true,
                  true,
                  true
                );
                if (!endInterval) {
                  fn.sendReplyThenDelete(
                    message,
                    `**INVALID TIME**... ${settingHelpMessage}`,
                    60000
                  );
                  continueEdit = true;
                } else {
                  endInterval -= HOUR_IN_MS * timezoneOffset;
                  currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
                  const updatedInterval = endInterval - currentTimestamp;
                  if (updatedInterval < HOUR_IN_MS) {
                    fn.sendReplyThenDelete(
                      message,
                      "Please enter an interval __**> 1 hour**__"
                    );
                    continueEdit = true;
                  } else {
                    let { nextQuote } = userSettings;
                    nextQuote += HOUR_IN_MS * timezoneOffset;
                    userSettingsPrompt = `\n__**When do you intend to start the first quote?**__ ⌚${
                      nextQuote
                        ? !isNaN(nextQuote)
                          ? `\n\n**Currently**: ${fn.timestampToDateString(
                              nextQuote
                            )}`
                          : ""
                        : ""
                    }\n${futureTimeExamples}\n\nType \`same\` to **keep it the same**\nType \`skip\` to **start it now**`;
                    let quoteTrigger = await fn.getUserEditString(
                      bot,
                      message,
                      PREFIX,
                      "First Quote Time",
                      userSettingsPrompt,
                      type,
                      forceSkip,
                      quoteEmbedColour
                    );
                    if (!quoteTrigger) return;
                    else if (quoteTrigger === "back") {
                      continueEdit = true;
                    } else {
                      var firstQuote;
                      if (quoteTrigger === "same") {
                        firstQuote = nextQuote;
                      } else {
                        const isCurrent =
                          quoteTrigger === "skip" || quoteTrigger === "now";
                        currentTimestamp = Date.now();
                        if (isCurrent)
                          firstQuote =
                            currentTimestamp + HOUR_IN_MS * timezoneOffset;
                        else {
                          quoteTrigger = quoteTrigger
                            .toLowerCase()
                            .split(/[\s\n]+/);
                          const triggerArgs =
                            quoteTrigger[0] === "in"
                              ? quoteTrigger
                              : ["in"].concat(quoteTrigger);
                          firstQuote = fn.timeCommandHandlerToUTC(
                            triggerArgs,
                            currentTimestamp,
                            timezoneOffset,
                            daylightSaving
                          );
                        }
                      }
                      if (firstQuote) {
                        firstQuote -= HOUR_IN_MS * timezoneOffset;
                        if (firstQuote - currentTimestamp >= 0) {
                          userSettings = await User.findOneAndUpdate(
                            { discordID: authorID },
                            {
                              $set: {
                                getQuote: true,
                                quoteInterval: userEdit.join(" "),
                                nextQuote: firstQuote,
                              },
                            },
                            { new: true }
                          );
                          continueEdit = false;
                        } else {
                          fn.sendReplyThenDelete(
                            message,
                            "Please enter a **proper trigger time in the future**"
                          );
                          continueEdit = true;
                        }
                      } else {
                        fn.sendReplyThenDelete(
                          message,
                          "Please enter a **proper trigger time in the future**"
                        );
                        continueEdit = true;
                      }
                    }
                  }
                }
              }
              break;
          }
        } else continueEdit = true;
        if (fieldToEditIndex === 0 || fieldToEditIndex === 1) {
          const timezoneDifference = updatedTimezoneOffset - timezoneOffset;
          let reminderQuery = {
            userID: authorID,
          };
          const confirmUpdateReminders = await fn.userSelectFromList(
            bot,
            message,
            PREFIX,
            "\`1\` - Adjust **ALL** of your reminders\n\`2\` - Adjust only your **DM** reminders\n\`3\` - Adjust only your **server** reminders\n\`4\` - NONE",
            4,
            `**__Would you like to adjust your reminders to this new timezone?__**\n- From **${originalTimezone}, ${fn.hoursToUTCOffset(
                timezoneOffset
              )} - ${
                daylightSaving ? "NO DST" : "considering DST"
              }** -to- **${updatedTimezone}, ${fn.hoursToUTCOffset(
                updatedTimezoneOffset
              )} - ${updatedDaylightSaving ? "NO DST" : "considering DST"}**\n(Type \`4\` to leave your reminders adjusted to your old timezone)\n(Your habit reset time, if any, will automatically be adapted regardless of your choice here)`,
            `${showUserSettings.title}: Reminder Adjustment Confirmation`,
            userEmbedColour
          );
          if (!confirmUpdateReminders && confirmUpdateReminders !== 0) break;
          switch (confirmUpdateReminders) {
            case 1:
              reminderQuery.isDM = true;
              break;
            case 2:
              reminderQuery.isDM = false;
              break;
          }
          if (confirmUpdateReminders !== 3) {
            let userReminders = await Reminder.find(reminderQuery);
            if (userReminders)
              if (userReminders.length) {
                userReminders.forEach(async (reminder) => {
                  let { startTime, endTime } = reminder;
                  startTime += timezoneDifference * HOUR_IN_MS;
                  endTime += timezoneDifference * HOUR_IN_MS;
                  reminder = await Reminder.updateOne(
                    { _id: reminder._id },
                    {
                      $set: {
                        startTime,
                        endTime,
                      },
                    }
                  );
                  rm.cancelReminderById(reminder._id);
                  await rm.sendReminderByObject(bot, reminder);
                });
              }
          }
          let userHabits = await Habit.find({ userID: authorID });
          if (userHabits)
            if (userHabits.length) {
              userHabits.forEach(async (habit) => {
                let { nextCron, settings } = habit;
                const { isWeeklyType, cronPeriods } = settings;
                nextCron = hb.getNextCronTimeUTC(
                  updatedTimezoneOffset,
                  habitCron,
                  isWeeklyType,
                  cronPeriods
                );
                await Habit.updateOne(
                  { _id: habit._id },
                  {
                    $set: {
                      nextCron,
                    },
                  }
                );
              });
              userHabits.forEach(async (habit) => {
                hb.cancelHabitById(habit._id);
              });
              await hb.habitCronUser(authorID);
            }

          timezoneOffset = updatedTimezoneOffset;
          daylightSaving = updatedDaylightSaving;
          userSettings = await User.findOneAndUpdate(
            { discordID: authorID },
            {
              $set: {
                timezone: {
                  name: updatedTimezone.toUpperCase(),
                  offset: updatedTimezoneOffset,
                  daylightSaving: updatedDaylightSaving,
                },
              },
            },
            { new: true }
          );
          console.log({ userSettings });
        } else if (fieldToEditIndex === 2 || fieldToEditIndex === 3) {
          let userHabits = await Habit.find({ userID: authorID });
          if (userHabits)
            if (userHabits.length) {
              userHabits.forEach(async (habit) => {
                let { nextCron, settings } = habit;
                let { isWeeklyType, cronPeriods } = settings;
                const now = Date.now();
                do {
                  nextCron = await hb.getNextCronTimeUTC(
                    timezoneOffset,
                    habitCron,
                    isWeeklyType,
                    cronPeriods,
                    nextCron
                  );
                } while (nextCron < now);
                await Habit.updateOne(
                  { _id: habit._id },
                  {
                    $set: {
                      nextCron,
                    },
                  }
                );
              });
              userHabits.forEach(async (habit) => {
                hb.cancelHabitById(habit._id);
              });
              await hb.habitCronUser(authorID);
            }
        }
        if (!continueEdit) {
          if (
            (fieldToEditIndex === 4 && userEdit === true) ||
            (fieldToEditIndex === 5 && userSettings.getQuote) ||
            (fieldToEditIndex === 6 && userSettings.getQuote)
          ) {
            const now = fn.getCurrentUTCTimestampFlooredToSecond();

            const reminderQuery = {
              userID: authorID,
              title: "Quote",
              isDM: true,
              isRecurring: true,
            };
            const reminders = await Reminder.find(reminderQuery);
            reminders.forEach(async (reminder) => {
              rm.cancelReminderById(reminder._id);
            });
            await Reminder.deleteMany(reminderQuery);

            var quoteIndex, currentQuote;
            while (!currentQuote) {
              quoteIndex = Math.round(Math.random() * quotes.length);
              currentQuote = quotes[quoteIndex].message;
            }
            await rm.setNewDMReminder(
              bot,
              authorID,
              now,
              userSettings.nextQuote,
              currentQuote,
              "Quote",
              true,
              false,
              true,
              userSettings.quoteInterval,
              false,
              quoteEmbedColour
            );
          }
          const continueEditMessage = `Do you want to continue **editing your settings?**\n\n${await userDocumentToString(
            bot,
            userSettings
          )}`;
          continueEdit = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            continueEditMessage,
            forceSkip,
            `Settings: Continue Editing?`,
            300000
          );
        }
      } while (continueEdit === true);
      return;
    } else {
      // await rm.updateTrackingReportReminder(bot, authorID);
      return message.channel.send(showUserSettings);
    }
  },
};
