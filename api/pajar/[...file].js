const path = require("path");
const {
  getFileRecord,
  registerDownload,
  isExpired,
} = require("../../lib/store");
const { isCdnHost } = require("../../lib/domain");

module.exports = async (req, res) => {
  try {
    if (
      !isCdnHost(req) &&
      !/^localhost/.test(req.headers.host || "")
    ) {
      res.statusCode = 404;
      res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
      );
      return res.end("Not found");
    }

    const segments = Array.isArray(req.query.file)
      ? req.query.file
      : req.query.file
        ? [req.query.file]
        : [];

    if (segments.length === 0) {
      return send403(res);
    }

    const filename = path.basename(
      segments[segments.length - 1]
    );

    const id = filename.replace(
      /\.[a-zA-Z0-9]+$/,
      ""
    );

    const record = await getFileRecord(id);

    if (!record || record.kind !== "media") {
      return send403(res);
    }

    if (isExpired(record)) {
      return send403(res);
    }

    res.statusCode = 302;
    res.setHeader("Location", record.blobUrl);
    res.setHeader(
      "Cache-Control",
      "public, max-age=60"
    );
    res.end();

    registerDownload(id, record.size).catch((err) => {
      console.error("[registerDownload]", err);
    });
  } catch (err) {
    console.error("[pajar]", err);

    res.statusCode = 500;
    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );
    res.end("Internal error");
  }
};

function send403(res) {
  res.statusCode = 403;
  res.setHeader(
    "Content-Type",
    "text/html; charset=utf-8"
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
  text-align:center
}
.box{
  border:3px solid #2B0F0A;
  padding:40px 32px;
  box-shadow:6px 6px 0 0 #2B0F0A;
  background:#fff
}
h1{
  font-size:64px;
  margin:0;
  font-weight:900;
  color:#C81E12;
  text-transform:uppercase
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