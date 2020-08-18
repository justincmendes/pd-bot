const mongoose = require("mongoose");
require("dotenv").config();
const prefix = process.env.PREFIX;

module.exports = {
    init: (useFindAndModify = false) => {
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
        mongoose.connect(process.env.MONGODB_CONNECT_URL, dbOptions);
        mongoose.set("useFindAndModify", useFindAndModify);
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