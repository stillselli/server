import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

// ⚡ Twitter Client mit OAuth 2.0 User Context
const client = new TwitterApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  accessToken: process.env.OAUTH2_ACCESS_TOKEN
});

const twitter = client.v2;

// 🔹 Test-Endpoint: Prüft Environment Variables
app.get("/test-env", (req, res) => {
  res.json({
    CLIENT_ID: process.env.CLIENT_ID || null,
    CLIENT_SECRET: process.env.CLIENT_SECRET || null,
    OAUTH2_ACCESS_TOKEN: process.env.OAUTH2_ACCESS_TOKEN || null
  });
});

// 🔹 Kombinierter Endpoint für Teilnehmer
// /participants/:id?include=likes,retweets,replies
app.get("/participants/:id", async (req, res) => {
  const tweetId = req.params.id;
  const include = (req.query.include || "likes,retweets,replies").split(",");
  const response = {};

  try {
    // Funktion für kurze Pause (Rate Limit schonen)
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    // 💬 Likes
    if (include.includes("likes")) {
      const data = await twitter.tweetLikedBy(tweetId, { max_results: 20 });
      let list = data.data || [];
      let next = data.meta?.next_token;

      while (next) {
        await wait(500);
        const nextPage = await twitter.tweetLikedBy(tweetId, { max_results: 20,_
