#!/usr/bin/env node
// IC Zombies, BBS edition: an ASCII / ANSI front end that runs the same game code as the
// web version (loaded by engine.js), for play in a terminal or as a Synchronet BBS door.
//
//   node bbs/door.js                  BBS mode: CP437 characters, opens on the new-game screen
//   node bbs/door.js --utf8           try it in a normal terminal (VS Code, Windows Terminal)
//   node bbs/door.js --players 2      start the new-game screen at 2 players (hot-seat)
//   node bbs/door.js --new            skip the new-game screen (Director's Cut, no variants)
//   node bbs/door.js --name Digable   name player 1 (on the BBS this comes from DOOR32.SYS)
//   node bbs/door.js --savedir DIR    where saved games go (see saves.js)
//
// Synchronet runs it as an external program with standard input/output (see bbs/README.md).

"use strict";

const fs = require("fs");
const path = require("path");
const { loadEngine } = require("./engine");
const { buildScreen, buildHelp, buildMenu, buildPrompt, wrap, num, C } = require("./screen");
const ansi = require("./ansi");
const saves = require("./saves");

// ---- options ---------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name) => args.includes(`--${name}`);
const val = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const UTF8 = opt("utf8");

// The BBS user's name: --name, else DOOR32.SYS (line 7 = alias, line 6 = real name).
// Synchronet writes DOOR32.SYS to the node directory and tells doors where that is in $SBBSNODE.
function bbsUserName() {
  if (val("name")) return val("name");
  const candidates = [val("dropfile")];
  if (process.env.SBBSNODE) {
    candidates.push(path.join(process.env.SBBSNODE, "door32.sys"), path.join(process.env.SBBSNODE, "DOOR32.SYS"));
  }
  for (const file of candidates.filter(Boolean)) {
    try {
      const lines = fs.readFileSync(file, "latin1").split(/\r?\n/).map((l) => l.trim());
      const name = lines[6] || lines[5];
      if (name) return name.replace(/[^\x20-\x7e]/g, "").slice(0, 20);
    } catch { /* not there; try the next one */ }
  }
  return null;
}

// ---- game ------------------------------------------------------------------
let drawQueued = false;
const game = loadEngine({ onRender: () => scheduleDraw() });
const call = (name, ...a) => game.call(name, ...a);
const state = game.get("state");
const STEP = game.get("STEP");
const TILE_DECK = game.get("TILE_DECK");
const MAX_PLAYERS = game.get("MAX_PLAYERS");
const COLLECTIONS = game.get("COLLECTIONS");
const COLLECTION_META = game.get("COLLECTION_META");
const CARD_TYPE = game.get("CARD_TYPE");
const TILE_DIM = game.get("TILE_DIM");

const userName = bbsUserName();
const SAVE_DIR = saves.saveDir(val("savedir"));

// ---- door state (only the screen; the game's own state lives in `state`) ------
let phase = "menu";       // locked | resume | confirmNew | menu | game
let mode = "play";        // play | look | card | items | help | deck
let selected = null;      // { from: "hand" | "items" | "pages", index }
let cursor = null;        // look mode: board space under the cursor
let pick = null;          // picking a space for a card: { kind, x, y }
let quitArmed = false;
let notice = "";
let autoSteps = true;     // draw cards and move zombies automatically
let lastSaveSig = "";

const me = () => state.players[state.currentPlayerIndex];
const seg = (t, fg = C.grey, bg = C.black) => [t, fg, bg];

// ---- new-game screen -------------------------------------------------------------
const WIP = new Set([COLLECTIONS.SEND_IN_THE_CLOWNS]);
const mapCounts = call("getMapTileCountsByCollection");
const eventCounts = call("getEventCardCountsByCollection");
const menu = {
  players: Math.max(1, Math.min(MAX_PLAYERS, parseInt(val("players", "1"), 10) || 1)),
  on: new Set([COLLECTIONS.DIRECTORS_CUT]),
  guts: false, sewer: false, dodge: false,
  notice: ""
};
const collKeys = Object.keys(COLLECTION_META).filter((k) => mapCounts[k] || eventCounts[k]);
const letterOf = (i) => "abcdefghijklmn"[i];
const VARIANTS = [
  ["x", "guts", "Guts tokens: hand size = guts, gain/lose them on a natural 6/1 (Z5)"],
  ["y", "sewer", "Sewer tokens: drop tokens on roads and travel underground (Z6)"],
  ["z", "dodge", "Dodge: rolling a 3 in a fight dodges the zombie (Z8)"]
];

function playerNames(n) {
  return Array.from({ length: n }, (_, i) => (i === 0 && userName) ? userName : `Shotgun Guy ${i + 1}`);
}

function savedGameInfo() {
  const s = saves.readSave(SAVE_DIR, userName);
  if (!s || !s.game) return null;
  return `turn ${s.game.turnNumber}, ${s.game.players.length} player${s.game.players.length > 1 ? "s" : ""}`;
}

