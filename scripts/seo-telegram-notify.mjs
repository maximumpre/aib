/**
 * SEO admin Telegram helper for Node postbuild scripts.
 * Mirrors lib/telegram-seo-admin.ts (plain text, TELEGRAM_SEO_BOT_TOKEN + TELEGRAM_SEO_ADMIN).
 */

const SEP = "━━━━━━━━━━━━━━━━━"

export function parseSeoTelegramChatIds() {
  return process.env.TELEGRAM_SEO_ADMIN
    ? process.env.TELEGRAM_SEO_ADMIN.split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : []
}

export function isSeoTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_SEO_BOT_TOKEN?.trim() && parseSeoTelegramChatIds().length > 0)
}

/**
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export async function sendSeoAdminMessage(message) {
  const token = process.env.TELEGRAM_SEO_BOT_TOKEN?.trim()
  const chatIds = parseSeoTelegramChatIds()

  if (!token || chatIds.length === 0) {
    return false
  }

  const results = await Promise.allSettled(
    chatIds.map((chatId) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      }),
    ),
  )

  return results.some((r) => r.status === "fulfilled")
}

/**
 * @param {{
 *   siteName: string
 *   siteUrl: string
 *   success: boolean
 *   dryRun?: boolean
 *   httpStatus?: number
 *   responseSnippet?: string
 *   urlList: string[]
 *   keyLocation: string
 *   errorMessage?: string
 * }} data
 */
export function formatIndexNowNotificationMessage(data) {
  const statusLine = data.dryRun
    ? "📊 Status: 🧪 Simulated — IndexNow not pinged (dry-run)"
    : data.success
      ? `📊 Status: ✅ Submitted — HTTP ${data.httpStatus ?? 200}`
      : data.errorMessage
        ? `📊 Status: ❌ Error — ${data.errorMessage}`
        : `📊 Status: ❌ Failed — HTTP ${data.httpStatus ?? "unknown"}${
            data.responseSnippet ? ` (${data.responseSnippet})` : ""
          }`

  const lines = [
    `📡 IndexNow — ${data.siteName}`,
    data.siteUrl,
    SEP,
    statusLine,
    "🔗 URLs submitted:",
    ...data.urlList.map((url) => `  • ${url}`),
    `🔑 Key location: ${data.keyLocation}`,
    `🕐 Time: ${new Date().toISOString()}`,
    SEP,
  ]

  return lines.join("\n")
}

/**
 * @param {Parameters<typeof formatIndexNowNotificationMessage>[0]} data
 * @returns {Promise<boolean>}
 */
export async function sendIndexNowNotification(data) {
  if (!isSeoTelegramConfigured()) return false
  return sendSeoAdminMessage(formatIndexNowNotificationMessage(data))
}
