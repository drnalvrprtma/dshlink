var API_BASE = "/api/shorten";
var HISTORY_KEY = "dshlink_history_v1";
var RESERVED_SLUGS = ["api", "index", "style", "script", "app", "admin", "dshlink", "shortlink", "www", "static", "assets", "favicon", "model"];

function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function debounce(fn, wait) {
  var timer = null;
  return function () {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
  };
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

function isValidUrl(value) {
  if (!value) return false;
  var trimmed = value.trim();
  var candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) return false;
  try {
    var parsed = new URL(candidate);
    if (parsed.hostname === window.location.hostname) return false;
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
  var list = loadHistory().filter(function (item) { return item.slug !== slug; });
  saveHistory(list);
}

function updateHistoryEntry(slug, patch) {
  var list = loadHistory();
  var updated = list.map(function (item) {
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
  if (item.noExpiration) return "Tidak pernah kadaluarsa";
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

function initScrollReveal() {
  var items = qsa(".reveal");
  if (!items.length) return;
  if (!window.IntersectionObserver) {
    items.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  items.forEach(function (el) { observer.observe(el); });
}

function initHero3d() {
  var canvas = qs("#hero3dCanvas");
  var frame = qs(".hero3d-frame");
  if (!canvas || !frame || !window.THREE) return;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var scene = new window.THREE.Scene();
  var camera = new window.THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.6, 4.2);

  var renderer = new window.THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var ambient = new window.THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);
  var keyLight = new window.THREE.DirectionalLight(0x2d6cff, 1.1);
  keyLight.position.set(3, 4, 3);
  scene.add(keyLight);
  var rimLight = new window.THREE.DirectionalLight(0x0f1b3d, 0.5);
  rimLight.position.set(-3, -2, -2);
  scene.add(rimLight);

  var activeObject = null;

  function usePlaceholder() {
    var geometry = new window.THREE.IcosahedronGeometry(1.15, 0);
    var material = new window.THREE.MeshStandardMaterial({ color: 0x0f1b3d, metalness: 0.25, roughness: 0.35 });
    var mesh = new window.THREE.Mesh(geometry, material);
    var wireGeometry = new window.THREE.IcosahedronGeometry(1.3, 0);
    var wireMaterial = new window.THREE.MeshBasicMaterial({ color: 0x2d6cff, wireframe: true, transparent: true, opacity: 0.35 });
    var wireMesh = new window.THREE.Mesh(wireGeometry, wireMaterial);
    var group = new window.THREE.Group();
    group.add(mesh);
    group.add(wireMesh);
    scene.add(group);
    activeObject = group;
  }

  function frameObject(object) {
    var box = new window.THREE.Box3().setFromObject(object);
    var size = new window.THREE.Vector3();
    box.getSize(size);
    var center = new window.THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    var scaleFactor = 1.9 / maxDim;
    object.scale.setScalar(scaleFactor);
  }

  if (window.THREE.GLTFLoader) {
    var loader = new window.THREE.GLTFLoader();
    loader.load(
      "model.glb",
      function (gltf) {
        var model = gltf.scene;
        frameObject(model);
        scene.add(model);
        activeObject = model;
      },
      undefined,
      function () {
        usePlaceholder();
      }
    );
  } else {
    usePlaceholder();
  }

  function resize() {
    var width = frame.clientWidth;
    var height = frame.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(frame);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (activeObject && !reduceMotion) {
      activeObject.rotation.y += 0.006;
      activeObject.rotation.x = Math.sin(Date.now() * 0.0003) * 0.08;
    }
    renderer.render(scene, camera);
  }
  animate();
}

document.addEventListener("DOMContentLoaded", function () {
  var form = qs("#shortenForm");
  var urlInput = qs("#urlInput");
  var urlMsg = qs("#urlMsg");
  var urlRow = qs("#urlInputRow");
  var submitBtn = qs("#submitBtn");
  var optionsToggle = qs("#optionsToggle");
  var advancedOptions = qs("#advancedOptions");
  var slugInput = qs("#slugInput");
  var slugStatus = qs("#slugStatus");
  var slugMsg = qs("#slugMsg");
  var expirationSelect = qs("#expirationSelect");
  var customDateGroup = qs("#customDateGroup");
  var customDateInput = qs("#customDateInput");
  var resultSection = qs("#resultSection");
  var resultCard = qs("#resultCard");
  var historyList = qs("#historyList");
  var historyEmpty = qs("#historyEmpty");
  var deleteModalBackdrop = qs("#deleteModalBackdrop");
  var deleteModalCancel = qs("#deleteModalCancel");
  var deleteModalConfirm = qs("#deleteModalConfirm");
  var pendingDeleteSlug = null;
  var slugAvailable = null;

  optionsToggle.addEventListener("click", function () {
    var isOpen = advancedOptions.hidden === false;
    advancedOptions.hidden = isOpen;
    optionsToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  expirationSelect.addEventListener("change", function () {
    customDateGroup.hidden = expirationSelect.value !== "custom";
    if (expirationSelect.value === "custom" && !customDateInput.value) {
      var soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
      soon.setSeconds(0, 0);
      customDateInput.value = soon.toISOString().slice(0, 16);
    }
  });

  urlInput.addEventListener("input", function () {
    urlRow.classList.remove("is-error");
    urlMsg.textContent = "";
    urlMsg.classList.remove("is-error");
  });

  var checkSlug = debounce(function (value) {
    if (!value) {
      slugStatus.className = "slug-status";
      slugMsg.textContent = "";
      slugMsg.classList.remove("is-error", "is-success");
      slugAvailable = null;
      return;
    }
    if (!isValidSlugFormat(value)) {
      slugStatus.className = "slug-status";
      slugMsg.textContent = "Gunakan 3-30 huruf, angka, - atau _, dan hindari kata yang sudah dipakai sistem.";
      slugMsg.classList.add("is-error");
      slugMsg.classList.remove("is-success");
      slugAvailable = false;
      return;
    }
    slugStatus.className = "slug-status checking";
    apiFetch(API_BASE + "?action=check&slug=" + encodeURIComponent(value))
      .then(function (data) {
        if (slugInput.value !== value) return;
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
    checkSlug(slugInput.value.trim());
  });

  function buildQrInto(container, text) {
    container.innerHTML = "";
    if (window.QRCode) {
      new window.QRCode(container, { text: text, width: 152, height: 152, colorDark: "#0F1B3D", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M });
    } else {
      var fallback = document.createElement("p");
      fallback.textContent = "QR code tidak tersedia saat offline.";
      container.appendChild(fallback);
    }
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

  function renderResultCard(data) {
    resultSection.hidden = false;
    var statusClass = data.noExpiration || new Date(data.expiresAt).getTime() > Date.now() ? "status-active" : "status-expired";
    var statusLabel = statusClass === "status-active" ? "Aktif" : "Kadaluarsa";
    resultCard.innerHTML =
      '<div class="result-top">' +
        '<div>' +
          '<div class="result-short-url">' + data.shortUrl + '</div>' +
          '<div class="result-original">' + data.originalUrl + '</div>' +
        '</div>' +
        '<span class="status-badge ' + statusClass + '">' + statusLabel + '</span>' +
      '</div>' +
      '<div class="result-actions">' +
        '<button type="button" class="btn-clay btn-primary btn-sm" data-action="copy">Salin link</button>' +
        '<button type="button" class="btn-clay btn-outline btn-sm" data-action="share">Bagikan</button>' +
      '</div>' +
      '<div class="result-grid">' +
        '<div>' +
          '<div class="meta-row"><span>Slug custom</span><span>' + (data.custom ? "Ya" : "Tidak") + '</span></div>' +
          '<div class="meta-row"><span>Masa berlaku</span><span>' + (data.noExpiration ? "Tidak pernah" : formatDateTime(data.expiresAt)) + '</span></div>' +
          '<div class="meta-row"><span>Klik sejauh ini</span><span>0</span></div>' +
          '<div class="meta-row"><span>Dibuat</span><span>' + formatDateTime(data.createdAt) + '</span></div>' +
        '</div>' +
        '<div class="qr-box"><div class="qr-canvas"></div><span class="field-msg">Scan untuk membuka</span></div>' +
      '</div>';
    buildQrInto(qs(".qr-canvas", resultCard), data.shortUrl);
    qs('[data-action="copy"]', resultCard).addEventListener("click", function () {
      copyText(data.shortUrl).then(function () { showToast("Link disalin ke clipboard.", "success"); });
    });
    qs('[data-action="share"]', resultCard).addEventListener("click", function () {
      if (navigator.share) {
        navigator.share({ title: "dshlink", url: data.shortUrl }).catch(function () {});
      } else {
        copyText(data.shortUrl).then(function () { showToast("Fitur share tidak didukung di sini, link sudah disalin.", "success"); });
      }
    });
    resultSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var urlValue = urlInput.value.trim();
    var slugValue = slugInput.value.trim();
    var expirationValue = expirationSelect.value;
    var customDateValue = customDateInput.value;

    if (!isValidUrl(urlValue)) {
      urlRow.classList.add("is-error");
      urlMsg.textContent = "Masukkan URL lengkap yang diawali http:// atau https://";
      urlMsg.classList.add("is-error");
      urlInput.focus();
      return;
    }
    if (slugValue && !isValidSlugFormat(slugValue)) {
      slugMsg.textContent = "Gunakan 3-30 huruf, angka, - atau _, dan hindari kata yang sudah dipakai sistem.";
      slugMsg.classList.add("is-error");
      advancedOptions.hidden = false;
      optionsToggle.setAttribute("aria-expanded", "true");
      slugInput.focus();
      return;
    }
    if (slugValue && slugAvailable === false) {
      slugMsg.textContent = "Slug ini sudah dipakai. Coba yang lain.";
      slugMsg.classList.add("is-error");
      advancedOptions.hidden = false;
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
        advancedOptions.hidden = true;
        optionsToggle.setAttribute("aria-expanded", "false");
        customDateGroup.hidden = true;
        slugStatus.className = "slug-status";
        slugMsg.textContent = "";
        slugAvailable = null;
      })
      .catch(function (err) {
        if (err.status === 409) {
          slugMsg.textContent = "Slug itu baru saja diambil orang lain. Coba yang lain.";
          slugMsg.classList.add("is-error");
          advancedOptions.hidden = false;
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
        return '<div class="stats-bar-row"><span class="stats-bar-label">' + k + '</span><div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div><span class="stats-bar-count">' + map[k] + '</span></div>';
      }).join("") + '</div>';
    }
    panel.innerHTML =
      '<div class="stats-grid">' +
        '<div class="stats-box"><div class="stats-box-label">Total klik</div><div class="stats-box-value">' + stats.totalClicks + '</div></div>' +
        '<div class="stats-box"><div class="stats-box-label">Status</div><div class="stats-box-value">' + (stats.status === "active" ? "Aktif" : "Kadaluarsa") + '</div></div>' +
      '</div>' +
      '<div><p class="field-msg">Berdasarkan perangkat</p>' + barsHtml(byDevice) + '</div>' +
      '<div><p class="field-msg">Berdasarkan browser</p>' + barsHtml(byBrowser) + '</div>' +
      '<div><p class="field-msg">Berdasarkan lokasi perkiraan</p>' + barsHtml(byCountry) + '</div>';
  }

  function renderHistory() {
    var list = loadHistory();
    historyList.innerHTML = "";
    if (list.length === 0) {
      historyEmpty.classList.add("is-visible");
      return;
    }
    historyEmpty.classList.remove("is-visible");
    list.forEach(function (item) {
      var expired = isExpired(item);
      var el = document.createElement("div");
      el.className = "history-item";
      el.setAttribute("data-slug", item.slug);
      el.innerHTML =
        '<div class="history-item-top">' +
          '<div class="history-link-info">' +
            '<div class="history-short">' + item.shortUrl + '</div>' +
            '<div class="history-original">' + item.originalUrl + '</div>' +
          '</div>' +
          '<span class="status-badge ' + (expired ? "status-expired" : "status-active") + '">' + (expired ? "Kadaluarsa" : "Aktif") + '</span>' +
        '</div>' +
        '<div class="history-meta">' +
          '<span>' + (item.clicks || 0) + ' klik</span>' +
          '<span>' + formatExpiryLabel(item) + '</span>' +
          '<span>Dibuat ' + formatDateTime(item.createdAt) + '</span>' +
        '</div>' +
        '<div class="history-actions">' +
          '<button type="button" class="btn-clay btn-outline btn-sm" data-action="copy">Salin</button>' +
          '<button type="button" class="btn-clay btn-outline btn-sm" data-action="share">Bagikan</button>' +
          '<button type="button" class="btn-clay btn-outline btn-sm" data-action="stats">Statistik</button>' +
          '<button type="button" class="btn-clay btn-outline btn-sm" data-action="edit">Ubah masa berlaku</button>' +
          '<button type="button" class="btn-clay btn-danger btn-sm" data-action="delete">Hapus</button>' +
        '</div>' +
        '<div class="stats-panel" data-role="stats-panel"><p class="field-msg">Memuat statistik...</p></div>' +
        '<div class="expiration-editor" data-role="expiration-editor">' +
          '<div class="input-clay select-row">' +
            '<select data-role="edit-expiration">' +
              '<option value="1h">1 jam</option>' +
              '<option value="1d">1 hari</option>' +
              '<option value="7d">7 hari</option>' +
              '<option value="30d">30 hari</option>' +
              '<option value="custom">Tanggal custom</option>' +
              '<option value="never">Tidak pernah</option>' +
            '</select>' +
          '</div>' +
          '<input type="datetime-local" class="input-clay date-input" data-role="edit-custom-date" hidden style="max-width:220px">' +
          '<button type="button" class="btn-clay btn-primary btn-sm" data-action="save-expiration">Simpan</button>' +
        '</div>';
      historyList.appendChild(el);

      qs('[data-action="copy"]', el).addEventListener("click", function () {
        copyText(item.shortUrl).then(function () { showToast("Link disalin ke clipboard.", "success"); });
      });
      qs('[data-action="share"]', el).addEventListener("click", function () {
        if (navigator.share) {
          navigator.share({ title: "dshlink", url: item.shortUrl }).catch(function () {});
        } else {
          copyText(item.shortUrl).then(function () { showToast("Fitur share tidak didukung di sini, link sudah disalin.", "success"); });
        }
      });
      qs('[data-action="delete"]', el).addEventListener("click", function () {
        pendingDeleteSlug = item.slug;
        deleteModalBackdrop.hidden = false;
      });
      qs('[data-action="stats"]', el).addEventListener("click", function () {
        var panel = qs('[data-role="stats-panel"]', el);
        var willOpen = !panel.classList.contains("is-open");
        panel.classList.toggle("is-open");
        if (willOpen) {
          apiFetch(API_BASE + "?action=info&slug=" + encodeURIComponent(item.slug) + "&token=" + encodeURIComponent(item.ownerToken))
            .then(function (data) {
              updateHistoryEntry(item.slug, { clicks: data.totalClicks });
              qs(".history-meta span", el).textContent = data.totalClicks + " klik";
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
      var editSelect = qs('[data-role="edit-expiration"]', el);
      var editDate = qs('[data-role="edit-custom-date"]', el);
      editSelect.addEventListener("change", function () {
        editDate.hidden = editSelect.value !== "custom";
      });
      qs('[data-action="save-expiration"]', el).addEventListener("click", function () {
        var option = editSelect.value;
        var customIso = null;
        if (option === "custom") {
          if (!editDate.value) { showToast("Pilih tanggal dan waktu dulu.", "error"); return; }
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
    deleteModalBackdrop.hidden = true;
    pendingDeleteSlug = null;
  });

  deleteModalConfirm.addEventListener("click", function () {
    if (!pendingDeleteSlug) return;
    var list = loadHistory();
    var target = list.filter(function (item) { return item.slug === pendingDeleteSlug; })[0];
    if (!target) { deleteModalBackdrop.hidden = true; return; }
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
        deleteModalBackdrop.hidden = true;
        pendingDeleteSlug = null;
      });
  });

  deleteModalBackdrop.addEventListener("click", function (e) {
    if (e.target === deleteModalBackdrop) {
      deleteModalBackdrop.hidden = true;
      pendingDeleteSlug = null;
    }
  });

  qs("#slugPrefix").textContent = window.location.host + "/";

  renderHistory();
  initScrollReveal();
  initHero3d();
});