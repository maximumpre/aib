/**
 * Dev-only adapter that runs the real Vercel `api/` handlers inside
 * `astro dev` / `astro preview`.
 *
 * `astro dev` is a Vite server — it has no idea the `api/` directory exists,
 * so `POST /api/tasks` 404'd and the login page showed "Unable to reach
 * verification". Vite also served `api/tasks/index.js` as a static asset,
 * which made `GET /api/tasks` look healthy while returning raw source.
 *
 * `configureServer` / `configurePreviewServer` only run in dev, so
 * `astro build` output and the deployed Vercel functions are untouched.
 *
 * The same hooks also host the `CSP` crawler-twin preview (see
 * `crawlerSeoPreview` below) for the same reason.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CRAWLER_SEO_PATH } from "../src/lib/site-config.js";
import { isCrawlerSeoPreviewUnlocked } from "../src/lib/crawler-seo-preview.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROUTES = [
  { re: /^\/api\/visitor-geo\/?$/, mod: "api/visitor-geo.js" },
  { re: /^\/api\/tasks$/, mod: "api/tasks/index.js" },
  { re: /^\/api\/tasks\/([^/]+)\/?$/, mod: "api/tasks/[id].js", params: ["id"] },
  { re: /^\/api\/telegram\/login\/?$/, mod: "api/telegram/login.js" },
  { re: /^\/api\/telegram\/visitor\/?$/, mod: "api/telegram/visitor.js" },
  { re: /^\/api\/telegram\/webhook\/?$/, mod: "api/telegram/webhook.js" },
];

// Astro exposes .env files as import.meta.env to client-facing code, but these
// handlers read process.env directly. Load .env.local without logging values.
let envLoaded = false;
function loadEnv() {
  if (envLoaded) return;
  envLoaded = true;
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value && !(m[1] in process.env)) process.env[m[1]] = value;
  }
}

const cache = new Map();

// Node's ESM cache is keyed by file URL and lives for the whole process.
// Busting the query on a route module re-imports *that* module only — its
// imports (api/_telegram.js, api/_messages.js, api/_db.js) still resolve to
// their original (now stale) instances, and `server.restart()` does not help
// because it stays in the same process. So we detect a changed helper and
// say so instead of silently serving old code.
function apiJsFiles() {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && p.endsWith(".js")) out.push(p);
    }
  };
  walk(path.join(ROOT, "api"));
  return out;
}

function snapshotApi() {
  const m = new Map();
  for (const f of apiJsFiles()) m.set(f, fs.statSync(f).mtimeMs);
  return m;
}

function changedHelpers(prev, curr, entryFile) {
  const out = [];
  for (const [f, m] of curr) {
    if (f === entryFile) continue;
    if (prev.get(f) !== m) out.push(path.relative(ROOT, f));
  }
  for (const f of prev.keys()) if (!curr.has(f)) out.push(path.relative(ROOT, f));
  return out;
}

async function loadHandler(rel) {
  const file = path.join(ROOT, rel);
  const mtime = fs.statSync(file).mtimeMs;
  const hit = cache.get(rel);
  if (hit && hit.mtime === mtime) {
    // The route file itself is unchanged, so the handler we hold is current
    // for its own code — but a helper it imports may have moved on.
    const now = snapshotApi();
    const changed = changedHelpers(hit.snap, now, file);
    if (changed.length) {
      console.warn(
        "[dev-api] " + changed.join(", ") + " changed. Node's ESM cache is per-process, " +
          "so the running dev server still has the old copy — run `npm run dev` again to load it.",
      );
      hit.snap = now;
    }
    return hit.handler;
  }
  // Re-import so edits to the route file itself are picked up without a restart.
  const handler = (await import(pathToFileURL(file).href + "?t=" + mtime)).default;
  cache.set(rel, { mtime, snap: snapshotApi(), handler });
  return handler;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Minimal stand-in for the Vercel Node `res` the handlers were written against. */
