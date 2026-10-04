/**
 *  ─── _messages.js ───
 *
 *  All Telegram message construction for the site:
 *    - UA/device detection          (ported from BBP lib/parse-visitor-os.ts)
 *    - VPN/datacenter heuristic     (ported from BBP datacenter-heuristic.ts)
 *    - HTML escaping + <code>/<a> field helpers (ported from BBP lib/telegram.ts)
 *    - the visit message layout
 */

var WINDOWS_NT_MAP = {
  "10.0": "10/11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.2": "XP",
  "5.1": "XP",
  "5.0": "2000",
};

var DATACENTER_ASNS = {
  AS16509: 1, AS14618: 1, AS15169: 1, AS396982: 1, AS8075: 1, AS14061: 1,
  AS16276: 1, AS24940: 1, AS20473: 1, AS63949: 1, AS13335: 1, AS32934: 1,
  AS45102: 1, AS31898: 1, AS12876: 1, AS9009: 1, AS51167: 1,
};

var DATACENTER_ORG_KEYWORDS = [
  "amazon", "aws", "google cloud", "microsoft azure", "digitalocean",
  "hetzner", "ovh", "linode", "vultr", "cloudflare", "hosting",
  "datacenter", "data center", "vps", "server", "colo",
];

var NAMED_VPN_BRAND_KEYWORDS = [
  "mullvad", "nordvpn", "nord security", "expressvpn", "surfshark",
  "protonvpn", "proton ag", "private internet", "pia ", "tunnelbear",
  "cyberghost", "ipvanish", "purevpn", "windscribe", "hide.me",
  "hidemyass", "hotspot shield", "urban vpn", "opera vpn", "tailscale",
  "zerotier", "tor exit",
];

var GENERIC_VPN_PROXY_KEYWORDS = ["vpn", "proxy", "warp", "anonymizer"];

function orgMatchesAny(org, keywords) {
  if (!org || !String(org).trim()) return false;
  var lower = String(org).toLowerCase();
  for (var i = 0; i < keywords.length; i++) {
    if (lower.indexOf(keywords[i]) !== -1) return true;
  }
  return false;
}

function normalizeAsn(asn) {
  if (!asn || !String(asn).trim()) return null;
  var t = String(asn).trim().toUpperCase();
  if (t.indexOf("AS") === 0) return t;
  if (/^\d+$/.test(t)) return "AS" + t;
  return t;
}

/**
 * Named VPN brands win first; datacenter ASN/org before generic
 * vpn/proxy/warp tokens (so Cloudflare WARP → Datacenter, not VPN).
 */
export function getNetworkHintLabel(asn, orgOrIsp) {
  var org = orgOrIsp && String(orgOrIsp).trim() ? String(orgOrIsp).trim() : null;
  if (orgMatchesAny(org, NAMED_VPN_BRAND_KEYWORDS)) return "Likely VPN/proxy";
  var normalized = normalizeAsn(asn);
  if (normalized && DATACENTER_ASNS[normalized]) return "Datacenter / hosting";
  if (orgMatchesAny(org, DATACENTER_ORG_KEYWORDS)) return "Datacenter / hosting";
  if (orgMatchesAny(org, GENERIC_VPN_PROXY_KEYWORDS)) return "Likely VPN/proxy";
  return null;
}

export function escapeTelegramHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isHttpUrl(v) {
  return /^https?:\/\//i.test(String(v).trim());
}

export function asCode(value) {
  var t = value == null || value === "" ? "Unknown" : String(value).trim() || "Unknown";
  return "<code>" + escapeTelegramHtml(t) + "</code>";
}

export function asLink(value, label) {
  var v = String(value).trim();
  var text = label ? String(label).trim() : v;
  return '<a href="' + escapeTelegramHtml(v) + '">' + escapeTelegramHtml(text) + "</a>";
}

