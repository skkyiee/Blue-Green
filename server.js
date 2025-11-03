const express = require('express');
const app = express();
const PORT = 3000;

// Environment variable to track color
const APP_COLOR = process.env.APP_COLOR || "Blue";
const APP_VERSION = "1.0.0";

app.get('/', (req, res) => {
  res.send(`Hello from the ${APP_COLOR} environment! Version: ${APP_VERSION}`);
});

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT} - ${APP_COLOR} (v${APP_VERSION})`);
});