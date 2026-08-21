const path = require("path");
const { getFileRecord, registerDownload, isExpired } = require("../../lib/store");

module.exports = async (req, res) => {
  try {
    const filename = getFilename(req);

    if (!filename) {
      return send403(res);
    }

    // Ambil nama file terakhir saja
    const safeFilename = path.basename(filename);

    // P2guzx.jpg -> P2guzx
    const id = safeFilename.replace(/\.[a-zA-Z0-9]+$/, "");

    if (!id) {
      return send403(res);
    }

    const record = await getFileRecord(id);

    if (!record) {
      return send403(res);
    }

    if (record.kind !== "media") {
      return send403(res);
    }

    if (record.status !== "ok") {
      return send403(res);
    }

    if (isExpired(record)) {
      return send403(res);
    }

    if (!record.blobUrl) {
      return send403(res);
    }

    await registerDownload(id, record.size);

    res.statusCode = 302;

    // Jangan cache response redirect terlalu lama
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");

    // Redirect langsung ke Vercel Blob
    res.setHeader("Location", record.blobUrl);

    return res.end();
  } catch (err) {
    console.error("[pajar] error:", err);

    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    return res.end("Internal error");
  }
};


/**
 * Ambil filename dari request dengan beberapa fallback.
 *
 * Prioritas:
 * 1. req.query.file
 * 2. req.url
 * 3. x-invoke-path
 * 4. x-matched-path
 */
function getFilename(req) {
  // =========================================================
  // 1. req.query.file
  // =========================================================

  if (req.query && req.query.file) {
    const value = req.query.file;

    if (Array.isArray(value) && value.length > 0) {
      return value[value.length - 1];
    }

    if (typeof value === "string" && value.trim()) {
      return value.split("/").filter(Boolean).pop();
    }
  }


  // =========================================================
  // 2. req.url
  // =========================================================

  if (req.url) {
    const filename = extractFilename(req.url);

    if (filename) {
      return filename;
    }
  }


  // =========================================================
  // 3. x-invoke-path
  // =========================================================

  const invokePath = req.headers["x-invoke-path"];

  if (invokePath) {
    const filename = extractFilename(invokePath);

    if (filename) {
      return filename;
    }
  }


  // =========================================================
  // 4. x-matched-path
  // =========================================================

  const matchedPath = req.headers["x-matched-path"];

  if (matchedPath) {
    const filename = extractFilename(matchedPath);

    if (filename) {
      return filename;
    }
  }

  return null;
}


/**
 * Ambil segment terakhir dari URL/path.
 *
 * Bisa menangani:
 *
 * /pajar/P2guzx.jpg
 * /pajar/P2guzx.jpg?x=123
 * /api/pajar/P2guzx.jpg
 * /api/pajar/P2guzx.jpg?x=123
 */
function extractFilename(value) {
  try {
    const raw = String(value);

    // Buang query string dan hash
    const pathname = raw.split("?")[0].split("#")[0];

    const parts = pathname
      .split("/")
      .filter(Boolean);

    if (!parts.length) {
      return null;
    }

    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return null;
  }
}


function send403(res) {
  res.statusCode = 403;

  res.setHeader(
    "Content-Type",
    "text/html; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  res.end(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>403 - P4DROP</title>

<style>
body{
  font-family:"Helvetica Neue",Arial,sans-serif;
  background:#F8DCC0;
  color:#2B0F0A;
  display:flex;
  align-items:center;
  justify-content:center;
  height:100vh;
  margin:0;
  text-align:center;
}

.box{
  border:3px solid #2B0F0A;
  padding:40px 32px;
  box-shadow:6px 6px 0 0 #2B0F0A;
  background:#fff;
}

h1{
  font-size:64px;
  margin:0;
  font-weight:900;
  color:#C81E12;
  text-transform:uppercase;
}
</style>
</head>

<body>
  <div class="box">
    <h1>403</h1>
    <p>File tidak ditemukan atau akses ditolak.</p>
  </div>
</body>
</html>`);
}