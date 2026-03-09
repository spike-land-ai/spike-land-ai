import { Hono, type Context } from "hono";
import type { Env } from "../../core-logic/env.js";

const iwd = new Hono<{ Bindings: Env }>();

const IWD_COOKIE = "iwd_visitor";
const IWD_MESSAGE_COOLDOWN_MS = 15_000;
const IWD_MESSAGE_MAX_LENGTH = 140;
const IWD_INTRO_REVEAL_LIMIT = 8;

const ALLOWED_EMOJIS = ["🌸", "💜", "✨", "🫶", "🌍", "💪", "🚀", "🎉", "🌈", "👩‍💻"] as const;

type AllowedEmoji = (typeof ALLOWED_EMOJIS)[number];

interface GreetingInfo {
  locale: string;
  languageLabel: string;
  greeting: string;
}

interface VisitorRow {
  id: string;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  locale: string | null;
  greeting: string | null;
  language_label: string | null;
  created_at: number;
}

interface IwdVisitor {
  id: string;
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  locale: string;
  greeting: string;
  languageLabel: string;
  createdAt: number;
}

interface MessageRow {
  id: string;
  visitor_id: string;
  text: string;
  emoji_json: string;
  country: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  locale: string | null;
  greeting: string | null;
  image_prompt: string | null;
  image_job_id: string | null;
  image_url: string | null;
  image_status: string;
  error_message: string | null;
  created_at: number;
  updated_at: number;
}

