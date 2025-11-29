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
    OAUTH2_ACCESS_TOKEN: process.env.OAUTH2_ACCESS_TOKEN || null,
    PORT: process.env.PORT || null
  });
});

// 🔹 OAuth Login Endpoint – einmal für Token-Generierung
app.get("/login", (req, res) => {
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    "https://DEIN-RENDER-SERVICE.onrender.com/callback",
    {
      scope: ["tweet.read", "users.read", "like.read", "offline.access"]
    }
  );
  // Speichern von codeVerifier/State in DB oder Memory nötig, hier nur Demo
  console.log("💡 CodeVerifier:", codeVerifier, "State:", state);
  res.redirect(url);
});

// 🔹 OAuth Callback Endpoint – Token abholen
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("❌ Kein Code erhalten");

  try {
    const result = await client.loginWithOAuth2({
      code,
      redirectUri: "https://DEIN-RENDER-SERVICE.onrender.com/callback"
    });

    console.log("🎉 ACCESS TOKEN:", result.accessToken);
    console.log("♻ REFRESH TOKEN:", result.refreshToken);

    res.send("✔ Token erhalten! Schau in die Render Logs.");
  } catch (err) {
    console.error("Fehler beim OAuth Callback:", err);
    res.status(500).send("❌ Fehler beim Token abrufen");
  }
});

// 🔹 Kombinierter Endpoint für Teilnehmer
// /participants/:id?include=likes,retweets,replies
app.get("/participants/:id", async (req, res) => {
  const tweetId = req.params.id;
  const include = (req.query.include || "likes,retweets,replies").split(",");
  const response = {};

  try {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    // 💬 Likes
    if (include.includes("likes")) {
      const data = await twitter.tweetLikedBy(tweetId, { max_results: 20 });
      let list = data.data || [];
      let next = data.meta?.next_token;

      while (next) {
        await wait(500);
        const nextPage = await twitter.tweetLikedBy(tweetId, { max_results: 20, pagination_token: next });
        list = list.concat(nextPage.data || []);
        next = nextPage.meta?.next_token;
      }
      response.likes = list.map(u => u.username);
    }

    // 🔁 Retweets
    if (include.includes("retweets")) {
      const data = await twitter.tweetRetweetedBy(tweetId, { max_results: 20 });
      let list = data.data || [];
      let next = data.meta?.next_token;

      while (next) {
        await wait(500);
        const nextPage = await twitter.tweetRetweetedBy(tweetId, { max_results: 20, pagination_token: next });
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
        max_results: 20
      });

      let list = data.data || [];
      let users = data.includes?.users || [];
      let next = data.meta?.next_token;

      while (next) {
        await wait(500);
        const nextPage = await twitter.search(`conversation_id:${tweetId}`, {
          "tweet.fields": ["author_id", "created_at"],
          expansions: ["author_id"],
          max_results: 20,
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
