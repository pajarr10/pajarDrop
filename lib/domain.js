// lib/domain.js
// Domain TIDAK PERNAH di-hardcode. Selalu dideteksi dari header request
// sehingga project bisa dipindah ke domain apa pun tanpa mengubah source code.

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

function getRootHost(req) {
  const host = getHost(req);
  return host.startsWith("c.") ? host.slice(2) : host;
}

function getCdnHost(req) {
  return `c.${getRootHost(req)}`;
}

function isCdnHost(req) {
  return getHost(req).startsWith("c.");
}

function getAppBaseUrl(req) {
  return `${getProtocol(req)}://${getRootHost(req)}`;
}

function getCdnBaseUrl(req) {
  return `${getProtocol(req)}://${getCdnHost(req)}`;
}

module.exports = {
  getHost,
  getProtocol,
  getRootHost,
  getCdnHost,
  isCdnHost,
  getAppBaseUrl,
  getCdnBaseUrl,
};
