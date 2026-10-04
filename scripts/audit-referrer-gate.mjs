#!/usr/bin/env node
/**
 * Audit ReferrerProvider for the reload bypass bug (same-origin referrer grant).
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

const rp = readIfExists(["ReffererProvider.tsx", "src/ReffererProvider.tsx"])
if (!rp) {
  failures.push("missing ReffererProvider.tsx")
} else {
  const text = rp.text

  if (/\bisFromSameOrigin\b/.test(text)) {
    failures.push("ReffererProvider uses isFromSameOrigin (reload bypass risk)")
  }
  if (/\binternalReferrer\b/.test(text)) {
    failures.push("ReffererProvider uses internalReferrer (reload bypass risk)")
  }
  if (/\(allowedReferrer\s*\|\|\s*internalReferrer\)/.test(text)) {
    failures.push("canGrantEntryAccess allows internalReferrer (reload bypass)")
  }

  const sessionIdx = text.indexOf("hasSessionAccess")
  const referrerGrantIdx = text.indexOf("isFromAllowedSource(referrer)")
  if (sessionIdx === -1) {
    failures.push("missing hasSessionAccess session check")
  } else if (referrerGrantIdx === -1) {
    failures.push("missing isFromAllowedSource(referrer) check")
  } else if (sessionIdx > referrerGrantIdx) {
    failures.push("session check must run before isFromAllowedSource(referrer) (reload bug)")
  }

  if (!text.includes('geoAccess ?? "unknown"')) {
    failures.push('ReffererProvider missing geoAccess ?? "unknown" fallback')
  }

  if (!/referrerOrigin\s*===\s*pageOrigin/.test(text)) {
    failures.push("isFromAllowedSource missing same-origin referrer reject")
  }

  if (!/ACCESS_GRANTED_SESSION_KEY/.test(text)) {
    failures.push("missing ACCESS_GRANTED_SESSION_KEY")
  }
}

if (failures.length) {
  console.error(`FAIL ${path.basename(root)} (referrer gate)`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(`OK ${path.basename(root)} (referrer gate — no reload bypass patterns)`)
