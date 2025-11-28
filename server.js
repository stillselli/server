import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

// Twitter Client mit OAuth 1.0a User Context
const client = new TwitterApi({
  appKey: process.env.CONSUMER_KEY,
  appSecret: process.env.CONSUMER_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET
});

// Likes abrufen
app.get("/likes/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const likes = await client.v2.tweetLikedBy(id);
    res.json(likes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retweets abrufen
app.get("/retweets/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const retweets = await client.v2.tweetRetweetedBy(id);
    res.json(retweets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Replies abrufen (öffentliche Tweets)
app.get("/replies/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const url = `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${id}&tweet.fields=author_id`;
    const bearer = process.env.ACCESS_TOKEN;
    const response = await fetch(url, { headers: { "Authorization": `Bearer ${bearer}` } });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Server läuft auf Port 3000"));
