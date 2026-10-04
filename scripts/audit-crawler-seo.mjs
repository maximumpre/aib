/**
 * Crawler SEO audit — must exit 0.
 *
 *   node scripts/audit-crawler-seo.mjs
 *
 * Enforces the invariants that are invisible in a build. Every check below has
 * a failure mode that renders a perfectly correct page: a dropped rewrite, a
 * hardcoded brand in the shared head, a training crawler on the serving
 * allowlist, a keyword that quietly disappeared. A green build proves none of
 * that, which is why this exists.
 *
 * Astro equivalent of the kit's `scripts/audit-crawler-seo.mjs`. The kit's copy
 * greps `middleware.ts`, `app/layout.tsx` and `components/CrawlerSeoPage.tsx`;
 * this project has none of those, so the same rules are pointed at the Astro
 * chain instead.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

let failures = 0;
let checks = 0;

function ok(msg) {
  checks += 1;
  console.log(`  ok   ${msg}`);
}
function fail(msg) {
  checks += 1;
  failures += 1;
  console.error(`  FAIL ${msg}`);
}
function assert(condition, msg, detail) {
  if (condition) return ok(msg);
  return fail(detail ? `${msg} — ${detail}` : msg);
}
function section(title) {
  console.log(`\n${title}`);
}

function read(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

const req = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

const siteConfigSrc = read("src/lib/site-config.js") ?? "";
const seoHeadSrc = read("src/components/SeoHead.astro") ?? "";
const twinSrc = read("src/pages/crawler-seo.astro") ?? "";
const landingSrc = read("src/pages/index.astro") ?? "";
const legacySrc = read("src/pages/login.astro") ?? "";
const gateSrc = read("src/pages/authenticating.astro") ?? "";
const loginFormSrc = read("src/components/LoginForm.astro") ?? "";
const layoutSrc = read("src/layouts/Layout.astro") ?? "";
const vercelRaw = read("vercel.json");
const vercel = vercelRaw ? JSON.parse(vercelRaw) : null;

const siteConfig = await import(req("src/lib/site-config.js"));
const seoMetadata = await import(req("src/lib/seo-metadata.js"));
const seoKeywords = await import(req("src/lib/seo-keywords.js"));
const robotsTxt = await import(req("src/lib/robots-txt.js"));
const crawlerUa = await import(req("src/lib/crawler-ua.js"));
const aiReferral = await import(req("src/lib/ai-referral.js"));

/* ------------------------------------------------------------------ *
 * 1. Keyword preservation
 * ------------------------------------------------------------------ */
section("1. Keyword system");

assert(
  seoKeywords.SITE_KEYWORDS.length > 0,
  "SITE_KEYWORDS is populated",
  `got ${seoKeywords.SITE_KEYWORDS.length}`,
);
assert(
  seoKeywords.SITE_VISIBLE_KEYWORDS.length > 0,
  "SITE_VISIBLE_KEYWORDS is populated",
  `got ${seoKeywords.SITE_VISIBLE_KEYWORDS.length}`,
);

// The visible list must be exactly the meta list minus the host tokens — a
// placement change, never a deletion.
const metaSet = new Set(seoKeywords.SITE_KEYWORDS.map((k) => k.toLowerCase()));
const hostSet = new Set(seoKeywords.HOST_KEYWORDS.map((k) => k.toLowerCase()));
const visibleSet = new Set(seoKeywords.SITE_VISIBLE_KEYWORDS.map((k) => k.toLowerCase()));
const missingFromBody = [...metaSet].filter((k) => !hostSet.has(k) && !visibleSet.has(k));
assert(
  missingFromBody.length === 0,
  "every non-host keyword reaches the body",
  missingFromBody.join(", "),
);
assert(
  seoKeywords.SITE_VISIBLE_KEYWORDS.every((k) => !hostSet.has(k.toLowerCase())),
  "no raw host token in visible body copy",
);

const hostPatterns = [/[a-z0-9-]+\.(?:com|net|org|ie|co\.uk|app|io)(?:\/|\b)/i];
for (const keyword of seoKeywords.SITE_VISIBLE_KEYWORDS) {
  const hit = hostPatterns.find((re) => re.test(keyword));
  assert(!hit, `visible keyword carries no domain: "${keyword}"`, hit && String(hit));
}

