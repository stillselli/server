import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

// Twitter Client mit OAuth 1.0a / User Context
const client = new TwitterApi({
  appKey: process.env.CONSUMER_KEY,
  appSecret: process.env.CONSUMER_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET
});

// Hilfsfunktion: Alle Pages abrufen
async function paginate(endpoint, id) {
  const results = [];
  for await (const item of endpoint(id)) {
    results.push(item);
  }
  return results;
}

// ⭐ Likes
app.get("/likes/:id", async (req, res) => {
  try {
    const likes = await paginate(client.v2.tweetLikedBy, req.params.id);
    res.json(likes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔁 Retweets
app.get("/retweets/:id", async (req, res) => {
  try {
    const retweets = await paginate(client.v2.tweetRetweetedBy, req.params.id);
    res.json(retweets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 💬 Replies (öffentliche Tweets)
app.get("/replies/:id", async (req, res) => {
  try {
    const replies = [];
    const search = await client.v2.search(`conversation_id:${req.params.id}`, {
      "tweet.fields": ["author_id", "created_at"],
      max_results: 100
    });

    for await (const tweet of search) {
      replies.push(tweet);
    }

    res.json(replies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
