/**
 * Single source of truth for brand identity, canonical URLs and indexability.
 *
 * Astro equivalent of the kit's `lib/site-url.ts` + `lib/seo-robots-metadata.ts`.
 * Every name-bearing field in `SeoHead.astro`, the JSON-LD graph, `robots.txt`
 * and `sitemap.xml` reads from here — there is no second place for a literal
 * brand or URL to be hardcoded and drift.
 *
 * PRODUCTION (Step 6 supplies the real domain):
 *   Set `SITE_ORIGIN` in the Vercel build environment, e.g.
 *   `SITE_ORIGIN=https://login.example.com`. Until then the build falls back to
 *   the dev origin, which is correct for local work and visibly wrong in
 *   production — that is intentional, so nobody ships a localhost canonical
 *   believing it is a real one.
 */

const viteEnv = (typeof import.meta !== "undefined" && import.meta.env) || {};
const nodeEnv = typeof process !== "undefined" ? process.env : {};

function readEnv(...names) {
  for (const name of names) {
    const value = viteEnv[name] ?? nodeEnv[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Display name used for every site-name signal Google reads: `<title>`,
 * `applicationName`, `og:site_name`, Twitter, JSON-LD `WebSite.name`, the
 * copyright line and the crawler twin H1.
 *
 * Matches the brand already used throughout this project (Telegram notification
 * headers, `project_name: "AIB"`, the footer entity line, the logo `alt`).
 */
export const SITE_DISPLAY_NAME = "AIB";

/** Legal entity line already shown in the landing footer. */
export const SITE_LEGAL_NAME = "Allied Irish Banks, p.l.c.";

import {
  SITE_ORIGIN as SITE_ORIGIN_CANONICAL,
  SITE_URL,
  CANONICAL_HOST,
  SITE_HOMEPAGE_CANONICAL as SITE_HOMEPAGE_CANONICAL_URL,
  INDEXNOW_KEY,
  BING_INDEX_TOKEN,
} from "./site-url.ts";

export { SITE_URL, CANONICAL_HOST, INDEXNOW_KEY, BING_INDEX_TOKEN };

export const SITE_ORIGIN = (
  readEnv("SITE_ORIGIN", "PUBLIC_SITE_ORIGIN") || SITE_ORIGIN_CANONICAL
).replace(/\/+$/, "");

/** Homepage canonical — trailing slash. The ONLY canonical in sitemap.xml. */
export const SITE_HOMEPAGE_CANONICAL = `${SITE_ORIGIN}/`;

/**
 * Bump when homepage SEO copy changes materially. Used as the sitemap
 * `lastmod`; a stale date weakens re-crawl signals.
 */
export const SITE_CONTENT_UPDATED_AT = readEnv("SITE_CONTENT_UPDATED_AT") || "2026-10-04T00:00:00.000Z";

export function canonicalHostFromOrigin() {
  try {
    return new URL(SITE_ORIGIN).hostname;
  } catch {
    return "localhost";
  }
}

/** True while still pointing at a local dev origin — guards host-keyword output. */
export function isLocalOrigin() {
  const host = canonicalHostFromOrigin().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]";
}

export function canonicalUrlForPath(pathname) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (path === "/") return SITE_HOMEPAGE_CANONICAL;
  return `${SITE_ORIGIN}${path}`;
}

/**
 * Indexable pages: `index, follow` and Googlebot preview/snippet hints only.
 *
 * NEVER add `noarchive` / `nosnippet` / `nocache` / `noindex` here. Bing
 * Webmaster Tools flags those as "restrictive robots directives" even when the
 * page is still indexable, which reads like an accidental `noindex` and
 * suppresses AI-answer depth. AI *training* opt-out is handled in
 * `robots.txt` (`Disallow: /` for training UAs) plus the `Content-Signal` /
 * `Content-Usage` preference headers.
 */
export const INDEXABLE_PAGE_ROBOTS = {
  index: true,
  follow: true,
  googlebot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

/** Gated / duplicate surfaces: stay out of the index, keep link equity flowing. */
export const NOINDEX_PAGE_ROBOTS = { index: false, follow: true };

export function robotsContent(robots = INDEXABLE_PAGE_ROBOTS) {
  return `${robots.index ? "index" : "noindex"}, ${robots.follow ? "follow" : "nofollow"}`;
}

export function googlebotContent(robots = INDEXABLE_PAGE_ROBOTS) {
  const gb = robots.googlebot;
  if (!gb) return robotsContent(robots);
  return [
    `${gb.index ? "index" : "noindex"}`,
    `${gb.follow ? "follow" : "nofollow"}`,
    `max-video-preview:${gb["max-video-preview"]}`,
    `max-image-preview:${gb["max-image-preview"]}`,
    `max-snippet:${gb["max-snippet"]}`,
  ].join(", ");
}

/** Path of the crawler SEO twin, as built and as served after the rewrite. */
export const CRAWLER_SEO_PATH = "/crawler-seo.html";

/**
 * Paths that must never be indexed. `/authenticating.html` is the in-flight
 * approval gate; `/login.html` renders the same UI as `/` but is the legacy
 * duplicate, so it is consolidated onto the canonical homepage instead.
 */
export const NOINDEX_PATHS = ["/authenticating.html", "/login.html"];

/** Paths crawlers have no reason to request. */
export const CRAWL_DISALLOW = ["/api/", ...NOINDEX_PATHS];