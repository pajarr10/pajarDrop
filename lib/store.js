// lib/store.js
// PENTING: setiap file punya BLOB KEY SENDIRI (meta/files/<id>.json).
// Sebelumnya semua metadata numpuk di satu file JSON besar yang di-read-
// modify-write bolak-balik oleh banyak request berbeda (upload, rate limit,
// stats, dll) — ini menyebabkan race condition: kalau dua request menulis
// hampir bersamaan, tulisan yang belakangan bisa menimpa/menghilangkan
// perubahan yang sebelumnya, termasuk record file yang baru saja diupload
// (menyebabkan file 403 padahal baru saja sukses diupload).
//
// Dengan file terpisah per-ID, upload/baca satu file TIDAK PERNAH
// bertabrakan dengan upload/baca file lain — masing-masing independen.
// Hanya counter agregat (total upload, total download, dst) yang masih
// memakai file bersama dan berisiko sedikit meleset di trafik sangat
// tinggi bersamaan — itu tidak masalah karena cuma statistik tampilan,
// bukan data yang menentukan file bisa diakses atau tidak.

const { put, list, del } = require("@vercel/blob");

const FILES_PREFIX = "meta/files/";
const COUNTERS_KEY = "meta/counters.json";
const ERRORS_KEY = "meta/errors.json";
const SETTINGS_KEY = "meta/settings.json";

function filePath(id) {
  return `${FILES_PREFIX}${id}.json`;
}

async function findBlobUrl(pathname) {
  // PENTING: head() di @vercel/blob butuh URL blob PENUH (bukan sekadar
  // pathname) untuk bisa menemukan objeknya secara andal. Karena kita cuma
  // punya pathname (mis. "meta/files/P2guzx.json"), kita cari lewat list()
  // yang memang didesain untuk pencarian berbasis pathname/prefix — lebih
  // pasti ketemu daripada head(pathname) yang bisa diam-diam gagal.
  const { blobs } = await list({
    prefix: pathname,
    limit: 10,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  const match = blobs.find((b) => b.pathname === pathname);
  return match ? match.url : null;
}

async function readJsonBlob(pathname, fallback) {
  try {
    const url = await findBlobUrl(pathname);
    if (!url) return fallback;
    // Cache-bust: blob publik di-serve lewat CDN yang bisa menyimpan versi
    // lama walau baru saja di-overwrite. Query unik memaksa cache miss
    // supaya data yang dibaca selalu yang terbaru.
    const freshUrl = `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
    const res = await fetch(freshUrl, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (err) {
    return fallback;
  }
}

async function writeJsonBlob(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

// ---------- File records (independen per ID, tidak ada race) ----------

async function saveFileRecord(record) {
  await writeJsonBlob(filePath(record.id), record);
  await bumpCounters((c) => {
    if (record.status === "ok") c.totalUploadsOk = (c.totalUploadsOk || 0) + 1;
    else c.totalUploadsFail = (c.totalUploadsFail || 0) + 1;
  });
  return record;
}

async function getFileRecord(id) {
  if (!id) return null;
  return readJsonBlob(filePath(id), null);
}

async function registerDownload(id, sizeBytes) {
  const record = await getFileRecord(id);
  if (record) {
    record.downloads = (record.downloads || 0) + 1;
    await writeJsonBlob(filePath(id), record);
  }
  await bumpCounters((c) => {
    c.totalDownloads = (c.totalDownloads || 0) + 1;
    c.totalBandwidthBytes = (c.totalBandwidthBytes || 0) + (sizeBytes || 0);
  });
}

async function deleteFileRecord(id) {
  try {
    const url = await findBlobUrl(filePath(id));
    if (url) await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (err) {
    // sudah tidak ada / gagal hapus — abaikan, bukan fatal
  }
}

async function listFiles({ type, search, limit = 100 } = {}) {
  try {
    const { blobs } = await list({
      prefix: FILES_PREFIX,
      limit: 1000,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const records = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}${b.url.includes("?") ? "&" : "?"}_t=${Date.now()}`, { cache: "no-store" });
          if (!res.ok) return null;
          return await res.json();
        } catch (err) {
          return null;
        }
      })
    );
    let items = records.filter(Boolean).sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
    if (type) items = items.filter((f) => f.kind === type);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (f) => (f.displayName || "").toLowerCase().includes(q) || (f.id || "").toLowerCase().includes(q)
      );
    }
    return items.slice(0, limit);
  } catch (err) {
    return [];
  }
}

// ---------- Counter agregat (statistik, boleh sedikit meleset) ----------

function emptyCounters() {
  return {
    totalUploadsOk: 0,
    totalUploadsFail: 0,
    totalDownloads: 0,
    totalBandwidthBytes: 0,
    onlineSince: new Date().toISOString(),
  };
}

async function bumpCounters(mutator) {
  try {
    const counters = await readJsonBlob(COUNTERS_KEY, emptyCounters());
    mutator(counters);
    await writeJsonBlob(COUNTERS_KEY, counters);
  } catch (err) {
    // statistik boleh gagal diam-diam — jangan sampai bikin request utama gagal
  }
}

async function getStats() {
  const [files, counters] = await Promise.all([listFiles({ limit: 1000 }), readJsonBlob(COUNTERS_KEY, emptyCounters())]);
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const activeFiles = files.filter((f) => !isExpired(f)).length;
  const expiredFiles = files.filter((f) => isExpired(f)).length;
  return {
    onlineSince: counters.onlineSince || new Date().toISOString(),
    totalFiles: files.length,
    totalSizeBytes: totalSize,
    totalUploadsOk: counters.totalUploadsOk || 0,
    totalUploadsFail: counters.totalUploadsFail || 0,
    totalDownloads: counters.totalDownloads || 0,
    totalBandwidthBytes: counters.totalBandwidthBytes || 0,
    activeFiles,
    expiredFiles,
    averageFileSizeBytes: files.length ? Math.round(totalSize / files.length) : 0,
  };
}

function isExpired(record) {
  if (!record || !record.expiresAt) return false;
  return Date.now() > new Date(record.expiresAt).getTime();
}

// ---------- Error log (statistik/debug, boleh sedikit meleset) ----------

async function logError(scope, message) {
  try {
    const errors = await readJsonBlob(ERRORS_KEY, []);
    errors.unshift({ scope, message: String(message).slice(0, 500), at: new Date().toISOString() });
    await writeJsonBlob(ERRORS_KEY, errors.slice(0, 200));
  } catch (err) {
    // jangan sampai logging error malah bikin request utama gagal
  }
}

async function getErrors() {
  return readJsonBlob(ERRORS_KEY, []);
}

// ---------- Settings (maintenance mode, dll — admin-only, low traffic) ----------

function emptySettings() {
  return { maintenanceMode: false, allowMediaUpload: true, allowFileUpload: true };
}

async function getSettings() {
  return readJsonBlob(SETTINGS_KEY, emptySettings());
}

async function updateSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await writeJsonBlob(SETTINGS_KEY, next);
  return next;
}

module.exports = {
  saveFileRecord,
  getFileRecord,
  registerDownload,
  deleteFileRecord,
  listFiles,
  getStats,
  isExpired,
  logError,
  getErrors,
  getSettings,
  updateSettings,
};
