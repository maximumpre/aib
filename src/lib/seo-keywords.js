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
 * ARCHETYPE 6 — Financial / Specialty (Irish retail internet banking).
 * Six semantic clusters (quota 60–120+). Append-only; never delete.
 *
 * SCOPE — addressable by a login gateway only:
 *   Registration number / PAC auth, recovery, personal/business sign-in,
 *   Ireland internet banking access, mobile app login, card-reader SCA.
 * Excluded: product quotes (rates/AER/APR), insurance funnels, MyMortgage
 * portal, and cross-market UK/NI/Canada/Scotland variants.
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

const FULL_BRAND_NAME = "Allied Irish Bank";
const FULL_BRAND_PLURAL = "Allied Irish Banks";

/**
 * Cluster 1 — Corporate entity & brand variants.
 * Legal entity, short names, group naming, navigational brand+access.
 */
export const CORPORATE_BRAND_KEYWORDS = [
  `${SITE_DISPLAY_NAME} login`,
  `${FULL_BRAND_NAME} login`,
  `${FULL_BRAND_PLURAL} login`,
  `${SITE_DISPLAY_NAME} online banking login`,
  `${FULL_BRAND_NAME} online banking`,
  `${FULL_BRAND_NAME} internet banking`,
  `${FULL_BRAND_PLURAL} online banking`,
  `${SITE_DISPLAY_NAME} internet banking login`,
  `${FULL_BRAND_NAME} online banking login`,
  `${SITE_DISPLAY_NAME} login page`,
  `${FULL_BRAND_NAME} login page`,
  `${SITE_DISPLAY_NAME} login personal`,
  `${FULL_BRAND_NAME} personal login`,
  `${SITE_DISPLAY_NAME} login Ireland`,
  `${FULL_BRAND_NAME} Ireland login`,
  `${FULL_BRAND_NAME} online banking sign in`,
  `${SITE_DISPLAY_NAME} online banking app login`,
  `${SITE_DISPLAY_NAME} 24/7 banking`,
  `${FULL_BRAND_NAME} 24/7 banking`,
  `${FULL_BRAND_NAME} digital banking`,
  `${SITE_DISPLAY_NAME} digital profile sign in`,
  `${FULL_BRAND_NAME} sign in`,
  `${SITE_DISPLAY_NAME} Group online banking`,
  `${FULL_BRAND_PLURAL} plc login`,
  `${SITE_DISPLAY_NAME} Bank Ireland login`,
  `${FULL_BRAND_NAME} customer login`,
  `${SITE_DISPLAY_NAME} login online`,
  `${SITE_DISPLAY_NAME} login ireland`,
  `${SITE_DISPLAY_NAME} login online banking`,
  `${SITE_DISPLAY_NAME} sign in online`,
  `${SITE_DISPLAY_NAME} log in online banking`,
  `${SITE_DISPLAY_NAME} log in ireland`,
  `${SITE_DISPLAY_NAME} log in banking`,
];

/**
 * Cluster 2 — Account services reachable after authentic internet-banking sign-in.
 * Balances, eStatements, payments, transfers — not product-rate quotes.
 */
export const ACCOUNT_SERVICES_KEYWORDS = [
  `${SITE_DISPLAY_NAME} eStatements login`,
  `${FULL_BRAND_NAME} eStatements`,
  `${SITE_DISPLAY_NAME} view account balance online`,
  `${FULL_BRAND_NAME} check balance online`,
  `${SITE_DISPLAY_NAME} pay bills online banking`,
  `${FULL_BRAND_NAME} standing orders online`,
  `${SITE_DISPLAY_NAME} transfer money online banking`,
  `${FULL_BRAND_NAME} internet banking payments`,
  `${SITE_DISPLAY_NAME} eFee advice online`,
  `${FULL_BRAND_NAME} online banking transactions`,
  `${SITE_DISPLAY_NAME} personal banking online access`,
  `${FULL_BRAND_NAME} manage payments online`,
];

