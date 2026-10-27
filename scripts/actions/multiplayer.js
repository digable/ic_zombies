// ---------------------------------------------------------------------------
// Multiplayer — online session management
// All paths are gated behind state.multiplayerSession?.mode === "online".
// Same-device play is completely unaffected when multiplayerSession is null.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1500;
const API_BASE = "/api/games";
// Live sync: while you have the controls, every change (a card, a step, a zombie move) is pushed
// to the server so everyone else's board and log follow along. Changes are bundled: a push goes
// out LIVE_SYNC_DELAY_MS after things go quiet, and never closer than LIVE_SYNC_MIN_GAP_MS to the
// last one (the server allows 60 pushes a minute; this stays under 40).
const LIVE_SYNC_DELAY_MS = 600;
const LIVE_SYNC_MIN_GAP_MS = 1500;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mpSession() { return state.multiplayerSession; }
function isOnlineMode() { return mpSession()?.mode === "online"; }
function isMyTurn() {
  const mp = mpSession();
  return mp ? state.currentPlayerIndex === mp.myPlayerSlot : true;
}
// Whether this device has the controls right now. Normally that's "it's my turn"; the BBS door
// overrides it (onlineCanAct) for moments when another player steers, e.g. Brain Cramp.
function canActOnline() {
  return typeof onlineCanAct === "function" ? !!onlineCanAct() : isMyTurn();
}
// Identifies one pushed state. syncSeq changes on every push, so mid-turn changes within the same
// step still count as new.
function stateKeyOf(s) {
  return `${s.turnNumber}:${s.currentPlayerIndex}:${s.step}:${s.syncSeq || ""}`;
}

// Multiplayer DOM refs — cached on first access. Used by pollers and banner
// updates that fire every 1.5s, so we avoid repeated getElementById cost.
let _mpRefs = null;
function mpRefs() {
  if (_mpRefs) return _mpRefs;
  _mpRefs = {
    lobbyStatus:  document.getElementById("mpLobbyStatus"),
    playerList:   document.getElementById("mpPlayerList"),
    shareCode:    document.getElementById("mpShareCode"),
    startBtn:     document.getElementById("mpStartBtn"),
    turnBanner:   document.getElementById("mpTurnBanner"),
    mobileToast:  document.getElementById("mobileToast"),
    mapTabBtn:    document.querySelector('.mobile-tab-btn[data-tab="map"]'),
    panel:        document.getElementById("mpPanel"),
  };
  return _mpRefs;
}

function getOrCreateDeviceId() {
  let id = sessionStorage.getItem("vc_deviceId");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("vc_deviceId", id);
  }
  return id;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw Object.assign(new Error(`API route not found: ${path}`), { status: 404 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status, data });
  return data;
}

function setLobbyStatus(msg, isError = false) {
  const el = mpRefs().lobbyStatus;
  if (!el) return;
  el.textContent = msg;
  el.className = "mp-lobby-status" + (isError ? " mp-lobby-error" : "");
}

function renderLobbyPanel(session) {
  const players = session?.players || [];
  const r = mpRefs();
  const listEl = r.playerList;
  if (listEl) {
    listEl.innerHTML = players.length === 0
      ? "<em>Waiting for players...</em>"
      : players.map((p) => `<div class="mp-player-entry">${escapeHtml(p.name)}</div>`).join("");
  }
  const codeEl = r.shareCode;
  if (codeEl && session?.code) {
    const url = `${location.origin}${location.pathname}?game=${encodeURIComponent(session.code)}`;
    codeEl.textContent = "";
    const codeLabel = document.createElement("span");
    codeLabel.innerHTML = `Code: <strong>${escapeHtml(session.code)}</strong> &nbsp;|&nbsp; `;
    const copyBtn = document.createElement("button");
    copyBtn.className = "mp-copy-btn";
    copyBtn.textContent = "Copy Link";
    copyBtn.addEventListener("click", () => navigator.clipboard.writeText(url));
    codeEl.appendChild(codeLabel);
    codeEl.appendChild(copyBtn);
  }
  const mp = mpSession();
  const startBtn = r.startBtn;
  if (startBtn) {
    const isHost = mp?.isHost === true;
    startBtn.style.display = isHost ? "" : "none";
    startBtn.disabled = !isHost || players.length < 1;
  }
}

