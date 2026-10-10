var API_BASE = "/api/shorten";
var HISTORY_KEY = "dshlink_history_v1";
var BRAND_NAME = "AVMX";
var RESERVED_SLUGS = ["api", "index", "style", "script", "app", "admin", "avmx", "dshlink", "shortlink", "www", "static", "assets", "favicon", "model"];
var FRAME_SRC = "/assets/qr-frame.svg";
var FRAME_W = 400;
var FRAME_H = 480;
var QR_X = 82;
var QR_Y = 130;
var QR_SIZE = 218;
var DOWNLOAD_SCALE = 3;
var EXPIRY_OPTIONS = [
  { value: "1h", label: "1 jam", hint: "Cepat habis, cocok untuk berbagi sesaat", color: "var(--coral)" },
  { value: "1d", label: "1 hari", hint: "Pilihan standar", color: "var(--yellow)" },
  { value: "7d", label: "7 hari", hint: "Aktif seminggu penuh", color: "var(--mint)" },
  { value: "30d", label: "30 hari", hint: "Aktif sebulan", color: "var(--sky)" },
  { value: "custom", label: "Tanggal & waktu sendiri", hint: "Atur sesuai jadwalmu", color: "var(--lilac)" },
  { value: "never", label: "Tanpa batas", hint: "Aktif terus sampai kamu hapus", color: "var(--pink)" }
];

var qrCache = {};
var frameImagePromise = null;
var openDropdown = null;

function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function debounce(fn, wait) {
  var timer = null;
  return function () {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
}

function siteHost() {
  return window.location.host.replace(/^www\./i, "");
}

function cleanShortUrl(url) {
  return String(url || "").replace(/^(https?:\/\/)www\./i, "$1");
}

function displayShortUrl(url) {
  return cleanShortUrl(url).replace(/^https?:\/\//i, "");
}

function showToast(message, type) {
  var stack = qs("#toastStack");
  var toast = document.createElement("div");
  toast.className = "toast" + (type ? " toast-" + type : "");
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(function () { toast.remove(); }, 260);
  }, 3600);
}

function normalizeUrl(value) {
  var trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return "https://" + trimmed;
  return trimmed;
}

function isValidUrl(value) {
  if (!value) return false;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    var parsed = new URL(value);
    var hostName = parsed.hostname.replace(/^www\./i, "");
    if (hostName === window.location.hostname.replace(/^www\./i, "")) return false;
    if (!parsed.hostname || parsed.hostname.indexOf(".") === -1) return false;
    return true;
  } catch (err) {
    return false;
  }
}

function isValidSlugFormat(slug) {
  if (!slug) return true;
  if (!/^[a-zA-Z0-9-_]{3,30}$/.test(slug)) return false;
  if (RESERVED_SLUGS.indexOf(slug.toLowerCase()) !== -1) return false;
  return true;
}

function loadHistory() {
  try {
    var raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveHistory(list) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (err) {
    showToast("Gagal menyimpan ke penyimpanan browser ini.", "error");
  }
}

function addToHistory(entry) {
  var list = loadHistory();
  list.unshift(entry);
  saveHistory(list);
}

function removeFromHistory(slug) {
  saveHistory(loadHistory().filter(function (item) { return item.slug !== slug; }));
}

function updateHistoryEntry(slug, patch) {
  var updated = loadHistory().map(function (item) {
    if (item.slug !== slug) return item;
    var merged = {};
    for (var k in item) merged[k] = item[k];
    for (var k2 in patch) merged[k2] = patch[k2];
    return merged;
  });
  saveHistory(updated);
}

function isExpired(item) {
  if (item.noExpiration) return false;
  if (!item.expiresAt) return false;
  return new Date(item.expiresAt).getTime() <= Date.now();
}

function formatDateTime(iso) {
  if (!iso) return "Tidak pernah";
  var d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatExpiryLabel(item) {
  if (item.noExpiration) return "Tanpa batas waktu";
  return "Kadaluarsa " + formatDateTime(item.expiresAt);
}

function apiFetch(url, options) {
  return fetch(url, options).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (body) {
      if (!res.ok) {
        var err = new Error(body.message || "Permintaan gagal");
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    });
  });
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  var temp = document.createElement("textarea");
  temp.value = text;
  temp.style.position = "fixed";
  temp.style.opacity = "0";
  document.body.appendChild(temp);
  temp.select();
  try { document.execCommand("copy"); } catch (err) {}
  document.body.removeChild(temp);
  return Promise.resolve();
}