/**
 * Cluster 3 — Authentication & action intents (Registration number / PAC).
 */
export const AUTH_ACTION_KEYWORDS = [
  `${SITE_DISPLAY_NAME} registration number`,
  `${FULL_BRAND_NAME} registration number`,
  `${FULL_BRAND_PLURAL} registration number`,
  `${SITE_DISPLAY_NAME} registration number where to find`,
  `where to find ${FULL_BRAND_NAME} registration number`,
  `${SITE_DISPLAY_NAME} registration number and PAC`,
  `${FULL_BRAND_NAME} registration number and PAC`,
  `${SITE_DISPLAY_NAME} PAC`,
  `${FULL_BRAND_NAME} PAC`,
  `${SITE_DISPLAY_NAME} PAC code`,
  `${FULL_BRAND_NAME} PAC code`,
  "what is a personal access code",
  "5 digit personal access code",
  `${FULL_BRAND_NAME} 5 digit PAC`,
  `${FULL_BRAND_PLURAL} personal access code`,
  `${SITE_DISPLAY_NAME} registration number retrieval`,
  `find my ${SITE_DISPLAY_NAME} registration number`,
  `${FULL_BRAND_NAME} online banking registration number`,
  `${SITE_DISPLAY_NAME} forgot PAC`,
  `${FULL_BRAND_NAME} forgot PAC`,
  `${SITE_DISPLAY_NAME} reset PAC`,
  `${FULL_BRAND_NAME} reset PAC`,
  `${SITE_DISPLAY_NAME} lost PAC`,
  `${FULL_BRAND_NAME} lost PAC`,
  "forgot personal access code",
  `reset ${FULL_BRAND_NAME} PAC online`,
  `${SITE_DISPLAY_NAME} trouble logging in`,
  `${FULL_BRAND_NAME} trouble logging in`,
  `${SITE_DISPLAY_NAME} login issues`,
  `${FULL_BRAND_NAME} login issues`,
  `${SITE_DISPLAY_NAME} account locked`,
  `${FULL_BRAND_NAME} account locked`,
  `${FULL_BRAND_NAME} reset login details`,
  `${FULL_BRAND_NAME} login help`,
  `${SITE_DISPLAY_NAME} login not working`,
  `${SITE_DISPLAY_NAME} login issues today`,
  `${SITE_DISPLAY_NAME} log in problems`,
  `${SITE_DISPLAY_NAME} log in error`,
  `${SITE_DISPLAY_NAME} change password`,
  `${SITE_DISPLAY_NAME} log in with card reader`,
  `${FULL_BRAND_NAME} Strong Customer Authentication`,
  `${SITE_DISPLAY_NAME} SCA setup login`,
];

/**
 * Cluster 4 — Customer / participant roles.
 */
export const CUSTOMER_ROLE_KEYWORDS = [
  `${SITE_DISPLAY_NAME} login personal`,
  `${SITE_DISPLAY_NAME} log in personal`,
  `${SITE_DISPLAY_NAME} log in personal banking`,
  `${FULL_BRAND_NAME} personal banking login`,
  `${SITE_DISPLAY_NAME} login business`,
  `${SITE_DISPLAY_NAME} login business banking`,
  `${SITE_DISPLAY_NAME} log in business`,
  `${FULL_BRAND_NAME} business internet banking`,
  `${SITE_DISPLAY_NAME} joint account holder login`,
  `${FULL_BRAND_NAME} personal customer sign in`,
  `${SITE_DISPLAY_NAME} Phone and Internet Banking login`,
  `${FULL_BRAND_NAME} Phone & Internet Banking`,
];

/**
 * Cluster 5 — Platform & channel synergy (internet / phone / digital / portal).
 */
