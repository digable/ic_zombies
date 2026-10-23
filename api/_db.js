// Database access.
// - With MONGODB_URI set (e.g. on Vercel): connects to MongoDB, reused across warm invocations.
// - Without it (self-hosted): uses SQLite through _sqliteStore.js — no database server needed.

const uri = process.env.MONGODB_URI;

let client;
let db;

async function getDb() {
  if (db) return db;

  if (!uri) {
    const store = require("./_sqliteStore");
    db = { collection: store.collection };
    return db;
  }

  const { MongoClient } = require("mongodb");
  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
  }
  db = client.db(); // database name comes from the URI path
  return db;
}

module.exports = { getDb };
