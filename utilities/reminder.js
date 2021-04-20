// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Reminder = require("../djs-bot/database/schemas/reminder");
const Guild = require("../djs-bot/database/schemas/guildsettings");
const User = require("../djs-bot/database/schemas/user");
const mongoose = require("mongoose");
const quotes = require("../utilities/quotes.json").quotes;
const fn = require("./functions");
const sd = require("./send");
const tm = require("./timeout");
const Habit = require("../djs-bot/database/schemas/habit");
const Log = require("../djs-bot/database/schemas/habittracker");
const Mastermind = require("../djs-bot/database/schemas/mastermind");
const Dst = require("../djs-bot/database/schemas/dst");
require("dotenv").config();

const HOUR_IN_MS = fn.HOUR_IN_MS;
const reminderTypes = fn.reminderTypes;
const repeatEmbedColour = fn.repeatReminderEmbedColour;
const goalEmbedColour = fn.goalsEmbedColour;
const reminderEmbedColour = fn.reminderEmbedColour;
const journalEmbedColour = fn.journalEmbedColour;
const fastEmbedColour = fn.fastEmbedColour;
const habitEmbedColour = fn.habitEmbedColour;
const quoteEmbedColour = fn.quoteEmbedColour;
const mastermindEmbedColour = fn.mastermindEmbedColour;
const trackEmbedColour = fn.trackEmbedColour;

const reminders = new Discord.Collection();

const MINIMUM_INTERVAL = 60000;

// When Storing Reminders: Use UTC time for proper restarts relative to system (UNIX) time
// => When Reading Reminders: Convert UTC to User Timezone

// Deal with user inputs in the front-end aka Discord bot.js or functions using this api
// ALL SECURITY and authorization access will be dealt with at the front-end calls and inputs
// In front-end add the tags to the reminder message.
// Ensure that if it's a channel reminder that the user at least tags 1 person or role!

// Make a sendRecurringReminder(interval), resetRecurringReminder()
// (with setInterval(sendReminder, interval))

// Design choice - include params isRecurring and interval to main function and edit logic
// OR make a separate function for each recurring and interval situations!
// Leaning towards first one, makes api easier to use

// MAYBE move embedColour parameter before is Recurring or Connected Document

// Edit convention: Cancel before starting a new instance

// Private Function Declarations