export const PLATFORM_SYNERGY_KEYWORDS = [
  `${SITE_DISPLAY_NAME} secure banking`,
  `${FULL_BRAND_NAME} secure banking`,
  "secure online banking login",
  "online banking login Ireland",
  `${FULL_BRAND_NAME} online portal`,
  `${FULL_BRAND_PLURAL} internet banking Ireland`,
  `${SITE_DISPLAY_NAME} internet banking Ireland personal`,
  `${SITE_DISPLAY_NAME} login portal`,
  `${SITE_DISPLAY_NAME} online banking portal`,
  `${FULL_BRAND_NAME} digital profile`,
  `${SITE_DISPLAY_NAME} internet banking sign in`,
  `${FULL_BRAND_NAME} online servicing portal`,
  `${SITE_DISPLAY_NAME} customer portal sign in`,
  `${FULL_BRAND_NAME} account manager login`,
];

/**
 * Cluster 6 — Self-service & mobile.
 */
export const SELF_SERVICE_MOBILE_KEYWORDS = [
  `${SITE_DISPLAY_NAME} login app`,
  `${SITE_DISPLAY_NAME} mobile app login`,
  `${FULL_BRAND_NAME} mobile banking login`,
  `${SITE_DISPLAY_NAME} Mobile app Registration number`,
  `${FULL_BRAND_NAME} app PAC login`,
  `${SITE_DISPLAY_NAME} retrieve registration number`,
  `${FULL_BRAND_NAME} retrieve registration number online`,
  `${SITE_DISPLAY_NAME} login without phone`,
  `${SITE_DISPLAY_NAME} customer service 0818 724 724`,
  `${FULL_BRAND_NAME} internet banking helpline`,
  `${SITE_DISPLAY_NAME} register internet banking`,
  `${FULL_BRAND_NAME} register for online banking`,
  `${SITE_DISPLAY_NAME} card reader login`,
  `${FULL_BRAND_NAME} biometric app login`,
];

/** @deprecated Alias — preserved for any external imports of the old name. */
export const BRAND_ACCESS_KEYWORDS = CORPORATE_BRAND_KEYWORDS;
/** @deprecated Alias — credential vocabulary now lives in AUTH_ACTION_KEYWORDS. */
export const CREDENTIAL_KEYWORDS = AUTH_ACTION_KEYWORDS.filter((k) =>
  /registration number|PAC|personal access code/i.test(k),
);
/** @deprecated Alias */
export const RECOVERY_KEYWORDS = AUTH_ACTION_KEYWORDS.filter((k) =>
  /forgot|reset|lost|trouble|locked|issues|help|not working|problems|error|change password/i.test(k),
);
/** @deprecated Alias */
export const SECURE_ACCESS_KEYWORDS = PLATFORM_SYNERGY_KEYWORDS;

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
    CORPORATE_BRAND_KEYWORDS,
    ACCOUNT_SERVICES_KEYWORDS,
    AUTH_ACTION_KEYWORDS,
    CUSTOMER_ROLE_KEYWORDS,
    PLATFORM_SYNERGY_KEYWORDS,
    SELF_SERVICE_MOBILE_KEYWORDS,
  );
}

/** Full list for `<meta name="keywords">` — includes the host tokens (Yandex). */
export const SITE_KEYWORDS = buildSiteKeywords();

/**
 * Crawler-visible body keywords (`Related searches: …`) — the same list minus
 * the host tokens. Domains stay in the meta tag; they never enter page copy.
 */
export function buildVisibleKeywords() {
  const hosts = new Set(HOST_KEYWORDS.map((h) => h.toLowerCase()));
  return SITE_KEYWORDS.filter((k) => !hosts.has(k.toLowerCase()));
}

export const SITE_VISIBLE_KEYWORDS = buildVisibleKeywords();

/** Branded H1, shared by the human landing and the crawler twin (one constant). */
export const PAGE_H1_HEADING = `${SITE_DISPLAY_NAME} Login`;
