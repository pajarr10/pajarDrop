// api/pjr/[id].js
const { getFileRecord, registerDownload, isExpired } = require("../../lib/store");
const { pageShell, logoSvg, escapeHtml } = require("../../lib/render");
const { formatBytes, formatDateID, formatRemaining } = require("../../lib/format");

// Sama seperti api/pajar/[...file].js: id diprioritaskan dari req.query,
// tapi kalau kosong, parse langsung dari req.url sebagai fallback yang
// tidak bergantung pada bagaimana Vercel mem-populate query dari rewrite.
function extractId(req) {
  if (typeof req.query.id === "string" && req.query.id) return req.query.id;
  try {
    const url = new URL(req.url, "http://internal");
    const parts = url.pathname.split("/").filter(Boolean);
    let idx = parts.indexOf("pjr");
    if (idx === -1) {
      const apiIdx = parts.indexOf("api");
      if (apiIdx !== -1 && parts[apiIdx + 1] === "pjr") idx = apiIdx + 1;
    }
    if (idx !== -1 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch (err) {
    // abaikan
  }
  return null;
}

module.exports = async (req, res) => {
  try {
    const id = extractId(req);
    const record = id ? await getFileRecord(id) : null;

    if (!record || record.kind !== "file") {
      return renderStateHtml(res, 404, "File Tidak Ditemukan", "Link ini tidak valid atau file sudah dihapus.");
    }

    const expired = isExpired(record);
    if (expired) {
      return renderStateHtml(res, 410, "File Sudah Kadaluarsa", "Masa aktif file ini telah berakhir dan tidak dapat diakses lagi.");
    }

    if (req.query.dl === "1") {
      const upstream = await fetch(record.blobUrl);
      if (!upstream.ok || !upstream.body) {
        return renderStateHtml(res, 500, "Gagal Mengambil File", "Terjadi kesalahan saat mengambil file dari storage.");
      }
      await registerDownload(id, record.size);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(record.displayName)}"`);
      const reader = upstream.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) return res.end();
        res.write(Buffer.from(value));
        return pump();
      };
      return pump();
    }

    const html = pageShell({
      title: `${record.displayName} - P4Drop`,
      description: record.description || "File dibagikan lewat P4Drop",
      bodyHtml: fileLandingBody(record),
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(html);
  } catch (err) {
    return renderStateHtml(res, 500, "Terjadi Kesalahan", "Silakan coba lagi beberapa saat lagi.");
  }
};

function fileLandingBody(record) {
  const remaining = formatRemaining(record.expiresAt);
  return `
<header class="nav">
  <a href="/" class="brand">${logoSvg(28)}<span>P4Drop</span></a>
  <nav class="nav-links">
    <a href="/upload">Upload</a>
    <a href="/uploadong">Upload Lainnya</a>
    <a href="/status">Analysis</a>
  </nav>
</header>
<main class="wrap file-landing">
  <p class="crumbs">Beranda &gt; ${escapeHtml(record.displayName)}</p>
  <section class="card file-card">
    <div class="file-card-top">
      <div class="file-icon">${fileIconSvg(record.ext)}</div>
      <div>
        <h1>${escapeHtml(record.displayName)}</h1>
        <p class="muted">${formatBytes(record.size)}</p>
        <p class="muted dot">Diunggah ${escapeHtml(formatDateID(record.uploadedAt))}</p>
        ${remaining ? `<p class="pill-remaining">Sisa ${escapeHtml(remaining)}</p>` : ""}
      </div>
    </div>
    <a class="btn btn-primary btn-block" href="?dl=1">Download File</a>
    <button class="btn btn-ghost btn-block" data-copy="${escapeHtml(currentUrlPlaceholder())}">Copy URL</button>
  </section>

  <section class="card meta-grid">
    <div><span class="meta-label">Nama File</span><p>${escapeHtml(record.displayName)}</p></div>
    <div><span class="meta-label">Ukuran</span><p>${formatBytes(record.size)}</p></div>
    <div class="meta-full"><span class="meta-label">Deskripsi</span><p>${escapeHtml(record.description || "-")}</p></div>
    ${
      record.expiresAt
        ? `<div class="meta-full"><span class="meta-label">Masa Aktif</span><p>Kadaluarsa ${escapeHtml(formatDateID(record.expiresAt))} (${escapeHtml(remaining)})</p></div>`
        : ""
    }
  </section>
</main>
<footer class="footer">
  <p>P4Drop &middot; Developer by Pajar</p>
</footer>
<script>
document.addEventListener('DOMContentLoaded', function () {
  var btn = document.querySelector('[data-copy]');
  if (btn) btn.setAttribute('data-copy', window.location.href.split('?')[0]);
});
</script>`;
}

function currentUrlPlaceholder() {
  return "";
}

function fileIconSvg(ext) {
  const archives = ["zip", "rar", "7z", "tar", "gz"];
  const code = ["js", "ts", "py", "php", "java", "c", "cpp", "html", "css", "json", "yml", "yaml", "xml", "md", "txt"];
  if (archives.includes(ext)) {
    return `<svg class="icon-lg" viewBox="0 0 24 24" style="width:40px;height:40px;"><path d="M3 7h18M3 7v12h18V7M3 7l2-3h14l2 3" stroke-linejoin="miter"/><path d="M9 11h6" stroke-linecap="square"/></svg>`;
  }
  if (code.includes(ext)) {
    return `<svg class="icon-lg" viewBox="0 0 24 24" style="width:40px;height:40px;"><path d="m9 8-4 4 4 4M15 8l4 4-4 4" stroke-linecap="square" stroke-linejoin="miter"/></svg>`;
  }
  return `<svg class="icon-lg" viewBox="0 0 24 24" style="width:40px;height:40px;"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" stroke-linejoin="miter"/><path d="M14 3v5h5" stroke-linejoin="miter"/></svg>`;
}

function renderStateHtml(res, status, title, message) {
  const html = pageShell({
    title: `${title} - P4Drop`,
    bodyHtml: `
<header class="nav">
  <a href="/" class="brand">${logoSvg(28)}<span>P4Drop</span></a>
</header>
<main class="wrap state-page">
  <div class="card state-card">
    <h1>${escapeHtml(title)}</h1>
    <p class="muted">${escapeHtml(message)}</p>
    <a class="btn btn-primary" href="/">Kembali ke Beranda</a>
  </div>
</main>`,
  });
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}
