// The title screen: IC ZOMBIES in slanted, glowing letters, a survivor with a chainsaw, and the
// undead shambling in across a graveyard at night.
//
// Everything is drawn as pixel art on a canvas twice as tall as the screen, then folded into
// half-block characters (▀ ▄ █), two pixels per character cell. That gives rounder shapes than
// whole blocks, and lets one cell show two colors (top pixel as the character, bottom as its
// background). BBS backgrounds only come in the 8 dim colors, so a bright bottom pixel under a
// different top pixel is shown in its dim version.

"use strict";

const { blankGrid, text, put, COLS, ROWS, C } = require("./screen");

const PX_H = ROWS * 2;

// ---- the letters: 10 pixels tall ----
const FONT = {
  I: ["####", ".##.", ".##.", ".##.", ".##.", ".##.", ".##.", ".##.", ".##.", "####"],
  C: ["..####.", ".######", "##....#", "##.....", "##.....", "##.....", "##.....", "##....#", ".######", "..####."],
  Z: ["#######", "#######", ".....##", "....##.", "...##..", "..##...", ".##....", "##.....", "#######", "#######"],
  O: ["..####..", ".######.", "##....##", "##....##", "##....##", "##....##", "##....##", "##....##", ".######.", "..####.."],
  M: ["##.....##", "###...###", "####.####", "##.###.##", "##..#..##", "##.....##", "##.....##", "##.....##", "##.....##", "##.....##"],
  B: ["######.", "##...##", "##...##", "##..##.", "#####..", "##..##.", "##...##", "##...##", "##...##", "######."],
  E: ["#######", "##.....", "##.....", "##.....", "######.", "##.....", "##.....", "##.....", "##.....", "#######"],
  S: [".#####.", "##...##", "##.....", "##.....", ".#####.", ".....##", ".....##", "##...##", "##...##", ".#####."],
  " ": ["...", "...", "...", "...", "...", "...", "...", "...", "...", "..."]
};
// Top to bottom: a hot yellow edge fading through bright green to dark green.
const LETTER_SHADE = [C.yellow, C.yellow, C.bgreen, C.bgreen, C.bgreen, C.bgreen, C.green, C.green, C.green, C.green];
const SLANT = () => 0;                             // (room to lean the letters later)

// ---- the characters (each letter of a row is a pixel; "." is empty) ----
const PALETTE = {
  h: C.red, H: C.bred,            // cap
  s: C.brown, w: C.white,         // skin, eyes
  f: C.red, F: C.bred,            // flannel
  j: C.blue, J: C.bblue,          // jeans
  b: C.dgrey,                     // boots
  y: C.yellow, m: C.grey, t: C.white,   // chainsaw body, bar, teeth
  x: C.dgrey,                     // exhaust smoke
  g: C.green, G: C.bgreen, r: C.bred, n: C.dgrey,   // zombie skin, glow, red eyes, mouth
  p: C.magenta, c: C.cyan, o: C.brown, u: C.dgrey,  // zombie clothes
  k: C.grey, K: C.white                              // tombstone
};

const SURVIVOR = [
  "......hhhhh...........x.......",
  ".....hHHHHHh.........x.x......",
  "....hhhhhhhhhh.....x..........",
  "......sssss...................",
  "......swsws...................",
  "......sssss...................",
  ".......sss....................",
  ".....FfFfFfF..................",
  "....FfFfFfFfF.................",
  "....fFfFfFfFfss...............",
  "....FfFfFfFfFsyyyy............",
  "....fFfFfFfFf.yyyyyymmmmmmmmm.",
  "....FfFfFfFfF.yyyyyymtmtmtmtmt",
  "....jjjjjjjjj..yy.............",
  "....jJjjjjjJj.................",
  "....jjjj.jjjj.................",
  "....jJjj.jJjj.................",
  "....jjjj.jjjj.................",
  "....jjjj.jjjj.................",
  "...bbbbb.bbbbb................",
  "...bbbbb.bbbbb................"
];

// Shirt color varies per zombie (the "p" pixels).
const ZOMBIE = [
  ".....ggggg....",
  "....gGgggGg...",
  "....grgggrg...",
  "....ggggggg...",
  "....gnnnnng...",
  ".....ggggg....",
  "gggg.ppppppp..",
  "Ggggppppppppp.",
  ".....pppppppp.",
  ".....ppp.pppp.",
  ".....pppppppp.",
  ".....uuuuuuu..",
  ".....uuu.uuu..",
  ".....uuu.uuu..",
  "....uuu...uuu.",
  "....gg.....gg."
];

