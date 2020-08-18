const router = require('express').Router();
const { getBotGuilds } = require('../utils/api');
const User = require('../database/schemas/User');
const fn = require('../utils/functions');

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

module.exports = router;