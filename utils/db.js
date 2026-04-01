const { MongoClient } = require('mongodb');

let _db = null;

async function connectDB() {
  if (_db) return _db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('[DB] MONGODB_URI manquant dans les variables d\'environnement.');

  const client = new MongoClient(uri);
  await client.connect();
  _db = client.db('dynasty8');
  console.log('[DB] ✅ Connecté à MongoDB');
  return _db;
}

function getDB() {
  if (!_db) throw new Error('[DB] Base de données non connectée.');
  return _db;
}

module.exports = { connectDB, getDB };
