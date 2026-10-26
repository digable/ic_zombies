#!/usr/bin/env node
// IC Zombies, BBS edition: an ASCII / ANSI front end that runs the same game code as the
// web version (loaded by engine.js), for play in a terminal or as a Synchronet BBS door.
//
//   node bbs/door.js                  BBS mode: CP437 characters, 1 player
//   node bbs/door.js --utf8           try it in a normal terminal (VS Code, Windows Terminal)
//   node bbs/door.js --players 2      hot-seat game for 2 (up to the game's maximum)
//   node bbs/door.js --name Digable   name player 1 (on the BBS this comes from DOOR32.SYS)
//
// Synchronet runs it as an external program with standard input/output (see bbs/README.md).

"use strict";

const fs = require("fs");
const path = require("path");
const { loadEngine } = require("./engine");
const { buildScreen, buildHelp, wrap, C } = require("./screen");
const ansi = require("./ansi");

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
const state = game.get("state");
const STEP = game.get("STEP");
const TILE_DECK = game.get("TILE_DECK");
const MAX_PLAYERS = game.get("MAX_PLAYERS");

const playerCount = Math.max(1, Math.min(MAX_PLAYERS, parseInt(val("players", "1"), 10) || 1));
const base = { [game.call("getBaseCollection")]: { enabled: true, disabled: false } };
game.call("setupGame", playerCount, base, base);

const userName = bbsUserName();
if (userName) {
  const old = state.players[0].name;
  state.players[0].name = userName;
  state.logs.forEach((l) => { l.text = l.text.split(old).join(userName); });
}

// ---- door state (only the screen; the game's own state lives in `state`) ------
let mode = "play";        // play | look | card | items | help
let selected = null;      // { from: "hand" | "items", index }
let cursor = null;        // look mode: board space under the cursor
let quitArmed = false;
let notice = "";
let autoSteps = true;     // draw cards and move zombies automatically

const me = () => state.players[state.currentPlayerIndex];

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

