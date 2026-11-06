// The browser's stand-in for ../bbs/engine.js. The BBS door loads the web game's own scripts and
// plays by them; in Node that's done with the vm module, here with a hidden frame that holds the
// web page's markup (so the scripts find their elements) and runs the same scripts in the same
// order. Nothing in the frame is shown; the door draws the screen.

let frame = null, scripts = [];

// Called by the page before the door starts: the web page's HTML and its scripts' text, in order.
export async function prepareFrame(indexHtml, scriptTexts) {
  scripts = scriptTexts;
  const doc = new DOMParser().parseFromString(indexHtml, "text/html");
  doc.querySelectorAll("script, link[rel=stylesheet], link[rel=preload], link[rel=icon]").forEach((el) => el.remove());
  frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0;visibility:hidden";
  frame.srcdoc = "<!doctype html>" + doc.documentElement.outerHTML;
  await new Promise((ok) => { frame.addEventListener("load", ok, { once: true }); document.body.appendChild(frame); });
}

export function loadEngine({ onRender } = {}) {
  const win = frame.contentWindow, d = win.document;
  // Same stand-ins as ../bbs/engine.js: the web game's own saves stay in memory (so the terminal
  // never touches the web version's saved game), no dialogs, and no network until the door sets fetch.
  const mem = new Map();
  Object.defineProperty(win, "localStorage", { configurable: true, value: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; }
  } });
  win.alert = () => {}; win.confirm = () => true; win.prompt = () => null;
  win.requestAnimationFrame = (cb) => win.setTimeout(cb, 0);
  win.fetch = undefined;
  let failed = null;
  win.addEventListener("error", (e) => { if (!failed) failed = e.error || new Error(e.message); });
  for (const s of scripts) {
    const el = d.createElement("script");
    el.textContent = s.text + "\n//# sourceURL=" + location.origin + "/" + s.src;
    d.body.appendChild(el);                                  // runs now, like a <script> tag
    if (failed) { failed.message = s.src + ": " + failed.message; throw failed; }
  }
  win.render = () => { if (onRender) onRender(); };
  return {
    ctx: win,
    get: (name) => win.eval(name),
    call: (name, ...args) => (typeof win[name] === "function" ? win[name] : win.eval(name))(...args)
  };
}
