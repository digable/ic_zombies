// render.js — Thin orchestrator. Wires updateButtons and the main render() call.
// All rendering helpers live in render-helpers.js, render-board.js, render-panels.js, render-debug.js.

let _toastTimer = null;
let _lastToastText = null;

function showMobileToast(text) {
  if (!window.matchMedia("(max-width: 1080px)").matches) return;
  const el = document.getElementById("mobileToast");
  if (!el) return;
  if (text === _lastToastText) return; // same message — don't re-flash
  _lastToastText = text;
  el.textContent = text;
  el.classList.add("mobile-toast--visible");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove("mobile-toast--visible");
    _lastToastText = null;
    _toastTimer = null;
  }, 4000);
}

function isPendingInteraction() {
  return !!(state.pendingCombatDecision || state.pendingEventChoice || state.pendingZombieReplace ||
    state.pendingZombieDiceChallenge || state.pendingZombiePlace || state.pendingZombieMovement ||
    state.pendingForcedMove || state.pendingBuildingSelect || state.pendingDynamiteTarget || state.pendingFrisbeeTarget ||
    state.pendingMinefield || state.pendingRocketLauncher || state.pendingZombieFlood ||
    state.pendingBreakthrough || state.pendingSpaceSelect || state.pendingDuctChoice);
}

function updateButtons() {
  document.body.classList.toggle("game-active", !!state.gameActive);

  // Z4 (Cabin Spell) visibility — runs unconditionally so early returns don't leave stale state
  const _z4 = isZ4Active();
  const _spellDisplay = _z4 ? "" : "none";
  if (refs.performSpellBtn) refs.performSpellBtn.style.display = _spellDisplay;
  const _tsSpell = document.getElementById("ts-performSpellBtn");
  if (_tsSpell) _tsSpell.style.display = _spellDisplay;
  const _spellObj = document.getElementById("spellObjective");
  if (_spellObj) _spellObj.classList.toggle("hidden", !_z4);

  // No game started yet — disable all action buttons
  if (!state.gameActive) {
    [refs.drawTileBtn, refs.rotateLeftBtn, refs.rotateRightBtn, refs.combatBtn,
     refs.drawEventsBtn, refs.rollMoveBtn, refs.endMoveBtn, refs.moveZombiesBtn,
     refs.discardBtn, refs.endTurnBtn, refs.performSpellBtn].forEach((b) => { if (b) b.disabled = true; });
    document.querySelectorAll(".standalone-draw-btn").forEach((b) => { b.disabled = true; });
    refs.moveDirBtns.forEach((b) => { b.disabled = true; });
    return;
  }

  // Online mode: disable everything when it's not this device's turn
  if (state.multiplayerSession?.mode === "online" && !isMyTurn()) {
    [refs.drawTileBtn, refs.rotateLeftBtn, refs.rotateRightBtn, refs.combatBtn,
     refs.drawEventsBtn, refs.rollMoveBtn, refs.endMoveBtn, refs.moveZombiesBtn,
     refs.discardBtn, refs.endTurnBtn, refs.performSpellBtn].forEach((b) => { if (b) b.disabled = true; });
    document.querySelectorAll(".standalone-draw-btn").forEach((b) => { b.disabled = true; });
    refs.moveDirBtns.forEach((b) => { b.disabled = true; });
    updateMpTurnBanner();
    return;
  }
  updateMpTurnBanner();

  if (isPendingInteraction()) {
    refs.drawTileBtn.disabled = true;
    document.querySelectorAll(".standalone-draw-btn").forEach((b) => { b.disabled = true; });
    refs.rotateLeftBtn.disabled = true;
    refs.rotateRightBtn.disabled = true;
    refs.combatBtn.disabled = true;
    refs.drawEventsBtn.disabled = true;
    refs.rollMoveBtn.disabled = true;
    refs.endMoveBtn.disabled = true;
    refs.moveZombiesBtn.disabled = true;
    refs.discardBtn.disabled = true;
    refs.endTurnBtn.disabled = true;
    if (refs.performSpellBtn) refs.performSpellBtn.disabled = true;
    // Direction buttons stay enabled during forced movement so the controller
    // can move the target player (Brain Cramp / Where Did Everybody Go?).
    refs.moveDirBtns.forEach((btn) => {
      btn.disabled = !state.pendingForcedMove;
    });
    return;
  }

  const p = currentPlayer();
  const combatRequired = isCombatRequiredForCurrentPlayer();

  const hasBaseDeck = state.mapDeck && state.mapDeck.length > 0;
  refs.drawTileBtn.style.display = (state.standaloneDecks && Object.keys(state.standaloneDecks).length > 0 && !hasBaseDeck) ? "none" : "";
  refs.drawTileBtn.disabled = state.step !== STEP.DRAW_TILE || state.gameOver || Boolean(state.pendingTile) || state.mapDeck.length === 0;
  // Once any tile is drawn, disable all standalone draw buttons — only one draw per turn.
  if (state.step !== STEP.DRAW_TILE || state.pendingTile || state.gameOver) {
    document.querySelectorAll(".standalone-draw-btn").forEach((b) => { b.disabled = true; });
  }
  refs.rotateLeftBtn.disabled = !state.pendingTile || state.gameOver || state.step !== STEP.DRAW_TILE;
  refs.rotateRightBtn.disabled = !state.pendingTile || state.gameOver || state.step !== STEP.DRAW_TILE;
  refs.combatBtn.disabled = state.step !== STEP.COMBAT || state.gameOver || !combatRequired;
  refs.drawEventsBtn.disabled = state.step !== STEP.DRAW_EVENTS || state.gameOver;
  const drawTarget = (state.useGuts && p.guts != null) ? Math.max(1, p.guts) : MAX_HAND_SIZE;
  refs.drawEventsBtn.textContent = `Draw to ${drawTarget} Event${drawTarget !== 1 ? "s" : ""}`;
  refs.rollMoveBtn.disabled = state.step !== STEP.ROLL_MOVE || state.gameOver;
  if (state.step === STEP.ROLL_MOVE && !state.gameOver) {
    if (p.pendingDuctTeleport) {
      const destTile = getTileAtSpace(p.pendingDuctTeleport.x, p.pendingDuctTeleport.y);
      refs.rollMoveBtn.textContent = `Air Duct → ${destTile?.name || "store"}`;
    } else {
      refs.rollMoveBtn.textContent = "Roll Movement";
    }
  } else {
    refs.rollMoveBtn.textContent = "Roll Movement";
  }
  const mustExitBuilding = p.claustrophobiaActive && isSpaceBuilding(p.x, p.y);
  refs.endMoveBtn.disabled = state.step !== STEP.MOVE || state.gameOver || mustExitBuilding;

  if (refs.sewerTokenRow) refs.sewerTokenRow.style.display = state.useSewerTokens ? "" : "none";
  if (refs.placeSewerTokenBtn) {
    const canPlace = state.gameActive && !state.gameOver && (state.step === STEP.ROLL_MOVE || state.step === STEP.MOVE) && p.sewerTokensAvailable > 0;
    refs.placeSewerTokenBtn.disabled = !canPlace && !state.pendingSewerTokenPlace;
    refs.placeSewerTokenBtn.textContent = state.pendingSewerTokenPlace ? "Cancel Placement" : `Place Sewer Token (${p.sewerTokensAvailable ?? 0} left)`;
  }
  if (refs.toggleSewerBtn) {
    const sewerActive = state.useSewerTokens && state.gameActive && !state.gameOver;
    const canEnter = (state.step === STEP.ROLL_MOVE || state.step === STEP.MOVE) &&
      state.sewerTokenSpaces.has(key(p.x, p.y));
    // While underground, always surface the Exit button so the player isn't stranded
    // if the turn advanced past MOVE (card effects, combat deferral, etc.).
    const show = sewerActive && (p.inSewer || canEnter);
    refs.toggleSewerBtn.style.display = show ? "" : "none";
    refs.toggleSewerBtn.textContent = p.inSewer ? "Exit Sewer" : "Enter Sewer";
  }
  refs.moveZombiesBtn.disabled = state.step !== STEP.MOVE_ZOMBIES || state.gameOver || state.zombies.size === 0;
  refs.discardBtn.disabled = state.step !== STEP.DISCARD || state.gameOver;
  refs.endTurnBtn.disabled = state.step !== STEP.END || state.gameOver;
  if (refs.performSpellBtn) {
    refs.performSpellBtn.disabled = state.gameOver || state.step !== STEP.END || !canAttemptSpell(p);
  }

  const claustroInBuilding = p.claustrophobiaActive && isSpaceBuilding(p.x, p.y);
  refs.moveDirBtns.forEach((btn) => {
    const dir = btn.dataset.dir;
    const mover = state.pendingForcedMove
      ? getPlayerById(state.pendingForcedMove.targetPlayerId) ?? p
      : p;
    let disabled = state.step !== STEP.MOVE || state.gameOver || state.movesRemaining <= 0 || !canMove(mover, dir);
    // Claustrophobia: while inside a building, block directions leading to more building subtiles
    if (!disabled && claustroInBuilding) {
      const d = DIRS[dir];
      if (isSpaceBuilding(mover.x + d.x, mover.y + d.y)) disabled = true;
    }
    btn.disabled = disabled;
  });
}

