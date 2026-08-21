// api/maintenance-status.js
const { getSettings } = require("../lib/store");
const { sendJson } = require("../lib/security");

module.exports = async (req, res) => {
  try {
    const settings = await getSettings();
    return sendJson(res, 200, { success: true, maintenanceMode: !!settings.maintenanceMode });
  } catch (err) {
    // Fail-safe: kalau gagal baca settings, JANGAN kunci semua orang keluar.
    return sendJson(res, 200, { success: true, maintenanceMode: false });
  }
};
