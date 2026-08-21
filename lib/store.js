// lib/store.js
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
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return emptyDb();
    }

    const info = await head(META_KEY, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!info || !info.url) {
      return emptyDb();
    }

    // Cache buster supaya tidak mendapatkan metadata Blob lama.
    const separator = info.url.includes("?") ? "&" : "?";
    const url = `${info.url}${separator}t=${Date.now()}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      return emptyDb();
    }

    const data = await response.json();

    return {
      ...emptyDb(),
      ...data,
      files: data.files && typeof data.files === "object"
        ? data.files
        : {},
      stats: {
        ...emptyDb().stats,
        ...(data.stats || {}),
      },
      settings: {
        ...emptyDb().settings,
        ...(data.settings || {}),
      },
      errors: Array.isArray(data.errors) ? data.errors : [],
      ratelimit: data.ratelimit || {},
    };
  } catch (err) {
    console.error("readDb error:", err);
    return emptyDb();
  }
}

async function writeDb(db) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN kosong");
  }

  await put(
    META_KEY,
    JSON.stringify(db),
    {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }
  );
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

    if (record.status === "ok") {
      db.stats.totalUploadsOk += 1;
    } else {
      db.stats.totalUploadsFail += 1;
    }
  });
}

async function getFileRecord(id) {
  if (!id) return null;

  const db = await readDb();

  return db.files[id] || null;
}

async function registerDownload(id, sizeBytes) {
  return withDb(async (db) => {
    db.stats.totalDownloads += 1;
    db.stats.totalBandwidthBytes += Number(sizeBytes) || 0;

    if (db.files[id]) {
      db.files[id].downloads =
        (Number(db.files[id].downloads) || 0) + 1;
    }
  });
}

async function logError(scope, message) {
  try {
    return await withDb(async (db) => {
      db.errors.unshift({
        scope,
        message: String(message || "").slice(0, 500),
        at: new Date().toISOString(),
      });

      db.errors = db.errors.slice(0, 200);
    });
  } catch (err) {
    console.error("logError failed:", err);
  }
}

async function listFiles({
  type,
  search,
  limit = 100,
} = {}) {
  const db = await readDb();

  let items = Object.values(db.files);

  items.sort((a, b) => {
    return (b.uploadedAt || "").localeCompare(
      a.uploadedAt || ""
    );
  });

  if (type) {
    items = items.filter((file) => file.kind === type);
  }

  if (search) {
    const q = String(search).toLowerCase();

    items = items.filter((file) => {
      return (
        String(file.displayName || "")
          .toLowerCase()
          .includes(q) ||
        String(file.id || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }

  return items.slice(0, Number(limit) || 100);
}

async function getStats() {
  const db = await readDb();

  const files = Object.values(db.files);

  const totalSize = files.reduce(
    (sum, file) => sum + (Number(file.size) || 0),
    0
  );

  const activeFiles = files.filter(
    (file) => !isExpired(file)
  ).length;

  const expiredFiles = files.filter(
    (file) => isExpired(file)
  ).length;

  return {
    onlineSince: db.stats.onlineSince,

    totalFiles: files.length,

    totalSizeBytes: totalSize,

    totalUploadsOk:
      Number(db.stats.totalUploadsOk) || 0,

    totalUploadsFail:
      Number(db.stats.totalUploadsFail) || 0,

    totalDownloads:
      Number(db.stats.totalDownloads) || 0,

    totalBandwidthBytes:
      Number(db.stats.totalBandwidthBytes) || 0,

    activeFiles,

    expiredFiles,

    averageFileSizeBytes:
      files.length
        ? Math.round(totalSize / files.length)
        : 0,
  };
}

function isExpired(record) {
  if (!record || !record.expiresAt) {
    return false;
  }

  const expires = new Date(record.expiresAt).getTime();

  if (!Number.isFinite(expires)) {
    return false;
  }

  return Date.now() > expires;
}

async function getSettings() {
  const db = await readDb();

  return db.settings;
}

async function updateSettings(patch) {
  return withDb(async (db) => {
    db.settings = {
      ...db.settings,
      ...patch,
    };
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