function flashButton(btn, text) {
  var original = btn.getAttribute("data-label") || btn.textContent;
  btn.setAttribute("data-label", original);
  btn.textContent = text;
  clearTimeout(btn._flashTimer);
  btn._flashTimer = setTimeout(function () { btn.textContent = original; }, 1500);
}

function copyWithFeedback(btn, text) {
  copyText(text).then(function () {
    flashButton(btn, "Tersalin");
    showToast("Link disalin ke clipboard.", "success");
  });
}

function shareLink(url) {
  if (navigator.share) {
    navigator.share({ title: BRAND_NAME, url: url }).catch(function () {});
  } else {
    copyText(url).then(function () { showToast("Fitur share tidak didukung di sini, link sudah disalin.", "success"); });
  }
}

function makeQrDataUrl(text) {
  if (qrCache[text]) return qrCache[text];
  if (!window.QRCode) return null;
  var holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-9999px;top:0;";
  document.body.appendChild(holder);
  var dataUrl = null;
  try {
    new window.QRCode(holder, { text: text, width: 600, height: 600, colorDark: "#1E1E24", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M });
    var canvas = holder.querySelector("canvas");
    if (canvas) dataUrl = canvas.toDataURL("image/png");
  } catch (err) {
    dataUrl = null;
  }
  document.body.removeChild(holder);
  if (dataUrl) qrCache[text] = dataUrl;
  return dataUrl;
}

function fillQrSlot(slot, text) {
  var dataUrl = makeQrDataUrl(text);
  if (dataUrl) {
    slot.innerHTML = '<img src="' + dataUrl + '" alt="QR code untuk ' + esc(displayShortUrl(text)) + '">';
  } else {
    slot.innerHTML = '<p class="qr-fallback">QR code tidak tersedia saat offline.</p>';
  }
}

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error("Gagal memuat gambar")); };
    img.src = src;
  });
}

function downloadFramedQr(text, slug) {
  var dataUrl = makeQrDataUrl(text);
  if (!dataUrl) {
    showToast("QR code belum siap. Coba lagi sebentar.", "error");
    return;
  }
  if (!frameImagePromise) frameImagePromise = loadImage(FRAME_SRC);
  Promise.all([frameImagePromise, loadImage(dataUrl)]).then(function (images) {
    var canvas = document.createElement("canvas");
    canvas.width = FRAME_W * DOWNLOAD_SCALE;
    canvas.height = FRAME_H * DOWNLOAD_SCALE;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(images[0], 0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(images[1], QR_X * DOWNLOAD_SCALE, QR_Y * DOWNLOAD_SCALE, QR_SIZE * DOWNLOAD_SCALE, QR_SIZE * DOWNLOAD_SCALE);
    var fileName = "avmx-qr-" + slug + ".png";
    function saveHref(href, revoke) {
      var a = document.createElement("a");
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revoke) setTimeout(function () { URL.revokeObjectURL(href); }, 2000);
      showToast("QR code berhasil diunduh.", "success");
    }
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (!blob) { showToast("Gagal membuat gambar QR.", "error"); return; }
        saveHref(URL.createObjectURL(blob), true);
      }, "image/png");
    } else {
      saveHref(canvas.toDataURL("image/png"), false);
    }
  }).catch(function () {
    showToast("Gagal mengunduh QR code. Coba lagi.", "error");
  });
}

function closeOpenDropdown() {
  if (openDropdown) {
    openDropdown.close();
    openDropdown = null;
  }
}