export function asUrlField(value, fallback) {
  var t = value == null || value === "" ? "" : String(value).trim();
  // `fallback` has no declared default, so an omitted fallback used to resolve to
  // the literal string "undefined" and render as <code>undefined</code>.
  var resolved = t || (fallback === undefined ? "Unknown" : fallback);
  if (resolved === "Direct") return asCode(resolved);
  if (isHttpUrl(resolved)) return asLink(resolved);
  return asCode(resolved);
}

export function gmtOffset(tz) {
  try {
    var parts = new Date().toLocaleString("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).split(" ");
    return parts[parts.length - 1];
  } catch (e) {
    return "";
  }
}

export function formatTimes(tz) {
  var now = new Date();
  var opts = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  var utcStr = now.toLocaleString("en-US", Object.assign({ timeZone: "UTC" }, opts));
  var localStr;
  try {
    localStr = now.toLocaleString("en-US", Object.assign({ timeZone: tz }, opts));
  } catch (e) {
    localStr = utcStr;
  }
  return { local: localStr, utc: utcStr };
}

function normalizeAndroidVersion(ver) {
  if (!ver) return null;
  var clean = String(ver).trim();
  var parts = clean.split(".");
  if (parts.length === 1) return parts[0] + ".0.0";
  if (parts.length === 2) return parts[0] + "." + parts[1] + ".0";
  return clean;
}

function extractAndroidModel(ua) {
  var match = ua.match(
    /Android\s+[\d.]+;\s*(?:[a-zA-Z]{2}(?:-[a-zA-Z]{2})?;\s*)?([^;()]+?)(?:\s+Build|\s+AppleWebKit|\))/i,
  );
  if (!match) return null;
  var model = match[1].trim().replace(/^[a-zA-Z]{2}-[a-zA-Z]{2};\s*/i, "").trim();
  if (/^wv$/i.test(model) || /^Mobile$/i.test(model) || /^Linux$/i.test(model)) return null;
  return model || null;
}

var ANDROID_DEVICE_RULES = [
  [/^SM-S928/i, "Samsung Galaxy S24 Ultra"],
  [/^SM-S926/i, "Samsung Galaxy S24+"],
  [/^SM-S921/i, "Samsung Galaxy S24"],
  [/^SM-S918/i, "Samsung Galaxy S23 Ultra"],
  [/^SM-S916/i, "Samsung Galaxy S23+"],
  [/^SM-S911/i, "Samsung Galaxy S23"],
  [/^SM-S908/i, "Samsung Galaxy S22 Ultra"],
  [/^SM-S906/i, "Samsung Galaxy S22+"],
  [/^SM-S901/i, "Samsung Galaxy S22"],
  [/^SM-G998/i, "Samsung Galaxy S21 Ultra"],
  [/^SM-G996/i, "Samsung Galaxy S21+"],
  [/^SM-G991/i, "Samsung Galaxy S21"],
  [/^SM-F946/i, "Samsung Galaxy Z Fold5"],
  [/^SM-F936/i, "Samsung Galaxy Z Fold4"],
  [/^SM-F731/i, "Samsung Galaxy Z Flip5"],
  [/^SM-F721/i, "Samsung Galaxy Z Flip4"],
  [/^SM-A546/i, "Samsung Galaxy A54 5G"],
  [/^SM-A536/i, "Samsung Galaxy A53 5G"],
  [/^SM-A346/i, "Samsung Galaxy A34 5G"],
  [/^SM-A155|^SM-A156/i, "Samsung Galaxy A15"],
  [/^SM-A145|^SM-A146/i, "Samsung Galaxy A14"],
  [/^SM-X/i, function (m) { return "Samsung Galaxy Tab (" + m + ")"; }],
  [/^SM-|^GT-|^SCH-|^SGH-/i, function (m) { return "Samsung Galaxy (" + m + ")"; }],
  [/Pixel/i, function (m) { return /^Google/i.test(m) ? m : "Google " + m; }],
  [/Redmi|POCO|Xiaomi|Mi\s/i, function (m) { return "Xiaomi (" + m + ")"; }],
  [/OnePlus|CPH|PGEM|PFFM|OPPO/i, function (m) { return "OnePlus/OPPO (" + m + ")"; }],
  [/Vivo|iQOO|V2[0-9]{3}/i, function (m) { return "Vivo (" + m + ")"; }],
  [/^RMX|Realme/i, function (m) { return "Realme (" + m + ")"; }],
  [/moto|Motorola/i, function (m) { return "Motorola (" + m + ")"; }],
  [/^XQ-|Xperia/i, function (m) { return "Sony Xperia (" + m + ")"; }],
  [/^A063|^AIN065|Nothing/i, function (m) { return "Nothing Phone (" + m + ")"; }],
  [/HUAWEI|HONOR|ELS-|VOG-|TAS-|NOH-|ALN-/i, function (m) { return "Huawei/Honor (" + m + ")"; }],
];

