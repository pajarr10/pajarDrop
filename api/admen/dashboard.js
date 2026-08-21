// api/admen/dashboard.js
const { pageShell, logoSvg, escapeHtml } = require("../../lib/render");
const { formatBytes, formatDateID } = require("../../lib/format");
const { isAdminAuthed } = require("../../lib/security");
const {
  getStats,
  listFiles,
  readDb,
  getSettings,
  updateSettings,
  deleteFileRecord,
  isExpired,
} = require("../../lib/store");
const { parseMultipart, firstValue } = require("../../lib/parse-form");

const SECTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "files", label: "File Manager" },
  { key: "media", label: "Media Library" },
  { key: "code", label: "Text & Code" },
  { key: "upload-manager", label: "Upload Manager" },
  { key: "storage", label: "Storage Overview" },
  { key: "urls", label: "URL Manager" },
  { key: "upload-settings", label: "Upload Settings" },
  { key: "file-types", label: "File Type Settings" },
  { key: "history", label: "Upload History" },
  { key: "errors", label: "Error Logs" },
  { key: "api-status", label: "API Status" },
  { key: "system", label: "System Status" },
  { key: "maintenance", label: "Maintenance" },
];

module.exports = async (req, res) => {
  if (!isAdminAuthed(req)) {
    res.statusCode = 302;
    res.setHeader("Location", "/admen");
    return res.end();
  }

  if (req.method === "POST") {
    try {
      const { fields } = await parseMultipart(req, {});
      const action = firstValue(fields.action);
      if (action === "delete-file") {
        await deleteFileRecord(firstValue(fields.id));
      } else if (action === "toggle-maintenance") {
        const current = await getSettings();
        await updateSettings({ maintenanceMode: !current.maintenanceMode });
      }
    } catch (err) {
      // diamkan, tetap lanjut render supaya admin tidak stuck
    }
    const backSection = (req.query && req.query.section) || "dashboard";
    res.statusCode = 302;
    res.setHeader("Location", `/admen/dashboard?section=${backSection}`);
    return res.end();
  }

  const section = SECTIONS.some((s) => s.key === req.query.section) ? req.query.section : "dashboard";
  const content = await renderSection(section, req.query);

  const html = pageShell({
    title: "Admen Dashboard - P4Drop",
    bodyHtml: `
<div class="admin-shell">
  <aside class="admin-sidebar">
    <a href="/" class="brand">${logoSvg(26)}<span>P4Drop</span></a>
    <nav class="admin-nav">
      ${SECTIONS.map(
        (s) => `<a href="/admen/dashboard?section=${s.key}" class="${s.key === section ? "active" : ""}">${s.label}</a>`
      ).join("")}
    </nav>
    <a href="/admen/logout" class="admin-logout">Logout</a>
  </aside>
  <main class="admin-content">
    ${content}
  </main>
</div>`,
  });

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
};

async function renderSection(section, query) {
  switch (section) {
    case "files":
      return sectionFileList({ type: null, title: "File Manager", search: query.q });
    case "media":
      return sectionFileList({ type: "media", title: "Media Library", search: query.q });
    case "code":
      return sectionFileList({ type: "file", title: "Text & Code / File", search: query.q });
    case "upload-manager":
      return sectionFileList({ type: null, title: "Upload Manager (Terbaru)", search: null, limit: 20 });
    case "storage":
      return sectionStorage();
    case "urls":
      return sectionFileList({ type: null, title: "URL Manager", search: query.q, showUrl: true });
    case "upload-settings":
      return sectionUploadSettings();
    case "file-types":
      return sectionFileTypes();
    case "history":
      return sectionFileList({ type: null, title: "Upload History", search: query.q, limit: 200 });
    case "errors":
      return sectionErrors();
    case "api-status":
      return sectionApiStatus();
    case "system":
      return sectionSystemStatus();
    case "maintenance":
      return sectionMaintenance();
    default:
      return sectionDashboard();
  }
}

