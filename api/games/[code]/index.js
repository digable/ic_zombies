// GET  /api/games/:code  — poll session (state + players + status)
// POST /api/games/:code  — push updated game state (active player only)

const { db, getSession } = require("../../_db");
const { checkRateLimit } = require("../../_rateLimit");
const { cors, getIp, send, err } = require("../../_helpers");

const MAX_STATE_BYTES = 200 * 1024;
// Each waiting client polls every 1.5 s (40/min, see POLL_INTERVAL_MS in multiplayer.js).
// In the lobby all 6 players poll, and they may share one home IP: 6 × 40 = 240/min.
const POLLS_PER_MINUTE = 300;

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const code = String(req.query.code || "").toUpperCase();
  if (!code) return err(res, 400, "Missing game code");
  const ip = getIp(req);

  try {
    // -------------------------------------------------------------------------
    // GET — poll
    // -------------------------------------------------------------------------
    if (req.method === "GET") {
      await checkRateLimit(ip, "poll", POLLS_PER_MINUTE, 60);

      const session = await getSession(code);
      if (!session) return err(res, 404, "Game not found");
      const { hostId, hostIp, createdByIp, ...publicSession } = session;
      return send(res, 200, publicSession);
    }

    if (req.method !== "POST") return err(res, 405, "Method not allowed");

    // -------------------------------------------------------------------------
    // POST — push state (active player only)
    // -------------------------------------------------------------------------
    await checkRateLimit(ip, "push_state", 60, 60);

    const { playerId, gameState } = req.body || {};
    if (!playerId) return err(res, 400, "playerId is required");
    if (!gameState) return err(res, 400, "gameState is required");

    const stateJson = JSON.stringify(gameState);
    if (Buffer.byteLength(stateJson) > MAX_STATE_BYTES) {
      return err(res, 413, "State payload too large");
    }

    // Read and write in one transaction so a concurrent leave/join can't be overwritten
    // by a state built from a stale player list.
    const result = await db.transaction(async (q) => {
      const session = await getSession(code, q);
      if (!session) return { status: 404, error: "Game not found" };
      if (session.status !== "playing") return { status: 409, error: "Game is not in progress" };

      const playerSlot = session.players.findIndex((p) => p.id === playerId);
      if (playerSlot === -1) return { status: 403, error: "Player not in this session" };

      // Whose turn it is comes from the state the server already has, never from the
      // incoming state — otherwise any player could pass by sending their own slot + 1.
      // The client pushes once at the end of its turn: the index either stays on the
      // pusher (Cabin spell, extra turn) or advances to the next player.
      const n = session.players.length;
      const storedIndex = session.state?.currentPlayerIndex ?? 0;
      const nextSlot = (playerSlot + 1) % n;
      // Mid-turn hand-off (BBS door): the player whose turn it is can hand the controls to another
      // seat for a moment (Brain Cramp: the card's player steers the mover). The state they push
      // names that seat in actingSlot; that seat may then push once to hand back, but can never
      // change whose turn it is.
      const actingSlot = session.state?.actingSlot;
      const handingBack = playerSlot !== storedIndex && Number.isInteger(actingSlot) && actingSlot === playerSlot;
      if (playerSlot !== storedIndex && !handingBack) return { status: 403, error: "Not your turn" };
      if (handingBack) {
        if (gameState.currentPlayerIndex !== storedIndex) return { status: 403, error: "Only the player whose turn it is can pass the turn" };
      } else if (gameState.currentPlayerIndex !== playerSlot && gameState.currentPlayerIndex !== nextSlot) {
        return { status: 403, error: "Turn can only pass to the next player" };
      }

      await q.run(
        "UPDATE sessions SET state = ?, last_activity_at = ? WHERE code = ?",
        [stateJson, Date.now(), code]
      );
      return {};
    });

    if (result.error) return err(res, result.status, result.error);
    return send(res, 200, { ok: true });

  } catch (e) {
    if (e.status === 429) return err(res, 429, e.message, { retryAfter: e.retryAfter });
    console.error(`/api/games/${code}`, e);
    return err(res, 500, "Internal server error");
  }
};
