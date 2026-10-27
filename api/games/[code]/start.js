// POST /api/games/:code/start  (host only)

const { db, getSession, expiresFrom } = require("../../_db");
const { cors, getIp, send, err } = require("../../_helpers");

const MAX_STATE_BYTES = 200 * 1024;

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const code = String(req.query.code || "").toUpperCase();
  if (!code) return err(res, 400, "Missing game code");

  try {
    const { hostId, gameState } = req.body || {};
    if (!hostId) return err(res, 400, "hostId is required");
    if (!gameState) return err(res, 400, "gameState is required");

    const stateJson = JSON.stringify(gameState);
    if (Buffer.byteLength(stateJson) > MAX_STATE_BYTES) {
      return err(res, 413, "State payload too large");
    }

    const result = await db.transaction(async (q) => {
      const session = await getSession(code, q);
      if (!session) return { status: 404, error: "Game not found" };
      if (session.hostId !== hostId) return { status: 403, error: "Not the host" };
      if (session.status !== "lobby") return { status: 409, error: "Game already started" };
      if (session.players.length < 1) return { status: 409, error: "Need at least 1 player to start" };

      await q.run(
        "UPDATE sessions SET status = 'playing', state = ?, last_activity_at = ?, expires_at = ? WHERE code = ?",
        [stateJson, Date.now(), expiresFrom(Date.now()), code]
      );
      return {};
    });

    if (result.error) return err(res, result.status, result.error);
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(`POST /api/games/${code}/start`, e);
    return err(res, 500, "Internal server error");
  }
};