interface IwdMessage {
  id: string;
  visitorId: string;
  text: string;
  emojis: AllowedEmoji[];
  country: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  locale: string;
  greeting: string;
  imagePrompt: string | null;
  imageJobId: string | null;
  imageUrl: string | null;
  imageStatus: string;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

interface LeaderboardRow {
  country: string | null;
  count: number;
}

interface CountryStat {
  country: string;
  count: number;
  locale: string;
  languageLabel: string;
  greeting: string;
}

interface FeedPayload {
  visitors: IwdVisitor[];
  messages: IwdMessage[];
  leaderboard: CountryStat[];
  totalVisitors: number;
  serverTime: number;
}

interface ToolTextPart {
  type: string;
  text?: string;
}

interface ToolCallResult {
  content?: ToolTextPart[];
  isError?: boolean;
}

interface ToolApiResponse {
  result?: ToolCallResult;
}

const GREETINGS: Record<string, GreetingInfo> = {
  am: { locale: "am", languageLabel: "አማርኛ", greeting: "መልካም አለም አቀፍ የሴቶች ቀን" },
  ar: { locale: "ar", languageLabel: "العربية", greeting: "يوم عالمي سعيد للمرأة" },
  bg: { locale: "bg", languageLabel: "Български", greeting: "Честит международен ден на жената" },
  bn: { locale: "bn", languageLabel: "বাংলা", greeting: "আন্তর্জাতিক নারী দিবসের শুভেচ্ছা" },
  cs: { locale: "cs", languageLabel: "Čeština", greeting: "Šťastný Mezinárodní den žen" },
  da: { locale: "da", languageLabel: "Dansk", greeting: "Glædelig international kvindedag" },
  de: { locale: "de", languageLabel: "Deutsch", greeting: "Frohen Internationalen Frauentag" },
  el: {
    locale: "el",
    languageLabel: "Ελληνικά",
    greeting: "Χρόνια πολλά για την Παγκόσμια Ημέρα της Γυναίκας",
  },
  en: { locale: "en", languageLabel: "English", greeting: "Happy International Women's Day" },
  es: { locale: "es", languageLabel: "Español", greeting: "Feliz Día Internacional de la Mujer" },
  et: { locale: "et", languageLabel: "Eesti", greeting: "Head rahvusvahelist naistepäeva" },
  fa: { locale: "fa", languageLabel: "فارسی", greeting: "روز جهانی زن مبارک" },
  fi: { locale: "fi", languageLabel: "Suomi", greeting: "Hyvää kansainvälistä naistenpäivää" },
  fr: {
    locale: "fr",
    languageLabel: "Français",
    greeting: "Joyeuse Journée internationale des femmes",
  },
  he: { locale: "he", languageLabel: "עברית", greeting: "יום האישה הבינלאומי שמח" },
  hi: { locale: "hi", languageLabel: "हिन्दी", greeting: "अंतरराष्ट्रीय महिला दिवस की शुभकामनाएं" },
  hr: { locale: "hr", languageLabel: "Hrvatski", greeting: "Sretan Međunarodni dan žena" },
  hu: { locale: "hu", languageLabel: "Magyar", greeting: "Boldog nemzetközi nőnapot" },
  id: {
    locale: "id",
    languageLabel: "Bahasa Indonesia",
    greeting: "Selamat Hari Perempuan Internasional",
  },
  it: {
    locale: "it",
    languageLabel: "Italiano",
    greeting: "Buona Giornata internazionale della donna",
  },
  ja: { locale: "ja", languageLabel: "日本語", greeting: "国際女性デーおめでとうございます" },
  ko: { locale: "ko", languageLabel: "한국어", greeting: "행복한 세계 여성의 날 되세요" },
  lt: { locale: "lt", languageLabel: "Lietuvių", greeting: "Su Tarptautine moters diena" },
  lv: {
    locale: "lv",
    languageLabel: "Latviešu",
    greeting: "Priecīgu Starptautisko sieviešu dienu",
  },
  ms: {
    locale: "ms",
    languageLabel: "Bahasa Melayu",
    greeting: "Selamat Hari Wanita Antarabangsa",
  },
  nl: { locale: "nl", languageLabel: "Nederlands", greeting: "Fijne Internationale Vrouwendag" },
  no: {
    locale: "no",
    languageLabel: "Norsk",
    greeting: "Gratulerer med den internasjonale kvinnedagen",
  },
  pl: {
    locale: "pl",
    languageLabel: "Polski",
    greeting: "Szczęśliwego Międzynarodowego Dnia Kobiet",
  },
  pt: { locale: "pt", languageLabel: "Português", greeting: "Feliz Dia Internacional da Mulher" },
  ro: {
    locale: "ro",
    languageLabel: "Română",
    greeting: "La mulți ani de Ziua Internațională a Femeii",
  },
  ru: { locale: "ru", languageLabel: "Русский", greeting: "С Международным женским днём" },
  sk: { locale: "sk", languageLabel: "Slovenčina", greeting: "Šťastný Medzinárodný deň žien" },
  sl: { locale: "sl", languageLabel: "Slovenščina", greeting: "Vesel mednarodni dan žena" },
  sr: { locale: "sr", languageLabel: "Српски", greeting: "Срећан Међународни дан жена" },
  sv: { locale: "sv", languageLabel: "Svenska", greeting: "Glad internationella kvinnodagen" },
  sw: {
    locale: "sw",
    languageLabel: "Kiswahili",
    greeting: "Heri ya Siku ya Kimataifa ya Wanawake",
  },
  th: { locale: "th", languageLabel: "ไทย", greeting: "สุขสันต์วันสตรีสากล" },
  tr: { locale: "tr", languageLabel: "Türkçe", greeting: "Dünya Kadınlar Günü kutlu olsun" },
  uk: { locale: "uk", languageLabel: "Українська", greeting: "З Міжнародним жіночим днем" },
  ur: { locale: "ur", languageLabel: "اردو", greeting: "خواتین کا عالمی دن مبارک" },
  vi: { locale: "vi", languageLabel: "Tiếng Việt", greeting: "Chúc mừng Ngày Quốc tế Phụ nữ" },
  zh: { locale: "zh", languageLabel: "中文", greeting: "国际妇女节快乐" },
};

const COUNTRY_TO_LOCALE: Record<string, string> = {
  AE: "ar",
  AR: "es",
  AT: "de",
  AU: "en",
  BD: "bn",
  BE: "fr",
  BG: "bg",
  BR: "pt",
  CA: "en",
  CH: "de",
  CL: "es",
  CN: "zh",
  CO: "es",
  CZ: "cs",
  DE: "de",
  DK: "da",
  EG: "ar",
  ES: "es",
  ET: "am",
  FI: "fi",
  FR: "fr",
  GB: "en",
  GR: "el",
  HK: "zh",
  HR: "hr",
  HU: "hu",
  ID: "id",
  IE: "en",
  IL: "he",
  IN: "hi",
  IR: "fa",
  IT: "it",
  JP: "ja",
  KE: "sw",
  KR: "ko",
  LT: "lt",
  LV: "lv",
  MX: "es",
  MY: "ms",
  NG: "en",
  NL: "nl",
  NO: "no",
  NZ: "en",
  PE: "es",
  PH: "en",
  PK: "ur",
  PL: "pl",
  PT: "pt",
  RO: "ro",
  RS: "sr",
  RU: "ru",
  SA: "ar",
  SE: "sv",
  SG: "en",
  SI: "sl",
  SK: "sk",
  TH: "th",
  TR: "tr",
  TW: "zh",
  UA: "uk",
  US: "en",
  VN: "vi",
  ZA: "en",
};

const DEV_FALLBACK_LOCATIONS = [
  { latitude: 51.5074, longitude: -0.1278, city: "London", country: "GB" },
  { latitude: 40.7128, longitude: -74.006, city: "New York", country: "US" },
  { latitude: -23.5505, longitude: -46.6333, city: "Sao Paulo", country: "BR" },
  { latitude: 19.4326, longitude: -99.1332, city: "Mexico City", country: "MX" },
  { latitude: 52.52, longitude: 13.405, city: "Berlin", country: "DE" },
  { latitude: 35.6762, longitude: 139.6503, city: "Tokyo", country: "JP" },
  { latitude: 28.6139, longitude: 77.209, city: "New Delhi", country: "IN" },
  { latitude: -1.2921, longitude: 36.8219, city: "Nairobi", country: "KE" },
  { latitude: -33.8688, longitude: 151.2093, city: "Sydney", country: "AU" },
  { latitude: 6.5244, longitude: 3.3792, city: "Lagos", country: "NG" },
] as const;

function todayStartMs(date = new Date()): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCookies(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(";").reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

function serializeCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=86400; Path=/; SameSite=Lax; Secure`;
}

function normalizeLanguageTag(tag: string): string[] {
  const lower = tag.trim().toLowerCase();
  if (!lower) return [];
  const parts = lower.split("-");
  const candidates = [lower];
  if (parts.length > 1) {
    candidates.push(parts[0]!);
  }
  return candidates;
}

function resolveGreeting(
  acceptLanguage: string | null | undefined,
  countryCode?: string | null,
): GreetingInfo {
  const languageCandidates = (acceptLanguage ?? "")
    .split(",")
    .map((part) => part.split(";")[0]?.trim() ?? "")
    .flatMap((part) => normalizeLanguageTag(part));

  const countryLocale = countryCode ? COUNTRY_TO_LOCALE[countryCode.toUpperCase()] : undefined;
  if (countryLocale) {
    languageCandidates.push(countryLocale);
  }
  languageCandidates.push("en");

  for (const candidate of languageCandidates) {
    if (GREETINGS[candidate]) {
      return GREETINGS[candidate];
    }
  }

  return GREETINGS.en;
}

function greetingForCountry(countryCode: string | null | undefined): GreetingInfo {
  if (!countryCode) return GREETINGS.en;
  const locale = COUNTRY_TO_LOCALE[countryCode.toUpperCase()];
  return (locale && GREETINGS[locale]) || GREETINGS.en;
}

function normalizeVisitor(row: Record<string, unknown>): IwdVisitor {
  const fallbackGreeting = greetingForCountry(typeof row.country === "string" ? row.country : null);
  return {
    id: String(row.id),
    latitude: numberValue(row.latitude),
    longitude: numberValue(row.longitude),
    city: typeof row.city === "string" ? row.city : null,
    country: typeof row.country === "string" ? row.country : null,
    locale: typeof row.locale === "string" && row.locale ? row.locale : fallbackGreeting.locale,
    greeting:
      typeof row.greeting === "string" && row.greeting ? row.greeting : fallbackGreeting.greeting,
    languageLabel:
      typeof row.language_label === "string" && row.language_label
        ? row.language_label
        : fallbackGreeting.languageLabel,
    createdAt: numberValue(row.created_at),
  };
}

function parseEmojiJson(value: string | null | undefined): AllowedEmoji[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AllowedEmoji =>
        typeof item === "string" && (ALLOWED_EMOJIS as readonly string[]).includes(item),
    );
  } catch {
    return [];
  }
}

function normalizeMessage(row: Record<string, unknown>): IwdMessage {
  const fallbackGreeting = greetingForCountry(typeof row.country === "string" ? row.country : null);
  return {
    id: String(row.id),
    visitorId: String(row.visitor_id),
    text: typeof row.text === "string" ? row.text : "",
    emojis: parseEmojiJson(typeof row.emoji_json === "string" ? row.emoji_json : "[]"),
    country: typeof row.country === "string" ? row.country : null,
    city: typeof row.city === "string" ? row.city : null,
    latitude: numberValue(row.latitude),
    longitude: numberValue(row.longitude),
    locale: typeof row.locale === "string" && row.locale ? row.locale : fallbackGreeting.locale,
    greeting:
      typeof row.greeting === "string" && row.greeting ? row.greeting : fallbackGreeting.greeting,
    imagePrompt: typeof row.image_prompt === "string" ? row.image_prompt : null,
    imageJobId: typeof row.image_job_id === "string" ? row.image_job_id : null,
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    imageStatus: typeof row.image_status === "string" ? row.image_status : "PROCESSING",
    errorMessage: typeof row.error_message === "string" ? row.error_message : null,
    createdAt: numberValue(row.created_at),
    updatedAt: numberValue(row.updated_at),
  };
}

async function findTodayVisitor(db: D1Database, visitorId: string): Promise<VisitorRow | null> {
  return db
    .prepare(
      "SELECT id, latitude, longitude, city, country, locale, greeting, language_label, created_at FROM iwd_visitors WHERE id = ? AND created_at >= ?",
    )
    .bind(visitorId, todayStartMs())
    .first<VisitorRow>();
}

async function loadFeed(db: D1Database, since?: number): Promise<FeedPayload> {
  const dayStart = todayStartMs();
  const visitorSince = since && since > 0 ? since : dayStart;
  const messageSince = since && since > 0 ? since : dayStart;

  const visitorsPromise = db
    .prepare(
      "SELECT id, latitude, longitude, city, country, locale, greeting, language_label, created_at FROM iwd_visitors WHERE created_at >= ? ORDER BY created_at ASC",
    )
    .bind(visitorSince)
    .all<Record<string, unknown>>();

  const messagesPromise = db
    .prepare(
      "SELECT id, visitor_id, text, emoji_json, country, city, latitude, longitude, locale, greeting, image_prompt, image_job_id, image_url, image_status, error_message, created_at, updated_at FROM iwd_messages WHERE created_at >= ? AND updated_at >= ? ORDER BY updated_at ASC",
    )
    .bind(dayStart, messageSince)
    .all<Record<string, unknown>>();

  const leaderboardPromise = db
    .prepare(
      "SELECT country, COUNT(*) AS count FROM iwd_visitors WHERE created_at >= ? AND country IS NOT NULL GROUP BY country ORDER BY count DESC, country ASC LIMIT 12",
    )
    .bind(dayStart)
    .all<LeaderboardRow>();

  const totalVisitorsPromise = db
    .prepare("SELECT COUNT(*) AS count FROM iwd_visitors WHERE created_at >= ?")
    .bind(dayStart)
    .first<{ count: number | string }>();

  const [visitors, messages, leaderboardRows, totalVisitorsRow] = await Promise.all([
    visitorsPromise,
    messagesPromise,
    leaderboardPromise,
    totalVisitorsPromise,
  ]);

  return {
    visitors: visitors.results.map(normalizeVisitor),
    messages: messages.results.map(normalizeMessage),
    leaderboard: leaderboardRows.results
      .filter((row): row is LeaderboardRow & { country: string } => typeof row.country === "string")
      .map((row) => {
        const greeting = greetingForCountry(row.country);
        return {
          country: row.country,
          count: numberValue(row.count),
          locale: greeting.locale,
          languageLabel: greeting.languageLabel,
          greeting: greeting.greeting,
        };
      }),
    totalVisitors: numberValue(totalVisitorsRow?.count),
    serverTime: Date.now(),
  };
}

function sanitizeMessageText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, IWD_MESSAGE_MAX_LENGTH);
}

function sanitizeEmojis(value: unknown): AllowedEmoji[] {
  if (!Array.isArray(value)) return [];
  const next = value.filter(
    (item): item is AllowedEmoji =>
      typeof item === "string" && (ALLOWED_EMOJIS as readonly string[]).includes(item),
  );
  return Array.from(new Set(next)).slice(0, 3);
}

function emojiPromptHints(emojis: AllowedEmoji[]): string[] {
  return emojis.map((emoji) => {
    switch (emoji) {
      case "🌸":
        return "spring blossoms and soft floral motion";
      case "💜":
        return "warm violet light and glowing amethyst accents";
      case "✨":
        return "spark trails and luminous dust";
      case "🫶":
        return "gestures of care, solidarity, and support";
      case "🌍":
        return "global connection and a gently glowing world";
      case "💪":
        return "strength, resilience, and pride";
      case "🚀":
        return "future energy and lift-off momentum";
      case "🎉":
        return "confetti, streamers, and joyful movement";
      case "🌈":
        return "multi-color light and optimistic skies";
      case "👩‍💻":
        return "women building technology, code, and ideas";
      default:
        return "joyful celebratory details";
    }
  });
}

function buildImagePrompt(message: IwdMessage): string {
  const locationBits = [message.city, message.country].filter(Boolean);
  const moodBits = emojiPromptHints(message.emojis);
  const messageText = message.text ? `"${message.text}"` : "an unspoken message of celebration";

  return [
    "Create an uplifting square celebration artwork for International Women's Day 2026.",
    "Make it feel human, joyful, festive, modern, premium, and globally welcoming.",
    "Center women with agency, warmth, solidarity, creativity, leadership, and momentum.",
    `Use ${messageText} as the emotional anchor.`,
    moodBits.length > 0 ? `Visual motifs: ${moodBits.join(", ")}.` : "",
    locationBits.length > 0 ? `Subtle atmosphere inspired by ${locationBits.join(", ")}.` : "",
    `Greeting language inspiration: ${message.greeting}.`,
    "Rich color, expressive composition, confetti energy, optimistic light, and no sadness.",
    "No typography, no captions, no logos, no watermark, no border, no UI, no protest signs.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function callImageStudioTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch("https://image-studio-mcp.spike.land/api/tool", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Image Studio returned ${response.status}`);
  }

  const payload = (await response.json()) as ToolApiResponse;
  const text = payload.result?.content
    ?.map((item) => (typeof item.text === "string" ? item.text : ""))
    .join("\n")
    .trim();

  if (payload.result?.isError) {
    throw new Error(text || "Image Studio returned an error");
  }
  if (!text) {
    throw new Error("Image Studio returned an empty payload");
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON payload";
    throw new Error(`Image Studio payload parse failed: ${message}`);
  }
}

