import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

// Access & Refresh Token direkt aus Render Environment Variables
let accessToken = process.env.OAUTH2_ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
  console.error("❌ CLIENT_ID oder CLIENT_SECRET fehlen in den Environment Variables!");
}

const client = new TwitterApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  accessToken
});

const twitter = client.v2;

// 🔹 Test-Endpoint für Environment Variables
app.get("/test-env", (req, res) => {
  res.json({
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    OAUTH2_ACCESS_TOKEN: accessToken,
    REFRESH_TOKEN: refreshToken,
    PORT: process.env.PORT
  });
});

// 🔹 Funktion: Access Token automatisch erneuern
async function refreshAccessToken() {
  try {
    if (!refreshToken) throw new Error("Kein REFRESH_TOKEN gesetzt!");
    const newTokens = await client.refreshOAuth2Token(refreshToken);
    accessToken = newTokens.accessToken;
    console.log("♻ Access Token erneuert:", accessToken);
  } catch (err) {
    console.error("❌ Fehler beim Token erneuern:", err);
  }
}

// 🔹 Helper-Funktion für Requests mit Auto-Refresh
async function safeRequest(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === 401) { // Token abgelaufen
      console.log("⚠ Token abgelaufen, erneuere...");
      await refreshAccessToken();
      return safeRequest(fn); // retry
    }
    throw err;
  }
}

// 🔹 Kombinierter Endpoint für Teilnehmer (Likes, Retweets, Replies)
app.get("/participants/:id", async (req, res) => {
  const tweetId = req.params.id;
  const include = (req.query.include || "likes,retweets,replies").split(",");
  const response = {};
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Likes
    if (include.includes("likes")) {
      const data = await safeRequest(() => twitter.tweetLikedBy(tweetId, { max_results: 20 }));
      let list = data.data || [];
      let next = data.meta?.next_token;

      while (next) {
        await wait(500);
        const nextPage = await safeRequest(() => twitter.tweetLikedBy(tweetId, { max_results: 20, pagination_token: next }));
        list = list.concat(nextPage.data || []);
        next = nextPage.meta?.next_token;
      }
      response.likes = list.map(u => u.username);
    }

    // Retweets
    if (include.includes("retweets")) {
      const data = await safeRequest(() => twitter.tweetRetweetedBy(tweetId, { max_results: 20 }));
      let list = data.data || [];
      let next = data.meta?.next_token;

      while (next) {
        await wait(500);
        const nextPage = await safeRequest(() => twitter.tweetRetweetedBy(tweetId, { max_results: 20, pagination_token: next }));
        list = list.concat(nextPage.data || []);
        next = nextPage.meta?.next_token;
      }
      response.retweets = list.map(u => u.username);
    }

    // Replies
    if (include.includes("replies")) {
      const data = await safeRequest(() => twitter.search(`conversation_id:${tweetId}`, {
        "tweet.fields": ["author_id", "created_at"],
        expansions: ["author_id"],
        max_results: 20
      }));

      let list = data.data || [];
      let users = data.includes?.users || [];
      let next = data.meta?.next_token;

      while (next) {
        await wait(500);
        const nextPage = await safeRequest(() => twitter.search(`conversation_id:${tweetId}`, {
          "tweet.fields": ["author_id", "created_at"],
          expansions: ["author_id"],
          max_results: 20,
          next_token: next
        }));
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
    if (err.code === 429) {
      res.status(429).json({ error: "Rate limit reached. Bitte später erneut versuchen." });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 🔹 Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Backend läuft auf Port ${PORT}`));
