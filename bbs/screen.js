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
function cellOnBoard(game, state, sx, sy) {
  const tile = state.board.get(game.call("getSpaceTileKey", sx, sy));
  if (!tile || !tile.subTiles) return null;
  const { lx, ly } = game.call("getSpaceLocalCoords", sx, sy);
  return tile.subTiles[`${lx},${ly}`] || null;
}

const has = (list, dir) => Array.isArray(list) && list.includes(dir);

function drawMap(grid, game, state, center, extra = {}) {
  const sx0 = center.x - Math.floor(VIEW_W / 2);
  const sy0 = center.y - Math.floor(VIEW_H / 2);
  const DIM = game.get("TILE_DIM");

  // While placing a tile, the drawn tile is previewed at the chosen spot (preview = {x, y, subTiles}).
  const preview = extra.preview || null;
  const tileOf = (v) => Math.floor(v / DIM);
  const inPreview = (sx, sy) => !!preview && tileOf(sx) === preview.x && tileOf(sy) === preview.y;
  const cellAt = (g, st, sx, sy) => {
    if (inPreview(sx, sy)) {
      const lx = sx - preview.x * DIM, ly = sy - preview.y * DIM;
      return preview.subTiles[`${lx},${ly}`] || null;
    }
    return cellOnBoard(g, st, sx, sy);
  };
  const wallColor = (...spaces) => (spaces.some(([x, y]) => inPreview(x, y)) ? C.yellow : C.grey);

  // Wall and door edges, from either side of each edge.
  const edge = (sx, sy, dir) => {
    const here = cellAt(game, state, sx, sy);
    const opp = { N: ["S", 0, -1], W: ["E", -1, 0] }[dir];
    const there = cellAt(game, state, sx + opp[1], sy + opp[2]);
    const wall = has(here?.walls, dir) || has(there?.walls, opp[0]);
    const door = has(here?.doors, dir) || has(there?.doors, opp[0]);
    return { wall: wall || door, door };
  };

  // Other spots the tile could go (for the current rotation), shaded.
  const otherSpots = new Set(extra.spots || []);

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
      put(grid, gx, gy, corner, wallColor([sx, sy], [sx - 1, sy], [sx, sy - 1], [sx - 1, sy - 1]), shared(bgAt(sx, sy), bgAt(sx - 1, sy), bgAt(sx, sy - 1), bgAt(sx - 1, sy - 1)));
      if (vx === VIEW_W || vy === VIEW_H) {
        // closing column/row: just the wall edges of the last spaces
        if (vx < VIEW_W) { const n = edge(sx, sy, "N"); for (let i = 1; i <= 3; i++) put(grid, gx + i, gy, n.wall ? (n.door && i === 2 ? "+" : "─") : " ", n.door && i === 2 ? C.yellow : wallColor([sx, sy], [sx, sy - 1])); }
        if (vy < VIEW_H) { const w = edge(sx, sy, "W"); put(grid, gx, gy + 1, w.wall ? (w.door ? "+" : "│") : " ", w.door ? C.yellow : wallColor([sx, sy], [sx - 1, sy])); }
        continue;
      }

      // north wall (top row) and west wall (left column)
      const n = edge(sx, sy, "N");
      const nbg = shared(bgAt(sx, sy), bgAt(sx, sy - 1));
      for (let i = 1; i <= 3; i++) {
        put(grid, gx + i, gy, n.wall ? (n.door && i === 2 ? "+" : "─") : " ", n.door && i === 2 ? C.yellow : wallColor([sx, sy], [sx, sy - 1]), nbg);
      }
      const w = edge(sx, sy, "W");
      put(grid, gx, gy + 1, w.wall ? (w.door ? "+" : "│") : " ", w.door ? C.yellow : wallColor([sx, sy], [sx - 1, sy]), shared(bgAt(sx, sy), bgAt(sx - 1, sy)));

      // the space itself
      const cell = cellAt(game, state, sx, sy);
      if (!cell) {
        if (otherSpots.has(`${tileOf(sx)},${tileOf(sy)}`)) {
          for (let i = 1; i <= 3; i++) put(grid, gx + i, gy + 1, "░", C.dgrey);
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
  // the sidebar stops above the two log lines
  const line = (s, fg = C.grey) => { if (y < ROWS - 2) text(grid, SIDE_X, y, s, fg, C.black, SIDE_W); y++; };
  const rule = (label) => {
    if (y >= ROWS - 3) { y++; return; }
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
  if (state.lastCombatResult) line(`last fight: ${state.lastCombatResult}`, C.bred);
  if (state.pendingTile) {
    line(`placing: ${game.call("getTileDisplayName", state.pendingTile)}`, C.yellow);
    if (extra.spotInfo) line(extra.spotInfo, C.dgrey);
  }

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
  drawMap(grid, game, state, center, extra);
  drawSidebar(grid, game, state, extra);
  drawLog(grid, state);
  return grid;
}

// Full-screen help: what the map symbols mean and which keys work at each step.
function buildHelp() {
  const grid = blankGrid();
  text(grid, 0, 0, " IC ZOMBIES ", C.black, C.green);
  text(grid, 12, 0, "\u2500".repeat(COLS - 12), C.dgrey);
  text(grid, 14, 0, " help: keys and symbols ", C.white);

  // left: map legend
  let y = 2;
  const head = (x, label) => { text(grid, x, y, label, C.bcyan); y++; };
  head(1, "ON THE MAP");
  const sym = (cells, label) => {
    cells.forEach(([ch, fg, bg], i) => put(grid, 2 + i, y, ch, fg, bg === undefined ? C.black : bg));
    text(grid, 7, y++, label, C.grey);
  };
  sym([["@", C.yellow], ["@", C.bmagenta]], "players (each has a color)");
  sym([["Z", C.bgreen]], "zombie");
  sym([["Z", C.bred]], "government-enhanced zombie");
  sym([["d", C.bred]], "zombie dog");
  sym([["c", C.bmagenta]], "zombie clown");
  sym([["Z", C.bgreen], ["2", C.bgreen]], "a number = how many there");
  sym([["\u2665", C.bred]], "heart token (pick it up)");
  sym([["\u25a0", C.yellow]], "bullet token (pick it up)");
  sym([[" ", C.white, C.brown], [" ", C.white, C.brown], [" ", C.white, C.brown]], "inside a building");
  sym([["\u2500", C.grey], ["+", C.yellow], ["\u2500", C.grey]], "wall with a door");
  sym([[".", C.dgrey], [".", C.dgrey], [".", C.dgrey]], "road");
  sym([["\"", C.green], ["\"", C.green], ["\"", C.green]], "grass");
  sym([[":", C.grey], [":", C.grey], [":", C.grey]], "parking lot");
  sym([["\u2248", C.bblue, C.blue], ["\u03c4", C.green]], "water, woods");
  sym([["\u2500", C.yellow], ["\u2500", C.yellow], ["\u2500", C.yellow]], "tile you're placing");
  sym([["\u2591", C.dgrey], ["\u2591", C.dgrey], ["\u2591", C.dgrey]], "other spots it fits");

  // right: each turn
  y = 2;
  const X = 40;
  text(grid, X, y++, "EACH TURN", C.bcyan);
  const step = (n, name, keys) => {
    text(grid, X, y, `${n}`, C.yellow);
    text(grid, X + 2, y, name, C.white);
    text(grid, X + 15, y++, keys, C.grey, C.black, COLS - X - 15);
  };
  step(1, "draw a tile", "t, then arrows/Tab");
  text(grid, X + 15, y++, "pick, r turn, Enter", C.grey);
  step(2, "fight", "c   bad roll: b bullet,");
  text(grid, X + 15, y++, "h heart, l lose", C.grey);
  step(3, "draw cards", "e");
  step(4, "roll", "r");
  step(5, "move", "arrows/wasd, x stop");
  step(6, "zombies", "z");
  step(7, "discard", "1-3 discard, n keep");
  step(8, "end turn", "Enter");
  y++;
  text(grid, X, y++, "Space", C.yellow);
  text(grid, X + 2, y++, "does the next step for you", C.grey);
  y++;
  text(grid, X, y++, "ANYTIME", C.bcyan);
  text(grid, X, y, "1-9", C.yellow); text(grid, X + 6, y++, "play a card / pick an option", C.grey);
  text(grid, X, y, "?", C.yellow); text(grid, X + 6, y++, "this help", C.grey);
  text(grid, X, y, "q q", C.yellow); text(grid, X + 6, y++, "quit", C.grey);

  text(grid, 0, ROWS - 1, " press any key to go back to the game ", C.black, C.grey);
  return grid;
}

module.exports = { buildScreen, buildHelp, COLS, ROWS, C, VIEW_W, VIEW_H };