async function generateArtwork(env: Env, message: IwdMessage): Promise<void> {
  const prompt = buildImagePrompt(message);

  try {
    const job = await callImageStudioTool<{ jobId?: string }>("generate", {
      prompt,
      aspect_ratio: "1:1",
      tier: "TIER_0_5K",
      resolution: "0.5K",
      model_preference: "latest",
      num_images: 1,
    });

    if (!job.jobId) {
      throw new Error("Generation job id missing");
    }

    let outputUrl: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const status = await callImageStudioTool<{
        outputUrl?: string;
        status?: string;
        error?: string;
      }>("job_status", {
        job_id: job.jobId,
        job_type: "generation",
      });

      if (status.outputUrl) {
        outputUrl = status.outputUrl;
        break;
      }

      if (status.status === "FAILED") {
        throw new Error(status.error || "Image generation failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 900));
    }

    if (!outputUrl) {
      throw new Error("Image generation did not finish in time");
    }

    await env.DB.prepare(
      "UPDATE iwd_messages SET image_prompt = ?, image_job_id = ?, image_url = ?, image_status = 'COMPLETED', error_message = NULL, updated_at = ? WHERE id = ?",
    )
      .bind(prompt, job.jobId, outputUrl, Date.now(), message.id)
      .run();
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Image generation failed";
    try {
      await env.DB.prepare(
        "UPDATE iwd_messages SET image_prompt = ?, image_status = 'FAILED', error_message = ?, updated_at = ? WHERE id = ?",
      )
        .bind(prompt, messageText, Date.now(), message.id)
        .run();
    } catch (dbError) {
      console.error("Fallback DB write failed:", dbError);
    }
  }
}

function noStoreHeaders(headers: Headers): Headers {
  headers.set("Cache-Control", "no-store");
  return headers;
}

function festiveSvgBackground(): string {
  return `
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#240d3d" />
      <stop offset="45%" stop-color="#8f2da7" />
      <stop offset="100%" stop-color="#ff7b76" />
    </linearGradient>
    <radialGradient id="glowA" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffe083" stop-opacity="0.96" />
      <stop offset="100%" stop-color="#ffe083" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowB" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7df1ca" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#7df1ca" stop-opacity="0" />
    </radialGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="24" />
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <circle cx="250" cy="130" r="180" fill="url(#glowA)" filter="url(#blur)" />
  <circle cx="980" cy="180" r="170" fill="url(#glowB)" filter="url(#blur)" />
  <circle cx="940" cy="500" r="160" fill="#ffb2c8" fill-opacity="0.18" filter="url(#blur)" />
  <path d="M148 500 C270 345 430 255 600 255 C776 255 935 346 1048 501" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="3" />
  <path d="M160 522 C296 380 434 325 600 325 C778 325 910 390 1038 522" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2" />
  <circle cx="600" cy="395" r="86" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.26" stroke-width="4" />
  <path d="M543 395 C563 348 639 348 658 395 C639 442 563 442 543 395Z" fill="#ffffff" fill-opacity="0.86" />
  <circle cx="523" cy="230" r="8" fill="#ffdd70" />
  <circle cx="676" cy="206" r="7" fill="#9cf3d4" />
  <circle cx="742" cy="262" r="10" fill="#ff9bd2" />
  <circle cx="470" cy="278" r="9" fill="#ffcf66" />
  <circle cx="760" cy="465" r="7" fill="#ffffff" fill-opacity="0.8" />
  <circle cx="430" cy="470" r="6" fill="#ffffff" fill-opacity="0.72" />
`;
}

function buildIwdOgSvg(): string {
  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
${festiveSvgBackground()}
<text x="84" y="132" fill="#FFF7FB" font-size="28" font-family="Rubik, Arial, sans-serif" font-weight="700" letter-spacing="0.24em">
SPIKE.LAND / IWD / MARCH 8 2026
</text>
<text x="84" y="260" fill="#FFF7FB" font-size="74" font-family="Rubik, Arial, sans-serif" font-weight="800">
Happy International
</text>
<text x="84" y="340" fill="#FFF7FB" font-size="74" font-family="Rubik, Arial, sans-serif" font-weight="800">
Women’s Day
</text>
<text x="84" y="412" fill="#FFE6A8" font-size="34" font-family="Rubik, Arial, sans-serif" font-weight="600">
Celebrate every woman, in every language, on a live world map.
</text>
<text x="84" y="502" fill="#FCE8F4" font-size="30" font-family="Rubik, Arial, sans-serif" font-weight="500">
Share messages, send emojis, and watch new art bloom in real time.
</text>
</svg>`;
}

function renderStyles(): string {
  return String.raw`
    :root{
      --bg-deep:#12091f;
      --bg-mid:#2a1038;
      --panel:rgba(19,12,32,0.76);
      --panel-strong:rgba(26,15,43,0.92);
      --line:rgba(255,255,255,0.14);
      --line-strong:rgba(255,255,255,0.24);
      --text:#fff7fb;
      --muted:rgba(255,247,251,0.76);
      --rose:#ff5fa2;
      --gold:#ffd166;
      --mint:#77f0cc;
      --sky:#6fcbff;
      --violet:#a184ff;
      --danger:#ff8e8e;
      --shadow:0 28px 80px rgba(8,4,20,0.46);
      --radius-xl:28px;
      --radius-lg:20px;
      --radius-md:14px;
      --font-sans:"Rubik", ui-sans-serif, system-ui, sans-serif;
    }
    *{box-sizing:border-box}
    html,body{min-height:100%;margin:0}
    body{
      font-family:var(--font-sans);
      color:var(--text);
      background:
        radial-gradient(circle at 12% 18%, rgba(255,209,102,0.18), transparent 26%),
        radial-gradient(circle at 88% 22%, rgba(119,240,204,0.14), transparent 24%),
        radial-gradient(circle at 82% 80%, rgba(255,95,162,0.14), transparent 28%),
        linear-gradient(135deg, #14081f 0%, #2a1038 48%, #5e1846 100%);
      overflow-x:hidden;
    }
    a{color:inherit}
    #map{
      position:fixed;
      inset:0;
      z-index:0;
      background:#12091f;
    }
    .leaflet-pane,
    .leaflet-control{z-index:1}
    .leaflet-tile-pane{
      filter:saturate(0.78) hue-rotate(18deg) brightness(0.76) contrast(1.08);
    }
    .map-veil{
      position:fixed;
      inset:0;
      z-index:1;
      pointer-events:none;
      background:
        radial-gradient(circle at center, transparent 18%, rgba(9,5,18,0.1) 56%, rgba(9,5,18,0.54) 100%),
        linear-gradient(180deg, rgba(7,3,15,0.52), rgba(7,3,15,0.16) 26%, rgba(7,3,15,0.56));
    }
    .orb{
      position:fixed;
      border-radius:999px;
      filter:blur(60px);
      opacity:0.5;
      pointer-events:none;
      z-index:1;
    }
    .orb-a{top:3rem;left:2rem;width:18rem;height:18rem;background:rgba(255,209,102,0.25)}
    .orb-b{top:10rem;right:4rem;width:20rem;height:20rem;background:rgba(119,240,204,0.18)}
    .orb-c{bottom:4rem;right:18rem;width:16rem;height:16rem;background:rgba(255,95,162,0.2)}
    #app-shell{
      position:relative;
      z-index:2;
      padding:1rem;
      min-height:100vh;
      display:flex;
      flex-direction:column;
      gap:1rem;
      pointer-events:none;
    }
    .topbar,
    .panel,
    .floating-stage,
    .status-note{pointer-events:auto}
    .topbar{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:1rem;
      border:1px solid var(--line);
      border-radius:999px;
      background:rgba(18,9,31,0.78);
      backdrop-filter:blur(18px);
      box-shadow:var(--shadow);
      padding:0.9rem 1.15rem;
    }
    .brand-block{
      display:flex;
      gap:0.9rem;
      align-items:center;
      min-width:0;
    }
    .brand-bolt{
      width:2.85rem;
      height:2.85rem;
      border-radius:1rem;
      background:
        linear-gradient(135deg, rgba(255,209,102,0.95), rgba(255,95,162,0.88));
      box-shadow:0 12px 34px rgba(255,95,162,0.32);
      display:grid;
      place-items:center;
      color:#210a1e;
      font-weight:900;
      font-size:1.1rem;
      flex:none;
    }
    .brand-kicker{
      display:block;
      font-size:0.72rem;
      letter-spacing:0.24em;
      text-transform:uppercase;
      color:var(--muted);
      margin-bottom:0.25rem;
    }
    .brand-title{
      display:block;
      font-size:1.25rem;
      font-weight:800;
      letter-spacing:-0.03em;
    }
    .brand-subtitle{
      display:block;
      color:var(--muted);
      font-size:0.92rem;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      max-width:42rem;
    }
    .topbar-stats{
      display:flex;
      gap:0.65rem;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .metric-chip{
      min-width:7.8rem;
      border-radius:999px;
      padding:0.68rem 0.95rem;
      background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05));
      border:1px solid rgba(255,255,255,0.12);
      text-align:left;
    }
    .metric-chip__label{
      display:block;
      font-size:0.72rem;
      text-transform:uppercase;
      letter-spacing:0.18em;
      color:var(--muted);
      margin-bottom:0.2rem;
    }
    .metric-chip__value{
      font-size:1.25rem;
      font-weight:800;
      letter-spacing:-0.03em;
    }
    .shell-grid{
      display:grid;
      grid-template-columns:minmax(18rem, 23rem) minmax(20rem, 26rem);
      grid-template-areas:
        "hero gallery"
        "leaderboard gallery"
        "share composer";
      justify-content:space-between;
      gap:1rem;
      flex:1;
    }
    .panel{
      position:relative;
      overflow:hidden;
      border-radius:var(--radius-xl);
      border:1px solid var(--line);
      background:var(--panel);
      backdrop-filter:blur(18px);
      box-shadow:var(--shadow);
      padding:1.1rem;
    }
    .panel::before{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(180deg, rgba(255,255,255,0.08), transparent 28%);
      pointer-events:none;
    }
    .hero-panel{grid-area:hero; display:flex; flex-direction:column; gap:1rem;}
    .leaderboard-panel{grid-area:leaderboard}
    .gallery-panel{grid-area:gallery; min-height:32rem; display:flex; flex-direction:column; gap:0.9rem;}
    .composer-panel{grid-area:composer; display:flex; flex-direction:column; gap:0.9rem;}
    .share-panel{grid-area:share; display:flex; flex-direction:column; gap:0.9rem;}
    .panel-kicker{
      font-size:0.72rem;
      letter-spacing:0.24em;
      text-transform:uppercase;
      color:var(--muted);
      margin-bottom:0.55rem;
    }
    .hero-title{
      margin:0;
      font-size:clamp(2.2rem, 4vw, 4.5rem);
      line-height:0.93;
      letter-spacing:-0.05em;
      font-weight:800;
      max-width:12ch;
    }
    .hero-copy{
      margin:0;
      color:var(--muted);
      font-size:1rem;
      line-height:1.45;
      max-width:34ch;
    }
    .greeting-card{
      padding:1rem;
      border-radius:1.25rem;
      border:1px solid rgba(255,255,255,0.12);
      background:
        radial-gradient(circle at top right, rgba(255,95,162,0.25), transparent 42%),
        linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
    }
    .greeting-card__label{
      display:block;
      font-size:0.72rem;
      letter-spacing:0.16em;
      text-transform:uppercase;
      color:var(--muted);
      margin-bottom:0.5rem;
    }
    .greeting-card__value{
      display:block;
      font-size:1.45rem;
      font-weight:800;
      letter-spacing:-0.03em;
      line-height:1.15;
    }
    .greeting-card__meta{
      margin-top:0.45rem;
      color:var(--muted);
      font-size:0.92rem;
    }
    .signal-strip{
      display:grid;
      gap:0.7rem;
      grid-template-columns:repeat(2,minmax(0,1fr));
    }
    .signal-tile{
      padding:0.9rem;
      border-radius:1.15rem;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.08);
    }
    .signal-tile__value{
      display:block;
      font-size:1.55rem;
      font-weight:800;
      letter-spacing:-0.03em;
    }
    .signal-tile__label{
      display:block;
      margin-top:0.32rem;
      color:var(--muted);
      font-size:0.82rem;
      line-height:1.35;
    }
    .world-ribbon{
      display:flex;
      gap:0.5rem;
      flex-wrap:wrap;
    }
    .world-chip{
      display:inline-flex;
      gap:0.45rem;
      align-items:center;
      padding:0.54rem 0.75rem;
      border-radius:999px;
      background:rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.11);
      color:var(--muted);
      font-size:0.84rem;
      white-space:nowrap;
    }
    .section-head{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:0.8rem;
      margin-bottom:0.85rem;
    }
    .section-head h2,
    .section-head h3{
      margin:0;
      font-size:1.15rem;
      font-weight:700;
      letter-spacing:-0.02em;
    }
    .section-head p{
      margin:0.2rem 0 0;
      color:var(--muted);
      font-size:0.88rem;
      max-width:32ch;
    }
    .section-badge{
      flex:none;
      padding:0.45rem 0.7rem;
      border-radius:999px;
      background:rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.14);
      color:var(--muted);
      font-size:0.75rem;
      letter-spacing:0.14em;
      text-transform:uppercase;
    }
    .leaderboard-list,
    .gallery-feed{
      display:flex;
      flex-direction:column;
      gap:0.65rem;
      min-height:0;
    }
    .leaderboard-list{max-height:22rem; overflow:auto; padding-right:0.2rem;}
    .gallery-feed{flex:1; overflow:auto; padding-right:0.2rem;}
    .board-row{
      display:grid;
      grid-template-columns:auto 1fr auto;
      gap:0.8rem;
      align-items:center;
      padding:0.82rem 0.9rem;
      border-radius:1.1rem;
      background:rgba(255,255,255,0.055);
      border:1px solid rgba(255,255,255,0.08);
    }
    .board-rank{
      width:2rem;
      height:2rem;
      border-radius:999px;
      display:grid;
      place-items:center;
      background:linear-gradient(135deg, rgba(255,209,102,0.92), rgba(255,95,162,0.82));
      color:#210a1e;
      font-weight:800;
      font-size:0.92rem;
    }
    .board-copy strong{
      display:block;
      font-size:0.96rem;
      letter-spacing:-0.01em;
    }
    .board-copy span{
      display:block;
      color:var(--muted);
      font-size:0.82rem;
      margin-top:0.14rem;
      line-height:1.3;
    }
    .board-score{
      text-align:right;
      font-weight:800;
      font-size:1.15rem;
    }
    .board-score small{
      display:block;
      color:var(--muted);
      font-size:0.7rem;
      letter-spacing:0.14em;
      text-transform:uppercase;
    }
    .gallery-feed__empty{
      border:1px dashed rgba(255,255,255,0.16);
      border-radius:1.2rem;
      padding:1rem;
      color:var(--muted);
      background:rgba(255,255,255,0.035);
      line-height:1.45;
    }
    .message-card{
      position:relative;
      border-radius:1.4rem;
      padding:0.9rem;
      background:
        radial-gradient(circle at top right, rgba(255,209,102,0.16), transparent 30%),
        linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
      border:1px solid rgba(255,255,255,0.1);
      display:flex;
      flex-direction:column;
      gap:0.72rem;
      transform:translateY(10px);
      opacity:0;
      animation:card-rise 0.6s ease forwards;
    }
    .message-card.is-processing::after{
      content:"";
      position:absolute;
      inset:0;
      background:linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 45%, transparent 90%);
      transform:translateX(-110%);
      animation:shimmer 1.8s ease infinite;
      pointer-events:none;
    }
    .message-card__head{
      display:flex;
      justify-content:space-between;
      gap:0.75rem;
      align-items:flex-start;
    }
    .message-card__location{
      font-size:0.85rem;
      color:var(--muted);
      line-height:1.35;
    }
    .message-card__location strong{
      display:block;
      color:var(--text);
      font-size:0.98rem;
      letter-spacing:-0.02em;
    }
    .status-pill{
      padding:0.35rem 0.56rem;
      border-radius:999px;
      font-size:0.72rem;
      letter-spacing:0.14em;
      text-transform:uppercase;
      border:1px solid rgba(255,255,255,0.12);
      background:rgba(255,255,255,0.08);
      color:var(--muted);
      white-space:nowrap;
    }
    .status-pill.is-live{background:rgba(119,240,204,0.12); color:var(--mint); border-color:rgba(119,240,204,0.28)}
    .status-pill.is-processing{background:rgba(255,209,102,0.12); color:var(--gold); border-color:rgba(255,209,102,0.28)}
    .status-pill.is-failed{background:rgba(255,142,142,0.12); color:var(--danger); border-color:rgba(255,142,142,0.28)}
    .emoji-cluster{
      display:flex;
      gap:0.35rem;
      flex-wrap:wrap;
      font-size:1.05rem;
    }
    .message-card__text{
      margin:0;
      font-size:0.97rem;
      line-height:1.45;
      color:var(--text);
    }
    .message-card__meta{
      color:var(--muted);
      font-size:0.8rem;
      display:flex;
      gap:0.45rem;
      flex-wrap:wrap;
      align-items:center;
    }
    .message-card__image{
      position:relative;
      border-radius:1.15rem;
      overflow:hidden;
      aspect-ratio:1 / 1;
      border:1px solid rgba(255,255,255,0.12);
      background:
        radial-gradient(circle at 30% 20%, rgba(255,209,102,0.18), transparent 34%),
        linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04));
    }
    .message-card__image img{
      display:block;
      width:100%;
      height:100%;
      object-fit:cover;
      transform:scale(1.02);
    }
    .message-card__placeholder{
      aspect-ratio:1 / 1;
      border-radius:1.15rem;
      border:1px dashed rgba(255,255,255,0.16);
      background:
        radial-gradient(circle at 20% 20%, rgba(255,209,102,0.14), transparent 26%),
        linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02));
      display:grid;
      place-items:center;
      text-align:center;
      color:var(--muted);
      font-size:0.88rem;
      line-height:1.45;
      padding:1rem;
    }
    .composer-form{
      display:flex;
      flex-direction:column;
      gap:0.8rem;
      min-height:0;
    }
    .emoji-picker{
      display:flex;
      flex-wrap:wrap;
      gap:0.5rem;
    }
    .emoji-btn{
      border:none;
      cursor:pointer;
      border-radius:999px;
      padding:0.56rem 0.82rem;
      background:rgba(255,255,255,0.07);
      color:var(--text);
      border:1px solid rgba(255,255,255,0.12);
      font:inherit;
      transition:transform 180ms ease, background 180ms ease, border-color 180ms ease;
    }
    .emoji-btn:hover{transform:translateY(-1px)}
    .emoji-btn.is-active{
      background:linear-gradient(135deg, rgba(255,95,162,0.24), rgba(119,240,204,0.18));
      border-color:rgba(255,255,255,0.28);
    }
    .composer-text{
      width:100%;
      min-height:7.25rem;
      resize:none;
      border-radius:1.3rem;
      border:1px solid rgba(255,255,255,0.12);
      background:rgba(4,2,10,0.26);
      color:var(--text);
      padding:0.95rem 1rem;
      font:inherit;
      line-height:1.45;
      outline:none;
    }
    .composer-text::placeholder{color:rgba(255,247,251,0.48)}
    .composer-text:focus{
      border-color:rgba(255,255,255,0.32);
      box-shadow:0 0 0 4px rgba(255,255,255,0.05);
    }
    .composer-actions{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:0.8rem;
      flex-wrap:wrap;
    }
    .composer-note{
      color:var(--muted);
      font-size:0.82rem;
      line-height:1.35;
      max-width:26ch;
    }
    .send-btn{
      border:none;
      cursor:pointer;
      border-radius:999px;
      padding:0.88rem 1.12rem;
      background:linear-gradient(135deg, rgba(255,209,102,0.96), rgba(255,95,162,0.9));
      color:#210a1e;
      font:inherit;
      font-weight:900;
      letter-spacing:0.02em;
      min-width:11.8rem;
      box-shadow:0 18px 36px rgba(255,95,162,0.26);
      transition:transform 180ms ease, filter 180ms ease;
    }
    .send-btn:hover{transform:translateY(-1px)}
    .send-btn:disabled{
      cursor:progress;
      opacity:0.7;
      filter:saturate(0.8);
    }
    .share-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:0.55rem;
    }
    .share-btn{
      border:none;
      cursor:pointer;
      border-radius:1rem;
      padding:0.78rem 0.76rem;
      background:rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.11);
      color:var(--text);
      font:inherit;
      text-align:left;
      transition:transform 180ms ease, border-color 180ms ease;
    }
    .share-btn:hover{
      transform:translateY(-1px);
      border-color:rgba(255,255,255,0.26);
    }
    .share-btn strong{
      display:block;
      font-size:0.9rem;
      font-weight:700;
    }
    .share-btn span{
      display:block;
      margin-top:0.2rem;
      color:var(--muted);
      font-size:0.76rem;
      line-height:1.35;
    }
    .floating-stage{
      position:fixed;
      inset:0;
      z-index:6;
      pointer-events:none;
      display:grid;
      place-items:center;
    }
    .floating-card{
      width:min(24rem, calc(100vw - 2rem));
      border-radius:1.8rem;
      padding:1rem;
      background:rgba(18,9,31,0.9);
      border:1px solid rgba(255,255,255,0.18);
      box-shadow:0 30px 90px rgba(4,2,12,0.55);
      backdrop-filter:blur(20px);
      transform:translateY(24px) scale(0.94) rotate(-2deg);
      opacity:0;
      transition:transform 420ms cubic-bezier(.2,.8,.2,1), opacity 420ms ease;
    }
    .floating-card.is-visible{
      transform:translateY(0) scale(1) rotate(0deg);
      opacity:1;
    }
    .floating-card.is-leaving{
      transform:translateY(-16px) scale(0.97) rotate(1.2deg);
      opacity:0;
    }
    .status-note{
      position:fixed;
      left:50%;
      bottom:1.2rem;
      transform:translateX(-50%) translateY(10px);
      min-width:min(28rem, calc(100vw - 2rem));
      max-width:min(34rem, calc(100vw - 2rem));
      border-radius:999px;
      border:1px solid rgba(255,255,255,0.14);
      background:rgba(18,9,31,0.86);
      color:var(--text);
      padding:0.86rem 1.1rem;
      text-align:center;
      box-shadow:var(--shadow);
      opacity:0;
      pointer-events:none;
      transition:opacity 220ms ease, transform 220ms ease;
      z-index:7;
    }
    .status-note.is-visible{
      opacity:1;
      transform:translateX(-50%) translateY(0);
    }
    .visitor-dot{
      width:0.86rem;
      height:0.86rem;
      border-radius:999px;
      background:var(--gold);
      border:2px solid rgba(255,255,255,0.72);
      box-shadow:0 0 0 0 rgba(255,209,102,0.44);
    }
    .visitor-dot.is-new{
      background:var(--mint);
      animation:pulse 1.8s ease 3;
    }
    .art-marker{
      width:3rem;
      height:3rem;
      border-radius:1rem;
      padding:0.16rem;
      background:linear-gradient(135deg, rgba(255,95,162,0.95), rgba(255,209,102,0.88));
      box-shadow:0 18px 32px rgba(0,0,0,0.35);
      border:2px solid rgba(255,255,255,0.82);
      transform-origin:center center;
      animation:marker-bloom 0.7s cubic-bezier(.2,.85,.2,1);
    }
    .art-marker__thumb{
      width:100%;
      height:100%;
      border-radius:0.8rem;
      background-size:cover;
      background-position:center;
      display:block;
    }
    .leaflet-popup-content-wrapper,
    .leaflet-popup-tip{
      background:rgba(18,9,31,0.95);
      color:var(--text);
      border:1px solid rgba(255,255,255,0.14);
      box-shadow:var(--shadow);
    }
    .map-popup{
      width:16rem;
    }
    .map-popup img{
      width:100%;
      aspect-ratio:1 / 1;
      object-fit:cover;
      border-radius:1rem;
      margin-top:0.6rem;
      border:1px solid rgba(255,255,255,0.12);
    }
    .map-popup strong{
      display:block;
      font-size:1rem;
      margin-bottom:0.2rem;
    }
    .map-popup p{
      margin:0;
      color:var(--muted);
      font-size:0.85rem;
      line-height:1.35;
    }
    .map-popup .map-popup__text{
      color:var(--text);
      margin-top:0.55rem;
    }
    @keyframes pulse{
      0%{box-shadow:0 0 0 0 rgba(119,240,204,0.5)}
      70%{box-shadow:0 0 0 20px rgba(119,240,204,0)}
      100%{box-shadow:0 0 0 0 rgba(119,240,204,0)}
    }
    @keyframes card-rise{
      from{opacity:0;transform:translateY(10px)}
      to{opacity:1;transform:translateY(0)}
    }
    @keyframes shimmer{
      to{transform:translateX(110%)}
    }
    @keyframes marker-bloom{
      0%{transform:scale(0.5) rotate(-10deg);opacity:0}
      100%{transform:scale(1) rotate(0deg);opacity:1}
    }
    @media (max-width: 1100px){
      .shell-grid{
        grid-template-columns:minmax(18rem, 24rem) minmax(18rem, 24rem);
      }
      .topbar{border-radius:1.5rem}
      .brand-subtitle{max-width:24rem}
    }
    @media (max-width: 920px){
      #app-shell{padding:0.75rem}
      .topbar{
        align-items:flex-start;
        border-radius:1.5rem;
        flex-direction:column;
      }
      .topbar-stats{justify-content:flex-start}
      .shell-grid{
        grid-template-columns:1fr;
        grid-template-areas:
          "hero"
          "leaderboard"
          "gallery"
          "composer"
          "share";
      }
      .gallery-panel{min-height:24rem}
      .share-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .signal-strip{grid-template-columns:1fr}
    }
    @media (max-width: 560px){
      .share-grid{grid-template-columns:1fr}
      .metric-chip{min-width:0}
      .hero-title{font-size:2rem}
      .panel{padding:0.95rem}
      .brand-title{font-size:1.08rem}
      .brand-subtitle{white-space:normal}
    }
  `;
}

function renderClientScript(): string {
  return String.raw`
    (function(){
      var boot = {};
      try {
        boot = JSON.parse(document.getElementById('iwd-boot').textContent || '{}');
      } catch {}
      var emojiOptions = [];
      try {
        emojiOptions = JSON.parse(document.getElementById('iwd-emojis').textContent || '[]');
      } catch {}

      var state = {
        visitor: null,
        visitors: new Map(),
        messages: new Map(),
        visitorMarkers: new Map(),
        artMarkers: new Map(),
        completedSeen: new Set(),
        selectedEmojis: [],
        lastServerTime: 0,
        totalVisitors: 0,
        introDone: false,
        pendingSend: false,
        toastTimer: null,
        map: null
      };

      var els = {
        totalVisitors: document.getElementById('total-visitors'),
        totalArtworks: document.getElementById('total-artworks'),
        totalCountries: document.getElementById('total-countries'),
        totalMessages: document.getElementById('total-messages'),
        heroGreeting: document.getElementById('hero-greeting'),
        heroLanguage: document.getElementById('hero-language'),
        leaderboard: document.getElementById('leaderboard-list'),
        galleryFeed: document.getElementById('gallery-feed'),
        galleryCount: document.getElementById('gallery-count'),
        worldRibbon: document.getElementById('world-ribbon'),
        shareBar: document.getElementById('share-grid'),
        emojiPicker: document.getElementById('emoji-picker'),
        composerForm: document.getElementById('composer-form'),
        composerText: document.getElementById('composer-text'),
        composerSend: document.getElementById('composer-send'),
        floatingStage: document.getElementById('floating-stage'),
        toast: document.getElementById('status-note')
      };

      function countryName(code){
        if(!code) return 'Everywhere';
        try{
          var displayNames = new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' });
          return displayNames.of(code) || code;
        }catch{
          return code;
        }
      }

      function flagEmoji(code){
        if(!code || code.length !== 2) return '🌍';
        return code.toUpperCase().replace(/./g, function(char){
          return String.fromCodePoint(127397 + char.charCodeAt(0));
        });
      }

      function timeAgo(timestamp){
        var diff = Date.now() - timestamp;
        var minutes = Math.max(1, Math.round(diff / 60000));
        if(minutes < 60) return minutes + 'm ago';
        var hours = Math.round(minutes / 60);
        if(hours < 24) return hours + 'h ago';
        var days = Math.round(hours / 24);
        return days + 'd ago';
      }

      function escapeHtml(value){
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function showToast(message){
        if(!els.toast) return;
        els.toast.textContent = message;
        els.toast.classList.add('is-visible');
        if(state.toastTimer) clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(function(){
          els.toast.classList.remove('is-visible');
        }, 2600);
      }

      function updateHeroGreeting(info){
        var next = info || boot.viewerGreeting || { greeting: 'Happy International Women\\'s Day', languageLabel: 'English' };
        if(els.heroGreeting) els.heroGreeting.textContent = next.greeting;
        if(els.heroLanguage) els.heroLanguage.textContent = next.languageLabel + ' greeting';
      }

      function countCompletedArtworks(){
        return Array.from(state.messages.values()).filter(function(item){
          return item.imageStatus === 'COMPLETED' && item.imageUrl;
        }).length;
      }

      function updateStats(feed){
        state.totalVisitors = feed.totalVisitors || state.totalVisitors || state.visitors.size;
        if(els.totalVisitors) els.totalVisitors.textContent = String(state.totalVisitors);
        if(els.totalArtworks) els.totalArtworks.textContent = String(countCompletedArtworks());
        if(els.totalMessages) els.totalMessages.textContent = String(state.messages.size);
        if(els.totalCountries){
          var countries = new Set();
          Array.from(state.visitors.values()).forEach(function(visitor){
            if(visitor.country) countries.add(visitor.country);
          });
          els.totalCountries.textContent = String(countries.size);
        }
        if(els.galleryCount) els.galleryCount.textContent = countCompletedArtworks() + ' live artworks';
      }

      function initMap(){
        if(!window.L || state.map) return;
        state.map = window.L.map('map', {
          zoomControl: false,
          attributionControl: false
        }).setView([18, 8], 2.2);
        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 18,
          subdomains: 'abcd'
        }).addTo(state.map);
        window.L.control.zoom({ position: 'bottomright' }).addTo(state.map);
      }

      function addVisitorMarker(visitor, highlight){
        if(!state.map || state.visitorMarkers.has(visitor.id)) return;
        var dot = document.createElement('div');
        dot.className = 'visitor-dot' + (highlight ? ' is-new' : '');
        var icon = window.L.divIcon({
          className: '',
          html: dot.outerHTML,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        var marker = window.L.marker([visitor.latitude, visitor.longitude], {
          icon: icon,
          interactive: false
        }).addTo(state.map);
        if(visitor.city || visitor.country){
          marker.bindTooltip(
            [visitor.city, visitor.country].filter(Boolean).join(', '),
            { direction: 'top', offset: [0, -8] }
          );
        }
        state.visitorMarkers.set(visitor.id, marker);
      }

      function popupHtml(message){
        return (
          '<div class="map-popup">' +
            '<strong>' + escapeHtml((message.city || countryName(message.country)) || 'Somewhere in the world') + '</strong>' +
            '<p>' + escapeHtml(message.greeting) + '</p>' +
            '<p class="map-popup__text">' + escapeHtml(message.text || 'A celebration in motion.') + '</p>' +
            (message.imageUrl ? '<img src="' + escapeHtml(message.imageUrl) + '" alt="Generated International Women\\'s Day artwork" loading="lazy" />' : '') +
          '</div>'
        );
      }

      function ensureArtMarker(message, highlight){
        if(!state.map || !message.imageUrl || message.imageStatus !== 'COMPLETED') return;
        var existing = state.artMarkers.get(message.id);
        if(existing){
          existing.bindPopup(popupHtml(message), { maxWidth: 280 });
          return;
        }
        var shell = document.createElement('div');
        shell.className = 'art-marker';
        var thumb = document.createElement('span');
        thumb.className = 'art-marker__thumb';
        thumb.style.backgroundImage = 'url("' + message.imageUrl.replace(/"/g, '\\"') + '")';
        shell.appendChild(thumb);
        var icon = window.L.divIcon({
          className: '',
          html: shell.outerHTML,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          popupAnchor: [0, -22]
        });
        var marker = window.L.marker([message.latitude, message.longitude], {
          icon: icon,
          interactive: true
        }).addTo(state.map);
        marker.bindPopup(popupHtml(message), { maxWidth: 280 });
        state.artMarkers.set(message.id, marker);
        if(highlight && window.confetti){
          window.confetti({
            particleCount: 110,
            spread: 84,
            origin: { y: 0.35 },
            colors: ['#ff5fa2', '#ffd166', '#77f0cc', '#ffffff']
          });
        }
      }

      function renderLeaderboard(items){
        if(!els.leaderboard) return;
        els.leaderboard.innerHTML = '';
        if(!items || items.length === 0){
          var empty = document.createElement('div');
          empty.className = 'gallery-feed__empty';
          empty.textContent = 'The first visitors will set today\\'s world ranking.';
          els.leaderboard.appendChild(empty);
          return;
        }
        items.forEach(function(item, index){
          var row = document.createElement('div');
          row.className = 'board-row';

          var rank = document.createElement('div');
          rank.className = 'board-rank';
          rank.textContent = String(index + 1);

          var copy = document.createElement('div');
          copy.className = 'board-copy';
          var title = document.createElement('strong');
          title.textContent = flagEmoji(item.country) + ' ' + countryName(item.country);
          var subtitle = document.createElement('span');
          subtitle.textContent = item.greeting + ' · ' + item.languageLabel;
          copy.appendChild(title);
          copy.appendChild(subtitle);

          var score = document.createElement('div');
          score.className = 'board-score';
          score.textContent = String(item.count);
          var unit = document.createElement('small');
          unit.textContent = item.count === 1 ? 'visitor' : 'visitors';
          score.appendChild(unit);

          row.appendChild(rank);
          row.appendChild(copy);
          row.appendChild(score);
          els.leaderboard.appendChild(row);
        });
      }

      function renderWorldRibbon(items){
        if(!els.worldRibbon) return;
        els.worldRibbon.innerHTML = '';
        (items || []).slice(0, 8).forEach(function(item){
          var chip = document.createElement('div');
          chip.className = 'world-chip';
          chip.textContent = flagEmoji(item.country) + ' ' + item.greeting;
          els.worldRibbon.appendChild(chip);
        });
      }

      function statusClass(message){
        if(message.imageStatus === 'COMPLETED') return 'is-live';
        if(message.imageStatus === 'FAILED') return 'is-failed';
        return 'is-processing';
      }

      function statusLabel(message){
        if(message.imageStatus === 'COMPLETED') return 'Live';
        if(message.imageStatus === 'FAILED') return 'Retrying';
        return 'Painting';
      }

      function createMessageCard(message){
        var card = document.createElement('article');
        card.className = 'message-card ' + (message.imageStatus === 'PROCESSING' ? 'is-processing' : '');

        var head = document.createElement('div');
        head.className = 'message-card__head';

        var location = document.createElement('div');
        location.className = 'message-card__location';
        var strong = document.createElement('strong');
        strong.textContent = flagEmoji(message.country) + ' ' + ((message.city || countryName(message.country)) || 'Around the world');
        var locationMeta = document.createElement('span');
        locationMeta.textContent = message.greeting;
        location.appendChild(strong);
        location.appendChild(locationMeta);

        var pill = document.createElement('div');
        pill.className = 'status-pill ' + statusClass(message);
        pill.textContent = statusLabel(message);

        head.appendChild(location);
        head.appendChild(pill);

        card.appendChild(head);

        if(message.emojis.length){
          var emojiCluster = document.createElement('div');
          emojiCluster.className = 'emoji-cluster';
          message.emojis.forEach(function(emoji){
            var chip = document.createElement('span');
            chip.textContent = emoji;
            emojiCluster.appendChild(chip);
          });
          card.appendChild(emojiCluster);
        }

        if(message.text){
          var text = document.createElement('p');
          text.className = 'message-card__text';
          text.textContent = message.text;
          card.appendChild(text);
        }

        if(message.imageStatus === 'COMPLETED' && message.imageUrl){
          var imageWrap = document.createElement('div');
          imageWrap.className = 'message-card__image';
          var image = document.createElement('img');
          image.src = message.imageUrl;
          image.alt = 'Generated International Women\\'s Day artwork';
          image.loading = 'lazy';
          image.decoding = 'async';
          imageWrap.appendChild(image);
          card.appendChild(imageWrap);
        } else if(message.imageStatus === 'FAILED'){
          var failed = document.createElement('div');
          failed.className = 'message-card__placeholder';
          failed.textContent = message.errorMessage || 'Image Studio had a moment. The message is still part of the world chat.';
          card.appendChild(failed);
        } else {
          var pending = document.createElement('div');
          pending.className = 'message-card__placeholder';
          pending.textContent = 'Image Studio is turning this note into a 0.5K square celebration.';
          card.appendChild(pending);
        }

        var meta = document.createElement('div');
        meta.className = 'message-card__meta';
        meta.textContent = timeAgo(message.createdAt) + ' · ' + message.locale.toUpperCase();
        card.appendChild(meta);

        return card;
      }

      function renderChatFeed(){
        if(!els.galleryFeed) return;
        els.galleryFeed.innerHTML = '';
        var items = Array.from(state.messages.values()).sort(function(a, b){
          return b.createdAt - a.createdAt;
        });
        if(items.length === 0){
          var empty = document.createElement('div');
          empty.className = 'gallery-feed__empty';
          empty.textContent = 'No messages yet. Send the first multilingual celebration and let Image Studio bloom it onto the map.';
          els.galleryFeed.appendChild(empty);
          return;
        }
        items.slice(0, 18).forEach(function(item){
          els.galleryFeed.appendChild(createMessageCard(item));
        });
      }

      function queueCompletedMessage(message, highlight){
        if(state.completedSeen.has(message.id)) return;
        state.completedSeen.add(message.id);
        ensureArtMarker(message, highlight);
        animateFloatingCard(message);
        if(highlight){
          showToast('A new celebration just bloomed on the map.');
        }
      }

      function animateFloatingCard(message){
        if(!els.floatingStage) return Promise.resolve();
        return new Promise(function(resolve){
          var card = createMessageCard(message);
          card.classList.remove('is-processing');
          card.classList.add('floating-card');
          els.floatingStage.appendChild(card);
          requestAnimationFrame(function(){
            card.classList.add('is-visible');
          });
          setTimeout(function(){
            card.classList.remove('is-visible');
            card.classList.add('is-leaving');
          }, 1700);
          setTimeout(function(){
            card.remove();
            resolve();
          }, 2300);
        });
      }

      async function warmImage(url){
        if(!url) return;
        var response = null;
        if('caches' in window){
          try{
            var cache = await caches.open('iwd-2026-gallery');
            var request = new Request(url, { mode: 'cors' });
            response = await cache.match(request);
            if(!response){
              response = await fetch(request, { mode: 'cors', credentials: 'omit' });
              if(response.ok){
                await cache.put(request, response.clone());
              }
            }
          }catch{}
        }
        await new Promise(function(resolve){
          var image = new Image();
          image.decoding = 'async';
          image.onload = function(){ resolve(); };
          image.onerror = function(){ resolve(); };
          image.src = url;
        });
        return response;
      }

      async function runIntroSequence(){
        var firstVisit = false;
        try{
          firstVisit = !localStorage.getItem('iwd-2026-seen');
        }catch{}
        if(!firstVisit) return;

        var introItems = Array.from(state.messages.values())
          .filter(function(item){
            return item.imageStatus === 'COMPLETED' && item.imageUrl;
          })
          .sort(function(a, b){
            return a.createdAt - b.createdAt;
          })
          .slice(-${IWD_INTRO_REVEAL_LIMIT});

        if(introItems.length === 0){
          try{ localStorage.setItem('iwd-2026-seen', '1'); }catch{}
          return;
        }

        showToast('Warming the celebration deck for offline-first replay.');
        await Promise.all(introItems.map(function(item){ return warmImage(item.imageUrl); }));
        showToast('All artworks cached. Revealing them one by one.');

        for(var index = 0; index < introItems.length; index++){
          await animateFloatingCard(introItems[index]);
        }

        try{
          localStorage.setItem('iwd-2026-seen', '1');
        }catch{}
      }

      function upsertFeed(feed, isInitial){
        (feed.visitors || []).forEach(function(visitor){
          var alreadyHad = state.visitors.has(visitor.id);
          state.visitors.set(visitor.id, visitor);
          addVisitorMarker(visitor, !alreadyHad && !isInitial);
        });

        (feed.messages || []).forEach(function(message){
          var previous = state.messages.get(message.id);
          state.messages.set(message.id, message);
          if(message.imageStatus === 'COMPLETED' && message.imageUrl){
            if(!previous || previous.imageStatus !== 'COMPLETED' || !previous.imageUrl){
              if(state.introDone){
                queueCompletedMessage(message, !isInitial);
              } else {
                ensureArtMarker(message, false);
              }
            } else {
              ensureArtMarker(message, false);
            }
          }
        });

        renderLeaderboard(feed.leaderboard || []);
        renderWorldRibbon(feed.leaderboard || []);
        renderChatFeed();
        updateStats(feed);
        state.lastServerTime = feed.serverTime || Date.now();
      }

      function sharePayload(){
        var greeting = (els.heroGreeting && els.heroGreeting.textContent) || 'Happy International Women\\'s Day';
        var url = window.location.href.split('#')[0];
        return {
          title: 'International Women\\'s Day 2026 | spike.land',
          text: greeting + '. Join ' + (state.totalVisitors || 0) + ' visitors on the live celebration map.',
          url: url
        };
      }

      function openShare(network){
        var payload = sharePayload();
        var encodedUrl = encodeURIComponent(payload.url);
        var encodedText = encodeURIComponent(payload.text);
        var encodedTitle = encodeURIComponent(payload.title);

        if(network === 'copy'){
          navigator.clipboard.writeText(payload.url).then(function(){
            showToast('Link copied. Send it everywhere.');
          }).catch(function(){
            showToast(payload.url);
          });
          return;
        }
        if(network === 'native' && navigator.share){
          navigator.share(payload).catch(function(){});
          return;
        }

        var target = '';
        switch(network){
          case 'x':
            target = 'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedText;
            break;
          case 'linkedin':
            target = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl;
            break;
          case 'facebook':
            target = 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
            break;
          case 'whatsapp':
            target = 'https://wa.me/?text=' + encodeURIComponent(payload.text + ' ' + payload.url);
            break;
          case 'telegram':
            target = 'https://t.me/share/url?url=' + encodedUrl + '&text=' + encodedText;
            break;
          case 'reddit':
            target = 'https://www.reddit.com/submit?url=' + encodedUrl + '&title=' + encodedTitle;
            break;
          case 'email':
            target = 'mailto:?subject=' + encodedTitle + '&body=' + encodeURIComponent(payload.text + '\n\n' + payload.url);
            break;
        }
        if(target){
          window.open(target, '_blank', 'noopener,noreferrer');
        }
      }

      function bindShareButtons(){
        if(!els.shareBar) return;
        els.shareBar.addEventListener('click', function(event){
          var target = event.target;
          while(target && target !== els.shareBar && !target.dataset.network){
            target = target.parentNode;
          }
          if(target && target.dataset && target.dataset.network){
            openShare(target.dataset.network);
          }
        });
      }

      function renderEmojiButtons(){
        if(!els.emojiPicker) return;
        els.emojiPicker.innerHTML = '';
        emojiOptions.forEach(function(emoji){
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'emoji-btn';
          button.dataset.emoji = emoji;
          button.textContent = emoji;
          button.addEventListener('click', function(){
            var index = state.selectedEmojis.indexOf(emoji);
            if(index >= 0){
              state.selectedEmojis.splice(index, 1);
            } else if(state.selectedEmojis.length < 3){
              state.selectedEmojis.push(emoji);
            } else {
              showToast('Pick up to three emojis.');
            }
            renderEmojiButtons();
          });
          if(state.selectedEmojis.indexOf(emoji) >= 0){
            button.classList.add('is-active');
          }
          els.emojiPicker.appendChild(button);
        });
      }

      async function submitMessage(event){
        event.preventDefault();
        if(state.pendingSend) return;
        var text = (els.composerText && els.composerText.value || '').trim();
        if(!text && state.selectedEmojis.length === 0){
          showToast('Add a short note or at least one emoji.');
          return;
        }

        state.pendingSend = true;
        if(els.composerSend) els.composerSend.disabled = true;

        try{
          var response = await fetch('/api/iwd/message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              text: text,
              emojis: state.selectedEmojis
            })
          });

          var data = await response.json();
          if(!response.ok){
            throw new Error(data.error || 'Message launch failed');
          }

          if(data.message){
            state.messages.set(data.message.id, data.message);
            renderChatFeed();
            updateStats({ totalVisitors: state.totalVisitors });
          }

          state.selectedEmojis = [];
          renderEmojiButtons();
          if(els.composerText) els.composerText.value = '';
          showToast('Your note is live. Image Studio is painting it now.');
        }catch(error){
          showToast(error && error.message ? error.message : 'Message launch failed.');
        }finally{
          state.pendingSend = false;
          if(els.composerSend) els.composerSend.disabled = false;
        }
      }

      async function checkin(){
        var response = await fetch('/api/iwd/checkin', {
          method: 'POST',
          headers: { 'Accept': 'application/json' }
        });
        if(!response.ok){
          throw new Error('Check-in failed');
        }
        return response.json();
      }

      async function pollFeed(){
        var url = '/api/iwd/feed';
        if(state.lastServerTime){
          url += '?since=' + encodeURIComponent(String(state.lastServerTime));
        }
        try{
          var response = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if(!response.ok) return;
          var data = await response.json();
          upsertFeed(data, false);
        }catch{}
      }

      async function bootstrap(){
        initMap();
        updateHeroGreeting(boot.viewerGreeting);
        renderEmojiButtons();
        bindShareButtons();
        if(els.composerForm){
          els.composerForm.addEventListener('submit', submitMessage);
        }

        try{
          var data = await checkin();
          state.visitor = data.visitor || null;
          if(data.viewerGreeting){
            updateHeroGreeting(data.viewerGreeting);
          }
          upsertFeed(data, true);
          if(data.isNew && window.confetti){
            window.confetti({
              particleCount: 150,
              spread: 90,
              origin: { y: 0.28 },
              colors: ['#ff5fa2', '#ffd166', '#77f0cc', '#ffffff']
            });
          }
          await runIntroSequence();
          state.introDone = true;
          Array.from(state.messages.values()).forEach(function(message){
            if(message.imageStatus === 'COMPLETED' && message.imageUrl){
              state.completedSeen.add(message.id);
              ensureArtMarker(message, false);
            }
          });
          setInterval(pollFeed, 4000);
        }catch{
          showToast('We could not reach the live feed yet.');
          state.introDone = true;
        }
      }

      bootstrap();
    })();
  `;
}

function renderPage(origin: string, viewerGreeting: GreetingInfo): string {
  const ogImageUrl = `${origin}/iwd/og.svg`;
  const pageTitle = "International Women's Day 2026 | spike.land";
  const description =
    "Celebrate women across the world on a festive live map with multilingual greetings, country leaderboards, and shared AI-generated art.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#2a1038">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(`${origin}/iwd`)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:type" content="image/svg+xml">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta property="twitter:description" content="${escapeHtml(description)}">
  <meta property="twitter:image" content="${escapeHtml(ogImageUrl)}">
  <link rel="canonical" href="${escapeHtml(`${origin}/iwd`)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>${renderStyles()}</style>
</head>
<body>
  <div id="map"></div>
  <div class="map-veil"></div>
  <div class="orb orb-a"></div>
  <div class="orb orb-b"></div>
  <div class="orb orb-c"></div>

  <div id="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-bolt">SL</div>
        <div>
          <span class="brand-kicker">March 8, 2026 / Live Atlas</span>
          <span class="brand-title">International Women’s Day</span>
          <span class="brand-subtitle">Celebrate every woman, in every language, with live messages and blooming map art.</span>
        </div>
      </div>
      <div class="topbar-stats">
        <div class="metric-chip">
          <span class="metric-chip__label">Visitors</span>
          <span class="metric-chip__value" id="total-visitors">0</span>
        </div>
        <div class="metric-chip">
          <span class="metric-chip__label">Artworks</span>
          <span class="metric-chip__value" id="total-artworks">0</span>
        </div>
      </div>
    </header>

    <main class="shell-grid">
      <section class="panel hero-panel">
        <div>
          <div class="panel-kicker">Festive World Feed</div>
          <h1 class="hero-title">Celebrate every woman, in every language.</h1>
        </div>
        <p class="hero-copy">
          The world map lights up as visitors check in, send a short note, and let Image Studio turn it into a joyful square card for everyone to see in real time.
        </p>
        <div class="greeting-card">
          <span class="greeting-card__label">Your Greeting</span>
          <strong class="greeting-card__value" id="hero-greeting">${escapeHtml(viewerGreeting.greeting)}</strong>
          <div class="greeting-card__meta" id="hero-language">${escapeHtml(
            `${viewerGreeting.languageLabel} greeting`,
          )}</div>
        </div>
        <div class="signal-strip">
          <div class="signal-tile">
            <span class="signal-tile__value" id="total-countries">0</span>
            <span class="signal-tile__label">Countries on today’s leaderboard.</span>
          </div>
          <div class="signal-tile">
            <span class="signal-tile__value" id="total-messages">0</span>
            <span class="signal-tile__label">Global chat drops now in the live feed.</span>
          </div>
        </div>
        <div class="world-ribbon" id="world-ribbon"></div>
      </section>

      <section class="panel leaderboard-panel">
        <div class="section-head">
          <div>
            <h2>Country Leaderboard</h2>
            <p>Top visitor countries today, each shown with a local-language greeting.</p>
          </div>
          <div class="section-badge">Live rank</div>
        </div>
        <div class="leaderboard-list" id="leaderboard-list"></div>
      </section>

      <section class="panel gallery-panel">
        <div class="section-head">
          <div>
            <h2>Global Chat + Art</h2>
            <p>Messages land immediately. When Image Studio finishes, the artwork blooms onto the map for everyone.</p>
          </div>
          <div class="section-badge" id="gallery-count">0 live artworks</div>
        </div>
        <div class="gallery-feed" id="gallery-feed"></div>
      </section>

      <section class="panel share-panel">
        <div class="section-head">
          <div>
            <h3>Share It Everywhere</h3>
            <p>Push the live celebration out without waiting for anyone else to discover it first.</p>
          </div>
        </div>
        <div class="share-grid" id="share-grid">
          <button type="button" class="share-btn" data-network="native"><strong>Share</strong><span>Use your device sheet</span></button>
          <button type="button" class="share-btn" data-network="copy"><strong>Copy</strong><span>Quick link for DM blasts</span></button>
          <button type="button" class="share-btn" data-network="x"><strong>X</strong><span>Send the live map out</span></button>
          <button type="button" class="share-btn" data-network="linkedin"><strong>LinkedIn</strong><span>Bring in the work crowd</span></button>
          <button type="button" class="share-btn" data-network="facebook"><strong>Facebook</strong><span>Community-friendly share</span></button>
          <button type="button" class="share-btn" data-network="whatsapp"><strong>WhatsApp</strong><span>Instant friend groups</span></button>
          <button type="button" class="share-btn" data-network="telegram"><strong>Telegram</strong><span>Fast broadcast channel</span></button>
          <button type="button" class="share-btn" data-network="reddit"><strong>Reddit</strong><span>When you want the crowd</span></button>
          <button type="button" class="share-btn" data-network="email"><strong>Email</strong><span>Keep the OG card intact</span></button>
        </div>
      </section>

      <section class="panel composer-panel">
        <div class="section-head">
          <div>
            <h3>Launch a Celebration</h3>
            <p>Choose up to three emojis, add a short note, and send it into a 0.5K square Image Studio generation.</p>
          </div>
          <div class="section-badge">Global chat</div>
        </div>
        <form id="composer-form" class="composer-form">
          <div class="emoji-picker" id="emoji-picker"></div>
          <textarea
            id="composer-text"
            class="composer-text"
            maxlength="${IWD_MESSAGE_MAX_LENGTH}"
            placeholder="Send a joyful note to women around the world."
          ></textarea>
          <div class="composer-actions">
            <div class="composer-note">
              Messages appear immediately. Finished artworks animate in for every visitor after Image Studio completes the run.
            </div>
            <button id="composer-send" class="send-btn" type="submit">Send To Image Studio</button>
          </div>
        </form>
      </section>
    </main>

    <div class="floating-stage" id="floating-stage" aria-live="polite"></div>
    <div class="status-note" id="status-note" aria-live="polite"></div>
  </div>

  <script id="iwd-boot" type="application/json">${safeJson({ viewerGreeting })}</script>
  <script id="iwd-emojis" type="application/json">${safeJson(ALLOWED_EMOJIS)}</script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script src="https://unpkg.com/canvas-confetti@1.9.3/dist/confetti.browser.js"><\/script>
  <script>${renderClientScript()}<\/script>
</body>
</html>`;
}

