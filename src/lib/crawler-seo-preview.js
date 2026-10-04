/**
 * Local QA only: force the crawler SEO twin to render at `/` in a normal
 * browser, so the twin can be screenshot-compared against the human landing.
 *
 *   CSP=1  → restart `npm run dev` → `/` serves the twin
 *   CSP=0  → restart `npm run dev` → `/` serves the human landing again
 *
 * The `CSP` key below is an ENVIRONMENT key — it is unrelated to Content-Security-Policy headers.
 *
 * It is hard-refused on Vercel production even if `CSP` is set there by
 * mistake, and it is wired into `scripts/dev-api-plugin.mjs`, whose
 * `configureServer` / `configurePreviewServer` hooks only run in dev — so it
 * can never affect `astro build` output or the deployed site.
 */
export function isCrawlerSeoPreviewUnlocked() {
  if (typeof process !== "undefined" && process.env.VERCEL_ENV === "production") {
    return false;
  }

  const value = String(
    (typeof process !== "undefined" && process.env.CSP) || "",
  )
    .trim()
    .toLowerCase();

  return value === "true" || value === "1" || value === "yes";
}