function resolveAndroidDeviceName(rawModel) {
  var model = String(rawModel).trim();
  for (var i = 0; i < ANDROID_DEVICE_RULES.length; i++) {
    if (ANDROID_DEVICE_RULES[i][0].test(model)) {
      var out = ANDROID_DEVICE_RULES[i][1];
      return typeof out === "function" ? out(model) : out;
    }
  }
  return "Android (" + model + ")";
}

/**
 * Platform (e.g. "macOS 14.5", "Windows 10/11", "iOS 17.5"),
 * Browser  (e.g. "Chrome 131.0.0.0 (Desktop)"),
 * Device   (e.g. "Mac", "iPhone", "Samsung Galaxy S24").
 */
export function parseVisitorInfo(userAgent) {
  var ua = String(userAgent || "").trim();

  var isBot = /googlebot|bingbot|applebot|yandexbot|duckduckbot|baiduspider|slurp|facebookexternalhit|whatsapp|telegrambot|twitterbot|discordbot|ahrefsbot|semrushbot|petalbot|bytespider|meta-externalfetcher|snapchat/i.test(ua);

  var browserType = "Desktop";
  if (isBot) browserType = "Bot";
  else if (/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet|PlayBook|Silk|Kindle/i.test(ua)) browserType = "Tablet";
  else if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) browserType = "Mobile";

  var browserName = "Unknown";
  var browserVersion = null;
  var m;

  if (isBot) {
    m = ua.match(/(Googlebot|bingbot|Applebot|YandexBot|DuckDuckBot|Baiduspider|AhrefsBot|SemrushBot)[\/\s]([\d.]+)/i);
    browserName = m ? m[1] : "Crawler/Bot";
    browserVersion = m ? m[2] : null;
  } else if (/SamsungBrowser\/([\d.]+)/i.test(ua)) {
    browserName = "Samsung Internet";
    browserVersion = ua.match(/SamsungBrowser\/([\d.]+)/i)[1];
  } else if (/Edg(?:e|A|iOS)?\/([\d.]+)/i.test(ua)) {
    browserName = "Edge";
    browserVersion = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/i)[1];
  } else if (/OPR\/([\d.]+)|Opera Mini\/([\d.]+)|Opera\/([\d.]+)/i.test(ua)) {
    browserName = "Opera";
    m = ua.match(/OPR\/([\d.]+)|Opera Mini\/([\d.]+)|Opera\/([\d.]+)/i);
    browserVersion = m[1] || m[2] || m[3] || null;
  } else if (/Vivaldi\/([\d.]+)/i.test(ua)) {
    browserName = "Vivaldi";
    browserVersion = ua.match(/Vivaldi\/([\d.]+)/i)[1];
  } else if (/Brave\/([\d.]+)/i.test(ua)) {
    browserName = "Brave";
    browserVersion = ua.match(/Brave\/([\d.]+)/i)[1];
  } else if (/DuckDuckGo\/([\d.]+)|DDG\/([\d.]+)/i.test(ua)) {
    browserName = "DuckDuckGo";
    m = ua.match(/DuckDuckGo\/([\d.]+)|DDG\/([\d.]+)/i);
    browserVersion = m[1] || m[2] || null;
  } else if (/UCBrowser\/([\d.]+)/i.test(ua)) {
    browserName = "UC Browser";
    browserVersion = ua.match(/UCBrowser\/([\d.]+)/i)[1];
  } else if (/YaBrowser\/([\d.]+)/i.test(ua)) {
    browserName = "Yandex Browser";
    browserVersion = ua.match(/YaBrowser\/([\d.]+)/i)[1];
  } else if (/Instagram[\s\/]([\d.]+)/i.test(ua)) {
    browserName = "Instagram";
    browserVersion = ua.match(/Instagram[\s\/]([\d.]+)/i)[1];
  } else if (/FBAN|FBAV\/([\d.]+)/i.test(ua)) {
    browserName = "Facebook App";
    browserVersion = ua.match(/FBAV\/([\d.]+)/i)[1] || null;
  } else if (/TikTok|musical_ly/i.test(ua)) {
    browserName = "TikTok";
  } else if (/MicroMessenger\/([\d.]+)/i.test(ua)) {
    browserName = "WeChat";
    browserVersion = ua.match(/MicroMessenger\/([\d.]+)/i)[1];
  } else if (/Twitter|TwitterAndroid|Twitter for iPhone/i.test(ua)) {
    browserName = "Twitter/X";
  } else if (/LinkedInApp/i.test(ua)) {
    browserName = "LinkedIn";
  } else if (/Firefox\/([\d.]+)|FxiOS\/([\d.]+)|Focus\/([\d.]+)/i.test(ua)) {
    browserName = "Firefox";
    m = ua.match(/Firefox\/([\d.]+)|FxiOS\/([\d.]+)|Focus\/([\d.]+)/i);
    browserVersion = m[1] || m[2] || m[3] || null;
  } else if (/CriOS\/([\d.]+)/i.test(ua)) {
    browserName = "Chrome";
    browserVersion = ua.match(/CriOS\/([\d.]+)/i)[1];
  } else if (/Chrome\/([\d.]+)/i.test(ua)) {
    browserName = "Chrome";
    browserVersion = ua.match(/Chrome\/([\d.]+)/i)[1];
  } else if (/Version\/([\d.]+).*Safari/i.test(ua)) {
    browserName = "Safari";
    browserVersion = ua.match(/Version\/([\d.]+).*Safari/i)[1];
  } else if (/Safari\/([\d.]+)/i.test(ua)) {
    browserName = "Safari";
    browserVersion = ua.match(/Safari\/([\d.]+)/i)[1];
  }

  var browserLabel = browserVersion
    ? browserName + " " + browserVersion + " (" + browserType + ")"
    : browserName + " (" + browserType + ")";

  var platform = "Unknown";
  var platformVersion = null;
  var deviceLabel = "Unknown";
  var nt;

  if (isBot) {
    platform = "Bot / Crawler";
    deviceLabel = "Bot";
  } else if (/iPhone|iPad|iPod/i.test(ua) || /CPU (?:iPhone )?OS (\d+[_\d]*)/i.test(ua)) {
    var isPad = /iPad/i.test(ua);
    platform = isPad ? "iPadOS" : "iOS";
    m = ua.match(/OS (\d+[_\d]*)/i);
    platformVersion = m ? m[1].replace(/_/g, ".") : null;
    deviceLabel = isPad ? "iPad" : /iPod/i.test(ua) ? "iPod Touch" : "iPhone";
  } else if (/Android/i.test(ua)) {
    platform = "Android";
    m = ua.match(/Android\s+([\d.]+)/i);
    platformVersion = normalizeAndroidVersion(m ? m[1] : null);
    var extracted = extractAndroidModel(ua);
    deviceLabel = extracted
      ? resolveAndroidDeviceName(extracted)
      : browserType === "Tablet" ? "Android Tablet" : "Android Phone";
  } else if (/Windows NT/i.test(ua) || /Windows/i.test(ua)) {
    platform = "Windows";
    deviceLabel = "Windows PC";
    nt = (ua.match(/Windows NT (\d+\.\d+)/i) || [])[1];
    if (nt === "10.0") platformVersion = "10/11";
    else if (nt) platformVersion = WINDOWS_NT_MAP[nt] || "NT " + nt;
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    platform = "macOS";
    deviceLabel = "Mac";
    m = ua.match(/Mac OS X (\d+[._\d]*)/i);
    platformVersion = m ? m[1].replace(/_/g, ".") : null;
  } else if (/HarmonyOS/i.test(ua) || /HMSCore/i.test(ua)) {
    platform = "HarmonyOS";
    m = ua.match(/HarmonyOS\s*([\d.]+)?/i);
    platformVersion = (m && m[1]) || null;
    deviceLabel = "Huawei Device";
  } else if (/CrOS/i.test(ua)) {
    platform = "Chrome OS";
    deviceLabel = "Chromebook";
    m = ua.match(/CrOS\s+(?:[^\s]+\s+)?([\d.]+)/i);
    platformVersion = (m && m[1]) || null;
  } else if (/Linux/i.test(ua)) {
    deviceLabel = "Linux PC";
    var distros = ["Ubuntu", "Debian", "Fedora", "Arch", "CentOS", "Mint", "Manjaro", "Red Hat", "openSUSE", "Alpine"];
    var distro = null;
    for (var i = 0; i < distros.length; i++) {
      if (new RegExp(distros[i], "i").test(ua)) { distro = distros[i]; break; }
    }
    platform = distro ? "Linux (" + distro + ")" : "Linux";
  }

  return {
    platform: platform,
    platformVersion: platformVersion,
    platformLabel: platformVersion ? platform + " " + platformVersion : platform,
    browserName: browserName,
    browserVersion: browserVersion,
    browserType: browserType,
    browserLabel: browserLabel,
    deviceLabel: deviceLabel,
  };
}

