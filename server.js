import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

// ⚡ Twitter Client mit OAuth 1.0a User Context
const client = new TwitterApi({
  appKey: process.env.CONSUMER_KEY,
  appSecret: process.env.CONSUMER_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET
});

const twitter = client.v2;

// 🔹 Test-Endpoint: Prüft Environment Variables
app.get("/test-env", (req, res) => {
  res.json({
    CONSUMER_KEY: process.env.CONSUMER_KEY || null,
    CONSUMER_SECRET: process.env.CONSUMER_SECRET || null,
    ACCESS_TOKEN: process.env.ACCESS_TOKEN || null,
    ACCESS_SECRET: process.env.ACCESS_SECRET || null
  });
});

// 🔹 Kombinierter Endpoint für Teilnehmer
// /participants/:id?include=likes,retweets,replies
app.get("/participants/:id", async (req, res) => {
  const tweetId = req.params.id;
  const include = (req.query.include || "likes,retweets,replies").split(",");
  const response = {};

  try {
    // 💬 Likes
    if (include.includes("likes")) {
      const data = await twitter.tweetLikedBy(tweetId, { max_results: 100 });
      let list = data.data || [];
      let next = data.meta?.next_token;
      while (next) {
        const nextPage = await twitter.tweetLikedBy(tweetId, { max_results: 100, pagination_token: next });
        list = list.concat(nextPage.data || []);
        next = nextPage.meta?.next_token;
      }
      response.likes = list.map(u => u.username);
    }

    // 🔁 Retweets
    if (include.includes("retweets")) {
      const data = await twitter.tweetRetweetedBy(tweetId, { max_results: 100 });
      let list = data.data || [];
      let next = data.meta?.next_token;
      while (next) {
        const nextPage = await twitter.tweetRetweetedBy(tweetId, { max_results: 100, pagination_token: next });
        list = list.concat(nextPage.data || []);
        next = nextPage.meta?.next_token;
      }
      response.retweets = list.map(u => u.username);
    }

    // 💬 Replies
    if (include.includes("replies")) {
      const data = await twitter.search(`conversation_id:${tweetId}`, {
        "tweet.fields": ["author_id", "created_at"],
        expansions: ["author_id"],
        max_results: 100
      });

      let list = data.data || [];
      let users = data.includes?.users || [];
      let next = data.meta?.next_token;

      while (next) {
        const nextPage = await twitter.search(`conversation_id:${tweetId}`, {
          "tweet.fields": ["author_id", "created_at"],
          expansions: ["author_id"],
          max_results: 100,
          next_token: next
        });
        list = list.concat(nextPage.data || []);
        users = users.concat(nextPage.includes?.users || []);
        next = nextPage.meta?.next_token;
      }

      const userMap = {};
      users.forEach(u => userMap[u.id] = u.username);
      response.replies = list.map(t => userMap[t.author_id]).filter(Boolean);
    }

    res.json(response);

  } catch (err) {
    console.error("Error in /participants/:id:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend läuft auf Port ${PORT}`));
