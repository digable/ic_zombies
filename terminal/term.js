// The caller's screen: an ANSI parser drawing CP437 cells on a canvas (80x24).
// From IC Disc Golf's emulator (scripts/terminal.js), trimmed for the zombies door.

export const COLS = 80, ROWS = 24, CW = 16, CH = 32;
const PAL = ["#000000","#AA0000","#00AA00","#AA5500","#0000AA","#AA00AA","#00AAAA","#AAAAAA",
             "#555555","#FF5555","#55FF55","#FFFF55","#5555FF","#FF55FF","#55FFFF","#FFFFFF"];

let cv, ctx;
const chars = new Array(COLS * ROWS).fill(" ");
const attrs = new Uint16Array(COLS * ROWS).fill(7); // fg (0-15, ANSI order: 1 red, 4 blue) | bg << 4 | 0x100 blink
export const T = { x: 0, y: 0, attr: 7, cursor: true, dirty: true, blink: true, st: 0, params: "", sx: 0, sy: 0 };

export function attach(canvas) {
  cv = canvas; ctx = cv.getContext("2d");
  cv.width = COLS * CW; cv.height = ROWS * CH;
  repaintAll();
}

export function tClear() { chars.fill(" "); attrs.fill(T.attr & 0x70); T.x = 0; T.y = 0; T.dirty = true; }
function tScroll() {
  chars.copyWithin(0, COLS); attrs.copyWithin(0, COLS);
  for (let i = (ROWS - 1) * COLS; i < ROWS * COLS; i++) { chars[i] = " "; attrs[i] = 7; }
}
function tLF() { T.y++; if (T.y >= ROWS) { tScroll(); T.y = ROWS - 1; } }
function tPut(ch) {
  if (T.wrap) { T.wrap = false; T.x = 0; tLF(); }   // deferred wrap, like a real terminal
  const i = T.y * COLS + T.x; chars[i] = ch; attrs[i] = T.attr;
  if (T.x === COLS - 1) T.wrap = true; else T.x++;
}
function sgr(p) {
  const n = p === "" ? [0] : p.split(";").map((v) => (v === "" ? 0 : +v));
  for (const v of n) {
    if (v === 0) T.attr = 7;
    else if (v === 1) T.attr |= 8;
    else if (v === 22) T.attr &= ~8;
    else if (v === 5) T.attr |= 0x100;
    else if (v === 25) T.attr &= ~0x100;
    else if (v >= 30 && v <= 37) T.attr = (T.attr & ~7) | (v - 30);
    else if (v >= 40 && v <= 47) T.attr = (T.attr & ~0x70) | ((v - 40) << 4);
  }
}
function csi(final, p) {
  const priv = p[0] === "?";
  const n = (priv ? p.slice(1) : p).split(";").map((v) => (v === "" ? NaN : +v));
  const a = (k, d) => (isNaN(n[k]) ? d : n[k]);
  switch (final) {
    case "H": case "f": T.y = Math.min(Math.max(a(0, 1) - 1, 0), ROWS - 1); T.x = Math.min(Math.max(a(1, 1) - 1, 0), COLS - 1); break;
    case "A": T.y = Math.max(0, T.y - a(0, 1)); break;
    case "B": T.y = Math.min(ROWS - 1, T.y + a(0, 1)); break;
    case "C": T.x = Math.min(COLS - 1, T.x + a(0, 1)); break;
    case "D": T.x = Math.max(0, T.x - a(0, 1)); break;
    case "J": if (a(0, 0) === 2) { const k = T.x, l = T.y; tClear(); T.x = k; T.y = l; } else { for (let i = T.y * COLS + T.x; i < COLS * ROWS; i++) { chars[i] = " "; attrs[i] = T.attr & 0x70; } } break;
    case "K": for (let i = T.x; i < COLS; i++) { chars[T.y * COLS + i] = " "; attrs[T.y * COLS + i] = T.attr & 0x70; } break;
    case "s": T.sx = T.x; T.sy = T.y; break;
    case "u": T.x = T.sx; T.y = T.sy; break;
    case "h": case "l": if (priv && a(0) === 25) T.cursor = final === "h"; break;
    case "m": sgr(p); break;
  }
}
export function tFeed(s) {
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (T.st === 1) { if (ch === "[") { T.st = 2; T.params = ""; } else T.st = 0; continue; }
    if (T.st === 2) {
      if (/[0-9;?]/.test(ch)) { T.params += ch; continue; }
      T.st = 0; T.wrap = false; csi(ch, T.params); continue;
    }
    switch (ch) {
      case "\x1b": T.st = 1; break;
      case "\r": T.x = 0; T.wrap = false; break;
      case "\n": tLF(); break;
      case "\b": if (T.wrap) T.wrap = false; else if (T.x > 0) T.x--; break;
      case "\f": tClear(); break;
      case "\x07": case "\0": break;
      default: tPut(ch);
    }
  }
  T.dirty = true;
}

