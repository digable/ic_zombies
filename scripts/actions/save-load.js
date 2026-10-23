// ---------------------------------------------------------------------------
// Save / Load — localStorage-based, 5 slots
// ---------------------------------------------------------------------------
// Tiles are plain data (no functions) so they serialize directly.
// Event cards have functions; we save card names and look up live objects on load.
// Save is blocked while any pending state is active (those have closures).
// ---------------------------------------------------------------------------

const SAVE_KEY  = (slot) => `ic_save_${slot}`;
const META_KEY  = (slot) => `ic_meta_${slot}`;

// One-time move of saves made under the old "VC IC Zombies" key names
(function migrateLegacySaveKeys() {
  try {
    for (let slot = 0; slot < SAVE_SLOTS; slot++) {
      for (const [oldKey, newKey] of [[`vc_ic_save_${slot}`, SAVE_KEY(slot)], [`vc_ic_meta_${slot}`, META_KEY(slot)]]) {
        const value = localStorage.getItem(oldKey);
        if (value === null) continue;
        if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
        localStorage.removeItem(oldKey);
      }
    }
  } catch { /* storage unavailable — nothing to migrate */ }
})();

function getAllEventCardDefs() {
  const all = [];
  if (typeof playerEventCards   !== "undefined") all.push(...playerEventCards);
  if (typeof opponentEventCards !== "undefined") all.push(...opponentEventCards);
  if (typeof zombieEventCards   !== "undefined") all.push(...zombieEventCards);
  if (typeof pageEventCards     !== "undefined") all.push(...pageEventCards);
  return all;
}

function hasPendingState() {
  return !!(
    state.pendingCombatDecision  || state.pendingEventChoice     ||
    state.pendingZombieReplace   || state.pendingZombieDiceChallenge ||
    state.pendingZombiePlace     || state.pendingZombieMovement   ||
    state.pendingForcedMove      || state.pendingBuildingSelect   ||
    state.pendingDynamiteTarget  || state.pendingMinefield        ||
    state.pendingRocketLauncher  || state.pendingTile             ||
    state.pendingZombieFlood     ||
    state.pendingBreakthrough    || state.pendingSpaceSelect
  );
}

function serializeState() {
  const serializePlayer = (p) => ({
    ...p,
    hand:      p.hand.map((c) => c.name),
    items:     p.items.map((c) => c.name),
    botdPages: (p.botdPages || []).map((c) => c.name),
    // studentLoanReturn holds live card references — serialize as names only
    studentLoanReturn: p.studentLoanReturn
      ? p.studentLoanReturn.map((e) => ({ cardName: e.card.name, fromPlayerId: e.fromPlayerId }))
      : null
  });

  return {
    version: 1,
    savedAt: new Date().toISOString(),

    // Scalar / plain fields
    currentPlayerIndex:      state.currentPlayerIndex,
    step:                    state.step,
    movesRemaining:          state.movesRemaining,
    currentMoveRoll:         state.currentMoveRoll,
    turnNumber:              state.turnNumber,
    gameOver:                state.gameOver,
    winInfo:                 state.winInfo,
    zombieMoveFreezeCount:       state.zombieMoveFreezeCount,
    weaponsJammedCount:          state.weaponsJammedCount,
    itemsDisabledCount:          state.itemsDisabledCount,
    movementRollFreezeCount:     state.movementRollFreezeCount,
    tokenPickupFrozenCount:      state.tokenPickupFrozenCount,
    bulletsCombatFrozenCount:    state.bulletsCombatFrozenCount,
    pillowFightCount:            state.pillowFightCount,
    doubleMovementCount:         state.doubleMovementCount,
    blockedSewerSpaces:          Array.from(state.blockedSewerSpaces.entries()),
    lastPlayedWeaponName:        state.lastPlayedWeaponName,
    lastPlayedWeaponByPlayerId:  state.lastPlayedWeaponByPlayerId,
    recentKillByPlayerId:        state.recentKillByPlayerId,
    movementBonus:               state.movementBonus,
    moveFloorThisTurn:       state.moveFloorThisTurn,
    doubleMovementThisTurn:  state.doubleMovementThisTurn,
    regularZombieEnhanced:   state.regularZombieEnhanced,
    forcedNextOpponentId:    state.forcedNextOpponentId,
    useGuts:                 state.useGuts,
    useSewerTokens:          state.useSewerTokens,
    sewerTokenSpaces:        Array.from(state.sewerTokenSpaces.entries()),
    deckFilters:             state.deckFilters,
    eventDeckFilters:        state.eventDeckFilters ?? state.deckFilters,
    deckStartCounts:         state.deckStartCounts,
    deckStartTotal:          state.deckStartTotal,
    baseMapDeckStartCount:   state.baseMapDeckStartCount,
    eventDeckStartTotal:     state.eventDeckStartTotal,
    playerTrail:             state.playerTrail || [],
    logs:                    state.logs || [],

    // Players — hand/items stored as card names
    players: state.players.map(serializePlayer),

    // Tile collections — plain data, no functions
    board:          [...state.board.entries()],
    mapDeck:        state.mapDeck,
    standaloneDecks: state.standaloneDecks,
    companionReserve: state.companionReserve || [],
    discardPile:    state.discardPile,

    // Sets / Maps
    activeStandaloneDecks:  [...state.activeStandaloneDecks],
    breakthroughConnections: [...state.breakthroughConnections],
    floor2Tiles:            [...(state.floor2Tiles || [])],
    noZombieTiles:          [...(state.noZombieTiles || [])],
    zombies:     [...state.zombies.entries()],
    spaceTokens: [...state.spaceTokens.entries()],

    // Event card collections — name references only (live objects looked up on load)
    eventDeck:        state.eventDeck.map((c) => c.name),
    eventDiscardPile: state.eventDiscardPile.map((c) => c.name)
  };
}

