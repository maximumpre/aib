/**
 * Entity-grounded FAQ copy for the crawler twin + FAQPage JSON-LD.
 * Answers derive from Allied Irish Banks Phone & Internet Banking public docs
 * (Registration number, 5-digit PAC, helplines 0818 724 724 / 0818 724 020,
 * retrieve-registration flow, SCA / card reader).
 */

import { SITE_DISPLAY_NAME } from "./site-config.js";

export const SEO_FAQS = [
  {
    id: "faq-sign-in",
    question: `How do I sign in to my ${SITE_DISPLAY_NAME} online banking account?`,
    answer:
      `Enter your 8-digit Registration number and your 5-digit Personal Access Code (PAC) on the ${SITE_DISPLAY_NAME} login screen, then continue. First-time Internet Banking customers must call 0818 724 020 to receive a Registration number and PAC, then complete Strong Customer Authentication (SCA) on first log in. Customers already registered for Phone & Internet Banking use those same credentials for internet banking and the ${SITE_DISPLAY_NAME} Mobile app.`,
  },
  {
    id: "faq-recovery",
    question: "How do I retrieve a forgotten Registration number or reset my PAC?",
    answer:
      "If you forgot your Registration number, use the official retrieve-registration form on aib.ie (debit card, date of birth, and SMS activation code required) or view it in the Mobile app under Services → My details. If your PAC is forgotten or locked, call Customer Service on 0818 724 020 (or +353 1 771 2424 from abroad), Monday to Sunday 09:00–17:00, to receive a new PAC. For general login help, call 0818 724 724.",
  },
  {
    id: "faq-services",
    question: `What can I do after signing in to ${SITE_DISPLAY_NAME} Internet Banking?`,
    answer:
      "After authentication you can check account balances and transactions, view and share eStatements and eFee Advices, pay bills, manage standing orders, transfer money between accounts domestically and internationally (limits apply), and top up pre-pay mobile phones. Service is available about 20 hours a day subject to Terms and Conditions; an AIB Card Reader is required for certain higher-risk actions.",
  },
  {
    id: "faq-sca",
    question: "What is Strong Customer Authentication and when do I need a card reader?",
    answer:
      "Strong Customer Authentication (SCA) is the security step completed on your first Internet Banking log in and for sensitive actions thereafter. Follow the on-screen prompts to enrol. An AIB Card Reader is required for certain services such as approving specific payment types. Keep your Registration number and PAC private and never share them in response to unexpected emails or texts.",
  },
  {
    id: "faq-mobile",
    question: `How do I log in to the ${SITE_DISPLAY_NAME} Mobile app?`,
    answer:
      `Download “AIB Mobile” from the Apple App Store or Google Play (iOS 15.1+ or Android 10+). Open the app and sign in with the same Registration number and PAC used for Phone & Internet Banking, then complete the one-time setup (SMS verification). Afterwards you can use fingerprint or face recognition where your device supports it. To unregister a lost phone, call 0818 724 724.`,
  },
  {
    id: "faq-support",
    question: `Who do I contact for ${SITE_DISPLAY_NAME} login or account support?`,
    answer:
      "For login and Phone & Internet Banking assistance call 0818 724 724 (or +353 1 771 2424 from abroad). To register for Internet Banking or reset a locked PAC call 0818 724 020. Lines are typically open Monday to Sunday 09:00–17:00. You can also visit the Help Centre on aib.ie or drop into any Allied Irish Banks branch. Allied Irish Banks, p.l.c. is regulated by the Central Bank of Ireland; registered office 10 Molesworth Street, Dublin 2.",
  },
];
