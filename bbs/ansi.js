// Turns a screen grid (from screen.js) into ANSI escape codes for the terminal.
//
// BBS terminals use the old IBM PC character set (CP437), not UTF-8, so box-drawing and
// block characters are converted to their CP437 byte. Pass utf8: true to get plain UTF-8
// instead (handy for trying the door in a normal terminal, like VS Code's).

"use strict";

// Unicode -> CP437 byte for every special character the screen uses.
const CP437 = {
  "─": 196, "│": 179, "┌": 218, "┐": 191, "└": 192, "┘": 217,
  "├": 195, "┤": 180, "┬": 194, "┴": 193, "┼": 197,
  "░": 176, "▒": 177, "▓": 178, "█": 219,
  "≈": 247, "≡": 240, "τ": 231, "∩": 239, "■": 254,
  "·": 250, "∙": 249, "»": 175, "°": 248, "½": 171, "¼": 172,
  "═": 205, "║": 186, "╔": 201, "╗": 187, "╚": 200, "╝": 188, "Θ": 233,
  "▄": 220, "▀": 223, "▐": 222, "▌": 221, "╫": 215,
  "♥": 3          // heart: CP437 glyph 3, only sent with DOOR_GLYPHS=1 (see SAFE)
};

// CP437's heart lives at byte 3, which most terminals treat as a control code and drop,
// so by default hearts are drawn as a red "+" (health). Set DOOR_GLYPHS=1 to try the real one.
const SAFE = { "♥": "+" };

// Characters with no CP437 equivalent (arrows etc.) get a plain stand-in.
// (The game's log text uses dashes and curly quotes too.)
const FALLBACK = {
  "►": "»", "↑": "^", "↓": "v", "←": "<", "→": ">",
  "—": "-", "–": "-", "‘": "'", "’": "'", "“": "\"", "”": "\"", "…": ".", "×": "x"
};

const FG = [30, 34, 32, 36, 31, 35, 33, 37]; // ANSI order differs from BBS color numbers
function sgr(fg, bg) {
  const bright = fg >= 8 ? 1 : 0;
  return `\x1b[0;${bright ? "1;" : ""}${FG[fg & 7]};${FG[bg & 7] + 10}m`;
}

function encodeChar(ch, utf8, safe) {
  if (utf8) return Buffer.from(ch, "utf8");
  let c = FALLBACK[ch] || ch;
  if (safe && SAFE[c]) c = SAFE[c];
  if (CP437[c] !== undefined) return Buffer.from([CP437[c]]);
  const code = c.charCodeAt(0);
  return Buffer.from([code >= 32 && code < 127 ? code : 63]); // "?" for anything unknown
}

// Full-screen redraw. Returns a Buffer ready to write to the terminal.
function render(grid, { utf8 = false, safe = process.env.DOOR_GLYPHS !== "1" } = {}) {
  const parts = [Buffer.from("\x1b[?25l\x1b[H")];
  grid.forEach((row, y) => {
    let cur = "";
    parts.push(Buffer.from(`\x1b[${y + 1};1H`));
    // Never write the bottom-right cell: on many terminals that scrolls the whole screen up.
    const cells = y === grid.length - 1 ? row.slice(0, -1) : row;
    cells.forEach((cell) => {
      const code = sgr(cell.fg, cell.bg);
      if (code !== cur) { parts.push(Buffer.from(code)); cur = code; }
      parts.push(encodeChar(cell.ch, utf8, safe));
    });
  });
  parts.push(Buffer.from("\x1b[0m"));
  return Buffer.concat(parts);
}

// Redraw only the cells that differ from `prev`, the grid already on the terminal (null means
// nothing is known, so everything is drawn). A keypress usually changes a handful of the
// 1,920 cells, so this sends ~100 bytes instead of ~5 KB — it matters on slow BBS links.
// Unchanged gaps of up to GAP_CELLS are rewritten rather than skipped, because a cursor
// jump costs about as many bytes as a few cells.
const GAP_CELLS = 4;
const sameCell = (a, b) => a.ch === b.ch && a.fg === b.fg && a.bg === b.bg;

function renderDiff(prev, grid, opts = {}) {
  if (!prev) return render(grid, opts);
  const { utf8 = false, safe = process.env.DOOR_GLYPHS !== "1" } = opts;
  const parts = [];
  let cur = "";
  grid.forEach((row, y) => {
    // Never write the bottom-right cell: on many terminals that scrolls the whole screen up.
    const width = y === grid.length - 1 ? row.length - 1 : row.length;
    let x = 0;
    while (x < width) {
      if (sameCell(prev[y][x], row[x])) { x++; continue; }
      let end = x + 1;
      for (let i = x + 1, gap = 0; i < width && gap <= GAP_CELLS; i++) {
        if (sameCell(prev[y][i], row[i])) gap++;
        else { end = i + 1; gap = 0; }
      }
      parts.push(Buffer.from(`\x1b[${y + 1};${x + 1}H`));
      for (let i = x; i < end; i++) {
        const code = sgr(row[i].fg, row[i].bg);
        if (code !== cur) { parts.push(Buffer.from(code)); cur = code; }
        parts.push(encodeChar(row[i].ch, utf8, safe));
      }
      x = end;
    }
  });
  if (!parts.length) return Buffer.alloc(0);
  return Buffer.concat([Buffer.from("\x1b[?25l"), ...parts, Buffer.from("\x1b[0m")]);
}

// Redraw just a few cells (used to flash the current player's space without a full redraw).
function renderCells(cells, { utf8 = false, safe = process.env.DOOR_GLYPHS !== "1" } = {}) {
  const parts = [];
  cells.forEach((c) => {
    parts.push(Buffer.from(`\x1b[${c.y + 1};${c.x + 1}H${sgr(c.fg, c.bg)}`), encodeChar(c.ch, utf8, safe));
  });
  parts.push(Buffer.from("\x1b[0m"));
  return Buffer.concat(parts);
}

const CLEAR = "\x1b[0m\x1b[2J\x1b[H";
const SHOW_CURSOR = "\x1b[0m\x1b[?25h";

module.exports = { render, renderDiff, renderCells, CLEAR, SHOW_CURSOR };