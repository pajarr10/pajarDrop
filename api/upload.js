// api/upload.js
const fs = require("fs");
const { put } = require("@vercel/blob");
const { getAppBaseUrl } = require("../lib/domain");
const { shortId, sanitizeDisplayName, sanitizeExtension } = require("../lib/id");
const { extOf, isMediaExtension, mimeForExtension, maxMediaBytes } = require("../lib/validate");
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

    const { files } = await parseMultipart(req, { maxBytes: maxMediaBytes() });
    const file = firstValue(files.file);
    if (!file) {
      return sendJson(res, 400, { success: false, error: "Field 'file' wajib diisi (FormData)." });
    }

    const originalName = file.originalFilename || "upload";
    const ext = sanitizeExtension(extOf(originalName));

    if (!ext || !isMediaExtension(ext)) {
      return sendJson(res, 415, {
        success: false,
        error: `Format .${ext || "?"} tidak didukung di /upload. Gunakan endpoint /uploadong untuk file non-media.`,
      });
    }

    if (file.size > maxMediaBytes()) {
      return sendJson(res, 413, {
        success: false,
        error: `Ukuran file melebihi batas maksimal ${(maxMediaBytes() / (1024 * 1024)).toFixed(0)} MB.`,
      });
    }

    const id = shortId();
    const pathname = `pajar/${id}.${ext}`;
    const buffer = fs.readFileSync(file.filepath);
    const mime = mimeForExtension(ext);

    const blob = await put(pathname, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: mime,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const record = {
      id,
      kind: "media",
      status: "ok",
      displayName: sanitizeDisplayName(originalName.replace(/\.[^.]+$/, "")),
      ext,
      mime,
      size: file.size,
      blobUrl: blob.url,
      blobPathname: pathname,
      uploadedAt: new Date().toISOString(),
      expiresAt: null,
      downloads: 0,
    };
    await saveFileRecord(record);

    const url = `${getAppBaseUrl(req)}/pajar/${id}.${ext}`;

    return sendJson(res, 200, {
      success: true,
      id,
      url,
      filename: `${id}.${ext}`,
      originalName,
      size: file.size,
      mime,
      uploadedAt: record.uploadedAt,
      expiresAt: null,
    });
  } catch (err) {
    await logError("api/upload", err && err.message);
    const isTooLarge = err && /maxFileSize/i.test(err.message || "");
    return sendJson(res, isTooLarge ? 413 : 500, {
      success: false,
      error: isTooLarge ? "File terlalu besar." : "Upload gagal. Coba lagi.",
    });
  }
};
