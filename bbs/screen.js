// Draws the game as an 80x24 grid of character cells: { ch, fg, bg }.
// Colors are the 16 classic BBS colors (0-7 normal, 8-15 bright); backgrounds 0-7 only.
// ansi.js turns the grid into bytes for the terminal.

"use strict";

const COLS = 80;
const ROWS = 24;

const C = {
  black: 0, blue: 1, green: 2, cyan: 3, red: 4, magenta: 5, brown: 6, grey: 7,
  dgrey: 8, bblue: 9, bgreen: 10, bcyan: 11, bred: 12, bmagenta: 13, yellow: 14, white: 15
};

// Map area: each board space (subtile) is a 4x2 block; walls sit on the block's top row
// and left column, so neighbouring spaces share them.
const MAP_X = 0, MAP_Y = 1;
const VIEW_W = 13, VIEW_H = 10;          // spaces shown
const MAP_COLS = VIEW_W * 4 + 1;         // 53
const MAP_ROWS = VIEW_H * 2 + 1;         // 21
const SIDE_X = MAP_COLS + 1;             // sidebar starts at column 54
const SIDE_W = COLS - SIDE_X;            // 26

// What each kind of ground looks like: [fill char, fg, bg]
const GROUND = {
  "road":         [".", C.dgrey, C.black],
  "grass":        ["\"", C.green, C.black],
  "parking":      [":", C.grey, C.black],
  "building":     [" ", C.white, C.brown],
  "mall hallway": [".", C.cyan, C.black],
  "mall store":   [" ", C.white, C.magenta],
  "escalator":    ["≡", C.white, C.black],
  "water":        ["≈", C.bblue, C.blue],
  "wooded":       ["τ", C.green, C.black],
  "altar":        ["∩", C.bmagenta, C.black],
  "cave":         ["░", C.dgrey, C.black]
};

const PLAYER_COLORS = [C.yellow, C.bmagenta, C.white, C.bcyan, C.bgreen, C.bred];

const ZOMBIE_LOOK = {
  regular:  ["Z", C.bgreen],
  enhanced: ["Z", C.bred],
  dog:      ["d", C.bred],
  clown:    ["c", C.bmagenta]
};

// Box-drawing pieces by which sides have a wall: up, right, down, left
const JOIN = {
  "0000": " ", "1010": "│", "0101": "─",
  "1000": "│", "0010": "│", "0100": "─", "0001": "─",
  "0110": "┌", "0011": "┐", "1100": "└", "1001": "┘",
  "1110": "├", "1011": "┤", "0111": "┬", "1101": "┴", "1111": "┼"
};

function blankGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ ch: " ", fg: C.grey, bg: C.black })));
}

function put(grid, x, y, ch, fg = C.grey, bg = C.black) {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return;
  grid[y][x] = { ch, fg, bg };
}

function text(grid, x, y, s, fg = C.grey, bg = C.black, max = COLS - x) {
  [...String(s)].slice(0, max).forEach((ch, i) => put(grid, x + i, y, ch, fg, bg));
}

function zombieKind(game, type) {
  const Z = game.get("ZOMBIE_TYPE");
  if (type === Z.DOG) return "dog";
  if (Z.CLOWN && type === Z.CLOWN) return "clown";
  if (type && type !== Z.REGULAR) return "enhanced";
  return "regular";
}

// Look up the subtile at board space (sx, sy), or null.
function cellAt(game, state, sx, sy) {
  const tile = state.board.get(game.call("getSpaceTileKey", sx, sy));
  if (!tile || !tile.subTiles) return null;
  const { lx, ly } = game.call("getSpaceLocalCoords", sx, sy);
  return tile.subTiles[`${lx},${ly}`] || null;
}

const has = (list, dir) => Array.isArray(list) && list.includes(dir);

