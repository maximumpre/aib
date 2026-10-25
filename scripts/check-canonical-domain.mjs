#!/usr/bin/env node

/**
 * Fails the build if lib/site-url.ts SITE_ORIGIN is missing, placeholder, or
 * apex-by-mistake (Bing blank inspected page / 308 host mismatch).
 *
 * Default: hostname MUST start with `www.` (Vercel primary is almost always www).
 * Opt out for rare apex-primary hosts: SITE_ORIGIN_ALLOW_APEX=1
 *
 * When public/crawler-seo.html exists (post Astro build), asserts its
 * rel=canonical href matches SITE_HOMEPAGE_CANONICAL / SITE_ORIGIN.
 *
 * Usage: node scripts/check-canonical-domain.mjs [project-root]
 * Checks lib/site-url.ts or src/lib/site-url.ts under the project root.
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(SCRIPT_DIR, ".."));

const CANDIDATES = [
  path.join(ROOT, "lib", "site-url.ts"),
  path.join(ROOT, "src", "lib", "site-url.ts"),
];
const SITE_TS_CANDIDATES = [
  path.join(ROOT, "lib", "site.ts"),
  path.join(ROOT, "src", "lib", "site.ts"),
];
const TWIN_CANDIDATES = [
  path.join(ROOT, "public", "crawler-seo.html"),
  path.join(ROOT, "dist", "crawler-seo.html"),
];

const PLACEHOLDER_PATTERNS = [
  /YOUR_DOMAIN/i,
  /example\.com/i,
  /your-site/i,
  /placeholder/i,
  /TODO_/i,
];

function allowApexOrigin() {
  return process.env.SITE_ORIGIN_ALLOW_APEX === "1";
}

async function main() {
  let siteUrlFile = null;
  for (const candidate of CANDIDATES) {
    try {
      await access(candidate);
      siteUrlFile = candidate;
      break;
    } catch {
      // try next
    }
  }

  if (!siteUrlFile) {
    console.error("Canonical domain check failed: lib/site-url.ts not found.");
    process.exit(1);
  }

  const source = await readFile(siteUrlFile, "utf8");

  if (/process\.env\.[A-Z_]*SITE/i.test(source) && !/SITE_ORIGIN\s*=\s*["']https:\/\//.test(source)) {
    console.warn(
      "Canonical domain warning: SITE_ORIGIN appears env-driven; prefer hardcoded production www URL.",
    );
  }

  let originMatch = source.match(
    /export const SITE_ORIGIN\s*=\s*(["'])(https:\/\/[^"']+)\1/,
  );

  if (!originMatch) {
    for (const siteTs of SITE_TS_CANDIDATES) {
      try {
        await access(siteTs);
        const siteSource = await readFile(siteTs, "utf8");
        originMatch = siteSource.match(
          /export const SITE_URL\s*=\s*(["'])(https:\/\/[^"']+)\1/,
        );
        if (originMatch) break;
      } catch {
        // try next
      }
    }
  }

  if (!originMatch) {
    console.error(
      "Canonical domain check failed: SITE_ORIGIN must be a hardcoded https:// string literal.",
    );
    process.exit(1);
  }

  const siteOrigin = originMatch[2].trim();
  if (siteOrigin.endsWith("/")) {
    console.error("Canonical domain check failed: SITE_ORIGIN must not end with /.");
    process.exit(1);
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(siteOrigin)) {
      console.error(
        `Canonical domain check failed: SITE_ORIGIN looks like a placeholder (${siteOrigin}).`,
      );
      process.exit(1);
    }
  }

  let hostname;
  try {
    hostname = new URL(siteOrigin).hostname.toLowerCase();
  } catch {
    console.error(`Canonical domain check failed: SITE_ORIGIN is not a valid URL (${siteOrigin}).`);
    process.exit(1);
  }

  // Local host lock (no live deploy required): prefer www so Bing/sitemap never
  // target a Vercel apex→www 308 empty body. Opt out: SITE_ORIGIN_ALLOW_APEX=1
  if (!hostname.startsWith("www.") && hostname !== "localhost" && !allowApexOrigin()) {
    console.error(
      `Canonical domain check failed: SITE_ORIGIN hostname must start with www. (got ${hostname}). ` +
        `Paste the Vercel Domains Primary Host (HTTP 200), usually https://www.<domain>. ` +
        `If apex is intentionally primary, set SITE_ORIGIN_ALLOW_APEX=1 for this build.`,
    );
    process.exit(1);
  }

  if (!source.includes("SITE_HOMEPAGE_CANONICAL") && !source.includes('from "./site"')) {
    console.error("Canonical domain check failed: SITE_HOMEPAGE_CANONICAL missing.");
    process.exit(1);
  }

  if (!source.includes("CANONICAL_HOST")) {
    console.error("Canonical domain check failed: CANONICAL_HOST missing.");
    process.exit(1);
  }

  const homepageCanonical = `${siteOrigin}/`;

  for (const twinPath of TWIN_CANDIDATES) {
    try {
      await access(twinPath);
    } catch {
      continue;
    }
    const twin = await readFile(twinPath, "utf8");
    const canon = twin.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
      || twin.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
    if (!canon) {
      console.error(
        `Canonical domain check failed: ${path.relative(ROOT, twinPath)} missing rel=canonical.`,
      );
      process.exit(1);
    }
    const href = canon[1].trim();
    if (href !== homepageCanonical && href !== siteOrigin) {
      console.error(
        `Canonical domain check failed: twin canonical href (${href}) must match SITE_ORIGIN (${homepageCanonical}). Rebuild Astro twin after changing site-url.ts.`,
      );
      process.exit(1);
    }
    // Mixed apex/www absolute origin in twin head vs SITE_ORIGIN
    const apexHost = hostname.replace(/^www\./, "");
    const wrongHost = hostname.startsWith("www.")
      ? new RegExp(`https://(?!www\\.)${apexHost.replace(/\./g, "\\.")}[/\"']`, "i")
      : null;
    if (wrongHost && wrongHost.test(twin)) {
      console.error(
        `Canonical domain check failed: ${path.relative(ROOT, twinPath)} still embeds apex https://${apexHost} while SITE_ORIGIN is www. Rebuild twin.`,
      );
      process.exit(1);
    }
    console.log(`Twin canonical OK (${path.relative(ROOT, twinPath)} → ${href}).`);
    break;
  }

  console.log(`Canonical domain check passed (${siteOrigin}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
