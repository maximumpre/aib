#!/usr/bin/env node

/**
 * Fails the build if lib/site-url.ts SITE_ORIGIN is missing or still a placeholder.
 * Checks lib/site-url.ts or src/lib/site-url.ts.
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const CANDIDATES = [
  path.join(ROOT, "lib", "site-url.ts"),
  path.join(ROOT, "src", "lib", "site-url.ts"),
];
const SITE_TS_CANDIDATES = [
  path.join(ROOT, "lib", "site.ts"),
  path.join(ROOT, "src", "lib", "site.ts"),
];

const PLACEHOLDER_PATTERNS = [
  /YOUR_DOMAIN/i,
  /example\.com/i,
  /your-site/i,
  /placeholder/i,
  /TODO_/i,
];

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

  if (!source.includes("SITE_HOMEPAGE_CANONICAL") && !source.includes('from "./site"')) {
    console.error("Canonical domain check failed: SITE_HOMEPAGE_CANONICAL missing.");
    process.exit(1);
  }

  if (!source.includes("CANONICAL_HOST")) {
    console.error("Canonical domain check failed: CANONICAL_HOST missing.");
    process.exit(1);
  }

  console.log(`Canonical domain check passed (${siteOrigin}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