async function sectionDashboard() {
  const stats = await getStats();
  const cards = [
    ["Total Files", stats.totalFiles],
    ["Total Size", formatBytes(stats.totalSizeBytes)],
    ["Upload Sukses", stats.totalUploadsOk],
    ["Upload Gagal", stats.totalUploadsFail],
    ["Total Downloads", stats.totalDownloads],
    ["Bandwidth Terpakai", formatBytes(stats.totalBandwidthBytes)],
    ["File Aktif", stats.activeFiles],
    ["File Kadaluarsa", stats.expiredFiles],
  ];
  const recent = await listFiles({ limit: 8 });
  return `
<h1>Dashboard</h1>
<div class="stat-grid">
  ${cards.map(([label, val]) => `<div class="stat-card"><span class="stat-label">${label}</span><strong>${val}</strong></div>`).join("")}
</div>
<h2>Aktivitas Terbaru</h2>
${filesTable(recent)}`;
}

async function sectionFileList({ type, title, search, limit = 100, showUrl = false }) {
  const files = await listFiles({ type, search: search || undefined, limit });
  return `
<h1>${title}</h1>
<form method="GET" class="search-row">
  <input type="hidden" name="section" value="${currentSectionFromTitle(title)}" />
  <input type="text" name="q" placeholder="Cari nama file atau ID..." value="${escapeHtml(search || "")}" />
  <button class="btn btn-primary" type="submit">Cari</button>
</form>
${filesTable(files, showUrl)}`;
}

function currentSectionFromTitle(title) {
  const map = {
    "File Manager": "files",
    "Media Library": "media",
    "Text & Code / File": "code",
    "URL Manager": "urls",
    "Upload History": "history",
  };
  return map[title] || "files";
}

function filesTable(files, showUrl) {
  if (!files.length) return `<p class="muted">Belum ada data.</p>`;
  return `
<div class="table-wrap">
<table class="admin-table">
<thead><tr>
  <th>Nama</th><th>Jenis</th><th>Ukuran</th><th>Diunggah</th><th>Status</th>${showUrl ? "<th>URL</th>" : ""}<th>Aksi</th>
</tr></thead>
<tbody>
${files
  .map((f) => {
    const url = f.kind === "media" ? `/pajar/${f.id}.${f.ext}` : `/pjr/${f.id}`;
    const expired = isExpired(f);
    return `<tr>
      <td>${escapeHtml(f.displayName)}</td>
      <td>${f.kind === "media" ? "Media" : "File"}</td>
      <td>${formatBytes(f.size)}</td>
      <td>${escapeHtml(formatDateID(f.uploadedAt))}</td>
      <td>${expired ? '<span class="badge badge-danger">Expired</span>' : '<span class="badge badge-ok">Aktif</span>'}</td>
      ${showUrl ? `<td class="mono">${url}</td>` : ""}
      <td>
        <form method="POST" action="/admen/dashboard" onsubmit="return confirm('Hapus file ini?');" class="inline-form">
          <input type="hidden" name="action" value="delete-file" />
          <input type="hidden" name="id" value="${escapeHtml(f.id)}" />
          <button class="btn btn-danger btn-sm" type="submit">Hapus</button>
        </form>
      </td>
    </tr>`;
  })
  .join("")}
</tbody>
</table>
</div>`;
}

async function sectionStorage() {
  const stats = await getStats();
  return `
<h1>Storage Overview</h1>
<div class="stat-grid">
  <div class="stat-card"><span class="stat-label">Total Storage Terpakai</span><strong>${formatBytes(stats.totalSizeBytes)}</strong></div>
  <div class="stat-card"><span class="stat-label">Rata-rata Ukuran File</span><strong>${formatBytes(stats.averageFileSizeBytes)}</strong></div>
  <div class="stat-card"><span class="stat-label">Total File</span><strong>${stats.totalFiles}</strong></div>
  <div class="stat-card"><span class="stat-label">Backend Storage</span><strong>Vercel Blob</strong></div>
</div>
<p class="muted">Storage menggunakan Vercel Blob (public access). Tidak ada dependency filesystem lokal server.</p>`;
}

