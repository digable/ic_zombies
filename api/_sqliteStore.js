// SQLite-backed stand-in for MongoDB, for self-hosting on small machines.
// Implements only the slice of the MongoDB driver API this project uses:
//   collection.findOne(filter, { projection })
//   collection.countDocuments(filter)
//   collection.insertOne(doc)
//   collection.updateOne(filter, update, { upsert })
// Filters: field equality and { $in: [...] }.
// Updates: $set, $setOnInsert, $push (value or { $each, $slice }), $pull.
// Documents with an `expiresAt` date in the past are ignored and swept, like a TTL index.
//
// Each document is one row: (collection, id, data as JSON, expires_at).
// SQLite driver, first one found:
//   1. the `sqlite3` module  (Debian: sudo apt install node-sqlite3   anywhere else: npm install sqlite3)
//   2. Node's built-in `node:sqlite` (Node 22.13+), handy for local development

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DB_FILE = process.env.DB_FILE || path.join(__dirname, "..", "data", "game.db");
const SWEEP_INTERVAL_MS = 60 * 1000;

// --- driver -----------------------------------------------------------------

function openDriver(file) {
  let sqlite3;
  try {
    sqlite3 = require("sqlite3");
  } catch (e) {
    if (e.code !== "MODULE_NOT_FOUND") throw e;
  }

  if (sqlite3) {
    const db = new sqlite3.Database(file);
    const call = (method, sql, params = []) =>
      new Promise((resolve, reject) =>
        db[method](sql, params, function (err, row) { err ? reject(err) : resolve(method === "run" ? this : row); })
      );
    return {
      name: "sqlite3",
      exec: (sql) => new Promise((resolve, reject) => db.exec(sql, (err) => (err ? reject(err) : resolve()))),
      run: (sql, params) => call("run", sql, params),
      get: (sql, params) => call("get", sql, params),
      close: () => db.close()
    };
  }

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    throw new Error(
      "No SQLite driver found. On Debian run: sudo apt install node-sqlite3 " +
      "(elsewhere: npm install sqlite3, or use Node 22.13 or newer)."
    );
  }
  const db = new DatabaseSync(file);
  return {
    name: "node:sqlite",
    exec: async (sql) => db.exec(sql),
    run: async (sql, params = []) => db.prepare(sql).run(...params),
    get: async (sql, params = []) => db.prepare(sql).get(...params),
    close: () => db.close()
  };
}

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const driver = openDriver(DB_FILE);

const ready = driver.exec(`
  PRAGMA journal_mode = WAL;      -- fewer disk syncs, much faster on a spinning hard drive
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS docs (
    collection TEXT    NOT NULL,
    id         TEXT    NOT NULL,
    data       TEXT    NOT NULL,
    expires_at INTEGER,
    PRIMARY KEY (collection, id)
  );
  CREATE INDEX IF NOT EXISTS docs_expires ON docs (expires_at);
  CREATE INDEX IF NOT EXISTS sessions_code
    ON docs (json_extract(data, '$.code')) WHERE collection = 'sessions';
`);

// All operations run one at a time, so a read-modify-write update can never
// interleave with another request's update to the same game.
let queue = Promise.resolve();
function serial(fn) {
  const result = queue.then(() => ready).then(fn);
  queue = result.catch(() => {});
  return result;
}

// --- JSON encoding (Dates are tagged so they come back as Dates) ------------

function encode(value) {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = encode(v);
    return out;
  }
  return value;
}

function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$date") return new Date(value.$date);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = decode(v);
    return out;
  }
  return value;
}

const toRow = (doc) => [
  JSON.stringify(encode(doc)),
  doc.expiresAt instanceof Date ? doc.expiresAt.getTime() : null
];

// --- filters -> SQL -----------------------------------------------------------

const isPlainObject = (v) => v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);

