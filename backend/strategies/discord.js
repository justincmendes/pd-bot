require('dotenv').config();
const passport = require('passport');
const DiscordStrategy = require('passport-discord');
const User = require('../../models/User');

passport.use(
    new DiscordStrategy({
        clientID: process.env.DASHBOARD_CLIENT_ID,
        clientSecret: process.env.DASBOARD_CLIENT_SECRET,
        callbackURL: process.env.DASHBOARD_CALLBACK_URL,
        scope: ['identify', 'guilds'],
    }, async (accessToken, refreshToken, profile, done) => {
        console.log("IT WORKED!");
        const { id, username, discriminator, avatar, guilds } = profile;
        console.log(id, username, discriminator, avatar, guilds);
    })
);