function jsonResponse(_c: Context<{ Bindings: Env }>, data: unknown, status = 200): Response {
  const headers = noStoreHeaders(
    new Headers({ "Content-Type": "application/json; charset=utf-8" }),
  );
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

iwd.get("/api/iwd/feed", async (c) => {
  const since = numberValue(c.req.query("since"), 0);
  const feed = await loadFeed(c.env.DB, since > 0 ? since : undefined);
  return jsonResponse(c, feed);
});

iwd.get("/api/iwd/visitors", async (c) => {
  const since = numberValue(c.req.query("since"), 0);
  const feed = await loadFeed(c.env.DB, since > 0 ? since : undefined);
  return jsonResponse(c, {
    visitors: feed.visitors,
    count: feed.totalVisitors,
    serverTime: feed.serverTime,
  });
});

iwd.post("/api/iwd/checkin", async (c) => {
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf;
  const cookies = parseCookies(c.req.header("cookie"));
  const acceptLanguage = c.req.header("accept-language");
  const dayStart = todayStartMs();

  const existingCookieId = cookies[IWD_COOKIE];
  if (existingCookieId) {
    const existing = await findTodayVisitor(c.env.DB, existingCookieId);
    if (existing) {
      const feed = await loadFeed(c.env.DB);
      const response = jsonResponse(c, {
        ok: true,
        isNew: false,
        visitor: normalizeVisitor(existing as unknown as Record<string, unknown>),
        viewerGreeting: resolveGreeting(acceptLanguage, existing.country),
        ...feed,
      });
      response.headers.set("Set-Cookie", serializeCookie(IWD_COOKIE, existing.id));
      return response;
    }
  }

  let latitude = numberValue(cf?.latitude, Number.NaN);
  let longitude = numberValue(cf?.longitude, Number.NaN);
  let city = typeof cf?.city === "string" ? cf.city : null;
  let country = typeof cf?.country === "string" ? cf.country : null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const fallbackIndex = randomArray[0]! % DEV_FALLBACK_LOCATIONS.length;
    const fallback = DEV_FALLBACK_LOCATIONS[fallbackIndex]!;
    latitude = fallback.latitude;
    longitude = fallback.longitude;
    city = fallback.city;
    country = fallback.country;
  }

  const greeting = resolveGreeting(acceptLanguage, country);

  const deduped = await c.env.DB.prepare(
    "SELECT id, latitude, longitude, city, country, locale, greeting, language_label, created_at FROM iwd_visitors WHERE latitude = ? AND longitude = ? AND city IS ? AND created_at >= ? LIMIT 1",
  )
    .bind(latitude, longitude, city, dayStart)
    .first<VisitorRow>();

  if (deduped) {
    const feed = await loadFeed(c.env.DB);
    const response = jsonResponse(c, {
      ok: true,
      isNew: false,
      visitor: normalizeVisitor(deduped as unknown as Record<string, unknown>),
      viewerGreeting: greeting,
      ...feed,
    });
    response.headers.set("Set-Cookie", serializeCookie(IWD_COOKIE, deduped.id));
    return response;
  }

  const inserted = await c.env.DB.prepare(
    "INSERT INTO iwd_visitors (latitude, longitude, city, country, locale, greeting, language_label) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, latitude, longitude, city, country, locale, greeting, language_label, created_at",
  )
    .bind(
      latitude,
      longitude,
      city,
      country,
      greeting.locale,
      greeting.greeting,
      greeting.languageLabel,
    )
    .first<VisitorRow>();

  const feed = await loadFeed(c.env.DB);
  const response = jsonResponse(c, {
    ok: true,
    isNew: true,
    visitor: inserted ? normalizeVisitor(inserted as unknown as Record<string, unknown>) : null,
    viewerGreeting: greeting,
    ...feed,
  });
  if (inserted?.id) {
    response.headers.set("Set-Cookie", serializeCookie(IWD_COOKIE, inserted.id));
  }
  return response;
});

