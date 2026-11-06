// Just enough of Node for the BBS door (../bbs/door.js) to run unchanged in a browser tab:
// require(), Buffer, process (stdin/stdout/env/exit), and fs/path/os. Files the door writes
// (its saves) go to this browser's localStorage. The door's game engine (../bbs/engine.js runs
// the web game's scripts in Node's vm) is replaced by engine.js here, which runs them in a hidden
// frame instead.

import { loadEngine } from "./engine.js";

// ---- Buffer: bytes, enough for ../bbs/ansi.js -------------------------------------------
const enc = new TextEncoder(), dec = new TextDecoder();
export class Buffer extends Uint8Array {
  static from(x, encoding) {
    if (typeof x === "string") {
      if (encoding === "latin1" || encoding === "binary") return new Buffer(Array.from(x, (c) => c.charCodeAt(0) & 255));
      return new Buffer(enc.encode(x));
    }
    return new Buffer(x);
  }
  static concat(list) {
    const out = new Buffer(list.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of list) { out.set(b, at); at += b.length; }
    return out;
  }
  static alloc(n, fill) { const b = new Buffer(n); if (fill) b.fill(typeof fill === "string" ? fill.charCodeAt(0) : fill); return b; }
  static allocUnsafe(n) { return new Buffer(n); }
  static isBuffer(x) { return x instanceof Buffer; }
  toString(encoding) {
    if (encoding === "latin1" || encoding === "binary") { let s = ""; for (let i = 0; i < this.length; i += 8192) s += String.fromCharCode.apply(null, this.subarray(i, i + 8192)); return s; }
    return dec.decode(this);
  }
}

// ---- fs: a tiny file system in localStorage ---------------------------------------------
const FS_KEY = "icz-terminal-fs:";
function noFile(p) { const e = new Error(`ENOENT: no such file, '${p}'`); e.code = "ENOENT"; return e; }
function store() { try { return window.localStorage; } catch (e) { return null; } }
const memFs = new Map();   // when localStorage is blocked (private windows): saves last until the tab closes
function fsGet(p) { const s = store(); try { const v = s ? s.getItem(FS_KEY + p) : null; return v != null ? v : (memFs.has(p) ? memFs.get(p) : null); } catch (e) { return memFs.has(p) ? memFs.get(p) : null; } }
function fsSet(p, v) { const s = store(); try { if (!s) throw 0; s.setItem(FS_KEY + p, v); } catch (e) { memFs.set(p, v); } }
function fsDel(p) { const s = store(); try { if (s) s.removeItem(FS_KEY + p); } catch (e) { /* blocked */ } memFs.delete(p); }
const fs = {
  readFileSync(p) { const v = fsGet(p); if (v == null) throw noFile(p); return v; },
  writeFileSync(p, data) { fsSet(p, typeof data === "string" ? data : Buffer.from(data).toString("latin1")); },
  renameSync(a, b) { const v = fsGet(a); if (v == null) throw noFile(a); fsSet(b, v); fsDel(a); },
  unlinkSync(p) { if (fsGet(p) == null) throw noFile(p); fsDel(p); },
  existsSync(p) { return fsGet(p) != null; },
  mkdirSync() {}
};

