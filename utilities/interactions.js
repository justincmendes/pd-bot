const Discord = require("discord.js");
const User = require("../djs-bot/database/schemas/user");

const tm = require("./timeout");

const createAPIMessage = async (bot, interaction, content) => {
  const { data, files } = await Discord.APIMessage.create(
    bot.channels.resolve(interaction.channel_id),
    content
  )
    .resolveData()
    .resolveFiles();

  return {
    ...data,
    files,
  };
};

// Add support for reply deletion later on!

module.exports = {
  send: async () => {},
  reply: async (
    bot,
    interaction,
    message,
    isEphemeral = false,
    deleteReply = { delete: false, timeout: 5000 }
  ) => {
    let data = {
      content: message,
    };

    // If the message is an object (for embeds)
    // Send a proper embed
    if (typeof message === "object") {
      data = await createAPIMessage(bot, interaction, message);
    }

    // If ephemeral message (i.e. disappearing message)
    const userSettings = await User.findOne(
      {
        discordID: interaction.guild_id ? interaction.member.user.id : interaction.user.id,
      },
      { _id: 0, hideSlashCommandReplies: 1 }
    );
    if (userSettings.hideSlashCommandReplies || isEphemeral) {
      data.flags = 1 << 6;
    }

    bot.api.interactions(interaction.id, interaction.token).callback.post({
      data: {
        /**
         * Types:
         * 4: Respond Immediately
         * 5: Deferred Response
         */
        type: 4,
        data,
      },
    });

    // TODO SetTimeout then delete!
    // if (deleteReply && deleteReply.delete) {
    //   if (!deleteReply.timeout) deleteReply.timeout = 5000;
    //   tm.setLongTimeout(() => {
    //     const deleteInteractionReply = bot.api
    //       .interactions(interaction.id, interaction.token)
    //       .messages.patch({
    //           data: {
    //               type: 4,
    //               data: {
    //                   content: "erased",
    //               }
    //           }
    //       });
    //     console.log({ deleteInteractionReply });
    //   }, deleteReply.timeout);
    // }
  },
};
