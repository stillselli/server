import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

const client = new TwitterApi({
  appKey: process.env.CONSUMER_KEY,
  appSecret: process.env.CONSUMER_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET
});

const twitter = client.v2;


// ⭐ LIKES
app.get("/likes/:id", async (req, res) => {
  try {
    const users = [];
    const paginator = twitter.tweetLikedBy(req.params.id); // ❗ kein await!

    for await (const user of paginator) {
      users.push(user);
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔁 RETWEETS
app.get("/retweets/:id", async (req, res) => {
  try {
    const users = [];
    const paginator = twitter.tweetRetweetedBy(req.params.id); // ❗ kein await!

    for await (const user of paginator) {
      users.push(user);
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 💬 REPLIES
app.get("/replies/:id", async (req, res) => {
  try {
    const tweets = [];
    const paginator = twitter.search(`conversation_id:${req.params.id}`, {
      "tweet.fields": ["author_id", "created_at"],
      max_results: 100
    }); // ❗ auch hier kein await!

    for await (const tweet of paginator) {
      tweets.push(tweet);
    }
    res.json(tweets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API läuft auf Port ${PORT}`));
