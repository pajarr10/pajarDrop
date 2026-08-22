// api/sitemap.js
const { getAppBaseUrl } = require("../lib/domain");

module.exports = async (req, res) => {
  const base = getAppBaseUrl(req);
  const now = new Date().toISOString();

  const pages = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/upload", priority: "0.9", changefreq: "monthly" },
    { path: "/uploadong", priority: "0.9", changefreq: "monthly" },
    { path: "/status", priority: "0.5", changefreq: "daily" },
  ];

  const urlEntries = pages
    .map(
      (p) => `  <url>
    <loc>${base}${p.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(xml);
};