// ---- path, os -------------------------------------------------------------------------
const path = {
  sep: "/",
  join(...parts) {
    const out = [];
    for (const seg of parts.join("/").split("/")) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") out.pop(); else out.push(seg);
    }
    return "/" + out.join("/");
  },
  dirname(p) { return p.replace(/\/[^/]*$/, "") || "/"; },
  basename(p, ext) { const b = p.replace(/.*\//, ""); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
  extname(p) { const m = /\.[^./]*$/.exec(p); return m ? m[0] : ""; }
};
const os = { homedir: () => "/home/web", EOL: "\n" };

// ---- process ---------------------------------------------------------------------------
// exit() stops the door: its timers are cleared, keys stop reaching it, and the page is told.
export class Exit extends Error {}
export function makeProcess({ argv, env, write, onExit }) {
  const stdinHandlers = { data: [], end: [] }, exitHandlers = [];
  const proc = {
    argv: ["node", "/bbs/door.js", ...argv],
    env,
    pid: 1000 + Math.floor(Math.random() * 1e6),
    exited: false,
    stdout: { write: (d) => { if (!proc.exited) write(typeof d === "string" ? d : Buffer.from(d).toString("latin1")); return true; }, isTTY: false },
    stderr: { write: (d) => { if (!proc.exited) console.error(String(d)); return true; } },   // after exit: only the exit itself
    stdin: {
      isTTY: false,
      on(ev, fn) { (stdinHandlers[ev] || (stdinHandlers[ev] = [])).push(fn); return this; },
      resume() {}, setRawMode() {}
    },
    on(ev, fn) { if (ev === "exit") exitHandlers.push(fn); return proc; },
    removeAllListeners() { return proc; },
    // Another tab's pid is never "alive" here: a lock left by a closed tab can always be taken.
    kill(pid) { if (pid === proc.pid) return true; const e = new Error("ESRCH"); e.code = "ESRCH"; throw e; },
    exit(code) {
      if (proc.exited) throw new Exit();
      proc.exited = true;
      for (const fn of exitHandlers) { try { fn(code); } catch (e) { console.error(e); } }
      onExit(code);
      throw new Exit();
    },
    // The page feeds keys in here
    send(s) {
      if (proc.exited) return;
      const chunk = Buffer.from(s, "latin1");
      for (const fn of stdinHandlers.data) guard(() => fn(chunk));
    }
  };
  return proc;
}
function guard(fn) { try { fn(); } catch (e) { if (!(e instanceof Exit)) throw e; } }

// ---- require: the door's own files, plus the built-ins above ---------------------------------
// sources: { "/bbs/door.js": text, ... }. Each file runs once, CommonJS style.
export function runDoor(sources, proc, onError) {
  const cache = {}, timers = new Set();
  // The door's timers, so exit() can stop them, and so an exit inside one doesn't surface as an error
  const wrapT = (setFn, clearFn, repeat) => [
    (fn, ms, ...a) => {
      const id = setFn(() => { if (!repeat) timers.delete(id); if (proc.exited) return; try { fn(...a); } catch (e) { if (!(e instanceof Exit)) onError(e); } }, ms);
      timers.add(id); return id;
    },
    (id) => { timers.delete(id); clearFn(id); }
  ];
  const [setTimeout_, clearTimeout_] = wrapT(setTimeout, clearTimeout, false);
  const [setInterval_, clearInterval_] = wrapT(setInterval, clearInterval, true);
  const setImmediate_ = (fn, ...a) => setTimeout_(fn, 0, ...a);
  const stopTimers = () => { for (const id of timers) { clearTimeout(id); clearInterval(id); } timers.clear(); };

  const builtins = {
    fs, path, os,
    vm: { runInContext: () => { throw new Error("vm isn't available in the browser"); } },
    "./engine": { loadEngine, scriptList: () => [] }
  };
  function req(from) {
    return (name) => {
      if (builtins[name]) return builtins[name];
      const file = path.join(path.dirname(from), name.endsWith(".js") ? name : name + ".js");
      if (cache[file]) return cache[file].exports;
      if (!(file in sources)) throw new Error(`Cannot find module '${name}' (from ${from})`);
      const module = { exports: {} };
      cache[file] = module;
      const run = new Function("require", "module", "exports", "__filename", "__dirname", "process", "Buffer",
        "setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", sources[file].replace(/^#!.*/, "") + "\n//# sourceURL=" + location.origin + file);
      run(req(file), module, module.exports, file, path.dirname(file), proc, Buffer,
        setTimeout_, clearTimeout_, setInterval_, clearInterval_, setImmediate_);
      return module.exports;
    };
  }
  try { req("/bbs/")("./door"); }
  catch (e) { if (!(e instanceof Exit)) onError(e); }
  return { stopTimers };
}
