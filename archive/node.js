const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/get-sentence', async (req, res) => {
  const { source, topic } = req.query;
  const url = `https://your-deta-api.deta.dev/sentence?source=${source}&topic=${topic}`;
  const result = await fetch(url);
  const data = await result.json();
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
