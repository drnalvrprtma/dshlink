var crypto = require("crypto");

var SUPABASE_URL = process.env.SUPABASE_URL;
var SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
var SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var RESERVED_SLUGS = ["api", "index", "style", "script", "app", "admin", "shortlink", "www", "static", "assets", "favicon"];
var EXPIRATION_OPTIONS = { "1h": 3600000, "1d": 86400000, "7d": 604800000, "30d": 2592000000 };

function supabaseRequest(path, options) {
  var opts = options || {};
  var headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
    "Content-Type": "application/json"
  };
  for (var key in opts.headers || {}) headers[key] = opts.headers[key];
  return fetch(SUPABASE_URL + "/rest/v1" + path, {
    method: opts.method || "GET",
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function (res) {
    return res.text().then(function (text) {
      var data = text ? JSON.parse(text) : null;
      return { ok: res.ok, status: res.status, data: data };
    });
  });
}

function generateSlug(length) {
  var out = "";
  var bytes = crypto.randomBytes(length);
  for (var i = 0; i < length; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  return out;
}

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

function isValidSlugFormat(slug) {
  return typeof slug === "string" && /^[a-zA-Z0-9-_]{3,30}$/.test(slug) && RESERVED_SLUGS.indexOf(slug.toLowerCase()) === -1;
}

function isValidOriginalUrl(value, host) {
  if (typeof value !== "string") return false;
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    var parsed = new URL(value);
    if (parsed.hostname === host) return false;
    if (!parsed.hostname || parsed.hostname.indexOf(".") === -1) return false;
    return true;
  } catch (err) {
    return false;
  }
}

function computeExpiry(option, customIso) {
  if (option === "never") return { expiresAt: null, noExpiration: true };
  if (option === "custom") {
    var customDate = new Date(customIso);
    if (isNaN(customDate.getTime()) || customDate.getTime() <= Date.now()) return null;
    return { expiresAt: customDate.toISOString(), noExpiration: false };
  }
  var offset = EXPIRATION_OPTIONS[option];
  if (!offset) return null;
  return { expiresAt: new Date(Date.now() + offset).toISOString(), noExpiration: false };
}

function parseUserAgent(ua) {
  ua = ua || "";
  var device = "Desktop";
  if (/ipad|tablet/i.test(ua)) device = "Tablet";
  else if (/mobi|iphone|android/i.test(ua)) device = "Mobile";
  var browser = "Other";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  return { device: device, browser: browser };
}

function sendJson(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").send(JSON.stringify(body));
}

function statusPage(kind, message, actionLabel) {
  var iconBg = kind === "expired" ? "#FBF0DE" : "#FCEAE9";
  var iconColor = kind === "expired" ? "#C98A1F" : "#E0453C";
  var title = kind === "expired" ? "This link has expired" : "Link not found";
  var iconPath = kind === "expired"
    ? '<circle cx="12" cy="12" r="8.5" stroke="' + iconColor + '" stroke-width="1.8"></circle><path d="M12 7.5v5l3.2 2" stroke="' + iconColor + '" stroke-width="1.8" stroke-linecap="round"></path>'
    : '<path d="M9 15l6-6M10 8l1-1a4 4 0 015.6 5.6l-2 2M14 16l-1 1a4 4 0 01-5.6-5.6l2-2" stroke="' + iconColor + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>';
  return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">" +
    "<title>" + title + " — shortlink</title>" +
    "<link href=\"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500&display=swap\" rel=\"stylesheet\">" +
    "<link rel=\"stylesheet\" href=\"/style.css\"></head><body>" +
    "<div class=\"status-page\"><div class=\"status-card\">" +
    "<div class=\"status-icon\" style=\"background:" + iconBg + "\"><svg width=\"28\" height=\"28\" viewBox=\"0 0 24 24\" fill=\"none\">" + iconPath + "</svg></div>" +
    "<h1>" + title + "</h1><p>" + message + "</p>" +
    "<a class=\"btn-clay btn-primary\" href=\"/\">" + actionLabel + "</a>" +
    "</div></div></body></html>";
}

