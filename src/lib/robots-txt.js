/**
 * robots.txt body — built in one place so the endpoint and the audit can never
 * disagree about what the policy is.
 *
 * Policy:
 *   search + AI reference  → `Allow: /`, with gated/duplicate paths disallowed
 *   AI training           → `Disallow: /`
 *   both preference headers emitted on every group (neither is
 *                            vendor-supported yet, so the real block stays on
 *                            `Disallow: /`)
 */

import {
  AI_REFERENCE_CRAWLER_AGENTS,
  AI_TRAINING_CRAWLER_AGENTS,
  CONTENT_SIGNAL,
  CONTENT_USAGE,
} from "./ai-referral.js";
import { CRAWL_DISALLOW, SITE_ORIGIN } from "./site-config.js";
import { ROBOTS_SEARCH_AGENTS } from "./crawler-ua.js";

function allowGroup(userAgent) {
  return [
    `User-agent: ${userAgent}`,
    "Allow: /",
    ...CRAWL_DISALLOW.map((path) => `Disallow: ${path}`),
    `Content-Signal: ${CONTENT_SIGNAL}`,
    `Content-Usage: ${CONTENT_USAGE}`,
    "",
  ].join("\n");
}

function blockGroup(userAgent) {
  return [
    `User-agent: ${userAgent}`,
    "Disallow: /",
    `Content-Signal: ${CONTENT_SIGNAL}`,
    `Content-Usage: ${CONTENT_USAGE}`,
    "",
  ].join("\n");
}

export function buildRobotsTxt() {
  return [
    "# search + AI reference crawlers are allowed; AI training crawlers are blocked",
    `# Content-Signal: ${CONTENT_SIGNAL} (Cloudflare field trial)`,
    `# Content-Usage: ${CONTENT_USAGE} (IETF draft-ietf-aipref-attach)`,
    "",
    ...ROBOTS_SEARCH_AGENTS.map(allowGroup),
    ...AI_REFERENCE_CRAWLER_AGENTS.map(allowGroup),
    ...AI_TRAINING_CRAWLER_AGENTS.map(blockGroup),
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}