iwd.post("/api/iwd/message", async (c) => {
  const cookies = parseCookies(c.req.header("cookie"));
  const cookieVisitorId = cookies[IWD_COOKIE];
  let body: { text?: unknown; emojis?: unknown; visitorId?: unknown } | null = null;
  try {
    body = (await c.req.json()) as { text?: unknown; emojis?: unknown; visitorId?: unknown };
  } catch {
    body = null;
  }

  const visitorId =
    (typeof body?.visitorId === "string" && body.visitorId) || cookieVisitorId || "";
  if (!visitorId) {
    return jsonResponse(
      c,
      { error: "Visit the map first so we know where to place your message." },
      400,
    );
  }

  const visitor = await findTodayVisitor(c.env.DB, visitorId);
  if (!visitor) {
    return jsonResponse(
      c,
      { error: "Your visitor session expired. Refresh the page and try again." },
      400,
    );
  }

  const text = sanitizeMessageText(body?.text);
  const emojis = sanitizeEmojis(body?.emojis);
  if (!text && emojis.length === 0) {
    return jsonResponse(c, { error: "Add a short note or at least one emoji." }, 400);
  }

  const lastMessage = await c.env.DB.prepare(
    "SELECT created_at FROM iwd_messages WHERE visitor_id = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(visitor.id)
    .first<{ created_at: number | string }>();

  if (lastMessage && Date.now() - numberValue(lastMessage.created_at) < IWD_MESSAGE_COOLDOWN_MS) {
    return jsonResponse(
      c,
      { error: "Give the last celebration a few seconds to land before sending another." },
      429,
    );
  }

  const inserted = await c.env.DB.prepare(
    "INSERT INTO iwd_messages (visitor_id, text, emoji_json, country, city, latitude, longitude, locale, greeting, image_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROCESSING', ?) RETURNING id, visitor_id, text, emoji_json, country, city, latitude, longitude, locale, greeting, image_prompt, image_job_id, image_url, image_status, error_message, created_at, updated_at",
  )
    .bind(
      visitor.id,
      text,
      JSON.stringify(emojis),
      visitor.country,
      visitor.city,
      visitor.latitude,
      visitor.longitude,
      visitor.locale,
      visitor.greeting,
      Date.now(),
    )
    .first<MessageRow>();

  if (!inserted) {
    return jsonResponse(c, { error: "Message launch failed." }, 500);
  }

  const normalized = normalizeMessage(inserted as unknown as Record<string, unknown>);
  try {
    c.executionCtx.waitUntil(generateArtwork(c.env, normalized));
  } catch {
    void generateArtwork(c.env, normalized);
  }

  return jsonResponse(c, { ok: true, message: normalized });
});

iwd.get("/iwd/og.svg", () => {
  return new Response(buildIwdOgSvg(), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

iwd.get("/iwd", (c) => {
  const origin = new URL(c.req.url).origin;
  const viewerGreeting = resolveGreeting(c.req.header("accept-language"), null);
  return c.html(renderPage(origin, viewerGreeting));
});

export { ALLOWED_EMOJIS, buildIwdOgSvg, iwd, resolveGreeting };