const patCache = {};
function shade(color, level) {
  const key = color + level;
  if (patCache[key]) return patCache[key];
  const p = document.createElement("canvas"); p.width = 4; p.height = 4;
  const g = p.getContext("2d"); g.fillStyle = color;
  if (level === 1) g.fillRect(0, 0, 2, 2);
  else if (level === 2) { g.fillRect(0, 0, 2, 2); g.fillRect(2, 2, 2, 2); }
  else { g.fillRect(0, 0, 4, 4); g.clearRect(2, 2, 2, 2); }
  return (patCache[key] = ctx.createPattern(p, "repeat"));
}
// CP437: bytes 128-255 drawn as their DOS glyphs, plus the heart (3)
const CP437_HI = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
const CP = { "\x03": "♥" };
for (let i = 0; i < 128; i++) CP[String.fromCharCode(128 + i)] = CP437_HI[i];
const SH = { "░": 1, "▒": 2, "▓": 3 };
// Only cells that changed since the last frame are redrawn; each cell is drawn inside its own box.
const shownCh = new Array(COLS * ROWS).fill(null), shownAt = new Uint16Array(COLS * ROWS);
let redrawAll = true, shownCursor = -1, shownBlink = true;
function drawCell(i) {
  const a = attrs[i], px = (i % COLS) * CW, py = Math.floor(i / COLS) * CH;
  ctx.fillStyle = PAL[(a >> 4) & 7]; ctx.fillRect(px, py, CW, CH);
  let ch = chars[i];
  if (ch === " " || ((a & 0x100) && !T.blink)) return;
  ch = CP[ch] || ch;
  const col = PAL[a & 15];
  if (ch === "█") { ctx.fillStyle = col; ctx.fillRect(px, py, CW, CH); }
  else if (ch === "▄") { ctx.fillStyle = col; ctx.fillRect(px, py + CH / 2, CW, CH / 2); }
  else if (ch === "▀") { ctx.fillStyle = col; ctx.fillRect(px, py, CW, CH / 2); }
  else if (ch === "▌") { ctx.fillStyle = col; ctx.fillRect(px, py, CW / 2, CH); }
  else if (ch === "▐") { ctx.fillStyle = col; ctx.fillRect(px + CW / 2, py, CW / 2, CH); }
  else if (SH[ch]) { ctx.fillStyle = shade(col, SH[ch]); ctx.fillRect(px, py, CW, CH); }
  else {
    ctx.fillStyle = col;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, CW, CH); ctx.clip();
    ctx.fillText(ch, px + CW / 2, py + CH * 0.78);
    ctx.restore();
  }
}
export function render() {
  if (!ctx) return;
  ctx.font = CH + 'px "VT323", "Courier New", monospace';
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const cur = T.cursor && T.blink ? T.y * COLS + T.x : -1, flip = T.blink !== shownBlink;
  for (let i = 0; i < COLS * ROWS; i++) {
    if (redrawAll || chars[i] !== shownCh[i] || attrs[i] !== shownAt[i] || i === cur || i === shownCursor || (flip && (attrs[i] & 0x100))) {
      drawCell(i);
      shownCh[i] = chars[i]; shownAt[i] = attrs[i];
    }
  }
  redrawAll = false;
  if (cur >= 0) { ctx.fillStyle = PAL[7]; ctx.fillRect(T.x * CW, T.y * CH + CH - 6, CW, 4); }
  shownCursor = cur;
  shownBlink = T.blink;
}
export function repaintAll() { redrawAll = true; T.dirty = true; }
