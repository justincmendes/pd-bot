// Global Variable Declarations and Initializations
const Discord = require("discord.js");
const Fast = require("../database/schemas/fasting");
const User = require("../database/schemas/user");
const mongoose = require("mongoose");
const fn = require("../../utilities/functions");
const rm = require("../../utilities/reminder");
const del = require("../../utilities/deletion");
const Reminder = require("../database/schemas/reminder");
require("dotenv").config();

const fastEmbedColour = fn.fastEmbedColour;
const fastMax = fn.fastMaxTier1;
const HOUR_IN_MS = fn.HOUR_IN_MS;
const timeExamples = fn.timeExamples;

// REDESIGNED:
// Computed Property Names
// Using Object Destructuring

// Function Declarations and Definitions
function fastDataArrayToString(
  bot,
  fastData,
  showFastEndMessage = false,
  PREFIX = "?",
  commandUsed = "fast"
) {
  let [
    startTimestamp,
    endTimestamp,
    fastDuration,
    fastBreaker,
    moodRating,
    reflectionText,
  ] = fastData;
  let fastDataString = `**Start Time:** ${
    startTimestamp ? fn.timestampToDateString(startTimestamp) : ""
  }\n**End Time:** ${
    endTimestamp ? fn.timestampToDateString(endTimestamp) : ""
  }\n**Fast Duration:** ${
    fastDuration ? fn.millisecondsToTimeString(fastDuration) : ""
  }\n**Fast Breaker:** ${fastBreaker || ""}\n**Mood Rating (1 😖 - 5 😄):** ${
    moodRating || ""
  }\n**Reflection:**${reflectionText ? `\n${reflectionText}` : ""}`;
  if (showFastEndMessage) {
    fastDataString += `\n\n(Want to end your fast? \`${PREFIX}${commandUsed} end\`)`;
  }
  fastDataString = fn.getRoleMentionToTextString(bot, fastDataString);
  return fastDataString;
}
function fastDocumentToDataArray(
  fastDocument,
  userTimezone = 0,
  calculateFastDuration = false,
  updateShownEndTime = false,
  endTimestamp = null
) {
  var fastDataArray;
  const givenEndTimestamp = endTimestamp;
  const startTimestamp = fastDocument.startTime;
  // Calculate Fast Duration => endTime is not defined yet!
  if (updateShownEndTime === true) {
    endTimestamp = endTimestamp;
  } else {
    endTimestamp = fastDocument.endTime;
  }
  let fastDuration = fastDocument.fastDuration;
  if (calculateFastDuration && fastDuration === null) {
    if (givenEndTimestamp !== null) {
      fastDuration = givenEndTimestamp - startTimestamp;
    } else {
      let currentUTCTimestamp = fn.getCurrentUTCTimestampFlooredToSecond();
      fastDuration =
        currentUTCTimestamp + userTimezone * HOUR_IN_MS - startTimestamp;
    }
  }
  if (fastDuration <= 0) {
    fastDuration = null;
  }
  const fastBreaker = fastDocument.fastBreaker;
  const moodRating = fastDocument.mood;
  const reflectionText = fastDocument.reflection;
  fastDataArray = [
    startTimestamp,
    endTimestamp,
    fastDuration,
    fastBreaker,
    moodRating,
    reflectionText,
  ];
  return fastDataArray;
}
function multipleFastsToString(
  bot,
  message,
  fastArray,
  numberOfFasts,
  userTimezoneOffset,
  entriesToSkip = 0,
  toArray = false
) {
  var fastDataOut = toArray ? new Array() : "";
  for (let i = 0; i < numberOfFasts; i++) {
    if (fastArray[i] === undefined) {
      numberOfFasts = i;
      fn.sendErrorMessage(
        message,
        `**FASTS ${i + entriesToSkip + 1}**+ ONWARDS DO NOT EXIST...`
      );
      break;
    }
    var fastData;
    if (fastArray[i].endTime === null) {
      fastData = fastDocumentToDataArray(
        fastArray[i],
        userTimezoneOffset,
        true
      );
    } else {
      fastData = fastDocumentToDataArray(fastArray[i]);
    }
    const fastDataString = `__**Fast ${
      i + entriesToSkip + 1
    }:**__\n${fastDataArrayToString(bot, fastData)}`;
    if (toArray) fastDataOut.push(fastDataString);
    else {
      fastDataOut = fastDataOut + fastDataString;
      if (i !== numberOfFasts - 1) {
        fastDataOut += "\n\n";
      }
    }
  }
  return fastDataOut;
}
async function getTotalFasts(userID) {
  try {
    const fastCount = await Fast.find({ userID }).countDocuments();
    return fastCount;
  } catch (err) {
    console.error(err);
  }
}

