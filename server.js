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

// 💬 Replies
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

// 🏆 Alle Teilnehmer zusammenführen (Likes + Retweets + Replies)
app.get("/participants/:id", async (req, res) => {
  try {
    const [likes, retweets, replies] = await Promise.all([
      paginate(client.v2.tweetLikedBy, req.params.id),
      paginate(client.v2.tweetRetweetedBy, req.params.id),
      (async () => {
        const data = [];
        const search = await client.v2.search(`conversation_id:${req.params.id}`, {
          "tweet.fields": ["author_id"],
          max_results: 100
        });
        for await (const t of search) data.push(t);
        return data;
      })()
    ]);

    // Nur eindeutige user_id
    const participants = new Set();
    likes.forEach(u => participants.add(u.id));
    retweets.forEach(u => participants.add(u.id));
    replies.forEach(t => participants.add(t.author_id));

    res.json(Array.from(participants));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🎲 Zufälliger Gewinner
app.get("/winner/:id", async (req, res) => {
  try {
    const response = await fetch(`https://DEIN-BACKEND.onrender.com/participants/${req.params.id}`);
    const participants = await response.json();
    const winner = participants[Math.floor(Math.random() * participants.length)];
    res.json({ winner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
