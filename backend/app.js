require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3002;
const routes = require('./routes');

app.use('/api', routes);

app.listen(PORT, () => console.log(`Running on Port ${PORT}`
));