require('dotenv').config();
require('./strategies/discord');

const express = require('express');
const passport = require('passport');
const app = express();
const PORT = process.env.PORT || 3002;
const routes = require('./routes');
const mongoose = require("mongoose");
const mongo = require("../utils/mongoose");

mongo.init(true);

app.use(passport.initialize());
app.use(passport.session());

app.use('/api', routes);


app.listen(PORT, () => {
    console.log(`Running on Port ${PORT}`);
});