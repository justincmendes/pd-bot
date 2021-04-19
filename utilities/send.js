// TODO: Add sendPaginationEmbed to export (along with all of it's internal function dependencies) + refactor all code that utilizes sendPaginationEmbed & it's dependent subfunctions.

/**
 * In milliseconds
 */
const DEFAULT_TIMEOUT = 15000;

/**
 * Sets the deleteMessage object's timeout if there is none. (ONLY IF NEEDED)
 * @param {object} deleteMessage Will be updated (passed by reference)
 * @returns
 */
const parseDefaultTimeout = (deleteMessage) => {
  if (deleteMessage && deleteMessage.delete) {
    if (!deleteMessage.timeout && deleteMessage.timeout !== 0) {
      deleteMessage.timeout = DEFAULT_TIMEOUT;
    }
  }
  return;
};

module.exports = {
  sendMessage: async function (
    bot,
    channelID,
    message,
    deleteMessage = { delete: false, timeout: DEFAULT_TIMEOUT }
  ) {
    parseDefaultTimeout(deleteMessage);
    const sentChannelMessage = await this.sendChannelMessage(
      bot,
      channelID,
      message,
      deleteMessage
    );
    if (sentChannelMessage) return true;
    const sentUserMessage = await this.sendUserMessage(
      bot,
      channelID,
      message,
      deleteMessage
    );
    if (sentUserMessage) return true;
    return false;
  },
  reply: async function (
    bot,
    channelID,
    message,
    userID = undefined,
    deleteMessage = { delete: false, timeout: DEFAULT_TIMEOUT }
  ) {
    parseDefaultTimeout(deleteMessage);
    // If it's a channel message and not an embed (plain text), then tag the user
    const isDm = channelID === userID;
    if (userID && !isDm) {
      // If the message param is an embed (i.e. in the form of an object), then there is no need to add the user tag at the beginning
      if (typeof message !== "object") {
        message = `\<@!${userID}\>, ${message}`;
      }
    }
    const sentChannelMessage = await this.sendChannelMessage(
      bot,
      channelID,
      message,
      deleteMessage
    );
    if (sentChannelMessage) return true;
    const sentUserMessage = await this.sendUserMessage(
      bot,
      channelID,
      message,
      deleteMessage
    );
    if (sentUserMessage) return true;
    return false;
  },
  sendChannelMessage: async function (
    bot,
    channelID,
    message,
    deleteMessage = { delete: false, timeout: DEFAULT_TIMEOUT }
  ) {
    try {
      const channelObject = bot.channels.cache.get(channelID);
      if (channelObject) {
        const messageSent = await channelObject.send(message);
        await this.deleteMessage(messageSent, deleteMessage);
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  },
  sendUserMessage: async function (
    bot,
    userID,
    message,
    deleteMessage = { delete: false, timeout: DEFAULT_TIMEOUT }
  ) {
    try {
      const userObject = bot.users.cache.get(userID);
      if (userObject) {
        const messageSent = await userObject.send(message);
        await this.deleteMessage(messageSent, deleteMessage);
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  },
  deleteMessage: async function (
    messageSent,
    deleteMessage = { delete: false, timeout: DEFAULT_TIMEOUT }
  ) {
    try {
      if (deleteMessage && deleteMessage.delete) {
        messageSent.delete({
          timeout:
            !deleteMessage.timeout && deleteMessage.timeout !== 0
              ? DEFAULT_TIMEOUT
              : deleteMessage.timeout,
        });
      }
    } catch (err) {
      console.error(err);
    }
  },
};
