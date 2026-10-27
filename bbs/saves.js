// One saved game per BBS user, kept as a JSON file so a player can quit and pick up later.
//
// Where saves go, first match wins:
//   --savedir DIR           (command line)
//   $ICZ_SAVE_DIR
//   $SBBSCTRL/../data/iczombies   (on the BBS: /sbbs/data/iczombies, which the sbbs user can write)
//   ~/.iczombies            (trying it locally)
//
// The file only holds the game itself (the same data the web version's Save button keeps)
// and is named after the player's BBS name. door.js saves it at the start of each turn, so a
// dropped connection comes back to the last turn that was finished.

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function saveDir(override) {
  if (override) return override;
  if (process.env.ICZ_SAVE_DIR) return process.env.ICZ_SAVE_DIR;
  if (process.env.SBBSCTRL) return path.join(process.env.SBBSCTRL, "..", "data", "iczombies");
  return path.join(os.homedir(), ".iczombies");
}

function fileFor(dir, who) {
  const slug = String(who || "local").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "local";
  return path.join(dir, `${slug}.json`);
}

function readSave(dir, who) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(dir, who), "utf8"));
  } catch {
    return null;
  }
}

// Write to a temp file first, then rename, so a dropped connection never leaves half a save.
function writeSave(dir, who, data) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const file = fileFor(dir, who);
    const tmp = `${file}.${process.pid}.tmp`;   // per process, in case the same user is on two nodes
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    process.stderr.write(`save failed: ${e.message}\n`);
    return false;
  }
}

// One game at a time per user: a lock file holds the process id of the door that has the
// user's game open. A lock left by a process that's gone (power cut, kill -9) is ignored.
const lockFor = (dir, who) => fileFor(dir, who).replace(/\.json$/, ".lock");
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };

// Returns true if this process now holds the lock, false if another live door has it.
function takeLock(dir, who) {
  const file = lockFor(dir, who);
  try {
    const pid = Number(fs.readFileSync(file, "utf8"));
    if (pid && pid !== process.pid && alive(pid)) return false;
  } catch { /* no lock yet */ }
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, String(process.pid));
  } catch (e) {
    process.stderr.write(`lock failed: ${e.message}\n`);
  }
  return true;
}

function dropLock(dir, who) {
  const file = lockFor(dir, who);
  try { if (Number(fs.readFileSync(file, "utf8")) === process.pid) fs.unlinkSync(file); } catch { /* already gone */ }
}

// Online games live on the zombies server, not here. All that's kept locally is which game the
// user is in: { code, playerId, hostId }, so they can rejoin after a dropped connection.
const onlineFor = (dir, who) => fileFor(dir, who).replace(/\.json$/, ".online.json");

function readOnline(dir, who) {
  try { return JSON.parse(fs.readFileSync(onlineFor(dir, who), "utf8")); } catch { return null; }
}

function writeOnline(dir, who, data) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(onlineFor(dir, who), JSON.stringify(data));
  } catch (e) {
    process.stderr.write(`online marker failed: ${e.message}\n`);
  }
}

function removeOnline(dir, who) {
  try { fs.unlinkSync(onlineFor(dir, who)); } catch { /* nothing to remove */ }
}

// A short, stable tag for this user (file names, the server's per-player rate limits).
const slugOf = (who) => String(who || "local").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "local";

function removeSave(dir, who) {
  try { fs.unlinkSync(fileFor(dir, who)); } catch { /* nothing to remove */ }
}

module.exports = { saveDir, readSave, writeSave, removeSave, takeLock, dropLock, readOnline, writeOnline, removeOnline, slugOf };
