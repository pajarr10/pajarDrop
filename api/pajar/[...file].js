// api/pajar/[...file].js

const path = require("path");

const {
  getFileRecord,
  registerDownload,
  isExpired,
} = require("../../lib/store");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return send403(res);
    }

    const queryFile = req.query && req.query.file;

    const segments = Array.isArray(queryFile)
      ? queryFile
      : queryFile
        ? [queryFile]
        : [];

    if (segments.length === 0) {
      return send403(res);
    }

    /*
     * Ambil hanya filename terakhir.
     *
     * Contoh:
     * /pajar/GSGJM6.jpg
     *
     * filename = GSGJM6.jpg
     * id       = GSGJM6
     */
    const filename = path.basename(
      String(segments[segments.length - 1])
    );

    /*
     * Validasi nama file.
     *
     * Format yang diterima:
     * ID.extension
     */
    const match = filename.match(
      /^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9]+)$/
    );

    if (!match) {
      return send403(res);
    }

    const id = match[1];
    const requestedExt = match[2].toLowerCase();

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

    /*
     * Pastikan extension URL sama dengan extension
     * yang tercatat di metadata.
     */
    if (
      record.ext &&
      String(record.ext).toLowerCase() !== requestedExt
    ) {
      return send403(res);
    }

    /*
     * Pastikan Blob URL memang tersedia.
     */
    if (
      !record.blobUrl ||
      typeof record.blobUrl !== "string"
    ) {
      return send403(res);
    }

    /*
     * Jangan redirect HEAD ke Blob kalau tidak diperlukan.
     * Tapi GET tetap mencatat download.
     */
    if (req.method === "GET") {
      try {
        await registerDownload(
          id,
          Number(record.size) || 0
        );
      } catch (err) {
        /*
         * Statistik gagal bukan alasan untuk membuat
         * file yang valid menjadi 500/403.
         */
        console.error(
          "registerDownload error:",
          err
        );
      }
    }

    /*
     * Redirect langsung ke Vercel Blob.
     */
    res.statusCode = 302;

    res.setHeader(
      "Location",
      record.blobUrl
    );

    /*
     * Jangan cache 403/metadata lama di CDN terlalu lama.
     */
    res.setHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=60, stale-while-revalidate=30"
    );

    res.setHeader(
      "X-P4DROP-File-ID",
      id
    );

    res.setHeader(
      "X-P4DROP-Storage",
      "vercel-blob"
    );

    return res.end();

  } catch (err) {
    console.error(
      "api/pajar error:",
      err
    );

    res.statusCode = 500;

    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.end(
      "Internal error"
    );
  }
};

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

  res.setHeader(
    "Pragma",
    "no-cache"
  );

  res.end(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>403 - P4DROP</title>

<style>
* {
  box-sizing: border-box;
}

body {
  font-family:
    "Helvetica Neue",
    Arial,
    sans-serif;

  background: #F8DCC0;
  color: #2B0F0A;

  display: flex;
  align-items: center;
  justify-content: center;

  min-height: 100vh;
  margin: 0;

  text-align: center;
}

.box {
  border: 3px solid #2B0F0A;
  padding: 40px 32px;

  box-shadow:
    6px 6px 0 0 #2B0F0A;

  background: #fff;

  max-width: 420px;
  width: calc(100% - 32px);
}

h1 {
  font-size: 64px;
  line-height: 1;
  margin: 0 0 12px;

  font-weight: 900;

  color: #C81E12;

  text-transform: uppercase;
}

p {
  margin: 0;
  font-size: 15px;
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