module.exports = {
  /**
   * @param {Discord.Client} bot
   * @param {String} userID Ensure the user has allowed for open DMs
   * @param {Number} startTimestamp Ensure Timestamp is in UTC for system restarts
   * @param {Number} endTimestamp Ensure Timestamp is in UTC for system restarts
   * @param {String} reminderMessage
   * @param {String | false} title Sample Titles: "Reminder", "Habit", "Fast"
   * @param {mongoose.ObjectId | String | Number} connectedDocumentID
   * @param {Boolean} isRecurring
   * @param {String} interval Ensure this is properly defined when the reminder is recurring
   * Will auto-delete the reminder instance in the database after sending the reminder
   */
  setNewDMReminder: async function (
    bot,
    userID,
    startTimestamp,
    endTimestamp,
    reminderMessage,
    title,
    sendAsEmbed = true,
    connectedDocumentID = undefined,
    isRecurring = false,
    interval = undefined,
    remainingOccurrences = undefined,
    embedColour = undefined
  ) {
    if (!remainingOccurrences && remainingOccurrences !== 0)
      remainingOccurrences = undefined;
    if (!interval) interval = undefined;
    if (!mongoose.Types.ObjectId.isValid(connectedDocumentID))
      connectedDocumentID = undefined;
    console.log({ connectedDocumentID, isRecurring, embedColour });
    const reminder = await this.putNewReminderInDatabase(
      userID,
      userID,
      startTimestamp,
      endTimestamp,
      reminderMessage,
      title,
      connectedDocumentID,
      true,
      sendAsEmbed,
      isRecurring,
      interval,
      remainingOccurrences,
      undefined,
      embedColour
    ).catch((err) => console.error(err));
    console.log({ reminder });
    await this.sendReminderByObject(bot, reminder);
  },

  /**
   * @param {Discord.Client} bot
   * @param {String} userID
   * @param {String} channelToSend Ensure the user enters a channel that they can SEND_MESSAGES to
   * @param {Number} startTimestamp Ensure Timestamp is in UTC for system restarts
   * @param {Number} endTimestamp Ensure Timestamp is in UTC for system restarts
   * @param {String} reminderMessage
   * @param {String | false} title Sample Titles: "Reminder", "Habit", "Fast"
   * @param {mongoose.ObjectId | String | Number} connectedDocumentID
   * @param {Boolean} isRecurring
   * @param {String} interval Ensure that if the interval isRecurring, the interval is a number
   * Will auto-delete the reminder instance in the database after sending the reminder
   */
  setNewChannelReminder: async function (
    bot,
    userID,
    channelToSend,
    startTimestamp,
    endTimestamp,
    reminderMessage,
    title,
    sendAsEmbed = false,
    connectedDocumentID = undefined,
    isRecurring = false,
    interval = undefined,
    remainingOccurrences = undefined,
    embedColour = undefined
  ) {
    const channel = bot.channels.cache.get(channelToSend);
    if (!channel) return false;
    if (!remainingOccurrences && remainingOccurrences !== 0)
      remainingOccurrences = undefined;
    if (!interval) interval = undefined;
    if (!mongoose.Types.ObjectId.isValid(connectedDocumentID))
      connectedDocumentID = undefined;
    const guildID = channel.guild.id;
    console.log({ connectedDocumentID, guildID });
    const reminder = await this.putNewReminderInDatabase(
      userID,
      channelToSend,
      startTimestamp,
      endTimestamp,
      reminderMessage,
      title,
      connectedDocumentID,
      false,
      sendAsEmbed,
      isRecurring,
      interval,
      remainingOccurrences,
      guildID,
      embedColour
    ).catch((err) => console.error(err));
    await this.sendReminderByObject(bot, reminder);
  },

  sendReminderByObject: async function (
    bot,
    reminderObject,
    onRestart = false
  ) {
    try {
      console.log({ reminderObject });
      if (!reminderObject) return false;
      let {
        isDM,
        isRecurring,
        _id: reminderID,
        userID,
        channel,
        startTime,
        endTime,
        message,
        title,
        connectedDocument,
        guildID,
        sendAsEmbed,
        embedColour,
      } = reminderObject;
      const originalMessage = message;
      const userSettings = await User.findOne(
        { discordID: userID },
        { _id: 1, timezone: 1 }
      );
      const duration = endTime - startTime;
      const user = bot.users.cache.get(userID);
      const channelObject = isDM ? user : bot.channels.cache.get(channel);
      let additionalReactionEmojis = [],
        additionalReactionInformation = [];
      if (channelObject) {
        const channelID = channelObject.id;
        const usernameAndDiscriminator = user
          ? `${user.username}#${user.discriminator}`
          : "someone";
        const username = isDM
          ? user
            ? user.username
            : "someone"
          : bot.guilds.cache.get(channelObject.guild.id).member(userID)
              .displayName;
        var titleOut = title;
        if (reminderTypes.includes(title) && isRecurring) {
          if (title === "Reminder" && title === "Quote") {
            titleOut = `Repeating ${title}`;
          }
        }
        if (isDM && sendAsEmbed === undefined) {
          sendAsEmbed = true;
        }
        if (sendAsEmbed) {
          const originalEmbedColour = embedColour;
          switch (title) {
            case "Fast":
              embedColour = fastEmbedColour;
              break;
            case "Habit":
              embedColour = habitEmbedColour;
              break;
            case "Goal":
              embedColour = goalEmbedColour;
              break;
            case "Goals":
              embedColour = goalEmbedColour;
              break;
            case "Journal":
              embedColour = journalEmbedColour;
              break;
            case "Quote":
              embedColour = quoteEmbedColour;
              break;
            case "Mastermind":
              embedColour = mastermindEmbedColour;
              break;
            case "Voice Channel Tracking":
              embedColour = trackEmbedColour;
              break;
            default:
              if (title.startsWith("Mastermind: Weekly Goals")) {
                embedColour = mastermindEmbedColour;
              }
              // Assuming the embedColour passed in is valid hex code****
              else if (!embedColour && embedColour !== 0) {
                if (isRecurring) embedColour = repeatEmbedColour;
                else embedColour = reminderEmbedColour;
              }
              break;
          }
          if (embedColour !== originalEmbedColour) {
            await Reminder.findByIdAndUpdate(reminderID, {
              $set: { embedColour },
            });
          }
          let reminderFooter = "";
          if (title !== "Quote") {
            // reminderFooter = `A ${fn.millisecondsToTimeString(duration)} reminder set by ${username}`
            //     + ((usernameAndDiscriminator !== "someone") ? ` (${usernameAndDiscriminator})` : "");
            reminderFooter = `A ${fn.millisecondsToTimeString(
              duration
            )} reminder set by ${username}`;
          }

          const titleString =
            title !== "Quote" && title !== "Voice Channel Tracking"
              ? titleOut
              : title;

          // `${titleString}${userSettings ?
          //     ` ${fn.timestampToDateString(Date.now() + userSettings.timezone.offset * HOUR_IN_MS, false, false, true, true)}`
          //     + ` (${userSettings.timezone.name.toUpperCase()})` : ""}`
          message = fn.getEmbedArray(
            originalMessage,
            titleString,
            true,
            `${
              !title.startsWith("Mastermind: Weekly Goals")
                ? isRecurring && title === "Reminder"
                  ? titleString
                  : title
                : "Mastermind: Weekly Goals"
            }${
              userSettings
                ? ` ${fn.timestampToDateString(
                    Date.now() + userSettings.timezone.offset * HOUR_IN_MS,
                    false,
                    false,
                    true,
                    true
                  )} (${userSettings.timezone.name.toUpperCase()})`
                : ""
            }`,
            embedColour
          );

          if (!message) {
            message = new Discord.MessageEmbed()
              .setTitle(
                title !== "Quote" && title !== "Voice Channel Tracking"
                  ? titleOut
                  : title
              )
              .setDescription(originalMessage)
              .setFooter(reminderFooter, user.displayAvatarURL())
              .setColor(embedColour);
          } else {
            var habitFooter = "";
            if (title === "Habit" && connectedDocument) {
              // habitFooter = `\n🔁 to track your habit`;
              // additionalReactionEmojis.push("🔁");
              // additionalReactionInformation.push(connectedDocument);
              // const habits = await Habit.find({ userID }).sort({
              //   createdAt: +1,
              // });
              // if (habits && habits.length) {
              //   const targetHabitIndex = habits.findIndex(
              //     (habit) =>
              //       habit._id.toString() === connectedDocument.toString()
              //   );
              //   if (targetHabitIndex !== -1) {
              //     const targetHabit = habits[targetHabitIndex];
              //   }
              // }
            }
            for (embed of message) {
              embed.setFooter(
                `${reminderFooter}${
                  embed.footer
                    ? embed.footer.text
                      ? `\n${embed.footer.text}`
                      : ""
                    : ""
                }${habitFooter}`,
                user.displayAvatarURL()
              );
            }
          }
        } else {
          // Add a zero-width space between the @everyone/@here mentions for users who are not
          // originally able to mention the given roles with their current permissions
          if (!isDM) {
            const targetChannel = bot.guilds.cache
              .get(guildID)
              .channels.cache.get(channelID);
            const userPermissions = targetChannel.permissionsFor(
              bot.users.cache.get(userID)
            );
            if (!userPermissions.has("MENTION_EVERYONE")) {
              message = message.replace(/\@(everyone|here)/g, `\@\u200b$1`);
            }
          }
          // Will keep commented out since it does not look nice with the reminder
          // + it takes up space!
          // if (title !== "Quote" && title !== "Voice Channel Tracking") {
          //     message += `\n\n__A **${fn.millisecondsToTimeString(duration)} ${titleOut}** set by **${username}**__`
          //         + `${usernameAndDiscriminator !== "someone" ? ` (${usernameAndDiscriminator})` : ""}`;
          // }
          if (title !== "Quote" && title !== "Voice Channel Tracking") {
            message +=
              usernameAndDiscriminator !== "someone"
                ? `\n(**${titleOut}** set by **__${username}__**)`
                : "";
          }
        }
        // var mentions;
        // if (!isDM) {
        //     const discordMentionRegex = /(?:\<\@\!\d+\>)|(?:\<\@\&\d+\>)/g;
        //     const tags = originalMessage.match(discordMentionRegex);
        //     console.log({ tags });
        //     if (tags) mentions = `${tags.join(' ')}`;
        // }
        const currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
        const reminderDelay = endTime - currentTimestamp;

        console.log({
          reminderID,
          connectedDocument,
          title,
          reminderDelay,
          username,
          channelID,
        });
        console.log(
          `Setting ${username}'s (${usernameAndDiscriminator}) ${fn.millisecondsToTimeString(
            duration
          )} reminder!\nTime Left: ${
            reminderDelay < 0
              ? fn.millisecondsToTimeString(0)
              : fn.millisecondsToTimeString(reminderDelay)
          }\nRecurring: ${isRecurring}\nDM: ${isDM}\nChannel: ${channelID}`
        );

        // Save each timeout to an array, per user:
        // For long-term memory efficiency when reminders are edited or deleted
        // Reminders can directly be accessed and canceled/deleted
        if (!reminders.has(userID)) {
          // The array will hold all of the reminder timeout objects of the user
          reminders.set(userID, new Array());
        }
        const userReminders = reminders.get(userID);
        if (isRecurring) {
          // If it's recurring and should have been triggered when the bot was down
          // Trigger it once right away then follow the intervals.
          userReminders.push({
            id: reminderID.toString(),
            connectedId: connectedDocument
              ? connectedDocument.toString()
              : undefined,
            timeout: tm.setLongTimeout(async () => {
              const updatedReminderObject = await this.updateRecurringReminderByObjectID(
                bot,
                reminderID,
                onRestart
              );
              if (updatedReminderObject) {
                console.log({ updatedReminderObject });
                console.log("Updated Recurring Reminder in Database!");

                const isLastReminder =
                  updatedReminderObject.remainingOccurrences === 0 ||
                  updatedReminderObject.remainingOccurrences < 0;

                if (
                  bot.channels.cache.get(channel) ||
                  bot.users.cache.get(userID)
                ) {
                  if (
                    updatedReminderObject.remainingOccurrences ||
                    updatedReminderObject.remainingOccurrences === 0
                  ) {
                    var remainingOccurrencesMessage = "";
                    if (isLastReminder) {
                      remainingOccurrencesMessage = `\nThis is the last reminder!`;
                    } else if (updatedReminderObject.remainingOccurrences) {
                      remainingOccurrencesMessage = `\n${
                        updatedReminderObject.remainingOccurrences
                      } more reminder${
                        updatedReminderObject.remainingOccurrences === 1
                          ? ""
                          : "s"
                      } left!`;
                    }
                    if (updatedReminderObject.sendAsEmbed) {
                      // 0 is allowed if there were occurrences left,
                      // but the bot was down when the reminder should have sent.
                      // Send it then delete it.
                      if (Array.isArray(message)) {
                        for (embed of message) {
                          embed.setFooter(
                            `${
                              embed.footer
                                ? embed.footer.text
                                  ? `\n${embed.footer.text}`
                                  : ""
                                : ""
                            }` + remainingOccurrencesMessage,
                            user.displayAvatarURL()
                          );
                        }
                      } else {
                        const { footer } = message;
                        message = message.setFooter(
                          footer.text + remainingOccurrencesMessage,
                          footer.iconURL
                        );
                      }
                    } else message += remainingOccurrencesMessage;
                  }
                  if (
                    updatedReminderObject.title === "Quote" ||
                    updatedReminderObject.title === "Voice Channel Tracking" ||
                    updatedReminderObject.title === "Habit" ||
                    updatedReminderObject.title === "Goals" ||
                    updatedReminderObject.title.startsWith(
                      "Mastermind: Weekly Goals"
                    )
                  ) {
                    if (updatedReminderObject.sendAsEmbed) {
                      if (Array.isArray(message)) {
                        for (embed of message) {
                          embed.setDescription(updatedReminderObject.message);
                        }
                      } else
                        message = message.setDescription(
                          updatedReminderObject.message
                        );
                    } else message = updatedReminderObject.message;
                  }
                  if (updatedReminderObject.sendAsEmbed) {
                    if (Array.isArray(message)) {
                      for (const embed of message) {
                        await fn.sendPaginationEmbed(
                          bot,
                          channelObject.id,
                          userID,
                          [embed],
                          true,
                          additionalReactionEmojis,
                          additionalReactionInformation
                        );
                      }
                    } else {
                      await fn.sendPaginationEmbed(
                        bot,
                        channelObject.id,
                        userID,
                        [message],
                        true,
                        additionalReactionEmojis,
                        additionalReactionInformation
                      );
                    }
                  } else channelObject.send(message);

                  if (!isLastReminder) {
                    this.cancelReminderById(reminderID);
                    await this.sendReminderByObject(bot, updatedReminderObject);
                    return;
                  }
                }
              }
              this.cancelReminderById(reminderID);
              await this.deleteOneReminderByObjectID(reminderID);
              return;
            }, reminderDelay),
          });
        } else {
          userReminders.push({
            id: reminderID.toString(),
            connectedId: connectedDocument
              ? connectedDocument.toString()
              : undefined,
            timeout: tm.setLongTimeout(async () => {
              const reminderExists = await this.getOneReminderByObjectID(
                reminderID
              );
              console.log({ reminderExists });
              if (reminderExists) {
                if (reminderExists.sendAsEmbed) {
                  if (Array.isArray(message)) {
                    for (const embed of message) {
                      await fn.sendPaginationEmbed(
                        bot,
                        channelObject.id,
                        userID,
                        [embed],
                        true
                      );
                    }
                  } else {
                    await fn.sendPaginationEmbed(
                      bot,
                      channelObject.id,
                      userID,
                      [message],
                      true
                    );
                  }
                } else channelObject.send(message);

                await this.deleteOneReminderByObjectID(
                  reminderID
                ).catch((err) => console.error(err));
                console.log("Deleted Reminder in Database!");
              } else
                console.log(
                  `This reminder (${reminderID}) no longer exists - it may have been deleted or edited to trigger at an earlier time!`
                );
            }, reminderDelay),
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  /**
   * @param {mongoose.Schema.Types.ObjectId | String} reminderID
   */
  cancelReminderById: function (reminderID) {
    // console.log({ reminders });
    const success = fn.cancelCronById(reminders, reminderID);
    if (success) {
      console.log(`Successfully cancelled reminder ${reminderID}.`);
    } else if (success === null) {
      console.log(
        `Reminder ${reminderID} does not exist, or is already cancelled.`
      );
    } else {
      console.log(`Failed to cancel reminder ${reminderID}.`);
    }
    // console.log({ reminders });
    return success;
  },

  /**
   * @param {mongoose.Schema.Types.ObjectId | String} connectedDocumentId
   */
  cancelRemindersByConnectedDocument: function (connectedDocumentId) {
    const success = fn.cancelCronByConnectedDocument(
      reminders,
      connectedDocumentId
    );
    if (success) {
      console.log(
        `Successfully cancelled reminders connected to document ${connectedDocumentId}`
      );
    } else if (success === null) {
      console.log(
        `Reminders connected to document ${connectedDocumentId} do not exist, or are already cancelled.`
      );
    } else {
      console.log(
        `Failed to cancel reminders connected to document ${connectedDocumentId}`
      );
    }
    return success;
  },

  // Create another function called schedule all dst
  // Then make this a scheduler for a single DST given the dstSettings object
  rescheduleAllDST: async function (bot) {
    // Start by getting all of the users to get the time until their DST time
    // Set a unique offset for each (make the loop outside)
    let dstSettings = await Dst.find({});
    if (!dstSettings.length) {
      dstSettings = new Array();
      const dstTimezones = fn.daylightSavingTimezones;
      dstTimezones.forEach(async (timezone) => {
        const currentOffset = fn.getTimezoneOffset(timezone);
        const newSettings = new Dst({
          _id: mongoose.Types.ObjectId(),
          isDST: fn.isDaylightSavingTime(
            Date.now() + HOUR_IN_MS * currentOffset,
            timezone,
            true
          ),
          timezone: timezone.toLowerCase(),
        });
        dstSettings.push(newSettings);
        await newSettings
          .save()
          .then((result) => console.log(result))
          .catch((err) => console.error(err));
      });
    }
    dstSettings.forEach(async (dstSettings) => {
      await this.scheduleOneDST(bot, dstSettings);
    });
    return;
  },

  scheduleOneDST: async function (bot, dstSetting) {
    let { isDST, timezone } = dstSetting;
    let timezoneOffset =
      fn.getTimezoneOffset(timezone) +
      (isDST ? fn.getTimezoneDaylightOffset(timezone) : 0);
    let dstEndingYearOffset = 0;
    let now = Date.now() + timezoneOffset * HOUR_IN_MS;
    if (fn.isSouthernHemisphereDSTTimezone(timezone)) {
      dstEndingYearOffset = new Date(now).getUTCMonth() < 6 ? 1 : 0;
    }
    let daylightSavingTimeArray = fn.getDSTStartAndEndTimeUTC(now, timezone);
    if (!daylightSavingTimeArray) return false;
    let [
      daylightStartTimestamp,
      daylightEndTimestamp,
    ] = daylightSavingTimeArray;

    // To handle the case when the client is down for an extended period of time

    // Mostly for Southern Hemisphere timezones: If it's past DST for this year
    // Then it is not DST and the next start time is in the next year
    if (now >= daylightEndTimestamp) {
      isDST = false;
      const currentYear = new Date(now);
      const nextYear = new Date(
        currentYear.getUTCFullYear() - dstEndingYearOffset + 1,
        currentYear.getUTCMonth(),
        currentYear.getUTCDate(),
        currentYear.getUTCHours(),
        currentYear.getUTCMinutes(),
        currentYear.getUTCSeconds(),
        currentYear.getUTCMilliseconds()
      );
      daylightSavingTimeArray = fn.getDSTStartAndEndTimeUTC(
        nextYear.getTime(),
        timezone
      ); // Get start time for next year
      if (!daylightSavingTimeArray) return false;
      [daylightStartTimestamp, daylightEndTimestamp] = daylightSavingTimeArray;
    } else if (now >= daylightStartTimestamp && now < daylightEndTimestamp) {
      isDST = true;
    }

    // Then update the dst object and reset the scheduling process
    timezoneOffset =
      fn.getTimezoneOffset(timezone) +
      (isDST ? fn.getTimezoneDaylightOffset(timezone) : 0);
    now = Date.now() + timezoneOffset * HOUR_IN_MS;
    let timeToDST = isDST
      ? daylightEndTimestamp - now
      : daylightStartTimestamp - now;
    console.log({
      timezone,
      isDST,
      daylightStartTimestamp,
      daylightEndTimestamp,
    });
    // console.log(new Date(daylightStartTimestamp));
    // console.log(new Date(daylightEndTimestamp));
    console.log(
      `DST Start: ${fn.timestampToDateString(
        daylightStartTimestamp + HOUR_IN_MS * timezoneOffset
      )}`
    );
    console.log(
      `DST End: ${fn.timestampToDateString(
        daylightEndTimestamp + HOUR_IN_MS * timezoneOffset
      )}`
    );
    console.log(`Now: ${fn.timestampToDateString(now)}`);
    console.log(
      `Time to DST switch: ${fn.millisecondsToTimeString(timeToDST)}`
    );
    await Dst.updateOne({ timezone }, { $set: { isDST } });

    await this.updateDstOffset(bot, isDST, timezone);
    tm.setLongTimeout(async () => {
      dstSetting = await Dst.findOne({ timezone });
      await this.scheduleOneDST(bot, dstSetting);
      return;
    }, timeToDST);
    return;
  },

  updateDstOffset: async function (bot, isDST, timezone) {
    if (timezone) timezone = timezone.toUpperCase();
    else return false;
    const query = {
      "timezone.name": timezone,
      "timezone.daylightSaving": true,
    };
    const projection = { "timezone.offset": 1 };
    const allDSTGuilds = await Guild.find(query, projection);
    const allDSTUsers = await User.find(query, projection);
    if (allDSTUsers.length || allDSTGuilds.length) {
      let { offset } = allDSTUsers[0]
        ? allDSTUsers[0].timezone.offset
        : allDSTGuilds[0]
        ? allDSTGuilds[0].timezone.offset
        : false;
      if (!offset && offset !== 0) return false;
      let initialOffset = fn.getTimezoneOffset(timezone);
      console.log({ timezone, initialOffset, isDST });
      offset = isDST
        ? isNaN(timezone)
          ? initialOffset + fn.getTimezoneDaylightOffset(timezone)
          : initialOffset++
        : initialOffset;
      const timezoneDifference = offset - initialOffset;
      console.log({ offset, timezoneDifference });
      if (allDSTUsers.length) {
        for (const user of allDSTUsers) {
          await this.updateUserReminders(
            bot,
            user.discordID,
            //* * -1 because if the timezone is earlier, the reminder should be earlier => a soon start/end time => subtrack from the start/end times
            timezoneDifference * -1
          );
        }
      }
      await Dst.updateOne({ timezone }, { $set: { isDST } });
      await User.updateMany(query, { $set: { "timezone.offset": offset } });
      await Guild.updateMany(query, { $set: { "timezone.offset": offset } });
      return true;
    } else return false;
  },

  updateUserReminders: async function (
    bot,
    userID,
    hourChange,
    changeDmReminders = true,
    changeGuildReminder = true
  ) {
    try {
      const userSettings = await User.findOne({ discordID: userID });
      if (userSettings) {
        const userReminders = await Reminder.find({ userID });
        if (userReminders) {
          if (userReminders.length) {
            for (const reminder of userReminders) {
              if (
                (reminder.isDM && changeDmReminders) ||
                (!reminder.isDM && changeGuildReminder)
              ) {
                const updatedStartTime =
                  reminder.startTime + hourChange * HOUR_IN_MS;
                const updatedEndTime =
                  reminder.endTime + hourChange * HOUR_IN_MS;
                console.log(
                  `Current Start Time (UTC): ${fn.timestampToDateString(
                    reminder.startTime
                  )}\nCurrent End Time (UTC): ${fn.timestampToDateString(
                    reminder.endTime
                  )}\nUpdated Start Time (UTC): ${fn.timestampToDateString(
                    updatedStartTime
                  )}\nUpdated End Time (UTC): ${fn.timestampToDateString(
                    updatedEndTime
                  )}`
                );
                const updatedReminder = await Reminder.findOneAndUpdate(
                  { _id: reminder._id },
                  {
                    $set: {
                      startTime: updatedStartTime,
                      endTime: updatedEndTime,
                    },
                  },
                  { new: true }
                );
                this.cancelReminderById(updatedReminder._id);
                await this.sendReminderByObject(bot, updatedReminder);
              }
            }
          }
        }
      }
      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  resetReminders: async function (bot) {
    //! REMEMBER TO COMMENT THE SECOND allReminders BACK IN BEFORE DEPLOYMENT! TEST
    // const allReminders = await Reminder.find({ userID: "746119608271896598" });
    const allReminders = await this.getAllReminders();
    console.log("Reinitializing all reminders.");
    if (allReminders) {
      allReminders.forEach(async (reminder) => {
        await this.sendReminderByObject(bot, reminder, true);
      });
    }
  },

  putNewReminderInDatabase: async function (
    userID,
    channelToSend,
    startTime,
    endTime,
    reminderMessage,
    title,
    connectedDocument,
    isDM,
    sendAsEmbed,
    isRecurring = false,
    interval = undefined,
    remainingOccurrences = undefined,
    guildID = undefined,
    embedColour = undefined
  ) {
    const putNewReminder = new Reminder({
      _id: mongoose.Types.ObjectId(),
      userID,
      channel: channelToSend,
      startTime,
      endTime,
      message: reminderMessage,
      title,
      connectedDocument,
      isDM,
      sendAsEmbed,
      isRecurring,
      interval,
      remainingOccurrences,
      guildID,
      embedColour,
    });
    await putNewReminder
      .save()
      .then((result) => console.log({ result }))
      .catch((err) => console.log(err));
    return putNewReminder;
  },

  getAllReminders: async function () {
    const getAllReminders = await Reminder.find({}).catch((err) => {
      console.error(err);
      return false;
    });
    return getAllReminders;
  },

  getUserReminders: async function (userID) {
    const getUserReminders = await Reminder.find({ userID }).catch((err) => {
      console.error(err);
      return false;
    });
    return getUserReminders;
  },

  getOneReminder: async function (
    userID,
    channelToSend,
    startTimestamp,
    endTimestamp,
    title,
    connectedDocument,
    reminderMessage,
    isDM,
    isRecurring
  ) {
    const getReminders = await Reminder.findOne({
      userID,
      channel: channelToSend,
      startTime: startTimestamp,
      endTime: endTimestamp,
      message: reminderMessage,
      title,
      connectedDocument,
      isDM,
      isRecurring,
    }).catch((err) => console.error(err));
    return getReminders;
  },

  getRemindersObjectID: async function (
    userID,
    channelToSend,
    startTimestamp,
    endTimestamp,
    reminderMessage,
    isDM,
    isRecurring
  ) {
    const reminderObject = await Reminder.findOne({
      userID,
      channel: channelToSend,
      startTime: startTimestamp,
      endTime: endTimestamp,
      message: reminderMessage,
      isDM,
      isRecurring,
    }).catch((err) => {
      console.error(err);
      return false;
    });
    return reminderObject._id;
  },

  getOneReminderByObjectID: async function (reminderID) {
    if (reminderID) {
      console.log({ reminderID });
      const reminder = await Reminder.findById(reminderID).catch((err) => {
        console.error(err);
        return false;
      });
      console.log({ reminder });
      return reminder;
    } else return null;
  },

  deleteOneReminder: async function (
    userID,
    channelToSend,
    startTimestamp,
    endTimestamp,
    title,
    connectedDocument,
    reminderMessage,
    isDM,
    isRecurring
  ) {
    console.log({
      userID,
      channelToSend,
      startTimestamp,
      endTimestamp,
      title,
      connectedDocument,
      reminderMessage,
      isDM,
      isRecurring,
    });
    await Reminder.findOneAndDelete({
      userID,
      channel: channelToSend,
      startTime: startTimestamp,
      endTime: endTimestamp,
      message: reminderMessage,
      title,
      connectedDocument,
      isDM,
      isRecurring,
    }).catch((err) => console.error(err));
    console.log(`Deleting One Reminder...`);
  },

  deleteOneReminderByObjectID: async function (reminderID) {
    if (reminderID) {
      deleteReminder = await Reminder.findOneAndDelete({
        _id: reminderID,
      }).catch((err) => {
        console.error(err);
        return false;
      });
    }
    console.log({ deleteReminder });
    console.log(`Deleting One Reminder by ID...`);
  },

  deleteUserReminders: async function (userID) {
    const deleteReminders = await Reminder.deleteMany({ userID }).catch((err) =>
      console.error(err)
    );
    console.log(`Deleting all of ${userID}'s reminders`);
  },

  updateRecurringReminderByObjectID: async function (
    bot,
    reminderID,
    onRestart = false
  ) {
    if (reminderID) {
      const reminder = await this.getOneReminderByObjectID(reminderID);
      if (reminder)
        if (reminder.isRecurring) {
          const userSettings = await User.findOne(
            { discordID: reminder.userID },
            { _id: 0, timezone: 1 }
          );
          const { habitCron } = userSettings;
          const { offset, daylightSaving } = userSettings.timezone;
          const { endTime, interval, remainingOccurrences } = reminder;
          const hasOccurrences =
            remainingOccurrences > 0 ||
            remainingOccurrences === undefined ||
            remainingOccurrences === null ||
            remainingOccurrences === false;
          if (endTime && interval && hasOccurrences) {
            let intervalArgs = interval.split(/[\s\n]+/);
            intervalArgs =
              intervalArgs[0].toLowerCase() !== "in"
                ? ["in"].concat(intervalArgs)
                : intervalArgs;

            var remindersLeft = remainingOccurrences || 1;
            let iterations = 0,
              MAX_ITERATIONS = 500,
              newEndTime = endTime,
              previousEndTime = newEndTime;
            do {
              previousEndTime = newEndTime;
              newEndTime = fn.timeCommandHandlerToUTC(
                intervalArgs,
                newEndTime,
                offset,
                daylightSaving,
                false,
                true,
                true
              );
              if (!newEndTime) return false;
              else {
                // console.log(
                //   `New End Time: ${fn.timestampToDateString(newEndTime)}`
                // );
                // console.log(
                //   `Starting End Time: ${fn.timestampToDateString(
                //     endTime + HOUR_IN_MS * offset
                //   )}`
                // );
                newEndTime -= HOUR_IN_MS * offset;
                if (remainingOccurrences) remindersLeft--;
              }
              iterations++;
            } while (
              iterations < MAX_ITERATIONS &&
              newEndTime <= fn.getCurrentUTCTimestampFlooredToSecond() &&
              remindersLeft > 0
            );
            if (iterations >= MAX_ITERATIONS) {
              newEndTime = Date.now();
            }
            // console.log(
            //   `FINAL End Time: ${fn.timestampToDateString(newEndTime)}`
            // );
            const newStartTime = previousEndTime || endTime;
            let updateObject = {
              startTime: newStartTime,
              endTime: newEndTime,
              remainingOccurrences: remainingOccurrences
                ? remindersLeft
                : remainingOccurrences,
            };
            if (reminder.title === "Quote") {
              var quoteIndex,
                currentQuote,
                tags = new Array();
              if (!reminder.isDM) {
                const roleRegex = /(\<\@\&\d+\>)/g;
                tags = reminder.message.match(roleRegex);
              }
              while (!currentQuote) {
                quoteIndex = Math.round(Math.random() * quotes.length);
                currentQuote = quotes[quoteIndex].message;
              }
              if (!reminder.isDM && tags.length)
                currentQuote += `\n${tags.join(" ")}`;
              if (currentQuote) updateObject.message = currentQuote;
              if (reminder.isDM) {
                await User.findOneAndUpdate(
                  { discordID: reminder.userID },
                  { $set: { nextQuote: newEndTime } },
                  { new: true }
                );
              } else {
                await Guild.findOneAndUpdate(
                  { guildID: reminder.guildID },
                  { $set: { "quote.nextQuote": newEndTime } },
                  { new: true }
                );
              }
            } else if (reminder.title === "Voice Channel Tracking") {
              updateObject.message = await fn.getTrackingReportString(
                bot,
                reminder.userID,
                true
              );
              let updatedUserSettings = await User.findOne({
                discordID: reminder.userID,
              });
              if (updatedUserSettings) {
                const { voiceChannels } = updatedUserSettings;
                if (voiceChannels)
                  if (voiceChannels.length) {
                    for (var i = 0; i < voiceChannels.length; i++) {
                      if (
                        typeof voiceChannels[i].lastReminderTimeTracked ===
                        "number"
                      ) {
                        voiceChannels[i].lastReminderTimeTracked =
                          voiceChannels[i].timeTracked;
                      } else voiceChannels[i].lastReminderTimeTracked = 0;
                    }
                    await User.updateOne(
                      { discordID: reminder.userID },
                      { $set: { voiceChannels } }
                    );
                  }
                // console.log({ updatedUserSettings });
                // console.log(updatedUserSettings.voiceChannels);
                // updateObject.message = await fn.getTrackingReportString(bot, reminder.userID, true,
                //     updatedUserSettings);
              }
            } else if (
              reminder.title === "Habit" &&
              reminder.connectedDocument
            ) {
              updateObject.message = await fn.getHabitReminderMessage(
                reminder.userID,
                offset,
                "habit",
                reminder.connectedDocument
              );
            } else if (reminder.title === "Goals") {
              updateObject.message = await fn.getGoalsReminderMessage(
                reminder.userID
              );
            } else if (
              reminder.title.startsWith("Mastermind: Weekly Goals") &&
              reminder.connectedDocument
            ) {
              const userMastermind = await Mastermind.findOne({
                connectedDocument: reminder.connectedDocument,
              });
              if (userMastermind) {
                const userGoals = userMastermind.journal
                  ? userMastermind.journal.goals
                  : null;
                if (userGoals) {
                  updateObject.message = fn.goalArrayToString(
                    userGoals,
                    "Weekly",
                    true,
                    true,
                    false,
                    true,
                    true,
                    false
                  );
                }
              }
            }
            const updateReminder = await Reminder.findOneAndUpdate(
              { _id: reminderID },
              { $set: updateObject },
              { new: true }
            );
            if (updateReminder) {
              if (
                reminder.title === "Quote" ||
                reminder.title === "Voice Channel Tracking" ||
                (reminder.title === "Habit" && reminder.connectedDocument) ||
                reminder.title === "Goals" ||
                (reminder.title.startsWith("Mastermind: Weekly Goals") &&
                  reminder.connectedDocument)
              ) {
                console.log(updateObject.message);
                updateReminder.message =
                  updateObject.message || updateReminder.message;
              }
              return updateReminder;
            }
          }
        }
    }
    return false;
  },

  // COMMAND FUNCTIONS
  getReminderSplitArgs: function (args) {
    args = args.join(" ");
    const splitArgs = /(.+?)\s?((?:[Dd][Mm])|(?:\<\#\d+\>))\s?((?:.|\n)+)/.exec(
      args
    );
    if (splitArgs) {
      splitArgs.forEach((arg) => {
        if (arg === undefined) return false;
      });
    } else return false;
    return splitArgs.slice(1, 4);
  },

  getTotalReminders: async function (userID, isRecurring) {
    try {
      const totalReminders = await Reminder.find({
        userID,
        isRecurring,
      }).countDocuments();
      return totalReminders;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  multipleRemindersToString: async function (
    bot,
    message,
    reminderArray,
    numberOfReminders,
    userTimezoneOffset,
    entriesToSkip = 0,
    toArray = false
  ) {
    var remindersToString = toArray ? new Array() : "";
    console.log({ numberOfReminders });
    for (let i = 0; i < numberOfReminders; i++) {
      if (reminderArray[i] === undefined) {
        numberOfReminders = i;
        fn.sendErrorMessage(
          message,
          `**REMINDERS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`
        );
        break;
      }
      const reminderString = `__**Reminder ${
        i + entriesToSkip + 1
      }:**__\n${await this.reminderDocumentToString(
        bot,
        reminderArray[i],
        userTimezoneOffset
      )}`;
      if (toArray) remindersToString.push(reminderString);
      else {
        remindersToString = `${remindersToString}${reminderString}`;
        if (i !== numberOfReminders - 1) {
          remindersToString += "\n\n";
        }
      }
    }
    return remindersToString;
  },

  // updateTrackingReportReminder: async function (bot, userID) {
  //     const currentTrackReminders = await Reminder.find({ userID, title: "Voice Channel Tracking" });
  //     if (currentTrackReminders) if (currentTrackReminders.length) {
  //         for (const reminder of currentTrackReminders) {
  //             const newReminder = await Reminder.findByIdAndUpdate(reminder._id,
  //                 {
  //                     $set: { message: await fn.getTrackingReportString(bot, userID, true) }
  //                 }, { new: true });
  //             // if (newReminder) {
  //             //     console.log({ reminders });
  //             //     this.cancelReminderById(reminder._id);
  //             //     console.log({ reminders });
  //             //     await this.sendReminderByObject(bot, newReminder);
  //             //     console.log({ reminders });
  //             // }
  //         }
  //         return true;
  //     }
  //     return false;
  // },

  reminderDocumentToString: async function (
    bot,
    reminderDocument,
    userTimezoneOffset = 0,
    replaceRoles = true
  ) {
    if (reminderDocument.title === "Voice Channel Tracking") {
      // const success = await this.updateTrackingReportReminder(bot, reminderDocument.userID);
      // if (success) {
      reminderDocument = await Reminder.findById(reminderDocument._id);
      reminderDocument.message = await fn.getTrackingReportString(
        bot,
        reminderDocument.userID,
        true
      );
      await Reminder.updateOne(
        { _id: reminderDocument._id },
        {
          $set: { message: reminderDocument.message },
        }
      );
      // }
    }
    const {
      isDM,
      isRecurring,
      channel,
      startTime,
      endTime,
      message,
      title,
      interval,
      remainingOccurrences,
      guildID,
    } = reminderDocument;
    const titleString = `**Title:** ${title}\n`;
    const typeString =
      "**Type:**" +
      (isRecurring ? " Repeating" : " One-Time") +
      (isDM ? ", DM" : ", Channel");
    const intervalString =
      (isRecurring ? `**Interval:** Every ${interval}\n` : "") +
      (remainingOccurrences && remainingOccurrences !== 0
        ? `**Reminders Left:** ${remainingOccurrences}\n`
        : "");
    const channelName = isDM
      ? ""
      : `**Channel:** ${
          bot.channels.cache.get(channel)
            ? `\#${bot.channels.cache.get(channel).name}`
            : fn.getChannelMentionToTextString(bot, `<#${channel}>`, true)
        }\n`;
    const guildString = isDM
      ? ""
      : `**Guild:** ${
          bot.guilds.cache.get(guildID)
            ? bot.guilds.cache.get(guildID).name
            : ""
        }\n`;
    console.log({ reminderDocument });

    let outputString = `${titleString}${typeString}\n${intervalString}${guildString}${channelName}**Start Time:** ${fn.timestampToDateString(
      startTime + HOUR_IN_MS * userTimezoneOffset
    )}\n**End Time:** ${fn.timestampToDateString(
      endTime + HOUR_IN_MS * userTimezoneOffset
    )}\n**Message:** ${
      replaceRoles
        ? this.getProperReminderMessageRoles(bot, guildID, message)
        : message
    }`;

    outputString = fn.getRoleMentionToTextString(bot, outputString);
    return outputString;
  },

  getProperReminderMessageRoles: function (bot, guildID, message) {
    if (!guildID) return message;
    const roleRegex = /\<\@\&(\d+)\>/g;
    const roles = message.replace(
      roleRegex,
      (match, roleID, offset, string) => {
        const guild = bot.guilds.cache.get(guildID);
        if (guild) {
          const role = guild.roles.cache.get(roleID);
          if (role) {
            return `\@${role.name}`;
          }
        }
        return match;
      }
    );
    return roles;
  },

  getRecentReminderIndex: async function (userID, isRecurring = undefined) {
    try {
      var index;
      const userReminders = await Reminder.find({ userID, isRecurring }).sort({
        endTime: +1,
      });
      console.log({ userReminders });
      if (userReminders) {
        if (userReminders.length) {
          let targetID = await Reminder.findOne({ userID, isRecurring }).sort({
            _id: -1,
          });
          targetID = targetID._id.toString();
          console.log({ targetID });
          for (let i = 0; i < userReminders.length; i++) {
            if (userReminders[i]._id.toString() === targetID) {
              index = i + 1;
              return index;
            }
          }
        }
      } else return -1;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  getReminderIndexByEndTime: async function (userID, reminderID, isRecurring) {
    const totalReminders = await this.getTotalReminders(userID, isRecurring);
    let i = 0;
    while (true) {
      let reminder = await this.getOneReminderByEndTime(userID, i, isRecurring);
      if (reminder === undefined && i === totalReminders) {
        return false;
      } else if (reminder._id.toString() == reminderID.toString()) break;
      i++;
    }
    return i + 1;
  },

  getReminderIndexByRecency: async function (userID, reminderID, isRecurring) {
    const totalReminders = await this.getTotalReminders(userID, isRecurring);
    let i = 0;
    while (true) {
      let reminder = await this.getOneReminderByRecency(userID, i, isRecurring);
      if (reminder === undefined && i === totalReminders) {
        return false;
      } else if (reminder._id.toString() == reminderID.toString()) break;
      i++;
    }
    return i + 1;
  },

  getOneReminderByEndTime: async function (userID, reminderIndex, isRecurring) {
    const reminder = await Reminder.findOne({ userID, isRecurring })
      .sort({ endTime: +1 })
      .skip(reminderIndex)
      .catch((err) => {
        console.log(err);
        return false;
      });
    return reminder;
  },

  getOneReminderByRecency: async function (userID, reminderIndex, isRecurring) {
    const reminder = await Reminder.findOne({ userID, isRecurring })
      .sort({ _id: -1 })
      .skip(reminderIndex)
      .catch((err) => {
        console.log(err);
        return false;
      });
    return reminder;
  },

  getMostRecentReminder: async function (
    bot,
    userID,
    isRecurring,
    userTimezoneOffset,
    embedColour = reminderEmbedColour
  ) {
    const recentReminderToString = `__**Reminder ${await this.getRecentReminderIndex(
      userID,
      isRecurring
    )}:**__\n${await this.reminderDocumentToString(
      bot,
      await this.getOneReminderByRecency(userID, 0, isRecurring),
      userTimezoneOffset
    )}`;
    const reminderEmbed = fn.getMessageEmbed(
      recentReminderToString,
      `Reminder: See Recent Reminder`,
      embedColour
    );
    return reminderEmbed;
  },

  getUserFirstRecurringEndDuration: async function (
    bot,
    message,
    PREFIX,
    helpMessage,
    userTimezoneOffset,
    userDaylightSavingSetting,
    isRecurring,
    type = "Recurring Reminder",
    embedColour = fn.repeatReminderEmbedColour,
    timeExamples = fn.timeExamples
  ) {
    var firstEndTime, error, startTimestamp;
    do {
      error = false;
      const reminderPrompt = `__**When do you intend to start the first ${
        isRecurring ? "recurring " : ""
      }reminder?**__\n\n${timeExamples}\n\nType \`skip\` to **start it now**`;
      const userTimeInput = await fn.messageDataCollect(
        bot,
        message.author.id,
        message.channel.id,
        PREFIX,
        reminderPrompt,
        type
          ? `${type}: First Reminder`
          : `${isRecurring ? "Repeat " : ""}Reminder: First Reminder`,
        embedColour
          ? embedColour
          : isRecurring
          ? repeatEmbedColour
          : reminderEmbedColour
      );
      if (!userTimeInput || userTimeInput === "stop") return false;
      startTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
      if (userTimeInput === "skip" || userTimeInput.toLowerCase() === "now")
        firstEndTime = startTimestamp;
      else {
        console.log({ error });
        // Undo the timezoneOffset to get the end time in UTC
        const timeArgs = userTimeInput.toLowerCase().split(/[\s\n]+/);
        firstEndTime = fn.timeCommandHandlerToUTC(
          timeArgs[0] !== "in" ? ["in"].concat(timeArgs) : timeArgs,
          startTimestamp,
          userTimezoneOffset,
          userDaylightSavingSetting
        );
        if (!firstEndTime) error = true;
        else firstEndTime -= HOUR_IN_MS * userTimezoneOffset;
        console.log({ error });
      }
      console.log({ error });
      if (!error) {
        if (firstEndTime >= startTimestamp) {
          const duration = firstEndTime - startTimestamp;
          // const confirmReminder = await fn..getUserConfirmation(bot,message.author.id, message.channel.id, PREFIX,
          //     `Are you sure you want to **start the first reminder** after **${fn.millisecondsToTimeString(duration)}**?`,
          //     forceSkip, "Repeat Reminder: First Reminder Confirmation");
          // if (confirmReminder) return duration;
          return duration;
        } else error = true;
      }
      console.log({ error });
      if (error)
        fn.sendReplyThenDelete(
          message,
          `**Please enter a proper time in the future**... ${helpMessage} for **valid time inputs!**`,
          30000
        );
    } while (true);
  },

  getChannelOrDM: async function (
    bot,
    message,
    PREFIX,
    instructions = 'Please enter a **target channel (using #)** or "**DM**":',
    title = "Enter Channel or DM",
    allowDMs = true,
    embedColour = fn.defaultEmbedColour,
    dataCollectDelay = 300000,
    errorReplyDelay = 60000
  ) {
    let spamDetails = {
      lastTimestamp: null,
      closeMessageCount: 0,
    };
    var channel;
    do {
      channel = await fn.messageDataCollect(
        bot,
        message.author.id,
        message.channel.id,
        PREFIX,
        instructions,
        title,
        embedColour,
        dataCollectDelay,
        false
      );
      var currentTimestamp;
      if (!channel || channel === "stop") return false;
      else if (channel) currentTimestamp = Date.now();
      else if (channel.startsWith(PREFIX) && channel !== PREFIX) {
        message.reply(
          `Any **command calls** while writing a message will **stop** the collection process.\n**__Command Entered:__** ${channel}`
        );
        return false;
      }
      if (allowDMs && channel.toLowerCase() === "dm")
        return channel.toUpperCase();
      else {
        channel = /(\<\#\d+\>)/.exec(channel);
        if (channel) return channel[1];
        else
          fn.sendReplyThenDelete(
            message,
            `Please enter a **valid channel**${
              allowDMs ? ` or \"**DM**\"` : ""
            }`,
            errorReplyDelay
          );
      }
      // Spam Prevention:
      if (spamDetails) {
        const messageSendDelay =
          (currentTimestamp || Date.now()) - (spamDetails.lastTimestamp || 0);
        console.log({ messageSendDelay });
        spamDetails.lastTimestamp = currentTimestamp || Date.now();
        if (messageSendDelay < 2500) {
          spamDetails.closeMessageCount++;
        }
        if (spamDetails.closeMessageCount >= 5) {
          console.log("Exiting due to spam...");
          message.reply("**Exiting... __Please don't spam!__**");
          return false;
        }
        if (spamDetails.closeMessageCount === 0) {
          setTimeout(() => {
            if (spamDetails) spamDetails.closeMessageCount = 0;
          }, 30000);
        }
        console.log({ spamDetails });
      }
    } while (true);
  },

  getEditInterval: async function (
    bot,
    message,
    PREFIX,
    timezoneOffset,
    daylightSetting,
    field,
    instructionPrompt,
    title,
    embedColour = fn.defaultEmbedColour,
    minimumInterval = 60000,
    errorReplyDelay = 60000,
    intervalExamples = fn.intervalExamplesOver1Minute
  ) {
    do {
      let interval = await fn.getUserEditString(
                bot,
                message.author.id,
                message.channel.id,
        PREFIX,
        field,
        `${instructionPrompt}\n\n${intervalExamples}`,
        title,
        true,
        embedColour
      );
      if (!interval || interval === "stop") return false;
      else if (interval === "back") return interval;
      const timeArgs = interval.toLowerCase().split(/[\s\n]+/);
      interval = await this.getProcessedInterval(
        bot,
        message.author.id,
        message.channel.id,
        timeArgs,
        PREFIX,
        timezoneOffset,
        daylightSetting,
        minimumInterval,
        errorReplyDelay
      );
      if (!interval) continue;
      else return interval;
    } while (true);
  },

  getEditEndTime: async function (
    bot,
    message,
    PREFIX,
    reminderHelpMessage,
    timezoneOffset,
    daylightSavingsSetting,
    forceSkip,
    isRecurring,
    reminderMessage,
    isDM,
    channelID = false,
    intervalDuration = false
  ) {
    let duration = await this.getUserFirstRecurringEndDuration(
      bot,
      message,
      PREFIX,
      reminderHelpMessage,
      timezoneOffset,
      daylightSavingsSetting,
      isRecurring,
      isRecurring ? "Recurring Reminder" : "Reminder",
      isRecurring ? repeatEmbedColour : reminderEmbedColour
    );
    console.log({ duration });
    if (!duration && duration !== 0) return false;
    duration = duration > 0 ? duration : 0;
    const channel = isDM ? "DM" : bot.channels.cache.get(channelID);
    const confirmCreationMessage = `Are you sure you want to set the following **${
      isRecurring ? "recurring" : "one-time"
    } reminder** to send - **in ${
      channel.name ? channel.name : "DM"
    } after ${fn.millisecondsToTimeString(duration)}**${
      isRecurring
        ? ` (and repeat every **${fn.millisecondsToTimeString(
            intervalDuration
          )}**)`
        : ""
    }:\n\n${reminderMessage}`;
    const confirmCreation = await fn.getUserConfirmation(
      bot,
      message.author.id,
      message.channel.id,
      PREFIX,
      confirmCreationMessage,
      forceSkip,
      `${isRecurring ? "Recurring " : ""}Reminder: Confirm Creation`,
      180000
    );
    if (!confirmCreation) return false;
    else {
      const currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
      console.log({ currentTimestamp });
      let userPermissions =
        channel !== "DM" ? channel.permissionsFor(authorID) : false;
      console.log({ userPermissions });
      if (userPermissions) {
        if (
          !userPermissions.has("SEND_MESSAGES") ||
          !userPermissions.has("VIEW_CHANNEL")
        ) {
          message.reply(
            `You are **not authorized to send messages** to that channel...`
          );
          return false;
        }
      }
      message.reply(
        `Your **${
          isRecurring ? "recurring" : "one-time"
        } reminder** has been set to trigger in **${fn.millisecondsToTimeString(
          duration
        )}** from now!`
      );
      return currentTimestamp + duration;
    }
  },

  getRemainingOccurrences: async function (
    bot,
    message,
    PREFIX,
    type,
    embedColour
  ) {
    try {
      let remainingOccurrences = await fn.userSelectFromList(
        bot,
        message.author.id,
        message.channel.id,
        PREFIX,
        "`1` - **Keep repeating** 🔁\n`2` - **Repeat a certain number of times** 🔢",
        2,
        "Would you like this reminder to repeat indefinitely or repeat a fixed number of times?",
        `${type}: Number of Occurrences`,
        embedColour,
        300000
      );
      if (!remainingOccurrences && remainingOccurrences !== 0)
        return remainingOccurrences;

      if (remainingOccurrences === 0) {
        remainingOccurrences = undefined;
      } else if (remainingOccurrences === 1) {
        let numberOfRepeats = await fn.getNumberEntry(
                bot,
                message.author.id,
                message.channel.id,
          PREFIX,
          "**How many times do you want this reminder to repeat?**\n(Enter a positive whole number or `0` to repeat indefinitely)",
          `${type}: Number of Occurrences`,
          true,
          false,
          false,
          0,
          undefined,
          embedColour
        );
        if (!numberOfRepeats && numberOfRepeats !== 0) return numberOfRepeats;
        else if (numberOfRepeats === 0) remainingOccurrences = undefined;
        else remainingOccurrences = numberOfRepeats;
      }
      return remainingOccurrences;
    } catch (err) {
      console.log(err);
      return false;
    }
  },

  getInterval: async function (
    bot,
    message,
    PREFIX,
    timezoneOffset,
    daylightSetting,
    instructions = "__**Please enter the time you'd like in-between recurring reminders (interval):**__",
    title = "Interval",
    embedColour = fn.defaultEmbedColour,
    minimumInterval = 60000,
    dataCollectDelay = 300000,
    errorReplyDelay = 60000,
    intervalExamples = fn.intervalExamplesOver1Minute
  ) {
    do {
      let interval = await fn.messageDataCollect(
        bot,
        message.author.id,
        message.channel.id,
        PREFIX,
        `${instructions}\n\n${intervalExamples}`,
        title,
        embedColour,
        dataCollectDelay,
        false,
        false
      );
      if (!interval || interval === "stop") return false;
      const timeArgs = interval.toLowerCase().split(" ");
      interval = await this.getProcessedInterval(
        bot,
        message.author.id,
        message.channel.id,
        timeArgs,
        PREFIX,
        timezoneOffset,
        daylightSetting,
        minimumInterval,
        errorReplyDelay
      );
      if (!interval) continue;
      else return interval;
    } while (true);
  },

  getProcessedInterval: async function (
    bot,
    userID,
    channelID,
    timeArgs,
    PREFIX,
    timezoneOffset,
    daylightSetting,
    minimumInterval = 60000,
    errorReplyDelay = 60000
  ) {
    let now = Date.now();
    const adjustedTimeArgs =
      timeArgs[0] !== "in" ? ["in"].concat(timeArgs) : timeArgs;
    interval = fn.timeCommandHandlerToUTC(
      adjustedTimeArgs,
      now,
      timezoneOffset,
      daylightSetting,
      true,
      true,
      true
    );
    if (!interval) {
      await sd.reply(bot, channelID, `**INVALID Interval**...** \`${PREFIX}date\` **for **valid time inputs!**`, userID, {delete: true, timeout: errorReplyDelay});
      return false;
    } else now = fn.getCurrentUTCTimestampFlooredToSecond();
    interval -= now + HOUR_IN_MS * timezoneOffset;
    if (interval <= 0) {
      await sd.reply(bot, channelID, `**INVALID Interval**... ${PREFIX}date for **valid time inputs!**`, userID, {delete: true, timeout: errorReplyDelay});
      return false;
    } else if (interval < minimumInterval) {
      await sd.reply(bot, channelID, `**INVALID Interval**... ${PREFIX}date for **valid time inputs!**`, userID, {delete: true, timeout: errorReplyDelay});
      return false;
    } else return { args: timeArgs.join(" "), duration: interval };
  },

  MINIMUM_INTERVAL,
};
