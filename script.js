var API_BASE = "/api/shorten";
var HISTORY_KEY = "shortlink_history_v1";
var RESERVED_SLUGS = ["api", "index", "style", "script", "app", "admin", "shortlink", "www", "static", "assets", "favicon"];

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
    showToast("Couldn't save to this browser's storage.", "error");
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
  if (!iso) return "Never";
  var d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatExpiryLabel(item) {
  if (item.noExpiration) return "Never expires";
  return "Expires " + formatDateTime(item.expiresAt);
}

function apiFetch(url, options) {
  return fetch(url, options).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (body) {
      if (!res.ok) {
        var err = new Error(body.message || "Request failed");
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    });
  });
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
      slugMsg.textContent = "Use 3-30 letters, numbers, - or _, and avoid reserved words.";
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
          slugMsg.textContent = "This slug is available.";
          slugMsg.classList.add("is-success");
          slugMsg.classList.remove("is-error");
          slugAvailable = true;
        } else {
          slugStatus.className = "slug-status taken";
          slugMsg.textContent = "That slug is already taken.";
          slugMsg.classList.add("is-error");
          slugMsg.classList.remove("is-success");
          slugAvailable = false;
        }
      })
      .catch(function () {
        slugStatus.className = "slug-status";
        slugMsg.textContent = "Couldn't check availability right now.";
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
      fallback.textContent = "QR code unavailable offline.";
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
    var statusLabel = statusClass === "status-active" ? "Active" : "Expired";
    resultCard.innerHTML =
      '<div class="result-top">' +
        '<div>' +
          '<div class="result-short-url">' + data.shortUrl + '</div>' +
          '<div class="result-original">' + data.originalUrl + '</div>' +
        '</div>' +
        '<span class="status-badge ' + statusClass + '">' + statusLabel + '</span>' +
      '</div>' +
      '<div class="result-actions">' +
        '<button type="button" class="btn-clay btn-primary btn-sm" data-action="copy">Copy link</button>' +
        '<button type="button" class="btn-clay btn-outline btn-sm" data-action="share">Share</button>' +
      '</div>' +
      '<div class="result-grid">' +
        '<div>' +
          '<div class="meta-row"><span>Custom slug</span><span>' + (data.custom ? "Yes" : "No") + '</span></div>' +
          '<div class="meta-row"><span>Expiration</span><span>' + (data.noExpiration ? "Never" : formatDateTime(data.expiresAt)) + '</span></div>' +
          '<div class="meta-row"><span>Clicks so far</span><span>0</span></div>' +
          '<div class="meta-row"><span>Created</span><span>' + formatDateTime(data.createdAt) + '</span></div>' +
        '</div>' +
        '<div class="qr-box"><div class="qr-canvas"></div><span class="field-msg">Scan to open</span></div>' +
      '</div>';
    buildQrInto(qs(".qr-canvas", resultCard), data.shortUrl);
    qs('[data-action="copy"]', resultCard).addEventListener("click", function () {
      copyText(data.shortUrl).then(function () { showToast("Link copied to clipboard.", "success"); });
    });
    qs('[data-action="share"]', resultCard).addEventListener("click", function () {
      if (navigator.share) {
        navigator.share({ title: "shortlink", url: data.shortUrl }).catch(function () {});
      } else {
        copyText(data.shortUrl).then(function () { showToast("Sharing isn't supported here, so the link was copied.", "success"); });
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
      urlMsg.textContent = "Enter a full URL starting with http:// or https://";
      urlMsg.classList.add("is-error");
      urlInput.focus();
      return;
    }
    if (slugValue && !isValidSlugFormat(slugValue)) {
      slugMsg.textContent = "Use 3-30 letters, numbers, - or _, and avoid reserved words.";
      slugMsg.classList.add("is-error");
      advancedOptions.hidden = false;
      optionsToggle.setAttribute("aria-expanded", "true");
      slugInput.focus();
      return;
    }
    if (slugValue && slugAvailable === false) {
      slugMsg.textContent = "That slug is already taken. Try another.";
      slugMsg.classList.add("is-error");
      advancedOptions.hidden = false;
      slugInput.focus();
      return;
    }
    if (expirationValue === "custom" && !customDateValue) {
      showToast("Pick a custom expiration date and time.", "error");
      return;
    }
    if (expirationValue === "custom" && new Date(customDateValue).getTime() <= Date.now()) {
      showToast("Custom expiration must be in the future.", "error");
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
        showToast("Short link created.", "success");
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
          slugMsg.textContent = "That slug was just taken. Try another.";
          slugMsg.classList.add("is-error");
          advancedOptions.hidden = false;
        } else if (err.status === 400) {
          urlRow.classList.add("is-error");
          urlMsg.textContent = err.body && err.body.message ? err.body.message : "That URL isn't valid.";
          urlMsg.classList.add("is-error");
        } else {
          showToast("Something went wrong on our end. Try again.", "error");
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
      if (keys.length === 0) return '<p class="field-msg">No clicks recorded yet.</p>';
      var max = Math.max.apply(null, keys.map(function (k) { return map[k]; }));
      return '<div class="stats-bars">' + keys.map(function (k) {
        var pct = Math.max(6, Math.round((map[k] / max) * 100));
        return '<div class="stats-bar-row"><span class="stats-bar-label">' + k + '</span><div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div><span class="stats-bar-count">' + map[k] + '</span></div>';
      }).join("") + '</div>';
    }
    panel.innerHTML =
      '<div class="stats-grid">' +
        '<div class="stats-box"><div class="stats-box-label">Total clicks</div><div class="stats-box-value">' + stats.totalClicks + '</div></div>' +
        '<div class="stats-box"><div class="stats-box-label">Status</div><div class="stats-box-value">' + (stats.status === "active" ? "Active" : "Expired") + '</div></div>' +
      '</div>' +
      '<div><p class="field-msg">By device</p>' + barsHtml(byDevice) + '</div>' +
      '<div><p class="field-msg">By browser</p>' + barsHtml(byBrowser) + '</div>' +
      '<div><p class="field-msg">By approximate location</p>' + barsHtml(byCountry) + '</div>';
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
          '<span class="status-badge ' + (expired ? "status-expired" : "status-active") + '">' + (expired ? "Expired" : "Active") + '</span>' +
        '</div>' +
        '<div class="history-meta">' +
          '<span>' + (item.clicks || 0) + ' clicks</span>' +
          '<span>' + formatExpiryLabel(item) + '</span>' +
          '<span>Created ' + formatDateTime(item.createdAt) + '</span>' +
        '</div>' +
        '<div class="history-actions">' +
          '<button type="button" class="btn-clay btn-outline btn-sm" data-action="copy">Copy</button>' +
          '<button type="button" class="btn-clay btn-outline btn-sm" data-action="share">Share</button>' +
          '<button type="button" class="btn-clay btn-outline btn-sm" data-action="stats">Stats</button>' +
          '<button type="button" class="btn-clay btn-outline btn-sm" data-action="edit">Edit expiration</button>' +
          '<button type="button" class="btn-clay btn-danger btn-sm" data-action="delete">Delete</button>' +
        '</div>' +
        '<div class="stats-panel" data-role="stats-panel"><p class="field-msg">Loading stats...</p></div>' +
        '<div class="expiration-editor" data-role="expiration-editor">' +
          '<div class="input-clay select-row">' +
            '<select data-role="edit-expiration">' +
              '<option value="1h">1 hour</option>' +
              '<option value="1d">1 day</option>' +
              '<option value="7d">7 days</option>' +
              '<option value="30d">30 days</option>' +
              '<option value="custom">Custom date</option>' +
              '<option value="never">Never</option>' +
            '</select>' +
          '</div>' +
          '<input type="datetime-local" class="input-clay date-input" data-role="edit-custom-date" hidden style="max-width:220px">' +
          '<button type="button" class="btn-clay btn-primary btn-sm" data-action="save-expiration">Save</button>' +
        '</div>';
      historyList.appendChild(el);

      qs('[data-action="copy"]', el).addEventListener("click", function () {
        copyText(item.shortUrl).then(function () { showToast("Link copied to clipboard.", "success"); });
      });
      qs('[data-action="share"]', el).addEventListener("click", function () {
        if (navigator.share) {
          navigator.share({ title: "shortlink", url: item.shortUrl }).catch(function () {});
        } else {
          copyText(item.shortUrl).then(function () { showToast("Sharing isn't supported here, so the link was copied.", "success"); });
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
              qs(".history-meta span", el).textContent = data.totalClicks + " clicks";
              renderStatsPanel(panel, data);
            })
            .catch(function () {
              panel.innerHTML = '<p class="field-msg is-error">Couldn\'t load stats right now.</p>';
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
          if (!editDate.value) { showToast("Pick a date and time first.", "error"); return; }
          customIso = new Date(editDate.value).toISOString();
        }
        apiFetch(API_BASE + "?action=expiration&slug=" + encodeURIComponent(item.slug) + "&token=" + encodeURIComponent(item.ownerToken), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expirationOption: option, customExpiresAt: customIso })
        })
          .then(function (data) {
            updateHistoryEntry(item.slug, { expiresAt: data.expiresAt, noExpiration: data.noExpiration });
            showToast("Expiration updated.", "success");
            renderHistory();
          })
          .catch(function () {
            showToast("Couldn't update expiration.", "error");
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
        showToast("Link deleted.", "success");
      })
      .catch(function () {
        showToast("Couldn't delete this link. Try again.", "error");
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
});