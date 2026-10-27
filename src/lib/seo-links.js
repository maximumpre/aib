/**
 * Authentic AIB banking-portal destinations for twin link reconciliation.
 * Track A logout / approve destination: https://www.aib.ie/
 * Resolved from public AIB pages (Akamai blocks automated HTML harvest).
 */

export const AIB_AUTHENTIC_ORIGIN = "https://www.aib.ie";

/** Final post-approval / logout destination used by authenticating.astro. */
export const LOGOUT_DESTINATION = `${AIB_AUTHENTIC_ORIGIN}/`;

export const TWIN_LINKS = {
  home: "/",
  terms: `${AIB_AUTHENTIC_ORIGIN}/`,
  help: `${AIB_AUTHENTIC_ORIGIN}/help-centre`,
  privacy: `${AIB_AUTHENTIC_ORIGIN}/Privacy-Statement`,
  dataProtection: `${AIB_AUTHENTIC_ORIGIN}/dataprotection`,
  internetBanking: `${AIB_AUTHENTIC_ORIGIN}/ways-to-bank/internet-banking`,
  retrieveRegistration: `${AIB_AUTHENTIC_ORIGIN}/ways-to-bank/retrieve-registration-number`,
  mobileBanking: `${AIB_AUTHENTIC_ORIGIN}/ways-to-bank/mobile-banking`,
  appStore: "https://apps.apple.com/ie/app/aib-mobile/id468042881",
  playStore: "https://play.google.com/store/apps/details?id=aib.ibank.android",
  troubleLoggingIn: `${AIB_AUTHENTIC_ORIGIN}/ways-to-bank/retrieve-registration-number`,
  contactTel: "tel:0818724724",
  /** Safe fallback for unhandled auxiliary actions (Astro serverless). */
  loginOut: "/api/login-out",
};
