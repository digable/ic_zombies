// IC Zombies, terminal version: the BBS door (../bbs/door.js) running in this tab, drawn on an
// emulated 80x24 ANSI screen. Same game and rules as the website and the BBS; online games are
// shared with both.
import { attach, T, tFeed, render, repaintAll } from "./term.js";
import { makeProcess, runDoor } from "./node.js";
import { prepareFrame } from "./engine.js";

const $ = (id) => document.getElementById(id);
const ROOT = new URL("../", import.meta.url);
const DOOR_FILES = ["door.js", "engine.js", "screen.js", "title.js", "ansi.js", "saves.js"];
const NAME_KEY = "icz-terminal-name";
const MAX_NAME = 20;   // the door keeps 20 characters of a BBS name

attach($("screen"));

// ---- screen loop ------------------------------------------------------------------------
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastBlink = 0;
(function frame() {
  const now = performance.now();
  if (!reduceMotion && now - lastBlink > 530) { lastBlink = now; T.blink = !T.blink; T.dirty = true; }
  if (T.dirty) { render(); T.dirty = false; }
  requestAnimationFrame(frame);
})();
document.fonts && document.fonts.ready.then(repaintAll);

function showErr(e) {
  console.error(e);
  $("err").hidden = false;
  $("err").textContent = "Something went wrong: " + (e && e.message ? e.message : e) + "\nReload the page to start again.";
}

// ---- keys: whoever is listening (the name prompt, then the door) -----------------------------
let onKey = () => {};
export function pressKey(s) { onKey(s); }

// ---- the name prompt ---------------------------------------------------------------------
function getSaved() { try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; } }
function setSaved(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* blocked: ask again next time */ } }
const clean = (s) => s.replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);

function askName() {
  return new Promise((done) => {
    let name = getSaved(), hint = "";
    const draw = () => {
      tFeed("\x1b[0m\x1b[2J\x1b[?25l");
      tFeed("\x1b[3;5H\x1b[1;32mIC ZOMBIES\x1b[0;37m  terminal version");
      tFeed("\x1b[5;5HThe BBS game, played in your browser. Same game and rules as the website,");
      tFeed("\x1b[6;5Hand online games are shared with web and BBS players.");
      tFeed("\x1b[9;5H\x1b[1;37mWhat's your name?\x1b[0;37m  It goes on your survivor and in online games.");
      tFeed("\x1b[11;5H\x1b[0;37;44m " + name + "\x1b[1;33m_\x1b[0;37;44m" + " ".repeat(MAX_NAME - name.length) + " \x1b[0m");
      tFeed("\x1b[13;5H\x1b[1;33m" + hint + "\x1b[0m");
      tFeed("\x1b[15;5H\x1b[1;36mENTER\x1b[0;37m start   \x1b[1;36mBACKSPACE\x1b[0;37m erase");
      tFeed("\x1b[18;5H\x1b[1;30mUp to " + MAX_NAME + " characters. Your saved game stays in this browser.\x1b[0m");
    };
    onKey = (k) => {
      hint = "";
      if (k === "\r") {
        const n = clean(name);
        if (!/^[A-Za-z]/.test(n)) hint = "Start with a letter.";
        else { setSaved(n); onKey = () => {}; return done(n); }
      } else if (k === "\b" || k === "\x7f") name = name.slice(0, -1);
      else if (k.length === 1 && k >= " " && k <= "~" && name.length < MAX_NAME) name += k;
      draw();
    };
    draw();
  });
}

