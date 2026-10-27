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
} from "./site-config.js";
import { SITE_KEYWORDS, SITE_VISIBLE_KEYWORDS } from "./seo-keywords.js";
import { SEO_FAQS } from "./seo-faq.js";
import { LAYOUT_DESCRIPTION } from "./meta-description.ts";

export { LAYOUT_DESCRIPTION };

/**
 * Ends with the brand after a pipe. Google documents the site name at the
 * beginning or end of `<title>`, separated by a delimiter; an unbranded title
 * gets rewritten or truncated.
 */
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
 * Knowledge Graph entity links for Allied Irish Banks / AIB Group plc
 * (Euronext Dublin: A5G).
 */
export const ORGANIZATION_SAME_AS = [
  "https://en.wikipedia.org/wiki/AIB_Group",
  "https://www.wikidata.org/wiki/Q1642179",
  "https://www.aib.ie/",
];

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
  // Brand phrases ONLY — never raw domains/hosts (Google SERP Layer 1 fallback trap).
  return [
    `${SITE_DISPLAY_NAME} Login`,
    `${SITE_DISPLAY_NAME} Internet Banking`,
    `${SITE_DISPLAY_NAME} Portal`,
    "Allied Irish Bank",
    "Allied Irish Banks",
    "AIB Group",
  ];
}

/**
 * `WebSite` + `Organization` + `WebPage` + `BreadcrumbList` + `FAQPage`.
 */
export function buildStructuredData() {
  const websiteId = `${SITE_ORIGIN}/#website`;
  const webpageId = `${SITE_ORIGIN}/#webpage`;
  const organizationId = `${SITE_ORIGIN}/#organization`;
  const breadcrumbId = `${SITE_ORIGIN}/#breadcrumb`;
  const faqId = `${SITE_ORIGIN}/#faq`;

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
        sameAs: ORGANIZATION_SAME_AS,
        tickerSymbol: "A5G",
        logo: {
          "@type": "ImageObject",
          url: ogImageUrl,
          width: OG_IMAGE.width,
          height: OG_IMAGE.height,
        },
      },
      {
        "@type": "WebPage",
        "@id": webpageId,
        url: SITE_HOMEPAGE_CANONICAL,
        name: `${SITE_DISPLAY_NAME} login`,
        description: SITE_DESCRIPTION,
        isPartOf: { "@id": websiteId },
        about: { "@id": organizationId },
        inLanguage: "en-IE",
        breadcrumb: { "@id": breadcrumbId },
        primaryImageOfPage: { "@type": "ImageObject", url: ogImageUrl },
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_HOMEPAGE_CANONICAL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Sign In",
            item: SITE_HOMEPAGE_CANONICAL,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": faqId,
        mainEntity: SEO_FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };
}

export { SITE_KEYWORDS, SITE_VISIBLE_KEYWORDS, INDEXABLE_PAGE_ROBOTS };
