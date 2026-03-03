export const ESCO_API_BASE = "https://ec.europa.eu/esco/api";
export const IP_API_BASE = "http://ip-api.com/json";
export const ADZUNA_API_BASE = "https://api.adzuna.com/v1/api/jobs";

export const CACHE_TTL = 86400; // 24 hours in seconds
export const CACHE_PREFIX = "career:";

export const ESCO_SKILL_CATEGORIES = [
  "communication",
  "digital",
  "languages",
  "management",
  "problem-solving",
  "science",
  "social",
  "technical",
] as const;

export const DEFAULT_COUNTRY_CODE = "gb";
export const DEFAULT_RESULTS_LIMIT = 10;
export const MAX_SKILLS_PER_ASSESSMENT = 50;
