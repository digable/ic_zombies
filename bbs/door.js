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
const { buildScreen } = require("./screen");
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
state.doorSelectedOption = 0;

let quitArmed = false;
let notice = "";

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

function keyHints() {
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
      ? ["[ ]  choose spot", "Enter  place tile", "q  quit"]
      : ["t  draw a map tile", "q  quit"];
  }
  if (s === STEP.COMBAT) return ["c  fight!", "q  quit"];
  if (s === STEP.DRAW_EVENTS) return ["e  draw event cards", "1-3 play a card", "q  quit"];
  if (s === STEP.ROLL_MOVE) return ["r  roll to move", "1-3 play a card", "q  quit"];
  if (s === STEP.MOVE) return ["↑↓←→ / wasd  move", "x  stop moving", "q  quit"];
  if (s === STEP.MOVE_ZOMBIES) return ["z  move the zombies", "q  quit"];
  if (s === STEP.DISCARD) return ["1-3 discard a card", "n  keep your hand", "q  quit"];
  if (s === STEP.END) return ["Enter  end turn", "q  quit"];
  return ["q  quit"];
}

function draw() {
  let center;
  if (state.pendingTile && state.pendingTileOptions?.length) {
    const o = state.pendingTileOptions[state.doorSelectedOption % state.pendingTileOptions.length];
    center = { x: o.x * 3 + 1, y: o.y * 3 + 1 };
  }
  const keys = keyHints();
  if (quitArmed) keys.push("press q again to quit");
  if (notice) keys.push(notice);
  if (state.gameOver && state.winInfo) {
    keys.unshift(String(state.winInfo.message || state.winInfo.reason || "We have a winner!").slice(0, 26));
  }
  process.stdout.write(ansi.render(buildScreen(game, { center, keys }), { utf8: UTF8 }));
}

// ---- input -----------------------------------------------------------------
const ARROWS = { A: "N", B: "S", C: "E", D: "W" };
const WASD = { w: "N", s: "S", a: "W", d: "E" };

function move(dir) {
  if (state.step !== STEP.MOVE) return;
  if (state.pendingForcedMove) game.call("forcedMoveTarget", dir);
  else game.call("movePlayer", dir);
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

  if (state.pendingCombatDecision) {
    const code = { b: "B", h: "H", l: "L" }[k.toLowerCase()];
    if (code) game.call("resolvePendingCombatDecision", code);
    return;
  }

  const lower = k.toLowerCase();
  if (WASD[lower] && state.step === STEP.MOVE) return move(WASD[lower]);

  switch (state.step) {
    case STEP.DRAW_TILE:
      if (!state.pendingTile && lower === "t") {
        state.doorSelectedOption = 0;
        game.call("drawAndPlaceTile", TILE_DECK.BASE);
      } else if (state.pendingTile && (k === "[" || k === "]")) {
        const n = state.pendingTileOptions.length;
        state.doorSelectedOption = (state.doorSelectedOption + (k === "]" ? 1 : n - 1)) % n;
      } else if (state.pendingTile && (k === "\r" || k === "\n")) {
        const o = state.pendingTileOptions[state.doorSelectedOption % state.pendingTileOptions.length];
        state.pendingRotation = o.rotation;
        game.call("placePendingTileAt", o.x, o.y);
        state.doorSelectedOption = 0;
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
      if (lower === "z") {
        game.call("startZombieMovement");
        if (state.pendingZombieMovement) game.call("autoFinishZombieMovement");
      }
      break;
    case STEP.DISCARD:
      if (lower === "n") { state.selectedHandIndex = null; game.call("discardSelected"); }
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
