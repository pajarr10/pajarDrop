// lib/parse-form.js
// formidable v2 meng-export fungsi langsung (`module.exports = IncomingForm`),
// sedangkan v3+ meng-export objek berisi `{ formidable, IncomingForm, ... }`.
// Shim ini membuat kode tetap jalan di kedua versi tanpa peduli mana yang
// ter-install, supaya tidak crash saat function di-invoke di Vercel.
const formidableLib = require("formidable");
const formidable =
  typeof formidableLib === "function"
    ? formidableLib
    : formidableLib.formidable || formidableLib.default || formidableLib.IncomingForm;

if (typeof formidable !== "function") {
  throw new Error("Tidak bisa memuat modul 'formidable' — cek versi package yang ter-install.");
}

function parseMultipart(req, { maxBytes } = {}) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      maxFileSize: maxBytes || 1024 * 1024 * 1024,
      keepExtensions: true,
    });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

function firstValue(v) {
  if (Array.isArray(v)) return v[0];
  return v;
}

module.exports = { parseMultipart, firstValue };
