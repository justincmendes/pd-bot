const User = require("../database/schemas/user");
const fn = require("../../utilities/functions");
require("dotenv").config();

const pesterEmbedColour = fn.pesterEmbedColour;
const pesterProjection = {
  _id: 0,
  discordID: 1,
  likesPesteringAccountability: 1,
};
// ALL command, have a paginated embed of the people in the guild who
// like pestering accountabiity
// + Help
// + ability to search a user up by their display name, discriminator, or username
// to find if they like pestering accountability

// Private Function Declarations

module.exports = {
  name: "pester",
  description: "Users that like pestering accountability!",
  aliases: [
    "pest",
    "pestering",
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
    daylightSavings,
    forceSkip
  ) {
    args = forceSkip ? args.concat(["force"]) : args;
    const inGuild = message.channel.type !== "dm";
    const authorID = message.author.id;
    const pesterCommand = args[0] ? args[0].toLowerCase() : false;
    var guildID, guildName, guild;
    let pesterUsageMessage =
      `**USAGE**\n\`${PREFIX}${commandUsed}\` - **(to see if you like pestering accountability)**\n\`${PREFIX}${commandUsed} <USER>\`` +
      `\n\n\`<USER>\`: **Enter the username of the user you'd like to look up; all** (all - shows all users and their accountability setting)\n\n*__ALIASES:__* **${
        this.name
      } - ${this.aliases.join("; ")}**`;
    pesterUsageMessage = fn.getMessageEmbed(
      pesterUsageMessage,
      "Pestering Accountability: Help",
      pesterEmbedColour
    );
    if (pesterCommand === "help") {
      return message.channel.send(pesterUsageMessage);
    } else {
      if (pesterCommand) {
        if (!inGuild) {
          let botServers = await bot.guilds.cache.map((guild) => guild.id);
          console.log({ botServers });
          const mutualServers = await fn.userAndBotMutualServerIDs(
            bot,
            authorID,
            botServers
          );
          const serverSelectInstructions =
            "Type the **number** corresponding to the **server** you want to see **Pestering Accountability** for:\n";
          const postToServerTitle = "Pestering Accountability: Select Server";
          const serverList = await fn.listOfServerNames(bot, mutualServers);
          const targetServerIndex = await fn.userSelectFromList(
            bot,
            message,
            PREFIX,
            serverList,
            mutualServers.length,
            serverSelectInstructions,
            postToServerTitle,
            pesterEmbedColour,
            180000
          );
          if (targetServerIndex === false) return;
          else {
            guildID = mutualServers[targetServerIndex];
            guild = bot.guilds.cache.get(guildID);
            guildName = guild.name;
          }
        } else {
          guildID = message.guild.id;
          guild = bot.guilds.cache.get(guildID);
          guildName = message.guild.name;
        }
      } else {
        const user = await User.findOne(
          { discordID: authorID },
          pesterProjection
        );
        if (!user) return message.channel.send(`Could not find your record...`);
        console.log({ user });
        const authorUsername = message.author.username;
        let userProfile = `${
          inGuild ? `<@!${user.discordID}>` : `__**${authorUsername}**__`
        } - ${
          user.likesPesteringAccountability
            ? "**likes** pestering accountability"
            : "**does NOT like** pestering accountability"
        }`;
        userProfile = fn
          .getMessageEmbed(
            userProfile,
            `Pestering Accountability: ${authorUsername}`,
            pesterEmbedColour
          )
          .setThumbnail(
            bot.users.cache.get(authorID).displayAvatarURL({ dynamic: true })
          );
        return message.channel.send(userProfile);
      }
    }
    console.log({ guildID });

    const allGuildMembers = guild.members.cache;
    const allMembers = allGuildMembers.map((member) => member.user);
    const allMemberIDs = allMembers.map((user) => user.id);
    console.log({ allMembers, allGuildMembers });
    const pesterHelpMessage = `Try \`${PREFIX}${commandUsed} help\` for help`;
    const originalArgs = args.join(" ");
    args = originalArgs.toLowerCase();
    if (pesterCommand === "all") {
      const allUsers = await User.find({}, pesterProjection);
      if (!allUsers)
        return message.channel.send(
          `**No users in __${guildName}__ exist on file...**`
        );
      const userArray = allUsers
        .map((user) => {
          if (allMemberIDs.includes(user.discordID)) {
            return `${
              inGuild
                ? `<@!${user.discordID}>`
                : `__**${guild.member(user.discordID).displayName}**__`
            } - ${
              user.likesPesteringAccountability
                ? "**likes** pestering accountability"
                : "**does NOT like** pestering accountability"
            }`;
          } else return null;
        })
        .filter((userProfile) => userProfile !== null);
      await fn.sendPaginationEmbed(
        bot,
        message.channel.id,
        authorID,
        fn.getEmbedArray(
          userArray,
          `Pestering Accountability: ${guildName}`,
          false,
          false,
          pesterEmbedColour
        )
      );
      return;
    } else {
      let targetIDs = fn.getIDArrayFromNames(args, allGuildMembers, guild);
      if (!targetIDs)
        return message.reply(
          `**No users in __${guildName}__ exist on file...**`
        );
      if (targetIDs.length > 0) {
        var usernameArray = new Array();
        const findUsers = await User.find(
          { discordID: { $in: targetIDs } },
          pesterProjection
        );
        if (!findUsers.length) {
          return message.channel.send(
            `The user(s) \"**${originalArgs}**\" do not have a file(s) with me...\n(so assume they do **NOT** like pestering accountability! 😁) `
          );
        }
        console.log({ findUsers });
        const userArray = findUsers
          .map((user) => {
            if (allMemberIDs.includes(user.discordID)) {
              const userDisplayName = guild.member(user.discordID).displayName;
              usernameArray.push(userDisplayName);
              return `${
                inGuild ? `<@!${user.discordID}>` : `__**${userDisplayName}**__`
              } - ${
                user.likesPesteringAccountability
                  ? "**likes** pestering accountability"
                  : "**does NOT like** pestering accountability"
              }`;
            } else return null;
          })
          .filter((userProfile) => userProfile !== null);
        console.log({ userArray });
        let title = `Pestering Accountability: ${usernameArray.join(", ")}`;
        title = title.length < 256 ? title : `Pestering Accountability`;
        const isOneUser = userArray.length === 1;
        if (isOneUser) {
          let userProfile = fn
            .getMessageEmbed(userArray[0], title, pesterEmbedColour)
            .setThumbnail(
              bot.users.cache
                .get(findUsers[0].discordID)
                .displayAvatarURL({ dynamic: true })
            );
          message.channel.send(userProfile);
        } else {
          let userProfiles = fn.getEmbedArray(
            userArray,
            title,
            false,
            false,
            pesterEmbedColour
          );
          await fn.sendPaginationEmbed(
            bot,
            message.channel.id,
            authorID,
            userProfiles
          );
        }
        return;
      } else
        return message.channel.send(
          `Could not find any users from \"**${originalArgs}**\" (${pesterHelpMessage})`
        );
    }
  },
};
