#!/usr/bin/env node

/**
 * Fails the build if INDEXNOW_KEY is missing, placeholder, or public/{key}.txt mismatch.
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const SITE_URL_CANDIDATES = [
  path.join(ROOT, "lib", "site-url.ts"),
  path.join(ROOT, "src", "lib", "site-url.ts"),
];

const PLACEHOLDER_KEYS = new Set([
  "",
  "YOUR_INDEXNOW_KEY_PLACEHOLDER",
  "YOUR_INDEXNOW_KEY",
  "your-indexnow-key-here",
]);

async function main() {
  let siteUrlFile = null;
  for (const candidate of SITE_URL_CANDIDATES) {
    try {
      await access(candidate);
      siteUrlFile = candidate;
      break;
    } catch {
      // try next
    }
  }

  if (!siteUrlFile) {
    console.error("IndexNow check failed: lib/site-url.ts not found.");
    process.exit(1);
  }

  const source = await readFile(siteUrlFile, "utf8");
  const keyMatch =
    source.match(/export const INDEXNOW_KEY\s*=\s*(["'])([a-f0-9]{32})\1/i) ??
    source.match(/export const INDEXNOW_KEY\s*=\s*BING_INDEX_TOKEN/) ??
    source.match(/export const INDEXNOW_KEY\s*=\s*(["'])([^"']*)\1/) ??
    source.match(
      /export const INDEXNOW_KEY\s*=\s*[\s\S]*?\?\?\s*(["'])([^"']+)\1/,
    );

  if (!keyMatch) {
    console.error("IndexNow check failed: INDEXNOW_KEY not found in site-url.ts.");
    process.exit(1);
  }

  let key = "";
  if (keyMatch[0].includes("BING_INDEX_TOKEN")) {
    let bingMatch = source.match(
      /export const BING_INDEX_TOKEN\s*=\s*(["'])([a-f0-9]{32})\1/i,
    );
    if (!bingMatch) {
      for (const siteTs of [
        path.join(ROOT, "lib", "site.ts"),
        path.join(ROOT, "src", "lib", "site.ts"),
      ]) {
        try {
          await access(siteTs);
          const siteSource = await readFile(siteTs, "utf8");
          bingMatch = siteSource.match(
            /export const BING_INDEX_TOKEN\s*=\s*(["'])([a-f0-9]{32})\1/i,
          );
          if (bingMatch) break;
        } catch {
          // try next
        }
      }
    }
    if (!bingMatch) {
      console.error("IndexNow check failed: BING_INDEX_TOKEN not found.");
      process.exit(1);
    }
    key = bingMatch[2].trim();
  } else {
    key = (keyMatch[2] ?? keyMatch[1]).trim();
  }
  if (!key || PLACEHOLDER_KEYS.has(key)) {
    console.error("IndexNow check failed: INDEXNOW_KEY is empty or placeholder.");
    process.exit(1);
  }

  const keyFile = path.join(ROOT, "public", `${key}.txt`);
  try {
    await access(keyFile);
  } catch {
    console.error(`IndexNow check failed: missing public/${key}.txt`);
    process.exit(1);
  }

  const fileContent = (await readFile(keyFile, "utf8")).trim();
  if (fileContent !== key) {
    console.error(
      `IndexNow check failed: public/${key}.txt must contain only the key value.`,
    );
    process.exit(1);
  }

  const pkgPath = path.join(ROOT, "package.json");
  try {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    const postbuild = pkg.scripts?.postbuild ?? "";
    const build = pkg.scripts?.build ?? "";
    const hasNotify =
      postbuild.includes("notify-indexnow") ||
      postbuild.includes("trigger-indexnow") ||
      build.includes("notify-indexnow") ||
      build.includes("trigger-indexnow");
    if (!hasNotify) {
      console.warn(
        "IndexNow warning: package.json has no postbuild/build notify-indexnow script.",
      );
    }
  } catch {
    console.warn("IndexNow warning: could not read package.json for postbuild check.");
  }

  console.log(`IndexNow check passed (key ${key.slice(0, 8)}…).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