function showLobbySection() {
  document.getElementById("mpLobbySection")?.classList.remove("hidden");
  document.getElementById("mpCreateJoinSection")?.classList.add("hidden");
  document.getElementById("newGameBtn").style.display = "none";
}

function showCreateJoinSection() {
  document.getElementById("mpLobbySection")?.classList.add("hidden");
  document.getElementById("mpCreateJoinSection")?.classList.remove("hidden");
  document.getElementById("newGameBtn").style.display = "";
  setLobbyStatus("");
}

// Called once the game is live — collapses the MP panel for both host and joiner
function hideMpPanel() {
  const panel = mpRefs().panel;
  if (panel) panel.removeAttribute("open");
}

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

function startPolling() {
  const mp = mpSession();
  if (!mp) return;
  stopPolling();
  mp.pollInterval = setInterval(pollFromCloud, POLL_INTERVAL_MS);
}

function stopPolling() {
  const mp = mpSession();
  if (mp?.pollInterval) {
    clearInterval(mp.pollInterval);
    mp.pollInterval = null;
  }
}

async function pollFromCloud() {
  const mp = mpSession();
  if (!mp) return;

  try {
    const session = await apiFetch(`${API_BASE}/${mp.code}`);

    if (session.status === "done") {
      stopPolling();
      setLobbyStatus("Session ended.");
      return;
    }

    if (session.status === "lobby") {
      renderLobbyPanel(session);
      return;
    }

    // status === "playing"
    if (!session.state) return;

    const incoming = session.state;
    const stateKey = stateKeyOf(incoming);

    // First time seeing "playing" — close the lobby panel and jump to map
    if (!mp.gameStarted) {
      mp.gameStarted = true;
      mp.lastPlayerCount = session.players.length;
      mp.lastStateKey = stateKey;
      hideMpPanel();
      if (typeof switchMobileTab === "function") switchMobileTab("map");
      deserializeState(incoming);
      updateMpTurnBanner();
      render();
      if (isMyTurn()) { stopPolling(); showMpTurnNotification(); }
      return;
    }

    // While we have the controls our own copy is the newest; the server's may be a push behind.
    if (canActOnline()) return;

    // Detect player departures — must happen before the stateKey check because
    // a non-current player leaving doesn't change turnNumber/currentPlayerIndex/step.
    const departures = [];
    if (mp.lastPlayerCount !== null && session.players.length < mp.lastPlayerCount) {
      const leftCount = mp.lastPlayerCount - session.players.length;
      const newDeps = (session.leftLog || []).slice(-leftCount);
      for (const dep of newDeps) {
        // If the leaver had a lower slot than ours, our slot shifted down by one
        if (dep.slot < mp.myPlayerSlot) mp.myPlayerSlot -= 1;
        departures.push(dep);
      }
    }
    mp.lastPlayerCount = session.players.length;

    // Use a composite key to detect real game-state changes.
    const stateChanged = mp.lastStateKey !== stateKey;
    if (stateChanged) mp.lastStateKey = stateKey;

    // Nothing new to apply
    if (!stateChanged && departures.length === 0) return;

    // Always deserialize when a player left — server removed them from state.players
    // even if stateKey didn't change (e.g. currentPlayerIndex stayed 0 after wrapping).
    if (stateChanged || departures.length > 0) deserializeState(incoming);

    // Log departures after deserializeState so they append to the restored log
    for (const dep of departures) {
      if (typeof logLine === "function") logLine(`${dep.name} left the game.`);
    }
    if (departures.length === 1) {
      const el = mpRefs().mobileToast;
      if (el) {
        el.textContent = `${departures[0].name} left the game`;
        el.classList.add("mobile-toast--visible");
        setTimeout(() => el.classList.remove("mobile-toast--visible"), 5000);
      }
    } else if (departures.length > 1) {
      const el = mpRefs().mobileToast;
      if (el) {
        el.textContent = `${departures.length} players left the game`;
        el.classList.add("mobile-toast--visible");
        setTimeout(() => el.classList.remove("mobile-toast--visible"), 5000);
      }
    }

    updateMpTurnBanner();
    render();

    if (isMyTurn()) {
      stopPolling();
      // Fire notification when state changed (normal turn handoff) OR when a departure
      // caused our turn — departure can leave currentPlayerIndex unchanged (wraps to same
      // number) so stateChanged would be false even though it just became our turn.
      if (stateChanged || departures.length > 0) showMpTurnNotification();
    }
  } catch (e) {
    console.warn("pollFromCloud failed:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Pushing state: live sync while you play, and syncToCloud when the turn passes
// ---------------------------------------------------------------------------

let _liveSyncTimer = null;
let _lastPushAt = 0;

// The state as it would be pushed, minus the parts that change on every call.
function pushFingerprint(s) {
  const { savedAt, syncSeq, ...rest } = s;
  return JSON.stringify(rest);
}

// Pushes go one at a time, in order, so an older push can never land after a newer one.
// The state is read when the push actually goes out, so it's always the latest.
function queuePush(force = false) {
  const mp = mpSession();
  if (!isOnlineMode() || !mp?.gameStarted) return Promise.resolve();
  mp.pushChain = (mp.pushChain || Promise.resolve()).then(async () => {
    if (!isOnlineMode()) return;
    const s = serializeState();
    if (typeof decorateOnlinePush === "function") decorateOnlinePush(s);
    const fp = pushFingerprint(s);
    if (!force && fp === mp.lastPushedFp) return;
    s.syncSeq = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    mp.lastPushedFp = fp;
    // Remember our own push so polling doesn't re-apply it
    mp.lastStateKey = stateKeyOf(s);
    _lastPushAt = Date.now();
    await apiFetch(`${API_BASE}/${mp.code}`, {
      method: "POST",
      body: { playerId: mp.myPlayerId, gameState: s }
    });
  }).catch((e) => console.warn("push failed:", e.message));
  return mp.pushChain;
}

// Called after every render: if we have the controls, push the change shortly.
function scheduleLiveSync() {
  const mp = mpSession();
  if (!isOnlineMode() || !mp?.gameStarted || !canActOnline() || _liveSyncTimer) return;
  const wait = Math.max(LIVE_SYNC_DELAY_MS, _lastPushAt + LIVE_SYNC_MIN_GAP_MS - Date.now());
  _liveSyncTimer = setTimeout(() => {
    _liveSyncTimer = null;
    if (!canActOnline()) return;
    // Wait out zombie movement animations so others see where the zombies end up
    if (state.zombieAnimationTimer) { scheduleLiveSync(); return; }
    queuePush(false);
  }, wait);
}

// syncToCloud — called from endTurn() (and the Cabin spell) once the turn has moved on
async function syncToCloud() {
  if (!isOnlineMode()) return;
  clearTimeout(_liveSyncTimer);
  _liveSyncTimer = null;
  await queuePush(true);
  if (!isMyTurn()) startPolling();
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

async function createMultiplayerGame() {
  const nameInput = document.getElementById("mpHostName");
  const displayName = nameInput?.value.trim();
  if (!displayName) { setLobbyStatus("Enter your display name first.", true); return; }

  const btn = document.getElementById("mpCreateBtn");
  if (btn) btn.disabled = true;
  setLobbyStatus("Creating game...");

  try {
    const deviceId = getOrCreateDeviceId();
    const { code, hostId } = await apiFetch(API_BASE, { method: "POST" });

    const { playerId } = await apiFetch(`${API_BASE}/${code}/join`, {
      method: "POST",
      body: { displayName, deviceId }
    });

    sessionStorage.setItem("vc_mp_code", code);
    sessionStorage.setItem("vc_mp_playerId", playerId);
    sessionStorage.setItem("vc_mp_hostId", hostId);

    state.multiplayerSession = {
      code, myPlayerId: playerId, myDeviceId: deviceId,
      myPlayerSlot: 0, isHost: true, hostId, mode: "online",
      pollInterval: null, gameStarted: false, lastStateKey: null, lastPlayerCount: null
    };

    showLobbySection();
    setLobbyStatus(`Share this link or code: ${code}`);
    renderLobbyPanel({ code, players: [{ id: playerId, name: displayName }] });
    startPolling();
  } catch (e) {
    setLobbyStatus(e.message || "Failed to create game.", true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------------

async function joinMultiplayerGame() {
  const codeInput = document.getElementById("mpJoinCode");
  const nameInput = document.getElementById("mpJoinName");
  const code = codeInput?.value.trim().toUpperCase();
  const displayName = nameInput?.value.trim();

  if (!code || code.length !== 4) { setLobbyStatus("Enter a 4-character game code.", true); return; }
  if (!displayName) { setLobbyStatus("Enter your name first.", true); return; }

  const btn = document.getElementById("mpJoinBtn");
  if (btn) btn.disabled = true;
  setLobbyStatus("Joining...");

  try {
    const deviceId = getOrCreateDeviceId();
    const { playerId, rejoined, status: joinStatus } = await apiFetch(`${API_BASE}/${code}/join`, {
      method: "POST",
      body: { displayName, deviceId }
    });

    sessionStorage.setItem("vc_mp_code", code);
    sessionStorage.setItem("vc_mp_playerId", playerId);

    const session = await apiFetch(`${API_BASE}/${code}`);
    const slot = session.players.findIndex((p) => p.id === playerId);

    state.multiplayerSession = {
      code, myPlayerId: playerId, myDeviceId: deviceId,
      myPlayerSlot: slot, isHost: false, hostId: null, mode: "online",
      pollInterval: null, gameStarted: false, lastStateKey: null, lastPlayerCount: null
    };

    // If the game is already playing (rejoining mid-game), skip the lobby
    // and go straight to polling for the current game state
    if (joinStatus === "playing" || session.status === "playing") {
      showLobbySection();
      setLobbyStatus("Rejoining game in progress...");
      startPolling();
      return;
    }

    showLobbySection();
    setLobbyStatus(rejoined ? "Rejoined! Waiting for host to start..." : "Joined! Waiting for host to start...");
    renderLobbyPanel(session);
    startPolling();
  } catch (e) {
    setLobbyStatus(e.data?.error || e.message || "Failed to join.", true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Start (host only)
// ---------------------------------------------------------------------------

async function startMultiplayerGame() {
  const mp = mpSession();
  if (!mp?.isHost) return;

  const btn = document.getElementById("mpStartBtn");
  if (btn) btn.disabled = true;
  setLobbyStatus("Starting...");

  try {
    const session = await apiFetch(`${API_BASE}/${mp.code}`);
    const lobbyPlayers = session.players;

    stopPolling();

    const pcInput = document.getElementById("playerCount");
    if (pcInput) pcInput.value = lobbyPlayers.length;

    state.gameActive = true;
    setupGame(lobbyPlayers.length, readCurrentFilters(), readCurrentEventFilters());

    lobbyPlayers.forEach((lp, i) => {
      if (state.players[i]) state.players[i].name = lp.name;
    });

    mp.myPlayerSlot = session.players.findIndex((p) => p.id === mp.myPlayerId);
    mp.lastPlayerCount = lobbyPlayers.length;

    const initialState = serializeState();
    mp.lastStateKey = stateKeyOf(initialState);
    mp.gameStarted = true;

    await apiFetch(`${API_BASE}/${mp.code}/start`, {
      method: "POST",
      body: { hostId: mp.hostId, gameState: initialState }
    });

    hideMpPanel();
    updateMpTurnBanner();
    render();
    // Switch to map and flash the tab — showMpTurnNotification handles both.
    // Always switch to map; only flash if it's actually our turn right now.
    if (typeof switchMobileTab === "function") switchMobileTab("map");
    if (isMyTurn()) showMpTurnNotification();
  } catch (e) {
    setLobbyStatus(e.message || "Failed to start game.", true);
    if (btn) btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

async function leaveMultiplayerGame() {
  const mp = mpSession();
  if (!mp) return;
  stopPolling();
  try {
    await apiFetch(`${API_BASE}/${mp.code}/leave`, {
      method: "POST",
      body: { playerId: mp.myPlayerId }
    });
  } catch { /* best-effort */ }
  state.multiplayerSession = null;
  state.gameActive = false;
  sessionStorage.removeItem("vc_mp_code");
  sessionStorage.removeItem("vc_mp_playerId");
  sessionStorage.removeItem("vc_mp_hostId");
  showSetupUI();
  showCreateJoinSection();
  document.getElementById("mpPanel")?.setAttribute("open", "");
  updateMpTurnBanner();
  render();
}

// ---------------------------------------------------------------------------
// Turn banner
// ---------------------------------------------------------------------------

function updateMpTurnBanner() {
  const r = mpRefs();
  const el = r.turnBanner;
  if (!el) return;
  const mp = mpSession();

  const mapBtn = r.mapTabBtn;

  if (!mp || !mp.gameStarted) {
    el.classList.add("hidden");
    if (mapBtn) mapBtn.classList.remove("mobile-tab-btn--mp-active");
    return;
  }
  el.classList.remove("hidden");
  if (isMyTurn()) {
    el.textContent = "Your turn";
    el.className = "mp-turn-banner mp-your-turn";
    if (mapBtn) mapBtn.classList.add("mobile-tab-btn--mp-active");
  } else {
    const cp = currentPlayer();
    el.textContent = `Waiting for ${cp?.name ?? "opponent"}...`;
    el.className = "mp-turn-banner mp-waiting";
    if (mapBtn) mapBtn.classList.remove("mobile-tab-btn--mp-active");
  }
}

// ---------------------------------------------------------------------------
// Turn notification — fires on the waiting device when its turn arrives
// ---------------------------------------------------------------------------

function showMpTurnNotification() {
  const playerName = currentPlayer()?.name ?? "You";

  // Flash the Map tab button first — must happen before switchMobileTab because
  // switchMobileTab calls syncMobilePanels which moves DOM nodes and triggers a
  // reflow, which would make the void-offsetWidth restart trick a no-op.
  const mapTabBtn = mpRefs().mapTabBtn;
  if (mapTabBtn) {
    mapTabBtn.classList.remove("mobile-tab-btn--your-turn");
    void mapTabBtn.offsetWidth; // force reflow so the animation restarts cleanly
    mapTabBtn.classList.add("mobile-tab-btn--your-turn");
    // 5 iterations × 0.55 s = 2.75 s; remove class after so active styling is unaffected
    setTimeout(() => mapTabBtn.classList.remove("mobile-tab-btn--your-turn"), 2800);
  }

  // Switch to the map tab after the flash class is committed
  if (typeof switchMobileTab === "function") switchMobileTab("map");

  // Browser Notification (works even if the tab is in the background)
  if ("Notification" in window) {
    const fire = () => new Notification("Your turn!", {
      body: `${playerName}, it's your turn in Zombie Dice.`,
      icon: "favicon.ico"
    });
    if (Notification.permission === "granted") {
      fire();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => { if (perm === "granted") fire(); });
    }
  }

  // Toast (visible on any screen size for multiplayer turns)
  const el = mpRefs().mobileToast;
  if (el) {
    el.textContent = "Your turn!";
    el.classList.add("mobile-toast--visible");
    setTimeout(() => el.classList.remove("mobile-toast--visible"), 5000);
  }
}

// ---------------------------------------------------------------------------
// Auto-detect invite link on page load
// ---------------------------------------------------------------------------

function hideSetupUI() {
  document.getElementById("setupSection")?.classList.add("hidden");
  document.getElementById("newGameBtn").style.display = "none";
}

function showSetupUI() {
  document.getElementById("setupSection")?.classList.remove("hidden");
  document.getElementById("newGameBtn").style.display = "";
}

function tryAutoRejoin() {
  const urlCode = new URLSearchParams(location.search).get("game")?.toUpperCase();
  const savedCode = sessionStorage.getItem("vc_mp_code");
  const code = urlCode || savedCode;
  if (!code) return;

  // Open the MP panel
  const panel = document.getElementById("mpPanel");
  if (panel) panel.setAttribute("open", "");

  // If this is an invite link, hide the local game setup entirely and show invite note
  if (urlCode) {
    hideSetupUI();
    document.getElementById("mpCreateSection")?.classList.add("hidden");
    const note = document.getElementById("mpInviteNote");
    if (note) {
      note.textContent = `You've been invited to game ${urlCode}. Enter your name to join.`;
      note.classList.remove("hidden");
    }
    // Hide the code input row — code is already known from URL
    document.getElementById("mpJoinCodeRow")?.classList.add("hidden");
  }

  // Pre-fill code and focus name
  const codeInput = document.getElementById("mpJoinCode");
  if (codeInput) codeInput.value = code;
  document.getElementById("mpJoinName")?.focus();
}
