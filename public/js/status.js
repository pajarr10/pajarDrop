// public/js/status.js
(function () {
  var metaLine = document.getElementById("metaLine");
  var statGrid = document.getElementById("statGrid");

  function formatDuration(ms) {
    var totalSec = Math.floor(ms / 1000);
    var d = Math.floor(totalSec / 86400);
    var h = Math.floor((totalSec % 86400) / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var msPart = ms % 1000;
    return d + "d " + h + "h " + m + "m " + s + "s " + msPart + "ms";
  }

  async function load() {
    try {
      var res = await fetch("/api/stats");
      var data = await res.json();
      if (!data.success) throw new Error(data.error || "Gagal memuat");

      var onlineSince = new Date(data.onlineSince);
      metaLine.innerHTML =
        "Online since: <strong>" + onlineSince.toLocaleString("en-US") + "</strong> &middot; " +
        "Process uptime: <strong>" + formatDuration(data.processUptimeMs) + "</strong> &middot; " +
        "System uptime: <strong>" + formatDuration(data.systemUptimeMs) + "</strong> &middot; " +
        "Memory usage: <strong>" + window.p4FormatBytes(data.memoryUsageBytes) + "</strong>";

      var cards = [
        [data.totalFiles.toLocaleString("id-ID"), "Total Files"],
        [window.p4FormatBytes(data.totalSizeBytes), "Total Size"],
        [data.uploadRatePerHour + " files/hour", "Upload Rate"],
        [window.p4FormatBytes(data.averageFileSizeBytes), "Average File Size"],
        [data.successfulUploads.toLocaleString("id-ID"), "Successful Uploads"],
        [data.failedUploads.toLocaleString("id-ID"), "Failed Uploads"],
        [data.uploadSuccessRatePercent + "%", "Upload Success Rate"],
        [data.totalDownloads.toLocaleString("id-ID"), "Total Downloads"],
        [window.p4FormatBytes(data.totalBandwidthBytes), "Bandwidth Used"],
        [data.activeFiles.toLocaleString("id-ID"), "Active Files"],
        [data.expiredFiles.toLocaleString("id-ID"), "Expired Files"],
      ];

      statGrid.innerHTML = cards
        .map(
          function (c) {
            return '<div class="stat-card"><span class="stat-label">' + c[1] + "</span><strong>" + c[0] + "</strong></div>";
          }
        )
        .join("");
    } catch (err) {
      metaLine.textContent = "Gagal memuat statistik: " + err.message;
    }
  }

  load();
  setInterval(load, 15000);
})();