const TOMBSTONE = [
  "...K...",
  "..KKK..",
  "...K...",
  ".kkkkk.",
  "kkkkkkk",
  "kkkkkkk",
  "kkkkkkk",
  "kkkkkkk"
];

const MOON = [
  "..yyyy..",
  ".yyyyyy.",
  "yyoyyyyy",
  "yyyyyoyy",
  ".yyyyyy.",
  "..yyyy.."
];

function makeCanvas() { return Array.from({ length: PX_H }, () => new Array(COLS).fill(null)); }
function plot(cv, x, y, color) { if (y >= 0 && y < PX_H && x >= 0 && x < COLS && color != null) cv[y][x] = color; }

function stamp(cv, sprite, x0, y0, palette = PALETTE, flip = false) {
  sprite.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    plot(cv, flip ? x0 + row.length - 1 - x : x0 + x, y0 + y, palette[ch]);
  }));
}

function drawTitleText(cv, y0, str) {
  const glyphs = [...str].map((ch) => FONT[ch] || FONT[" "]);
  const width = glyphs.reduce((w, g) => w + g[0].length + 1, -1) + 3;   // + room for the slant
  let x = Math.floor((COLS - width) / 2);
  glyphs.forEach((g) => {
    g.forEach((row, py) => [...row].forEach((ch, px) => {
      if (ch !== "#") return;
      const sx = x + px + SLANT(py);
      // a dark shadow just under each letter, then the letter on top
      if (py === 9 || g[py + 1][px] !== "#") plot(cv, sx, y0 + py + 1, C.dgrey);
      plot(cv, sx, y0 + py, LETTER_SHADE[py]);
    }));
    x += g[0].length + 1;
  });
}

// Fold the pixel canvas into half-block characters on the grid.
function fold(cv, grid) {
  for (let row = 0; row < ROWS; row++) {
    for (let x = 0; x < COLS; x++) {
      const top = cv[row * 2][x], bot = cv[row * 2 + 1][x];
      if (top == null && bot == null) continue;
      if (top != null && bot == null) put(grid, x, row, "▀", top, C.black);
      else if (top == null) put(grid, x, row, "▄", bot, C.black);
      else if (top === bot) put(grid, x, row, "█", top, C.black);
      else if (bot < 8) put(grid, x, row, "▀", top, bot);
      else if (top < 8) put(grid, x, row, "▄", bot, top);
      else put(grid, x, row, "▀", top, bot & 7);
    }
  }
}

function buildTitle(sub) {
  const grid = blankGrid();
  const cv = makeCanvas();

  // the ground: two rows of grass, dithered
  for (let x = 0; x < COLS; x++) {
    for (let y = 40; y < 44; y++) plot(cv, x, y, (x + y) % 3 === 0 ? C.bgreen : C.green);
    if (x % 7 === 3) plot(cv, x, 39, C.green);   // tufts
  }

  stamp(cv, MOON, 71, 15);
  drawTitleText(cv, 2, "IC ZOMBIES");

  // the survivor (left, facing right) and the shambling dead (right, reaching left)
  stamp(cv, SURVIVOR, 3, 19);
  stamp(cv, TOMBSTONE, 37, 32);
  const shirts = [C.magenta, C.cyan, C.brown];
  [[44, 24], [56, 22], [67, 24]].forEach(([x, y], i) => stamp(cv, ZOMBIE, x, y, { ...PALETTE, p: shirts[i] }));

  fold(cv, grid);

  // stars, then the words, which go on top of nothing (rows the art leaves empty)
  [[2, 0], [11, 1], [24, 0], [38, 1], [52, 0], [63, 1], [77, 0], [6, 8], [74, 9], [30, 9], [48, 8]]
    .forEach(([x, y]) => { if (grid[y][x].ch === " ") put(grid, x, y, "·", C.grey); });
  const tag = sub || "an Iowa City zombie survival game";
  text(grid, Math.floor((COLS - tag.length) / 2), 8, tag, C.white);
  const prompt = " press any key ";
  text(grid, Math.floor((COLS - prompt.length) / 2), 22, prompt, C.black, C.brown);
  text(grid, 1, ROWS - 1, "sodamachine bbs", C.dgrey);
  return grid;
}

module.exports = { buildTitle };
