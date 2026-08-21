// api/admen/index.js
const { pageShell, logoSvg, escapeHtml } = require("../../lib/render");
const { isAdminAuthed, checkAdminPassword, createSessionCookie, sendHtml } = require("../../lib/security");
const { parseMultipart, firstValue } = require("../../lib/parse-form");

module.exports = async (req, res) => {
  if (req.method === "GET") {
    if (isAdminAuthed(req)) {
      res.statusCode = 302;
      res.setHeader("Location", "/admen/dashboard");
      return res.end();
    }
    return sendHtml(res, 200, renderLogin());
  }

  if (req.method === "POST") {
    try {
      let password = "";
      const contentType = req.headers["content-type"] || "";
      if (contentType.includes("multipart/form-data")) {
        const { fields } = await parseMultipart(req, {});
        password = firstValue(fields.password) || "";
      } else {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString("utf8");
        const params = new URLSearchParams(body);
        password = params.get("password") || "";
      }

      if (!process.env.ADMIN_SECRET) {
        return sendHtml(res, 500, renderLogin("Server belum dikonfigurasi: ADMIN_SECRET kosong."));
      }

      if (!checkAdminPassword(password)) {
        return sendHtml(res, 401, renderLogin("Password salah. Coba lagi."));
      }

      res.setHeader("Set-Cookie", createSessionCookie());
      res.statusCode = 302;
      res.setHeader("Location", "/admen/dashboard");
      return res.end();
    } catch (err) {
      return sendHtml(res, 500, renderLogin("Terjadi kesalahan server."));
    }
  }

  res.statusCode = 405;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Method not allowed");
};

function renderLogin(error) {
  return pageShell({
    title: "Admen Login - P4Drop",
    bodyHtml: `
<main class="wrap login-wrap">
  <div class="card login-card">
    <div class="login-logo">${logoSvg(40)}</div>
    <h1>P4Drop Admen</h1>
    <p class="muted">Masuk untuk mengelola sistem P4Drop.</p>
    ${error ? `<p class="error-box">${escapeHtml(error)}</p>` : ""}
    <form method="POST" action="/admen" class="stack">
      <label class="field">
        <span>Admin Password</span>
        <input type="password" name="password" required autofocus />
      </label>
      <button type="submit" class="btn btn-primary btn-block">Masuk</button>
    </form>
    <a href="/" class="back-link">&larr; Kembali ke Beranda</a>
  </div>
</main>`,
  });
}
