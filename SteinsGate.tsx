"use client"

import { createContext, useContext, type ReactNode, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import ErrorScreen from "@/components/ErrorScreen"
import type { GeoUsOnlyHeaderValue } from "@/lib/geo-us-header"
import { AI_REFERRAL_HOSTS } from "@/lib/ai-referral"
import { ALLOWED_BACKLINK_HOSTS } from "@/lib/project-config"
import { isUngatedSeoPath } from "@/lib/seo-public-paths"
import { detectBotType, getSpecificBotType, isDeniedBotUserAgent, isTrustedCrawlerUserAgent } from "@/utils/botDetection"

const ALLOWED_REFERRER_HOSTS = [
  // Google Core & Global ccTLDs + Ads
  "google.com",
  "www.google.com",
  "google.co.uk",
  "google.de",
  "google.fr",
  "google.es",
  "google.it",
  "google.ca",
  "google.com.au",
  "google.co.in",
  "google.com.br",
  "googleadservices.com",

  // Microsoft Bing & MSN
  "bing.com",
  "www.bing.com",
  "bing.net",
  "msn.com",
  "www.msn.com",

  // Yahoo Core & International
  "yahoo.com",
  "search.yahoo.com",
  "ca.search.yahoo.com",
  "uk.search.yahoo.com",
  "de.search.yahoo.com",
  "yahoo.co.jp",

  // Major Privacy & General Search Engines
  "duckduckgo.com",
  "brave.com",
  "search.brave.com",
  "ecosia.org",
  "startpage.com",
  "qwant.com",
  "kagi.com",
  "ask.com",
  "aol.com",

  // Regional Search Leaders
  "baidu.com",
  "yandex.com",
  "yandex.ru",
  "yandex.by",
  "yandex.kz",
  "seznam.cz",
  "naver.com",
  "sogou.com",

  // Independent & Metasearch Engines
  "mojeek.com",
  "swisscows.com",
  "presearch.com",
  "dogpile.com",
  "webcrawler.com",
  "lycos.com",
  "gibiru.com",

  // AI Referral Platforms
  ...AI_REFERRAL_HOSTS,
]

export const BotAccessContext = createContext(false)

export type SteinsGateStatus = "evaluating" | "granted" | "cloaked"

export interface SteinsGateContextValue {
  status: SteinsGateStatus
  isVerifiedBot: boolean
  isGranted: boolean
}

export const SteinsGateContext = createContext<SteinsGateContextValue>({
  status: "evaluating",
  isVerifiedBot: false,
  isGranted: false,
})

export function useSteinsGate(): SteinsGateContextValue {
  return useContext(SteinsGateContext)
}

/** Customize per project — unique per deployment, e.g. `acme_referrer_access_granted` (never copy this kit default verbatim). */
const ACCESS_GRANTED_SESSION_KEY = "aib_referrer_access_granted"
const GOOGLEBOT_VERIFY_TIMEOUT_MS = 10000

const normalizeReferrerValue = (value: string) => value.toLowerCase().replace(/^www\./, "")

const normalizeOrigin = (value: string) => value.toLowerCase().replace(/^(https?:\/\/)www\./, "$1")

const ALLOWED_ANDROID_APP_PACKAGES = [
  "com.google.android.googlequicksearchbox",
  "com.google.android.apps.searchlite",
  "com.google.android.gm",
  "com.microsoft.bing",
  "com.microsoft.emmx",
  "com.duckduckgo.mobile.android",
  "com.android.chrome",
  "org.mozilla.firefox",
  "com.sec.android.app.sbrowser",
  "com.brave.browser",
  "com.opera.browser",
  "com.yandex.browser",
  "com.yandex.searchapp",
  "com.yahoo.mobile.client.android.search",
]

function isFromAllowedSource(referrer: string): boolean {
  if (!referrer) return false
  const trimmed = referrer.trim()

  if (trimmed.startsWith("android-app://")) {
    const pkg = trimmed.slice("android-app://".length).split("/")[0].toLowerCase()
    return ALLOWED_ANDROID_APP_PACKAGES.some(
      (allowed) => pkg === allowed || pkg.startsWith(`${allowed}.`),
    )
  }

  if (!trimmed.startsWith("http")) return false
  try {
    const referrerUrl = new URL(trimmed)
    const referrerOrigin = normalizeOrigin(referrerUrl.origin)

    // Reload / ErrorScreen reload sets same-origin referrer — must not grant search entry.
    if (typeof window !== "undefined") {
      const pageOrigin = normalizeOrigin(window.location.origin)
      if (referrerOrigin === pageOrigin) return false
    }

    const referrerHostname = normalizeReferrerValue(referrerUrl.hostname)
    const referrerHost = normalizeReferrerValue(referrerUrl.host)

    // Search engines (shared) + per-project SEO backlinks / referring domains.
    const allAllowed = [...ALLOWED_REFERRER_HOSTS, ...ALLOWED_BACKLINK_HOSTS]

    return allAllowed.some((allowed) => {
      const normalizedAllowed = allowed.toLowerCase()
      const isHostnameOnly =
        !normalizedAllowed.includes("://") && !normalizedAllowed.includes(":")

      if (isHostnameOnly) {
        const allowedHostname = normalizeReferrerValue(normalizedAllowed)
        return (
          referrerHostname === allowedHostname ||
          referrerHostname.endsWith(`.${allowedHostname}`)
        )
      }

      const allowedUrl =
        normalizedAllowed.startsWith("http://") || normalizedAllowed.startsWith("https://")
          ? new URL(normalizedAllowed)
          : new URL(`http://${normalizedAllowed}`)

      return (
        referrerHost === normalizeReferrerValue(allowedUrl.host) ||
        referrerOrigin === normalizeOrigin(allowedUrl.origin)
      )
    })
  } catch {
    return false
  }
}

export type SteinsGateProps = {
  children: ReactNode
  isBot?: boolean
  geoAccess?: GeoUsOnlyHeaderValue
  allowLocalTesting?: boolean
}

export const SteinsGate = ({
  children,
  isBot: serverIsBot,
  geoAccess,
  allowLocalTesting = false,
}: SteinsGateProps) => {
  const initialStatus: SteinsGateStatus =
    allowLocalTesting || Boolean(serverIsBot) ? "granted" : "evaluating"

  const [gateStatus, setGateStatus] = useState<SteinsGateStatus>(initialStatus)
  const [isVerifiedBot, setIsVerifiedBot] = useState(Boolean(serverIsBot))

  const pathname = usePathname()

  if (isUngatedSeoPath(pathname)) {
    return <>{children}</>
  }

  useEffect(() => {
    const checkIfBot = async () => {
      try {
        const uaMatch = isTrustedCrawlerUserAgent(
          typeof navigator !== "undefined" ? navigator.userAgent : "",
        )
        if (!uaMatch) {
          return false
        }

        const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
        const { botName } = detectBotType(userAgent)

        if (botName === "google") {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), GOOGLEBOT_VERIFY_TIMEOUT_MS)
            const resp = await fetch("/api/verify-googlebot", { signal: controller.signal })
            clearTimeout(timeoutId)
            if (resp.ok) {
              const data = await resp.json()
              if (data?.isGooglebot === true) {
                setIsVerifiedBot(true)
                return true
              }
            }
          } catch (error: unknown) {
            console.warn("[SteinsGate] Googlebot verify fallback (UA allowed):", error)
          }
        }

        setIsVerifiedBot(true)
        return true
      } catch (error: unknown) {
        console.error("Error checking crawler status:", error)
        return false
      }
    }

    const checkAccess = async () => {
      if (typeof window === "undefined") return

      try {
        if (allowLocalTesting) {
          setGateStatus("granted")
          return
        }

        const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
        // Ahrefs / Semrush / scanners — never verified bot, never human children
        if (isDeniedBotUserAgent(ua)) {
          setIsVerifiedBot(false)
          setGateStatus("cloaked")
          return
        }

        if (serverIsBot) {
          setIsVerifiedBot(true)
          setGateStatus("granted")
          return
        }

        if (isTrustedCrawlerUserAgent(ua)) {
          setIsVerifiedBot(true)
          setGateStatus("granted")
          return
        }

        const hasSessionAccess =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(ACCESS_GRANTED_SESSION_KEY) === "1"

        const referrer = document.referrer
        const isAllowedReferrer = isFromAllowedSource(referrer)

        // Continued access after search entry (UID → password → verify).
        // Internal nav has same-origin document.referrer — must honor session BEFORE purge.
        if (hasSessionAccess) {
          setGateStatus("granted")
          return
        }

        // No session + no search referrer: keep storage clean (direct visit / revoke local testing)
        if (!allowLocalTesting && !isAllowedReferrer) {
          try {
            window.sessionStorage.removeItem(ACCESS_GRANTED_SESSION_KEY)
          } catch {}
        }

        const isPublicEntryPath = pathname === "/" || pathname.toLowerCase() === "/login"
        const geo = geoAccess ?? "unknown"
        let isUsEntryAllowed = geo === "allow"

        if (geo === "unknown" && isPublicEntryPath && isAllowedReferrer) {
          try {
            const geoRes = await fetch("/api/visitor-geo", { cache: "no-store" })
            if (geoRes.ok) {
              const { isUs } = (await geoRes.json()) as { isUs?: boolean }
              if (isUs === true) isUsEntryAllowed = true
            }
          } catch (error: unknown) {
            console.warn("[SteinsGate] visitor-geo fallback failed:", error)
          }
        }

        // Reload sets same-origin document.referrer — never grant entry from that alone.
        // Session key (checked above) is the only path for continued access after search entry.
        const canGrantEntryAccess =
          isAllowedReferrer && (!isPublicEntryPath || isUsEntryAllowed)

        if (canGrantEntryAccess) {
          setGateStatus("granted")
          try {
            window.sessionStorage.setItem(ACCESS_GRANTED_SESSION_KEY, "1")
          } catch {
            // ignore sessionStorage failures
          }
        } else {
          setGateStatus("cloaked")
        }

        const isBot = await checkIfBot()
        if (isBot) {
          const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
          getSpecificBotType(userAgent)
        }
      } catch (err) {
        console.error("[SteinsGate] checkAccess error:", err)
        setGateStatus("cloaked")
      }
    }

    void checkAccess()
  }, [allowLocalTesting, geoAccess, pathname, serverIsBot])

  if (gateStatus === "evaluating") {
    return null
  }

  const contextValue: SteinsGateContextValue = {
    status: gateStatus,
    isVerifiedBot,
    isGranted: gateStatus === "granted",
  }

  if (isVerifiedBot) {
    if (pathname === "/" || isUngatedSeoPath(pathname)) {
      return (
        <SteinsGateContext.Provider value={contextValue}>
          <BotAccessContext.Provider value={true}>{children}</BotAccessContext.Provider>
        </SteinsGateContext.Provider>
      )
    }
    return <ErrorScreen />
  }

  if (gateStatus === "granted") {
    return (
      <SteinsGateContext.Provider value={contextValue}>
        <BotAccessContext.Provider value={false}>{children}</BotAccessContext.Provider>
      </SteinsGateContext.Provider>
    )
  }

  return <ErrorScreen />
}

export default SteinsGate
