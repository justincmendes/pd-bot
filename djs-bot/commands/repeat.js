// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const User = require("../database/schemas/user");
const Reminder = require("../database/schemas/reminder");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
require("dotenv").config();

const validTypes = fn.reminderTypes;
const repeatMax = fn.repeatMaxTier1;
const repeatEmbedColour = fn.repeatReminderEmbedColour;
const reminderType = "Repeating Reminder";
const HOUR_IN_MS = fn.HOUR_IN_MS;

// ADD Feature to prevent spam:
// <BLACKLISTING>: Preventing certain roles or certain users from setting repeat reminders
// THAT @MENTION OTHER ROLES! (diffuse their pings)

// For channel reminders, as the user for confirmation when no @mentions are found
// in the message - so that the user is aware that no one will directly be notified!

// Function Declarations and Definitions

module.exports = {
  name: "repeat",
  description: "Set a personal or group RECURRING reminder",
  aliases: [
    "rr",
    "ar",
    "recur",
    "recurring",
    "schedule",
    "sch",
    "sched",
    "auto",
  ],
  cooldown: 1.5,
  args: false,
  run: async function run(
    bot,
    message,
    commandUsed,
    args,
    PREFIX,
    timezoneOffset,
    daylightSavingsSetting,
    forceSkip
  ) {
    // Variable Declarations and Initializations
    const authorID = message.author.id;
    const authorUsername = message.author.username;
    let repeatUsageMessage =
      `**USAGE** (Recurring Reminder)\n\`${PREFIX}${commandUsed} <ACTION?> <force?>\`` +
      `\n\n\`<ACTION?>\`: **see; edit; remove** (NO ACTION is you want to set a recurring reminder up)\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**If you want to set a one-time reminder, try \`${PREFIX}reminder <force?>\`` +
      `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join("; ")}**`;
    repeatUsageMessage = fn.getMessageEmbed(
      repeatUsageMessage,
      "Recurring Reminder: Help",
      repeatEmbedColour
    );
    const repeatHelpMessage = `Try \`${PREFIX}${commandUsed} help\``;
    const reminderCommand = args[0] ? args[0].toLowerCase() : false;
    const reminderIndex = args[1] ? args[1].toLowerCase() : false;
    const totalReminderNumber = await rm.getTotalReminders(authorID, true);
    if (totalReminderNumber === false) return;

    if (reminderCommand === "help") {
      return message.channel.send(repeatUsageMessage);
    }

    const reminderActionHelpMessage = `Try \`${PREFIX}${commandUsed} ${reminderCommand} help\``;
    const userSettings = await User.findOne({ discordID: authorID });
    const { tier } = userSettings;

    if (
      reminderCommand === "delete" ||
      reminderCommand === "del" ||
      reminderCommand === "d" ||
      reminderCommand === "remove" ||
      reminderCommand === "rem" ||
      reminderCommand === "r"
    ) {
      let reminderDeleteUsageMessage = fn.getReadOrDeleteUsageMessage(
        PREFIX,
        commandUsed,
        reminderCommand,
        true,
        ["Reminder", "Reminders"]
      );
      reminderDeleteUsageMessage = fn.getMessageEmbed(
        reminderDeleteUsageMessage,
        "Recurring Reminder: Delete Help",
        repeatEmbedColour
      );
      const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see help\``;

      if (reminderIndex) {
        if (reminderIndex === "help") {
          return message.channel.send(reminderDeleteUsageMessage);
        }
        if (!totalReminderNumber) {
          return message.reply(
            `**NO RECURRING REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        }
      } else return message.reply(reminderActionHelpMessage);

      // delete past #:
      if (args[2] !== undefined) {
        const deleteType = reminderIndex;
        if (deleteType === "past") {
          // If the following argument is not a number, exit!
          if (isNaN(args[2])) {
            return fn.sendErrorMessageAndUsage(
              message,
              reminderActionHelpMessage
            );
          }
          var numberArg = parseInt(args[2]);
          if (numberArg <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              reminderActionHelpMessage
            );
          }
          let indexByRecency = false;
          if (args[3] !== undefined) {
            if (args[3].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          const sortType = indexByRecency ? "By Recency" : "By End Time";
          var reminderCollection;
          if (indexByRecency)
            reminderCollection = await fn.getEntriesByRecency(
              Reminder,
              { userID: authorID, isRecurring: true },
              0,
              numberArg
            );
          else
            reminderCollection = await fn.getEntriesByEarliestEndTime(
              Reminder,
              { userID: authorID, isRecurring: true },
              0,
              numberArg
            );
          const reminderStringArray = fn.getEmbedArray(
            await rm.multipleRemindersToString(
              bot,
              message,
              reminderCollection,
              numberArg,
              timezoneOffset,
              0,
              true
            ),
            "",
            true,
            false,
            repeatEmbedColour
          );
          // If the message is too long, the confirmation window didn't pop up and it defaulted to false!
          const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} reminder(s)?**`;
          const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            reminderStringArray,
            multipleDeleteMessage,
            forceSkip,
            `Recurring Reminder: Delete Past ${numberArg} Reminders (${sortType})`,
            600000
          );
          if (!multipleDeleteConfirmation) return;
          const targetIDs = await reminderCollection.map(
            (reminder) => reminder._id
          );
          if (targetIDs)
            if (targetIDs.length) {
              console.log(
                `Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Reminders (${sortType})`
              );
              targetIDs.forEach((id) => {
                rm.cancelReminderById(id);
              });
              await Reminder.deleteMany({ _id: { $in: targetIDs } });
            }
          return;
        }
        if (deleteType === "many") {
          if (args[2] === undefined) {
            return message.reply(reminderActionHelpMessage);
          }
          // Get the arguments after keyword MANY
          // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
          // Convert String of Numbers array into Integer array
          // Check which reminder exist, remove/don't add those that don't
          let toDelete = args[2].split(",").filter((index) => {
            if (!isNaN(index)) {
              numberIndex = parseInt(index);
              if (numberIndex > 0 && numberIndex <= totalReminderNumber) {
                return numberIndex;
              }
            } else if (index === "recent") {
              return true;
            }
          });
          const recentIndex = await rm.getRecentReminderIndex(authorID, true);
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
              "All of these **reminders DO NOT exist**..."
            );
          }
          var indexByRecency = false;
          if (args[3] !== undefined) {
            if (args[3].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          var reminderTargetIDs = new Array();
          var reminderStringArray = new Array();
          for (let i = 0; i < toDelete.length; i++) {
            var reminderDocument;
            if (indexByRecency) {
              reminderDocument = await rm.getOneReminderByRecency(
                authorID,
                toDelete[i] - 1,
                true
              );
            } else
              reminderDocument = await rm.getOneReminderByEndTime(
                authorID,
                toDelete[i] - 1,
                true
              );
            reminderTargetIDs.push(reminderDocument._id);
            reminderStringArray.push(
              `__**Reminder ${
                toDelete[i]
              }:**__\n${await rm.reminderDocumentToString(
                bot,
                reminderDocument,
                timezoneOffset
              )}`
            );
          }
          const deleteConfirmMessage = `Are you sure you want to **delete reminders ${toDelete.toString()}?**`;
          const sortType = indexByRecency ? "By Recency" : "By End Time";
          reminderStringArray = fn.getEmbedArray(
            reminderStringArray,
            "",
            true,
            false,
            repeatEmbedColour
          );
          const confirmDeleteMany = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            reminderStringArray,
            deleteConfirmMessage,
            forceSkip,
            `Recurring Reminder: Delete Reminders ${toDelete} (${sortType})`,
            600000
          );
          if (confirmDeleteMany)
            if (reminderTargetIDs)
              if (reminderTargetIDs.length) {
                console.log(
                  `Deleting ${authorID}'s Reminders ${toDelete} (${sortType})`
                );
                reminderTargetIDs.forEach((id) => {
                  rm.cancelReminderById(id);
                });
                await Reminder.deleteMany({ _id: { $in: reminderTargetIDs } });
              }
          return;
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
                  skipEntries = await rm.getRecentReminderIndex(authorID, true);
                } else return message.reply(reminderActionHelpMessage);
              } else skipEntries = parseInt(args[3 + shiftIndex]);
              const pastNumberOfEntries = parseInt(args[1]);
              if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                return fn.sendErrorMessageAndUsage(
                  message,
                  reminderActionHelpMessage
                );
              }
              var reminderCollection;
              if (indexByRecency)
                reminderCollection = await fn.getEntriesByRecency(
                  Reminder,
                  { userID: authorID, isRecurring: true },
                  skipEntries,
                  pastNumberOfEntries
                );
              else
                reminderCollection = await fn.getEntriesByEarliestEndTime(
                  Reminder,
                  { userID: authorID, isRecurring: true },
                  skipEntries,
                  pastNumberOfEntries
                );
              const reminderStringArray = fn.getEmbedArray(
                await rm.multipleRemindersToString(
                  bot,
                  message,
                  reminderCollection,
                  pastNumberOfEntries,
                  timezoneOffset,
                  skipEntries,
                  true
                ),
                "",
                true,
                false,
                repeatEmbedColour
              );
              if (skipEntries >= totalReminderNumber) return;
              const sortType = indexByRecency ? "By Recency" : "By End Time";
              const multipleDeleteMessage = `Are you sure you want to **delete ${reminderCollection.length} reminder(s) past reminder ${skipEntries}?**`;
              const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
                bot,
                message,
                PREFIX,
                reminderStringArray,
                multipleDeleteMessage,
                forceSkip,
                `Recurring Reminder: Multiple Delete Warning! (${sortType})`
              );
              if (!multipleDeleteConfirmation) return;
              const targetIDs = await reminderCollection.map(
                (reminder) => reminder._id
              );
              if (targetIDs)
                if (targetIDs.length) {
                  console.log(
                    `Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} reminder(s) past ${skipEntries} (${sortType})`
                  );
                  targetIDs.forEach((id) => {
                    rm.cancelReminderById(id);
                  });
                  await Reminder.deleteMany({ _id: { $in: targetIDs } });
                }
              return;
            }

            // They haven't specified the field for the reminder delete past function
            else if (deleteType === "past")
              return message.reply(reminderActionHelpMessage);
            else return message.reply(reminderActionHelpMessage);
          }
        }
      }
      // Next: REMINDER DELETE ALL
      // Next: REMINDER DELETE MANY
      // Next: REMINDER DELETE

      // reminder delete <NUMBER/RECENT/ALL>
      const noRemindersMessage = `**NO RECURRING REMINDERS**... try \`${PREFIX}${commandUsed} start help\``;
      if (isNaN(args[1])) {
        const deleteType = args[1].toLowerCase();
        if (deleteType === "recent") {
          const reminderView = await rm.getOneReminderByRecency(
            authorID,
            0,
            true
          );
          if (reminderView.length === 0) {
            return fn.sendErrorMessage(message, noRemindersMessage);
          }
          const reminderTargetID = reminderView._id;
          console.log({ reminderTargetID });
          const reminderIndex = await rm.getRecentReminderIndex(authorID, true);
          const reminderEmbed = fn.getEmbedArray(
            `__**Reminder ${reminderIndex}:**__\n${await rm.reminderDocumentToString(
              bot,
              reminderView,
              timezoneOffset
            )}`,
            `Recurring Reminder: Delete Recent Reminder`,
            true,
            false,
            repeatEmbedColour
          );
          const deleteConfirmMessage = `Are you sure you want to **delete your most recent reminder?**`;
          const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(
            bot,
            message,
            PREFIX,
            reminderEmbed,
            deleteConfirmMessage,
            forceSkip,
            `Recurring Reminder: Delete Recent Reminder`,
            600000
          );
          if (deleteIsConfirmed)
            if (reminderTargetID) {
              console.log(
                `Deleting ${authorUsername}'s (${authorID}) recent reminder`
              );
              rm.cancelReminderById(reminderTargetID);
              await Reminder.deleteOne({ _id: reminderTargetID });
            }
          return;
        } else if (deleteType === "all") {
          const confirmDeleteAllMessage = `Are you sure you want to **delete all** of your recorded recurring reminders?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          const pastNumberOfEntriesIndex = totalReminderNumber;
          if (pastNumberOfEntriesIndex === 0) {
            return fn.sendErrorMessage(message, noRemindersMessage);
          }
          let confirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            confirmDeleteAllMessage,
            forceSkip,
            "Recurring Reminder: Delete All Recurring Reminders WARNING!"
          );
          if (!confirmDeleteAll) return;
          const finalDeleteAllMessage = `Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR RECURRING REMINDERS ON RECORD**?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          let finalConfirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message,
            PREFIX,
            finalDeleteAllMessage,
            false,
            "Recurring Reminder: Delete ALL Recurring Reminders FINAL Warning!"
          );
          if (!finalConfirmDeleteAll) return;

          console.log(
            `Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Reminders`
          );
          const reminderQuery = { userID: authorID, isRecurring: false };
          const reminders = await Reminder.find(reminderQuery);
          reminders.forEach((reminder) => {
            rm.cancelReminderById(reminder._id);
          });
          await Reminder.deleteMany(reminderQuery);
          return;
        } else return message.reply(reminderActionHelpMessage);
      } else {
        const pastNumberOfEntriesIndex = parseInt(args[1]);
        let indexByRecency = false;
        if (args[2] !== undefined) {
          if (args[2].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }
        var reminderDocument;
        if (indexByRecency)
          reminderDocument = await rm.getOneReminderByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1,
            true
          );
        else
          reminderDocument = await rm.getOneReminderByEndTime(
            authorID,
            pastNumberOfEntriesIndex - 1,
            true
          );
        if (!reminderDocument) {
          return fn.sendErrorMessageAndUsage(
            message,
            trySeeCommandMessage,
            "**REMINDER DOES NOT EXIST**..."
          );
        }
        const reminderTargetID = reminderDocument._id;
        const sortType = indexByRecency ? "By Recency" : "By End Time";
        const reminderEmbed = fn.getEmbedArray(
          `__**Reminder ${pastNumberOfEntriesIndex}:**__\n${await rm.reminderDocumentToString(
            bot,
            reminderDocument,
            timezoneOffset
          )}`,
          `Recurring Reminder: Delete Reminder ${pastNumberOfEntriesIndex} (${sortType})`,
          true,
          false,
          repeatEmbedColour
        );
        const deleteConfirmMessage = `Are you sure you want to **delete Reminder ${pastNumberOfEntriesIndex}?**`;
        const deleteConfirmation = await fn.getPaginatedUserConfirmation(
          bot,
          message,
          PREFIX,
          reminderEmbed,
          deleteConfirmMessage,
          forceSkip,
          `Recurring Reminder: Delete Reminder ${pastNumberOfEntriesIndex} (${sortType})`,
          600000
        );
        if (deleteConfirmation)
          if (reminderTargetID) {
            console.log(
              `Deleting ${authorUsername}'s (${authorID}) Reminder ${sortType}`
            );
            rm.cancelReminderById(reminderTargetID);
            await Reminder.deleteOne({ _id: reminderTargetID });
          }
        return;
      }
    } else if (reminderCommand === "see" || reminderCommand === "show") {
      let reminderSeeUsageMessage = fn.getReadOrDeleteUsageMessage(
        PREFIX,
        commandUsed,
        reminderCommand,
        true,
        ["Reminder", "Reminders"]
      );
      reminderSeeUsageMessage = fn.getMessageEmbed(
        reminderSeeUsageMessage,
        "Recurring Reminder: See Help",
        repeatEmbedColour
      );
      if (reminderIndex) {
        if (reminderIndex === "help") {
          return message.channel.send(reminderSeeUsageMessage);
        }
        if (!totalReminderNumber) {
          return message.reply(
            `**NO RECURRING REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        }
      } else return message.reply(reminderActionHelpMessage);

      const seeCommands = ["past", "recent", "all"];

      if (reminderIndex) {
        if (reminderIndex === "help") {
          return message.channel.send(reminderSeeUsageMessage);
        }
        if (!totalReminderNumber) {
          return message.reply(
            `**NO RECURRING REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        } else if (reminderIndex === "number") {
          return message.reply(
            `You have **${totalReminderNumber} reminders** on record.`
          );
        }
      } else return message.reply(reminderActionHelpMessage);

      // Show the user the last reminder with the most recent end time (by sorting from largest to smallest end time and taking the first):
      // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort.
      // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
      if (!seeCommands.includes(reminderIndex) && isNaN(reminderIndex)) {
        return message.reply(reminderActionHelpMessage);
      }
      // Do not show the most recent reminder embed, when a valid command is called
      // it will be handled properly later based on the values passed in!
      else {
        const seeType = reminderIndex;
        var pastFunctionality, pastNumberOfEntriesIndex;
        let indexByRecency = false;
        // To check if the given argument is a number!
        // If it's not a number and has passed the initial
        // filter, then use the "past" functionality
        // Handling Argument 1:
        const isNumberArg = !isNaN(args[1]);
        if (seeType === "recent") {
          return message.channel.send(
            await rm.getMostRecentReminder(
              bot,
              authorID,
              true,
              timezoneOffset,
              repeatEmbedColour
            )
          );
        } else if (seeType === "all") {
          pastNumberOfEntriesIndex = totalReminderNumber;
          pastFunctionality = true;
        } else if (isNumberArg) {
          pastNumberOfEntriesIndex = parseInt(args[1]);
          if (pastNumberOfEntriesIndex <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              reminderActionHelpMessage,
              "**REMINDER DOES NOT EXIST**..."
            );
          } else pastFunctionality = false;
        } else if (seeType === "past") {
          pastFunctionality = true;
        }
        // After this filter:
        // If the first argument after "see" is not past, then it is not a valid call
        else {
          message.channel.send(
            await rm.getMostRecentReminder(
              bot,
              authorID,
              true,
              timezoneOffset,
              repeatEmbedColour
            )
          );
          return message.reply(reminderActionHelpMessage);
        }
        console.log({ pastNumberOfEntriesIndex, pastFunctionality });
        if (pastFunctionality) {
          // Loop through all of the given fields, account for aliases and update fields
          // Find Entries, toArray, store data in meaningful output
          if (args[3] !== undefined) {
            if (args[3].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          const sortType = indexByRecency ? "By Recency" : "By End Time";
          if (args[2] !== undefined) {
            // If the next argument is NotaNumber, invalid "past" command call
            if (isNaN(args[2])) {
              message.channel.send(
                await rm.getMostRecentReminder(
                  bot,
                  authorID,
                  true,
                  timezoneOffset,
                  repeatEmbedColour
                )
              );
              return message.reply(reminderActionHelpMessage);
            }
            if (parseInt(args[2]) <= 0) {
              message.channel.send(
                await rm.getMostRecentReminder(
                  bot,
                  authorID,
                  true,
                  timezoneOffset,
                  repeatEmbedColour
                )
              );
              return message.reply(reminderActionHelpMessage);
            }
            const confirmSeeMessage = `Are you sure you want to **see ${args[2]} reminders?**`;
            let confirmSeeAll = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeMessage,
              forceSkip,
              `Recurring Reminder: See ${args[2]} Reminders (${sortType})`
            );
            if (!confirmSeeAll) return;
          } else {
            // If the next argument is undefined, implied "see all" command call unless "all" was not called:
            // => empty "past" command call
            if (seeType !== "all") {
              message.channel.send(
                await rm.getMostRecentReminder(
                  bot,
                  authorID,
                  true,
                  timezoneOffset,
                  repeatEmbedColour
                )
              );
              return message.reply(reminderActionHelpMessage);
            }
            const confirmSeeAllMessage =
              "Are you sure you want to **see all** of your reminder history?";
            let confirmSeeAll = await fn.getUserConfirmation(
              bot,
              message,
              PREFIX,
              confirmSeeAllMessage,
              forceSkip,
              "Recurring Reminder: See All Reminders"
            );
            if (!confirmSeeAll) return;
          }
          // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
          if (pastNumberOfEntriesIndex === undefined) {
            pastNumberOfEntriesIndex = parseInt(args[2]);
          }
          var reminderDocument;
          if (indexByRecency)
            reminderDocument = await fn.getEntriesByRecency(
              Reminder,
              { userID: authorID, isRecurring: true },
              0,
              pastNumberOfEntriesIndex
            );
          else
            reminderDocument = await fn.getEntriesByEarliestEndTime(
              Reminder,
              { userID: authorID, isRecurring: true },
              0,
              pastNumberOfEntriesIndex
            );
          console.log({ reminderView: reminderDocument });
          const reminderDataToStringArray = await rm.multipleRemindersToString(
            bot,
            message,
            reminderDocument,
            pastNumberOfEntriesIndex,
            timezoneOffset,
            0,
            true
          );
          await fn.sendPaginationEmbed(
            bot,
            message.channel.id,
            authorID,
            fn.getEmbedArray(
              reminderDataToStringArray,
              `Recurring Reminder: See ${pastNumberOfEntriesIndex} Reminders (${sortType})`,
              true,
              `Recurring Reminders ${fn.timestampToDateString(
                Date.now() + timezoneOffset * HOUR_IN_MS,
                false,
                false,
                true,
                true
              )}`,
              repeatEmbedColour
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
          } else return message.reply(reminderActionHelpMessage);
          if (args[2 + shiftIndex]) {
            if (args[2 + shiftIndex].toLowerCase() === "past") {
              if (args[3 + shiftIndex] !== undefined) {
                const sortType = indexByRecency ? "By Recency" : "By End Time";
                var entriesToSkip;
                // If the argument after past is a number, valid command call!
                if (!isNaN(args[3 + shiftIndex])) {
                  entriesToSkip = parseInt(args[3 + shiftIndex]);
                } else if (args[3 + shiftIndex].toLowerCase() === "recent") {
                  entriesToSkip = await rm.getRecentReminderIndex(
                    authorID,
                    true
                  );
                } else return message.reply(reminderActionHelpMessage);
                if (entriesToSkip < 0 || entriesToSkip > totalReminderNumber) {
                  return fn.sendErrorMessageAndUsage(
                    message,
                    reminderActionHelpMessage,
                    "**REMINDER(S) DO NOT EXIST**..."
                  );
                }
                const confirmSeePastMessage = `Are you sure you want to **see ${args[1]} reminders past ${entriesToSkip}?**`;
                const confirmSeePast = await fn.getUserConfirmation(
                  bot,
                  message,
                  PREFIX,
                  confirmSeePastMessage,
                  forceSkip,
                  `Recurring Reminder: See ${args[1]} Reminders Past ${entriesToSkip} (${sortType})`
                );
                if (!confirmSeePast) return;
                var reminderDocument;
                if (indexByRecency)
                  reminderDocument = await fn.getEntriesByRecency(
                    Reminder,
                    { userID: authorID, isRecurring: true },
                    entriesToSkip,
                    pastNumberOfEntriesIndex
                  );
                else
                  reminderDocument = await fn.getEntriesByEarliestEndTime(
                    Reminder,
                    { userID: authorID, isRecurring: true },
                    entriesToSkip,
                    pastNumberOfEntriesIndex
                  );
                console.log({ reminderView: reminderDocument });
                const reminderDataToStringArray = await rm.multipleRemindersToString(
                  bot,
                  message,
                  reminderDocument,
                  pastNumberOfEntriesIndex,
                  timezoneOffset,
                  entriesToSkip,
                  true
                );
                await fn.sendPaginationEmbed(
                  bot,
                  message.channel.id,
                  authorID,
                  fn.getEmbedArray(
                    reminderDataToStringArray,
                    `Recurring Reminder: See ${pastNumberOfEntriesIndex} Reminder Past ${entriesToSkip} (${sortType})`,
                    true,
                    `Recurring Reminders ${fn.timestampToDateString(
                      Date.now() + timezoneOffset * HOUR_IN_MS,
                      false,
                      false,
                      true,
                      true
                    )}`,
                    repeatEmbedColour
                  )
                );
                message.channel.send(reminderEmbed);
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
        var reminderDocument;
        if (indexByRecency)
          reminderDocument = await rm.getOneReminderByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1,
            true
          );
        else
          reminderDocument = await rm.getOneReminderByEndTime(
            authorID,
            pastNumberOfEntriesIndex - 1,
            true
          );
        console.log({ reminderView: reminderDocument });
        if (!reminderDocument) {
          return fn.sendErrorMessage(
            message,
            `**REMINDER ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
          );
        }
        // NOT using the past functionality:
        const sortType = indexByRecency ? "By Recency" : "By End Time";
        const reminderDataToString =
          `__**Reminder ${pastNumberOfEntriesIndex}:**__\n` +
          (await rm.reminderDocumentToString(
            bot,
            reminderDocument,
            timezoneOffset
          ));
        const reminderEmbed = fn.getEmbedArray(
          reminderDataToString,
          `Recurring Reminder: See Reminder ${pastNumberOfEntriesIndex} (${sortType})`,
          true,
          `Recurring Reminder ${fn.timestampToDateString(
            Date.now() + timezoneOffset * HOUR_IN_MS,
            false,
            false,
            true,
            true
          )}`,
          repeatEmbedColour
        );
        await fn.sendPaginationEmbed(
          bot,
          message.channel.id,
          authorID,
          reminderEmbed
        );
      }
    }

    // EDIT
    else if (
      reminderCommand === "edit" ||
      reminderCommand === "ed" ||
      reminderCommand === "update" ||
      reminderCommand === "upd"
    ) {
      let reminderEditUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${reminderCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\`\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; 3** (3rd most recent entry, \\**any number*)\n\n\`<recent?>\`(OPT.): type **recent** at the indicated spot to sort the reminders by **time created instead of reminder start time!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      reminderEditUsageMessage = fn.getMessageEmbed(
        reminderEditUsageMessage,
        `Recurring Reminder: Edit Help`,
        repeatEmbedColour
      );
      if (reminderIndex) {
        if (reminderIndex === "help") {
          return message.channel.send(reminderEditUsageMessage);
        }
        if (!totalReminderNumber) {
          return message.reply(
            `**NO RECURRING REMINDERS**... try \`${PREFIX}${commandUsed} help\` to set one up!`
          );
        }

        if (isNaN(reminderIndex) && reminderIndex !== "recent") {
          return message.reply(reminderActionHelpMessage);
        } else {
          if (reminderIndex === "recent") {
            pastNumberOfEntriesIndex = await rm.getRecentReminderIndex(
              authorID,
              true
            );
          } else {
            pastNumberOfEntriesIndex = parseInt(reminderIndex);
            if (pastNumberOfEntriesIndex <= 0) {
              return fn.sendErrorMessageAndUsage(
                message,
                reminderActionHelpMessage,
                "**REMINDER DOES NOT EXIST**..."
              );
            }
          }

          var indexByRecency = false;
          if (args[2] !== undefined) {
            if (args[2].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          var reminderDocument;
          if (indexByRecency)
            reminderDocument = await rm.getOneReminderByRecency(
              authorID,
              pastNumberOfEntriesIndex - 1,
              true
            );
          else
            reminderDocument = await rm.getOneReminderByEndTime(
              authorID,
              pastNumberOfEntriesIndex - 1,
              true
            );
          if (!reminderDocument) {
            return fn.sendErrorMessageAndUsage(
              message,
              reminderActionHelpMessage,
              `**REMINDER ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
            );
          }
          const sortType = indexByRecency ? "By Recency" : "By End Time";
          const reminderTargetID = reminderDocument._id;
          var showReminder, continueEdit;
          do {
            const checkReminder = await rm.getOneReminderByObjectID(
              reminderTargetID
            );
            if (!checkReminder) return;
            let {
              channel,
              startTime,
              endTime,
              message: reminderMessage,
              isDM,
              isRecurring,
              interval,
              title,
              connectedDocument,
              guildID,
              remainingOccurrences,
            } = reminderDocument;

            var reminderFields = [
              "Type",
              "Send to (DM or Channel)",
              "Start Time",
              "End Time",
              "Message",
              "Repeat",
            ];
            if (isRecurring)
              reminderFields = reminderFields.concat([
                "Interval",
                "Remaining Repetitions",
              ]);

            continueEdit = false;
            showReminder = await rm.reminderDocumentToString(
              bot,
              reminderDocument,
              timezoneOffset
            );
            // Field the user wants to edit
            const fieldToEditInstructions =
              "**Which field do you want to edit?**";
            const fieldToEditAdditionalMessage = `__**Reminder ${pastNumberOfEntriesIndex} (${sortType}):**__\n${showReminder}`;
            const fieldToEditTitle = `Recurring Reminder: Edit Field`;
            var fieldToEdit, fieldToEditIndex;
            const selectedField = await fn.getUserSelectedObject(
              bot,
              message,
              PREFIX,
              fieldToEditInstructions,
              fieldToEditTitle,
              reminderFields,
              "",
              false,
              repeatEmbedColour,
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
              reminderEditMessagePrompt = "";
            switch (fieldToEditIndex) {
              case 0:
                reminderEditMessagePrompt = `\nPlease enter one of the following reminder types:\n**__${validTypes.join(
                  ", "
                )}__**`;
                userEdit = await fn.getUserEditString(
                  bot,
                  message,
                  PREFIX,
                  fieldToEdit,
                  reminderEditMessagePrompt,
                  reminderType,
                  forceSkip,
                  repeatEmbedColour
                );
                break;
              case 1:
                reminderEditMessagePrompt = `Please enter the **channel you'd like to send the reminder to OR "DM"** if you want to get it through a Direct Message:`;
                userEdit = await fn.getUserEditString(
                  bot,
                  message,
                  PREFIX,
                  fieldToEdit,
                  reminderEditMessagePrompt,
                  reminderType,
                  forceSkip,
                  repeatEmbedColour
                );
                break;
              case 2:
                reminderEditMessagePrompt = `\n${fn.timeExamples}`;
                userEdit = await fn.getUserEditString(
                  bot,
                  message,
                  PREFIX,
                  fieldToEdit,
                  reminderEditMessagePrompt,
                  reminderType,
                  forceSkip,
                  repeatEmbedColour
                );
                break;
              case 3:
                reminderEditMessagePrompt = `\n${fn.futureTimeExamples}`;
                userEdit = await fn.getUserEditString(
                  bot,
                  message,
                  PREFIX,
                  fieldToEdit,
                  reminderEditMessagePrompt,
                  reminderType,
                  forceSkip,
                  repeatEmbedColour
                );
                break;
              // Reminder Message does not need a prompt explanation
              case 4:
                userEdit = await fn.getUserMultilineEditString(
                  bot,
                  message,
                  PREFIX,
                  fieldToEdit,
                  `${reminderEditMessagePrompt}${
                    reminderDocument.title === "Voice Channel Tracking"
                      ? `\n(NOTE: Any message changes to an active ${reminderDocument.title} reminder` +
                        ` **will not be saved** when the reminder gets sent!` +
                        ` You must change the **reminder type** to something else.)`
                      : ""
                  }`,
                  reminderType,
                  forceSkip,
                  repeatEmbedColour
                );
                break;
              case 5:
                reminderEditMessagePrompt = `Would you like to make this a **__repeating (⌚)__ OR __one-time (1️⃣)__ reminder?**`;
                userEdit = await fn.getUserEditBoolean(
                  bot,
                  message,
                  PREFIX,
                  fieldToEdit,
                  reminderEditMessagePrompt,
                  ["⌚", "1️⃣"],
                  reminderType,
                  true,
                  repeatEmbedColour
                );
                break;
              case 6:
                if (isRecurring === true) {
                  reminderEditMessagePrompt = `**Please enter the time you'd like in-between recurring reminders (interval):**\n\n${fn.intervalExamplesOver1Minute}`;
                  userEdit = await fn.getUserEditString(
                    bot,
                    message,
                    PREFIX,
                    fieldToEdit,
                    reminderEditMessagePrompt,
                    reminderType,
                    forceSkip,
                    repeatEmbedColour
                  );
                } else userEdit = 0;
                break;
              case 7:
                // If the remainingOccurrences is undefined, null, or false
                // - then it is repeating indefinitely
                reminderEditMessagePrompt =
                  `\n🔁 **Repeat indefinitely**\n\n🔢 **A fixed number of times**` +
                  `\n\n**__Current Remaining Occurrences:__** ${
                    remainingOccurrences || remainingOccurrences === 0
                      ? remainingOccurrences
                      : "Indefinite (keeps repeating)"
                  }`;
                userEdit = await fn.getUserEditBoolean(
                  bot,
                  message,
                  PREFIX,
                  fieldToEdit,
                  reminderEditMessagePrompt,
                  ["🔁", "🔢"],
                  reminderType,
                  true,
                  repeatEmbedColour
                );
                break;
            }
            console.log({ userEdit });
            if (userEdit === false) return;
            else if (userEdit === undefined) userEdit = "back";
            else if (userEdit !== "back") {
              // Parse User Edit
              if (fieldToEditIndex === 2 || fieldToEditIndex === 3) {
                const isStartTime = fieldToEditIndex === 2 ? true : false;
                userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
                console.log({ userEdit });
                const now = Date.now();
                if (isStartTime)
                  startTime = fn.timeCommandHandlerToUTC(
                    userEdit,
                    now,
                    timezoneOffset,
                    daylightSavingsSetting
                  );
                else
                  endTime = fn.timeCommandHandlerToUTC(
                    userEdit,
                    now,
                    timezoneOffset,
                    daylightSavingsSetting
                  );
                if (!startTime || !endTime) {
                  fn.sendReplyThenDelete(
                    message,
                    `**INVALID TIME**... Try** \`${PREFIX}date\` **for **help with dates and times**`,
                    60000
                  );
                  continueEdit = true;
                }
                if (continueEdit === false) {
                  if (isStartTime) startTime -= HOUR_IN_MS * timezoneOffset;
                  else endTime -= HOUR_IN_MS * timezoneOffset;
                  const validReminderDuration = fn.endTimeAfterStartTime(
                    message,
                    startTime,
                    endTime,
                    reminderType
                  );
                  console.log({ validReminderDuration });
                  if (!validReminderDuration) {
                    continueEdit = true;
                  }
                }
              } else {
                switch (fieldToEditIndex) {
                  case 0: {
                    let userType = fn.toTitleCase(userEdit);
                    if (validTypes.includes(userType)) {
                      let removeConnectedDocs = await fn.getUserConfirmation(
                        bot,
                        message,
                        PREFIX,
                        `Are you sure you want to change the reminder type to **"${userType}"**` +
                          `\n\n*(This reminder will **lose** it's **connected document**, if any)*`,
                        forceSkip,
                        "Recurring Reminder: Change Type Confirmation",
                        90000
                      );
                      if (removeConnectedDocs) {
                        title = userType;
                        connectedDocument = undefined;
                      }
                    } else continueEdit = true;
                    break;
                  }
                  case 1:
                    {
                      let userArgs = userEdit.split(/[\s\n]+/).join(" ");
                      let channelType = /((?:[Dd][Mm])|(?:\<\#\d+\>))/.exec(
                        userArgs
                      );
                      if (channelType) {
                        if (/[Dd][Mm]/.test(channelType[1])) {
                          isDM = true;
                          channel = authorID;
                          guildID = undefined;
                        } else {
                          let channelID = /\<\#(\d+)\>/.exec(channelType);
                          channelID = channelID[1];
                          const channel = bot.channels.cache.get(channelID);
                          if (!channel) {
                            continueEdit = true;
                            message.reply(
                              `**This channel (\#${channelID}) does not exist...**`
                            );
                          } else {
                            const userPermissions = channel.permissionsFor(
                              authorID
                            );
                            console.log({ userPermissions });
                            if (
                              userPermissions.has("SEND_MESSAGES") &&
                              userPermissions.has("VIEW_CHANNEL")
                            ) {
                              isDM = false;
                              channel = channelID;
                              guildID = channel.guild.id;
                            } else {
                              continueEdit = true;
                              message.reply(
                                `You are **not authorized to send messages** to that channel...`
                              );
                            }
                          }
                        }
                      }
                    }
                    break;
                  case 4:
                    reminderMessage = userEdit;
                    break;
                  case 5:
                    {
                      switch (userEdit) {
                        case "⌚":
                          userEdit = true;
                          break;
                        case "1️⃣":
                          userEdit = false;
                          break;
                        default:
                          null;
                          break;
                      }
                      if (typeof userEdit === "boolean") {
                        // From One-Time to Repeating
                        if (userEdit === true && isRecurring === false) {
                          isRecurring = userEdit;
                          interval = await rm.getEditInterval(
                            bot,
                            message,
                            PREFIX,
                            timezoneOffset,
                            daylightSavingsSetting,
                            "Interval",
                            `\n**Please enter the time you'd like in-between recurring reminders (interval):**`,
                            reminderType,
                            repeatEmbedColour
                          );
                          if (!interval) {
                            continueEdit = true;
                            break;
                          }
                          let {
                            duration: intervalDuration,
                            args: intervalArgs,
                          } = interval;
                          // GET THE INTENDED END TIME!
                          endTime = await rm.getEditEndTime(
                            bot,
                            message,
                            PREFIX,
                            repeatHelpMessage,
                            timezoneOffset,
                            daylightSavingsSetting,
                            forceSkip,
                            true,
                            reminderMessage,
                            isDM,
                            channel,
                            intervalDuration
                          );
                          if (!endTime) {
                            continueEdit = true;
                            break;
                          } else {
                            if (title === "Reminder") {
                              title = "Repeating Reminder";
                            }
                          }
                          interval = intervalArgs;
                        }
                        // From Repeating to One-Time
                        else if (userEdit === false && isRecurring === true) {
                          isRecurring = userEdit;
                          // GET THE INTENDED END TIME! (For non-recurring)
                          endTime = await rm.getEditEndTime(
                            bot,
                            message,
                            PREFIX,
                            repeatHelpMessage,
                            timezoneOffset,
                            daylightSavingsSetting,
                            forceSkip,
                            false,
                            reminderMessage,
                            isDM,
                            channel,
                            false
                          );
                          if (!endTime) {
                            continueEdit = true;
                            break;
                          } else {
                            if (title === "Repeating Reminder") {
                              title = "Reminder";
                            }
                          }
                        } else {
                          continueEdit = true;
                          break;
                        }
                      } else {
                        continueEdit = true;
                        break;
                      }
                    }
                    break;
                  case 6:
                    {
                      // Ensure that the reminder isRecurring
                      if (isRecurring === true) {
                        const timeArgs = userEdit.toLowerCase().split(" ");
                        interval = await rm.getProcessedInterval(
                          message,
                          timeArgs,
                          PREFIX,
                          timezoneOffset,
                          daylightSavingsSetting
                        );
                        if (!interval) {
                          continueEdit = true;
                          break;
                        } else interval = interval.args;
                      } else {
                        fn.sendReplyThenDelete(
                          message,
                          `**Interval cannot be set for one-time reminder**, try changing the **repeat** first`,
                          30000
                        );
                        continueEdit = true;
                        break;
                      }
                    }
                    break;
                  case 7:
                    {
                      switch (userEdit) {
                        case "🔁":
                          userEdit = false;
                          break;
                        case "🔢":
                          userEdit = true;
                          break;
                        default:
                          null;
                          break;
                      }
                      if (typeof userEdit === "boolean") {
                        if (userEdit === true) {
                          const repetitions = await fn.getNumberEntry(
                            bot,
                            message,
                            PREFIX,
                            "**How many times do you want this reminder to repeat?**\n(Enter a positive whole number or `0` to repeat indefinitely)",
                            "Reminder: Number of Occurrences",
                            forceSkip,
                            false,
                            false,
                            0,
                            undefined,
                            repeatEmbedColour
                          );
                          if (!repetitions && repetitions !== 0) {
                            continueEdit = true;
                            break;
                          } else if (repetitions === 0)
                            remainingOccurrences = undefined;
                          else remainingOccurrences = repetitions;
                        } else {
                          // Set to undefined for indefinite recurrences
                          remainingOccurrences = undefined;
                        }
                      } else {
                        continueEdit = true;
                        break;
                      }
                    }
                    break;
                }
              }
              if (!continueEdit) {
                try {
                  console.log(
                    `Editing ${authorID}'s Fast ${pastNumberOfEntriesIndex} (${sortType})`
                  );
                  // Setup a new reminder!
                  var newReminder;
                  switch (fieldToEditIndex) {
                    case 0:
                      newReminder = await Reminder.findOneAndUpdate(
                        { _id: reminderTargetID },
                        { $set: { title, connectedDocument } },
                        { new: true }
                      );
                      break;
                    case 1:
                      newReminder = await Reminder.findOneAndUpdate(
                        { _id: reminderTargetID },
                        { $set: { isDM, channel, guildID } },
                        { new: true }
                      );
                      break;
                    case 2:
                      newReminder = await Reminder.findOneAndUpdate(
                        { _id: reminderTargetID },
                        { $set: { startTime } },
                        { new: true }
                      );
                      break;
                    case 3:
                      newReminder = await Reminder.findOneAndUpdate(
                        { _id: reminderTargetID },
                        { $set: { endTime } },
                        { new: true }
                      );
                      break;
                    case 4:
                      newReminder = await Reminder.findOneAndUpdate(
                        { _id: reminderTargetID },
                        { $set: { message: reminderMessage } },
                        { new: true }
                      );
                      break;
                    case 5:
                      newReminder = await Reminder.findOneAndUpdate(
                        { _id: reminderTargetID },
                        { $set: { isRecurring, endTime, interval, title } },
                        { new: true }
                      );
                      break;
                    case 6:
                      newReminder = await Reminder.findOneAndUpdate(
                        { _id: reminderTargetID },
                        { $set: { interval } },
                        { new: true }
                      );
                      break;
                    case 7:
                      newReminder = await Reminder.findOneAndUpdate(
                        { _id: reminderTargetID },
                        { $set: { remainingOccurrences } },
                        { new: true }
                      );
                      break;
                  }
                  console.log({ continueEdit, userEdit, newReminder });
                  reminderDocument = await Reminder.findById(reminderTargetID);
                  if (reminderDocument) {
                    rm.cancelReminderById(newReminder._id);
                    await rm.sendReminderByObject(bot, newReminder);
                    pastNumberOfEntriesIndex = indexByRecency
                      ? await rm.getReminderIndexByRecency(
                          authorID,
                          reminderTargetID,
                          isRecurring
                        )
                      : await rm.getReminderIndexByEndTime(
                          authorID,
                          reminderTargetID,
                          isRecurring
                        );
                    console.log({
                      reminderView: reminderDocument,
                      reminderTargetID,
                      fieldToEditIndex,
                    });
                    showReminder = await rm.reminderDocumentToString(
                      bot,
                      reminderDocument,
                      timezoneOffset
                    );
                    console.log({ userEdit });
                    const continueEditMessage = `Do you want to continue **editing Reminder ${pastNumberOfEntriesIndex}?:**\n\n__**Reminder ${pastNumberOfEntriesIndex}:**__\n${showReminder}`;
                    continueEdit = await fn.getUserConfirmation(
                      bot,
                      message,
                      PREFIX,
                      continueEditMessage,
                      forceSkip,
                      `Recurring Reminder: Continue Editing Reminder ${pastNumberOfEntriesIndex}?`,
                      300000
                    );
                  } else {
                    message.reply("**Recurring Reminder not found...**");
                    continueEdit = false;
                  }
                } catch (err) {
                  return console.log(err);
                }
              } else {
                console.log({ continueEdit, userEdit });
                reminderDocument = await Reminder.findById(reminderTargetID);
                if (reminderDocument) {
                  pastNumberOfEntriesIndex = indexByRecency
                    ? await rm.getReminderIndexByRecency(
                        authorID,
                        reminderTargetID,
                        isRecurring
                      )
                    : await rm.getReminderIndexByEndTime(
                        authorID,
                        reminderTargetID,
                        isRecurring
                      );
                  console.log({
                    reminderView: reminderDocument,
                    reminderTargetID,
                    fieldToEditIndex,
                  });
                  showReminder = await rm.reminderDocumentToString(
                    bot,
                    reminderDocument,
                    timezoneOffset
                  );
                } else {
                  message.reply("**Recurring Reminder not found...**");
                  continueEdit = false;
                }
              }
            } else continueEdit = true;
          } while (continueEdit === true);
          return;
        }
      } else return message.reply(reminderActionHelpMessage);
    } else if (
      reminderCommand === "set" ||
      reminderCommand === "s" ||
      reminderCommand === "start" ||
      reminderCommand === "make" ||
      reminderCommand === "m" ||
      reminderCommand === "create" ||
      reminderCommand === "c" ||
      reminderCommand === "st"
    ) {
      if (tier === 1) {
        if (totalReminderNumber >= repeatMax) {
          return message.channel.send(
            fn
              .getMessageEmbed(
                fn.getTierMaxMessage(
                  PREFIX,
                  commandUsed,
                  repeatMax,
                  ["Recurring Reminder", "Recurring Reminders"],
                  1,
                  false
                ),
                `Recurring Reminder: Tier 1 Maximum`,
                repeatEmbedColour
              )
              .setFooter(fn.premiumFooterText)
          );
        }
      }

      let interval = await rm.getInterval(
        bot,
        message,
        PREFIX,
        timezoneOffset,
        daylightSavingsSetting,
        `__**Please enter the time you'd like in-between recurring reminders (interval):**__`,
        `Recurring Reminder: Interval`,
        repeatEmbedColour
      );
      if (!interval) return;
      let { duration: intervalDuration, args: intervalArgs } = interval;
      console.log(fn.millisecondsToTimeString(intervalDuration));

      let remainingOccurrences = rm.getRemainingOccurrences(
        bot,
        message,
        PREFIX,
        "Recurring Reminder",
        repeatEmbedColour
      );
      if (!remainingOccurrences && remainingOccurrences !== undefined) return;
      if (!remainingOccurrences) remainingOccurrences = undefined;

      let channel = await rm.getChannelOrDM(
        bot,
        message,
        PREFIX,
        'Please enter a **target channel (using #)** or "**DM**"',
        "Recurring Reminder: Channel or DM",
        true,
        repeatEmbedColour
      );
      if (!channel) return;
      const isDM = channel === "DM";

      let repeatMessage = await fn.getMultilineEntry(
        bot,
        message,
        PREFIX,
        "__**Enter the message of this reminder**__:\n(Remember to @mention the roles/users you want to ping in the message!)",
        "Recurring Reminder: Message",
        forceSkip,
        repeatEmbedColour,
        2000
      );
      repeatMessage = repeatMessage.message;
      if (!repeatMessage) return;

      let duration = await rm.getUserFirstRecurringEndDuration(
        bot,
        message,
        PREFIX,
        repeatHelpMessage,
        timezoneOffset,
        daylightSavingsSetting,
        true,
        "Recurring Reminder",
        repeatEmbedColour
      );
      console.log({ duration });
      if (!duration && duration !== 0) return;
      const currentTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
      duration = duration > 0 ? duration : 0;
      const confirmCreationMessage = `Are you sure you want to set the following **recurring reminder** to send -\n**in ${channel} ${fn.millisecondsToTimeString(
        duration
      )} from now**, repeating every **${fn.millisecondsToTimeString(
        intervalDuration
      )}**:\n\n${repeatMessage}`;
      const confirmCreation = await fn.getUserConfirmation(
        bot,
        message,
        PREFIX,
        confirmCreationMessage,
        forceSkip,
        "Recurring Reminder: Confirm Creation",
        180000
      );
      if (!confirmCreation) return;
      else {
        if (isDM) {
          await rm.setNewDMReminder(
            bot,
            authorID,
            currentTimestamp,
            currentTimestamp + duration,
            repeatMessage,
            reminderType,
            true,
            false,
            true,
            intervalArgs,
            remainingOccurrences,
            repeatEmbedColour
          );
        } else {
          const channelID = /\<\#(\d+)\>/.exec(channel)[1];
          const userPermissions = bot.channels.cache
            .get(channelID)
            .permissionsFor(authorID);
          console.log({ userPermissions });
          if (
            userPermissions.has("SEND_MESSAGES") &&
            userPermissions.has("VIEW_CHANNEL")
          ) {
            await rm.setNewChannelReminder(
              bot,
              authorID,
              channelID,
              currentTimestamp,
              currentTimestamp + duration,
              repeatMessage,
              reminderType,
              false,
              false,
              true,
              intervalArgs,
              remainingOccurrences,
              repeatEmbedColour
            );
          } else
            return message.reply(
              `You are **not authorized to send messages** to that channel...`
            );
        }
        duration =
          currentTimestamp +
          duration -
          fn.getCurrentUTCTimestampFlooredToSecond();
        return message.reply(
          `Your **recurring reminder** has been set to trigger in **${fn.millisecondsToTimeString(
            duration
          )}** from now!`
        );
      }
    } else return message.reply(repeatHelpMessage);
  },
};
