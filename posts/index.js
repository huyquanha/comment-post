const express = require('express');
const bodyParser = require('body-parser');
const { randomBytes } = require('crypto');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
// This is added to allow the client react app on port 3000
// to be able to make requests to this service hosted on port 4000,
// otherwise it would be blocked by CORS policy.
app.use(cors());

const posts = {};

app.get('/posts', (req, res) => {
  res.send(posts);
});

app.post('/posts/create', async (req, res) => {
  const id = randomBytes(4).toString('hex');
  const { title } = req.body;

  posts[id] = { id, title };

  // Send an event to event-bus. This URL is
  // for reaching out to event bus within K8S,
  // where we can use the service name.
  await axios.post('http://event-bus-srv:4005/events', {
    type: 'PostCreated',
    data: {
      id, title
    }
  });

  res.status(201).send(posts[id]);
});

app.post('/events', (req, res) => {
  console.log('Received event', req.body.type);

  res.send({});
});

app.listen(4000, () => {
  console.log('v1000');
  console.log('Listening on port 4000');
});