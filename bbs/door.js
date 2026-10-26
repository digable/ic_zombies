#!/usr/bin/env node
// IC Zombies, BBS edition: an ASCII / ANSI front end that runs the same game code as the
// web version (loaded by engine.js), for play in a terminal or as a Synchronet BBS door.
//
//   node bbs/door.js                 BBS mode: CP437 characters, 1 player
//   node bbs/door.js --utf8          try it in a normal terminal (VS Code, Windows Terminal)
//   node bbs/door.js --players 2     hot-seat game for 2 (up to the game's maximum)
//
// Synchronet runs it as an external program with standard input/output (see bbs/README.md).
// This is an early spike: drawing, the turn steps, movement, combat choices, cards and
// event choices work; card effects that need you to pick a space on the board say so.

"use strict";

const { loadEngine } = require("./engine");
const { buildScreen, buildHelp } = require("./screen");
const ansi = require("./ansi");

// ---- options ---------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name) => args.includes(`--${name}`);
const val = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const UTF8 = opt("utf8");

// ---- game ------------------------------------------------------------------
let drawQueued = false;
const game = loadEngine({ onRender: () => scheduleDraw() });
const state = game.get("state");
const STEP = game.get("STEP");
const TILE_DECK = game.get("TILE_DECK");
const MAX_PLAYERS = game.get("MAX_PLAYERS");

const players = Math.max(1, Math.min(MAX_PLAYERS, parseInt(val("players", "1"), 10) || 1));
const base = { [game.call("getBaseCollection")]: { enabled: true, disabled: false } };
game.call("setupGame", players, base, base);

let quitArmed = false;
let notice = "";
let helpOpen = false;

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
    // nearest spot to the last pick, or to the player
    const p = state.players[state.currentPlayerIndex];
    const from = doorSpot || { x: Math.floor(p.x / 3), y: Math.floor(p.y / 3) };
    doorSpot = spots.reduce((best, o) =>
      Math.abs(o.x - from.x) + Math.abs(o.y - from.y) < Math.abs(best.x - from.x) + Math.abs(best.y - from.y) ? o : best);
  }
  return doorSpot;
}

// Arrow keys jump to the nearest spot in that direction.
function pickSpot(dir) {
  const cur = currentSpot();
  if (!cur) return;
  const [dx, dy] = DIRS[dir];
  let best = null, bestScore = Infinity;
  for (const o of spotsNow()) {
    const ax = o.x - cur.x, ay = o.y - cur.y;
    const along = ax * dx + ay * dy;              // distance in the arrow's direction
    if (along <= 0) continue;
    const across = Math.abs(dx ? ay : ax);         // how far off to the side
    const score = along + across * 2;
    if (score < bestScore) { best = o; bestScore = score; }
  }
  if (best) doorSpot = best;
}

function cycleSpot(step) {
  const spots = spotsNow();
  const cur = currentSpot();
  if (!cur) return;
  const i = spots.findIndex((o) => o.x === cur.x && o.y === cur.y);
  doorSpot = spots[(i + step + spots.length) % spots.length];
}

function rotationsHere() {
  const cur = currentSpot();
  return cur ? new Set((state.pendingTileOptions || []).filter((o) => o.x === cur.x && o.y === cur.y).map((o) => o.rotation)).size : 0;
}

// ---- drawing ---------------------------------------------------------------
function scheduleDraw() {
  if (drawQueued) return;
  drawQueued = true;
  setImmediate(() => { drawQueued = false; draw(); });
}

// Pending interactions this front end can't do yet (they need a space picked on the board).
const BOARD_PICKS = [
  "pendingRocketLauncher", "pendingZombieFlood", "pendingSpaceSelect", "pendingMinefield",
  "pendingDynamiteTarget", "pendingFrisbeeTarget", "pendingBuildingSelect", "pendingZombiePlace",
  "pendingZombieReplace", "pendingDuctChoice", "pendingBreakthrough"
];