async function getCurrentOrRecentFastEmbed(
  bot,
  userID,
  fastIsInProgress,
  userTimezoneOffset,
  PREFIX,
  commandUsed = "fast"
) {
  var fastView, fastType, fastData, fastDataToString, fastEmbed;
  if (fastIsInProgress === true) {
    // Show the user the current fast
    fastView = await Fast.findOne({
      userID,
      endTime: null,
    }).catch((err) => console.error(err));
    fastType = "Current";
    fastData = fastDocumentToDataArray(fastView, userTimezoneOffset, true);
  } else {
    // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
    // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort.
    // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
    fastView = await Fast.findOne({ userID }).sort({ _id: -1 });
    fastType = "Previous";
    fastData = fastDocumentToDataArray(fastView);
  }
  fastDataToString = `__**Fast ${await getCurrentOrRecentFastIndex(
    userID
  )}:**__\n`;
  if (fastIsInProgress === true) {
    fastDataToString += fastDataArrayToString(
      bot,
      fastData,
      true,
      PREFIX,
      commandUsed
    );
  } else {
    fastDataToString += fastDataArrayToString(
      bot,
      fastData,
      false,
      PREFIX,
      commandUsed
    );
  }
  fastEmbed = fn.getMessageEmbed(
    fastDataToString,
    `Fast: See ${fastType} Fast`,
    fastEmbedColour
  );
  return fastEmbed;
}
function urlIsImage(url) {
  return (
    url.indexOf(".png", url.length - 4) !== -1 ||
    url.indexOf(".jpeg", url.length - 5) !== -1 ||
    url.indexOf(".jpg", url.length - 4) !== -1 ||
    url.indexOf(".gif") !== -1 ||
    url.indexOf("-gif") !== -1
  );
}
function messageAttachmentIsImage(messageAttachment) {
  const url = messageAttachment.url;
  console.log({ url });
  // Return true if the url is of a png, jpg or jpeg image
  return urlIsImage(url);
}
async function findFirstAttachment(attachmentArray) {
  var attachment;
  await attachmentArray.forEach((currentAttachment, i) => {
    if (messageAttachmentIsImage(currentAttachment)) {
      attachment = currentAttachment.url;
      return;
    }
  });
  return attachment;
}
function addUserTag(message, post) {
  return `<@${message.author.id}>\n${post}`;
}
// Designed not to break when userConfirmation = ❌ (FALSE), but only stop when `stop`
async function getFastPostEmbedArray(
  bot,
  message,
  PREFIX,
  fastData,
  forceSkip = false
) {
  let spamDetails = {
    lastTimestamp: null,
    closeMessageCount: 0,
  };
  const REFRESH_SPAM_DELAY = 22500;
  const CLOSE_MESSAGE_DELAY = 2000;
  const CLOSE_MESSAGE_SPAM_NUMBER = 7;
  const [, , fastDurationTimestamp, fastBreaker, ,] = fastData;
  let postIndex = 0;
  let fastPost = new Array();
  let attachment = null;
  var collectedMessage = "",
    collectedObject;
  var fastPostMessagePrompt =
    "**__Please enter the message(s) you'd like to send.__** (you can send pictures!)\n\nThe latest **picture** you send will be attached to the post for ALL options below (except stop):\n\nType `0` to add **default message with fast breaker**\nType `1` when **done**!\nType `2` to **undo** the previous entry\nType `post` to add **full fast**\nType `remove` to **remove** the **attached image**\nType `clear` to **reset/clear** your **current message** (message only)\nType `clear all` to **clear** both attached **image and message**\n\n";
  const originalFastPostMessagePrompt = fastPostMessagePrompt;
  const postCommands = ["0", "1", "2", "post", "remove", "clear", "clear all"];
  // Loop to collect the first message given and store it, if that message is 0, 1, or stop then handle accordingly
  // Detect and store images, allow user to remove image before posting!
  do {
    postIndex++;
    console.log({ attachment });
    collectedObject = await fn.messageDataCollect(
      bot,
      message.author.id,
      message.channel.id,
      PREFIX,
      fastPostMessagePrompt,
      "Fast: Post Creation",
      fastEmbedColour,
      1800000,
      true,
      true,
      false,
      true,
      3000,
      attachment,
      `Character Count: ${fastPost.join("\n").length}`
    );

    // If user types stop, messageDataCollect returns false:
    if (!collectedObject) {
      message.channel.send(
        `This was your **fast post**:\n${fastPost.join("\n")}${
          attachment ? `\n\n**__Attachment:__**\n${attachment}` : ""
        }`
      );
      return false;
    }
    collectedMessage = collectedObject.content;

    if (collectedMessage) {
      if (collectedMessage.startsWith(PREFIX) && collectedMessage !== PREFIX) {
        message.reply(
          `Any **command calls** while writing a message will **stop** the collection process.\n**__Command Entered:__** ${collectedMessage}`
        );
        return false;
      }
      // Spam Prevention:
      else if (
        spamDetails &&
        collectedMessage !== "1" &&
        collectedMessage !== "2" &&
        collectedMessage !== "remove" &&
        collectedMessage !== "clear" &&
        collectedMessage !== "clear all"
      ) {
        const messageSendDelay = Date.now() - spamDetails.lastTimestamp || 0;
        console.log({ messageSendDelay });
        spamDetails.lastTimestamp = Date.now();
        if (messageSendDelay < CLOSE_MESSAGE_DELAY) {
          spamDetails.closeMessageCount++;
        }
        if (spamDetails.closeMessageCount >= CLOSE_MESSAGE_SPAM_NUMBER) {
          console.log("Exiting due to spam...");
          message.reply("**Exiting... __Please don't spam!__**");
          return false;
        }
        if (spamDetails.closeMessageCount === 0) {
          setTimeout(() => {
            if (spamDetails) spamDetails.closeMessageCount = 0;
          }, REFRESH_SPAM_DELAY);
        }
      }
    } else if (collectedMessage.length + fastPost.join("\n").length > 6000) {
      message.reply(
        "Your entry was **too long** (*over 6000 characters*), so I had to **stop** collecting it."
      );
      return false;
    }

    if (postIndex === 1) {
      if (collectedMessage === "1") {
        if (fastPost.join("\n").length > 2000) {
          message.reply(
            `Your entry is too long (must be __less than 2000 characters__ long)\nTry undoing some line entries by typing \`2\` or reset your entry by typing \`0\``
          );
          continue;
        } else {
          fastPost = addUserTag(message, fastPost.join("\n"));
          break;
        }
      }
      let attachmentArray = collectedObject.attachments;
      console.log({ attachmentArray });
      if (attachmentArray.size > 0) {
        // Just check and post the first image
        if (attachmentArray.some(messageAttachmentIsImage)) {
          attachment = await findFirstAttachment(attachmentArray);
          postIndex = 0;
        }
      } else if (postCommands.includes(collectedMessage)) {
        if (
          collectedMessage !== "0" &&
          collectedMessage !== "post" &&
          collectedMessage !== "2"
        ) {
          postIndex--;
        } else fastPostMessagePrompt += "__**Current Message:**__";
      } else {
        if (urlIsImage(collectedMessage)) {
          attachment = collectedMessage;
          postIndex = 0;
        } else {
          fastPostMessagePrompt += `__**Current Message:**__\n${collectedMessage}`;
          fastPost.push(collectedMessage);
        }
      }
    } else if (!postCommands.includes(collectedMessage)) {
      let attachmentArray = collectedObject.attachments;
      console.log({ attachmentArray });
      if (attachmentArray.size > 0) {
        // Just check and post the first image/gif
        if (attachmentArray.some(messageAttachmentIsImage)) {
          attachment = await findFirstAttachment(attachmentArray);
          if (collectedMessage !== "") {
            fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
            fastPost.push(collectedMessage);
          }
        }
      } else {
        // If the user posts the link to their image/gif
        if (urlIsImage(collectedMessage)) {
          attachment = collectedMessage;
        } else {
          fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
          fastPost.push(collectedMessage);
        }
      }
      console.log({ attachment });
    }

    if (collectedMessage === "stop") return false;
    else if (collectedMessage === "remove" && attachment !== null) {
      const removeFastWarning =
        "Are you sure you want to remove your **attached image/gif?**";
      let confirmClearMessage = await fn.getUserConfirmation(
        bot,
        message.author.id,
      message.channel.id,
        PREFIX,
        removeFastWarning,
        forceSkip,
        "Fast Post: Remove Attachment"
      );
      if (confirmClearMessage === true) {
        attachment = null;
      }
    } else if (collectedMessage === "clear") {
      const clearMessageWarning =
        "Are you sure you want to reset your **current message?** (your attached image remains the same if you had one)";
      let confirmClearMessage = await fn.getUserConfirmation(
        bot,
        message.author.id,
      message.channel.id,
        PREFIX,
        clearMessageWarning,
        forceSkip,
        "Fast Post: Clear Current Message"
      );
      if (confirmClearMessage === true) {
        fastPostMessagePrompt = originalFastPostMessagePrompt;
        fastPost = new Array();
        postIndex = 0;
      }
    } else if (collectedMessage == "clear all") {
      const clearAllWarning =
        "Are you sure you want to reset both your **current message and attached image?**";
      let confirmClearAll = await fn.getUserConfirmation(
        bot,
        message.author.id,
      message.channel.id,
        PREFIX,
        clearAllWarning,
        forceSkip,
        "Fast Post: Clear All"
      );
      if (confirmClearAll === true) {
        fastPostMessagePrompt = originalFastPostMessagePrompt;
        fastPost = new Array();
        attachment = null;
        postIndex = 0;
      }
    } else if (collectedMessage === "1") {
      fastPost = addUserTag(message, fastPost.join("\n"));
      break;
    } else if (collectedMessage === "0") {
      const addDefaultMessagePrompt =
        "Are you sure you want to add the default message including the **time and your fast breaker** (if you entered one)";
      let confirmOverwrite = await fn.getUserConfirmation(
        bot,
        message.author.id,
      message.channel.id,
        PREFIX,
        addDefaultMessagePrompt,
        true,
        "Fast Post: Add Default Fast Message"
      );
      if (confirmOverwrite === true) {
        if (fastBreaker === null) {
          collectedMessage = `=============\nBroke my **${fn.millisecondsToTimeString(
            fastDurationTimestamp
          )}** fast!\n=============`;
        } else
          collectedMessage = `=============\nBroke my **${fn.millisecondsToTimeString(
            fastDurationTimestamp
          )}** fast with **${fastBreaker}**!\n=============`;
        fastPost.push(collectedMessage);
        fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
      }
    } else if (collectedMessage === "post") {
      const addFullFastPrompt =
        "Are you sure you want to add your **full fast (including mood and reflection)**";
      let confirmOverwrite = await fn.getUserConfirmation(
        bot,
        message.author.id,
      message.channel.id,
        PREFIX,
        addFullFastPrompt,
        true,
        "Fast Post: Add Full Fast"
      );
      if (confirmOverwrite === true) {
        collectedMessage = `=============\n${fastDataArrayToString(
          bot,
          fastData
        )}\n=============`;
        fastPost.push(collectedMessage);
        fastPostMessagePrompt = `${fastPostMessagePrompt}\n${collectedMessage}`;
      }
    } else if (collectedMessage === "2") {
      if (fastPost.length) {
        let error = false;
        if (fastPost.length === 1) {
          fastPostMessagePrompt = originalFastPostMessagePrompt;
          postIndex = 0;
        } else {
          targetStringIndex = fastPostMessagePrompt.lastIndexOf(
            fastPost[fastPost.length - 1]
          );
          if (targetStringIndex >= 0) {
            fastPostMessagePrompt = fastPostMessagePrompt.substring(
              0,
              targetStringIndex - 1
            );
          } else {
            console.log("Could not undo the last typed edit!");
            fn.sendMessageThenDelete(
              message,
              `**Sorry <@!${message.author.id}>, I could not undo the last typed edit!**`,
              30000
            );
            error = true;
          }
        }
        if (!error) fastPost.pop();
      } else {
        fastPostMessagePrompt = originalFastPostMessagePrompt;
        postIndex = 0;
      }
    }
  } while (true);
  fastPost = fn.getEmbedArray(
    fastPost,
    "Fast Post",
    true,
    false,
    fastEmbedColour
  );
  if (attachment !== null) {
    fastPost.forEach((post, i) => {
      fastPost[i] = post.setImage(attachment);
    });
  }
  return fastPost;
}

async function showFastPost(bot, message, fastPost, mistakeMessage) {
  fn.sendReplyThenDelete(message, "**Here was your post:**", 600000);
  await fn.sendPaginationEmbed(
    bot,
    message.channel.id,
    message.author.id,
    fastPost,
    true
  );
  message.reply(mistakeMessage);
  return;
}

async function getOneFastByStartTime(userID, fastIndex) {
  const fast = await Fast.findOne({ userID: userID })
    .sort({ startTime: -1 })
    .skip(fastIndex)
    .catch((err) => {
      console.log(err);
      return false;
    });
  return fast;
}

async function getOneFastByRecency(userID, fastIndex) {
  const fast = await Fast.findOne({ userID: userID })
    .sort({ _id: -1 })
    .skip(fastIndex)
    .catch((err) => {
      console.log(err);
      return false;
    });
  return fast;
}