function createDropdown(root, options, initialValue, onChange) {
  var currentIndex = 0;
  var activeIndex = 0;
  var isOpen = false;
  var uid = "dd" + Math.floor(Math.random() * 1000000);
  options.forEach(function (opt, i) { if (opt.value === initialValue) currentIndex = i; });
  activeIndex = currentIndex;

  root.className = "dd";
  root.innerHTML =
    '<button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="dd-dot"></span>' +
      '<span class="dd-text"></span>' +
      '<span class="dd-caret" aria-hidden="true"></span>' +
    '</button>' +
    '<ul class="dd-menu" role="listbox" tabindex="-1">' +
      options.map(function (opt, i) {
        return '<li class="dd-opt" role="option" id="' + uid + "-" + i + '" data-index="' + i + '" style="--c:' + opt.color + '">' +
          '<span class="dd-dot"></span>' +
          '<span class="dd-opt-text"><span class="dd-opt-label">' + esc(opt.label) + '</span><span class="dd-opt-hint">' + esc(opt.hint) + '</span></span>' +
          '<span class="dd-check" aria-hidden="true"></span>' +
        '</li>';
      }).join("") +
    '</ul>';

  var btn = qs(".dd-btn", root);
  var menu = qs(".dd-menu", root);
  var items = qsa(".dd-opt", root);

  function paint() {
    var opt = options[currentIndex];
    qs(".dd-text", btn).textContent = opt.label;
    qs(".dd-dot", btn).style.background = opt.color;
    items.forEach(function (li, i) {
      li.setAttribute("aria-selected", i === currentIndex ? "true" : "false");
      li.classList.toggle("is-active", i === activeIndex && isOpen);
    });
    if (isOpen) menu.setAttribute("aria-activedescendant", uid + "-" + activeIndex);
    else menu.removeAttribute("aria-activedescendant");
  }

  function open() {
    if (isOpen) return;
    if (openDropdown && openDropdown !== api) closeOpenDropdown();
    var rect = root.getBoundingClientRect();
    var spaceBelow = window.innerHeight - rect.bottom;
    root.classList.toggle("dd-up", spaceBelow < 340 && rect.top > spaceBelow);
    isOpen = true;
    activeIndex = currentIndex;
    root.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    openDropdown = api;
    paint();
    menu.focus({ preventScroll: true });
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    if (openDropdown === api) openDropdown = null;
    paint();
  }

  function choose(index) {
    var changed = index !== currentIndex;
    currentIndex = index;
    close();
    paint();
    btn.focus();
    if (changed && onChange) onChange(options[currentIndex].value);
  }

  function moveActive(delta) {
    activeIndex = (activeIndex + delta + options.length) % options.length;
    paint();
    items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  btn.addEventListener("click", function () { if (isOpen) close(); else open(); });
  btn.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      open();
    }
  });
  menu.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Home") { e.preventDefault(); activeIndex = 0; paint(); }
    else if (e.key === "End") { e.preventDefault(); activeIndex = options.length - 1; paint(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(activeIndex); }
    else if (e.key === "Escape") { e.preventDefault(); close(); btn.focus(); }
    else if (e.key === "Tab") { close(); }
  });
  items.forEach(function (li, i) {
    li.addEventListener("click", function () { choose(i); });
    li.addEventListener("mousemove", function () {
      if (activeIndex !== i) { activeIndex = i; paint(); }
    });
  });

  var api = {
    root: root,
    close: close,
    getValue: function () { return options[currentIndex].value; },
    setValue: function (value) {
      options.forEach(function (opt, i) { if (opt.value === value) currentIndex = i; });
      activeIndex = currentIndex;
      paint();
      if (onChange) onChange(options[currentIndex].value);
    }
  };
  paint();
  return api;
}

function defaultCustomDate() {
  var soon = new Date(Date.now() + 24 * 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60000);
  soon.setSeconds(0, 0);
  return soon.toISOString().slice(0, 16);
}