function render() {
  renderMeta();
  renderBoard();
  renderPlayerTrailSvg();
  renderPlayers();
  renderHand();
  renderDeckInfo();
  renderStandaloneDeckInfo();
  renderEventDeckInfo();
  renderCombatDecision();
  renderEventChoice();
  renderZombieReplacePanel();
  renderZombieDiceChallenge();
  renderDuctChoice();
  renderLog();
  rebuildStandaloneDrawBtns();
  updateButtons();
  renderMoveStatus();
  renderGameOver();
  renderKnockoutBanner();
  renderItemAcquiredBanner();
  renderSaveLoadPanel();
  if (typeof syncTurnStrip === "function") syncTurnStrip();
  if (typeof syncDesktopControls === "function") syncDesktopControls();
  if (typeof renderMobileHandPanel === "function") renderMobileHandPanel();
  // If a card triggered a pending interaction while on the Hand tab, jump to Map
  // so the player sees the relevant turn-strip panel immediately.
  if (document.body.classList.contains("hand-tab-active") && isPendingInteraction()) {
    if (typeof switchMobileTab === "function") switchMobileTab("map");
  }
  // Show latest non-quiet log line as a toast on mobile.
  if (state.logs && state.logs.length > 0) {
    const latest = state.logs.find((e) => e.type !== "quiet");
    if (latest) showMobileToast(latest.text);
  }
  // Online: share this change with the other players (no-op offline or when it's not our move)
  if (typeof scheduleLiveSync === "function") scheduleLiveSync();
}
