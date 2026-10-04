export const prerender = true;

import { SITE_CONTENT_UPDATED_AT, SITE_HOMEPAGE_CANONICAL } from "../lib/site-config.js";

/**
 * `/sitemap.xml` — exactly ONE url.
 *
 * The homepage is the only page intended for search indexing; the approval
 * gate and the legacy `/login.html` are `noindex` and would only compete with
 * the canonical. Listing a second URL here is how a sitemap starts ranking a
 * page against itself.
 *
 * `lastmod` comes from `SITE_CONTENT_UPDATED_AT`, bumped whenever the homepage
 * SEO copy changes — a stale date weakens the re-crawl signal it exists for.
 */
export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_HOMEPAGE_CANONICAL}</loc>
    <lastmod>${SITE_CONTENT_UPDATED_AT}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}