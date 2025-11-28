import express from "express";
import fetch from "node-fetch";

const app = express();

const TWITTER = {
  base: "https://api.twitter.com/2/tweets/",
  headers: () => ({
    "Authorization": `Bearer ${process.env.TWITTER_BEARER}`,
    "Content-Type": "application/json"
  })
};

// ⭐ 1. Likes abrufen
app.get("/likes/:id", async (req, res) => {
  const id = req.params.id;

  const response = await fetch(
    `${TWITTER.base}${id}/liking_users`,
    { headers: TWITTER.headers() }
  );

  res.json(await response.json());
});

// 🔁 2. Retweets abrufen
app.get("/retweets/:id", async (req, res) => {
  const id = req.params.id;

  const response = await fetch(
    `${TWITTER.base}${id}/retweeted_by`,
    { headers: TWITTER.headers() }
  );

  res.json(await response.json());
});

// 💬 3. Replies abrufen
// Wichtig: conversation_id sucht ALLE Tweets, die als Antwort auf den ursprünglichen Thread gelten
app.get("/replies/:id", async (req, res) => {
  const id = req.params.id;

  const response = await fetch(
    `https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${id}&tweet.fields=author_id`,
    { headers: TWITTER.headers() }
  );

  res.json(await response.json());
});

app.listen(3000, () => console.log("Server läuft auf Port 3000"));

