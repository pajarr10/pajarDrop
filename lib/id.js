// lib/id.js
const { customAlphabet } = require("nanoid");

// Alfabet tanpa karakter ambigu (0/O, 1/l/I) supaya ID aman dibagikan.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";

const shortId = customAlphabet(alphabet, 6); // dipakai untuk /pajar/<id>.ext
const uploadId = customAlphabet(alphabet, 8); // dipakai untuk /pjr/<id>

function sanitizeDisplayName(name) {
  if (!name || typeof name !== "string") return "file";
  const cleaned = name
    .normalize("NFKC")
    .replace(/[\/\\]/g, "-")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[<>:"|?*]/g, "")
    .trim();
  return cleaned.slice(0, 150) || "file";
}

function sanitizeExtension(ext) {
  if (!ext) return "";
  return ext.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
}

module.exports = { shortId, uploadId, sanitizeDisplayName, sanitizeExtension };
