const passport = require("passport");
const DiscordStrategy = require("passport-discord");
const User = require("../database/schemas/User");

passport.serializeUser((user, done) => {
  done(null, user.discordID);
});

passport.deserializeUser(async (discordID, done) => {
  try {
    const user = await User.findOne({ discordID });
    return user ? done(null, user) : done(null, null);
  } catch (err) {
    console.error(err);
    done(err, null);
  }
});

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DASHBOARD_CLIENT_ID,
      clientSecret: process.env.DASHBOARD_CLIENT_SECRET,
      callbackURL: process.env.DASHBOARD_CALLBACK_URL,
      scope: ["identify", "guilds"],
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log({ profile });
      const { id, username, discriminator, avatar, guilds } = profile;
      try {
        const findUser = await User.findOneAndUpdate(
          { discordID: id },
          {
            discordTag: `${username}#${discriminator}`,
            avatar,
            guilds,
          },
          { new: true }
        );
        if (findUser === null) {
          const newUser = await User.create({
            discordID: id,
            discordTag: `${username}#${discriminator}`,
            avatar,
            guilds,
            timezone: "EST",
            habitCron: 0,
            likesPesteringAccountability: false,
          });
          return done(null, newUser);
        } else {
          console.log("User was found");
          return done(null, findUser);
        }
      } catch (err) {
        console.error(err);
        return done(err, null);
      }
    }
  )
);
