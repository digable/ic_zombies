// One saved game per BBS user, kept as a JSON file so a player can quit and pick up later.
//
// Where saves go, first match wins:
//   --savedir DIR           (command line)
//   $ICZ_SAVE_DIR
//   $SBBSCTRL/../data/iczombies   (on the BBS: /sbbs/data/iczombies, which the sbbs user can write)
//   ~/.iczombies            (trying it locally)
//
// The file only holds the game itself (the same data the web version's Save button keeps)
// and is named after the player's BBS name.

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

function removeSave(dir, who) {
  try { fs.unlinkSync(fileFor(dir, who)); } catch { /* nothing to remove */ }
}

module.exports = { saveDir, readSave, writeSave, removeSave };