// What Space does right now (null when there's no single obvious next action).
function nextAction() {
  if (state.gameOver || state.pendingEventChoice || state.pendingCombatDecision) return null;
  if (BOARD_PICKS.some((k) => state[k])) return null;
  switch (state.step) {
    case STEP.DRAW_TILE: return state.pendingTile ? ["place the tile", () => placeTile()] : ["draw a tile", () => drawTile()];
    case STEP.COMBAT: return ["fight!", () => game.call("resolveCombatOnCurrentTile")];
    case STEP.DRAW_EVENTS: return ["draw cards", () => game.call("drawEventsToThree")];
    case STEP.ROLL_MOVE: return ["roll to move", () => game.call("rollMovement")];
    case STEP.MOVE_ZOMBIES: return ["move the zombies", () => moveZombies()];
    case STEP.DISCARD: return ["keep your hand", () => keepHand()];
    case STEP.END: return ["end your turn", () => game.call("endTurn")];
    default: return null;
  }
}

function keyHints() {
  const hints = stepHints();
  const next = nextAction();
  if (next) hints.unshift(`Space  ${next[0]}`);
  hints.push("?  help   q q  quit");
  return hints;
}

function stepHints() {
  if (state.gameOver) return ["game over", "q  quit"];
  if (state.pendingEventChoice) {
    return state.pendingEventChoice.options.slice(0, 6).map((o, i) => `${i + 1} ${o.label}`);
  }
  if (state.pendingCombatDecision) {
    return ["b  spend a bullet (+1)", "h  spend a heart (reroll)", "l  lose the fight"];
  }
  if (BOARD_PICKS.some((k) => state[k])) {
    return ["this card needs a space", "picked on the board:", "web version only for now"];
  }
  const s = state.step;
  if (s === STEP.DRAW_TILE) {
    return state.pendingTile
      ? ["arrows/Tab  pick a spot", "r  rotate the tile", "Enter  place it here"]
      : ["t  draw a map tile"];
  }
  if (s === STEP.COMBAT) return ["c  fight!"];
  if (s === STEP.DRAW_EVENTS) return ["e  draw event cards", "1-3 play a card"];
  if (s === STEP.ROLL_MOVE) return ["r  roll to move", "1-3 play a card"];
  if (s === STEP.MOVE) return ["\u2191\u2193\u2190\u2192 / wasd  move", "x  stop moving"];
  if (s === STEP.MOVE_ZOMBIES) return ["z  move the zombies"];
  if (s === STEP.DISCARD) return ["1-3 discard a card", "n  keep your hand"];
  if (s === STEP.END) return ["Enter  end turn"];
  return [];
}

function draw() {
  if (helpOpen) {
    process.stdout.write(ansi.render(buildHelp(), { utf8: UTF8 }));
    return;
  }
  let center, preview, spots, spotInfo;
  const spot = state.pendingTile ? currentSpot() : null;
  if (spot) {
    center = { x: spot.x * 3 + 1, y: spot.y * 3 + 1 };
    const map = game.call("getTileSubTileMap", state.pendingTile);
    preview = { x: spot.x, y: spot.y, subTiles: game.call("getRotatedSubTiles", map, state.pendingRotation) || {} };
    const all = spotsNow();
    spots = all.filter((o) => o.x !== spot.x || o.y !== spot.y).map((o) => `${o.x},${o.y}`);
    const n = all.findIndex((o) => o.x === spot.x && o.y === spot.y) + 1;
    spotInfo = `spot ${n} of ${all.length}, turned ${state.pendingRotation * 90}\u00b0`;
  }
  const keys = keyHints();
  if (quitArmed) keys.push("press q again to quit");
  if (notice) keys.push(notice);
  if (state.gameOver && state.winInfo) {
    keys.unshift(String(state.winInfo.message || state.winInfo.reason || "We have a winner!").slice(0, 26));
  }
  process.stdout.write(ansi.render(buildScreen(game, { center, keys, preview, spots, spotInfo }), { utf8: UTF8 }));
}

// ---- input -----------------------------------------------------------------
const ARROWS = { A: "N", B: "S", C: "E", D: "W" };
const WASD = { w: "N", s: "S", a: "W", d: "E" };

function move(dir) {
  if (state.pendingTile) return pickSpot(dir);
  if (state.step !== STEP.MOVE) return;
  if (state.pendingForcedMove) game.call("forcedMoveTarget", dir);
  else game.call("movePlayer", dir);
}

function drawTile() {
  doorSpot = null;
  game.call("drawAndPlaceTile", TILE_DECK.BASE);
}

