const router = require('express').Router();
const { getBotGuilds } = require('../utils/api');
const User = require('../database/schemas/User');
const fn = require('../utils/functions');
const GuildConfig = require('../database/schemas/guildsettings');
const UserSettings = require('../../djs-bot/database/schemas/usersettings');

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
});

router.put('/user/:userID/settings', async (req, res) => {
    const {settings} = req.body;
    const {userID} = req.params;
    if(!settings) {
        return res.status(400).send({ message: "Settings Required." });
    }
    // The front-end will check if thes settings are valid
    const update = await UserSettings.findOneAndUpdate({userID}, {$set: {
        //...
    }});
    return update ? res.send(update) : res.status(404).send({message: 'Could not find document'});
});

router.get('/user/:userID/reminders', async (req, res) => {
    const {userID} = req.params;
    const reminders = await UserSettings.collection
    .find({userID})
    .sort({endTime: -1})
    .toArray();
    return reminders ? res.send(reminders) : res.status(404).send({message: 'No reminders set.'});;
});

module.exports = router;