import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enAuth from "./locales/en/auth.json";
import enSettings from "./locales/en/settings.json";
import enPricing from "./locales/en/pricing.json";
import enStore from "./locales/en/store.json";
import enFooter from "./locales/en/footer.json";
import enErrors from "./locales/en/errors.json";
import enStatus from "./locales/en/status.json";
import enAnalytics from "./locales/en/analytics.json";
import enWelcome from "./locales/en/welcome.json";
import enMeta from "./locales/en/meta.json";

import huCommon from "./locales/hu/common.json";
import huNav from "./locales/hu/nav.json";
import huAuth from "./locales/hu/auth.json";
import huSettings from "./locales/hu/settings.json";
import huPricing from "./locales/hu/pricing.json";
import huStore from "./locales/hu/store.json";
import huFooter from "./locales/hu/footer.json";
import huErrors from "./locales/hu/errors.json";
import huStatus from "./locales/hu/status.json";
import huAnalytics from "./locales/hu/analytics.json";
import huWelcome from "./locales/hu/welcome.json";
import huMeta from "./locales/hu/meta.json";

export const supportedLanguages = [
  { code: "en", label: "English", flag: "GB" },
  { code: "hu", label: "Magyar", flag: "HU" },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]["code"];

const supportedLanguageCodes = supportedLanguages.map(({ code }) => code) as SupportedLanguage[];

export function resolveSupportedLanguage(language?: string | null): SupportedLanguage {
  const normalized = language?.trim().toLowerCase().split("-")[0];
  return supportedLanguageCodes.find((code) => code === normalized) ?? "en";
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        nav: enNav,
        auth: enAuth,
        settings: enSettings,
        pricing: enPricing,
        store: enStore,
        footer: enFooter,
        errors: enErrors,
        status: enStatus,
        analytics: enAnalytics,
        welcome: enWelcome,
        meta: enMeta,
      },
      hu: {
        common: huCommon,
        nav: huNav,
        auth: huAuth,
        settings: huSettings,
        pricing: huPricing,
        store: huStore,
        footer: huFooter,
        errors: huErrors,
        status: huStatus,
        analytics: huAnalytics,
        welcome: huWelcome,
        meta: huMeta,
      },
    },
    fallbackLng: "en",
    supportedLngs: supportedLanguageCodes,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    cleanCode: true,
    defaultNS: "common",
    ns: [
      "common",
      "nav",
      "auth",
      "settings",
      "pricing",
      "store",
      "footer",
      "errors",
      "status",
      "analytics",
      "welcome",
      "meta",
    ],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "spike-lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
