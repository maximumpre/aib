/**
 * Titles, descriptions, social-card metadata and the JSON-LD graph.
 *
 * Every value derives from `site-config.js` and `seo-keywords.js`. No literal
 * brand or URL is written here — that invariant is what stops one project's
 * name reaching another's pages, and `scripts/audit-crawler-seo.mjs` enforces
 * it.
 */

import {
  INDEXABLE_PAGE_ROBOTS,
  SITE_DISPLAY_NAME,
  SITE_HOMEPAGE_CANONICAL,
  SITE_LEGAL_NAME,
  SITE_ORIGIN,
  canonicalHostFromOrigin,
} from "./site-config.js";
import { SITE_KEYWORDS, SITE_VISIBLE_KEYWORDS } from "./seo-keywords.js";

/**
 * Ends with the brand after a pipe. Google documents the site name at the
 * beginning or end of `<title>`, separated by a delimiter; an unbranded title
 * gets rewritten or truncated.
 */
import { LAYOUT_DESCRIPTION } from "./meta-description.ts";

export { LAYOUT_DESCRIPTION };

export const SITE_TITLE = `Online banking login | ${SITE_DISPLAY_NAME}`;

/**
 * Describes the service, never the domain. The visible URL already sits next
 * to the title in the SERP, so a domain in the description is filler on the
 * CTR-critical lines. Kept inside 25–170 characters.
 */
export const SITE_DESCRIPTION = LAYOUT_DESCRIPTION;

/** Social card image. Generated at build-prep time from the project logo. */
export const OG_IMAGE_PATH = "/og-image.png";
export const OG_IMAGE = { width: 1200, height: 630 };

export const ogImageUrl = new URL(OG_IMAGE_PATH, SITE_HOMEPAGE_CANONICAL).href;

/**
 * Brand phrases first, then the **bare lowercase host as the LAST entry**.
 *
 * Google's site-names document lists this as fallback option #2: "Provide your
 * domain or subdomain name as a backup option… Your domain needs to be in all
 * lowercase… Our system will strongly consider using it if your preferred name
 * isn't selected." Never a raw `https://…` URL, and never a brand phrase after
 * the host.
 */
export function buildAlternateNames() {
  return [
    `${SITE_DISPLAY_NAME} Login`,
    "AIB Internet Banking",
    "Allied Irish Bank",
    "Allied Irish Banks",
    canonicalHostFromOrigin().toLowerCase(),
  ];
}

/**
 * `WebSite` + `WebPage` + `Organization` in one graph.
 *
 * The real AIB homepage ships a four-property `WebSite` node with no
 * `potentialAction`, no `Organization`, and an empty `og:title` — so this is a
 * deliberate upgrade rather than a copy.
 */
export function buildStructuredData() {
  const websiteId = `${SITE_ORIGIN}/#website`;
  const webpageId = `${SITE_ORIGIN}/#webpage`;
  const organizationId = `${SITE_ORIGIN}/#organization`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SITE_DISPLAY_NAME,
        alternateName: buildAlternateNames(),
        url: SITE_HOMEPAGE_CANONICAL,
        description: SITE_DESCRIPTION,
        inLanguage: "en-IE",
        publisher: { "@id": organizationId },
        potentialAction: {
          "@type": "LoginAction",
          name: `Sign in to ${SITE_DISPLAY_NAME}`,
          target: { "@type": "EntryPoint", url: SITE_HOMEPAGE_CANONICAL },
        },
      },
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SITE_DISPLAY_NAME,
        legalName: SITE_LEGAL_NAME,
        url: SITE_ORIGIN,
        logo: {
          "@type": "ImageObject",
          url: new URL("/images/aib-logo.png", SITE_HOMEPAGE_CANONICAL).href,
        },
      },
      {
        "@type": "WebPage",
        "@id": webpageId,
        url: SITE_HOMEPAGE_CANONICAL,
        name: `${SITE_DISPLAY_NAME} login`,
        description: SITE_DESCRIPTION,
        isPartOf: { "@id": websiteId },
        about: { "@id": websiteId },
        inLanguage: "en-IE",
        primaryImageOfPage: { "@type": "ImageObject", url: ogImageUrl },
      },
    ],
  };
}

export { SITE_KEYWORDS, SITE_VISIBLE_KEYWORDS, INDEXABLE_PAGE_ROBOTS };