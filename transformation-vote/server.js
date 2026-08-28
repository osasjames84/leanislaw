"use strict";

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const FINALISTS = require("./finalists.json");
const SLUGS = new Set(FINALISTS.map((f) => f.slug));

const PORT = process.env.PORT || 3000;
const CLOSES_AT = process.env.VOTE_CLOSES_AT ? Date.parse(process.env.VOTE_CLOSES_AT) : null;
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const IP_CAP = parseInt(process.env.IP_CAP || "8", 10);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "8kb" }));

/* ---------- storage ----------
   One row per voter. voter_id is the primary key, so a duplicate vote is
   rejected by the database rather than by a read-then-write check that two
   simultaneous requests could both pass. */
let pool = null;
let dbReady = false;
const mem = { rows: new Map(), ips: Object.create(null) };   /* local dev only */

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn("[store] No DATABASE_URL. Using in-memory store: votes are lost on restart.");
    return;
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 8,
    idleTimeoutMillis: 30000
  });
  pool.on("error", (e) => console.error("[db] pool error:", e.message));
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS votes (
          voter_id   TEXT PRIMARY KEY,
          slug       TEXT NOT NULL,
          ip_hash    TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      await pool.query("CREATE INDEX IF NOT EXISTS votes_slug_idx ON votes (slug)");
      await pool.query("CREATE INDEX IF NOT EXISTS votes_ip_idx ON votes (ip_hash)");
      dbReady = true;
      console.log("[db] ready");
      return;
    } catch (e) {
      console.error("[db] init attempt " + attempt + " failed:", e.message);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}
initDb();

async function getTallies() {
  const out = Object.create(null);
  FINALISTS.forEach((f) => { out[f.slug] = 0; });
  if (dbReady) {
    const { rows } = await pool.query("SELECT slug, COUNT(*)::int AS n FROM votes GROUP BY slug");
    rows.forEach((r) => { if (r.slug in out) out[r.slug] = r.n; });
  } else {
    mem.rows.forEach((slug) => { if (slug in out) out[slug] = (out[slug] || 0) + 1; });
  }
  return out;
}

async function hasVoted(voterId) {
  if (dbReady) {
    const { rows } = await pool.query("SELECT 1 FROM votes WHERE voter_id = $1", [voterId]);
    return rows.length > 0;
  }
  return mem.rows.has(voterId);
}

async function recordVote(voterId, slug, ipHash) {
  if (dbReady) {
    const { rows: ipRows } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM votes WHERE ip_hash = $1", [ipHash]);
    if (ipRows[0].n >= IP_CAP) return "ip_cap";
    const { rowCount } = await pool.query(
      "INSERT INTO votes (voter_id, slug, ip_hash) VALUES ($1,$2,$3) ON CONFLICT (voter_id) DO NOTHING",
      [voterId, slug, ipHash]);
    return rowCount === 1;
  }
  if (mem.rows.has(voterId)) return false;
  mem.ips[ipHash] = (mem.ips[ipHash] || 0) + 1;
  if (mem.ips[ipHash] > IP_CAP) return "ip_cap";
  mem.rows.set(voterId, slug);
  return true;
}

const isClosed = () => CLOSES_AT !== null && Date.now() >= CLOSES_AT;
const hashIp = (ip) => crypto.createHash("sha256").update(String(ip) + "|tv").digest("hex").slice(0, 24);

/* ---------- api ---------- */
app.get("/api/state", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const voterId = String(req.query.voter || "");
  let voted = false;
  try { if (voterId) voted = await hasVoted(voterId); } catch (e) { console.error("[state]", e.message); }
  const payload = {
    finalists: FINALISTS.map((f) => ({ slug: f.slug, name: f.first })),
    closesAt: CLOSES_AT,
    closed: isClosed(),
    voted: voted,
    persistent: dbReady
  };
  if (voted || isClosed()) {
    try { payload.tallies = await getTallies(); } catch (e) { console.error("[state]", e.message); }
  }
  res.json(payload);
});

app.post("/api/vote", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const { slug, voter } = req.body || {};
  if (!slug || !SLUGS.has(slug)) return res.status(400).json({ error: "unknown_finalist" });
  if (typeof voter !== "string" || voter.length < 8 || voter.length > 64)
    return res.status(400).json({ error: "bad_voter_id" });
  if (isClosed()) return res.status(403).json({ error: "closed" });

  try {
    const result = await recordVote(voter, slug, hashIp(req.ip));
    if (result === "ip_cap") return res.status(429).json({ error: "too_many_from_network" });
    if (result === false) return res.status(409).json({ error: "already_voted", tallies: await getTallies() });
    const tallies = await getTallies();
    console.log("[vote]", slug, "total", Object.values(tallies).reduce((a, b) => a + b, 0));
    res.json({ ok: true, tallies: tallies });
  } catch (e) {
    console.error("[vote] failed:", e.message);
    res.status(500).json({ error: "server_error" });
  }
});

/* full results, for you rather than the voters */
app.get("/api/results", async (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: "forbidden" });
  try {
    const tallies = await getTallies();
    const rows = FINALISTS.map((f) => ({ name: f.first, full: f.full, votes: tallies[f.slug] || 0 }))
                          .sort((a, b) => b.votes - a.votes);
    res.json({ closed: isClosed(), closesAt: CLOSES_AT, store: dbReady ? "postgres" : "memory",
               total: rows.reduce((a, r) => a + r.votes, 0), rows: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/healthz", (req, res) => res.json({ ok: true, store: dbReady ? "postgres" : "memory" }));

app.use(express.static(path.join(__dirname, "public"), { maxAge: "7d" }));

app.listen(PORT, () => console.log("[server] listening on " + PORT));