// The "you have a game going" screen shown when a player with a save comes back.
function resumeScreen() {
  const s = saves.readSave(SAVE_DIR, userName);
  const g = s && s.game;
  if (!g) { phase = "menu"; return buildMenu(menuModel()); }
  const colls = Object.keys(g.deckFilters || {}).filter((k) => g.deckFilters[k] && g.deckFilters[k].enabled)
    .map((k) => (COLLECTION_META[k] && COLLECTION_META[k].shortCode) || k);
  const when = g.savedAt ? new Date(g.savedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
  const whose = g.players[g.currentPlayerIndex];
  const lines = [
    ["You have a game in progress.", C.white],
    [""],
    [`Turn ${g.turnNumber}${whose ? `, ${whose.name}'s turn` : ""}`, C.yellow],
    [`Players: ${g.players.map((pl) => `${pl.name} (${pl.kills} kills)`).join(", ")}`],
    [`Collections: ${colls.join(" ") || "-"}`],
    when ? [`Saved ${when}, at the start of that turn.`, C.dgrey] : [""]
  ];
  if (phase === "confirmNew") {
    return buildPrompt({
      title: "start over?",
      lines: [["Starting a new game deletes this saved one.", C.bred], ["You can only have one game going at a time."], [""], ...lines.slice(2)],
      keys: [["y", "yes, delete it and set up a new game"], ["any other key", "go back"]]
    });
  }
  return buildPrompt({ title: "welcome back", lines, keys: [["c", "continue this game"], ["n", "start a new game instead"], ["q", "quit"]] });
}

function menuModel() {
  return {
    players: menu.players,
    names: playerNames(menu.players),
    rows: collKeys.map((k, i) => {
      const m = COLLECTION_META[k];
      const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
      const what = [mapCounts[k] && plural(mapCounts[k], "tile"), eventCounts[k] && plural(eventCounts[k], "card")].filter(Boolean).join(", ");
      return { letter: letterOf(i), label: m.label, code: m.shortCode || "", on: menu.on.has(k), wip: WIP.has(k), what };
    }),
    variants: VARIANTS.map(([letter, k, label]) => ({ letter, label, on: menu[k] })),
    save: savedGameInfo(),
    notice: menu.notice
  };
}

// Same rules the web setup screen follows when boxes are ticked.
function toggleCollection(k) {
  if (WIP.has(k)) { menu.notice = `${COLLECTION_META[k].label} is coming soon.`; return; }
  if (menu.on.has(k)) menu.on.delete(k); else menu.on.add(k);
  const z1 = COLLECTIONS.DIRECTORS_CUT;
  const meta = COLLECTION_META[k];
  if (menu.on.has(k) && meta.requiresBase && !menu.on.has(meta.requiresBase)) {
    menu.on.add(meta.requiresBase);
    menu.notice = `${meta.label} needs ${COLLECTION_META[meta.requiresBase].label}, so that's on too.`;
  }
  const expansions = [...menu.on].filter((c) => c !== z1 && COLLECTION_META[c].compatibleWith);
  if (expansions.length >= 2 && !menu.on.has(z1)) {
    menu.on.add(z1);
    menu.notice = "Mixing expansions goes through Director's Cut, so it's on too.";
  }
  // Removing the base removes anything that needs it.
  if (!menu.on.has(z1)) {
    [...menu.on].filter((c) => COLLECTION_META[c].requiresBase === z1).forEach((c) => menu.on.delete(c));
  }
  if (menu.on.has(k)) {
    if (k === COLLECTIONS.SCHOOLS_OUT_FOREVER) menu.guts = true;
    if (k === COLLECTIONS.SIX_FEET_UNDER) menu.sewer = true;
    if (k === COLLECTIONS.JAILBREAK) menu.dodge = true;
  }
}

function filtersFor(counts) {
  const f = {};
  collKeys.forEach((k) => { if (counts[k]) f[k] = { enabled: menu.on.has(k) }; });
  return f;
}

function resetDoor() {
  mode = "play"; selected = null; cursor = null; pick = null; doorSpot = null;
  quitArmed = false; notice = ""; lastSaveSig = "";
}

function namePlayerOne() {
  if (!userName || !state.players[0]) return;
  const old = state.players[0].name;
  if (old === userName) return;
  state.players[0].name = userName;
  state.logs.forEach((l) => { l.text = l.text.split(old).join(userName); });
}

const PENDING_KEYS = Object.keys(state).filter((k) => k.startsWith("pending") && k !== "pendingRotation" && k !== "pendingTileOptions" && k !== "pendingCompanionTiles" && k !== "pendingTileDeck");

function startNewGame() {
  if (!menu.on.size || !collKeys.some((k) => menu.on.has(k) && mapCounts[k])) {
    menu.notice = "Pick at least one collection with map tiles.";
    return;
  }
  if (state.zombieAnimationTimer) { clearTimeout(state.zombieAnimationTimer); state.zombieAnimationTimer = null; }
  PENDING_KEYS.forEach((k) => { state[k] = null; });
  state.useGuts = menu.guts;
  state.useSewerTokens = menu.sewer;
  state.useDodge = menu.dodge;
  call("setupGame", menu.players, filtersFor(mapCounts), filtersFor(eventCounts));
  state.gameActive = true;
  namePlayerOne();
  resetDoor();
  phase = "game";
  autoSave();
}

function continueSavedGame() {
  const s = saves.readSave(SAVE_DIR, userName);
  if (!s || !s.game) { menu.notice = "No saved game found."; return; }
  try {
    // Parse inside the game's own sandbox so its arrays and objects are native there.
    call("deserializeState", game.get("JSON").parse(JSON.stringify(s.game)));
    state.useDodge = !!(s.door && s.door.useDodge);
    state.gameActive = true;
    namePlayerOne();
    resetDoor();
    lastSaveSig = saveSig();
    phase = "game";
    autoSteps = true;
    call("logLine", `Welcome back, ${me().name}. Game loaded.`, "quiet");
  } catch (e) {
    menu.notice = `That save couldn't be loaded (${e.message}).`;
    phase = "menu";
  }
}

// ---- saving --------------------------------------------------------------------
// The game is saved at the start of every turn (each player's turn in hot-seat), before
// anything has happened in it. If the connection drops or the player quits mid-turn, they
// come back to the start of that turn. Each user has one save: one game at a time.
const saveSig = () => `${state.turnNumber}|${state.currentPlayerIndex}`;
const atTurnStart = () => phase === "game" && state.players.length && state.step === STEP.DRAW_TILE && !state.pendingTile &&
  !call("hasPendingState") && !state.pendingDuctChoice && !state.pendingSewerTokenPlace && !state.pendingFrisbeeTarget &&
  !state.zombieAnimationTimer;

function autoSave() {
  if (phase !== "game") return false;
  if (state.gameOver) { saves.removeSave(SAVE_DIR, userName); return false; }
  if (!atTurnStart()) return false;
  const sig = saveSig();
  if (sig === lastSaveSig) return false;
  lastSaveSig = sig;
  return saves.writeSave(SAVE_DIR, userName, { door: { useDodge: !!state.useDodge }, game: call("serializeState") });
}

// ---- choosing where a drawn tile goes ------------------------------------------
// Spots come from the game (state.pendingTileOptions); like the web version, the spots on
// offer depend on the tile's current rotation. doorSpot is the one the player has picked.
let doorSpot = null;
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

function spotsNow() {
  return (state.pendingTileOptions || []).filter((o) => o.rotation === state.pendingRotation);
}

function currentSpot() {
  const spots = spotsNow();
  if (!spots.length) return null;
  if (!doorSpot || !spots.some((o) => o.x === doorSpot.x && o.y === doorSpot.y)) {
    const p = me();
    const from = doorSpot || { x: Math.floor(p.x / 3), y: Math.floor(p.y / 3) };
    doorSpot = spots.reduce((best, o) =>
      Math.abs(o.x - from.x) + Math.abs(o.y - from.y) < Math.abs(best.x - from.x) + Math.abs(best.y - from.y) ? o : best);
  }
  return doorSpot;
}

// Step from one point to the nearest candidate in a direction (used for tile spots and picks).
function nearestInDir(cur, list, dir) {
  const [dx, dy] = DIRS[dir];
  let best = null, bestScore = Infinity;
  for (const o of list) {
    const ax = o.x - cur.x, ay = o.y - cur.y;
    const along = ax * dx + ay * dy;
    if (along <= 0) continue;
    const score = along + Math.abs(dx ? ay : ax) * 2;
    if (score < bestScore) { best = o; bestScore = score; }
  }
  return best;
}

function pickSpot(dir) {
  const cur = currentSpot();
  if (!cur) return;
  const best = nearestInDir(cur, spotsNow(), dir);
  if (best) doorSpot = best;
}

function cycleSpot(step) {
  const spots = spotsNow();
  const cur = currentSpot();
  if (!cur) return;
  const i = spots.findIndex((o) => o.x === cur.x && o.y === cur.y);
  doorSpot = spots[(i + step + spots.length) % spots.length];
}

// ---- which decks a tile can come from --------------------------------------------
// Expansions played alongside Director's Cut get their own deck once their gateway tile is out.
function tileDecks() {
  const out = [];
  if (state.mapDeck && state.mapDeck.length) out.push([TILE_DECK.BASE, "Map deck", state.mapDeck.length]);
  Object.keys(state.standaloneDecks || {}).forEach((k) => {
    const deck = state.standaloneDecks[k];
    if (state.activeStandaloneDecks.has(k) && deck && deck.length) out.push([k, `${COLLECTION_META[k]?.label || k} deck`, deck.length]);
  });
  return out;
}

function drawTile() {
  const decks = tileDecks();
  if (!decks.length) { notice = "no tiles left to draw"; return; }
  if (decks.length > 1) { mode = "deck"; return; }
  doorSpot = null;
  call("drawAndPlaceTile", decks[0][0]);
}
function placeTile() {
  const spot = currentSpot();
  if (spot) call("placePendingTileAt", spot.x, spot.y);
  doorSpot = null;
}
function moveZombies() {
  call("startZombieMovement");
  if (state.pendingZombieMovement && autoSteps) call("flushZombieMovement");
}
function keepHand() { state.selectedHandIndex = null; call("discardSelected"); }

// ---- picking a space on the board (cards like Dynamite, Rocket Launcher...) -------
function boardSpaces() {
  const out = [];
  state.board.forEach((tile, tk) => {
    const [tx, ty] = tk.split(",").map(Number);
    for (let ly = 0; ly < TILE_DIM; ly++) {
      for (let lx = 0; lx < TILE_DIM; lx++) {
        const x = tx * TILE_DIM + lx, y = ty * TILE_DIM + ly;
        out.push({ x, y, k: `${x},${y}`, tx, ty, tk, lx, ly, tile });
      }
    }
  });
  return out;
}

const sub = (s) => call("getSubTileType", s.tile, s.lx, s.ly);
const walk = (s) => call("isLocalWalkable", s.tile, s.lx, s.ly);
const zombieAt = (s) => state.zombies.has(s.k);
const targetsWhere = (fn) => new Set(boardSpaces().filter(fn).map((s) => s.k));

// The space-picking job right now, if any: what it's for, which spaces count, and what
// Enter and "x" do. Checked in the same order the web board routes clicks.
function pickNow() {
  const s = state;
  if (s.pendingRocketLauncher) return {
    kind: "rocket", title: "Rocket Launcher",
    help: "Pick any space on a green edge tile to blow the whole tile up (not the Helipad).",
    targets: targetsWhere((sp) => sp.tile.type !== "helipad" && call("isBoardEdgeTile", sp.tx, sp.ty)),
    pick: (x, y) => call("handleRocketLauncherClick", x, y), done: ["cancel", () => call("finishRocketLauncher")]
  };
  if (s.pendingZombieFlood) return {
    kind: "flood", title: s.pendingZombieFlood.cardName || "Zombie Flood",
    help: "Pick a tile to flood with zombies; every empty green space gets one.",
    targets: targetsWhere((sp) => !(s.noZombieTiles && s.noZombieTiles.has(sp.tk)) && !zombieAt(sp) && call("isSubtileZombieViable", sp.tile, sp.lx, sp.ly)),
    pick: (x, y) => call("handleZombieFloodClick", x, y), done: ["cancel", () => call("finishZombieFlood")]
  };
  if (s.pendingSpaceSelect) {
    const pss = s.pendingSpaceSelect;
    const valid = pss.validSpaces || call("getSpacesAdjoiningBuilding");
    return {
      kind: "space", title: pss.cardName || "Pick a space",
      help: pss.promptText || "Pick a green space next to a building or store to move there.",
      targets: targetsWhere((sp) => walk(sp) && valid.has(sp.k)),
      pick: (x, y) => call("handleSpaceSelectClick", x, y), done: ["cancel", () => call("finishSpaceSelect")]
    };
  }
  if (s.pendingMinefield) return {
    kind: "mines", title: `Mine Field (roll ${s.pendingMinefield.remaining})`,
    help: `Pick a tile: up to ${s.pendingMinefield.remaining} zombie(s) on its roads are destroyed.`,
    targets: targetsWhere((sp) => zombieAt(sp) && sub(sp) === "road"),
    pick: (x, y) => call("handleMinefieldClick", x, y), done: ["skip it", () => call("finishMinefield")]
  };
  if (s.pendingDynamiteTarget) {
    const p = call("getPlayerById", s.pendingDynamiteTarget.playerId) || me();
    return {
      kind: "dynamite", title: `Dynamite (${s.pendingDynamiteTarget.remaining} to go)`,
      help: "Pick a zombie next to you (diagonals count) to blow it up.",
      targets: targetsWhere((sp) => zombieAt(sp) && Math.abs(sp.x - p.x) <= 1 && Math.abs(sp.y - p.y) <= 1 && !(sp.x === p.x && sp.y === p.y)),
      pick: (x, y) => call("handleDynamiteTargetClick", x, y), done: ["done", () => call("finishDynamite")]
    };
  }
  if (s.pendingFrisbeeTarget) return {
    kind: "frisbee", title: "Frisbee",
    help: "Pick a green zombie (within 2 tiles) to take it out.",
    targets: targetsWhere((sp) => zombieAt(sp) && s.pendingFrisbeeTarget.validSpaces.has(sp.k)),
    pick: (x, y) => call("handleFrisbeeTargetClick", x, y), done: ["cancel", () => call("finishFrisbee")]
  };
  if (s.pendingSewerTokenPlace) return {
    kind: "sewer", title: `Sewer token (${me().sewerTokensAvailable} left)`,
    help: "Pick a road space for your sewer token.",
    targets: targetsWhere((sp) => sub(sp) === "road" && !s.sewerTokenSpaces.has(sp.k)),
    pick: (x, y) => call("placeSewerToken", x, y),
    done: ["cancel", () => { s.pendingSewerTokenPlace = null; call("logLine", "Sewer token placement cancelled."); }]
  };
  if (s.pendingBuildingSelect) return {
    kind: "building", title: s.pendingBuildingSelect.cardName,
    help: "Pick a space inside a building to fill it with zombies.",
    targets: targetsWhere((sp) => sub(sp) === "building" && walk(sp)),
    pick: (x, y) => call("handleBuildingSelectClick", x, y), done: null
  };
  if (s.pendingZombiePlace) {
    const pzp = s.pendingZombiePlace;
    return {
      kind: "zplace", title: `${pzp.cardName || "We're Screwed"}: place ${pzp.remaining}`,
      help: `Pick an empty green space to put a zombie there (${pzp.remaining} to go).`,
      targets: targetsWhere((sp) => walk(sp) && !zombieAt(sp) && call("isSubtileZombieViable", sp.tile, sp.lx, sp.ly) &&
        !s.players.some((p) => p.x === sp.x && p.y === sp.y) && (!pzp.validSpaces || pzp.validSpaces.has(sp.k))),
      pick: (x, y) => call("handleZombiePlaceClick", x, y), done: ["done", () => call("finishZombiePlace")]
    };
  }
  if (s.pendingZombieReplace) {
    const pzr = s.pendingZombieReplace;
    const sel = pzr.selectedZombieKey;
    let adj = null;
    if (pzr.adjacentToKey) { const [ax, ay] = pzr.adjacentToKey.split(",").map(Number); adj = { x: ax, y: ay }; }
    return {
      kind: "zreplace", title: `${pzr.cardName || "This Isn't So Bad"}: move ${pzr.remaining}`,
      help: sel ? "Now pick an empty green space to move that zombie to." + (pzr.adjacentToKey ? "" : " (Pick it again to change your mind.)")
        : "Pick a zombie to move.",
      targets: sel
        ? targetsWhere((sp) => walk(sp) && !zombieAt(sp) && (!adj || Math.abs(sp.x - adj.x) + Math.abs(sp.y - adj.y) === 1))
        : targetsWhere(zombieAt),
      selected: sel,
      pick: (x, y) => call("handleZombieReplaceClick", x, y), done: ["done", () => call("finishZombieReplace")]
    };
  }
  if (s.pendingZombieMovement && !autoSteps && !s.zombieAnimationTimer && !busyPanel()) {
    const pzm = s.pendingZombieMovement;
    return {
      kind: "zmove", title: `Zombies: ${pzm.remaining} move(s) left`,
      help: "Pick a zombie to move it toward the nearest player. Space moves the rest.",
      targets: targetsWhere((sp) => zombieAt(sp) && call("isAvailableForMove", pzm, sp.k)),
      pick: (x, y) => call("manualMoveZombie", `${x},${y}`), done: ["move the rest", () => call("flushZombieMovement")]
    };
  }
  return null;
}

// Keep the pick cursor on something sensible: start on the nearest target to the player.
function pickCursor(spec) {
  if (!pick || pick.kind !== spec.kind) {
    const p = me();
    const list = [...spec.targets].map((k) => { const [x, y] = k.split(",").map(Number); return { x, y }; });
    const start = list.length
      ? list.reduce((b, o) => (Math.abs(o.x - p.x) + Math.abs(o.y - p.y) < Math.abs(b.x - p.x) + Math.abs(b.y - p.y) ? o : b))
      : { x: p.x, y: p.y };
    pick = { kind: spec.kind, x: start.x, y: start.y };
  }
  return pick;
}

function cycleTarget(spec, step) {
  const cur = pickCursor(spec);
  const list = [...spec.targets].map((k) => { const [x, y] = k.split(",").map(Number); return { x, y }; })
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!list.length) return;
  let i = list.findIndex((o) => o.x === cur.x && o.y === cur.y);
  if (i < 0) i = step > 0 ? -1 : 0;
  const o = list[(i + step + list.length) % list.length];
  pick.x = o.x; pick.y = o.y;
}

// ---- what's waiting on the player ---------------------------------------------
const busyPanel = () => state.gameOver || state.pendingEventChoice || state.pendingCombatDecision ||
  state.pendingZombieDiceChallenge || state.pendingDuctChoice;
const busy = () => busyPanel() || !!pickNow() || state.pendingForcedMove;

// What Space does right now: [label, action], or null.
function nextAction() {
  if (state.pendingZombieMovement && !busyPanel() && !state.zombieAnimationTimer) return ["move the zombies", () => call("flushZombieMovement")];
  if (busy() || state.pendingZombieMovement) return null;
  switch (state.step) {
    case STEP.DRAW_TILE: return state.pendingTile ? ["place the tile here", placeTile] : ["draw a map tile", drawTile];
    case STEP.COMBAT: return ["fight the zombie", () => call("resolveCombatOnCurrentTile")];
    case STEP.DRAW_EVENTS: return ["draw event cards", () => call("drawEventsToThree")];
    case STEP.ROLL_MOVE: return [me().pendingDuctTeleport ? "take the air duct" : "roll to move", () => call("rollMovement")];
    case STEP.MOVE_ZOMBIES: return ["move the zombies", moveZombies];
    case STEP.DISCARD: return ["keep your hand", keepHand];
    case STEP.END: return ["end your turn", () => call("endTurn")];
    default: return null;
  }
}

// Steps with nothing to decide happen on their own (toggle with "a").
function autoAdvance() {
  if (phase !== "game" || !autoSteps || mode !== "play" || busy() || state.zombieAnimationTimer) return;
  if (state.pendingZombieMovement) call("flushZombieMovement");
  else if (state.step === STEP.DRAW_EVENTS) call("drawEventsToThree");
  else if (state.step === STEP.MOVE_ZOMBIES) moveZombies();
}

// Sewer tokens (Z6 variant): which actions are open right now.
function sewerActions() {
  if (!state.useSewerTokens || state.gameOver) return {};
  const p = me();
  const moving = state.step === STEP.ROLL_MOVE || state.step === STEP.MOVE;
  return {
    place: moving && p.sewerTokensAvailable > 0 && !busy(),
    toggle: p.inSewer || (moving && state.sewerTokenSpaces.has(`${p.x},${p.y}`))
  };
}

function toggleSewer() {
  const p = me();
  const k = `${p.x},${p.y}`;
  if (state.blockedSewerSpaces && state.blockedSewerSpaces.has(k)) {
    call("logLine", "This sewer space is blocked (Oh... That's New!) — cannot enter or exit here.");
    return;
  }
  p.inSewer = !p.inSewer;
  call("logLine", p.inSewer ? `${p.name} drops into the sewer.` : `${p.name} climbs out of the sewer.`);
}

const canCastSpell = () => !state.gameOver && state.step === STEP.END && call("isZ4Active") && call("canAttemptSpell", me()) && !busy();

// ---- panels (pop-up boxes over the map) -----------------------------------------
function combatPanel() {
  const pd = state.pendingCombatDecision;
  const p = call("getPlayerById", pd.playerId) || me();
  const WIN = pd.killRoll, roll = pd.modifiedRoll;
  const what = pd.isDog ? "zombie dog" : pd.isEnhanced ? "government-enhanced zombie" : "zombie";
  const jammed = state.weaponsJammedCount > 0, frozen = state.bulletsCombatFrozenCount > 0;
  const pillow = state.pillowFightCount > 0;
  const halfCredit = pd.halfBulletCredit || 0;
  const need = pillow ? Math.max(0, (WIN - roll) * 2 - halfCredit) : Math.max(0, WIN - roll);
  const canWinWithBullets = need > 0 && p.bullets >= need && !jammed && !frozen;
  const lines = [
    [seg("You rolled "), seg(String(pd.roll), C.white), seg(`  + attack ${pd.permanentBonus}  + bonus ${pd.tempBonus}  = `), seg(String(roll), C.yellow)],
    [seg("To kill the " + what + " you need "), seg(`${WIN}+`, C.yellow), seg(`.  Short by ${need}.`)],
    [seg("You have "), seg(`■ ${p.bullets} bullets`, C.yellow), seg("  and  "), seg(`♥ ${num(p.hearts)} hearts`, C.bred)],
    []
  ];
  const opts = [];
  const add = (key, label, hint, ok, good) => {
    opts.push({ key, ok });
    lines.push([seg(` ${key} `, ok ? C.black : C.dgrey, ok ? (good ? C.green : C.brown) : C.black), seg(` ${label}`, ok ? C.white : C.dgrey), seg(hint ? `  ${hint}` : "", good ? C.bgreen : C.dgrey)]);
  };
  const bulletOk = p.bullets > 0 && !jammed && !frozen;
  const bulletHint = jammed ? "weapons jammed" : frozen ? "No Guts, No Glory" : !p.bullets ? "no bullets"
    : roll + (pillow ? (halfCredit >= 1 ? 1 : 0) : 1) >= WIN ? "kills it!"
    : canWinWithBullets ? `${need} bullets would win` : "not enough to win";
  add("b", `spend a bullet (+${pillow ? "½" : "1"})`, bulletHint, bulletOk, bulletOk && (canWinWithBullets || bulletHint === "kills it!"));
  if (pd.isDog) add("h", "spend ½ heart: reroll", `${p.hearts * 2} half-hearts`, p.hearts >= 0.5, false);
  else add("h", "spend a heart: reroll", p.hearts === 1 ? "your LAST heart" : p.hearts >= 1 ? `${num(p.hearts - 1)} left after` : p.hearts > 0 ? "only ½ left" : "no hearts", p.hearts > 0, false);
  if (p.items.some((c) => c.name === "First Aid Kit")) add("f", "First Aid Kit: free reroll", "costs nothing", true, true);
  if (p.hand.some((c) => c.name === "Lucky Shot")) add("k", "Lucky Shot: 1 bullet, auto-kill", "kills it!", bulletOk, bulletOk);
  p.items.filter((c) => c.combatWeapon).forEach((c, i) => {
    const boost = c.combatBoost || c.turnCombatBoost || c.permanentAttackBoost || c.oncePerTurnCombatBoost || 0;
    const used = c.oncePerTurnCombatBoost ? (p.itemsUsedThisTurn || []).includes(c.name) : pd.weaponUsed;
    add(String(i + 1), `${c.name} (+${boost})`, roll + boost >= WIN ? "kills it!" : `total ${roll + boost}`, !jammed && !used, roll + boost >= WIN);
  });
  add("l", "lose the fight", pd.isDog ? "lose ½ heart, dog stays" : "respawn, lose ½ your kills", true, false);
  return { title: `FIGHT: ${p.name} vs ${what}`, lines, opts };
}

function eventChoicePanel() {
  const ec = state.pendingEventChoice;
  const lines = [];
  const chooser = call("getPlayerById", ec.playerId);
  if (chooser && state.players.length > 1) lines.push([seg(`${chooser.name} chooses`, C.bcyan)]);
  if (ec.description) wrap(ec.description, 44).forEach((t) => lines.push([seg(t)]));
  if (lines.length) lines.push([]);
  ec.options.slice(0, 9).forEach((o, i) => {
    lines.push([seg(` ${i + 1} `, C.black, C.brown), seg(` ${o.label}`, C.white)]);
  });
  return { title: ec.title || (ec.cardName ? `Card: ${ec.cardName}` : "Choose"), lines };
}

// Zombie Dice Challenge: two dice, each 3 or less fails; bullets add 1, hearts reroll.
function diceChallengePanel() {
  const pz = state.pendingZombieDiceChallenge;
  const t = call("getPlayerById", pz.targetPlayerId) || me();
  const failing = pz.dice.filter((d) => d <= 3).length;
  const lines = [
    [seg(`${t.name}, your dice: `), ...pz.dice.map((d) => seg(` ${d} `, C.black, d <= 3 ? C.red : C.green)).flatMap((x) => [x, seg(" ")])],
    failing ? [seg(`${failing} die(dice) at 3 or less: you'd lose kills.`, C.bred)] : [seg("Both above 3: you lose nothing.", C.bgreen)],
    [seg("You have "), seg(`■ ${t.bullets}`, C.yellow), seg(" and "), seg(`♥ ${num(t.hearts)}`, C.bred)],
    []
  ];
  const opt = (key, label, ok) => lines.push([seg(` ${key} `, ok ? C.black : C.dgrey, ok ? C.brown : C.black), seg(` ${label}`, ok ? C.white : C.dgrey)]);
  [0, 1].forEach((i) => opt(String(i + 1), `bullet: die ${i + 1} ${pz.dice[i]} → ${pz.dice[i] + 1}`, t.bullets > 0 && pz.dice[i] < 4));
  [0, 1].forEach((i) => opt(String(i + 3), `heart: reroll die ${i + 1} (${pz.dice[i]})`, t.hearts > 0 && pz.dice[i] < 4));
  opt("Enter", "accept the result", true);
  return { title: "Zombie Dice Challenge", lines };
}

function ductPanel() {
  const pdc = state.pendingDuctChoice;
  const lines = [[seg("Using the duct costs your next movement roll.")], [seg("Pick a store to come out in, or stay here.")], []];
  pdc.destinations.slice(0, 9).forEach((d, i) => lines.push([seg(` ${i + 1} `, C.black, C.brown), seg(` ${d.tileName}`, C.white)]));
  lines.push([seg(" s ", C.black, C.brown), seg(" stay here", C.white)]);
  return { title: "Air Duct", lines };
}

function deckPanel() {
  const lines = [[seg("Which deck do you draw from?")], []];
  tileDecks().forEach(([, label, n], i) => lines.push([seg(` ${i + 1} `, C.black, C.brown), seg(` ${label}`, C.white), seg(`  ${n} left`, C.dgrey)]));
  lines.push([], [seg(" Esc ", C.black, C.grey), seg(" back", C.grey)]);
  return { title: "Draw a tile", lines };
}

// Why a card in hand can't be played right now ("" if it can). Same checks as the web hand.
function whyNotPlayable(card) {
  const p = me();
  const isPage = card.cardType === CARD_TYPE.BOTD_PAGE;
  if (state.gameOver) return "the game is over";
  if (busy()) return "finish what's on screen first";
  if (p.eventUsedThisRound) return "you've already played a card this turn";
  if (p.cannotPlayCardTurns > 0) return "you can't play cards this turn";
  if (p.cardPlayFrozenUntilKill) return "no cards until you kill a zombie";
  if (isPage) return "";
  if (!card.isItem && typeof card.apply !== "function") return "it's offered in the fight box";
  if (card.canPlay && !card.canPlay()) return "can't be played right now";
  if (card.isItem && p.items.some((c) => c.name === card.name)) return "you already have one out";
  if (card.isItem && card.requiresTile) {
    const tile = state.board.get(call("getSpaceTileKey", p.x, p.y));
    const allowed = [].concat(card.requiresTile);
    if (!tile || !allowed.includes(tile.name)) return `only on the ${allowed.join(" or ")}`;
  }
  return "";
}

function cardPanel() {
  const p = me();
  const list = selected.from === "items" ? p.items : selected.from === "pages" ? p.botdPages : p.hand;
  const card = list[selected.index];
  if (!card) { mode = "play"; selected = null; return null; }
  const isPage = card.cardType === CARD_TYPE.BOTD_PAGE;
  const tags = [isPage && "Book of the Dead page", card.isItem && "item", card.isWeapon && "weapon", card.combatWeapon && "use in a fight"].filter(Boolean);
  const lines = [];
  if (tags.length) lines.push([seg(tags.join(" · "), C.bcyan)]);
  wrap(card.description || "(no description)", 44).forEach((t) => lines.push([seg(t, C.white)]));
  const preview = card.preview ? card.preview(p) : null;
  if (preview) wrap(preview, 44).forEach((t) => lines.push([seg(t, C.bcyan)]));
  lines.push([]);
  const keyLine = (k, label, why) => {
    const head = [seg(` ${k} `, why ? C.dgrey : C.black, why ? C.black : C.brown), seg(` ${label}`, why ? C.dgrey : C.white)];
    // A long reason goes on its own line so it isn't cut off at the edge of the box.
    if (why && k.length + label.length + why.length + 6 > 44) lines.push(head, [seg(`    (${why})`, C.dgrey)]);
    else lines.push([...head, seg(why ? `  (${why})` : "", C.dgrey)]);
  };
  if (selected.from === "hand") {
    const why = whyNotPlayable(card);
    keyLine("p", isPage ? "stage it in front of you" : "play it", why);
    if (state.step === STEP.DISCARD && !isPage) keyLine("d", "discard it", "");
  } else if (selected.from === "pages") {
    keyLine("u", "use it, then discard", p.pageRemovedThisRound ? "already used a page this turn" : "");
  } else if (card.activateItem && !card.combatWeapon) {
    keyLine("a", card.activateLabel || "use it (then it's discarded)", "");
  } else {
    lines.push([seg(card.combatWeapon ? "offered in the fight box when you fight" : "works on its own", C.dgrey)]);
  }
  if (list.length > 1) lines.push([seg(" up/down ", C.black, C.grey), seg(` other cards (${selected.index + 1} of ${list.length})`, C.grey)]);
  lines.push([seg(" Esc ", C.black, C.grey), seg(" back", C.grey)]);
  return { title: card.name, lines };
}

function itemsPanel() {
  const p = me();
  const pages = p.botdPages || [];
  const lines = p.items.length || pages.length ? [] : [[seg("Nothing in front of you yet.", C.dgrey)]];
  p.items.slice(0, 9).forEach((c, i) => lines.push([seg(` ${i + 1} `, C.black, C.brown), seg(` ${c.name}`, C.white)]));
  if (pages.length) {
    lines.push([seg("Book of the Dead pages", C.bcyan)]);
    pages.slice(0, 6).forEach((c, i) => lines.push([seg(` ${"uvwxyz"[i]} `, C.black, C.brown), seg(` ${c.name}`, C.white)]));
  }
  lines.push([], [seg(" Esc ", C.black, C.grey), seg(" back", C.grey)]);
  return { title: `${p.name}: in front of you`, lines };
}

function gameOverPanel() {
  const w = state.winInfo;
  const how = !w ? "" : w.winType === "helipad" ? "escaped by helicopter" : w.winType === "spell" ? "performed the Cabin Spell"
    : w.winType === "clown_escape" ? "escaped the circus" : `killed ${w.kills} zombies`;
  const last = state.logs[0] ? state.logs[0].text.replace(/^\[T\d+\]\s*/, "") : "";
  const lines = w ? [[seg(`${w.playerName} WINS!`, C.yellow)], [seg(how, C.white)]] : wrap(last, 44).map((t) => [seg(t, C.white)]);
  lines.push([]);
  state.players.forEach((pl) => lines.push([seg(`${pl.name}`, C.grey), seg(`  ${pl.kills} kills`, C.dgrey)]));
  lines.push([], [seg(" n ", C.black, C.brown), seg(" new game", C.white), seg("    "), seg(" q q ", C.black, C.grey), seg(" quit", C.grey)]);
  return { title: w ? "VICTORY" : "GAME OVER", lines };
}

// What the look cursor is over, for the sidebar.
function describeSpace(sx, sy) {
  const info = [];
  const tile = state.board.get(call("getSpaceTileKey", sx, sy));
  if (!tile) return [["(nothing here yet)", C.dgrey]];
  info.push([call("getTileDisplayName", tile), C.yellow]);
  const { lx, ly } = call("getSpaceLocalCoords", sx, sy);
  const cell = tile.subTiles && tile.subTiles[`${lx},${ly}`];
  if (cell) info.push([cell.type || "space", C.grey]);
  const z = state.zombies.get(`${sx},${sy}`);
  if (z) info.push([`${z.count || 1} ${z.type === "regular" ? "zombie" : String(z.type).replace("_", " ")}${(z.count || 1) > 1 ? "s" : ""}`, C.bgreen]);
  const t = state.spaceTokens && state.spaceTokens.get(`${sx},${sy}`);
  if (t && (t.hearts || t.bullets)) info.push([`tokens: ${t.hearts ? `♥${t.hearts} ` : ""}${t.bullets ? `■${t.bullets}` : ""}`, C.yellow]);
  if (state.sewerTokenSpaces && state.sewerTokenSpaces.has(`${sx},${sy}`)) info.push(["sewer token", C.dgrey]);
  state.players.filter((pl) => pl.x === sx && pl.y === sy).forEach((pl) => info.push([`@ ${pl.name}${pl.inSewer ? " (in the sewer)" : ""}`, C.white]));
  return info;
}

// ---- drawing ---------------------------------------------------------------
function scheduleDraw() {
  if (drawQueued) return;
  drawQueued = true;
  setImmediate(() => {
    drawQueued = false;
    try {
      autoAdvance();
      autoSave();
      draw();
    } catch (e) {
      process.stderr.write(`${e.stack}\n`);
    }
  });
}

function keyHints() {
  if (mode === "look") return [["arrows", "move the cursor"], ["m Esc", "back to the game"]];
  if (mode === "items") return [["1-9", "look at an item"], ["Esc", "back"]];
  if (mode === "card") return [["up/down", "other cards"], ["Esc", "back"]];
  if (mode === "deck") return [["1-9", "pick a deck"], ["Esc", "back"]];
  if (state.gameOver) return [["n", "new game"], ["q q", "quit"]];
  if (state.pendingCombatDecision) return [["b h l", "choose in the fight box"]];
  if (state.pendingEventChoice) return [["1-9", "choose an option"]];
  if (state.pendingZombieDiceChallenge) return [["Enter", "accept the dice"], ["1-4", "spend a bullet / heart"]];
  if (state.pendingDuctChoice) return [["1-9", "pick a store"], ["s", "stay here"]];
  const spec = pickNow();
  if (spec) {
    const hints = [["Enter", "pick this space"], ["arrows", "move the cursor"], ["Tab", "next green space"]];
    if (spec.done) hints.push(["x", spec.done[0]]);
    if (spec.kind === "zmove") hints.splice(1, 0, ["Space", "move the rest"]);
    hints.push(["1-5", "card details"], ["?", "help  q q quit"]);
    return hints;
  }
  if (state.pendingForcedMove) {
    const t = call("getPlayerById", state.pendingForcedMove.targetPlayerId);
    return [["arrows", `move ${t ? t.name : "them"}`], ["x", "stop the forced move"], ["?", "help  q q quit"]];
  }

  const hints = [];
  const next = nextAction();
  if (next) hints.push(["Space", next[0]]);
  const s = state.step;
  if (s === STEP.DRAW_TILE && state.pendingTile) hints.push(["arrows", "pick a spot"], ["r", "rotate it"], ["Enter", "place it"]);
  else if (s === STEP.DRAW_TILE) hints.push(["t", "draw a tile"]);
  else if (s === STEP.COMBAT) hints.push(["c", "fight"]);
  else if (s === STEP.ROLL_MOVE) hints.push(["r", "roll"]);
  else if (s === STEP.MOVE && state.pendingBreakthrough) hints.unshift(["arrows", "break through a wall"]), hints.push(["x", "don't try"]);
  else if (s === STEP.MOVE) hints.unshift(["arrows", "move (or wasd)"]), hints.push(["x", "stop moving"]);
  else if (s === STEP.DISCARD) hints.push(["1-5 d", "discard a card"], ["n", "keep your hand"]);
  else if (s === STEP.END) hints.push(["Enter", "end turn"]);
  if (canCastSpell()) hints.splice(next ? 1 : 0, 0, ["v", "cast the Cabin spell"]);
  const sw = sewerActions();
  if (sw.place) hints.push(["o", "place a sewer token"]);
  if (sw.toggle) hints.push(["u", me().inSewer ? "climb out of the sewer" : "drop into the sewer"]);
  hints.push(["1-5", "card details"], ["m", "look around"], ["?", "help  q q quit"]);
  return hints;
}

// ---- flashing the current player's space -------------------------------------------
// Every FLASH_MS the space under the player whose turn it is swaps between its normal look and
// their color, by rewriting just those 3 cells (a few bytes, not a whole screen).
const FLASH_MS = 600;
let flashCells = null;   // [{ x, y, off: cell, on: cell }]
let flashOn = false;
let flashTimer = null;

function setFlash(grid, flash) {
  flashCells = null;
  flashOn = false;
  // Skip it if a pop-up box covers that space.
  if (flash && flash.cells.every((c) => grid[c.y][c.x].ch === c.ch && grid[c.y][c.x].bg === c.bg)) {
    flashCells = flash.cells.map((c) => {
      const off = { ch: c.ch, fg: c.fg, bg: c.bg };
      const fg = (c.fg & 7) === flash.bg || c.ch === "@" ? (flash.bg === C.grey ? C.black : C.white) : c.fg;
      return { x: c.x, y: c.y, off, on: { ch: c.ch, fg: c.ch === "@" ? C.black : fg, bg: flash.bg } };
    });
  }
  if (flashCells && !flashTimer) {
    flashTimer = setInterval(() => {
      if (!flashCells || drawQueued) return;
      flashOn = !flashOn;
      process.stdout.write(ansi.renderCells(flashCells.map((c) => ({ x: c.x, y: c.y, ...(flashOn ? c.on : c.off) })), { utf8: UTF8 }));
    }, FLASH_MS);
  } else if (!flashCells && flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
}

function draw() {
  if (phase !== "game" || mode === "help") setFlash(null, null);
  if (phase === "locked") {
    process.stdout.write(ansi.render(buildPrompt({
      title: "already playing",
      lines: [["You already have IC Zombies open on another connection.", C.white], [""],
        ["You can only have one game going at a time. Finish or quit"], ["that one first, then come back."]],
      keys: [["q", "back to the BBS"]]
    }), { utf8: UTF8 }));
    return;
  }
  if (phase === "resume" || phase === "confirmNew") {
    process.stdout.write(ansi.render(resumeScreen(), { utf8: UTF8 }));
    return;
  }
  if (phase === "menu") {
    process.stdout.write(ansi.render(buildMenu(menuModel()), { utf8: UTF8 }));
    return;
  }
  if (mode === "help") {
    process.stdout.write(ansi.render(buildHelp(), { utf8: UTF8 }));
    return;
  }
  const extra = { keys: keyHints(), primaryKey: true, info: [], playable: me().hand.map((c) => !whyNotPlayable(c)) };
  const p = me();

  // Variant counters for the player whose turn it is.
  const extras = [];
  if (state.useGuts && p.guts != null) extras.push(`guts ${p.guts}`);
  if (state.useSewerTokens) extras.push(`sewer tokens ${p.sewerTokensAvailable || 0}${p.inSewer ? ", IN SEWER" : ""}`);
  if (extras.length) extra.info.push([extras.join("  "), C.bcyan]);

  const spot = state.pendingTile ? currentSpot() : null;
  if (spot) {
    extra.center = { x: spot.x * 3 + 1, y: spot.y * 3 + 1 };
    const map = call("getTileSubTileMap", state.pendingTile);
    extra.preview = { x: spot.x, y: spot.y, tile: state.pendingTile, subTiles: call("getRotatedSubTiles", map, state.pendingRotation) || {} };
    const all = spotsNow();
    extra.spots = all.filter((o) => o.x !== spot.x || o.y !== spot.y).map((o) => `${o.x},${o.y}`);
    const n = all.findIndex((o) => o.x === spot.x && o.y === spot.y) + 1;
    extra.spotInfo = `spot ${n} of ${all.length}, turned ${state.pendingRotation * 90}°`;
  }

  const spec = !busyPanel() && mode === "play" ? pickNow() : null;
  if (spec) {
    const c = pickCursor(spec);
    extra.targets = spec.targets;
    extra.selectedSpace = spec.selected || null;
    extra.cursor = c;
    extra.center = c;
    extra.info.push([spec.title.toUpperCase(), C.bcyan]);
    wrap(spec.help, 26).forEach((t) => extra.info.push([t, C.white]));
    if (!spec.targets.size) extra.info.push(["(no green spaces: x to finish)", C.dgrey]);
  } else {
    pick = null;
  }
  if (state.pendingForcedMove && !busyPanel()) {
    const pfm = state.pendingForcedMove;
    const t = call("getPlayerById", pfm.targetPlayerId);
    extra.info.push([(pfm.cardName || "Forced move").toUpperCase(), C.bcyan]);
    wrap(`Move ${t ? t.name : "them"} ${pfm.remaining} more space(s). Zombies on the way must be fought.`, 26).forEach((l) => extra.info.push([l, C.white]));
    if (t) extra.center = { x: t.x, y: t.y };
  }
  if (state.pendingBreakthrough && !busyPanel()) {
    wrap("Breakthrough: pick a direction to smash through a wall (5-6 works; 4 or less costs a heart).", 26).forEach((l) => extra.info.push([l, C.bcyan]));
  }
  if (mode === "look" && cursor) {
    extra.center = cursor;
    extra.cursor = cursor;
    extra.info.push(["LOOKING AROUND", C.bcyan], ...describeSpace(cursor.x, cursor.y));
  }

  if (mode === "card") extra.panel = cardPanel();
  else if (mode === "items") extra.panel = itemsPanel();
  else if (mode === "deck") extra.panel = deckPanel();
  else if (state.gameOver) extra.panel = gameOverPanel();
  else if (state.pendingCombatDecision) extra.panel = combatPanel();
  else if (state.pendingEventChoice) extra.panel = eventChoicePanel();
  else if (state.pendingZombieDiceChallenge) extra.panel = diceChallengePanel();
  else if (state.pendingDuctChoice) extra.panel = ductPanel();
  if (selected && selected.from === "hand" && mode === "card") extra.selectedCard = selected.index;

  if (!autoSteps) extra.info.push(["auto steps off (a)", C.dgrey]);
  if (quitArmed) extra.info.push(["q again to quit", C.yellow]);
  if (notice) extra.info.push([notice, C.yellow]);
  const grid = buildScreen(game, extra);
  setFlash(grid, extra.flash);
  process.stdout.write(ansi.render(grid, { utf8: UTF8 }));
}

// ---- input -----------------------------------------------------------------
const ARROWS = { A: "N", B: "S", C: "E", D: "W" };
const WASD = { w: "N", s: "S", a: "W", d: "E" };
const isEnter = (k) => k === "\r" || k === "\n";
const isEsc = (k) => k === "\x1b";

function arrowDir(k) {
  if (k.length === 3 && (k.startsWith("\x1b[") || k.startsWith("\x1bO")) && ARROWS[k[2]]) return ARROWS[k[2]];
  return null;
}

function handleMenuKey(k) {
  menu.notice = "";
  const lower = k.toLowerCase();
  const dir = arrowDir(k);
  if (lower === "q") return quit();
  if (dir === "E" || dir === "N" || k === "+" || k === "=") menu.players = Math.min(MAX_PLAYERS, menu.players + 1);
  else if (dir === "W" || dir === "S" || k === "-") menu.players = Math.max(1, menu.players - 1);
  else if (/^[1-9]$/.test(k)) menu.players = Math.max(1, Math.min(MAX_PLAYERS, Number(k)));
  else if (isEnter(k)) startNewGame();
  else {
    const v = VARIANTS.find(([letter]) => letter === lower);
    if (v) { menu[v[1]] = !menu[v[1]]; return; }
    const i = collKeys.findIndex((_, j) => letterOf(j) === lower);
    if (i >= 0) toggleCollection(collKeys[i]);
  }
}

function handleKey(k) {
  if (phase === "locked") { if (k.toLowerCase() === "q" || isEnter(k) || isEsc(k)) quit(); return; }
  if (phase === "resume") {
    const lower = k.toLowerCase();
    if (lower === "c") continueSavedGame();
    else if (lower === "n") phase = "confirmNew";
    else if (lower === "q") quit();
    return;
  }
  if (phase === "confirmNew") {
    if (k.toLowerCase() === "y") { saves.removeSave(SAVE_DIR, userName); menu.notice = "Saved game deleted."; phase = "menu"; }
    else phase = "resume";
    return;
  }
  if (phase === "menu") return handleMenuKey(k);
  notice = "";
  if (k !== "q" && k !== "Q") quitArmed = false;
  if (k === "q" || k === "Q") {
    if (mode !== "play") { mode = "play"; selected = null; return; }
    if (quitArmed) return quit();
    quitArmed = true;
    return;
  }
  const lower = k.toLowerCase();
  const dir = arrowDir(k);

  if (mode === "help") { mode = "play"; return; }
  if (k === "?") { mode = "help"; return; }

  // look around the map without moving
  if (mode === "look") {
    if (dir) { const [dx, dy] = DIRS[dir]; cursor = { x: cursor.x + dx, y: cursor.y + dy }; return; }
    if (isEsc(k) || lower === "m") { mode = "play"; cursor = null; }
    return;
  }
  if (lower === "m" && !state.pendingCombatDecision && !state.pendingEventChoice && mode === "play") {
    const p = me();
    cursor = pick ? { x: pick.x, y: pick.y } : { x: p.x, y: p.y };
    mode = "look";
    return;
  }

  // card details
  if (mode === "card") {
    if (isEsc(k)) { mode = "play"; selected = null; return; }
    // Up/down (or left/right) flips through the other cards in the same list.
    if (dir) {
      const p = me();
      const list = selected.from === "items" ? p.items : selected.from === "pages" ? p.botdPages : p.hand;
      if (list.length) selected.index = (selected.index + (dir === "N" || dir === "W" ? -1 : 1) + list.length) % list.length;
      return;
    }
    if (/^[1-9]$/.test(k) && selected.from === "hand" && me().hand[Number(k) - 1]) { selected.index = Number(k) - 1; return; }
    const i = selected.index;
    const card = selected.from === "hand" ? me().hand[i] : null;
    if (selected.from === "hand" && lower === "p" && !busy()) {
      mode = "play"; selected = null;
      if (card && card.cardType === CARD_TYPE.BOTD_PAGE) call("stagePage", i);
      else call("playEvent", i);
      return;
    }
    if (selected.from === "hand" && lower === "d" && state.step === STEP.DISCARD) {
      state.selectedHandIndex = i;
      mode = "play"; selected = null;
      call("discardSelected");
      return;
    }
    if (selected.from === "pages" && lower === "u") { mode = "play"; selected = null; call("usePage", i); return; }
    if (selected.from === "items" && lower === "a") { mode = "play"; selected = null; call("activateItem", i); return; }
    return;
  }
  if (mode === "items") {
    if (isEsc(k)) { mode = "play"; return; }
    if (/^[1-9]$/.test(k) && me().items[Number(k) - 1]) { selected = { from: "items", index: Number(k) - 1 }; mode = "card"; }
    const pi = "uvwxyz".indexOf(lower);
    if (pi >= 0 && (me().botdPages || [])[pi]) { selected = { from: "pages", index: pi }; mode = "card"; }
    return;
  }
  if (mode === "deck") {
    if (isEsc(k)) { mode = "play"; return; }
    const d = /^[1-9]$/.test(k) && tileDecks()[Number(k) - 1];
    if (d) { mode = "play"; doorSpot = null; call("drawAndPlaceTile", d[0]); }
    return;
  }

  if (state.gameOver) {
    if (lower === "n") { saves.removeSave(SAVE_DIR, userName); phase = "menu"; }
    return;
  }

  // the fight box
  if (state.pendingCombatDecision) {
    const panel = combatPanel();
    const pickOpt = panel.opts.find((o) => o.key === lower);
    if (!pickOpt || !pickOpt.ok) return;
    const p = call("getPlayerById", state.pendingCombatDecision.playerId) || me();
    let code = { b: "B", l: "L", f: "FAK", k: "LS" }[lower];
    if (lower === "h") code = state.pendingCombatDecision.isDog ? "HH" : "H";
    if (/^[1-9]$/.test(lower)) {
      const weapon = p.items.filter((c) => c.combatWeapon)[Number(lower) - 1];
      if (weapon) code = `W:${weapon.name}`;
    }
    if (code) call("resolvePendingCombatDecision", code);
    return;
  }

  // an event card asking you to choose
  if (state.pendingEventChoice) {
    const o = /^[1-9]$/.test(k) && state.pendingEventChoice.options[Number(k) - 1];
    if (o) call("resolveEventChoice", o.key);
    return;
  }

  if (state.pendingZombieDiceChallenge) {
    const action = { 1: "B0", 2: "B1", 3: "H0", 4: "H1" }[k];
    if (action) call("resolveZombieDiceChallenge", action);
    else if (isEnter(k) || k === " ") call("resolveZombieDiceChallenge", "ACCEPT");
    return;
  }

  if (state.pendingDuctChoice) {
    if (/^[1-9]$/.test(k) && state.pendingDuctChoice.destinations[Number(k) - 1]) call("confirmDuctTeleport", Number(k) - 1);
    else if (lower === "s" || isEsc(k)) call("skipDuct");
    return;
  }

  // picking a space for a card
  const spec = pickNow();
  if (spec) {
    const c = pickCursor(spec);
    if (dir) { const [dx, dy] = DIRS[dir]; pick.x = c.x + dx; pick.y = c.y + dy; return; }
    if (k === "\t" || k === "]") return cycleTarget(spec, 1);
    if (k === "[") return cycleTarget(spec, -1);
    if (isEnter(k)) {
      if (!spec.targets.has(`${c.x},${c.y}`) && spec.selected !== `${c.x},${c.y}`) { notice = "pick a green space"; return; }
      spec.pick(c.x, c.y);
      if (pickNow() && pickNow().kind === spec.kind) { const again = pickNow(); if (!again.targets.has(`${pick.x},${pick.y}`)) cycleTarget(again, 1); }
      return;
    }
    if (k === " " && spec.kind === "zmove") return spec.done[1]();
    if ((lower === "x" || isEsc(k)) && spec.done) return spec.done[1]();
    if (/^[1-9]$/.test(k) && me().hand[Number(k) - 1]) { selected = { from: "hand", index: Number(k) - 1 }; mode = "card"; }
    if (lower === "i") mode = "items";
    return;
  }

  // a card is moving someone (maybe another player) around
  if (state.pendingForcedMove) {
    const d = dir || WASD[lower];
    if (d) call("forcedMoveTarget", d);
    else if (lower === "x") call("endForcedMovement");
    return;
  }

  if (/^[1-9]$/.test(k)) {
    if (me().hand[Number(k) - 1]) { selected = { from: "hand", index: Number(k) - 1 }; mode = "card"; }
    return;
  }
  if (lower === "i") { mode = "items"; return; }
  if (lower === "a" && state.step !== STEP.MOVE && !state.pendingTile) {
    autoSteps = !autoSteps;
    notice = `auto steps ${autoSteps ? "on" : "off"}`;
    return;
  }
  if (lower === "v" && canCastSpell()) { call("attemptSpell"); return; }
  const sw = sewerActions();
  if (lower === "o" && sw.place) {
    state.pendingSewerTokenPlace = { playerId: me().id };
    call("logLine", `${me().name} is placing a sewer token — pick a road space.`);
    return;
  }
  if (lower === "u" && sw.toggle) { toggleSewer(); return; }

  if (k === " ") {
    const next = nextAction();
    if (next) return next[1]();
    if (state.step === STEP.MOVE) notice = "arrows move, x stops";
    return;
  }

  const wasd = WASD[lower] && (state.step === STEP.MOVE || state.pendingTile) ? WASD[lower] : null;
  const d = dir || wasd;
  if (d) {
    if (state.pendingTile) return pickSpot(d);
    if (state.step !== STEP.MOVE) return;
    call("movePlayer", d);
    return;
  }

  switch (state.step) {
    case STEP.DRAW_TILE:
      if (!state.pendingTile && lower === "t") drawTile();
      else if (state.pendingTile && (k === "\t" || k === "]")) cycleSpot(1);
      else if (state.pendingTile && k === "[") cycleSpot(-1);
      else if (state.pendingTile && lower === "r") call("rotatePendingTile", 1);
      else if (state.pendingTile && isEnter(k)) placeTile();
      break;
    case STEP.COMBAT:
      if (lower === "c") call("resolveCombatOnCurrentTile");
      break;
    case STEP.DRAW_EVENTS:
      if (lower === "e") call("drawEventsToThree");
      break;
    case STEP.ROLL_MOVE:
      if (lower === "r") call("rollMovement");
      break;
    case STEP.MOVE:
      if (lower === "x") call("endMovementEarly");
      break;
    case STEP.MOVE_ZOMBIES:
      if (lower === "z") moveZombies();
      break;
    case STEP.DISCARD:
      if (lower === "n") keepHand();
      break;
    case STEP.END:
      if (isEnter(k)) call("endTurn");
      break;
  }
}

// Split input into keys: arrow keys arrive as 3-byte escape sequences; a lone ESC is Escape.
function keysFrom(chunk) {
  const s = chunk.toString("latin1");
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\x1b" && (s[i + 1] === "[" || s[i + 1] === "O") && s[i + 2]) { out.push(s.slice(i, i + 3)); i += 2; }
    else if (s[i] === "\r" && s[i + 1] === "\n") { out.push("\r"); i += 1; }
    else if (s[i] === "\x03") out.push("CTRL_C");
    else out.push(s[i]);
  }
  return out;
}

function quit() {
  const kept = phase === "game" && !state.gameOver && savedGameInfo();
  process.stdout.write(ansi.CLEAR + ansi.SHOW_CURSOR + "Thanks for playing IC Zombies.\r\n" +
    (kept ? `Your game is saved as of the start of turn ${state.turnNumber}; you'll be asked to continue it next time.\r\n` : ""));
  process.exit(0);
}

process.stdin.on("data", (chunk) => {
  for (const k of keysFrom(chunk)) {
    if (k === "CTRL_C") return quit();
    try {
      handleKey(k);
    } catch (e) {
      notice = "oops: that hit a bug";
      process.stderr.write(`${e.stack}\n`);
    }
  }
  scheduleDraw();
});
// A dropped connection: the save from the start of this turn is already on disk, so just go.
process.stdin.on("end", () => process.exit(0));
process.on("SIGHUP", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();

// One game at a time: if this user's game is already open on another node, say so and stop there.
// Otherwise ask whether to pick up a saved game before showing the new-game screen.
if (!saves.takeLock(SAVE_DIR, userName)) phase = "locked";
else {
  process.on("exit", () => saves.dropLock(SAVE_DIR, userName));
  if (savedGameInfo()) phase = "resume";
  else if (opt("new")) startNewGame();
}
// Testing only: run a script inside the game (e.g. deal a certain card) before the first draw.
if (process.env.ICZ_TEST_SETUP) require("vm").runInContext(fs.readFileSync(process.env.ICZ_TEST_SETUP, "utf8"), game.ctx);
process.stdout.write(ansi.CLEAR);
scheduleDraw();
