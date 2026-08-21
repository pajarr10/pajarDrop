// lib/domain.js
// Domain TIDAK PERNAH di-hardcode. Selalu dideteksi dari header request
// sehingga project bisa dipindah ke domain apa pun tanpa mengubah source code.
//
// CATATAN: P4Drop tidak lagi memakai subdomain terpisah (c.domain.com).
// Semua URL file (media & uploadong) sekarang berada di root domain yang
// sama: domain.com/pajar/<id>.<ext> dan domain.com/pjr/<id>.

function getHost(req) {
  const forwarded = req.headers["x-forwarded-host"];
  const host = (forwarded || req.headers.host || "localhost:3000").toString();
  return host.split(",")[0].trim();
}

function getProtocol(req) {
  const proto = req.headers["x-forwarded-proto"];
  if (proto) return proto.toString().split(",")[0].trim();
  return process.env.NODE_ENV === "development" ? "http" : "https";
}

function getAppBaseUrl(req) {
  return `${getProtocol(req)}://${getHost(req)}`;
}

module.exports = {
  getHost,
  getProtocol,
  getAppBaseUrl,
};