function placeTile() {
  const spot = currentSpot();
  if (spot) game.call("placePendingTileAt", spot.x, spot.y);
  doorSpot = null;
}

function moveZombies() {
  game.call("startZombieMovement");
  if (state.pendingZombieMovement) game.call("autoFinishZombieMovement");
}

function keepHand() {
  state.selectedHandIndex = null;
  game.call("discardSelected");
}

function digit(n) {
  if (state.pendingEventChoice) {
    const o = state.pendingEventChoice.options[n - 1];
    if (o) game.call("resolveEventChoice", o.key);
    return;
  }
  const p = state.players[state.currentPlayerIndex];
  if (!p.hand[n - 1]) return;
  if (state.step === STEP.DISCARD) {
    state.selectedHandIndex = n - 1;
    game.call("discardSelected");
  } else {
    game.call("playEvent", n - 1);
  }
}

function handleKey(k) {
  notice = "";
  if (helpOpen) { helpOpen = false; return; }
  if (k === "?") { helpOpen = true; return; }
  if (k !== "q") quitArmed = false;
  if (k === "q" || k === "Q") {
    if (quitArmed) return quit();
    quitArmed = true;
    return;
  }
  if (state.gameOver) return;

  if (k.length === 3 && k.startsWith("\x1b[") && ARROWS[k[2]]) return move(ARROWS[k[2]]);
  if (k.length === 3 && k.startsWith("\x1bO") && ARROWS[k[2]]) return move(ARROWS[k[2]]);
  if (/^[1-9]$/.test(k)) return digit(Number(k));
  if (k === " ") {
    const next = nextAction();
    if (next) return next[1]();
    if (state.step === STEP.MOVE) notice = "arrows move, x stops";
    else if (state.pendingEventChoice) notice = "pick an option: 1-9";
    else if (state.pendingCombatDecision) notice = "choose b, h or l";
    return;
  }

  if (state.pendingCombatDecision) {
    const code = { b: "B", h: "H", l: "L" }[k.toLowerCase()];
    if (code) game.call("resolvePendingCombatDecision", code);
    return;
  }

  const lower = k.toLowerCase();
  if (WASD[lower] && (state.step === STEP.MOVE || state.pendingTile)) return move(WASD[lower]);

  switch (state.step) {
    case STEP.DRAW_TILE:
      if (!state.pendingTile && lower === "t") {
        drawTile();
      } else if (state.pendingTile && (k === "\t" || k === "]")) {
        cycleSpot(1);
      } else if (state.pendingTile && k === "[") {
        cycleSpot(-1);
      } else if (state.pendingTile && lower === "r") {
        game.call("rotatePendingTile", 1);
      } else if (state.pendingTile && (k === "\r" || k === "\n")) {
        placeTile();
      }
      break;
    case STEP.COMBAT:
      if (lower === "c") game.call("resolveCombatOnCurrentTile");
      break;
    case STEP.DRAW_EVENTS:
      if (lower === "e") game.call("drawEventsToThree");
      break;
    case STEP.ROLL_MOVE:
      if (lower === "r") game.call("rollMovement");
      break;
    case STEP.MOVE:
      if (lower === "x") game.call("endMovementEarly");
      break;
    case STEP.MOVE_ZOMBIES:
      if (lower === "z") moveZombies();
      break;
    case STEP.DISCARD:
      if (lower === "n") keepHand();
      break;
    case STEP.END:
      if (k === "\r" || k === "\n") game.call("endTurn");
      break;
  }
}

// Split one chunk of input into keys (arrow keys arrive as 3-byte escape sequences).
function keysFrom(chunk) {
  const s = chunk.toString("latin1");
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\x1b" && (s[i + 1] === "[" || s[i + 1] === "O") && s[i + 2]) {
      out.push(s.slice(i, i + 3));
      i += 2;
    } else if (s[i] === "\r" && s[i + 1] === "\n") {
      out.push("\r");
      i += 1;
    } else if (s[i] === "\x03") {
      out.push("CTRL_C");
    } else {
      out.push(s[i]);
    }
  }
  return out;
}

function quit() {
  process.stdout.write(ansi.CLEAR + ansi.SHOW_CURSOR + "Thanks for playing IC Zombies.\r\n");
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
process.stdin.on("end", () => process.exit(0));
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();

process.stdout.write(ansi.CLEAR);
draw();