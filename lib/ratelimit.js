// lib/ratelimit.js
// Rate limit 100 file/menit/client. Karena Vercel serverless bisa punya
// banyak instance, counter TIDAK disimpan di memory lokal proses saja,
// melainkan di shared store (lib/store.js -> Vercel Blob JSON).
// Catatan: untuk trafik sangat tinggi, pertimbangkan Vercel KV/Upstash
// Redis untuk atomic counter yang lebih presisi (lihat README).

const { readDb, writeDb } = require("./store");

const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE) || 100;

async function withDbRateLimit(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

function getClientKey(req) {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (fwd ? fwd.split(",")[0] : req.socket && req.socket.remoteAddress) || "unknown";
  return ip.trim();
}

async function checkRateLimit(req) {
  try {
    const client = getClientKey(req);
    const minuteBucket = Math.floor(Date.now() / 60000);
    const key = `${client}:${minuteBucket}`;

    const result = await withDbRateLimit(async (db) => {
      if (!db.ratelimit) db.ratelimit = {};
      // cleanup bucket lama (>2 menit)
      for (const k of Object.keys(db.ratelimit)) {
        const bucket = Number(k.split(":").pop());
        if (minuteBucket - bucket > 2) delete db.ratelimit[k];
      }
      const current = (db.ratelimit[key] || 0) + 1;
      db.ratelimit[key] = current;
      return current;
    });

    return {
      allowed: result <= LIMIT,
      remaining: Math.max(0, LIMIT - result),
      limit: LIMIT,
    };
  } catch (err) {
    // Fail-open: kalau pengecekan rate limit gagal (mis. storage belum
    // terkonfigurasi), jangan sampai memblokir semua upload. Biarkan lewat.
    return { allowed: true, remaining: LIMIT, limit: LIMIT };
  }
}

module.exports = { checkRateLimit, getClientKey, LIMIT };
