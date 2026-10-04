/**
 * Crawler user-agent registry — the ONE allowlist.
 *
 * `scripts/generate-crawler-delivery.mjs` compiles these lists into the
 * user-agent conditions in `vercel.json` (the crawler rewrite + the
 * `x-crawler-seo-page` header stamp), and `scripts/audit-crawler-seo.mjs`
 * re-derives the same regex to prove the deployed config still matches. There
 * is no second copy of this list anywhere, so the two cannot drift.
 *
 * This is the Astro equivalent of the kit's `lib/crawler-ua.ts` +
 * `lib/bot-detection.ts`. It exists because this project is a static Astro
 * site: there is no server middleware to branch in, so the delivery split is
 * expressed as a Vercel rewrite conditioned on the request `user-agent`
 * header. `has.type` in `vercel.json` accepts only `header` | `cookie` |
 * `host` | `query` — there is no dedicated `user-agent` type, so the header
 * form is used deliberately.
 */

/** Classic search engines. */
export const SEARCH_CRAWLER_UA = [
  "Googlebot",
  "Google-InspectionTool",
  "Storebot-Google",
  "bingbot",
  "BingPreview",
  "MicrosoftPreview",
  "BingVideoPreview",
  "msnbot",
  "DuckDuckBot",
  "Yahoo! Slurp",
  "Yandex",
  "Applebot",
  "Baiduspider",
  "PetalBot",
  "MJ12bot",
  "Qwantify",
  "MojeekBot",
  "Ecosia-Explorer",
  "ia_archiver",
  "SeznamBot",
  "Teoma",
  "Sogou",
  "Exabot",
];

/**
 * Social preview / link-unfurl agents — the 13-token list.
 * `meta-externalfetcher` is Meta's modern share crawler (the successor path to
 * `facebookexternalhit` for new Facebook scrapes); `snapchat` covers Snapchat
 * link previews.
 */
export const SOCIAL_PREVIEW_UA = [
  "facebookexternalhit",
  "facebot",
  "facebookbot",
  "twitterbot",
  "linkedinbot",
  "pinterest",
  "slackbot",
  "discordbot",
  "whatsapp",
  "skypeuripreview",
  "telegrambot",
  "meta-externalfetcher",
  "snapchat",
];

/** Explicit robots.txt groups — search engines get their own named rule. */
export const ROBOTS_SEARCH_AGENTS = [
  "*",
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Applebot",
  "Baiduspider",
  "PetalBot",
  "MJ12bot",
  "Yandex",
  "Yahoo",
];

/** Known SEO-tool / scraper UAs that must never be served the twin. */
export const DENIED_BOT_UA = [
  "ahrefs",
  "ahrefsbot",
  "semrush",
  "semrushbot",
  "mj12",
  "dotbot",
  "blexbot",
  "rogerbot",
  "screaming frog",
  "sitebulb",
  "serpstat",
  "linkdexbot",
  "majestic",
  "zgrab",
  "masscan",
  "nmap",
  "nikto",
  "sqlmap",
  "wpscan",
];

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive alternation of every agent that receives the crawler twin.
 * Built from the lists above plus the AI reference registry, so a token added
 * there automatically reaches the deployed rewrite.
 */
export function buildCrawlerUaPattern(aiReferenceAgents = []) {
  const tokens = [
    ...SEARCH_CRAWLER_UA,
    ...SOCIAL_PREVIEW_UA,
    ...aiReferenceAgents,
  ];
  const unique = [...new Set(tokens.map((t) => t.toLowerCase()))].sort();
  return unique.map(escapeForRegExp).join("|");
}

/** Runtime test, mirroring the pattern the rewrite uses. */
export function isCrawlerUa(userAgent, aiReferenceAgents = []) {
  if (!userAgent) return false;
  const lower = String(userAgent).toLowerCase();
  if (DENIED_BOT_UA.some((token) => lower.includes(token))) return false;
  return new RegExp(buildCrawlerUaPattern(aiReferenceAgents), "i").test(userAgent);
}