function sqlValue(v) {
  if (v instanceof Date) throw new Error("sqliteStore: filtering on dates is not supported");
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

function whereClause(collection, filter) {
  const parts = ["collection = ?", "(expires_at IS NULL OR expires_at > ?)"];
  const params = [collection, Date.now()];
  for (const [key, cond] of Object.entries(filter || {})) {
    if (!/^[A-Za-z0-9_]+$/.test(key)) throw new Error(`sqliteStore: unsupported field name "${key}"`);
    const column = key === "_id" ? "id" : `json_extract(data, '$.${key}')`;
    if (isPlainObject(cond)) {
      if (!Array.isArray(cond.$in) || Object.keys(cond).length !== 1) {
        throw new Error(`sqliteStore: unsupported filter on "${key}"`);
      }
      if (cond.$in.length === 0) { parts.push("0"); continue; }
      parts.push(`${column} IN (${cond.$in.map(() => "?").join(", ")})`);
      params.push(...cond.$in.map(sqlValue));
    } else {
      parts.push(`${column} = ?`);
      params.push(sqlValue(cond));
    }
  }
  return { sql: parts.join(" AND "), params };
}

// --- updates (applied in JavaScript, then written back) ---------------------

function sameValue(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

// $pull condition: a plain value, or { field: value } matched against sub-documents
function pullMatches(item, cond) {
  if (isPlainObject(cond)) {
    return item && typeof item === "object" &&
      Object.entries(cond).every(([k, v]) => sameValue(item[k], v));
  }
  return sameValue(item, cond);
}

function applyUpdate(doc, update, inserting) {
  for (const [op, fields] of Object.entries(update)) {
    if (op === "$set") Object.assign(doc, structuredClone(fields));
    else if (op === "$setOnInsert") { if (inserting) Object.assign(doc, structuredClone(fields)); }
    else if (op === "$push") {
      for (const [key, val] of Object.entries(fields)) {
        let arr = Array.isArray(doc[key]) ? doc[key] : [];
        if (isPlainObject(val) && "$each" in val) {
          arr.push(...structuredClone(val.$each));
          if (typeof val.$slice === "number") {
            arr = val.$slice < 0 ? arr.slice(val.$slice) : arr.slice(0, val.$slice);
          }
        } else {
          arr.push(structuredClone(val));
        }
        doc[key] = arr;
      }
    } else if (op === "$pull") {
      for (const [key, cond] of Object.entries(fields)) {
        if (Array.isArray(doc[key])) doc[key] = doc[key].filter((item) => !pullMatches(item, cond));
      }
    } else {
      throw new Error(`sqliteStore: unsupported update operator ${op}`);
    }
  }
}

function applyProjection(doc, projection) {
  if (!projection) return doc;
  for (const [key, flag] of Object.entries(projection)) {
    if (flag === 0 || flag === false) delete doc[key];
    else throw new Error("sqliteStore: only exclusion projections are supported");
  }
  return doc;
}

// --- collection ----------------------------------------------------------------

function collection(name) {
  async function findRow(filter) {
    const where = whereClause(name, filter);
    return driver.get(`SELECT id, data FROM docs WHERE ${where.sql} LIMIT 1`, where.params);
  }

  return {
    findOne: (filter, options = {}) => serial(async () => {
      const row = await findRow(filter);
      return row ? applyProjection(decode(JSON.parse(row.data)), options.projection) : null;
    }),

    countDocuments: (filter) => serial(async () => {
      const where = whereClause(name, filter);
      const row = await driver.get(`SELECT COUNT(*) AS n FROM docs WHERE ${where.sql}`, where.params);
      return Number(row.n);
    }),

    insertOne: (doc) => serial(async () => {
      if (doc._id === undefined) doc._id = randomUUID(); // the real driver also adds _id to the passed object
      await driver.run(
        "INSERT INTO docs (collection, id, data, expires_at) VALUES (?, ?, ?, ?)",
        [name, String(doc._id), ...toRow(doc)]
      );
      return { acknowledged: true, insertedId: doc._id };
    }),

    updateOne: (filter, update, options = {}) => serial(async () => {
      const row = await findRow(filter);

      if (!row) {
        if (!options.upsert) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
        // New document starts from the equality fields of the filter, like MongoDB's upsert
        const doc = {};
        for (const [k, v] of Object.entries(filter || {})) if (!isPlainObject(v)) doc[k] = v;
        applyUpdate(doc, update, true);
        if (doc._id === undefined) doc._id = randomUUID();
        // An expired copy with the same id may still be waiting for the sweep; replace it
        await driver.run(
          "INSERT OR REPLACE INTO docs (collection, id, data, expires_at) VALUES (?, ?, ?, ?)",
          [name, String(doc._id), ...toRow(doc)]
        );
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedId: doc._id };
      }

      const doc = decode(JSON.parse(row.data));
      applyUpdate(doc, update, false);
      await driver.run(
        "UPDATE docs SET data = ?, expires_at = ? WHERE collection = ? AND id = ?",
        [...toRow(doc), name, row.id]
      );
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    })
  };
}

// --- housekeeping -------------------------------------------------------------

function sweep() {
  return serial(() => driver.run("DELETE FROM docs WHERE expires_at IS NOT NULL AND expires_at <= ?", [Date.now()]))
    .catch((e) => console.error("sqliteStore: sweep failed", e.message));
}
sweep();
setInterval(sweep, SWEEP_INTERVAL_MS).unref();

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.once(sig, () => {
    queue.finally(() => {
      try { driver.close(); } catch {}
      process.exit(0);
    });
  });
}

module.exports = { collection, driverName: driver.name };