async function handleRedirect(req, res, slug) {
  var lookup = await supabaseRequest("/links?select=*&slug=eq." + encodeURIComponent(slug) + "&limit=1");
  var row = lookup.data && lookup.data[0];
  if (!row) {
    res.status(404).setHeader("Content-Type", "text/html").send(statusPage("notfound", "The short link you followed doesn't exist, or it may have been deleted.", "Create a short link"));
    return;
  }
  var expired = !row.no_expiration && row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
  if (expired) {
    res.status(410).setHeader("Content-Type", "text/html").send(statusPage("expired", "This link was set to expire and is no longer active.", "Create a new short link"));
    return;
  }
  var ua = req.headers["user-agent"] || "";
  var info = parseUserAgent(ua);
  var country = req.headers["x-vercel-ip-country"] || "Unknown";
  var referrer = req.headers["referer"] || req.headers["referrer"] || null;
  await Promise.all([
    supabaseRequest("/link_clicks", { method: "POST", body: [{ slug: slug, device: info.device, browser: info.browser, country: country, referrer: referrer }] }),
    supabaseRequest("/links?slug=eq." + encodeURIComponent(slug), { method: "PATCH", body: { clicks: (row.clicks || 0) + 1 } })
  ]);
  res.writeHead(302, { Location: row.original_url });
  res.end();
}

