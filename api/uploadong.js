// api/uploadong.js
const fs = require("fs");
const { put } = require("@vercel/blob");
const { getCdnBaseUrl } = require("../lib/domain");
const { uploadId, sanitizeDisplayName, sanitizeExtension } = require("../lib/id");
const { extOf, maxFileBytes, EXPIRY_OPTIONS } = require("../lib/validate");
const { checkRateLimit } = require("../lib/ratelimit");
const { saveFileRecord, logError } = require("../lib/store");
const { sendJson } = require("../lib/security");
const { parseMultipart, firstValue } = require("../lib/parse-form");

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.end();
  }
  if (req.method !== "POST") {
    return sendJson(res, 405, { success: false, error: "Method not allowed. Gunakan POST." });
  }

  try {
    const rl = await checkRateLimit(req);
    res.setHeader("X-RateLimit-Limit", String(rl.limit));
    res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
    if (!rl.allowed) {
      return sendJson(res, 429, {
        success: false,
        error: "Rate limit tercapai. Maksimal 100 file per menit per client.",
      });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return sendJson(res, 500, { success: false, error: "Storage belum dikonfigurasi (BLOB_READ_WRITE_TOKEN kosong)." });
    }

    const { fields, files } = await parseMultipart(req, { maxBytes: maxFileBytes() });
    const file = firstValue(files.file);
    if (!file) {
      return sendJson(res, 400, { success: false, error: "Field 'file' wajib diisi (FormData)." });
    }

    if (file.size > maxFileBytes()) {
      return sendJson(res, 413, {
        success: false,
        error: `Ukuran file melebihi batas maksimal ${(maxFileBytes() / (1024 * 1024)).toFixed(0)} MB.`,
      });
    }

    const description = sanitizeDisplayName(firstValue(fields.description) || "").slice(0, 300) || "";
    const expiryKey = firstValue(fields.expiry) || "24h";
    const expiryMs = EXPIRY_OPTIONS[expiryKey];
    if (!expiryMs) {
      return sendJson(res, 400, {
        success: false,
        error: "Masa aktif tidak valid. Pilihan: 1h, 24h, 5d, 15d.",
      });
    }

    const originalName = file.originalFilename || "file";
    const ext = sanitizeExtension(extOf(originalName));
    const customNameRaw = firstValue(fields.filename);
    const baseName = sanitizeDisplayName(
      customNameRaw && customNameRaw.trim() ? customNameRaw : originalName.replace(/\.[^.]+$/, "")
    );
    const displayName = ext ? `${baseName}.${ext}` : baseName;

    const id = uploadId();
    const pathname = `pjr/${id}/${displayName}`;
    const buffer = fs.readFileSync(file.filepath);

    const blob = await put(pathname, buffer, {
      access: "public",
      addRandomSuffix: false,
      // Selalu disimpan sebagai octet-stream: file dari /uploadong TIDAK PERNAH
      // dieksekusi atau dirender aktif (mis. HTML/JS/PHP/SVG), hanya untuk
      // disimpan & didownload sebagai attachment.
      contentType: "application/octet-stream",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const uploadedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiryMs).toISOString();

    const record = {
      id,
      kind: "file",
      status: "ok",
      displayName,
      ext,
      mime: "application/octet-stream",
      size: file.size,
      description,
      blobUrl: blob.url,
      blobPathname: pathname,
      uploadedAt,
      expiresAt,
      downloads: 0,
    };
    await saveFileRecord(record);

    const url = `${getCdnBaseUrl(req)}/pjr/${id}`;

    return sendJson(res, 200, {
      success: true,
      id,
      url,
      filename: displayName,
      size: file.size,
      description,
      uploadedAt,
      expiresAt,
    });
  } catch (err) {
    await logError("api/uploadong", err && err.message);
    const isTooLarge = err && /maxFileSize/i.test(err.message || "");
    return sendJson(res, isTooLarge ? 413 : 500, {
      success: false,
      error: isTooLarge ? "File terlalu besar." : "Upload gagal. Coba lagi.",
    });
  }
};
