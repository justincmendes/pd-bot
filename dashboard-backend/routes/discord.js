const router = require('express').Router();
const { getBotGuilds } = require('../utils/api');
const User = require('../database/schemas/User');
const fn = require('../utils/functions');
const GuildConfig = require('../database/schemas/guildsettings');

router.get('/guilds', async (req, res) => {
    const guilds = await getBotGuilds();
    const user = await User.findOne({ discordID: req.user.discordID });
    if (user) {
        const userGuilds = user.get('guilds');
        const userManagerGuilds = fn.getUserManagerGuilds(userGuilds, guilds);
        res.send(userManagerGuilds);
    }
    else {
        return res.status(401).send({ message: "Unauthorized" });
    }
});

router.put('/guilds/:guildID/prefix', async (req, res) => {
    const { prefix } = req.body;
    const { guildID } = req.params;
    if (!prefix) {
        return res.status(400).send({ message: "Prefix Required" });
    }
    const update = await GuildConfig.findOneAndUpdate({guildID}, {prefix}, {
        new: true
    });
    return update ? res.send(update) : res.status(400).send({message: 'Could not find document.'});
});

router.get('/guilds/:guildID/config', async (req, res) => {
    const {guildID} = req.params;
    const config = await GuildConfig.findOne({guildID});
    return config ? res.send(config) : res.status(404).send({message: 'Not found.'});
})
module.exports = router;