function wrapRes(res) {
  const api = {
    _code: 200,
    setHeader(k, v) {
      try {
        res.setHeader(k, v);
      } catch {
        /* headers already sent */
      }
      return api;
    },
    status(code) {
      api._code = code;
      return api;
    },
    json(obj) {
      const body = JSON.stringify(obj);
      res.statusCode = api._code;
      try {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Length", Buffer.byteLength(body));
      } catch {
        /* ignore */
      }
      res.end(body);
      return api;
    },
    end() {
      res.statusCode = api._code;
      res.end();
      return api;
    },
  };
  return api;
}

async function dispatch(req, res) {
  const raw = req.url || "/";
  const pathname = raw.split("?")[0];

  let match = null;
  for (const route of ROUTES) {
    const m = pathname.match(route.re);
    if (m) {
      match = { route, groups: m };
      break;
    }
  }
  if (!match) return false;

  loadEnv();

  const handler = await loadHandler(match.route.mod);

  const query = Object.fromEntries(
    new URLSearchParams(raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : ""),
  );
  (match.route.params || []).forEach((name, i) => {
    query[name] = decodeURIComponent(match.groups[i + 1]);
  });
  req.query = query;

  if (req.body === undefined) {
    const buf = await readBody(req);
    if (buf.length) {
      const type = String(req.headers["content-type"] || "");
      if (type.includes("application/json")) {
        try {
          req.body = JSON.parse(buf.toString("utf8"));
        } catch {
          req.body = {};
        }
      } else {
        req.body = buf.toString("utf8");
      }
    } else {
      req.body = {};
    }
  }

  await handler(req, wrapRes(res));
  return true;
}

function attach(server) {
  loadEnv();
  server.middlewares.use((req, res, next) => {
    if (!String(req.url || "").startsWith("/api/")) return next();
    dispatch(req, res).catch((err) => {
      console.error("[dev-api]", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "dev api error" }));
      }
    });
  });
}

/*
 * CSP preview — local QA only.
 *
 * `CSP=1` in `.env.local` makes `/` serve the crawler twin in a NORMAL browser,
 * so the twin can be screenshot-compared against the human landing at desktop
 * and mobile widths. `CSP=0` (or unset) restores the landing after a restart.
 *
 * It lives here because this is the only dev/preview-only hook in the project:
 * `configureServer` / `configurePreviewServer` never run during `astro build`,
 * so the preview can never leak into the built output or a deployment. It is
 * also hard-refused on Vercel production (see `crawler-seo-preview.js`).
 *
 * This mirrors what the `vercel.json` rewrite does in production — same twin,
 * same URL — which `vercel dev` cannot demonstrate because Vercel does not
 * evaluate `has` conditions locally.
 *
 * Verified through `npm run dev`. NOTE: in Astro 7 `astro preview` runs as a
 * detached daemon whose `configurePreviewServer` hook does not run, so the
 * preview is a `dev`-only affordance (the `api/` adapter has the same
 * limitation — see the README changelog for 2026-10-02).
 */
const LANDING_ENTRIES = new Set(["/", "/index.html"]);

function crawlerSeoPreview() {
  return {
    name: "aib:crawler-seo-preview",
    configureServer: (server) =>
      attachCrawlerSeoPreview(server, { twinPath: "/crawler-seo" }),
    configurePreviewServer: (server) =>
      attachCrawlerSeoPreview(server, { twinPath: CRAWLER_SEO_PATH }),
  };
}

function attachCrawlerSeoPreview(server, { twinPath }) {
  loadEnv();
  server.middlewares.use((req, res, next) => {
    const raw = String(req.url || "/");
    const pathname = raw.split("?")[0];
    if (!LANDING_ENTRIES.has(pathname)) return next();
    if (!isCrawlerSeoPreviewUnlocked()) return next();

    const url = new URL(raw, "http://localhost");
    req.url = twinPath + url.search;
    res.setHeader("x-crawler-seo-page", "1");
    next();
  });
}

export function devApi() {
  return [crawlerSeoPreview(), apiAdapter()];
}

function apiAdapter() {
  return {
    name: "aib:dev-api",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export { dispatch, attach };
