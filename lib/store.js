// lib/store.js
// Menyimpan metadata sebagai file JSON di Vercel Blob supaya kita tidak perlu
// menambah dependency database terpisah. Setiap operasi melakukan
// read-modify-write; untuk skala sangat tinggi disarankan pindah ke
// Vercel KV / Upstash Redis (lihat README).

const { put, head } = require("@vercel/blob");

const META_KEY = "_meta/db.json";

function emptyDb() {
  return {
    files: {},
    stats: {
      totalUploadsOk: 0,
      totalUploadsFail: 0,
      totalDownloads: 0,
      totalBandwidthBytes: 0,
      onlineSince: new Date().toISOString(),
    },
    errors: [],
    settings: {
      maintenanceMode: false,
      allowMediaUpload: true,
      allowFileUpload: true,
    },
    ratelimit: {},
  };
}

async function readDb() {
  try {
    const info = await head(META_KEY, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const res = await fetch(info.url, { cache: "no-store" });
    if (!res.ok) return emptyDb();
    const data = await res.json();
    return { ...emptyDb(), ...data };
  } catch (err) {
    return emptyDb();
  }
}

async function writeDb(db) {
  await put(META_KEY, JSON.stringify(db), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

async function withDb(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

async function saveFileRecord(record) {
  return withDb(async (db) => {
    db.files[record.id] = record;
    if (record.status === "ok") db.stats.totalUploadsOk += 1;
    else db.stats.totalUploadsFail += 1;
  });
}

async function getFileRecord(id) {
  const db = await readDb();
  return db.files[id] || null;
}

async function registerDownload(id, sizeBytes) {
  return withDb(async (db) => {
    db.stats.totalDownloads += 1;
    db.stats.totalBandwidthBytes += sizeBytes || 0;
    if (db.files[id]) db.files[id].downloads = (db.files[id].downloads || 0) + 1;
  });
}

async function logError(scope, message) {
  return withDb(async (db) => {
    db.errors.unshift({
      scope,
      message: String(message).slice(0, 500),
      at: new Date().toISOString(),
    });
    db.errors = db.errors.slice(0, 200);
  });
}

async function listFiles({ type, search, limit = 100 } = {}) {
  const db = await readDb();
  let items = Object.values(db.files).sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
  if (type) items = items.filter((f) => f.kind === type);
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (f) => (f.displayName || "").toLowerCase().includes(q) || (f.id || "").toLowerCase().includes(q)
    );
  }
  return items.slice(0, limit);
}

async function getStats() {
  const db = await readDb();
  const files = Object.values(db.files);
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const activeFiles = files.filter((f) => !isExpired(f)).length;
  const expiredFiles = files.filter((f) => isExpired(f)).length;
  return {
    onlineSince: db.stats.onlineSince,
    totalFiles: files.length,
    totalSizeBytes: totalSize,
    totalUploadsOk: db.stats.totalUploadsOk,
    totalUploadsFail: db.stats.totalUploadsFail,
    totalDownloads: db.stats.totalDownloads,
    totalBandwidthBytes: db.stats.totalBandwidthBytes,
    activeFiles,
    expiredFiles,
    averageFileSizeBytes: files.length ? Math.round(totalSize / files.length) : 0,
  };
}

function isExpired(record) {
  if (!record || !record.expiresAt) return false;
  return Date.now() > new Date(record.expiresAt).getTime();
}

async function getSettings() {
  const db = await readDb();
  return db.settings;
}

async function updateSettings(patch) {
  return withDb(async (db) => {
    db.settings = { ...db.settings, ...patch };
  });
}

async function deleteFileRecord(id) {
  return withDb(async (db) => {
    delete db.files[id];
  });
}

module.exports = {
  readDb,
  writeDb,
  saveFileRecord,
  getFileRecord,
  registerDownload,
  logError,
  listFiles,
  getStats,
  isExpired,
  getSettings,
  updateSettings,
  deleteFileRecord,
};
