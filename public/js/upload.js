// public/js/upload.js
(function () {
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var uploadList = document.getElementById("uploadList");

  dropzone.addEventListener("click", function () {
    fileInput.click();
  });

  ["dragenter", "dragover"].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  });
  dropzone.addEventListener("drop", function (e) {
    var files = e.dataTransfer.files;
    if (files && files.length) handleFiles(files);
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) handleFiles(fileInput.files);
    fileInput.value = "";
  });

  function handleFiles(fileList) {
    Array.from(fileList).forEach(uploadOne);
  }

  function uploadOne(file) {
    var item = document.createElement("div");
    item.className = "upload-item";
    item.innerHTML =
      '<div class="ui-top">' +
      '<div><div class="ui-name">' + escapeHtml(file.name) + '</div>' +
      '<div class="ui-size">' + window.p4FormatBytes(file.size) + '</div></div>' +
      '<div class="ui-size" data-role="speed">-</div>' +
      "</div>" +
      '<div class="progress-track"><div class="progress-fill" data-role="fill"></div></div>' +
      '<div class="ui-meta-row"><span data-role="status">Mengunggah...</span><span data-role="percent">0%</span></div>' +
      '<div class="ui-error" data-role="error" style="display:none;"></div>' +
      '<div class="ui-result" data-role="result">' +
      '<span class="ui-status-badge ok" style="margin-bottom:10px;">Upload Selesai</span>' +
      '<img class="preview-img" data-role="preview" style="display:none;" />' +
      '<div class="ui-result-grid">' +
      '<div><span class="rlabel">Filename</span><span class="rval" data-role="rName"></span></div>' +
      '<div><span class="rlabel">Size</span><span class="rval" data-role="rSize"></span></div>' +
      '<div><span class="rlabel">MIME Type</span><span class="rval" data-role="rMime"></span></div>' +
      '<div><span class="rlabel">Expiration</span><span class="rval" data-role="rExpiry">Permanent</span></div>' +
      "</div>" +
      '<div class="ui-url-box"><input type="text" readonly data-role="urlInput" /><button class="btn btn-sm" data-role="copyBtn">Copy URL</button></div>' +
      '<div class="ui-actions">' +
      '<a class="btn btn-sm btn-primary" data-role="openBtn" target="_blank">Buka File</a>' +
      '<button class="btn btn-sm btn-ghost" data-role="againBtn">Upload Lagi</button>' +
      "</div></div>";
    uploadList.prepend(item);

    var fill = item.querySelector('[data-role="fill"]');
    var statusEl = item.querySelector('[data-role="status"]');
    var percentEl = item.querySelector('[data-role="percent"]');
    var speedEl = item.querySelector('[data-role="speed"]');
    var errorEl = item.querySelector('[data-role="error"]');
    var resultEl = item.querySelector('[data-role="result"]');
    var again = item.querySelector('[data-role="againBtn"]');

    again.addEventListener("click", function () {
      dropzone.click();
    });

    var fd = new FormData();
    fd.append("file", file);

    var xhr = new XMLHttpRequest();
    var startTime = Date.now();
    xhr.open("POST", "/api/upload");

    xhr.upload.addEventListener("progress", function (e) {
      if (!e.lengthComputable) return;
      var percent = Math.round((e.loaded / e.total) * 100);
      fill.style.width = percent + "%";
      percentEl.textContent = percent + "%";
      var elapsed = (Date.now() - startTime) / 1000;
      var speed = elapsed > 0 ? e.loaded / elapsed : 0;
      speedEl.textContent = window.p4FormatBytes(speed) + "/s";
    });

    xhr.onload = function () {
      var json;
      try {
        json = JSON.parse(xhr.responseText);
      } catch (err) {
        json = { success: false, error: "Response tidak valid" };
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.success) {
        statusEl.textContent = "Selesai";
        fill.style.width = "100%";
        percentEl.textContent = "100%";
        resultEl.classList.add("show");

        var urlInput = item.querySelector('[data-role="urlInput"]');
        urlInput.value = json.url;
        item.querySelector('[data-role="copyBtn"]').addEventListener("click", function () {
          window.p4CopyText(json.url);
        });
        item.querySelector('[data-role="openBtn"]').setAttribute("href", json.url);
        item.querySelector('[data-role="rName"]').textContent = json.filename || file.name;
        item.querySelector('[data-role="rSize"]').textContent = window.p4FormatBytes(json.size || file.size);
        item.querySelector('[data-role="rMime"]').textContent = json.mime || file.type || "-";
        item.querySelector('[data-role="rExpiry"]').textContent = json.expiresAt ? json.expiresAt : "Permanent";

        if (file.type.startsWith("image/")) {
          var preview = item.querySelector('[data-role="preview"]');
          // Pakai object URL lokal (bukan json.url) supaya preview langsung
          // muncul instan tanpa tergantung propagasi CDN setelah upload.
          var objectUrl = URL.createObjectURL(file);
          preview.onerror = function () {
            preview.style.display = "none";
          };
          preview.onload = function () {
            URL.revokeObjectURL(objectUrl);
          };
          preview.src = objectUrl;
          preview.style.display = "block";
        }
      } else {
        statusEl.textContent = "Gagal";
        errorEl.style.display = "block";
        errorEl.textContent = json.error || "Upload gagal.";
        item.insertAdjacentHTML("beforeend", '<span class="ui-status-badge fail" style="margin-top:8px;">Upload Gagal</span>');
      }
    };

    xhr.onerror = function () {
      statusEl.textContent = "Gagal";
      errorEl.style.display = "block";
      errorEl.textContent = "Koneksi terputus. Coba lagi.";
    };

    xhr.send(fd);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
