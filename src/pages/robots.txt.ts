export const prerender = true;

import { buildRobotsTxt } from "../lib/robots-txt.js";

/**
 * `/robots.txt` — search and AI-reference crawlers are allowed; AI training
 * crawlers are blocked site-wide.
 *
 * Emitted by hand rather than through a metadata helper because the policy
 * needs the `Content-Signal` and `Content-Usage` preference headers, which no
 * structured robots API can express. The body itself is built in
 * `src/lib/robots-txt.js` so the audit verifies the same function that ships.
 */
export function GET() {
  return new Response(buildRobotsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}