// ---- loading the game ---------------------------------------------------------------------
async function text(rel) {
  const r = await fetch(new URL(rel, ROOT), { cache: "no-cache" });
  if (!r.ok) throw new Error(`couldn't load ${rel} (${r.status})`);
  return r.text();
}
async function load() {
  const indexHtml = await text("index.html");
  // The web game's scripts, in the order its page lists them (bootstrap.js only drives the web page)
  const srcs = [...indexHtml.matchAll(/<script[^>]*\ssrc="([^"]+\.js)"/g)].map((m) => m[1])
    .filter((s) => !/^(https?:)?\/\//.test(s) && s !== "scripts/bootstrap.js");
  const [scriptTexts, doorTexts] = await Promise.all([
    Promise.all(srcs.map(async (src) => ({ src, text: await text(src) }))),
    Promise.all(DOOR_FILES.map((f) => text("bbs/" + f)))
  ]);
  await prepareFrame(indexHtml, scriptTexts);
  const sources = {};
  DOOR_FILES.forEach((f, i) => { sources["/bbs/" + f] = doorTexts[i]; });
  return sources;
}

async function start() {
  tFeed("\x1b[2J\x1b[3;5HLoading IC Zombies...");
  let sources;
  try { sources = await load(); } catch (e) { return showErr(e); }
  const name = await askName();
  tFeed("\x1b[0m\x1b[2J");
  let door = null;
  const proc = makeProcess({
    argv: ["--name", name],
    env: { ICZ_API: location.origin, ICZ_SAVE_DIR: "/saves", DOOR_GLYPHS: "1" },
    write: tFeed,
    onExit: () => {
      setTimeout(() => {
        if (door) door.stopTimers();
        tFeed("\r\n\x1b[1;36mPress any key to play again.\x1b[0m");
        onKey = () => location.reload();
      }, 50);
    }
  });
  onKey = (k) => { try { proc.send(k); } catch (e) { showErr(e); } };
  door = runDoor(sources, proc, showErr);
}
// ---- the real keyboard, the on-screen keys and the phone keyboard ---------------------------
const SPECIAL = { Enter: "\r", Backspace: "\b", Escape: "\x1b", Tab: "\t",
  ArrowUp: "\x1b[A", ArrowDown: "\x1b[B", ArrowRight: "\x1b[C", ArrowLeft: "\x1b[D" };
const kbIn = $("kbIn"), kbBtn = $("kbBtn");
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tg = e.target, tag = tg.tagName;
  const ch = e.key.length === 1 ? e.key : SPECIAL[e.key];
  if (ch == null) return;
  if (tg === kbIn && e.key.length === 1) return;            // phone keyboard letters come through "input"
  if ((tag === "BUTTON" || tag === "A") && (e.key === "Enter" || e.key === " ")) return;
  if (tag === "A" && e.key === "Tab") return;
  e.preventDefault();
  if (e.repeat && !/^Arrow/.test(e.key)) return;             // holding an arrow keeps moving
  pressKey(ch);
});
document.querySelectorAll("[data-key]").forEach((b) => {
  const ch = JSON.parse('"' + b.dataset.key + '"');
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); pressKey(ch); });
  b.addEventListener("click", (e) => { if (e.detail === 0) pressKey(ch); });
});
kbBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (document.activeElement === kbIn) kbIn.blur(); else kbIn.focus({ preventScroll: true });
});
kbBtn.addEventListener("click", (e) => { if (e.detail === 0) kbIn.focus({ preventScroll: true }); });
kbIn.addEventListener("focus", () => { kbBtn.setAttribute("aria-pressed", "true"); kbBtn.textContent = "hide keyboard"; document.body.classList.add("kb-open");
  window.scrollTo({ top: Math.max(0, $("bezel").getBoundingClientRect().top + scrollY - 8), behavior: "smooth" }); });
kbIn.addEventListener("blur", () => { kbBtn.setAttribute("aria-pressed", "false"); kbBtn.textContent = "abc"; document.body.classList.remove("kb-open"); });
kbIn.addEventListener("beforeinput", (e) => {
  if (e.inputType === "deleteContentBackward") { e.preventDefault(); pressKey("\b"); }
  else if (e.inputType === "insertLineBreak") { e.preventDefault(); pressKey("\r"); }
});
kbIn.addEventListener("input", () => { const v = kbIn.value; kbIn.value = ""; for (const ch of v) pressKey(ch === "\n" ? "\r" : ch); });
$("screen").addEventListener("click", () => { if (matchMedia("(pointer: coarse)").matches) kbIn.focus({ preventScroll: true }); });

start();