function drawMap(grid, game, state, center) {
  const sx0 = center.x - Math.floor(VIEW_W / 2);
  const sy0 = center.y - Math.floor(VIEW_H / 2);

  // Wall and door edges, from either side of each edge.
  const edge = (sx, sy, dir) => {
    const here = cellAt(game, state, sx, sy);
    const opp = { N: ["S", 0, -1], W: ["E", -1, 0] }[dir];
    const there = cellAt(game, state, sx + opp[1], sy + opp[2]);
    const wall = has(here?.walls, dir) || has(there?.walls, opp[0]);
    const door = has(here?.doors, dir) || has(there?.doors, opp[0]);
    return { wall: wall || door, door };
  };

  const pendingTiles = new Map();
  (state.pendingTileOptions || []).forEach((o, i) => {
    pendingTiles.set(`${o.x},${o.y}`, i === (state.doorSelectedOption || 0));
  });

  // Background of a space (buildings are shaded), used to join neighbouring building spaces.
  const bgAt = (sx, sy) => {
    const c = cellAt(game, state, sx, sy);
    return c ? (GROUND[c.type] || [0, 0, C.black])[2] : C.black;
  };
  const shared = (...bgs) => (bgs.every((b) => b === bgs[0]) ? bgs[0] : C.black);

  for (let vy = 0; vy <= VIEW_H; vy++) {
    for (let vx = 0; vx <= VIEW_W; vx++) {
      const sx = sx0 + vx, sy = sy0 + vy;
      const gx = MAP_X + vx * 4, gy = MAP_Y + vy * 2;

      // corner
      const up = edge(sx, sy - 1, "W").wall, left = edge(sx - 1, sy, "N").wall;
      const right = edge(sx, sy, "N").wall, down = edge(sx, sy, "W").wall;
      const corner = JOIN[`${+up}${+right}${+down}${+left}`];
      put(grid, gx, gy, corner, C.grey, shared(bgAt(sx, sy), bgAt(sx - 1, sy), bgAt(sx, sy - 1), bgAt(sx - 1, sy - 1)));
      if (vx === VIEW_W || vy === VIEW_H) {
        // closing column/row: just the wall edges of the last spaces
        if (vx < VIEW_W) { const n = edge(sx, sy, "N"); for (let i = 1; i <= 3; i++) put(grid, gx + i, gy, n.wall ? (n.door && i === 2 ? "+" : "─") : " ", n.door && i === 2 ? C.brown : C.grey); }
        if (vy < VIEW_H) { const w = edge(sx, sy, "W"); put(grid, gx, gy + 1, w.wall ? (w.door ? "+" : "│") : " ", w.door ? C.brown : C.grey); }
        continue;
      }

      // north wall (top row) and west wall (left column)
      const n = edge(sx, sy, "N");
      const nbg = shared(bgAt(sx, sy), bgAt(sx, sy - 1));
      for (let i = 1; i <= 3; i++) {
        put(grid, gx + i, gy, n.wall ? (n.door && i === 2 ? "+" : "─") : " ", n.door && i === 2 ? C.yellow : C.grey, nbg);
      }
      const w = edge(sx, sy, "W");
      put(grid, gx, gy + 1, w.wall ? (w.door ? "+" : "│") : " ", w.door ? C.yellow : C.grey, shared(bgAt(sx, sy), bgAt(sx - 1, sy)));

      // the space itself
      const cell = cellAt(game, state, sx, sy);
      if (!cell) {
        const tk = game.call("getSpaceTileKey", sx, sy);
        if (pendingTiles.has(tk)) {
          const sel = pendingTiles.get(tk);
          for (let i = 1; i <= 3; i++) put(grid, gx + i, gy + 1, sel ? "▓" : "░", sel ? C.yellow : C.dgrey);
        }
        continue;
      }
      const [fill, fg, bg] = GROUND[cell.type] || [".", C.dgrey, C.black];
      const slots = [];
      const spaceKey = `${sx},${sy}`;
      state.players.forEach((p, i) => {
        if (p.x === sx && p.y === sy && !p.knockedOut) slots.push(["@", PLAYER_COLORS[i % PLAYER_COLORS.length]]);
      });
      const z = state.zombies.get(spaceKey);
      if (z) {
        const [zc, zfg] = ZOMBIE_LOOK[zombieKind(game, z.type)];
        slots.push([zc, zfg]);
        if ((z.count || 1) > 1) slots.push([String(z.count), zfg]);
      }
      const tok = state.spaceTokens && state.spaceTokens.get(spaceKey);
      if (tok && tok.hearts > 0) slots.push(["♥", C.bred]);
      if (tok && tok.bullets > 0) slots.push(["■", C.yellow]);
      for (let i = 0; i < 3; i++) {
        const s = slots[i];
        put(grid, gx + 1 + i, gy + 1, s ? s[0] : fill, s ? s[1] : fg, bg);
      }
      if (slots.length > 3) put(grid, gx + 3, gy + 1, "+", C.white, bg);
    }
  }
}

