// lib/ratelimit.js
// Rate limit 100 file/menit/client. Setiap client+menit punya blob KEY
// SENDIRI (bukan numpuk di file bersama) supaya rate-limit check TIDAK
// PERNAH bertabrakan/mempengaruhi penyimpanan file lain — konsisten
// dengan prinsip yang sama seperti lib/store.js.

const { put, list } = require("@vercel/blob");

const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE) || 100;

function getClientKey(req) {
  const fwd = req.headers["x-forwarded-for"];
  const ip = (fwd ? fwd.split(",")[0] : req.socket && req.socket.remoteAddress) || "unknown";
  return ip.trim().replace(/[^a-zA-Z0-9.:_-]/g, "_");
}

async function checkRateLimit(req) {
  try {
    const client = getClientKey(req);
    const minuteBucket = Math.floor(Date.now() / 60000);
    const pathname = `meta/ratelimit/${client}-${minuteBucket}.json`;

    let current = 0;
    try {
      // list() dipakai (bukan head()) karena head() butuh URL blob penuh,
      // sedangkan kita cuma punya pathname — lihat catatan di lib/store.js.
      const { blobs } = await list({ prefix: pathname, limit: 5, token: process.env.BLOB_READ_WRITE_TOKEN });
      const match = blobs.find((b) => b.pathname === pathname);
      if (match) {
        const freshUrl = `${match.url}${match.url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
        const res = await fetch(freshUrl, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          current = data.count || 0;
        }
      }
    } catch (err) {
      current = 0; // bucket belum ada, mulai dari 0
    }

    current += 1;
    await put(pathname, JSON.stringify({ count: current }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return {
      allowed: current <= LIMIT,
      remaining: Math.max(0, LIMIT - current),
      limit: LIMIT,
    };
  } catch (err) {
    // Fail-open: kalau pengecekan rate limit gagal (mis. storage belum
    // terkonfigurasi), jangan sampai memblokir semua upload. Biarkan lewat.
    return { allowed: true, remaining: LIMIT, limit: LIMIT };
  }
}

module.exports = { checkRateLimit, getClientKey, LIMIT };
