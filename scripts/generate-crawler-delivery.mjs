/**
 * Generates `vercel.json` — the crawler delivery split and the canonical
 * redirects — from `src/lib/crawler-ua.js`, so the deployed config can never
 * drift from the allowlist the code and the audit both read.
 *
 *   node scripts/generate-crawler-delivery.mjs          # write vercel.json
 *   node scripts/generate-crawler-delivery.mjs --check  # exit 1 if stale
 *
 * WHY A GENERATOR. This project is a static Astro site: there is no server
 * middleware to branch on `User-Agent` the way a Next.js host would. The
 * delivery split is therefore expressed as a Vercel rewrite conditioned on the
 * request `user-agent` header. Writing that regex by hand in `vercel.json`
 * would create a second copy of the allowlist — the exact drift the audit is
 * supposed to prevent.
 *
 * `has.type` accepts only `header` | `cookie` | `host` | `query`; there is no
 * dedicated `user-agent` type, so `{"type":"header","key":"user-agent"}` is
 * used deliberately.
 *
 * CAVEAT: Vercel does not evaluate `has` under `vercel dev` — it works only
 * when deployed. Verify the split locally with `CSP=1`
 * (`src/lib/crawler-seo-preview.js`), which forces the twin at `/`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCrawlerUaPattern } from "../src/lib/crawler-ua.js";
import { AI_REFERENCE_CRAWLER_AGENTS } from "../src/lib/ai-referral.js";
import {
  CRAWLER_SEO_PATH,
  NOINDEX_PATHS,
  NOINDEX_PAGE_ROBOTS,
  robotsContent,
} from "../src/lib/site-config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "vercel.json");

const UA_PATTERN = buildCrawlerUaPattern(AI_REFERENCE_CRAWLER_AGENTS);

/** One condition object, reused so the rewrite and the header stamp cannot differ. */
function crawlerUaCondition() {
  return [
    {
      type: "header",
      key: "user-agent",
      value: { re: `(?i)${UA_PATTERN}` },
    },
  ];
}

function buildConfig() {
  return {
    $schema: "https://openapi.vercel.sh/vercel.json",

    /*
     * Canonicalisation. `/` is the real, indexable landing; `/index.html` is
     * the file backing it and must not become a second indexable URL. The
     * `/` → `/login.html` redirect that used to live here is gone on purpose:
     * a redirecting homepage is the worst thing you can hand a crawler.
     */
    redirects: [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/login", destination: "/", permanent: true },
    ],

    /*
     * Allowlisted crawlers get the zero-JS twin at `/`, without the URL
     * changing. Humans fall through to the filesystem and get `index.html`.
     */
    rewrites: [
      {
        source: "/",
        destination: CRAWLER_SEO_PATH,
        has: crawlerUaCondition(),
      },
    ],

    headers: [
      /*
       * Proof-of-delivery stamp. The Next.js kit sets `x-crawler-seo-page`
       * in middleware and the audit asserts it is never dropped while cloning
       * headers; the static equivalent is an edge header under the same
       * condition, which is what you check after deploying.
       */
      {
        source: "/",
        has: crawlerUaCondition(),
        headers: [{ key: "x-crawler-seo-page", value: "1" }],
      },
      {
        source: CRAWLER_SEO_PATH,
        headers: [{ key: "x-crawler-seo-page", value: "1" }],
      },

      /*
       * Belt-and-braces for the non-indexable surfaces. They already send
       * `noindex` in a meta tag; `X-Robots-Tag` is what a crawler that does
       * not parse HTML will honour.
       *
       * The value is DERIVED from `NOINDEX_PAGE_ROBOTS` rather than typed
       * twice: a header that says `nofollow` while the meta says `follow` is
       * two conflicting signals, and a crawler is free to pick either.
       */
      ...NOINDEX_PATHS.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: robotsContent(NOINDEX_PAGE_ROBOTS) }],
      })),
    ],
  };
}

const next = `${JSON.stringify(buildConfig(), null, 2)}\n`;
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;

if (process.argv.includes("--check")) {
  if (current !== next) {
    console.error(
      "[crawler-delivery] vercel.json is stale — run `node scripts/generate-crawler-delivery.mjs`",
    );
    process.exit(1);
  }
  console.log("[crawler-delivery] vercel.json is up to date");
} else {
  fs.writeFileSync(OUT, next);
  console.log(`[crawler-delivery] wrote vercel.json (${UA_PATTERN.split("|").length} crawler tokens)`);
}