function pickSpot(dir) {
  const cur = currentSpot();
  if (!cur) return;
  const [dx, dy] = DIRS[dir];
  let best = null, bestScore = Infinity;
  for (const o of spotsNow()) {
    const ax = o.x - cur.x, ay = o.y - cur.y;
    const along = ax * dx + ay * dy;
    if (along <= 0) continue;
    const score = along + Math.abs(dx ? ay : ax) * 2;
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

// ---- actions -----------------------------------------------------------------
const BOARD_PICKS = [
  "pendingRocketLauncher", "pendingZombieFlood", "pendingSpaceSelect", "pendingMinefield",
  "pendingDynamiteTarget", "pendingFrisbeeTarget", "pendingBuildingSelect", "pendingZombiePlace",
  "pendingZombieReplace", "pendingDuctChoice", "pendingBreakthrough"
];
const needsBoardPick = () => BOARD_PICKS.some((k) => state[k]);
const busy = () => state.gameOver || state.pendingEventChoice || state.pendingCombatDecision || needsBoardPick();

function drawTile() { doorSpot = null; game.call("drawAndPlaceTile", TILE_DECK.BASE); }
function placeTile() {
  const spot = currentSpot();
  if (spot) game.call("placePendingTileAt", spot.x, spot.y);
  doorSpot = null;
}
function moveZombies() {
  game.call("startZombieMovement");
  if (state.pendingZombieMovement) game.call("autoFinishZombieMovement");
}
function keepHand() { state.selectedHandIndex = null; game.call("discardSelected"); }

// What Space does right now: [label, action], or null.
function nextAction() {
  if (busy() || state.pendingZombieMovement) return null;
  switch (state.step) {
    case STEP.DRAW_TILE: return state.pendingTile ? ["place the tile here", placeTile] : ["draw a map tile", drawTile];
    case STEP.COMBAT: return ["fight the zombie", () => game.call("resolveCombatOnCurrentTile")];
    case STEP.DRAW_EVENTS: return ["draw event cards", () => game.call("drawEventsToThree")];
    case STEP.ROLL_MOVE: return ["roll to move", () => game.call("rollMovement")];
    case STEP.MOVE_ZOMBIES: return ["move the zombies", moveZombies];
    case STEP.DISCARD: return ["keep your hand", keepHand];
    case STEP.END: return ["end your turn", () => game.call("endTurn")];
    default: return null;
  }
}

// Steps with nothing to decide happen on their own (toggle with "a").
function autoAdvance() {
  if (!autoSteps || mode !== "play" || busy() || state.zombieAnimationTimer) return;
  if (state.step === STEP.DRAW_EVENTS) game.call("drawEventsToThree");
  else if (state.step === STEP.MOVE_ZOMBIES && !state.pendingZombieMovement) moveZombies();
}

// ---- panels (pop-up boxes over the map) -----------------------------------------
const seg = (t, fg = C.grey, bg = C.black) => [t, fg, bg];

function combatPanel() {
  const pd = state.pendingCombatDecision;
  const p = game.call("getPlayerById", pd.playerId) || me();
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
    [seg("You have "), seg(`■ ${p.bullets} bullets`, C.yellow), seg("  and  "), seg(`♥ ${p.hearts} hearts`, C.bred)],
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
  else add("h", "spend a heart: reroll", p.hearts === 1 ? "your LAST heart" : p.hearts ? `${p.hearts - 1} left after` : "no hearts", p.hearts > 0, false);
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
  if (ec.description) wrap(ec.description, 44).forEach((t) => lines.push([seg(t)]));
  if (lines.length) lines.push([]);
  ec.options.slice(0, 9).forEach((o, i) => {
    lines.push([seg(` ${i + 1} `, C.black, C.brown), seg(` ${o.label}`, C.white)]);
  });
  return { title: ec.title || "Choose", lines };
}

function cardPanel() {
  const p = me();
  const list = selected.from === "items" ? p.items : p.hand;
  const card = list[selected.index];
  if (!card) { mode = "play"; selected = null; return null; }
  const tags = [card.isItem && "item", card.isWeapon && "weapon", card.combatWeapon && "use in a fight"].filter(Boolean);
  const lines = [];
  if (tags.length) lines.push([seg(tags.join(" · "), C.bcyan)]);
  wrap(card.description || "(no description)", 44).forEach((t) => lines.push([seg(t, C.white)]));
  lines.push([]);
  if (selected.from === "hand") {
    let why = "";
    if (p.eventUsedThisRound) why = "you've already played a card this turn";
    else if (p.cannotPlayCardTurns > 0) why = "you can't play cards this turn";
    else if (card.canPlay && !card.canPlay()) why = "can't be played right now";
    lines.push([seg(" p ", why ? C.dgrey : C.black, why ? C.black : C.brown), seg(" play it", why ? C.dgrey : C.white), seg(why ? `  (${why})` : "", C.dgrey)]);
    if (state.step === STEP.DISCARD) lines.push([seg(" d ", C.black, C.brown), seg(" discard it", C.white)]);
  } else if (card.activateItem && !card.combatWeapon) {
    lines.push([seg(" a ", C.black, C.brown), seg(` ${card.activateLabel || "use it (then it's discarded)"}`, C.white)]);
  } else {
    lines.push([seg(card.combatWeapon ? "offered in the fight box when you fight" : "works on its own", C.dgrey)]);
  }
  lines.push([seg(" Esc ", C.black, C.grey), seg(" back", C.grey)]);
  return { title: card.name, lines };
}

function itemsPanel() {
  const p = me();
  const lines = p.items.length ? [] : [[seg("No items in front of you.", C.dgrey)]];
  p.items.slice(0, 9).forEach((c, i) => lines.push([seg(` ${i + 1} `, C.black, C.brown), seg(` ${c.name}`, C.white)]));
  lines.push([], [seg(" Esc ", C.black, C.grey), seg(" back", C.grey)]);
  return { title: `${p.name}'s items`, lines };
}

// What the look cursor is over, for the sidebar.
function describeSpace(sx, sy) {
  const info = [];
  const tile = state.board.get(game.call("getSpaceTileKey", sx, sy));
  if (!tile) return [["(nothing here yet)", C.dgrey]];
  info.push([game.call("getTileDisplayName", tile), C.yellow]);
  const { lx, ly } = game.call("getSpaceLocalCoords", sx, sy);
  const cell = tile.subTiles && tile.subTiles[`${lx},${ly}`];
  if (cell) info.push([cell.type || "space", C.grey]);
  const z = state.zombies.get(`${sx},${sy}`);
  if (z) info.push([`${z.count || 1} ${z.type === "regular" ? "zombie" : z.type.replace("_", " ")}${(z.count || 1) > 1 ? "s" : ""}`, C.bgreen]);
  const t = state.spaceTokens && state.spaceTokens.get(`${sx},${sy}`);
  if (t && (t.hearts || t.bullets)) info.push([`tokens: ${t.hearts ? `♥${t.hearts} ` : ""}${t.bullets ? `■${t.bullets}` : ""}`, C.yellow]);
  state.players.filter((pl) => pl.x === sx && pl.y === sy).forEach((pl) => info.push([`@ ${pl.name}`, C.white]));
  return info;
}

// ---- drawing ---------------------------------------------------------------
function scheduleDraw() {
  if (drawQueued) return;
  drawQueued = true;
  setImmediate(() => {
    drawQueued = false;
    autoAdvance();
    draw();
  });
}

function keyHints() {
  if (mode === "look") return [["arrows", "move the cursor"], ["m Esc", "back to the game"]];
  if (mode === "items") return [["1-9", "look at an item"], ["Esc", "back"]];
  if (mode === "card") return [["Esc", "back"]];
  if (state.gameOver) return [["q q", "quit"]];
  if (state.pendingCombatDecision) return [["b h l", "choose in the fight box"]];
  if (state.pendingEventChoice) return [["1-9", "choose an option"]];
  if (needsBoardPick()) return [["!", "this card needs a space picked"], ["", "on the board: web only for now"]];

  const hints = [];
  const next = nextAction();
  if (next) hints.push(["Space", next[0]]);
  const s = state.step;
  if (s === STEP.DRAW_TILE && state.pendingTile) hints.push(["arrows", "pick a spot"], ["r", "rotate it"], ["Enter", "place it"]);
  else if (s === STEP.DRAW_TILE) hints.push(["t", "draw a tile"]);
  else if (s === STEP.COMBAT) hints.push(["c", "fight"]);
  else if (s === STEP.ROLL_MOVE) hints.push(["r", "roll"]);
  else if (s === STEP.MOVE) hints.unshift(["arrows", "move (or wasd)"]), hints.push(["x", "stop moving"]);
  else if (s === STEP.DISCARD) hints.push(["1-5 d", "discard a card"], ["n", "keep your hand"]);
  else if (s === STEP.END) hints.push(["Enter", "end turn"]);
  hints.push(["1-5", "card details"], ["m", "look around"], ["?", "help  q q quit"]);
  return hints;
}

function draw() {
  if (mode === "help") {
    process.stdout.write(ansi.render(buildHelp(), { utf8: UTF8 }));
    return;
  }
  const extra = { keys: keyHints(), primaryKey: true, info: [] };

  const spot = state.pendingTile ? currentSpot() : null;
  if (spot) {
    extra.center = { x: spot.x * 3 + 1, y: spot.y * 3 + 1 };
    const map = game.call("getTileSubTileMap", state.pendingTile);
    extra.preview = { x: spot.x, y: spot.y, subTiles: game.call("getRotatedSubTiles", map, state.pendingRotation) || {} };
    const all = spotsNow();
    extra.spots = all.filter((o) => o.x !== spot.x || o.y !== spot.y).map((o) => `${o.x},${o.y}`);
    const n = all.findIndex((o) => o.x === spot.x && o.y === spot.y) + 1;
    extra.spotInfo = `spot ${n} of ${all.length}, turned ${state.pendingRotation * 90}°`;
  }
  if (mode === "look" && cursor) {
    extra.center = cursor;
    extra.cursor = cursor;
    extra.info.push(["LOOKING AROUND", C.bcyan], ...describeSpace(cursor.x, cursor.y));
  }

  if (mode === "card") extra.panel = cardPanel();
  else if (mode === "items") extra.panel = itemsPanel();
  else if (state.pendingCombatDecision) extra.panel = combatPanel();
  else if (state.pendingEventChoice) extra.panel = eventChoicePanel();
  else if (state.gameOver) {
    const w = state.winInfo || {};
    extra.panel = { title: "GAME OVER", lines: wrap(w.message || w.reason || "We have a winner!", 44).map((t) => [seg(t, C.white)]).concat([[], [seg(" q q ", C.black, C.grey), seg(" quit", C.grey)]]) };
  }
  if (selected && selected.from === "hand" && mode === "card") extra.selectedCard = selected.index;

  if (!autoSteps) extra.info.push(["auto steps off (a)", C.dgrey]);
  if (quitArmed) extra.info.push(["press q again to quit", C.yellow]);
  if (notice) extra.info.push([notice, C.yellow]);
  process.stdout.write(ansi.render(buildScreen(game, extra), { utf8: UTF8 }));
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

function handleKey(k) {
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
  if (lower === "m" && !state.pendingCombatDecision && !state.pendingEventChoice) {
    const p = me();
    cursor = { x: p.x, y: p.y };
    mode = "look";
    return;
  }

  // card details
  if (mode === "card") {
    if (isEsc(k)) { mode = "play"; selected = null; return; }
    if (selected.from === "hand" && lower === "p") {
      const i = selected.index;
      mode = "play"; selected = null;
      game.call("playEvent", i);
      return;
    }
    if (selected.from === "hand" && lower === "d" && state.step === STEP.DISCARD) {
      state.selectedHandIndex = selected.index;
      mode = "play"; selected = null;
      game.call("discardSelected");
      return;
    }
    if (selected.from === "items" && lower === "a") {
      const i = selected.index;
      mode = "play"; selected = null;
      game.call("activateItem", i);
      return;
    }
    return;
  }
  if (mode === "items") {
    if (isEsc(k)) { mode = "play"; return; }
    if (/^[1-9]$/.test(k) && me().items[Number(k) - 1]) { selected = { from: "items", index: Number(k) - 1 }; mode = "card"; }
    return;
  }

  if (state.gameOver) return;

  // the fight box
  if (state.pendingCombatDecision) {
    const panel = combatPanel();
    const pick = panel.opts.find((o) => o.key === lower);
    if (!pick || !pick.ok) return;
    const p = me();
    let code = { b: "B", l: "L", f: "FAK", k: "LS" }[lower];
    if (lower === "h") code = state.pendingCombatDecision.isDog ? "HH" : "H";
    if (/^[1-9]$/.test(lower)) {
      const weapon = p.items.filter((c) => c.combatWeapon)[Number(lower) - 1];
      if (weapon) code = `W:${weapon.name}`;
    }
    if (code) game.call("resolvePendingCombatDecision", code);
    return;
  }

  // an event card asking you to choose
  if (state.pendingEventChoice) {
    const o = /^[1-9]$/.test(k) && state.pendingEventChoice.options[Number(k) - 1];
    if (o) game.call("resolveEventChoice", o.key);
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
    if (state.pendingForcedMove) game.call("forcedMoveTarget", d);
    else game.call("movePlayer", d);
    return;
  }

  switch (state.step) {
    case STEP.DRAW_TILE:
      if (!state.pendingTile && lower === "t") drawTile();
      else if (state.pendingTile && (k === "\t" || k === "]")) cycleSpot(1);
      else if (state.pendingTile && k === "[") cycleSpot(-1);
      else if (state.pendingTile && lower === "r") game.call("rotatePendingTile", 1);
      else if (state.pendingTile && isEnter(k)) placeTile();
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
      if (isEnter(k)) game.call("endTurn");
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
scheduleDraw();