async function sectionUploadSettings() {
  const settings = await getSettings();
  return `
<h1>Upload Settings</h1>
<div class="stat-grid">
  <div class="stat-card"><span class="stat-label">Max Media Size</span><strong>${process.env.MAX_MEDIA_MB || 200} MB</strong></div>
  <div class="stat-card"><span class="stat-label">Max File Size</span><strong>${process.env.MAX_FILE_MB || 1024} MB</strong></div>
  <div class="stat-card"><span class="stat-label">Rate Limit</span><strong>${process.env.RATE_LIMIT_PER_MINUTE || 100} / menit / client</strong></div>
  <div class="stat-card"><span class="stat-label">Upload Media Aktif</span><strong>${settings.allowMediaUpload ? "Ya" : "Tidak"}</strong></div>
</div>
<p class="muted">Ubah batas ukuran &amp; rate limit lewat environment variables: <code>MAX_MEDIA_MB</code>, <code>MAX_FILE_MB</code>, <code>RATE_LIMIT_PER_MINUTE</code>.</p>`;
}

function sectionFileTypes() {
  const { MEDIA_EXTENSIONS } = require("../../lib/validate");
  return `
<h1>File Type Settings</h1>
<h2>Diizinkan di /upload (Media)</h2>
<p class="mono">${Array.from(MEDIA_EXTENSIONS).join(", ")}</p>
<h2>/uploadong</h2>
<p class="muted">Menerima hampir semua tipe file non-executable-serving. File tidak pernah dieksekusi di server apa pun ekstensinya (PHP, JS, HTML, SVG, EXE, SH, dll disimpan sebagai binary attachment).</p>`;
}

async function sectionErrors() {
  const db = await readDb();
  const errors = db.errors || [];
  if (!errors.length) return `<h1>Error Logs</h1><p class="muted">Tidak ada error tercatat.</p>`;
  return `
<h1>Error Logs</h1>
<div class="table-wrap"><table class="admin-table">
<thead><tr><th>Waktu</th><th>Scope</th><th>Pesan</th></tr></thead>
<tbody>
${errors.map((e) => `<tr><td>${escapeHtml(formatDateID(e.at))}</td><td>${escapeHtml(e.scope)}</td><td>${escapeHtml(e.message)}</td></tr>`).join("")}
</tbody></table></div>`;
}

function sectionApiStatus() {
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const hasAdmin = !!process.env.ADMIN_SECRET;
  return `
<h1>API Status</h1>
<div class="stat-grid">
  <div class="stat-card"><span class="stat-label">POST /api/upload</span><strong class="${hasBlob ? "ok-text" : "err-text"}">${hasBlob ? "Ready" : "Storage belum diset"}</strong></div>
  <div class="stat-card"><span class="stat-label">POST /api/uploadong</span><strong class="${hasBlob ? "ok-text" : "err-text"}">${hasBlob ? "Ready" : "Storage belum diset"}</strong></div>
  <div class="stat-card"><span class="stat-label">GET /api/stats</span><strong class="ok-text">Ready</strong></div>
  <div class="stat-card"><span class="stat-label">Admen Auth</span><strong class="${hasAdmin ? "ok-text" : "err-text"}">${hasAdmin ? "Configured" : "ADMIN_SECRET kosong"}</strong></div>
</div>`;
}

function sectionSystemStatus() {
  const mem = process.memoryUsage();
  return `
<h1>System Status</h1>
<div class="stat-grid">
  <div class="stat-card"><span class="stat-label">Runtime</span><strong>Node.js ${process.version}</strong></div>
  <div class="stat-card"><span class="stat-label">Memory (RSS)</span><strong>${formatBytes(mem.rss)}</strong></div>
  <div class="stat-card"><span class="stat-label">Platform</span><strong>Vercel Serverless</strong></div>
  <div class="stat-card"><span class="stat-label">Env</span><strong>${process.env.NODE_ENV || "production"}</strong></div>
</div>`;
}

async function sectionMaintenance() {
  const settings = await getSettings();
  return `
<h1>Maintenance</h1>
<div class="card" style="max-width:480px;padding:24px;">
  <p>Status saat ini: <strong class="${settings.maintenanceMode ? "err-text" : "ok-text"}">${settings.maintenanceMode ? "MAINTENANCE MODE AKTIF" : "Normal"}</strong></p>
  <form method="POST" action="/admen/dashboard">
    <input type="hidden" name="action" value="toggle-maintenance" />
    <button class="btn ${settings.maintenanceMode ? "btn-primary" : "btn-danger"} btn-block" type="submit">
      ${settings.maintenanceMode ? "Matikan Maintenance Mode" : "Aktifkan Maintenance Mode"}
    </button>
  </form>
</div>`;
}
