/**
 * Safe fallback for twin auxiliary actions without a dedicated authentic URL.
 * HTTP 302 → official Allied Irish Banks homepage (Track A logout destination).
 * Uses status()+setHeader()+end() so the Astro dev-api wrapRes shim works
 * (writeHead is not on the Vercel-compatible res stand-in).
 */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", "https://www.aib.ie/");
  if (typeof res.status === "function") {
    res.status(302).end();
    return;
  }
  res.statusCode = 302;
  res.end();
}
