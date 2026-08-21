// api/stats.js
const { getStats } = require("../lib/store");
const { sendJson } = require("../lib/security");

const processStart = Date.now();

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { success: false, error: "Method not allowed" });
  }
  try {
    const stats = await getStats();
    const uptimeMs = Date.now() - processStart;
    const mem = process.memoryUsage();

    const onlineSinceMs = new Date(stats.onlineSince).getTime();
    const systemUptimeMs = Date.now() - (isNaN(onlineSinceMs) ? processStart : onlineSinceMs);
    const hoursOnline = Math.max(systemUptimeMs / 3600000, 1 / 60);
    const uploadRatePerHour = stats.totalFiles / hoursOnline;
    const totalAttempts = stats.totalUploadsOk + stats.totalUploadsFail;
    const successRate = totalAttempts > 0 ? (stats.totalUploadsOk / totalAttempts) * 100 : 100;

    return sendJson(res, 200, {
      success: true,
      onlineSince: stats.onlineSince,
      processUptimeMs: uptimeMs,
      systemUptimeMs,
      memoryUsageBytes: mem.rss,
      totalFiles: stats.totalFiles,
      totalSizeBytes: stats.totalSizeBytes,
      uploadRatePerHour: Number(uploadRatePerHour.toFixed(2)),
      averageFileSizeBytes: stats.averageFileSizeBytes,
      successfulUploads: stats.totalUploadsOk,
      failedUploads: stats.totalUploadsFail,
      uploadSuccessRatePercent: Number(successRate.toFixed(2)),
      totalDownloads: stats.totalDownloads,
      totalBandwidthBytes: stats.totalBandwidthBytes,
      activeFiles: stats.activeFiles,
      expiredFiles: stats.expiredFiles,
    });
  } catch (err) {
    return sendJson(res, 500, { success: false, error: "Gagal mengambil statistik." });
  }
};