// Split each function: current and recent in to separated.
async function getCurrentOrRecentFastIndex(userID) {
  try {
    const fastIsInProgress =
      (await Fast.find({ userID, endTime: null }).countDocuments()) > 0;
    var index;
    const fasts = await Fast.find({ userID }).sort({ startTime: -1 });
    if (fastIsInProgress) {
      for (let i = 0; i < fasts.length; i++) {
        if (fasts[i].endTime === null) {
          index = i + 1;
          break;
        }
      }
    } else {
      let targetID = await Fast.findOne({ userID }).sort({ _id: -1 });
      targetID = targetID._id.toString();
      console.log({ targetID });
      for (let i = 0; i < fasts.length; i++) {
        if (fasts[i]._id.toString() === targetID) {
          index = i + 1;
          break;
        }
      }
    }
    return index;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function getCurrentOrMostRecentFast(userID) {
  try {
    let fastView = await Fast.findOne({ userID, endTime: null });
    if (!fastView) {
      fastView = await Fast.findOne({ userID }).sort({ _id: -1 });
    }
    return fastView;
  } catch (err) {
    console.log(err);
    return false;
  }
}

/**
 *
 * @param {Discord.Client} bot
 * @param {String} authorID
 * @param {mongoose.ObjectId} fastDocumentID
 * @param {Number} startTimestamp In relative terms
 * @param {Number} endTimestamp Reminder End Time in relative terms
 * @param {Number} sendHoursBeforeEnd
 */
function setFastEndHourReminder(
  bot,
  userTimezoneOffset,
  authorID,
  fastDocumentID,
  startTimestamp,
  endTimestamp,
  sendHoursBeforeEnd = 1
) {
  const intendedFastDuration = endTimestamp - startTimestamp;
  sendHoursBeforeEnd =
    intendedFastDuration > 0
      ? sendHoursBeforeEnd > 0
        ? sendHoursBeforeEnd
        : 0
      : 0;
  const preEndMessage = `**At least __${sendHoursBeforeEnd}__ more hour(s) left of your __${fn.millisecondsToTimeString(
    intendedFastDuration
  )}__ fast!**\n(Started: __${fn.timestampToDateString(
    startTimestamp
  )}__)\nYou're at least **${(
    ((intendedFastDuration - HOUR_IN_MS * sendHoursBeforeEnd) /
      intendedFastDuration) *
    100
  ).toFixed(2)}% finished!**\n\nFinish strong - I'm cheering you on 😁`;
  rm.setNewDMReminder(
    bot,
    authorID,
    startTimestamp - HOUR_IN_MS * userTimezoneOffset,
    endTimestamp - HOUR_IN_MS * (sendHoursBeforeEnd + userTimezoneOffset),
    preEndMessage,
    "Fast",
    true,
    fastDocumentID,
    false,
    false,
    false,
    fastEmbedColour
  );
}

/**
 *
 * @param {Discord.Client} bot
 * @param {String} commandUsed
 * @param {String} authorID
 * @param {mongoose.ObjectId} fastDocumentID
 * @param {Number} startTimestamp In relative terms
 * @param {Number} endTimestamp Reminder End Time in relative terms
 */
function setFastEndReminder(
  bot,
  userTimezoneOffset,
  commandUsed,
  authorID,
  fastDocumentID,
  startTimestamp,
  endTimestamp
) {
  const intendedFastDuration = endTimestamp - startTimestamp;
  const endMessage = `**Your __${fn.millisecondsToTimeString(
    intendedFastDuration
  )}__ fast is done!** (Started: __${fn.timestampToDateString(
    startTimestamp
  )}__)\nGreat job tracking and completing your fast!\nIf you want to **edit** your fast before ending, type \`?${commandUsed} edit current\`\nIf you want to **end** your fast, type \`?${commandUsed} end\``;
  rm.setNewDMReminder(
    bot,
    authorID,
    startTimestamp - HOUR_IN_MS * userTimezoneOffset,
    endTimestamp - HOUR_IN_MS * userTimezoneOffset,
    endMessage,
    "Fast",
    true,
    fastDocumentID,
    false,
    false,
    false,
    fastEmbedColour
  );
}

/**
 *
 * @param {Discord.Client} bot
 * @param {Discord.Message} message
 * @param {String} PREFIX
 * @param {String} fastTimeHelpMessage
 * @param {Number} startTime In UTC / Exact Time
 * @param {Number} userTimezoneOffset
 * @param {Boolean} userDaylightSavingSetting
 * @param {Boolean} forceSkip
 * In UTC / Exact Time
 */
async function getUserReminderEndTime(
  bot,
  message,
  PREFIX,
  fastTimeHelpMessage,
  startTime,
  userTimezoneOffset,
  userDaylightSavingSetting,
  forceSkip
) {
  // Setup Reminder:
  let setReminder = true;
  var reminderEndTime;
  do {
    const reminderPrompt =
      `__**How long do you intend to fast?**__\n(**Relative to Start Time:** ${fn.timestampToDateString(
        startTime
      )})\n💬 - I will DM you **when your fast is done and an hour before it's done**` +
      `\n\n${fn.durationExamples}\n\nType \`skip\` to **start your fast without setting up an end of fast reminder**`;
    const userTimeInput = await fn.messageDataCollect(
      bot,
      message.author.id,
      message.channel.id,
      PREFIX,
      reminderPrompt,
      "Fast: Duration",
      fastEmbedColour
    );
    if (userTimeInput === "skip") return undefined;
    if (userTimeInput === "stop" || userTimeInput === false) return false;
    // Undo the timezoneOffset to get the end time in UTC
    const timeArgs = userTimeInput.toLowerCase().split(/[\s\n]+/);
    var intendedFastDuration, now;
    now = Date.now();
    reminderEndTime = fn.timeCommandHandlerToUTC(
      timeArgs[0] !== "in" ? ["in"].concat(timeArgs) : timeArgs,
      now,
      userTimezoneOffset,
      userDaylightSavingSetting,
      true,
      true,
      false,
      false
    );
    if (reminderEndTime || reminderEndTime === 0) {
      now = fn.getCurrentUTCTimestampFlooredToSecond();
      reminderEndTime -= HOUR_IN_MS * userTimezoneOffset;
      intendedFastDuration = reminderEndTime - now;
    } else intendedFastDuration = false;
    console.log({ userTimeInput, now, reminderEndTime, intendedFastDuration });
    if (intendedFastDuration >= HOUR_IN_MS && reminderEndTime > now)
      setReminder = true;
    else {
      setReminder = false;
      fn.sendReplyThenDelete(
        message,
        `**Please enter a proper time duration __> 1 hour__!**...\n${fastTimeHelpMessage} for **valid time inputs!**`,
        30000
      );
    }
    if (setReminder) {
      const fastDurationString = fn.millisecondsToTimeString(
        intendedFastDuration
      );
      const confirmReminder = await fn.getUserConfirmation(
        bot,
        message.author.id,
      message.channel.id,
        PREFIX,
        `Are you sure you want to be reminded after **${fastDurationString}** of fasting?`,
        forceSkip,
        "Fast: Reminder Confirmation"
      );
      if (confirmReminder) {
        return startTime + intendedFastDuration;
      }
    }
  } while (true);
}

//==========================
//          START
//==========================

module.exports = {
  name: "fast",
  description: "Fully Functional Fasting Tracker (for Intermittent Fasting)",
  aliases: ["f", "if", "fasts", "fasting"],
  cooldown: 1.5,
  args: true,
  run: async function run(
    bot,
    message,
    commandUsed,
    args,
    PREFIX,
    timezoneOffset,
    daylightSavingSetting,
    forceSkip
  ) {
    // Variable Declarations and Initializations
    var fastUsageMessage =
      `**USAGE:**\n\`${PREFIX}${commandUsed} <ACTION>\`:\n\n` +
      `: **help; start/s; end/e; see; edit; delete/d; post/p**` +
      `\n\n*__ALIASES:__* **${this.name} - ${this.aliases.join("; ")}**`;
    fastUsageMessage = fn.getMessageEmbed(
      fastUsageMessage,
      "Fast: Help",
      fastEmbedColour
    );
    const fastHelpMessage = `Try \`${PREFIX}fast help\``;
    const authorID = message.author.id;
    const authorUsername = message.author.username;
    const userSettings = await User.findOne({ discordID: authorID });
    const { tier } = userSettings;
    const fastCommand = args[0].toLowerCase();
    const fastInProgress = Fast.findOne({
      userID: authorID,
      endTime: null,
    });
    const fastIsInProgress = !!fastInProgress;
    const totalFastNumber = await getTotalFasts(authorID);
    if (totalFastNumber === false) return;
    const fastFieldList = [
      "start",
      "end",
      "fastbreaker",
      "duration",
      "mood",
      "reflection",
    ];
    // Computed Property Names: Reduces code footprint
    console.log({ authorUsername, authorID, fastIsInProgress });

    if (fastCommand === "help") return message.channel.send(fastUsageMessage);
    else if (
      fastCommand === "start" ||
      fastCommand === "st" ||
      fastCommand === "s" ||
      fastCommand === "set" ||
      fastCommand === "create" ||
      fastCommand === "c" ||
      fastCommand === "make" ||
      fastCommand === "m" ||
      fastCommand === "add" ||
      fastCommand === "a"
    ) {
      if (tier === 1) {
        if (totalFastNumber >= fastMax) {
          return message.channel.send(
            fn
              .getMessageEmbed(
                fn.getTierMaxMessage(
                  PREFIX,
                  commandUsed,
                  fastMax,
                  ["Fast", "Fasts"],
                  1,
                  false
                ),
                `Fast: Tier 1 Maximum`,
                fastEmbedColour
              )
              .setFooter(fn.premiumFooterText)
          );
        }
      }
      // Check if the user does not already have a fast in progress, otherwise start.
      // Using greater than equal to ensure error message sent even though
      // Any given user should not be able to have more than 1 fast running at a time
      var fastStartUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <force?>\`\n\n\`<force?>\`: type **force** at the end of your command to **skip all of the confirmation windows!**`;

      fastStartUsageMessage = fn.getMessageEmbed(
        fastStartUsageMessage,
        `Fast: Start Help`,
        fastEmbedColour
      );
      const fastIsRunningMessage = `You already have a **fast running!**\nIf you want to **end** your fast, try \`${PREFIX}${commandUsed} end\`\nIf you want to **restart** it, try \`${PREFIX}${commandUsed} edit current\`\nIf you want to **delete** your fast entry altogether, try \`${PREFIX}${commandUsed} delete current\``;
      if (args[1] !== undefined) {
        if (args[1].toLowerCase() === "help")
          return message.channel.send(fastStartUsageMessage);
      }
      if (fastIsInProgress >= 1) return message.reply(fastIsRunningMessage);
      else {
        let startTime = await fn.getDateAndTimeEntry(
                bot,
                message.author.id,
                message.channel.id,
          PREFIX,
          timezoneOffset,
          daylightSavingSetting,
          `__**When did you start your fast?**__: Enter a Date/Time`,
          "Fast: Start Time",
          false,
          fastEmbedColour,
          300000,
          60000,
          timeExamples
        );
        if (!startTime && startTime !== 0) return;

        // Setup Reminder:
        const reminderEndTime = await getUserReminderEndTime(
          bot,
          message,
          PREFIX,
          `Try \`${PREFIX}date\``,
          startTime,
          timezoneOffset,
          daylightSavingSetting,
          forceSkip
        );
        if (reminderEndTime === false) return;

        let newFast = new Fast({
          _id: mongoose.Types.ObjectId(),
          userID: authorID,
          //using Date.now() gives the time in milliseconds since Jan 1, 1970 00:00:00
          startTime,

          //if the endTime or fastDuration is null that indicates that the fast is still going
          endTime: null,
          fastDuration: null,
          fastBreaker: null,
          mood: null,
          reflection: null,
        });
        const fastDocumentID = newFast._id;
        console.log({ fastDocumentID });
        const reminderEndTimeExists = reminderEndTime || reminderEndTime === 0;
        if (reminderEndTimeExists) {
          // First Reminder: 1 Hour Warning/Motivation
          if (
            message.createdTimestamp + HOUR_IN_MS * timezoneOffset <
            reminderEndTime
          ) {
            setFastEndHourReminder(
              bot,
              timezoneOffset,
              authorID,
              fastDocumentID,
              startTime,
              reminderEndTime,
              1
            );
          }
          // Second Reminder: End Time
          setFastEndReminder(
            bot,
            timezoneOffset,
            commandUsed,
            authorID,
            fastDocumentID,
            startTime,
            reminderEndTime
          );
        }
        await newFast
          .save()
          .then((result) => console.log(result))
          .catch((err) => console.log(err));

        message.reply(
          `Your fast starting on **${fn.timestampToDateString(startTime)}${
            reminderEndTimeExists
              ? ` for ${fn.millisecondsToTimeString(
                  reminderEndTime - startTime
                )}, `
              : " "
          }**is being recorded!`
        );
      }
    } else if (fastCommand === "end" || fastCommand === "e") {
      var fastEndUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <force?>\`\n\n\`<force?>\`: type **force** at the end of your command to **skip all of the confirmation windows!**`;
      fastEndUsageMessage = fn.getMessageEmbed(
        fastEndUsageMessage,
        `Fast: End Help`,
        fastEmbedColour
      );
      const noFastRunningMessage = `You don't have a **fast running!**\nIf you want to **start** one \`${PREFIX}${commandUsed} start\``;

      if (args[1] !== undefined) {
        if (args[1].toLowerCase() === "help") {
          return message.channel.send(fastEndUsageMessage);
        }
      }
      if (fastIsInProgress === 0) {
        return message.reply(noFastRunningMessage);
      } else {
        const currentFast = await getCurrentOrMostRecentFast(authorID);
        if (currentFast.endTime !== null) {
          return message.reply(noFastRunningMessage);
        }
        // Can use authorID in this case as well, but will stick to pulling the
        // value from the database - to ensure the user is correct!

        let endTimestamp = await fn.getDateAndTimeEntry(
                bot,
                message.author.id,
                message.channel.id,
          PREFIX,
          timezoneOffset,
          daylightSavingSetting,
          `__**When did you end your fast?**__: Enter a Date/Time`,
          `Fast: End Time`,
          false,
          fastEmbedColour,
          300000,
          60000,
          timeExamples
        );
        if (!endTimestamp && endTimestamp !== 0) return;
        const { startTime } = currentFast;
        console.log({ currentFast, startTime, endTimestamp });
        const validEndTime = await fn.endTimeAfterStartTime(
          bot,
          message.channel.id,
          startTime,
          endTimestamp,
          "Fast"
        );
        if (!validEndTime) {
          return message.channel.send(
            `If you want to change the start time try \`${PREFIX}${commandUsed} edit recent\``
          );
        }
        const currentFastUserID = currentFast.userID;
        const fastDuration = endTimestamp - startTime;
        console.log({ currentFastUserID, startTime, fastDuration });
        // EVEN if the time is not now it will be handled accordingly
        const quickEndMessage = `**✍ - Log additional information: Fast Breaker, Mood, Reflection**\n**⌚ - Quickly log** your **${fn.millisecondsToTimeString(
          fastDuration
        )}** fast now\n**❌ - Exit**\n\n(You can always \`${PREFIX}${commandUsed} edit\`)`;
        const quickEndEmojis = ["✍", "⌚", "❌"];
        let quickEnd = await fn.reactionDataCollect(
          bot,
          authorID,
          message.channel.id,
          quickEndMessage,
          quickEndEmojis,
          "Fast: Quick End?",
          fastEmbedColour,
          180000
        );
        if (!quickEnd) return;

        let fastBreaker = null,
          mood = null,
          reflection = null;
        if (quickEnd === `❌`) return;
        else if (quickEnd === `✍`) {
          // Send message and as for fastBreaker and upload a picture too
          // which can be referenced later or sent to a server when DMs are handled!
          const skipInstructions =
            "Type `skip` to **skip** (will **continue**, but log it as blank)";
          const skipKeyword = ["skip"];
          const fastBreakerPrompt =
            "**What did you break your fast with?**\n(Within 150 characters)";
          fastBreaker = await fn.getSingleEntryWithCharacterLimit(
                bot,
                message.author.id,
                message.channel.id,
            PREFIX,
            fastBreakerPrompt,
            "Fast: Fast Breaker",
            150,
            "a fast breaker",
            forceSkip,
            fastEmbedColour,
            skipInstructions,
            skipKeyword
          );
          console.log({ fastBreaker });
          if (!fastBreaker) return;
          else if (fastBreaker === "skip") fastBreaker = null;

          const moodValuePrompt =
            "**How did you feel during this past fast?\n\nEnter a number from 1-5 (1 = worst, 5 = best)**\n`5`-😄; `4`-🙂; `3`-😐; `2`-😔; `1`-😖";
          mood = await fn.userSelectFromList(
            bot,
            message.author.id,
            message.channel.id,
            PREFIX,
            "",
            5,
            moodValuePrompt,
            "Fast: Mood Assessment",
            fastEmbedColour
          );
          if (!mood && mood !== 0) return;
          // +1 to convert the returned index back to natural numbers
          else mood++;

          const reflectionTextPrompt =
            "**__Reflection Questions:__**\n🤔 - **Why did you feel that way?**\n💭 - **What did you do that made it great? / What could you have done to make it better?**\n(Within 1000 characters)";
          reflection = await fn.getMultilineEntry(
                bot,
                message.author.id,
                message.channel.id,
            PREFIX,
            reflectionTextPrompt,
            "Fast: Reflection",
            forceSkip,
            fastEmbedColour,
            1000,
            skipInstructions,
            skipKeyword
          );
          if (!reflection && reflection.message !== "") return;
          else if (reflection.message === "skip") reflection = null;
          else reflection = reflection.message;
        }

        const endConfirmation = `Are you sure you want to **end** your **${fn.millisecondsToTimeString(
          fastDuration
        )}** fast?\n\n**Fast Breaker:** ${fastBreaker}\n**Mood:** ${mood}\n**Reflection:**\n${reflection}`;
        //If the user declines or has made a mistake, stop.
        const confirmation = await fn
          .getUserConfirmation(bot, message.author.id,
            message.channel.id, PREFIX, endConfirmation, forceSkip)
          .catch((err) => console.error(err));
        console.log(`Confirmation function call: ${confirmation}`);
        if (!confirmation) return;

        await Fast.findOneAndUpdate(
          { userID: authorID, endTime: null },
          {
            $set: {
              fastDuration,
              endTime: endTimestamp,
              fastBreaker,
              mood,
              reflection,
            },
          },
          async (err, doc) => {
            if (err) return console.error(`Failed to end fast:\n${err}`);
            if (doc) {
              if (doc._id) {
                // Removing any lingering reminders
                rm.cancelRemindersByConnectedDocument(doc._id);
                const removeReminders = await Reminder.deleteMany({
                  userID: authorID,
                  connectedDocument: doc._id,
                });
                console.log({ removeReminders });
              }
              // Posting the fast
              message.reply(
                `You have successfully logged your **${fn.millisecondsToTimeString(
                  fastDuration
                )}** fast!`
              );
              const confirmPostFastMessage =
                "Would you like to take a **picture** of your **fast breaker** *and/or* **send a message** to a server channel? (for accountability!)";
              let confirmPostFast = await fn.getUserConfirmation(
                bot,
                message.author.id,
      message.channel.id,
                PREFIX,
                confirmPostFastMessage,
                forceSkip,
                "Send Message for Accountability?",
                180000,
                0
              );
              if (!confirmPostFast) return;
              else {
                const fastIndex =
                  `${await fn.getEntryIndexByFunction(
                    authorID,
                    doc._id,
                    totalFastNumber,
                    getOneFastByStartTime
                  )}` || "recent";
                console.log({ fastIndex });
                await this.run(
                  bot,
                  message,
                  commandUsed,
                  ["post", fastIndex],
                  PREFIX,
                  timezoneOffset,
                  daylightSavingSetting,
                  forceSkip
                );
              }
            }
          }
        );
      }
    } else if (
      /**
       * Cases:
       * 1. see <ONE_ENTRY>
       * 2. see all
       * 3. see recent/current
       * 4. see past <INDEX>
       * 5. see many <MULTIPLE_ENTRIES_COMMA_SEPARATED>
       * 6. see <PAST_#_OF_ENTRIES> <recent> past <INDEX>
       */
      fastCommand === "see" ||
      fastCommand === "view" ||
      fastCommand === "find" ||
      fastCommand === "look" ||
      fastCommand === "lookup" ||
      fastCommand === "show"
    ) {
      // Will add the ability to gather all of the user's data into a spreadsheet or note/JSON file!
      //* Handle users who do not yet have a fast!
      var fastSeeUsageMessage = fn.getReadOrDeleteUsageMessage(
        PREFIX,
        commandUsed,
        fastCommand,
        true,
        ["Fast", "Fasts"],
        false,
        false,
        [`\n\`${PREFIX}${commandUsed} ${fastCommand} <number> <force?>\``]
      );
      fastSeeUsageMessage = fn.getMessageEmbed(
        fastSeeUsageMessage,
        `Fast: See Help`,
        fastEmbedColour
      );
      const fastSeeHelpMessage = `**INVALID USAGE**... Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;

      // If the user wants fast help, do not proceed to show them the fast.
      const seeCommands = ["past", "recent", "current", "all"];

      // MAKE THIS OPERATION INTO A FUNCTION!
      if (args[1] !== undefined) {
        if (args[1].toLowerCase() === "help") {
          return message.channel.send(fastSeeUsageMessage);
        }
        // If the user has no fasts
        if (totalFastNumber === 0) {
          return message.reply(
            `**NO FASTS**... try \`${PREFIX}${commandUsed} start help\``
          );
        } else if (args[1].toLowerCase() === "number") {
          return message.reply(
            `You have **${totalFastNumber} fasts** on record.`
          );
        }
      }
      // fast see (only):
      else return message.reply(fastSeeHelpMessage);
      // Show the user the last fast with the most recent end time (by sorting from largest to smallest end time and taking the first):
      // When a $sort immediately precedes a $limit, the optimizer can coalesce the $limit into the $sort.
      // This allows the sort operation to only maintain the top n results as it progresses, where n is the specified limit, and MongoDB only needs to store n items in memory.
      if (!seeCommands.includes(args[1]) && isNaN(args[1])) {
        message.channel.send(
          await getCurrentOrRecentFastEmbed(
            bot,
            authorID,
            fastIsInProgress,
            timezoneOffset,
            PREFIX,
            commandUsed
          )
        );
        return message.reply(fastSeeHelpMessage);
      }
      // Do not show the most recent fast embed, when a valid command is called
      // it will be handled properly later based on the values passed in!
      else {
        const seeType = args[1].toLowerCase();
        var pastFunctionality, pastNumberOfEntriesIndex;
        let indexByRecency = false;
        // To check if the given argument is a number!
        // If it's not a number and has passed the initial
        // filter, then use the "past" functionality
        // Handling Argument 1:
        const isNumberArg = !isNaN(args[1]);
        if (seeType === "recent" || seeType === "current") {
          return message.channel.send(
            await getCurrentOrRecentFastEmbed(
              bot,
              authorID,
              fastIsInProgress,
              timezoneOffset,
              PREFIX,
              commandUsed
            )
          );
        } else if (seeType === "all") {
          pastNumberOfEntriesIndex = totalFastNumber;
          pastFunctionality = true;
        } else if (isNumberArg) {
          pastNumberOfEntriesIndex = parseInt(args[1]);
          if (pastNumberOfEntriesIndex <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              fastSeeHelpMessage,
              "**FAST DOES NOT EXIST**..."
            );
          } else pastFunctionality = false;
        } else if (seeType === "past") {
          pastFunctionality = true;
        }
        // After this filter:
        // If the first argument after "see" is not past, then it is not a valid call
        else {
          message.channel.send(
            await getCurrentOrRecentFastEmbed(
              bot,
              authorID,
              fastIsInProgress,
              timezoneOffset,
              PREFIX,
              commandUsed
            )
          );
          return message.reply(fastSeeHelpMessage);
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
          const sortType = indexByRecency ? "By Recency" : "By Start Time";
          if (args[2] !== undefined) {
            // If the next argument is NotaNumber, invalid "past" command call
            if (isNaN(args[2])) {
              message.channel.send(
                await getCurrentOrRecentFastEmbed(
                  bot,
                  authorID,
                  fastIsInProgress,
                  timezoneOffset,
                  PREFIX,
                  commandUsed
                )
              );
              return message.reply(fastSeeHelpMessage);
            }
            if (parseInt(args[2]) <= 0) {
              message.channel.send(
                await getCurrentOrRecentFastEmbed(
                  bot,
                  authorID,
                  fastIsInProgress,
                  timezoneOffset,
                  PREFIX,
                  commandUsed
                )
              );
              return message.reply(fastSeeHelpMessage);
            }
            const confirmSeeMessage = `Are you sure you want to **see ${args[2]} fasts?**`;
            let confirmSeeAll = await fn.getUserConfirmation(
              bot,
              message.author.id,
      message.channel.id,
              PREFIX,
              confirmSeeMessage,
              forceSkip,
              `Fast: See ${args[2]} Fasts (${sortType})`
            );
            if (!confirmSeeAll) return;
          } else {
            // If the next argument is undefined, implied "see all" command call unless "all" was not called:
            // => empty "past" command call
            if (seeType !== "all") {
              message.channel.send(
                await getCurrentOrRecentFastEmbed(
                  bot,
                  authorID,
                  fastIsInProgress,
                  timezoneOffset,
                  PREFIX,
                  commandUsed
                )
              );
              return message.reply(fastSeeHelpMessage);
            }
            const confirmSeeAllMessage =
              "Are you sure you want to **see all** of your fast history?";
            let confirmSeeAll = await fn.getUserConfirmation(
              bot,
              message.author.id,
      message.channel.id,
              PREFIX,
              confirmSeeAllMessage,
              forceSkip,
              "Fast: See All Fasts"
            );
            if (!confirmSeeAll) return;
          }
          // To assign pastNumberOfEntriesIndex the argument value if not already see "all"
          if (pastNumberOfEntriesIndex === undefined) {
            pastNumberOfEntriesIndex = parseInt(args[2]);
          }
          var fastView;
          if (indexByRecency)
            fastView = await fn.getEntriesByRecency(
              Fast,
              { userID: authorID },
              0,
              pastNumberOfEntriesIndex
            );
          else
            fastView = await fn.getEntriesByStartTime(
              Fast,
              { userID: authorID },
              0,
              pastNumberOfEntriesIndex
            );
          console.log({ fastView });
          const fastDataToStringArray = multipleFastsToString(
            bot,
            message,
            fastView,
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
              fastDataToStringArray,
              `Fast: See ${pastNumberOfEntriesIndex} Fasts (${sortType})`,
              true,
              `Fasts ${fn.timestampToDateString(
                Date.now() + timezoneOffset * HOUR_IN_MS,
                false,
                false,
                true,
                true
              )}`,
              fastEmbedColour
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
          } else return message.reply(fastSeeHelpMessage);
          if (args[2 + shiftIndex]) {
            if (args[2 + shiftIndex].toLowerCase() === "past") {
              if (args[3 + shiftIndex] !== undefined) {
                const sortType = indexByRecency
                  ? "By Recency"
                  : "By Start Time";
                var entriesToSkip;
                // If the argument after past is a number, valid command call!
                if (!isNaN(args[3 + shiftIndex])) {
                  entriesToSkip = parseInt(args[3 + shiftIndex]);
                } else if (
                  args[3 + shiftIndex].toLowerCase() === "recent" ||
                  args[3 + shiftIndex].toLowerCase() === "current"
                ) {
                  entriesToSkip = await getCurrentOrRecentFastIndex(authorID);
                } else return message.reply(fastSeeHelpMessage);
                if (entriesToSkip < 0 || entriesToSkip > totalFastNumber) {
                  return fn.sendErrorMessageAndUsage(
                    message,
                    fastSeeHelpMessage,
                    "**FAST(S) DO NOT EXIST**..."
                  );
                }
                const confirmSeePastMessage = `Are you sure you want to **see ${args[1]} fasts past ${entriesToSkip}?**`;
                const confirmSeePast = await fn.getUserConfirmation(
                  bot,
                  message.author.id,
      message.channel.id,
                  PREFIX,
                  confirmSeePastMessage,
                  forceSkip,
                  `Fast: See ${args[1]} Fasts Past ${entriesToSkip} (${sortType})`
                );
                if (!confirmSeePast) return;
                var fastView;
                if (indexByRecency)
                  fastView = await fn.getEntriesByRecency(
                    Fast,
                    { userID: authorID },
                    entriesToSkip,
                    pastNumberOfEntriesIndex
                  );
                else
                  fastView = await fn.getEntriesByStartTime(
                    Fast,
                    { userID: authorID },
                    entriesToSkip,
                    pastNumberOfEntriesIndex
                  );
                console.log({ fastView });
                const fastDataToStringArray = multipleFastsToString(
                  bot,
                  message,
                  fastView,
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
                    fastDataToStringArray,
                    `Fast: See ${pastNumberOfEntriesIndex} Fasts Past ${entriesToSkip} (${sortType})`,
                    true,
                    `Fasts ${fn.timestampToDateString(
                      Date.now() + timezoneOffset * HOUR_IN_MS,
                      false,
                      false,
                      true,
                      true
                    )}`,
                    fastEmbedColour
                  )
                );
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
        var fastView;
        if (indexByRecency)
          fastView = await getOneFastByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        else
          fastView = await getOneFastByStartTime(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        console.log({ fastView });
        if (!fastView) {
          return fn.sendErrorMessage(
            message,
            `**FAST ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
          );
        }
        // NOT using the past functionality:
        const sortType = indexByRecency ? "By Recency" : "By Start Time";
        var fastData;
        const fastEndTime = fastView.endTime;
        if (fastEndTime === null) {
          fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
        } else {
          fastData = fastDocumentToDataArray(fastView);
        }

        var showFastEndMessage = false;
        if (fastEndTime === null) {
          showFastEndMessage = true;
        }
        const fastDataToString =
          `__**Fast ${pastNumberOfEntriesIndex}:**__\n` +
          fastDataArrayToString(
            bot,
            fastData,
            showFastEndMessage,
            PREFIX,
            commandUsed
          );
        const fastEmbed = fn.getEmbedArray(
          fastDataToString,
          `Fast: See Fast ${pastNumberOfEntriesIndex} (${sortType})`,
          true,
          `Fast ${fn.timestampToDateString(
            Date.now() + timezoneOffset * HOUR_IN_MS,
            false,
            false,
            true,
            true
          )}`,
          fastEmbedColour
        );
        await fn.sendPaginationEmbed(
          bot,
          message.channel.id,
          authorID,
          fastEmbed
        );
      }
    } else if (
      fastCommand === "delete" ||
      fastCommand === "d" ||
      fastCommand === "remove" ||
      fastCommand === "del" ||
      fastCommand === "clear" ||
      fastCommand === "erase"
    ) {
      const additionalInstruction = `\n\nIF you'd like to get your fasts in a text file (.txt) first before trying to delete: try \`${PREFIX}${commandUsed} see\``;
      var fastDeleteUsage = fn.getReadOrDeleteUsageMessage(
        PREFIX,
        commandUsed,
        fastCommand,
        true,
        ["Fast", "Fasts"],
        true,
        fastFieldList,
        false,
        additionalInstruction
      );
      fastDeleteUsage = fn.getMessageEmbed(
        fastDeleteUsage,
        `Fast: Delete Help`,
        fastEmbedColour
      );
      const fastDeleteHelpMessage = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
      const trySeeCommandMessage = `Try \`${PREFIX}${commandUsed} see help\``;

      // delete help command so that the user does not get spammed with the usage message!
      if (args[1] !== undefined) {
        if (args[1].toLowerCase() === "help") {
          return message.channel.send(fastDeleteUsage);
        }
        // If the user has no fasts
        if (totalFastNumber === 0) {
          return message.reply(
            `**NO FASTS**... try \`${PREFIX}${commandUsed} start\``
          );
        }
      }
      // fast delete (only):
      else return message.reply(fastDeleteHelpMessage);

      // Show the user the most recent fast
      if (args[1] === undefined || args.length === 1) {
        message.channel.send(
          await getCurrentOrRecentFastEmbed(
            bot,
            authorID,
            fastIsInProgress,
            timezoneOffset,
            PREFIX,
            commandUsed
          )
        );
        return message.reply(fastDeleteHelpMessage);
      }

      // Delete Handler:

      // delete past #:
      else if (args[2] !== undefined) {
        const deleteType = args[1].toLowerCase();
        if (deleteType === "past") {
          // If the following argument is not a number, exit!
          if (isNaN(args[2])) {
            return fn.sendErrorMessageAndUsage(message, fastDeleteHelpMessage);
          }
          var numberArg = parseInt(args[2]);
          if (numberArg <= 0) {
            return fn.sendErrorMessageAndUsage(message, fastDeleteHelpMessage);
          }
          let indexByRecency = false;
          if (args[3] !== undefined) {
            if (args[3].toLowerCase() === "recent") {
              indexByRecency = true;
            }
          }
          const sortType = indexByRecency ? "By Recency" : "By Start Time";
          var fastCollection;
          if (indexByRecency)
            fastCollection = await fn.getEntriesByRecency(
              Fast,
              { userID: authorID },
              0,
              numberArg
            );
          else
            fastCollection = await fn.getEntriesByStartTime(
              Fast,
              { userID: authorID },
              0,
              numberArg
            );
          const fastDataToStringArray = multipleFastsToString(
            bot,
            message,
            fastCollection,
            numberArg,
            timezoneOffset,
            0,
            true
          );
          const fastArray = fn.getEmbedArray(
            fastDataToStringArray,
            ``,
            true,
            false,
            fastEmbedColour
          );
          console.log({ fastArray });
          // If the message is too long, the confirmation window didn't pop up and it defaulted to false!
          const multipleDeleteMessage = `Are you sure you want to **delete the past ${numberArg} fast(s)**?`;
          const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
            bot,
            message.author.id,
            message.channel.id,
            PREFIX,
            fastArray,
            multipleDeleteMessage,
            forceSkip,
            `Fast: Delete Past ${numberArg} Fasts (${sortType})`,
            600000
          );
          if (!multipleDeleteConfirmation) return;
          const targetIDs = await fastCollection.map((fast) => fast._id);
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Past ${numberArg} Fasts (${sortType})`
          );
          targetIDs.forEach((id) => {
            rm.cancelReminderById(id);
          });
          await del.deleteManyByIDAndConnectedReminders(Fast, targetIDs);
          return;
        }
        if (deleteType === "many") {
          if (args[2] === undefined) {
            return message.reply(fastDeleteHelpMessage);
          }
          // Get the arguments after keyword MANY
          // Filter out the empty inputs and spaces due to multiple commas (e.g. ",,,, ,,, ,   ,")
          // Convert String of Numbers array into Integer array
          // Check which fasts exist, remove/don't add those that don't
          let toDelete = args[2].split(",").filter((index) => {
            if (!isNaN(index)) {
              numberIndex = parseInt(index);
              if (numberIndex > 0 && numberIndex <= totalFastNumber) {
                return numberIndex;
              }
            } else if (index === "recent" || index === "current") {
              return true;
            }
          });
          const recentIndex = await getCurrentOrRecentFastIndex(authorID);
          toDelete = Array.from(
            new Set(
              toDelete.map((number) => {
                if (number === "recent" || number === "current") {
                  return recentIndex;
                } else return +number;
              })
            )
          );
          console.log({ toDelete });
          // Send error message if none of the given fasts exist
          if (!toDelete.length) {
            return fn.sendErrorMessage(
              message,
              "All of these **fasts DO NOT exist**..."
            );
          } else {
            var indexByRecency = false;
            if (args[3] !== undefined) {
              if (args[3].toLowerCase() === "recent") {
                indexByRecency = true;
              }
            }
            var fastTargetIDs = new Array();
            var fastDataToString = new Array();
            for (let i = 0; i < toDelete.length; i++) {
              var fastView;
              if (indexByRecency) {
                fastView = await getOneFastByRecency(authorID, toDelete[i] - 1);
              } else {
                fastView = await getOneFastByStartTime(
                  authorID,
                  toDelete[i] - 1
                );
              }
              var fastData;
              if (toDelete[i] === 1) {
                fastData = fastDocumentToDataArray(
                  fastView,
                  timezoneOffset,
                  true
                );
              } else {
                fastData = fastDocumentToDataArray(fastView);
              }
              fastTargetIDs.push(fastView._id);
              fastDataToString.push(
                `__**Fast ${toDelete[i]}:**__\n${fastDataArrayToString(
                  bot,
                  fastData
                )}`
              );
            }
            const fastDataToStringArray = fn.getEmbedArray(
              fastDataToString,
              ``,
              true,
              false
            );
            const deleteConfirmMessage = `Are you sure you want to **delete fasts ${toDelete}?:**`;
            const sortType = indexByRecency ? "By Recency" : "By Start Time";
            const confirmDeleteMany = await fn.getPaginatedUserConfirmation(
              bot,
              message.author.id,
            message.channel.id,
              PREFIX,
              fastDataToStringArray,
              deleteConfirmMessage,
              forceSkip,
              `Fast: Delete Fasts ${toDelete} (${sortType})`,
              600000
            );
            if (confirmDeleteMany) {
              console.log(
                `Deleting ${authorID}'s Fasts ${toDelete} (${sortType})`
              );
              fastTargetIDs.forEach((id) => {
                rm.cancelReminderById(id);
              });
              await del.deleteManyByIDAndConnectedReminders(
                Fast,
                fastTargetIDs
              );
              return;
            } else return;
          }
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
          if (args[2 + shiftIndex]) {
            if (args[2 + shiftIndex].toLowerCase() === "past") {
              var skipEntries;
              if (isNaN(args[3 + shiftIndex])) {
                if (
                  args[3 + shiftIndex].toLowerCase() === "recent" ||
                  args[3 + shiftIndex].toLowerCase() === "current"
                ) {
                  skipEntries = await getCurrentOrRecentFastIndex(authorID);
                } else return message.reply(fastDeleteHelpMessage);
              } else skipEntries = parseInt(args[3 + shiftIndex]);
              const pastNumberOfEntries = parseInt(args[1]);
              if (pastNumberOfEntries <= 0 || skipEntries < 0) {
                return fn.sendErrorMessageAndUsage(
                  message,
                  fastDeleteHelpMessage
                );
              }
              var fastCollection;
              if (indexByRecency)
                fastCollection = await fn.getEntriesByRecency(
                  Fast,
                  { userID: authorID },
                  skipEntries,
                  pastNumberOfEntries
                );
              else
                fastCollection = await fn.getEntriesByStartTime(
                  Fast,
                  { userID: authorID },
                  skipEntries,
                  pastNumberOfEntries
                );
              const showFasts = multipleFastsToString(
                bot,
                message,
                fastCollection,
                pastNumberOfEntries,
                timezoneOffset,
                skipEntries,
                true
              );
              const fastArray = fn.getEmbedArray(
                showFasts,
                ``,
                true,
                false,
                fastEmbedColour
              );
              if (skipEntries >= totalFastNumber) return;
              // If the message is too long, the confirmation window didn't pop up and it defaulted to false!
              const sortType = indexByRecency ? "By Recency" : "By Start Time";
              const multipleDeleteMessage = `Are you sure you want to **delete ${fastCollection.length} fast(s) past fast ${skipEntries}**?`;
              const multipleDeleteConfirmation = await fn.getPaginatedUserConfirmation(
                bot,
                message.author.id,
            message.channel.id,
                PREFIX,
                fastArray,
                multipleDeleteMessage,
                forceSkip,
                `Fast: Multiple Delete Warning! (${sortType})`,
                600000
              );
              // const multipleDeleteConfirmation = await fn.getUserConfirmation(bot, message, PREFIX, multipleDeleteMessage, forceSkip, `Fast: Multiple Delete Warning! (${sortType})`);
              if (!multipleDeleteConfirmation) return;
              const targetIDs = await fastCollection.map((fast) => fast._id);
              console.log(
                `Deleting ${authorUsername}'s (${authorID}) ${pastNumberOfEntries} fast(s) past ${skipEntries} (${sortType})`
              );
              targetIDs.forEach((id) => {
                rm.cancelReminderById(id);
              });
              await del.deleteManyByIDAndConnectedReminders(Fast, targetIDs);
              return;
            }

            // They haven't specified the field for the fast delete past function
            else if (deleteType === "past")
              return message.reply(fastDeleteHelpMessage);
            else return message.reply(fastDeleteHelpMessage);
          }
        }
      }
      // Next: FAST DELETE ALL
      // Next: FAST DELETE MANY
      // Next: FAST DELETE

      // fast delete <NUMBER/RECENT/ALL>
      const noFastsMessage = `**NO FASTS**... try \`${PREFIX}${commandUsed} start help\``;
      if (isNaN(args[1])) {
        const deleteType = args[1].toLowerCase();
        if (deleteType == "recent" || deleteType == "current") {
          const fastView = await getCurrentOrMostRecentFast(authorID);
          if (fastView.length === 0) {
            return fn.sendErrorMessage(message, noFastsMessage);
          }
          const fastData = fastDocumentToDataArray(
            fastView,
            timezoneOffset,
            true
          );
          const fastTargetID = fastView._id;
          console.log({ fastTargetID });
          const fastIndex = await getCurrentOrRecentFastIndex(authorID);
          const fastEmbed = fn.getEmbedArray(
            `__**Fast ${fastIndex}:**__\n${fastDataArrayToString(
              bot,
              fastData
            )}`,
            `Fast: Delete Recent Fast`,
            true,
            false,
            fastEmbedColour
          );
          const deleteConfirmMessage = `Are you sure you want to **delete your most recent fast?**`;
          const deleteIsConfirmed = await fn.getPaginatedUserConfirmation(
            bot,
            message.author.id,
            message.channel.id,
            PREFIX,
            fastEmbed,
            deleteConfirmMessage,
            forceSkip,
            `Fast: Delete Recent Fast`,
            600000
          );
          if (deleteIsConfirmed) {
            rm.cancelReminderById(fastTargetID);
            await del.deleteOneByIDAndConnectedReminders(Fast, fastTargetID);
            return;
          }
        } else if (deleteType === "all") {
          const confirmDeleteAllMessage = `Are you sure you want to **delete all** of your recorded fasts?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          const pastNumberOfEntriesIndex = totalFastNumber;
          if (pastNumberOfEntriesIndex === 0) {
            return fn.sendErrorMessage(message, noFastsMessage);
          }
          let confirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message.author.id,
      message.channel.id,
            PREFIX,
            confirmDeleteAllMessage,
            forceSkip,
            "Fast: Delete All Fasts WARNING!"
          );
          if (!confirmDeleteAll) return;
          const finalDeleteAllMessage = `Are you reaaaallly, really, truly, very certain you want to delete **ALL OF YOUR FASTS ON RECORD**?\n\nYou **cannot UNDO** this!\n\n*(I'd suggest you* \`${PREFIX}${commandUsed} see all\` *first)*`;
          let finalConfirmDeleteAll = await fn.getUserConfirmation(
            bot,
            message.author.id,
      message.channel.id,
            PREFIX,
            finalDeleteAllMessage,
            false,
            "Fast: Delete ALL Fasts FINAL Warning!"
          );
          if (!finalConfirmDeleteAll) return;

          console.log(
            `Deleting ALL OF ${authorUsername}'s (${authorID}) Recorded Fasts`
          );
          const allQuery = { userID: authorID };
          await del.deleteManyAndConnectedReminders(Fast, allQuery);
          return;
        } else return message.reply(fastDeleteHelpMessage);
      } else {
        const pastNumberOfEntriesIndex = parseInt(args[1]);
        let indexByRecency = false;
        if (args[2] !== undefined) {
          if (args[2].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }
        var fastView;
        if (indexByRecency)
          fastView = await getOneFastByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        else
          fastView = await getOneFastByStartTime(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        if (!fastView) {
          return fn.sendErrorMessageAndUsage(
            message,
            trySeeCommandMessage,
            "**FAST DOES NOT EXIST**..."
          );
        }
        const fastData = fastView.fastDuration
          ? fastDocumentToDataArray(fastView)
          : fastDocumentToDataArray(fastView, timezoneOffset, true);
        const fastTargetID = fastView._id;
        const sortType = indexByRecency ? "By Recency" : "By Start Time";
        const fastEmbed = fn.getEmbedArray(
          `__**Fast ${pastNumberOfEntriesIndex}:**__\n${fastDataArrayToString(
            bot,
            fastData
          )}`,
          `Fast: Delete Fast ${pastNumberOfEntriesIndex} (${sortType})`,
          true,
          false,
          fastEmbedColour
        );
        const deleteConfirmMessage = `Are you sure you want to **delete Fast ${pastNumberOfEntriesIndex}?**`;
        const deleteConfirmation = await fn.getPaginatedUserConfirmation(
          bot,
          message.author.id,
            message.channel.id,
          PREFIX,
          fastEmbed,
          deleteConfirmMessage,
          forceSkip,
          `Fast: Delete Fast ${pastNumberOfEntriesIndex} (${sortType})`,
          600000
        );
        if (deleteConfirmation) {
          console.log(
            `Deleting ${authorUsername}'s (${authorID}) Fast ${sortType}`
          );
          rm.cancelReminderById(fastTargetID);
          await del.deleteOneByIDAndConnectedReminders(Fast, fastTargetID);
          return;
        }
      }
    } else if (
      fastCommand === "edit" ||
      fastCommand === "ed" ||
      fastCommand === "change" ||
      fastCommand === "ch" ||
      fastCommand === "alter" ||
      fastCommand === "update" ||
      fastCommand === "up" ||
      fastCommand === "upd"
    ) {
      var fastEditUsage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\`\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent/current; 3** (3rd most recent entry, \\**any number*)\n\n\`<recent?>\`(OPT.): type **recent** at the indicated spot to sort the fasts by **time created instead of fast start time!**\n\n\`<force?>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      fastEditUsage = fn.getMessageEmbed(
        fastEditUsage,
        `Fast: Edit Help`,
        fastEmbedColour
      );
      const fastEditHelp = `Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
      var pastNumberOfEntriesIndex;
      if (args[1] !== undefined) {
        if (args[1].toLowerCase() === "help") {
          return message.channel.send(fastEditUsage);
        }
        // If the user has no fasts
        if (totalFastNumber === 0) {
          return message.reply(
            `**NO FASTS**... Try \`${PREFIX}${commandUsed} start help\``
          );
        }
      }
      // User typed fast edit only
      else return message.reply(fastEditHelp);

      if (
        isNaN(args[1]) &&
        args[1].toLowerCase() !== "recent" &&
        args[1].toLowerCase() !== "current"
      ) {
        return message.reply(fastEditHelp);
      } else {
        var fastFields = [
          "Start Time",
          "End Time",
          "Fast Breaker",
          "Mood",
          "Reflection",
        ];

        if (
          args[1].toLowerCase() === "recent" ||
          args[1].toLowerCase() === "current"
        ) {
          pastNumberOfEntriesIndex = await getCurrentOrRecentFastIndex(
            authorID
          );
        } else {
          pastNumberOfEntriesIndex = parseInt(args[1]);
          if (pastNumberOfEntriesIndex <= 0) {
            return fn.sendErrorMessageAndUsage(
              message,
              fastEditHelp,
              "**FAST DOES NOT EXIST**..."
            );
          }
        }

        var indexByRecency = false;
        if (args[2] !== undefined) {
          if (args[2].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }

        var fastView;
        if (indexByRecency)
          fastView = await getOneFastByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        else
          fastView = await getOneFastByStartTime(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        if (!fastView) {
          return fn.sendErrorMessageAndUsage(
            message,
            fastEditHelp,
            `**FAST ${pastNumberOfEntriesIndex} DOES NOT EXIST**...`
          );
        }

        const sortType = indexByRecency ? "By Recency" : "By Start Time";
        const fastTargetID = fastView._id;
        var fastData, showFast, continueEdit, isCurrent;
        do {
          const checkFast = await Fast.findById(fastTargetID);
          if (!checkFast) return;
          isCurrent = false;
          continueEdit = false;
          if (fastView.endTime === null) {
            fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
            showFast = fastDataArrayToString(
              bot,
              fastData,
              true,
              PREFIX,
              commandUsed
            );
            isCurrent = true;
          } else {
            fastData = fastDocumentToDataArray(fastView);
            showFast = fastDataArrayToString(bot, fastData);
          }
          // Field the user wants to edit
          const fieldToEditInstructions =
            "**Which field do you want to edit?**";
          const fieldToEditAdditionalMessage = `__**Fast ${pastNumberOfEntriesIndex} (${sortType}):**__\n${showFast}`;
          const fieldToEditTitle = `Fast: Edit Field`;
          var fieldToEdit, fieldToEditIndex;
          const selectedField = await fn.getUserSelectedObject(
                bot,
                message.author.id,
                message.channel.id,
            PREFIX,
            fieldToEditInstructions,
            fieldToEditTitle,
            fastFields,
            "",
            false,
            fastEmbedColour,
            600000,
            0,
            fieldToEditAdditionalMessage
          );
          if (!selectedField) return;
          else {
            fieldToEdit = selectedField.object;
            fieldToEditIndex = selectedField.index;
          }
          const type = "Fast";
          switch (fieldToEditIndex) {
            case 0:
              fastEditMessagePrompt = `\n${timeExamples}`;
              userEdit = await fn.getUserEditString(
                bot,
                message.author.id,
                message.channel.id,
                PREFIX,
                fieldToEdit,
                fastEditMessagePrompt,
                type,
                forceSkip,
                fastEmbedColour
              );
              break;
            case 1:
              fastEditMessagePrompt = `\n${timeExamples}`;
              userEdit = await fn.getUserEditString(
                bot,
                message.author.id,
                message.channel.id,
                PREFIX,
                fieldToEdit,
                fastEditMessagePrompt,
                type,
                forceSkip,
                fastEmbedColour
              );
              break;
            // No prompt for the fast breaker
            case 2:
              fastEditMessagePrompt = "(Within 150 characters)";
              userEdit = await fn.getUserEditString(
                bot,
                message.author.id,
                message.channel.id,
                PREFIX,
                fieldToEdit,
                fastEditMessagePrompt,
                type,
                forceSkip,
                fastEmbedColour,
                150
              );
              break;
            case 3: {
              let moodEmojis = ["😖", "😔", "😐", "🙂", "😄"];
              fastEditMessagePrompt =
                "**__How did you feel during this past fast?__\n\nEnter a number from 1-5 (1 = worst, 5 = best)**\n`5`-😄; `4`-🙂; `3`-😐; `2`-😔; `1`-😖";
              userEdit = await fn.getUserEditNumber(
                bot,
                message.author.id,
                message.channel.id,
                PREFIX,
                fieldToEdit,
                5,
                type,
                moodEmojis,
                forceSkip,
                fastEmbedColour,
                fastEditMessagePrompt
              );
              break;
            }
            case 4:
              fastEditMessagePrompt =
                "\n**__Reflection Questions:__**\n🤔 - **Why did you feel that way?**\n💭 - **What did you do that made it great? / What could you have done to make it better?**\n(Within 1000 characters)";
              userEdit = await fn.getUserMultilineEditString(
                bot,
                message.author.id,
                message.channel.id,
                PREFIX,
                fieldToEdit,
                fastEditMessagePrompt,
                type,
                forceSkip,
                fastEmbedColour,
                1000
              );
              break;
          }
          if (userEdit === false) return;
          else if (userEdit === undefined) userEdit = "back";
          else if (userEdit !== "back") {
            // Parse User Edit
            if (fieldToEditIndex === 0 || fieldToEditIndex === 1) {
              userEdit = userEdit.toLowerCase().split(/[\s\n]+/);
              console.log({ userEdit });
              const now = Date.now();
              fastData[fieldToEditIndex] = fn.timeCommandHandlerToUTC(
                userEdit,
                now,
                timezoneOffset,
                daylightSavingSetting
              );
              if (!fastData[fieldToEditIndex]) {
                fn.sendReplyThenDelete(
                  message,
                  `**INVALID TIME**... Try \`${PREFIX}date\` for **help with entering dates and times**`,
                  60000
                );
              }
              console.log({ fastData });
              // If the end time is correctly after the start time, update the fast duration as well!
              // Otherwise, go back to the main menu
              const validFastDuration = fastData[fieldToEditIndex]
                ? await fn.endTimeAfterStartTime(
                  bot,
                  message.channel.id,
                    fastData[0],
                    fastData[1],
                    type
                  )
                : false;
              if (!validFastDuration) {
                continueEdit = true;
              } else {
                const startTimestamp = fastData[0];
                if (isCurrent) {
                  var changeReminders = true;
                  var newDuration = false;
                  var end = false;
                  var endTimeIsDefined = false;
                  const connectedReminderQuery = {
                    userID: authorID,
                    connectedDocument: fastTargetID,
                  };
                  var oldReminders;
                  if (fastTargetID)
                    oldReminders = await Reminder.find(
                      connectedReminderQuery
                    ).sort({ endTime: -1 });
                  // Automatically update the end time if the start time is edited
                  // If the end time is edited remove ambiguity of user intent
                  // By prompting if they wish to end their fast or update their fast end time!
                  if (fieldToEditIndex === 1) {
                    const changeRemindersMessage =
                      "⬆ - **Update your fast ending reminders**\n**⏭ - End this current fast**\n❌ - **Exit**";
                    const endReaction = await fn.reactionDataCollect(
                      bot,
                      authorID,
          message.channel.id,
                      changeRemindersMessage,
                      ["⬆", "⏭", "❌"],
                      "Fast: Update Ending Reminders or End Fast",
                      fastEmbedColour,
                      60000
                    );
                    endTimeIsDefined = false;
                    switch (endReaction) {
                      case "⬆":
                        end = false;
                        changeReminders = true;
                        endTimeIsDefined = true;
                        break;
                      case "⏭":
                        end = true;
                        changeReminders = false;
                        endTimeIsDefined = true;
                        break;
                      case "❌":
                        end = false;
                        changeReminders = false;
                        endTimeIsDefined = false;
                        break;
                    }
                    if (end)
                      if (fastTargetID) {
                        rm.cancelRemindersByConnectedDocument(fastTargetID);
                        await Reminder.deleteMany(connectedReminderQuery);
                      }
                  } else if (fieldToEditIndex === 0) {
                    const updateRemindersMessage =
                      "Do you want to **update your intended fast duration?**";
                    const updateConfirmation = await fn.getUserConfirmation(
                      bot,
                      message.author.id,
      message.channel.id,
                      PREFIX,
                      updateRemindersMessage,
                      false,
                      "Fast: Update Fast Duration"
                    );
                    if (!updateConfirmation) {
                      newDuration = false;
                      if (!oldReminders.length) end = true;
                    } else newDuration = true;
                  }

                  if (changeReminders) {
                    const currentTimestamp = Date.now();
                    var reminderEndTime;
                    if (endTimeIsDefined) {
                      const endTimestamp = fastData[1];
                      reminderEndTime = endTimestamp;
                    } else if (oldReminders.length && !newDuration) {
                      // The largest endTimestamp is assumed to be the fast end time!
                      // oldReminders is sorted from greatest to least.
                      reminderEndTime =
                        startTimestamp +
                        oldReminders[0].endTime -
                        oldReminders[0].startTime;
                      if (!reminderEndTime) changeReminders = false;
                    } else {
                      reminderEndTime = await getUserReminderEndTime(
                        bot,
                        message,
                        PREFIX,
                        `Try \`${
                          fieldToEditIndex === 0
                            ? `${PREFIX}${commandUsed} start help`
                            : `${PREFIX}${commandUsed} end help`
                        }\``,
                        startTimestamp,
                        timezoneOffset,
                        daylightSavingSetting,
                        forceSkip
                      );
                      if (!reminderEndTime && reminderEndTime !== 0)
                        changeReminders = false;
                    }
                    if (changeReminders) {
                      if (fastTargetID) {
                        rm.cancelRemindersByConnectedDocument(fastTargetID);
                        await Reminder.deleteMany(connectedReminderQuery);
                      }
                      console.log({
                        timezoneOffset,
                        authorID,
                        fastTargetID,
                        currentTimestamp,
                        startTimestamp,
                        reminderEndTime,
                      });
                      // First Reminder: 1 Hour Warning/Motivation
                      if (reminderEndTime > currentTimestamp) {
                        setFastEndHourReminder(
                          bot,
                          timezoneOffset,
                          authorID,
                          fastTargetID,
                          startTimestamp,
                          reminderEndTime,
                          1
                        );
                      }
                      // Second Reminder: End Time
                      setFastEndReminder(
                        bot,
                        timezoneOffset,
                        commandUsed,
                        authorID,
                        fastTargetID,
                        startTimestamp,
                        reminderEndTime
                      );
                    } else fastData[1] = null;
                  }
                }
                if (endTimeIsDefined) {
                  const endTimestamp = fastData[1];
                  fastData[2] = endTimestamp - startTimestamp;
                }
                if (!end) {
                  fastData[1] = null;
                  fastData[2] = null;
                }
              }
            } else {
              switch (fieldToEditIndex) {
                case 2:
                  fastData[fieldToEditIndex + 1] = userEdit;
                  break;
                case 3:
                  if (!isNaN(userEdit)) {
                    if (userEdit > 0 || userEdit <= 5) {
                      fastData[fieldToEditIndex + 1] = parseInt(userEdit);
                    }
                  }
                  break;
                case 4:
                  fastData[fieldToEditIndex + 1] = userEdit;
                  break;
              }
            }
            if (!continueEdit) {
              try {
                console.log(
                  `Editing ${authorID}'s Fast ${pastNumberOfEntriesIndex} (${sortType})`
                );
                switch (fieldToEditIndex) {
                  case 0:
                    fastView = await Fast.findOneAndUpdate(
                      { _id: fastTargetID },
                      {
                        $set: {
                          startTime: fastData[0],
                          fastDuration: fastData[2],
                        },
                      },
                      { new: true }
                    );
                    break;
                  case 1:
                    fastView = await Fast.findOneAndUpdate(
                      { _id: fastTargetID },
                      {
                        $set: {
                          endTime: fastData[1],
                          fastDuration: fastData[2],
                        },
                      },
                      { new: true }
                    );
                    break;
                  case 2:
                    fastView = await Fast.findOneAndUpdate(
                      { _id: fastTargetID },
                      { $set: { fastBreaker: fastData[3] } },
                      { new: true }
                    );
                    break;
                  case 3:
                    fastView = await Fast.findOneAndUpdate(
                      { _id: fastTargetID },
                      { $set: { mood: fastData[4] } },
                      { new: true }
                    );
                    break;
                  case 4:
                    fastView = await Fast.findOneAndUpdate(
                      { _id: fastTargetID },
                      { $set: { reflection: fastData[5] } },
                      { new: true }
                    );
                    break;
                }
                console.log({ continueEdit, userEdit });
                if (fastView) {
                  pastNumberOfEntriesIndex = indexByRecency
                    ? await fn.getEntryIndexByFunction(
                        authorID,
                        fastTargetID,
                        totalFastNumber,
                        getOneFastByRecency
                      )
                    : await fn.getEntryIndexByFunction(
                        authorID,
                        fastTargetID,
                        totalFastNumber,
                        getOneFastByStartTime
                      );
                  console.log({
                    fastView,
                    fastData,
                    fastTargetID,
                    fieldToEditIndex,
                  });
                  fastData = fastDocumentToDataArray(
                    fastView,
                    timezoneOffset,
                    true
                  );
                  showFast = fastDataArrayToString(bot, fastData);
                  console.log({ userEdit });
                  const continueEditMessage = `Do you want to continue **editing Fast ${pastNumberOfEntriesIndex}?:**\n\n__**Fast ${pastNumberOfEntriesIndex}:**__\n${showFast}`;
                  continueEdit = await fn.getUserConfirmation(
                    bot,
                    message.author.id,
      message.channel.id,
                    PREFIX,
                    continueEditMessage,
                    forceSkip,
                    `Fast: Continue Editing Fast ${pastNumberOfEntriesIndex}?`,
                    300000
                  );
                } else {
                  message.reply("**Fast does not exist anymore...**");
                  continueEdit = false;
                }
              } catch (err) {
                return console.log(err);
              }
            } else {
              console.log({ continueEdit, userEdit });
              fastView = await Fast.findById(fastTargetID);
              if (fastView) {
                pastNumberOfEntriesIndex = indexByRecency
                  ? await fn.getEntryIndexByFunction(
                      authorID,
                      fastTargetID,
                      totalFastNumber,
                      getOneFastByRecency
                    )
                  : await fn.getEntryIndexByFunction(
                      authorID,
                      fastTargetID,
                      totalFastNumber,
                      getOneFastByStartTime
                    );
                console.log({
                  fastView,
                  fastData,
                  fastTargetID,
                  fieldToEditIndex,
                });
                fastData = fastDocumentToDataArray(
                  fastView,
                  timezoneOffset,
                  true
                );
                showFast = fastDataArrayToString(bot, fastData);
              } else {
                message.reply("**Fast does not exist anymore...**");
                continueEdit = false;
              }
            }
          } else continueEdit = true;
        } while (continueEdit === true);
        return;
      }
    } else if (
      fastCommand === "post" ||
      fastCommand === "p" ||
      fastCommand === "send" ||
      fastCommand === "accountability" ||
      fastCommand === "share" ||
      fastCommand === "upload"
    ) {
      var fastPostUsageMessage = `**USAGE:**\n\`${PREFIX}${commandUsed} ${fastCommand} <#_MOST_RECENT_ENTRY> <recent?> <force?>\`\n\n\`<#_MOST_RECENT_ENTRY>\`: **recent; 3 **(3rd most recent entry, \\**any number*)\n\n\`<recent?>\`(OPT.): type **recent** at the indicated spot to sort the fasts by **time created instead of fast start time!**\n\n\`<force>\`(OPT.): type **force** at the end of your command to **skip all of the confirmation windows!**`;
      fastPostUsageMessage = fn.getMessageEmbed(
        fastPostUsageMessage,
        `Fast: Post Help`,
        fastEmbedColour
      );
      const fastPostHelpMessage = `**INVALID USAGE**... Try \`${PREFIX}${commandUsed} ${fastCommand} help\``;
      if (args[1] !== undefined) {
        var fastData;
        if (args[1].toLowerCase() === "help") {
          return message.channel.send(fastPostUsageMessage);
        }
        // If the user has no fasts
        if (totalFastNumber === 0) {
          return message.reply(
            `**NO FASTS**... try \`${PREFIX}${commandUsed} start help\``
          );
        }
        let pastNumberOfEntriesIndex = parseInt(args[1]);
        var indexByRecency = false;
        if (args[2] !== undefined) {
          if (args[2].toLowerCase() === "recent") {
            indexByRecency = true;
          }
        }

        var fastView;
        if (isNaN(args[1])) {
          if (
            args[1].toLowerCase() === "recent" ||
            args[1].toLowerCase() === "current"
          ) {
            fastView = await getCurrentOrMostRecentFast(authorID);
            indexByRecency = true;
            pastNumberOfEntriesIndex = 1;
          } else return message.reply(fastPostHelpMessage);
        } else if (indexByRecency)
          fastView = await getOneFastByRecency(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        else
          fastView = await getOneFastByStartTime(
            authorID,
            pastNumberOfEntriesIndex - 1
          );
        console.log({ fastView });
        if (!fastView)
          return fn.sendErrorMessage(message, "**FAST DOES NOT EXIST**...");

        var fastData;
        if (pastNumberOfEntriesIndex === 1 && fastView.endTime === null) {
          fastData = fastDocumentToDataArray(fastView, timezoneOffset, true);
        } else fastData = fastDocumentToDataArray(fastView);
        console.log({ fastData });

        const endTimestamp = fastData[1];
        let fastPost = await getFastPostEmbedArray(
          bot,
          message,
          PREFIX,
          fastData,
          forceSkip
        );
        console.log({ fastPost });
        if (!fastPost) return;
        const finalEndTimestamp = endTimestamp || Date.now();
        const endTimeToDate = fn.timestampToDateString(
          finalEndTimestamp,
          false,
          true,
          true
        );
        const mistakeMessage = `Exiting... try \`${PREFIX}${commandUsed} post\` to try to **post again!**`;
        let postChannel = await fn.getTargetChannel(
          bot,
          message,
          PREFIX,
          "Fast",
          forceSkip,
          true,
          false,
          true,
          fastEmbedColour
        );
        if (!postChannel)
          await showFastPost(bot, message, fastPost, mistakeMessage);
        // Overwrite fastPost Title with one specific to user's nickname in respective server
        fastPost.forEach(async (post, i) => {
          fastPost[i] = post.setTitle(
            `${
              bot.channels.cache.get(postChannel).guild.member(authorID)
                .displayName
            }'s Fast - ${endTimeToDate}`
          );
          await fn.sendMessageToChannel(bot, post, postChannel);
        });
        return;
      }
      // fast post (only):
      else return message.reply(fastPostHelpMessage);
    } else return message.reply(fastHelpMessage);
  },
};