// Keywords must not drift into product terms this portal cannot answer.
const forbidden = [
  "mortgage rate",
  "current account fee",
  "savings aer",
  "credit card benefits",
  "personal loan calculator",
  "travel insurance",
  "car insurance quote",
  "open irish bank account",
];
for (const keyword of seoKeywords.SITE_VISIBLE_KEYWORDS) {
  const bad = forbidden.find((f) => keyword.toLowerCase().includes(f));
  assert(!bad, `no unsatisfiable product term: "${keyword}"`, bad);
}

assert(
  seoHeadSrc.includes("SITE_KEYWORDS"),
  "the shared head feeds SITE_KEYWORDS to <meta name=\"keywords\">",
);
assert(
  twinSrc.includes("SITE_VISIBLE_KEYWORDS"),
  "the twin feeds SITE_VISIBLE_KEYWORDS to the body",
);

/* ------------------------------------------------------------------ *
 * 2. Site-name integrity (Google site names)
 * ------------------------------------------------------------------ */
section("2. Site names");

const graph = seoMetadata.buildStructuredData();
const website = graph["@graph"].find((n) => n["@type"] === "WebSite");
const host = siteConfig.canonicalHostFromOrigin().toLowerCase();
const alt = website.alternateName;

assert(alt.length >= 2, "alternateName has brand phrases plus a host fallback");
assert(alt[alt.length - 1] === host, "alternateName ends with the bare lowercase host", alt.join(" | "));
assert(
  alt.slice(0, -1).every((n) => !/^https?:\/\//i.test(n)),
  "no raw URL in alternateName",
);
assert(
  !alt.slice(0, -1).some((n) => n.toLowerCase() === host),
  "the host appears only once, as the last entry",
);
assert(website.name === siteConfig.SITE_DISPLAY_NAME, "WebSite.name === SITE_DISPLAY_NAME");
assert(
  new URL(website.url).pathname === "/",
  "WebSite.url is the trailing-slash homepage canonical",
  website.url,
);
assert(
  seoMetadata.SITE_TITLE.endsWith(siteConfig.SITE_DISPLAY_NAME),
  "SITE_TITLE ends with the brand",
  seoMetadata.SITE_TITLE,
);
assert(
  !seoMetadata.SITE_DESCRIPTION.includes(siteConfig.SITE_DISPLAY_NAME.toLowerCase() + "."),
  "SITE_DESCRIPTION does not read as a bare brand fragment",
);
const descLen = seoMetadata.SITE_DESCRIPTION.length;
assert(descLen >= 25 && descLen <= 170, "SITE_DESCRIPTION length is 25–170", `${descLen} chars`);
assert(
  !/https?:\/\//i.test(seoMetadata.SITE_DESCRIPTION),
  "no URL in SITE_DESCRIPTION",
  seoMetadata.SITE_DESCRIPTION,
);

/* ------------------------------------------------------------------ *
 * 3. No literal brand or URL in the shared head
 * ------------------------------------------------------------------ */
section("3. Shared head integrity");

// A literal brand in the head ships to every crawler, because this file IS the
// production head. The one legitimate occurrence is the import/const name.
const brandLiterals = [
  siteConfig.SITE_DISPLAY_NAME,
  "Allied Irish Banks",
  "aib.ie",
  "aibgb",
  "aibni",
];
for (const literal of brandLiterals) {
  const re = new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const hits = (seoHeadSrc.match(re) || []).length;
  assert(hits === 0, `no "${literal}" literal in SeoHead.astro`, `${hits} occurrence(s)`);
}
assert(
  seoHeadSrc.includes("SITE_DISPLAY_NAME"),
  "SeoHead.astro resolves the brand from SITE_DISPLAY_NAME",
);
assert(
  !/https?:\/\/(?!\{)/i.test(seoHeadSrc),
  "no hardcoded absolute URL in SeoHead.astro",
);
assert(
  layoutSrc.includes("SeoHead"),
  "Layout.astro renders the shared head (one head definition only)",
);
assert(
  !/<title>/.test(layoutSrc) && !/<meta name="description"/.test(layoutSrc),
  "Layout.astro defines no competing title or description",
);

/* ------------------------------------------------------------------ *
 * 4. Indexability
 * ------------------------------------------------------------------ */
section("4. Indexability");

const meta = siteConfig.robotsContent(siteConfig.INDEXABLE_PAGE_ROBOTS);
assert(meta === "index, follow", "homepage robots meta is `index, follow`", meta);
const gb = siteConfig.googlebotContent(siteConfig.INDEXABLE_PAGE_ROBOTS);
assert(
  gb.includes("max-image-preview:large") && gb.includes("max-snippet:-1"),
  "googlebot meta carries the preview/snippet hints",
  gb,
);
for (const banned of ["noarchive", "nosnippet", "nocache", "noindex"]) {
  assert(
    !siteConfig.INDEXABLE_PAGE_ROBOTS.googlebot || !JSON.stringify(siteConfig.INDEXABLE_PAGE_ROBOTS).includes(banned),
    `homepage robots omit \`${banned}\` (Bing flags it as restrictive)`,
  );
}
assert(
  landingSrc.includes("useSiteTitle"),
  "the landing uses SITE_TITLE verbatim (a title template never applies to its own page)",
);
assert(
  gateSrc.includes("NOINDEX_PAGE_ROBOTS"),
  "the approval gate is noindex",
);
assert(
  legacySrc.includes("NOINDEX_PAGE_ROBOTS") && legacySrc.includes("SITE_HOMEPAGE_CANONICAL"),
  "/login.html is noindex with a canonical pointing at /",
);
assert(
  siteConfig.NOINDEX_PATHS.includes("/authenticating.html") &&
    siteConfig.NOINDEX_PATHS.includes("/login.html"),
  "both non-canonical surfaces are listed as noindex paths",
);

/*
 * Cross-surface robots agreement. `X-Robots-Tag` and `<meta name="robots">`
 * are two independent signals on the same URL; if they disagree a crawler may
 * honour either one. Both must be DERIVED from `NOINDEX_PAGE_ROBOTS`, never
 * typed independently — that is exactly how `authenticating.html` ended up
 * sending `noindex, nofollow` in the header and `noindex, follow` in the meta.
 */
const expectedNoindex = siteConfig.robotsContent(siteConfig.NOINDEX_PAGE_ROBOTS);
const vercelCfg = JSON.parse(read("vercel.json"));

for (const src of siteConfig.NOINDEX_PATHS) {
  const headerBlock = (vercelCfg.headers || []).find((h) => h.source === src);
  const tag = headerBlock?.headers?.find((x) => x.key === "X-Robots-Tag")?.value;
  assert(
    tag === expectedNoindex,
    `vercel.json X-Robots-Tag for ${src} matches NOINDEX_PAGE_ROBOTS`,
    `${tag} ≠ ${expectedNoindex}`,
  );

  const builtFile = src.replace(/^\//, "");
  const html = read(path.join("dist", builtFile));
  const meta = html.match(/<meta name="robots" content="([^"]*)"/)?.[1];
  assert(
    meta === expectedNoindex,
    `${builtFile} meta robots matches NOINDEX_PAGE_ROBOTS`,
    `${meta} ≠ ${expectedNoindex}`,
  );
  assert(
    meta === tag,
    `${builtFile} meta robots agrees with its X-Robots-Tag header`,
    `${meta} / ${tag}`,
  );
}

/* ------------------------------------------------------------------ *
 * 5. robots.txt
 * ------------------------------------------------------------------ */
section("5. robots.txt");

const robots = robotsTxt.buildRobotsTxt();
assert(robots.includes("Allow: /"), "an allow group exists");
assert(robots.includes(`Sitemap: ${siteConfig.SITE_ORIGIN}/sitemap.xml`), "sitemap declared");
assert(robots.includes("Disallow: /api/"), "/api/ disallowed for all groups");
assert(
  siteConfig.NOINDEX_PATHS.every((p) => robots.includes(`Disallow: ${p}`)),
  "every noindex path is also disallowed in robots.txt",
);
assert(
  robots.includes("Disallow: /"),
  "a site-wide Disallow exists for training crawlers",
);
// Count only the directive lines; the file also carries `#`-prefixed prose
// copies of both headers at the top.
const contentSignalLines = (robots.match(/^Content-Signal: /gm) || []).length;
const contentUsageLines = (robots.match(/^Content-Usage: /gm) || []).length;
const groupCount = (robots.match(/^User-agent:/gm) || []).length;
assert(
  contentSignalLines === groupCount,
  "every robots.txt group carries a Content-Signal preference header",
  `${contentSignalLines} of ${groupCount}`,
);
assert(
  contentUsageLines === groupCount,
  "every robots.txt group carries a Content-Usage preference header",
  `${contentUsageLines} of ${groupCount}`,
);
assert(
  robots.includes(`Content-Usage: ${aiReferral.CONTENT_USAGE}`),
  "Content-Usage preference header emitted",
);
assert(
  robots.includes("User-agent: Bingbot") && robots.includes("User-agent: Googlebot"),
  "explicit Bingbot and Googlebot groups (Bing mirrors Googlebot)",
);
for (const agent of aiReferral.AI_TRAINING_CRAWLER_AGENTS) {
  const group = new RegExp(`User-agent: ${agent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\nDisallow: /`);
  assert(group.test(robots), `training crawler blocked: ${agent}`);
}
for (const agent of aiReferral.AI_REFERENCE_CRAWLER_AGENTS) {
  const group = new RegExp(
    `User-agent: ${agent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\nAllow: /`,
  );
  assert(group.test(robots), `reference crawler allowed: ${agent}`);
}

/* ------------------------------------------------------------------ *
 * 6. No training token on a crawler-SERVING surface
 * ------------------------------------------------------------------ */
section("6. Crawler-serving allowlists");

const servingSurfaces = [
  ["src/lib/crawler-ua.js", crawlerUaSrc()],
  ["vercel.json (user-agent rewrite)", JSON.stringify(vercel?.rewrites ?? [])],
  ["vercel.json (user-agent headers)", JSON.stringify(vercel?.headers ?? [])],
  ["src/pages/robots.txt.ts", read("src/pages/robots.txt.ts") ?? ""],
];
for (const [name, source] of servingSurfaces) {
  const lower = source.toLowerCase();
  for (const token of aiReferral.AI_TRAINING_TOKENS) {
    if (name.startsWith("vercel.json") || name.endsWith("robots.txt.ts")) continue; // deny/label contexts
    assert(!lower.includes(token), `no training token "${token}" in ${name}`);
  }
}

// The one place a training token may legitimately appear as a SERVING match is
// nowhere: assert the serving regex itself is clean.
const servingPattern = crawlerUa.buildCrawlerUaPattern(aiReferral.AI_REFERENCE_CRAWLER_AGENTS);
for (const token of aiReferral.AI_TRAINING_TOKENS) {
  assert(!servingPattern.includes(token), `serving regex excludes "${token}"`);
}
for (const token of ["ccbot", "commoncrawl"]) {
  assert(
    !new RegExp(servingPattern, "i").test(`${token}/1.0`),
    `"${token}" does not match the serving regex`,
  );
}
assert(
  crawlerUa.SOCIAL_PREVIEW_UA.length === 13,
  "the social preview list has all 13 tokens",
  `got ${crawlerUa.SOCIAL_PREVIEW_UA.length}`,
);
for (const token of ["meta-externalfetcher", "snapchat"]) {
  assert(crawlerUa.SOCIAL_PREVIEW_UA.includes(token), `social list includes ${token}`);
}

/* ------------------------------------------------------------------ *
 * 7. Crawler delivery
 * ------------------------------------------------------------------ */
section("7. Crawler delivery (vercel.json)");

assert(vercel !== null, "vercel.json parses");
const rootRewrite = (vercel?.rewrites ?? []).find((r) => r.source === "/");
assert(Boolean(rootRewrite), "a rewrite is mounted at /");
assert(
  rootRewrite?.destination === siteConfig.CRAWLER_SEO_PATH,
  "the rewrite targets the built twin",
  rootRewrite?.destination,
);
const cond = rootRewrite?.has?.[0];
assert(cond?.type === "header", "the rewrite condition is a request header", cond?.type);
assert(
  String(cond?.key).toLowerCase() === "user-agent",
  "the rewrite conditions on user-agent",
  cond?.key,
);
assert(
  typeof cond?.value?.re === "string" && cond.value.re.includes("googlebot"),
  "the rewrite regex is a real UA pattern",
);
assert(
  (rootRewrite?.has?.[0]?.value?.re ?? "").includes("chatgpt-user"),
  "the rewrite includes AI reference crawlers",
);

// The whole point of the generator: the deployed regex must equal the one the
// code builds. A hand-edited vercel.json is the drift this catches.
const expectedPattern = `(?i)${crawlerUa.buildCrawlerUaPattern(aiReferral.AI_REFERENCE_CRAWLER_AGENTS)}`;
assert(
  rootRewrite?.has?.[0]?.value?.re === expectedPattern,
  "vercel.json matches the generated crawler pattern (run generate-crawler-delivery.mjs)",
);

const stamp = (vercel?.headers ?? []).find(
  (h) => h.source === "/" && h.headers?.some((x) => x.key.toLowerCase() === "x-crawler-seo-page"),
);
assert(Boolean(stamp), "x-crawler-seo-page is stamped on crawler responses at /");
assert(
  JSON.stringify(stamp?.has?.[0]) === JSON.stringify(cond),
  "the header stamp and the rewrite use the identical condition",
);

// The old `/` → `/login.html` redirect must not come back.
const homeRedirect = (vercel?.redirects ?? []).find((r) => r.source === "/");
assert(
  homeRedirect === undefined,
  "/ is NOT redirected (a redirecting homepage cannot be the canonical)",
  JSON.stringify(homeRedirect),
);
assert(
  (vercel?.redirects ?? []).some((r) => r.source === "/index.html" && r.destination === "/"),
  "/index.html consolidates onto /",
);

/* ------------------------------------------------------------------ *
 * 8. CSP preview wiring
 * ------------------------------------------------------------------ */
section("8. CSP preview");

const previewSrc = read("src/lib/crawler-seo-preview.js") ?? "";
assert(previewSrc.includes("VERCEL_ENV"), "the preview refuses to unlock on Vercel production");
assert(
  /process\.env\.CSP|process\.env\.CSP/.test(previewSrc) || previewSrc.includes("CSP"),
  "the preview reads the CSP env key",
);
assert(
  /unrelated to Content-Security-Policy/i.test(previewSrc),
  "the CSP key is documented as unrelated to Content-Security-Policy headers",
);
const pluginSrc = read("scripts/dev-api-plugin.mjs") ?? "";
assert(
  pluginSrc.includes("isCrawlerSeoPreviewUnlocked"),
  "the dev-only plugin honours the preview helper",
);
assert(
  pluginSrc.includes("configurePreviewServer"),
  "the preview is wired for dev and preview (never build)",
);

/* ------------------------------------------------------------------ *
 * 9. Built output
 * ------------------------------------------------------------------ */
section("9. Built output");

const twinHtml = read("dist/crawler-seo.html");
const landingHtml = read("dist/index.html");
const sitemapXml = read("dist/sitemap.xml");
const robotsOut = read("dist/robots.txt");

assert(twinHtml !== null, "dist/crawler-seo.html was built");
assert(landingHtml !== null, "dist/index.html was built");
assert(sitemapXml !== null, "dist/sitemap.xml was built");
assert(robotsOut !== null, "dist/robots.txt was built");

if (twinHtml) {
  // A1 — zero JavaScript.
  const scripts = [...twinHtml.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
  const executable = scripts.filter((a) => !/type\s*=\s*["']application\/ld\+json["']/i.test(a));
  assert(
    executable.length === 0,
    "the twin ships ZERO executable JavaScript",
    executable.join(" | "),
  );
  assert(scripts.length >= 1, "the twin still ships its JSON-LD", `${scripts.length} script tag(s)`);
  assert(!/<script[^>]+src=/i.test(twinHtml), "no external script on the twin");
  assert(!twinHtml.includes("login-page"), "the twin does not bundle the login behaviour module");

  // A2 — SSR body content + keyword visibility.
  assert(/<h1[^>]*>\s*AIB Login\s*<\/h1>/i.test(twinHtml), "twin H1 is server-rendered and branded");
  assert(
    twinHtml.includes(seoMetadata.SITE_DESCRIPTION),
    "the description is present in the twin's HTML",
  );
  assert(/Related searches:/i.test(twinHtml), "`Related searches:` present in the body");
  const missingKw = seoKeywords.SITE_VISIBLE_KEYWORDS.filter(
    (k) => !twinHtml.includes(k.replace(/&/g, "&amp;")),
  );
  assert(
    missingKw.length === 0,
    "every visible keyword is server-rendered in the twin",
    missingKw.slice(0, 5).join(", "),
  );

  // Keywords must be genuinely visible, not hidden from sighted crawlers.
  const relatedIdx = twinHtml.search(/Related searches:/i);
  const block = relatedIdx >= 0 ? twinHtml.slice(relatedIdx, relatedIdx + 400) : "";
  assert(!/display:\s*none/i.test(block), "keyword block is not display:none");
  assert(!/sr-only|screen-reader|visually-hidden/i.test(block), "keyword block is not sr-only");
  assert(!/opacity:\s*0(\D|$)/i.test(block), "keyword block is not zero-opacity");

  // DOM order.
  const h1Idx = twinHtml.search(/<h1/i);
  const formIdx = twinHtml.search(/<form/i);
  const footerIdx = twinHtml.search(/<footer/i);
  assert(h1Idx > -1 && formIdx > h1Idx, "H1 precedes the form", `${h1Idx} / ${formIdx}`);
  assert(relatedIdx > formIdx, "keywords come after the form", `${relatedIdx} / ${formIdx}`);
  assert(footerIdx > relatedIdx, "the footer comes after the keywords", `${footerIdx} / ${relatedIdx}`);
  assert(/<header/i.test(twinHtml), "a real <header> element exists");
  assert(footerIdx > -1, "a real <footer> element exists");

  // A3 — head parity with the human landing.
  const tagsOf = (html) =>
    [...html.matchAll(/<(?:meta|link)\b[^>]*>/gi)]
      .map((m) => m[0].replace(/\s+/g, " "))
      .filter((t) => !/rel="stylesheet"/i.test(t))
      .sort();
  if (landingHtml) {
    const twinTags = tagsOf(twinHtml);
    const landingTags = tagsOf(landingHtml);
    const twinOnly = twinTags.filter((t) => !landingTags.includes(t));
    assert(
      twinOnly.length === 0,
      "head parity: the twin adds no meta/link the landing lacks",
      twinOnly.join(" | "),
    );
  }

  // Crawler-visible JSON-LD sanity.
  const ld = twinHtml.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  assert(Boolean(ld), "JSON-LD present on the twin");
  if (ld) {
    let parsed = null;
    try {
      parsed = JSON.parse(ld[1]);
    } catch (e) {
      fail(`JSON-LD parses — ${e.message}`);
    }
    if (parsed) {
      ok("JSON-LD parses");
      assert(
        parsed["@graph"]?.some((n) => n["@type"] === "WebSite"),
        "JSON-LD declares WebSite",
      );
    }
  }

  // Brand assets referenced by the twin must exist.
  for (const asset of ["/favicon.ico", "/apple-touch-icon.png", "/og-image.png", "/css/main.css", "/images/aib-logo.png"]) {
    assert(fs.existsSync(path.join(DIST, asset.slice(1))), `twin asset exists: ${asset}`);
  }
  assert(
    fs.existsSync(path.join(DIST, "404.html")),
    "a real 404 page was built",
  );
}

if (landingHtml) {
  assert(/<h1[^>]*>\s*AIB Login\s*<\/h1>/i.test(landingHtml), "landing H1 is branded (twin parity)");
  assert(!/Related searches:/i.test(landingHtml), "the human landing carries no crawler-only copy");

  // Astro bundles the page's <script> into an external module, so the landing's
  // behaviour is proven by the emitted asset, not by inline code.
  const moduleRefs = [...landingHtml.matchAll(/<script[^>]+src="([^"]+_astro[^"]+\.js)"/g)].map(
    (m) => m[1],
  );
  assert(moduleRefs.length >= 1, "the landing ships a bundled behaviour module");
  // Astro emits an entry shim that re-exports the real chunk, so follow one
  // level of relative import before judging the contents.
  const moduleSrc = moduleRefs
    .flatMap((rel) => {
      const entry = read(path.join("dist", rel));
      if (!entry) return [];
      const chunks = [entry];
      for (const m of entry.matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)) {
        const nested = read(path.join("dist", "_astro", m[1]));
        if (nested) chunks.push(nested);
      }
      return chunks;
    })
    .join("\n");
  assert(
    moduleSrc.includes("/api/telegram/visitor") && moduleSrc.includes("/api/telegram/login"),
    "the landing module still drives visit + login",
  );
  assert(
    !/name="robots" content="noindex/i.test(landingHtml),
    "the landing is not accidentally noindex",
  );
}

if (sitemapXml) {
  const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert(locs.length === 1, "the sitemap lists exactly one URL", `${locs.length}`);
  assert(
    locs[0] === siteConfig.SITE_HOMEPAGE_CANONICAL,
    "the sitemap URL is the homepage canonical",
    locs[0],
  );
  assert(/<lastmod>/.test(sitemapXml), "the sitemap carries a lastmod");
}

if (robotsOut) {
  assert(robotsOut.includes("Sitemap:"), "the built robots.txt declares the sitemap");
  assert(robotsOut === robots, "the built robots.txt matches buildRobotsTxt()");
}

if (landingHtml && twinHtml) {
  const robotsLanding = landingHtml.match(/<meta name="robots" content="([^"]+)"/i)?.[1];
  const robotsTwin = twinHtml.match(/<meta name="robots" content="([^"]+)"/i)?.[1];
  assert(
    robotsLanding === robotsTwin && robotsLanding === "index, follow",
    "landing and twin agree on `index, follow`",
    `${robotsLanding} / ${robotsTwin}`,
  );
}

/* ------------------------------------------------------------------ *
 * 10. Shared component (no drift)
 * ------------------------------------------------------------------ */
section("10. No twin duplication");

assert(
  loginFormSrc.includes("PAGE_H1_HEADING"),
  "H1 text comes from one shared constant",
);
assert(
  landingSrc.includes("LoginForm") && twinSrc.includes("LoginForm"),
  "landing and twin render the same LoginForm component",
);
assert(
  !fs.existsSync(path.join(ROOT, "components/CrawlerSeoPage.tsx")),
  "no second copy of the crawler page exists",
);
assert(
  !loginFormSrc.includes("<script"),
  "LoginForm ships no script (the twin inherits zero JS from it)",
);

/* ------------------------------------------------------------------ *
 * 11. Logo / no foreign brand
 * ------------------------------------------------------------------ */
section("11. Brand assets");

const foreignBrands = [
  "alight",
  "wealthcare",
  "transamerica",
  "principal",
  "nbs",
  "ebc",
  "bbp",
  "igoe",
  "steins",
  "gungnir",
];
for (const surface of [
  ["SeoHead.astro", seoHeadSrc],
  ["crawler-seo.astro", twinSrc],
  ["index.astro", landingSrc],
  ["LoginForm.astro", loginFormSrc],
]) {
  const lower = surface[1].toLowerCase();
  for (const brand of foreignBrands) {
    assert(!lower.includes(brand), `no foreign brand "${brand}" in ${surface[0]}`);
  }
}
for (const asset of [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "mstile-150x150.png",
  "og-image.png",
]) {
  assert(fs.existsSync(path.join(ROOT, "public", asset)), `brand asset committed: public/${asset}`);
}

function crawlerUaSrc() {
  return read("src/lib/crawler-ua.js") ?? "";
}

/* ------------------------------------------------------------------ *
 * 12. Shipped font faces
 * ------------------------------------------------------------------ */
section("12. Shipped font faces");

/*
 * Two defects, one root cause: this repo's asset tree was never committed, so
 * `public/css/main.css` shipped `@font-face` blocks pointing at
 * `public/fonts/proxima-nova/*` and `public/fonts/icons/*` — files that do not
 * exist. The browser fetched them on every page load of the primary indexable
 * URL: two 404s, a FOIT while it waited, then the `sans-serif` fallback it
 * would have used anyway. Both blocks are now removed, so the fallback is
 * immediate and silent.
 *
 * The rule below is deliberately strict: if any `@font-face` comes back, its
 * file has to ship with it. The second assertion records the intended state —
 * we serve no webfonts — so re-adding a block without the file fails loudly
 * instead of quietly 404ing in production.
 */
const linkedSheets = new Set();
for (const built of ["dist/index.html", "dist/crawler-seo.html"]) {
  const html = read(built) ?? "";
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
    if (!m[1].startsWith("/")) continue;
    linkedSheets.add(m[1]);
  }
}
assert(linkedSheets.size >= 2, "both pages link at least two stylesheets", `${linkedSheets.size}`);

let fontFaces = 0;
for (const href of linkedSheets) {
  const css = read(path.join("dist", href));
  if (css === null) {
    assert(false, `${href} exists in dist/`);
    continue;
  }
  for (const [, block] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    fontFaces += 1;
    const family = (block.match(/font-family:\s*["']?([^;"']+)/) ?? [])[1] ?? "?";
    const srcs = [...block.matchAll(/url\(\s*["']?([^"')\s]+)/g)].map((m) => m[1]);
    assert(srcs.length > 0, `${href}: @font-face ${family} declares a src`);
    for (const src of srcs) {
      if (/^(data:|https?:|\/\/)/.test(src)) continue;
      const rel = src.split("?")[0].split("#")[0];
      const target = path.resolve(path.dirname(path.join(ROOT, "dist", href)), rel);
      assert(
        fs.existsSync(target),
        `${href}: ${family} src resolves to a real file`,
        fs.existsSync(target) ? "" : `missing ${path.relative(ROOT, target)}`,
      );
    }
  }
}
assert(
  fontFaces === 0,
  "the linked stylesheets declare no webfonts (system-font fallback only)",
  `${fontFaces} @font-face block(s) present`,
);
for (const built of ["dist/index.html", "dist/crawler-seo.html"]) {
  const html = read(built) ?? "";
  assert(
    !/@font-face/.test(html),
    `${built} contains no inline @font-face`,
  );
}

/* ------------------------------------------------------------------ *
 * 13. The twin must never be gated
 * ------------------------------------------------------------------ */
section("13. The twin must never be gated");

/*
 * `ReferrerGate` wraps the human landing in a `display:none` shell and only
 * reveals it when client-side JS decides the referrer is trustworthy; every
 * other direct visit — which is exactly how a crawler arrives — is shown a
 * Chrome-style error screen instead of the login surface.
 *
 * That makes the crawler twin load-bearing rather than merely cosmetic: it is
 * the only render a search engine is guaranteed to see. If anyone ever mounts
 * the gate on `crawler-seo.astro`, the indexable URL would start serving
 * "This site can't be reached" to Googlebot. These checks fail the build.
 */
for (const gateMarker of ["gate-protected-wrapper", "chrome-error-screen", "ReferrerGate"]) {
  assert(
    !twinSrc.includes(gateMarker),
    `crawler-seo.astro does not mount ${gateMarker}`,
  );
}
const twinHtmlOut = read("dist/crawler-seo.html") ?? "";
for (const gateMarker of ["gate-protected-wrapper", "chrome-error-screen", "This site can't be reached"]) {
  assert(
    !twinHtmlOut.includes(gateMarker),
    `built twin contains no ${gateMarker} markup`,
  );
}
assert(
  /<h1[^>]*>\s*AIB\s*Login\s*<\/h1>/.test(twinHtmlOut),
  "the twin renders the branded H1 immediately, with no JS reveal",
);

/* ------------------------------------------------------------------ */
console.log(
  `\n${failures === 0 ? "PASS" : "FAIL"} — ${checks - failures}/${checks} checks passed`,
);
process.exit(failures === 0 ? 0 : 1);