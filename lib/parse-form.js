// lib/parse-form.js
const formidable = require("formidable");

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
