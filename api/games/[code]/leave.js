// POST /api/games/:code/leave

const { db, getSession } = require("../../_db");
const { cors, send, err } = require("../../_helpers");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return err(res, 405, "Method not allowed");

  const code = String(req.query.code || "").toUpperCase();
  if (!code) return err(res, 400, "Missing game code");

  try {
    const { playerId } = req.body || {};

    const result = await db.transaction(async (q) => {
      const session = await getSession(code, q);
      if (!session) return { status: 404, error: "Game not found" };

      if (session.status === "lobby") {
        const players = session.players.filter((p) => p.id !== playerId);
        await q.run(
          "UPDATE sessions SET players = ?, last_activity_at = ? WHERE code = ?",
          [JSON.stringify(players), Date.now(), code]
        );
        return {};
      }

      if (session.status === "playing") {
        const slot = session.players.findIndex((p) => p.id === playerId);
        // Player not found — already removed or never in this game; no-op
        if (slot === -1) return {};

        const leftEntry = { name: session.players[slot].name, slot };
        const newPlayers = session.players.filter((_, i) => i !== slot);
        const leftLog = JSON.stringify([...session.leftLog, leftEntry]);

        // If no players remain, just end the session
        if (newPlayers.length === 0) {
          await q.run(
            "UPDATE sessions SET status = 'done', left_log = ?, last_activity_at = ? WHERE code = ?",
            [leftLog, Date.now(), code]
          );
          return {};
        }

        // Splice the leaving player out of the stored game state
        let newState = session.state;
        if (newState && Array.isArray(newState.players)) {
          const origIndex = newState.currentPlayerIndex ?? 0;
          const updatedPlayers = newState.players.filter((_, i) => i !== slot);
          let updatedIndex = origIndex;
          let wasTheirTurn = false;

          if (slot === origIndex) {
            // It was the leaving player's turn — advance to the next player (wraps at end)
            updatedIndex = slot % updatedPlayers.length;
            wasTheirTurn = true;
          } else if (slot < origIndex) {
            // Leaver had a lower slot — current index shifts down by one
            updatedIndex = origIndex - 1;
          }
          // slot > origIndex — no adjustment needed

          newState = { ...newState, players: updatedPlayers, currentPlayerIndex: updatedIndex };

          if (wasTheirTurn) {
            // End the leaving player's turn cleanly — reset step and all mid-turn pending state
            // so the next player starts fresh instead of inheriting a half-finished turn.
            newState = {
              ...newState,
              step: "DRAW_TILE",
              movesRemaining: 0,
              currentMoveRoll: null,
              currentZombieRoll: null,
              selectedHandIndex: null,
              movementBonus: 0,
              moveFloorThisTurn: 0,
              doubleMovementThisTurn: false,
              playerTrail: [],
              lastCombatResult: null,
              lastPlayedEventCard: null,
              // Pending tile placement
              pendingTile: null,
              pendingRotation: 0,
              pendingTileOptions: [],
              pendingCompanionTiles: [],
              pendingTileDeck: "base",
              // Pending interactions / combat
              pendingCombatDecision: null,
              combatMoveResume: null,
              combatZombiePhaseResume: null,
              pendingEventChoice: null,
              pendingZombieReplace: null,
              pendingZombieDiceChallenge: null,
              pendingZombiePlace: null,
              pendingZombieMovement: null,
              pendingForcedMove: null,
              pendingBuildingSelect: null,
              pendingDynamiteTarget: null,
              pendingMinefield: null,
              pendingRocketLauncher: null,
              pendingZombieFlood: null,
              pendingBreakthrough: null,
              pendingSpaceSelect: null,
              pendingDuctChoice: null,
            };
          }
        }

        await q.run(
          "UPDATE sessions SET players = ?, state = ?, left_log = ?, last_activity_at = ? WHERE code = ?",
          [JSON.stringify(newPlayers), newState == null ? null : JSON.stringify(newState), leftLog, Date.now(), code]
        );
        return {};
      }

      // status === "done" — nothing to do
      return {};
    });

    if (result.error) return err(res, result.status, result.error);
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(`POST /api/games/${code}/leave`, e);
    return err(res, 500, "Internal server error");
  }
};
