module.exports = {
    getUserManagerGuilds: function (userGuilds, botGuilds) {
        // & with 0x20 for MANAGE_GUILD permission
        return userGuilds.filter((guild) => botGuilds.find((botGuild) => (botGuild.id === guild.id) && (guild.permissions & 0x20) === 0x20));
    },
};