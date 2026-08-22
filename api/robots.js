// api/robots.js
const { getAppBaseUrl } = require("../lib/domain");

module.exports = async (req, res) => {
  const base = getAppBaseUrl(req);
  const body = `User-agent: *
Allow: /
Allow: /upload
Allow: /uploadong
Allow: /status
Disallow: /admen
Disallow: /admen/
Disallow: /api/
Disallow: /pjr/
Disallow: /pajar/

Sitemap: ${base}/sitemap.xml
`;
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(body);
};
