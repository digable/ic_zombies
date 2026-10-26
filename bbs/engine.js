// Loads the browser game's own scripts into Node, unchanged, so the BBS door plays by
// exactly the same rules as the web version.
//
// The scripts are read in the order index.html lists them (so new files are picked up
// automatically) and run in one shared sandbox, the way a browser runs classic <script> tags.
// Anything that touches the page (document, refs.board, ...) gets a harmless stand-in.

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

// Scripts that only drive the web page; the door does its own input and drawing.
const SKIP = new Set(["scripts/bootstrap.js"]);

// A stand-in for any DOM element: every property read, call or assignment quietly works.
function makeStub() {
  const fn = function () {};
  return new Proxy(fn, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => "";
      if (prop === Symbol.iterator) return [][Symbol.iterator];
      if (prop === "length") return 0;
      if (prop === "value" || prop === "textContent" || prop === "innerHTML") return "";
      if (prop === "checked" || prop === "disabled" || prop === "hidden") return false;
      if (prop === "then") return undefined; // never look like a Promise
      return makeStub();
    },
    set() { return true; },
    apply() { return makeStub(); },
    construct() { return makeStub(); }
  });
}

function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+\.js)"/g)]
    .map((m) => m[1])
    .filter((src) => !src.startsWith("http") && !SKIP.has(src));
}

function loadEngine({ onRender } = {}) {
  const memoryStore = new Map();
  const document = new Proxy({}, {
    get(_t, prop) {
      if (prop === "querySelectorAll" || prop === "getElementsByClassName") return () => [];
      if (prop === "readyState") return "complete";
      return makeStub();
    }
  });

  const sandbox = {
    console,
    document,
    navigator: { userAgent: "ic-zombies-bbs-door", clipboard: makeStub() },
    location: { href: "", search: "", hash: "", origin: "", pathname: "/" },
    localStorage: {
      getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
      setItem: (k, v) => memoryStore.set(k, String(v)),
      removeItem: (k) => memoryStore.delete(k)
    },
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    alert: () => {}, confirm: () => true, prompt: () => null,
    fetch: undefined
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const src of scriptList()) {
    const file = path.join(ROOT, src);
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: src });
  }

  // The rules call render() after every change; send that to the door's screen instead.
  sandbox.render = () => { if (onRender) onRender(); };

  return {
    ctx,
    // Read any of the game's globals (state, STEP, functions...) by name.
    get: (name) => vm.runInContext(name, ctx),
    // Call one of the game's functions by name.
    call: (name, ...args) => sandbox[name](...args)
  };
}

module.exports = { loadEngine, scriptList };
