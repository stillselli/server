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

// ⭐ GET ALL LIKES
app.get("/likes/:id", async (req, res) => {
  try {
    const data = await twitter.tweetLikedBy(req.params.id, { max_results: 100 });

    let list = data.data || [];
    let next = data.meta?.next_token;

    while (next) {
      const nextPage = await twitter.tweetLikedBy(req.params.id, {
        max_results: 100,
        pagination_token: next
      });
      list = list.concat(nextPage.data || []);
      next = nextPage.meta?.next_token;
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔁 GET ALL RETWEETS
app.get("/retweets/:id", async (req, res) => {
  try {
    const data = await twitter.tweetRetweetedBy(req.params.id, { max_results: 100 });

    let list = data.data || [];
    let next = data.meta?.next_token;

    while (next) {
      const nextPage = await twitter.tweetRetweetedBy(req.params.id, {
        max_results: 100,
        pagination_token: next
      });
      list = list.concat(nextPage.data || []);
      next = nextPage.meta?.next_token;
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 💬 GET ALL REPLIES
app.get("/replies/:id", async (req, res) => {
  try {
    const data = await twitter.search(`conversation_id:${req.params.id}`, {
      "tweet.fields": ["author_id", "created_at"],
      max_results: 100
    });

    let list = data.data || [];
    let next = data.meta?.next_token;

    while (next) {
      const nextPage = await twitter.search(`conversation_id:${req.params.id}`, {
        "tweet.fields": ["author_id", "created_at"],
        max_results: 100,
        next_token: next
      });
      list = list.concat(nextPage.data || []);
      next = nextPage.meta?.next_token;
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend läuft auf Port ${PORT}`));
