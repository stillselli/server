import express from "express";
import { TwitterApi } from "twitter-api-v2";

const app = express();

let accessToken = process.env.OAUTH2_ACCESS_TOKEN || null;
let refreshToken = process.env.REFRESH_TOKEN || null;

const client = new TwitterApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  accessToken
});

/* 1) LOGIN → Weiterleitung zu Twitter */
app.get("/login", (req, res) => {
  const url = client.generateOAuth2AuthLink(
    process.env.CALLBACK_URL,
    { scope: ["tweet.read", "users.read", "like.read", "tweet.write", "offline.access"] }
  );
  res.redirect(url.url);
});

/*2) CALLBACK → Token generieren */
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.send("❌ Kein Code erhalten!");

  try {
    const { client: loggedClient, accessToken: newAT, refreshToken: newRT } =
      await client.loginWithOAuth2({ code, redirectUri: process.env.CALLBACK_URL });

    accessToken = newAT;
    refreshToken = newRT;

    console.log("🔐 Access Token:", newAT);
    console.log("♻ Refresh Token:", newRT);

    return res.send(`
      <h2>Login erfolgreich 🎉</h2>
      <p>Token gespeichert – du kannst jetzt Likes abrufen.</p>
    `);

  } catch (e) {
    console.log("❌ Fehler beim Login:", e);
    res.send("❌ Fehler, kein Token erhalten.");
  }
});

/* 3) Token Refresh */
async function refreshAccessToken() {
  if (!refreshToken) throw new Error("Kein REFRESH_TOKEN gesetzt!");

  const t = await client.refreshOAuth2Token(refreshToken);
  accessToken = t.accessToken;
  refreshToken = t.refreshToken;
  console.log("♻ Token erneuert:", accessToken);
}

/* 4) Safe API Call */
async function safe(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.code === 401) {     // Token expired
      await refreshAccessToken();
      return await fn();
    }
    throw e;
  }
}

/* 5) Teilnehmer-Liste */
app.get("/participants/:id", async (req, res) => {
  const tweetId = req.params.id;
  const include = (req.query.include || "likes,replies").split(",");
  const response = {};

  try {
    if (include.includes("likes")) {
      const data = await safe(() => client.v2.tweetLikedBy(tweetId, { max_results: 100 }));
      response.likes = data.data?.map(u => u.username) ?? [];
    }

    if (include.includes("replies")) {
      const data = await safe(() => client.v2.search(`conversation_id:${tweetId}`, {
        expansions: ["author_id"],
        "tweet.fields": ["author_id"], max_results: 100
      }));
      response.replies = data.includes?.users?.map(u => u.username) ?? [];
    }

    res.json(response);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 10000, () =>
  console.log("🚀 Backend läuft – Login unter /login")
);
