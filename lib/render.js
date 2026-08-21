// lib/render.js
function logoSvg(size = 32) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="p4-logo">
    <rect x="3" y="3" width="42" height="42" fill="#2B0F0A"/>
    <path d="M24 10V29M24 29L16 21M24 29L32 21" stroke="#F8DCC0" stroke-width="4" stroke-linecap="square" stroke-linejoin="miter" fill="none"/>
    <rect x="13" y="34" width="22" height="4" fill="#F0C020"/>
  </svg>`;
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function pageShell({ title, description = "P4Drop - File Upload & CDN", bodyHtml, extraHead = "", extraScript = "" }) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/css/style.css" />
${extraHead}
</head>
<body>
${bodyHtml}
<script src="/js/common.js"></script>
${extraScript}
</body>
</html>`;
}

module.exports = { logoSvg, escapeHtml, pageShell };