/**
 * The visit alert, byte-compatible with ebc/BBP/NBS/principal layout.
 * Sent with parse_mode HTML — every interpolated value must go through
 * asCode/asUrlField so raw < or & from a UA/referrer cannot break parsing.
 */
export function buildVisitMessage(data) {
  var site = escapeTelegramHtml(data.siteName || "AIB");
  var hint = getNetworkHintLabel(data.asn, data.org || data.isp);
  var lines = [
    "🌐 <b>(" + site + ")</b>",
    "━━━━━━━━━━━━━━━━━━",
    "📍 <b>Location:</b> " + asCode(data.location),
    "🌍 <b>IP:</b> " + asCode(data.ip),
    "⏰ <b>Timezone:</b> " + asCode(data.timezone),
    "🌐 <b>ISP:</b> " + asCode(data.isp),
  ];
  if (hint) lines.push("🛡️ <b>VPN/DATA CENTER:</b> " + asCode(hint));
  lines.push("");
  lines.push("🖥 <b>Platform:</b> " + asCode(data.platformLabel));
  lines.push("👨‍💻 <b>Browser:</b> " + asCode(data.browserLabel));
  lines.push("📱 <b>Device:</b> " + asCode(data.deviceLabel));
  lines.push("🖥️ <b>Screen:</b> " + asCode(data.screen));
  lines.push("🔗 <b>Referrer:</b> " + asUrlField(data.referrer, "Direct"));
  lines.push("🌐 <b>URL:</b> " + asUrlField(data.pageUrl));
  lines.push("");
  lines.push('<a href="https://t.me/th3_allfather">All Father</a>');
  return lines.join("\n");
}




