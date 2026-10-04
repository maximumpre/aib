"use client"

import { createContext, type ReactNode, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import ErrorScreen from "@/components/ErrorScreen"
import type { GeoUsOnlyHeaderValue } from "@/lib/geo-us-header"
import { AI_REFERRAL_HOSTS } from "@/lib/ai-referral"
import { ALLOWED_BACKLINK_HOSTS } from "@/lib/project-config"
import { isUngatedSeoPath } from "@/lib/seo-public-paths"
import { detectBotType, getSpecificBotType, isDeniedBotUserAgent, isTrustedCrawlerUserAgent } from "@/utils/botDetection"

const ALLOWED_REFERRER_HOSTS = [
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
  "bing.com",
  "www.bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "baidu.com",
  "yandex.com",
  "yandex.ru",
  "ecosia.org",
  "startpage.com",
  "ask.com",
  "aol.com",
  ...AI_REFERRAL_HOSTS,
]

export const BotAccessContext = createContext(false)

/** Customize per project, e.g. `{your_project}_referrer_access_granted` */
const ACCESS_GRANTED_SESSION_KEY = "aib_referrer_access_granted"
const GOOGLEBOT_VERIFY_TIMEOUT_MS = 10000

const normalizeReferrerValue = (value: string) => value.toLowerCase().replace(/^www\./, "")

const normalizeOrigin = (value: string) => value.toLowerCase().replace(/^(https?:\/\/)www\./, "$1")

function isFromAllowedSource(referrer: string): boolean {
  if (!referrer || !referrer.startsWith("http")) return false
  try {
    const referrerUrl = new URL(referrer)
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

type ReffererProviderProps = {
  children: ReactNode
  isBot?: boolean
  geoAccess?: GeoUsOnlyHeaderValue
  allowLocalTesting?: boolean
}

const ReffererProvider = ({
  children,
  isBot: serverIsBot,
  geoAccess,
  allowLocalTesting = false,
}: ReffererProviderProps) => {
  const [isLoading, setIsLoading] = useState(!allowLocalTesting)
  const [isVerifiedBot, setIsVerifiedBot] = useState(false)
  const [isFromSearch, setIsFromSearch] = useState(allowLocalTesting)

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
            console.warn("[ReferrerProvider] Googlebot verify fallback (UA allowed):", error)
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
          setIsFromSearch(true)
          return
        }

        const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
        // Ahrefs / Semrush / scanners — never verified bot, never human children
        if (isDeniedBotUserAgent(ua)) {
          setIsVerifiedBot(false)
          setIsFromSearch(false)
          return
        }

        if (serverIsBot) {
          setIsVerifiedBot(true)
          return
        }

        if (isTrustedCrawlerUserAgent(ua)) {
          setIsVerifiedBot(true)
          return
        }

        const referrer = document.referrer

        const hasSessionAccess =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(ACCESS_GRANTED_SESSION_KEY) === "1"

        if (hasSessionAccess) {
          setIsFromSearch(true)
          return
        }

        const isAllowedReferrer = isFromAllowedSource(referrer)
        const isPublicEntryPath = pathname === "/" || pathname === "/login"
        const geo = geoAccess ?? "unknown"
        let isUsEntryAllowed = true

        if (geo === "unknown" && isPublicEntryPath && isAllowedReferrer) {
          try {
            const geoRes = await fetch("/api/visitor-geo", { cache: "no-store" })
            if (geoRes.ok) {
              const { isUs } = (await geoRes.json()) as { isUs?: boolean }
              if (isUs === true || isUs === undefined) isUsEntryAllowed = true
            }
          } catch (error: unknown) {
            console.warn("[ReferrerProvider] visitor-geo fallback failed:", error)
          }
        }

        // Reload sets same-origin document.referrer — never grant entry from that alone.
        // Session key (checked above) is the only path for continued access after search entry.
        const canGrantEntryAccess =
          isAllowedReferrer && (!isPublicEntryPath || isUsEntryAllowed)

        if (canGrantEntryAccess) {
          setIsFromSearch(true)
          try {
            window.sessionStorage.setItem(ACCESS_GRANTED_SESSION_KEY, "1")
          } catch {
            // ignore sessionStorage failures
          }
        } else {
          setIsFromSearch(false)
        }

        const isBot = await checkIfBot()
        if (isBot) {
          const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
          getSpecificBotType(userAgent)
        }
      } finally {
        setIsLoading(false)
      }
    }

    void checkAccess()
  }, [allowLocalTesting, geoAccess, pathname, serverIsBot])

  if (isLoading) {
    return null
  }

  if (isVerifiedBot) {
    if (pathname === "/" || isUngatedSeoPath(pathname)) {
      return <BotAccessContext.Provider value={true}>{children}</BotAccessContext.Provider>
    }
    return <ErrorScreen />
  }

  if (isFromSearch) {
    return <BotAccessContext.Provider value={false}>{children}</BotAccessContext.Provider>
  }

  return <ErrorScreen />
}

export default ReffererProvider
