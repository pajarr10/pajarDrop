// lib/security.js
const crypto = require("crypto");

const COOKIE_NAME = "p4drop_admen";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam

function getAdminSecret() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET belum diset di environment variables");
  return secret;
}

function sign(payload) {
  const secret = getAdminSecret();
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function createSessionCookie() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `admen.${expiresAt}`;
  const signature = sign(payload);
  const value = Buffer.from(`${payload}.${signature}`).toString("base64url");
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function isAdminAuthed(req) {
  try {
    const cookies = parseCookies(req);
    const raw = cookies[COOKIE_NAME];
    if (!raw) return false;
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [tag, expiresAtStr, signature] = parts;
    const payload = `${tag}.${expiresAtStr}`;
    const expected = sign(payload);
    const validSig =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!validSig) return false;
    if (Date.now() > Number(expiresAtStr)) return false;
    return true;
  } catch (err) {
    return false;
  }
}

function checkAdminPassword(password) {
  const secret = process.env.ADMIN_SECRET || "";
  const given = String(password || "");
  if (given.length === 0 || secret.length === 0) return false;
  const a = Buffer.from(given.padEnd(64, "\0"));
  const b = Buffer.from(secret.padEnd(64, "\0"));
  return crypto.timingSafeEqual(a, b) && given === secret;
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(obj));
}

function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

module.exports = {
  COOKIE_NAME,
  createSessionCookie,
  clearSessionCookie,
  parseCookies,
  isAdminAuthed,
  checkAdminPassword,
  sendJson,
  sendHtml,
};