function deserializeState(data) {
  const nameToCard = Object.fromEntries(
    getAllEventCardDefs().map((c) => [c.name, c])
  );
  const restoreCards = (names) => names.map((n) => nameToCard[n]).filter(Boolean);

  // Players
  state.players = data.players.map((p) => ({
    ...p,
    hand:      restoreCards(p.hand),
    items:     restoreCards(p.items),
    botdPages: restoreCards(p.botdPages || []),
    pageRemovedThisRound: p.pageRemovedThisRound ?? false,
    hasBike:              p.hasBike ?? false,
    mustMoveTowardTile:   p.mustMoveTowardTile ?? null,
    studentLoanReturn: p.studentLoanReturn
      ? p.studentLoanReturn.map((e) => ({ card: nameToCard[e.cardName], fromPlayerId: e.fromPlayerId })).filter((e) => e.card)
      : null
  }));
  rebuildPlayerById();

  state.currentPlayerIndex = data.currentPlayerIndex;

  // Tile data (plain objects, no reconstruction needed)
  state.board          = new Map(data.board);
  state.mapDeck        = data.mapDeck;
  state.standaloneDecks = data.standaloneDecks;
  state.companionReserve = data.companionReserve || [];
  state.discardPile    = data.discardPile;

  // Sets
  state.activeStandaloneDecks   = new Set(data.activeStandaloneDecks);
  state.breakthroughConnections = new Set(data.breakthroughConnections);
  state.floor2Tiles             = new Set(data.floor2Tiles || []);
  state.noZombieTiles           = new Set(data.noZombieTiles || []);

  // Maps
  state.zombies     = new Map(data.zombies);
  state.spaceTokens = new Map(data.spaceTokens);

  // Event cards
  state.eventDeck        = restoreCards(data.eventDeck);
  state.eventDiscardPile = restoreCards(data.eventDiscardPile);

  // Scalars
  state.step                   = data.step;
  state.movesRemaining         = data.movesRemaining;
  state.currentMoveRoll        = data.currentMoveRoll;
  state.turnNumber             = data.turnNumber;
  state.gameOver               = data.gameOver;
  state.winInfo                = data.winInfo;
  state.zombieMoveFreezeCount  = data.zombieMoveFreezeCount;
  state.weaponsJammedCount         = data.weaponsJammedCount ?? 0;
  state.itemsDisabledCount         = data.itemsDisabledCount ?? 0;
  state.movementRollFreezeCount    = data.movementRollFreezeCount ?? 0;
  state.tokenPickupFrozenCount     = data.tokenPickupFrozenCount ?? 0;
  state.bulletsCombatFrozenCount   = data.bulletsCombatFrozenCount ?? 0;
  state.pillowFightCount           = data.pillowFightCount ?? 0;
  state.doubleMovementCount        = data.doubleMovementCount ?? 0;
  state.blockedSewerSpaces         = new Map(data.blockedSewerSpaces ?? []);
  state.lastPlayedWeaponName       = data.lastPlayedWeaponName ?? null;
  state.lastPlayedWeaponByPlayerId = data.lastPlayedWeaponByPlayerId ?? null;
  state.lastPlayedEventCard        = null;
  state.recentKillByPlayerId       = data.recentKillByPlayerId ?? null;
  state.movementBonus          = data.movementBonus;
  state.moveFloorThisTurn      = data.moveFloorThisTurn;
  state.doubleMovementThisTurn = data.doubleMovementThisTurn;
  state.regularZombieEnhanced  = data.regularZombieEnhanced;
  state.forcedNextOpponentId   = data.forcedNextOpponentId ?? null;
  state.useGuts                = data.useGuts ?? false;
  state.useSewerTokens         = data.useSewerTokens ?? false;
  state.sewerTokenSpaces       = new Map(data.sewerTokenSpaces ?? []);
  state.deckFilters            = data.deckFilters;
  state.eventDeckFilters       = data.eventDeckFilters ?? data.deckFilters ?? {};
  state.deckStartCounts        = data.deckStartCounts;
  state.deckStartTotal         = data.deckStartTotal;
  state.baseMapDeckStartCount  = data.baseMapDeckStartCount;
  state.eventDeckStartTotal    = data.eventDeckStartTotal;
  state.playerTrail            = data.playerTrail || [];
  state.logs                   = data.logs || [];

  state.gameActive = true;

  // Clear all pending / ephemeral state (save only possible when none were active)
  state.pendingCombatDecision    = null;
  state.pendingEventChoice       = null;
  state.pendingZombieReplace     = null;
  state.pendingZombieDiceChallenge = null;
  state.pendingZombiePlace       = null;
  state.pendingZombieMovement    = null;
  state.pendingForcedMove        = null;
  state.pendingBuildingSelect    = null;
  state.pendingDynamiteTarget    = null;
  state.pendingMinefield         = null;
  state.pendingRocketLauncher    = null;
  state.pendingZombieFlood       = null;
  state.pendingDuctChoice        = null;
  state.pendingTile              = null;
  state.pendingRotation          = 0;
  state.pendingTileOptions       = [];
  state.pendingCompanionTiles    = [];
  state.pendingTileDeck          = TILE_DECK.BASE;
  state.pendingBreakthrough      = null;
  state.pendingSpaceSelect       = null;
  state.selectedHandIndex        = null;
  state.lastCombatResult         = null;
  state.recentKillKey            = null;
  state.knockoutBanner           = null;
  state.itemAcquiredBanner       = null;
  state.currentZombieRoll        = null;
  state.zombieMovedSpaces        = new Set();
  if (state.zombieAnimationTimer !== null) {
    clearTimeout(state.zombieAnimationTimer);
    state.zombieAnimationTimer   = null;
  }
  _boardBoundsCache = { minX: null, maxX: null, minY: null, maxY: null };
  _boardCellFps.clear();
  _trailFp = null;
  _trailSvgEl = null;
}

