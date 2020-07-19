const mongoose = require("mongoose");
const config = require("../botsettings.json");

module.exports = {
    init: () => {
        const dbOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            autoIndex: false,
            reconnectTries: Number.MAX_VALUE,
            reconnectInterval: 500,
            poolSize: 5,
            connectTimeoutMS: 10000,
            family: 4
        };
        mongoose.connect(`mongodb+srv://${config.MONGODB_USERNAME}:${config.MONGODB_PASSWORD}@pd-bot.1rkt7.mongodb.net/${config.MONGODB_DBNAME}?retryWrites=true&w=majority`, dbOptions);
        mongoose.set("useFindAndModify", false);
        mongoose.Promise = global.Promise;
        mongoose.connection.on('connected', () => {
            console.log('Mongoose has successfully connected!');
        });

        mongoose.connection.on('err', err => {
            console.error(`Mongoose connection error: \n${err.stack}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn(`Mongoose connection lost`);
        });
    }

}