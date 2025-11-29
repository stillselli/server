import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

// Speicher für Code Verifier – für Demo in Memory, für Produktion besser DB
let codeVerifierMemory = "";

// Twitter Client (nur für Generierung, Access Token kommt später)
const client = new TwitterApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
});

const twitter = client.v2;

// 🔹 Test Endpoint: Environment Variables prüfen
app.get("/test-env", (req, res) => {
  res.json({
    CLIENT_ID: process.env.CLIENT_ID || null,
    CLIENT_SECRET: process.env.CLIENT_SECRET || null,
    OAUTH2_ACCESS_TOKEN: process.env.OAUTH2_ACCESS_TOKEN || null,
    PORT: process.env.PORT || null
  });
});

// 🔹 Login Endpoint – startet OAuth Flow
app.get("/login", (req, res) => {
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    "https://server-5-ztpe.onrender.com/callback",
    {
      scope: ["tweet.read", "users.read", "like.read", "offline.access"]
    }
  );

  // Speichern des Code Verifier in Memory
  codeVerifierMemory = codeVerifier;

  console.log("💡 CodeVerifier gespeichert:", codeVerifierMemory);

  // Weiterleitung zu Twitter für Autorisierung
  res.redirect(url);
});

// 🔹 Callback Endpoint – tauscht Code gegen Access Token
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("❌ Kein Code erhalten");

  try {
    const result = await client.loginWithOAuth2({
      code,
      redirectUri: "https://server-5-ztpe.onrender.com/callback",
      codeVerifier: codeVerifierMemory
    });

    console.log("🎉 ACCESS TOKEN:", result.accessToken);
    console.log("♻ REFRESH TOKEN:", result.refreshToken);

    res.send("✔ Token erfolgreich erhalten! Schau in die Render Logs.");
  } catch (err) {
    console.error("❌ Fehler beim Token abrufen:", err);
    res.status(500).send("❌ Fehler beim Token abrufen. Prüfe Logs.");
  }
});

// 🔹 Kombinierter Endpoint für Teilnehmer
app.get("/participants/:id", async (req, res) => {
  const tweetId = req.params.id;
  const include = (req.query.include || "likes,retweets,replies").split(",");
  const response = {};

  try {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Likes
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

    // Retweets
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

    // Replies
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
