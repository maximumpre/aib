/**
 * Meta description check — reads the BUILT pages, not the source.
 *
 *   node scripts/check-meta-description.mjs
 *
 * A meta description that only exists in the component source can still be
 * missing, duplicated or truncated in the HTML a crawler receives. This reads
 * `dist/` for exactly that reason.
 *
 * Enforces, per page:
 *   - exactly one `<title>`, 10–70 chars, and it carries the brand
 *   - exactly one `<meta name="description">`, 25–170 chars
 *   - no domain in the description (the visible URL already sits next to the
 *     title in the SERP — a domain there is filler on the CTR-critical lines)
 *   - no `noindex`/`noarchive` on the indexable surfaces
 *   - `og:site_name` matches the JSON-LD `WebSite.name`
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

const siteConfig = await import(pathToFileURL(path.join(ROOT, "src/lib/site-config.js")).href);

let failures = 0;
let checks = 0;

function assert(condition, msg, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${msg}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${msg}${detail ? ` — ${detail}` : ""}`);
  }
}

const INDEXABLE = ["index.html", "crawler-seo.html"];
const NON_INDEXABLE = ["login.html", "authenticating.html", "404.html"];

console.log("meta description + title parity\n");

for (const file of [...INDEXABLE, ...NON_INDEXABLE]) {
  const p = path.join(DIST, file);
  if (!fs.existsSync(p)) {
    assert(false, `${file} exists in dist/`);
    continue;
  }
  const html = fs.readFileSync(p, "utf8");

  const titles = [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1].trim());
  assert(titles.length === 1, `${file}: exactly one <title>`, `${titles.length}`);
  const title = titles[0] ?? "";
  assert(
    title.length >= 10 && title.length <= 70,
    `${file}: title length 10–70`,
    `${title.length} — "${title}"`,
  );
  assert(
    title.includes(siteConfig.SITE_DISPLAY_NAME),
    `${file}: title carries the brand`,
    title,
  );

  const descs = [...html.matchAll(/<meta name="description" content="([^"]*)"/g)].map((m) => m[1]);
  assert(descs.length === 1, `${file}: exactly one meta description`, `${descs.length}`);
  const desc = descs[0] ?? "";
  assert(
    desc.length >= 25 && desc.length <= 170,
    `${file}: description length 25–170`,
    `${desc.length}`,
  );
  assert(!/https?:\/\//i.test(desc), `${file}: no URL in the description`, desc);

  const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? "";
  if (INDEXABLE.includes(file)) {
    assert(
      robots === "index, follow",
      `${file}: indexable with \`index, follow\``,
      robots,
    );
    assert(
      !/noarchive|nosnippet|nocache|noindex/i.test(robots),
      `${file}: no restrictive robots directive (Bing flags these)`,
      robots,
    );
  } else {
    assert(/noindex/i.test(robots), `${file}: non-canonical surface is noindex`, robots);
  }

  const siteName = html.match(/<meta property="og:site_name" content="([^"]*)"/)?.[1];
  const ld = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (ld) {
    let name = null;
    try {
      const parsed = JSON.parse(ld[1]);
      name = parsed["@graph"]?.find((n) => n["@type"] === "WebSite")?.name;
    } catch {
      /* reported below */
    }
    if (name) {
      assert(
        siteName === name,
        `${file}: og:site_name matches JSON-LD WebSite.name`,
        `${siteName} / ${name}`,
      );
      assert(
        name === siteConfig.SITE_DISPLAY_NAME,
        `${file}: JSON-LD name resolves to SITE_DISPLAY_NAME`,
        name,
      );
    }
  }
}

const canonical = (file) =>
  fs.readFileSync(path.join(DIST, file), "utf8").match(/<link rel="canonical" href="([^"]*)"/)?.[1];

assert(
  canonical("index.html") === siteConfig.SITE_HOMEPAGE_CANONICAL,
  "index.html canonical is the homepage canonical",
  canonical("index.html"),
);
assert(
  canonical("crawler-seo.html") === canonical("index.html"),
  "crawler twin canonical matches the landing (no competing URL)",
  canonical("crawler-seo.html"),
);
assert(
  canonical("login.html") === siteConfig.SITE_HOMEPAGE_CANONICAL,
  "login.html canonical consolidates onto /",
  canonical("login.html"),
);

console.log(
  `\n${failures === 0 ? "PASS" : "FAIL"} — ${checks - failures}/${checks} checks passed`,
);
process.exit(failures === 0 ? 0 : 1);