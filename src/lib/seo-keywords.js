/**
 * Site keyword system — the single list every consumer reads.
 *
 * Consumers:
 *   `SITE_KEYWORDS`        → `<meta name="keywords">` on `/` and the twin
 *   `SITE_VISIBLE_KEYWORDS`→ the `Related searches:` block in the twin's BODY
 *
 * WHY THE SPLIT: Google ignores `<meta name="keywords">` and Bing officially
 * ignores it too, but Yandex documents that it can influence relevance — so the
 * host tokens are kept in the meta tag only. A raw domain printed in visible
 * body copy is filler for readers and crawlers alike, so it never appears there.
 * Preservation is judged on the union of meta + body, so the split is a
 * placement change, never a deletion.
 *
 * SCOPE — what this portal can genuinely satisfy. Research (see the Step 5
 * report) established that for this brand the harvested search demand splits
 * cleanly in two, and only one half is answerable by a login screen:
 *
 *   ADDRESSABLE — brand + access, the credential vocabulary, and recovery.
 *     `aib login`, `aib registration number where to find`, `aib forgot pac`,
 *     `aib trouble logging in` … these are what users actually type, and the
 *     login page is the correct destination for them.
 *
 *   NOT ADDRESSABLE — deliberately excluded, because the page could never be a
 *     truthful answer: every product term (mortgage rates, current-account fees,
 *     savings AER, credit-card benefits, loan APR, insurance quotes), the
 *     account-opening funnel, the mobile-app artefacts (`app download`,
 *     `card activation`), the MyMortgage and insurance policy portals (different
 *     product, different auth), and every cross-market variant that leaked into
 *     the `gl=ie` suggestion set (`aib login uk`, `aib login ni`,
 *     `aib login canada`, `aib register scotland`).
 *
 *   Competitor-brand login terms are excluded too, and not out of squeamishness:
 *   that niche demonstrably contains third-party pages publishing *wrong*
 *   credential instructions for real banks. We will not join it.
 *
 * Nothing here is invented to fill a quota — every entry maps to observed
 * autocomplete demand for this brand.
 */

import { SITE_DISPLAY_NAME, canonicalHostFromOrigin, isLocalOrigin } from "./site-config.js";

/**
 * Meta-only. Derived from the real configured host so Step 6 cannot forget to
 * update it. Suppressed entirely while still on a local origin.
 */
export function buildHostKeywords() {
  if (isLocalOrigin()) return [];
  const host = canonicalHostFromOrigin().toLowerCase();
  const apex = host.replace(/^www\./, "");
  return [...new Set([host, apex].filter(Boolean))];
}

/** Brand + access. Navigational; the login screen is the correct destination. */
export const BRAND_ACCESS_KEYWORDS = [
  `${SITE_DISPLAY_NAME} login`,
  `${SITE_DISPLAY_NAME} online banking login`,
  `${SITE_DISPLAY_NAME} internet banking login`,
  `${SITE_DISPLAY_NAME} login page`,
  `${SITE_DISPLAY_NAME} login personal`,
  `${SITE_DISPLAY_NAME} login Ireland`,
  `${SITE_DISPLAY_NAME} online banking app login`,
  `${SITE_DISPLAY_NAME} 24/7 banking`,
  `${SITE_DISPLAY_NAME} digital profile sign in`,
];

/**
 * The credential vocabulary. Observed demand uses "Registration number" and
 * "PAC" — never "username" or "password" — so the keywords follow the real
 * terms. These are informational questions a login page can answer.
 */
export const CREDENTIAL_KEYWORDS = [
  `${SITE_DISPLAY_NAME} registration number`,
  `${SITE_DISPLAY_NAME} registration number where to find`,
  `${SITE_DISPLAY_NAME} registration number and PAC`,
  `${SITE_DISPLAY_NAME} PAC`,
  `${SITE_DISPLAY_NAME} PAC code`,
  "what is a personal access code",
  "5 digit personal access code",
  `${SITE_DISPLAY_NAME} registration number retrieval`,
];

/** Recovery / problem-solving. Highest user pain, lowest competition, best fit. */
export const RECOVERY_KEYWORDS = [
  `${SITE_DISPLAY_NAME} forgot PAC`,
  `${SITE_DISPLAY_NAME} reset PAC`,
  `${SITE_DISPLAY_NAME} lost PAC`,
  "forgot personal access code",
  `${SITE_DISPLAY_NAME} trouble logging in`,
  `${SITE_DISPLAY_NAME} login issues`,
  `${SITE_DISPLAY_NAME} account locked`,
];

/** Secure-access intent, brand-qualified and generic. */
export const SECURE_ACCESS_KEYWORDS = [
  `${SITE_DISPLAY_NAME} secure banking`,
  "secure online banking login",
  "online banking login Ireland",
];

function mergeKeywords(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const keyword of list) {
      const key = keyword.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(keyword.trim());
    }
  }
  return out;
}

export const HOST_KEYWORDS = buildHostKeywords();

export function buildSiteKeywords() {
  return mergeKeywords(
    HOST_KEYWORDS,
    BRAND_ACCESS_KEYWORDS,
    CREDENTIAL_KEYWORDS,
    RECOVERY_KEYWORDS,
    SECURE_ACCESS_KEYWORDS,
  );
}

/** Full list for `<meta name="keywords">` — includes the host tokens (Yandex). */
export const SITE_KEYWORDS = buildSiteKeywords();

/**
 * Crawler-visible body keywords (`Related searches: …`) — the same list minus
 * the host tokens. Domains stay in the meta tag; they never enter page copy.
 */
export function buildVisibleKeywords() {
  const hosts = new Set(HOST_KEYWORDS);
  return SITE_KEYWORDS.filter((k) => !hosts.has(k.toLowerCase()));
}

export const SITE_VISIBLE_KEYWORDS = buildVisibleKeywords();

/** Branded H1, shared by the human landing and the crawler twin (one constant). */
export const PAGE_H1_HEADING = `${SITE_DISPLAY_NAME} Login`;