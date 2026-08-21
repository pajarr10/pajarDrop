// lib/validate.js

const MEDIA_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  avif: "image/avif",
  heic: "image/heic",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  weba: "audio/webm",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  m4v: "video/x-m4v",
  "3gp": "video/3gpp",
};

const MEDIA_EXTENSIONS = new Set(Object.keys(MEDIA_MIME));

// Extension yang secara eksplisit TIDAK PERNAH boleh dieksekusi/di-serve
// sebagai HTML aktif di sisi /uploadong — tetap boleh disimpan & didownload,
// hanya perlakuannya selalu sebagai attachment biner, tidak pernah dijalankan.
const NEVER_EXECUTE = new Set([
  "php", "php3", "php4", "php5", "phtml", "sh", "bash", "exe", "bat", "cmd",
  "com", "msi", "ps1", "vbs", "js", "cgi", "pl", "py", "rb", "jar", "app",
  "html", "htm", "svg",
]);

const DEFAULT_MAX_MEDIA_MB = 200;
const DEFAULT_MAX_FILE_MB = 1024;

function maxMediaBytes() {
  const mb = Number(process.env.MAX_MEDIA_MB) || DEFAULT_MAX_MEDIA_MB;
  return mb * 1024 * 1024;
}

function maxFileBytes() {
  const mb = Number(process.env.MAX_FILE_MB) || DEFAULT_MAX_FILE_MB;
  return mb * 1024 * 1024;
}

function extOf(filename) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
  return m ? m[1].toLowerCase() : "";
}

function isMediaExtension(ext) {
  return MEDIA_EXTENSIONS.has(ext.toLowerCase());
}

function mimeForExtension(ext) {
  return MEDIA_MIME[ext.toLowerCase()] || "application/octet-stream";
}

function mustNeverExecute(ext) {
  return NEVER_EXECUTE.has(ext.toLowerCase());
}

const EXPIRY_OPTIONS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "5d": 5 * 24 * 60 * 60 * 1000,
  "15d": 15 * 24 * 60 * 60 * 1000,
};

module.exports = {
  MEDIA_MIME,
  MEDIA_EXTENSIONS,
  extOf,
  isMediaExtension,
  mimeForExtension,
  mustNeverExecute,
  maxMediaBytes,
  maxFileBytes,
  EXPIRY_OPTIONS,
};
