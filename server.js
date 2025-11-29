import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

// Memory Storage für CodeVerifier und AccessToken
let codeVerifierMemory = "";

// Tokens aus Environment
let accessToken = process.env.OAUTH2_ACCESS_TOKEN;
const refreshToken = process.env.REFRESH_TOKEN;

const client = new TwitterApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  accessToken
});

const twitter = client.v2;

// 🔹 Test-Endpoint
app.get("/test-env", (req, res) => {
  res.json({
    CLIENT_ID: process.env.CLIENT_ID || null,
    CLIENT_SECRET: process.env.CLIENT_SECRET || null,
    OAUTH2_ACCESS_TOKEN: accessToken || null,
    REFRESH_TOKEN: refreshToken || null,
    PORT: process.env.PORT || null
  });
});

// 🔹 Login-Endpoint für OAuth Flow
app.get("/login", (req, res) => {
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    "https://server-5-ztpe.onrender.com/callback",
    {
      scope: ["tweet.read", "users.read", "like.read", "offline.access"]
    }
  );

  codeVerifierMemory = codeVerifier;
  console.log("💡 CodeVerifier gespeichert:", codeVerifierMemory);
  res.redirect(url);
});

// 🔹 Callback-Endpoint – Token holen
app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("❌ Kein Code erhalten");

  try {
    const result = await client.loginWithOAuth2({
      code,
      redirectUri: "https://server-5-ztpe.onrender.com/callback",
      codeVerifier: codeVerifierMemory
    });

    accessToken = result.accessToken;
    console.log("🎉 ACCESS TOKEN:", accessToken);
    console.log("♻ REFRESH TOKEN:", result.refreshToken);

    res.send("✔ Token erfolgreich erhalten! Schau in die Render Logs.");
  } catch (err) {
    console.error("❌ Fehler beim Token abrufen:", err);
    res.status(500).send("❌ Fehler beim Token abrufen. Prüfe Logs.");
  }
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

// 🔹 Helper: Anfrage mit Auto-Refresh
async function safeRequest(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === 401) { // Token abgelaufen
      console.log("⚠ Token abgelaufen, erneuere...");
      await refreshAccessToken();
      return safeRequest(fn);
    }
    throw err;
  }
}

// 🔹 Kombinierter Endpoint für Teilnehmer
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