function drawSidebar(grid, game, state, extra) {
  const STEP = game.get("STEP");
  const p = state.players[state.currentPlayerIndex];
  let y = MAP_Y;
  const line = (s, fg = C.grey) => { text(grid, SIDE_X, y++, s, fg, C.black, SIDE_W); };
  const rule = (label) => {
    text(grid, SIDE_X, y, "─".repeat(SIDE_W), C.dgrey);
    text(grid, SIDE_X + 1, y++, ` ${label} `, C.bcyan, C.black, SIDE_W - 2);
  };

  rule(`turn ${state.turnNumber}`);
  state.players.forEach((pl, i) => {
    const me = i === state.currentPlayerIndex;
    text(grid, SIDE_X, y, me ? "►" : " ", C.yellow);
    text(grid, SIDE_X + 1, y, "@", PLAYER_COLORS[i % PLAYER_COLORS.length]);
    text(grid, SIDE_X + 3, y, pl.name, me ? C.white : C.grey, C.black, 13);
    text(grid, SIDE_X + 17, y, `♥${pl.hearts}`, C.bred);
    text(grid, SIDE_X + 21, y, `■${pl.bullets}`, C.yellow);
    y++;
    text(grid, SIDE_X + 3, y++, `kills ${pl.kills}/25${pl.items.length ? `  items ${pl.items.length}` : ""}`, C.dgrey, C.black, SIDE_W - 3);
  });

  rule(String(state.step).toLowerCase().replace("_", " "));
  if (state.currentMoveRoll != null) line(`move roll ${state.currentMoveRoll}  left ${state.movesRemaining}`, C.white);
  if (state.currentZombieRoll != null) line(`zombie roll ${state.currentZombieRoll}`, C.bgreen);
  if (state.pendingTile) line(`placing: ${game.call("getTileDisplayName", state.pendingTile)}`, C.yellow);

  rule("hand");
  if (!p.hand.length) line("(empty)", C.dgrey);
  p.hand.slice(0, 5).forEach((card, i) => line(`${i + 1} ${card.name}`, C.grey));

  rule("keys");
  (extra.keys || []).forEach((k) => line(k, C.dgrey));
}

function drawLog(grid, state) {
  const lines = (state.logs || []).slice(0, 2);
  lines.forEach((l, i) => text(grid, 0, ROWS - 2 + i, l.text.replace(/^\[T\d+\]\s*/, ""), i === 0 ? C.white : C.dgrey));
}

// keys: list of short key hints for the sidebar; center: board space to centre on
function buildScreen(game, extra = {}) {
  const state = game.get("state");
  const grid = blankGrid();
  text(grid, 0, 0, " IC ZOMBIES ", C.black, C.green);
  text(grid, 12, 0, "─".repeat(COLS - 12), C.dgrey);
  text(grid, 14, 0, " zombies.sodamachine.net · bbs edition ", C.dgrey);
  const p = state.players[state.currentPlayerIndex];
  const center = extra.center || { x: p.x, y: p.y };
  drawMap(grid, game, state, center);
  drawSidebar(grid, game, state, extra);
  drawLog(grid, state);
  return grid;
}

module.exports = { buildScreen, COLS, ROWS, C, VIEW_W, VIEW_H };
