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
  "·": 250, "∙": 249, "»": 175, "°": 248,
  "♥": 3          // heart: CP437 glyph 3, only sent with DOOR_GLYPHS=1 (see SAFE)
};

// CP437's heart lives at byte 3, which most terminals treat as a control code and drop,
// so by default hearts are drawn as a red "+" (health). Set DOOR_GLYPHS=1 to try the real one.
const SAFE = { "♥": "+" };

// Characters with no CP437 equivalent (arrows etc.) get a plain stand-in.
const FALLBACK = { "►": "»", "↑": "^", "↓": "v", "←": "<", "→": ">" };

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

const CLEAR = "\x1b[0m\x1b[2J\x1b[H";
const SHOW_CURSOR = "\x1b[0m\x1b[?25h";

module.exports = { render, CLEAR, SHOW_CURSOR };