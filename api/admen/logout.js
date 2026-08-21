// api/admen/logout.js
const { clearSessionCookie } = require("../../lib/security");

module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.statusCode = 302;
  res.setHeader("Location", "/admen");
  res.end();
};