function saveGame(slot) {
  if (state.players.length === 0) return;
  if (hasPendingState()) {
    logLine("Cannot save during a pending action — resolve it first.");
    render();
    return;
  }
  try {
    const data = serializeState();
    localStorage.setItem(SAVE_KEY(slot), JSON.stringify(data));
    localStorage.setItem(META_KEY(slot), JSON.stringify({
      turnNumber:  state.turnNumber,
      playerCount: state.players.length,
      step:        state.step,
      savedAt:     data.savedAt
    }));
    logLine(`Game saved to Slot ${slot + 1}.`, "quiet");
  } catch (e) {
    logLine(`Save to Slot ${slot + 1} failed: ${e.message}`);
  }
  render();
}

function syncSetupUiToState() {
  const pcInput = document.getElementById("playerCount");
  if (pcInput) pcInput.value = state.players.length;

  document.querySelectorAll("[data-deck-coll]").forEach((el) => {
    const col = el.getAttribute("data-deck-coll");
    const st  = el.getAttribute("data-deck-state");
    el.checked = !!(state.deckFilters?.[col]?.[st]);
  });

  document.querySelectorAll("[data-event-coll]").forEach((el) => {
    const col = el.getAttribute("data-event-coll");
    const st  = el.getAttribute("data-event-state");
    el.checked = !!(state.eventDeckFilters?.[col]?.[st]);
  });

  if (typeof updateDeckPreviewCounts === "function") {
    updateDeckPreviewCounts();
    // Loading a game is not a "filter changed" state — don't highlight Start Game.
    if (refs && refs.newGameBtn) refs.newGameBtn.classList.remove("needs-restart");
  }
}

function loadGame(slot) {
  const raw = localStorage.getItem(SAVE_KEY(slot));
  if (!raw) return;
  try {
    deserializeState(JSON.parse(raw));
    syncSetupUiToState();
    logLine(`Game loaded from Slot ${slot + 1}.`, "quiet");
  } catch (e) {
    logLine(`Load from Slot ${slot + 1} failed: ${e.message}`);
  }
  render();
}

function deleteSave(slot) {
  localStorage.removeItem(SAVE_KEY(slot));
  localStorage.removeItem(META_KEY(slot));
  render();
}

function getSlotMeta(slot) {
  const raw = localStorage.getItem(META_KEY(slot));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function exportSlot(slot) {
  const raw = localStorage.getItem(SAVE_KEY(slot));
  if (!raw) return;
  const meta = getSlotMeta(slot);
  const ts = (meta?.savedAt ?? new Date().toISOString()).replace(/[:.]/g, "-").slice(0, 19);
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vc-zombies-slot${slot + 1}-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importToSlot(slot, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.players || !data.board) throw new Error("Not a valid save file.");
      const existing = getSlotMeta(slot);
      if (existing && !confirm(`Overwrite Slot ${slot + 1}?\n(${formatSavedAt(existing.savedAt)})`)) return;
      localStorage.setItem(SAVE_KEY(slot), e.target.result);
      localStorage.setItem(META_KEY(slot), JSON.stringify({
        turnNumber:  data.turnNumber,
        playerCount: data.players.length,
        step:        data.step,
        savedAt:     data.savedAt
      }));
      logLine(`Save file imported into Slot ${slot + 1}.`, "quiet");
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
    render();
  };
  reader.readAsText(file);
}
