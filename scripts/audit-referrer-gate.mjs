#!/usr/bin/env node
/**
 * Audit the live Astro referrer gate for the reload bypass bug
 * (same-origin referrer grant). Pure-Astro projects use
 * `src/components/ReferrerGate.astro` — never a Next Hybrid SteinsGate.tsx.
 *
 * Usage: node scripts/audit-referrer-gate.mjs [project-root]
 * Exit 1 if any check fails.
 */

import fs from "node:fs"
import path from "node:path"

const root = path.resolve(process.argv[2] ?? process.cwd())

function readIfExists(relPaths) {
  for (const rel of relPaths) {
    const full = path.join(root, rel)
    if (fs.existsSync(full)) return { rel, text: fs.readFileSync(full, "utf8") }
  }
  return null
}

const failures = []

// Next Hybrid leftover must not reappear in a pure-Astro project.
for (const dead of ["SteinsGate.tsx", "src/SteinsGate.tsx", "middleware.ts", "src/middleware.ts", "proxy.ts", "src/proxy.ts"]) {
  if (fs.existsSync(path.join(root, dead))) {
    failures.push(`Next Hybrid leftover present: ${dead} (pure Astro uses ReferrerGate.astro + vercel.json UA rewrite)`)
  }
}

const gate = readIfExists([
  "src/components/ReferrerGate.astro",
  "components/ReferrerGate.astro",
])
if (!gate) {
  failures.push("missing src/components/ReferrerGate.astro")
} else {
  const text = gate.text

  if (/\bisFromSameOrigin\b/.test(text)) {
    failures.push("ReferrerGate uses isFromSameOrigin (reload bypass risk)")
  }
  if (/\binternalReferrer\b/.test(text)) {
    failures.push("ReferrerGate uses internalReferrer (reload bypass risk)")
  }
  if (/\(allowedReferrer\s*\|\|\s*internalReferrer\)/.test(text)) {
    failures.push("canGrantEntryAccess allows internalReferrer (reload bypass)")
  }

  const sessionIdx = text.search(/sessionStorage\.getItem\(\s*SESSION_KEY\s*\)/)
  const referrerGrantIdx = text.search(/document\.referrer|isFromAllowedSource\s*\(\s*referrer/)
  if (sessionIdx === -1) {
    failures.push("missing sessionStorage session check (SESSION_KEY)")
  } else if (referrerGrantIdx === -1) {
    failures.push("missing document.referrer / allowed-source check")
  } else if (sessionIdx > referrerGrantIdx) {
    failures.push("session check must run before referrer grant (reload bug)")
  }

  if (!/refOrigin\s*===\s*pageOrigin/.test(text) && !/referrerOrigin\s*===\s*pageOrigin/.test(text)) {
    failures.push("ReferrerGate missing same-origin referrer reject")
  }

  if (!/SESSION_KEY\s*=\s*["'][^"']+["']/.test(text) && !/ACCESS_GRANTED_SESSION_KEY/.test(text)) {
    failures.push("missing ACCESS_GRANTED / SESSION_KEY constant")
  }

  // Geo must fail closed (deny on error), not open.
  if (/visitor-geo/.test(text) && !/\.catch\s*\(/.test(text)) {
    failures.push("visitor-geo path missing .catch fail-closed handler")
  }
}

const indexPage = readIfExists(["src/pages/index.astro", "pages/index.astro"])
if (!indexPage) {
  failures.push("missing src/pages/index.astro")
} else if (!/ReferrerGate/.test(indexPage.text)) {
  failures.push("index.astro does not mount ReferrerGate")
}

const twinPage = readIfExists(["src/pages/crawler-seo.astro", "pages/crawler-seo.astro"])
if (twinPage && /ReferrerGate/.test(twinPage.text)) {
  failures.push("crawler-seo.astro must NEVER mount ReferrerGate")
}

if (failures.length) {
  console.error(`FAIL ${path.basename(root)} (referrer gate)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)} (referrer gate — Astro ReferrerGate, no reload bypass)`)
