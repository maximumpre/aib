/**
 * AI crawler registry — reference (allow + serve the twin) vs training (block).
 *
 * Astro equivalent of the kit's `lib/ai-referral.ts`.
 *
 *   REFERENCE  — decides whether a site appears in AI answers and citations.
 *                Disallowing these removes it from those surfaces entirely, so
 *                they are allowed and served the crawler twin.
 *   TRAINING   — model ingest. `Disallow: /` in robots.txt and never on the
 *                twin allowlist. Nothing in this list may ever be allowlisted;
 *                `scripts/audit-crawler-seo.mjs` enforces that mechanically.
 *
 * The two preference headers below are declarations only — neither is
 * vendor-supported yet, so the real block stays on `Disallow: /`.
 */

/** Cloudflare field-trial preference header. */
export const CONTENT_SIGNAL = "search=yes, ai-train=no, use=reference";

/** IETF standard-track preference header (draft-ietf-aipref-attach). */
export const CONTENT_USAGE = "bots=y, search=y, train-ai=n";

/** User-triggered fetches, AI search indexers, and citation crawlers. */
export const AI_REFERENCE_CRAWLER_AGENTS = [
  "ChatGPT-User",
  "OAI-SearchBot",
  "Claude-SearchBot",
  "Claude-User",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "DuckAssistBot",
  "YouBot",
  "meta-webindexer",
  "Amzn-SearchBot",
  "Amzn-User",
];

/** Model-training / corpus crawlers. Blocked site-wide. */
export const AI_TRAINING_CRAWLER_AGENTS = [
  "Google-Extended",
  "Applebot-Extended",
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Amazonbot",
  "CCBot",
  "commoncrawl",
  "cohere-training-data-crawler",
  "Coherebot",
  "cohere-ai",
  "meta-externalagent",
  "Diffbot",
  "Bytespider",
  "omgili",
];

/**
 * Tokens that must never appear in a crawler-SERVING regex. Substring match,
 * lowercased, so `ccbot` also catches `CCBot-...`.
 */
export const AI_TRAINING_TOKENS = [
  "google-extended",
  "applebot-extended",
  "gptbot",
  "anthropic-ai",
  "claudebot",
  "amazonbot",
  "ccbot",
  "commoncrawl",
  "cohere-training-data-crawler",
  "coherebot",
  "cohere-ai",
  "meta-externalagent",
  "diffbot",
  "bytespider",
  "omgili",
];

/** `document.referrer` hosts for human click-through from AI chat surfaces. */
export const AI_REFERRAL_HOSTS = [
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