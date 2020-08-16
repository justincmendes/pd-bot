require('dotenv').config();
require('./strategies/discord');
const express = require('express');
const passport = require('passport');
const app = express();
const PORT = process.env.PORT || 3002;
const routes = require('./routes');

app.use('/api', routes);

app.use(passport.initialize());
app.use(passport.session());

app.listen(PORT, () => {
    console.log(`Running on Port ${PORT}`);
});