module.exports = async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    sendJson(res, 500, { message: "Server storage isn't configured yet." });
    return;
  }

  var query = req.query || {};
  var action = query.action;
  var host = req.headers.host;

  try {
    if (req.method === "GET" && action === "redirect") {
      await handleRedirect(req, res, query.slug);
      return;
    }

    if (req.method === "GET" && action === "check") {
      var slugToCheck = (query.slug || "").toString();
      if (!isValidSlugFormat(slugToCheck)) {
        sendJson(res, 200, { available: false, reason: "invalid-format" });
        return;
      }
      var existing = await supabaseRequest("/links?select=slug&slug=eq." + encodeURIComponent(slugToCheck) + "&limit=1");
      sendJson(res, 200, { available: !(existing.data && existing.data.length) });
      return;
    }

    if (req.method === "GET" && action === "info") {
      var infoSlug = (query.slug || "").toString();
      var infoToken = (query.token || "").toString();
      var linkResult = await supabaseRequest("/links?select=*&slug=eq." + encodeURIComponent(infoSlug) + "&limit=1");
      var linkRow = linkResult.data && linkResult.data[0];
      if (!linkRow) { sendJson(res, 404, { message: "Link not found." }); return; }
      if (linkRow.owner_token !== infoToken) { sendJson(res, 403, { message: "You don't have access to this link's stats." }); return; }
      var clicksResult = await supabaseRequest("/link_clicks?select=device,browser,country&slug=eq." + encodeURIComponent(infoSlug));
      var clicks = clicksResult.data || [];
      var byDevice = {}, byBrowser = {}, byCountry = {};
      clicks.forEach(function (c) {
        byDevice[c.device] = (byDevice[c.device] || 0) + 1;
        byBrowser[c.browser] = (byBrowser[c.browser] || 0) + 1;
        var countryLabel = c.country && c.country !== "Unknown" ? c.country : "Unknown";
        byCountry[countryLabel] = (byCountry[countryLabel] || 0) + 1;
      });
      var expired = !linkRow.no_expiration && linkRow.expires_at && new Date(linkRow.expires_at).getTime() <= Date.now();
      sendJson(res, 200, {
        slug: linkRow.slug,
        totalClicks: linkRow.clicks || 0,
        status: expired ? "expired" : "active",
        byDevice: byDevice,
        byBrowser: byBrowser,
        byCountry: byCountry
      });
      return;
    }

    if (req.method === "POST" && !action) {
      var body = req.body || {};
      var originalUrl = body.originalUrl;
      var customSlug = body.customSlug;
      var expirationOption = body.expirationOption || "1d";
      var customExpiresAt = body.customExpiresAt;

      if (!isValidOriginalUrl(originalUrl, host)) {
        sendJson(res, 400, { message: "Enter a valid http or https URL." });
        return;
      }
      if (customSlug && !isValidSlugFormat(customSlug)) {
        sendJson(res, 400, { message: "That custom slug isn't allowed." });
        return;
      }
      var expiry = computeExpiry(expirationOption, customExpiresAt);
      if (!expiry) { sendJson(res, 400, { message: "Choose a valid expiration." }); return; }

      var finalSlug = customSlug;
      if (!finalSlug) {
        var attempts = 0;
        while (attempts < 5) {
          var candidate = generateSlug(7);
          var check = await supabaseRequest("/links?select=slug&slug=eq." + candidate + "&limit=1");
          if (!(check.data && check.data.length)) { finalSlug = candidate; break; }
          attempts++;
        }
        if (!finalSlug) { sendJson(res, 500, { message: "Couldn't generate a unique slug, try again." }); return; }
      }

      var ownerToken = generateToken();
      var insertResult = await supabaseRequest("/links", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: [{
          slug: finalSlug,
          original_url: originalUrl,
          owner_token: ownerToken,
          expires_at: expiry.expiresAt,
          no_expiration: expiry.noExpiration,
          clicks: 0
        }]
      });

      if (!insertResult.ok) {
        if (insertResult.status === 409 || (insertResult.data && insertResult.data.code === "23505")) {
          sendJson(res, 409, { message: "That slug was just taken." });
          return;
        }
        sendJson(res, 500, { message: "Couldn't create the link right now." });
        return;
      }

      var created = insertResult.data[0];
      sendJson(res, 201, {
        slug: created.slug,
        shortUrl: "https://" + host + "/" + created.slug,
        originalUrl: created.original_url,
        ownerToken: ownerToken,
        createdAt: created.created_at,
        expiresAt: created.expires_at,
        noExpiration: created.no_expiration,
        custom: !!customSlug
      });
      return;
    }

    if (req.method === "PATCH" && action === "expiration") {
      var editSlug = (query.slug || "").toString();
      var editToken = (query.token || "").toString();
      var editBody = req.body || {};
      var editResult = await supabaseRequest("/links?select=owner_token&slug=eq." + encodeURIComponent(editSlug) + "&limit=1");
      var editRow = editResult.data && editResult.data[0];
      if (!editRow) { sendJson(res, 404, { message: "Link not found." }); return; }
      if (editRow.owner_token !== editToken) { sendJson(res, 403, { message: "You can't edit this link." }); return; }
      var newExpiry = computeExpiry(editBody.expirationOption, editBody.customExpiresAt);
      if (!newExpiry) { sendJson(res, 400, { message: "Choose a valid expiration." }); return; }
      var patchResult = await supabaseRequest("/links?slug=eq." + encodeURIComponent(editSlug), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: { expires_at: newExpiry.expiresAt, no_expiration: newExpiry.noExpiration }
      });
      var patched = patchResult.data && patchResult.data[0];
      sendJson(res, 200, { slug: editSlug, expiresAt: patched.expires_at, noExpiration: patched.no_expiration });
      return;
    }

    if (req.method === "DELETE" && action === "delete") {
      var deleteSlug = (query.slug || "").toString();
      var deleteToken = (query.token || "").toString();
      var deleteLookup = await supabaseRequest("/links?select=owner_token&slug=eq." + encodeURIComponent(deleteSlug) + "&limit=1");
      var deleteRow = deleteLookup.data && deleteLookup.data[0];
      if (!deleteRow) { sendJson(res, 404, { message: "Link not found." }); return; }
      if (deleteRow.owner_token !== deleteToken) { sendJson(res, 403, { message: "You can't delete this link." }); return; }
      await supabaseRequest("/links?slug=eq." + encodeURIComponent(deleteSlug), { method: "DELETE" });
      sendJson(res, 200, { deleted: true });
      return;
    }

    sendJson(res, 404, { message: "Unknown action." });
  } catch (err) {
    sendJson(res, 500, { message: "Unexpected server error." });
  }
};