document.addEventListener("DOMContentLoaded", function () {
  var form = qs("#shortenForm");
  var urlInput = qs("#urlInput");
  var urlMsg = qs("#urlMsg");
  var urlRow = qs("#urlInputRow");
  var pasteBtn = qs("#pasteBtn");
  var submitBtn = qs("#submitBtn");
  var optionsToggle = qs("#optionsToggle");
  var advancedOptions = qs("#advancedOptions");
  var slugInput = qs("#slugInput");
  var slugStatus = qs("#slugStatus");
  var slugMsg = qs("#slugMsg");
  var customDateGroup = qs("#customDateGroup");
  var customDateInput = qs("#customDateInput");
  var resultSection = qs("#resultSection");
  var resultCard = qs("#resultCard");
  var historyList = qs("#historyList");
  var historyEmpty = qs("#historyEmpty");
  var historyCount = qs("#historyCount");
  var deleteModalBackdrop = qs("#deleteModalBackdrop");
  var deleteModalCancel = qs("#deleteModalCancel");
  var deleteModalConfirm = qs("#deleteModalConfirm");
  var qrModalBackdrop = qs("#qrModalBackdrop");
  var qrModalSlot = qs("#qrModalSlot");
  var qrModalUrl = qs("#qrModalUrl");
  var qrModalClose = qs("#qrModalClose");
  var qrModalDownload = qs("#qrModalDownload");
  var welcomeModalBackdrop = qs("#welcomeModalBackdrop");
  var welcomeModalClose = qs("#welcomeModalClose");
  var pendingDeleteSlug = null;
  var currentQr = null;
  var slugAvailable = null;

  qs("#slugPrefix").textContent = siteHost() + "/";
  qs("#demoShort").textContent = siteHost() + "/halo";

  var expirationDropdown = createDropdown(qs("#expirationDropdown"), EXPIRY_OPTIONS, "1d", function (value) {
    customDateGroup.hidden = value !== "custom";
    if (value === "custom" && !customDateInput.value) customDateInput.value = defaultCustomDate();
  });

  function openModal(backdrop) {
    backdrop.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeModal(backdrop) {
    backdrop.hidden = true;
    if (deleteModalBackdrop.hidden && qrModalBackdrop.hidden && welcomeModalBackdrop.hidden) document.body.classList.remove("no-scroll");
  }

  function setOptionsOpen(open) {
    advancedOptions.hidden = !open;
    optionsToggle.setAttribute("aria-expanded", String(open));
  }

  optionsToggle.addEventListener("click", function () {
    setOptionsOpen(advancedOptions.hidden);
  });

  if (!(navigator.clipboard && navigator.clipboard.readText)) {
    pasteBtn.hidden = true;
  }
  pasteBtn.addEventListener("click", function () {
    navigator.clipboard.readText().then(function (text) {
      urlInput.value = (text || "").trim();
      urlInput.dispatchEvent(new Event("input"));
      urlInput.focus();
    }).catch(function () {
      showToast("Izin clipboard ditolak. Tempel manual dengan menekan lama di kolom link.", "error");
    });
  });

  urlInput.addEventListener("input", function () {
    urlRow.classList.remove("is-error");
    urlMsg.textContent = "";
    urlMsg.classList.remove("is-error");
  });

  function resetSlugFeedback() {
    slugStatus.className = "slug-status";
    slugMsg.textContent = "";
    slugMsg.classList.remove("is-error", "is-success");
    slugAvailable = null;
  }

  var checkSlug = debounce(function (value) {
    if (!value) { resetSlugFeedback(); return; }
    if (!isValidSlugFormat(value)) {
      slugStatus.className = "slug-status taken";
      slugMsg.textContent = "Gunakan 3-30 huruf, angka, - atau _, dan hindari kata yang sudah dipakai sistem.";
      slugMsg.classList.add("is-error");
      slugMsg.classList.remove("is-success");
      slugAvailable = false;
      return;
    }
    slugStatus.className = "slug-status checking";
    apiFetch(API_BASE + "?action=check&slug=" + encodeURIComponent(value))
      .then(function (data) {
        if (slugInput.value.trim() !== value) return;
        if (data.available) {
          slugStatus.className = "slug-status available";
          slugMsg.textContent = "Slug ini masih tersedia.";
          slugMsg.classList.add("is-success");
          slugMsg.classList.remove("is-error");
          slugAvailable = true;
        } else {
          slugStatus.className = "slug-status taken";
          slugMsg.textContent = "Slug ini sudah dipakai.";
          slugMsg.classList.add("is-error");
          slugMsg.classList.remove("is-success");
          slugAvailable = false;
        }
      })
      .catch(function () {
        slugStatus.className = "slug-status";
        slugMsg.textContent = "Tidak bisa mengecek ketersediaan saat ini.";
        slugMsg.classList.add("is-error");
        slugAvailable = null;
      });
  }, 420);

  slugInput.addEventListener("input", function () {
    var value = slugInput.value.trim();
    if (value) slugStatus.className = "slug-status checking";
    checkSlug(value);
  });

  function renderResultCard(data) {
    var shortUrl = cleanShortUrl(data.shortUrl);
    var active = data.noExpiration || new Date(data.expiresAt).getTime() > Date.now();
    resultSection.hidden = false;
    resultCard.innerHTML =
      '<div class="result-main">' +
        '<div class="result-head">' +
          '<span class="status-badge ' + (active ? "status-active" : "status-expired") + '">' + (active ? "Aktif" : "Kadaluarsa") + '</span>' +
          '<span class="result-title">Link kamu sudah jadi</span>' +
        '</div>' +
        '<a class="result-short" href="' + esc(shortUrl) + '" target="_blank" rel="noopener">' + esc(displayShortUrl(shortUrl)) + '</a>' +
        '<p class="result-original">Tujuan: ' + esc(data.originalUrl) + '</p>' +
        '<div class="result-actions">' +
          '<button type="button" class="btn btn-primary" data-action="copy">Salin link</button>' +
          '<button type="button" class="btn" data-action="share">Bagikan</button>' +
          '<button type="button" class="btn btn-mint" data-action="download-qr">Unduh QR</button>' +
        '</div>' +
        '<div class="meta-list">' +
          '<div class="meta-row"><span>Slug custom</span><span>' + (data.custom ? "Ya" : "Tidak") + '</span></div>' +
          '<div class="meta-row"><span>Masa berlaku</span><span>' + (data.noExpiration ? "Tanpa batas" : formatDateTime(data.expiresAt)) + '</span></div>' +
          '<div class="meta-row"><span>Klik sejauh ini</span><span>0</span></div>' +
          '<div class="meta-row"><span>Dibuat</span><span>' + formatDateTime(data.createdAt) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="result-qr">' +
        '<div class="qr-frame"><div class="qr-slot"></div></div>' +
        '<p class="field-msg">Scan untuk membuka link</p>' +
      '</div>';
    fillQrSlot(qs(".qr-slot", resultCard), shortUrl);
    var copyBtn = qs('[data-action="copy"]', resultCard);
    copyBtn.addEventListener("click", function () { copyWithFeedback(copyBtn, shortUrl); });
    qs('[data-action="share"]', resultCard).addEventListener("click", function () { shareLink(shortUrl); });
    qs('[data-action="download-qr"]', resultCard).addEventListener("click", function () { downloadFramedQr(shortUrl, data.slug); });
    resultSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var urlValue = normalizeUrl(urlInput.value);
    var slugValue = slugInput.value.trim();
    var expirationValue = expirationDropdown.getValue();
    var customDateValue = customDateInput.value;

    if (!isValidUrl(urlValue)) {
      urlRow.classList.add("is-error");
      urlMsg.textContent = "Link belum valid. Contoh: https://contoh.com/halaman";
      urlMsg.classList.add("is-error");
      urlInput.focus();
      return;
    }
    urlInput.value = urlValue;
    if (slugValue && !isValidSlugFormat(slugValue)) {
      slugMsg.textContent = "Gunakan 3-30 huruf, angka, - atau _, dan hindari kata yang sudah dipakai sistem.";
      slugMsg.classList.add("is-error");
      setOptionsOpen(true);
      slugInput.focus();
      return;
    }
    if (slugValue && slugAvailable === false) {
      slugMsg.textContent = "Slug ini sudah dipakai. Coba yang lain.";
      slugMsg.classList.add("is-error");
      setOptionsOpen(true);
      slugInput.focus();
      return;
    }
    if (expirationValue === "custom" && !customDateValue) {
      showToast("Pilih tanggal dan waktu kadaluarsa custom.", "error");
      return;
    }
    if (expirationValue === "custom" && new Date(customDateValue).getTime() <= Date.now()) {
      showToast("Tanggal kadaluarsa custom harus di masa depan.", "error");
      return;
    }

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;
    qs(".btn-label", submitBtn).textContent = "Memproses";

    apiFetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalUrl: urlValue,
        customSlug: slugValue || null,
        expirationOption: expirationValue,
        customExpiresAt: expirationValue === "custom" ? new Date(customDateValue).toISOString() : null
      })
    })
      .then(function (data) {
        data.shortUrl = cleanShortUrl(data.shortUrl);
        renderResultCard(data);
        addToHistory({
          slug: data.slug,
          shortUrl: data.shortUrl,
          originalUrl: data.originalUrl,
          ownerToken: data.ownerToken,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          noExpiration: data.noExpiration,
          clicks: 0
        });
        renderHistory();
        showToast("Short link berhasil dibuat.", "success");
        form.reset();
        expirationDropdown.setValue("1d");
        setOptionsOpen(false);
        customDateGroup.hidden = true;
        customDateInput.value = "";
        resetSlugFeedback();
      })
      .catch(function (err) {
        if (err.status === 409) {
          slugMsg.textContent = "Slug itu baru saja diambil orang lain. Coba yang lain.";
          slugMsg.classList.add("is-error");
          setOptionsOpen(true);
        } else if (err.status === 400) {
          urlRow.classList.add("is-error");
          urlMsg.textContent = err.body && err.body.message ? err.body.message : "URL itu tidak valid.";
          urlMsg.classList.add("is-error");
        } else {
          showToast("Ada masalah di server kami. Coba lagi.", "error");
        }
      })
      .finally(function () {
        submitBtn.classList.remove("is-loading");
        submitBtn.disabled = false;
        qs(".btn-label", submitBtn).textContent = "Perpendek";
      });
  });

  function renderStatsPanel(panel, stats) {
    var byDevice = stats.byDevice || {};
    var byBrowser = stats.byBrowser || {};
    var byCountry = stats.byCountry || {};
    function barsHtml(map) {
      var keys = Object.keys(map);
      if (keys.length === 0) return '<p class="field-msg">Belum ada klik yang tercatat.</p>';
      var max = Math.max.apply(null, keys.map(function (k) { return map[k]; }));
      return '<div class="stats-bars">' + keys.map(function (k) {
        var pct = Math.max(6, Math.round((map[k] / max) * 100));
        return '<div class="stats-bar-row"><span class="stats-bar-label">' + esc(k) + '</span><div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div><span class="stats-bar-count">' + map[k] + '</span></div>';
      }).join("") + '</div>';
    }
    panel.innerHTML =
      '<div class="stats-grid">' +
        '<div class="stats-box"><div class="stats-box-label">Total klik</div><div class="stats-box-value">' + stats.totalClicks + '</div></div>' +
        '<div class="stats-box"><div class="stats-box-label">Status</div><div class="stats-box-value">' + (stats.status === "active" ? "Aktif" : "Kadaluarsa") + '</div></div>' +
      '</div>' +
      '<div><p class="stats-title">Berdasarkan perangkat</p>' + barsHtml(byDevice) + '</div>' +
      '<div><p class="stats-title">Berdasarkan browser</p>' + barsHtml(byBrowser) + '</div>' +
      '<div><p class="stats-title">Berdasarkan lokasi perkiraan</p>' + barsHtml(byCountry) + '</div>';
  }

  function openQrModal(shortUrl, slug) {
    currentQr = { url: shortUrl, slug: slug };
    qrModalUrl.textContent = displayShortUrl(shortUrl);
    fillQrSlot(qrModalSlot, shortUrl);
    openModal(qrModalBackdrop);
    qrModalClose.focus();
  }

  function renderHistory() {
    var list = loadHistory();
    historyList.innerHTML = "";
    historyCount.textContent = String(list.length);
    if (list.length === 0) {
      historyEmpty.classList.add("is-visible");
      return;
    }
    historyEmpty.classList.remove("is-visible");
    list.forEach(function (item) {
      var expired = isExpired(item);
      var shortUrl = cleanShortUrl(item.shortUrl);
      var el = document.createElement("div");
      el.className = "history-item";
      el.setAttribute("data-slug", item.slug);
      el.innerHTML =
        '<div class="history-item-top">' +
          '<div class="history-link-info">' +
            '<div class="history-short">' + esc(displayShortUrl(shortUrl)) + '</div>' +
            '<div class="history-original">' + esc(item.originalUrl) + '</div>' +
          '</div>' +
          '<span class="status-badge ' + (expired ? "status-expired" : "status-active") + '">' + (expired ? "Kadaluarsa" : "Aktif") + '</span>' +
        '</div>' +
        '<div class="history-meta">' +
          '<span class="meta-clicks">' + (item.clicks || 0) + ' klik</span>' +
          '<span>' + esc(formatExpiryLabel(item)) + '</span>' +
          '<span>Dibuat ' + esc(formatDateTime(item.createdAt)) + '</span>' +
        '</div>' +
        '<div class="history-actions">' +
          '<button type="button" class="btn btn-sm btn-primary" data-action="copy">Salin</button>' +
          '<button type="button" class="btn btn-sm" data-action="share">Bagikan</button>' +
          '<button type="button" class="btn btn-sm btn-mint" data-action="qr">QR</button>' +
          '<button type="button" class="btn btn-sm btn-sky" data-action="stats">Statistik</button>' +
          '<button type="button" class="btn btn-sm btn-lilac" data-action="edit">Ubah masa berlaku</button>' +
          '<button type="button" class="btn btn-sm btn-danger" data-action="delete">Hapus</button>' +
        '</div>' +
        '<div class="stats-panel" data-role="stats-panel"><p class="field-msg">Memuat statistik...</p></div>' +
        '<div class="expiration-editor" data-role="expiration-editor">' +
          '<div data-role="edit-dd"></div>' +
          '<input type="datetime-local" class="date-input" data-role="edit-custom-date" hidden>' +
          '<div><button type="button" class="btn btn-sm btn-primary" data-action="save-expiration">Simpan</button></div>' +
        '</div>';
      historyList.appendChild(el);

      var editDate = qs('[data-role="edit-custom-date"]', el);
      var editDropdown = createDropdown(qs('[data-role="edit-dd"]', el), EXPIRY_OPTIONS, "1d", function (value) {
        editDate.hidden = value !== "custom";
        if (value === "custom" && !editDate.value) editDate.value = defaultCustomDate();
      });

      var copyBtn = qs('[data-action="copy"]', el);
      copyBtn.addEventListener("click", function () { copyWithFeedback(copyBtn, shortUrl); });
      qs('[data-action="share"]', el).addEventListener("click", function () { shareLink(shortUrl); });
      qs('[data-action="qr"]', el).addEventListener("click", function () { openQrModal(shortUrl, item.slug); });
      qs('[data-action="delete"]', el).addEventListener("click", function () {
        pendingDeleteSlug = item.slug;
        openModal(deleteModalBackdrop);
        deleteModalCancel.focus();
      });
      qs('[data-action="stats"]', el).addEventListener("click", function () {
        var panel = qs('[data-role="stats-panel"]', el);
        var willOpen = !panel.classList.contains("is-open");
        panel.classList.toggle("is-open");
        if (willOpen) {
          panel.innerHTML = '<p class="field-msg">Memuat statistik...</p>';
          apiFetch(API_BASE + "?action=info&slug=" + encodeURIComponent(item.slug) + "&token=" + encodeURIComponent(item.ownerToken))
            .then(function (data) {
              updateHistoryEntry(item.slug, { clicks: data.totalClicks });
              qs(".meta-clicks", el).textContent = data.totalClicks + " klik";
              renderStatsPanel(panel, data);
            })
            .catch(function () {
              panel.innerHTML = '<p class="field-msg is-error">Tidak bisa memuat statistik saat ini.</p>';
            });
        }
      });
      qs('[data-action="edit"]', el).addEventListener("click", function () {
        qs('[data-role="expiration-editor"]', el).classList.toggle("is-open");
      });
      qs('[data-action="save-expiration"]', el).addEventListener("click", function () {
        var option = editDropdown.getValue();
        var customIso = null;
        if (option === "custom") {
          if (!editDate.value) { showToast("Pilih tanggal dan waktu dulu.", "error"); return; }
          if (new Date(editDate.value).getTime() <= Date.now()) { showToast("Tanggal harus di masa depan.", "error"); return; }
          customIso = new Date(editDate.value).toISOString();
        }
        apiFetch(API_BASE + "?action=expiration&slug=" + encodeURIComponent(item.slug) + "&token=" + encodeURIComponent(item.ownerToken), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expirationOption: option, customExpiresAt: customIso })
        })
          .then(function (data) {
            updateHistoryEntry(item.slug, { expiresAt: data.expiresAt, noExpiration: data.noExpiration });
            showToast("Masa berlaku berhasil diperbarui.", "success");
            renderHistory();
          })
          .catch(function () {
            showToast("Gagal memperbarui masa berlaku.", "error");
          });
      });
    });
  }

  deleteModalCancel.addEventListener("click", function () {
    closeModal(deleteModalBackdrop);
    pendingDeleteSlug = null;
  });

  deleteModalConfirm.addEventListener("click", function () {
    if (!pendingDeleteSlug) return;
    var target = loadHistory().filter(function (item) { return item.slug === pendingDeleteSlug; })[0];
    if (!target) { closeModal(deleteModalBackdrop); return; }
    deleteModalConfirm.disabled = true;
    apiFetch(API_BASE + "?action=delete&slug=" + encodeURIComponent(target.slug) + "&token=" + encodeURIComponent(target.ownerToken), { method: "DELETE" })
      .then(function () {
        removeFromHistory(target.slug);
        renderHistory();
        showToast("Link berhasil dihapus.", "success");
      })
      .catch(function () {
        showToast("Gagal menghapus link ini. Coba lagi.", "error");
      })
      .finally(function () {
        deleteModalConfirm.disabled = false;
        closeModal(deleteModalBackdrop);
        pendingDeleteSlug = null;
      });
  });

  qrModalClose.addEventListener("click", function () { closeModal(qrModalBackdrop); });
  qrModalDownload.addEventListener("click", function () {
    if (currentQr) downloadFramedQr(currentQr.url, currentQr.slug);
  });

  deleteModalBackdrop.addEventListener("click", function (e) {
    if (e.target === deleteModalBackdrop) {
      closeModal(deleteModalBackdrop);
      pendingDeleteSlug = null;
    }
  });
  qrModalBackdrop.addEventListener("click", function (e) {
    if (e.target === qrModalBackdrop) closeModal(qrModalBackdrop);
  });

  document.addEventListener("mousedown", function (e) {
    if (openDropdown && !openDropdown.root.contains(e.target)) closeOpenDropdown();
  });
  document.addEventListener("touchstart", function (e) {
    if (openDropdown && !openDropdown.root.contains(e.target)) closeOpenDropdown();
  }, { passive: true });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!deleteModalBackdrop.hidden) { closeModal(deleteModalBackdrop); pendingDeleteSlug = null; }
    if (!qrModalBackdrop.hidden) closeModal(qrModalBackdrop);
  });

  var menuToggle = qs("#menuToggle");
  var mainNav = qs("#mainNav");

  function setMenu(open) {
    mainNav.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
  }

  menuToggle.addEventListener("click", function () {
    setMenu(!mainNav.classList.contains("is-open"));
  });
  qsa("a", mainNav).forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("click", function (e) {
    if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  var WELCOME_KEY = "avmx_welcome_seen";
  var welcomeSeen = false;
  try { welcomeSeen = window.sessionStorage.getItem(WELCOME_KEY) === "1"; } catch (err) {}
  if (!welcomeSeen) {
    openModal(welcomeModalBackdrop);
    welcomeModalClose.focus();
  }
  function dismissWelcome() {
    closeModal(welcomeModalBackdrop);
    try { window.sessionStorage.setItem(WELCOME_KEY, "1"); } catch (err) {}
  }
  welcomeModalClose.addEventListener("click", dismissWelcome);
  welcomeModalBackdrop.addEventListener("click", function (e) {
    if (e.target === welcomeModalBackdrop) dismissWelcome();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !welcomeModalBackdrop.hidden) dismissWelcome();
  });

  renderHistory();
});
