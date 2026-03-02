import { getCacheRaw, setCacheRaw } from "@/lib/cache";
import {
  ADZUNA_API_BASE,
  CACHE_PREFIX,
  CACHE_TTL,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_RESULTS_LIMIT,
} from "../constants";
import type { AdzunaSearchResponse, JobListing, SalaryData } from "../types";

function cacheKey(...parts: string[]): string {
  return `${CACHE_PREFIX}${parts.join(":")}`;
}

function getAdzunaCredentials(): { appId: string; appKey: string } {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    throw new Error("ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables are required");
  }

  return { appId, appKey };
}

function mapAdzunaJob(job: AdzunaSearchResponse["results"][number]): JobListing {
  return {
    id: job.id,
    title: job.title,
    company: job.company.display_name,
    location: job.location.display_name,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    currency: "GBP",
    description: job.description,
    url: job.redirect_url,
    created: job.created,
    category: job.category.label,
  };
}

const VALID_COUNTRY_CODES = new Set([
  "gb",
  "us",
  "au",
  "ca",
  "de",
  "fr",
  "nl",
  "nz",
  "pl",
  "ru",
  "sg",
  "za",
  "br",
  "at",
  "be",
  "ch",
  "es",
  "in",
  "it",
  "mx",
  "se",
]);

export async function searchJobs(
  query: string,
  location?: string,
  countryCode = DEFAULT_COUNTRY_CODE,
  page = 1,
  limit = DEFAULT_RESULTS_LIMIT,
): Promise<{ jobs: JobListing[]; total: number }> {
  if (!VALID_COUNTRY_CODES.has(countryCode.toLowerCase())) {
    throw new Error(`Invalid country code: ${countryCode}`);
  }

  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`Invalid page number: ${page}`);
  }

  const key = cacheKey("jobs", query, location ?? "", countryCode, String(page), String(limit));
  const cached = await getCacheRaw<{ jobs: JobListing[]; total: number }>(key);
  if (cached) return cached;

  const { appId, appKey } = getAdzunaCredentials();

  const url = new URL(`${ADZUNA_API_BASE}/${countryCode}/search/${page}`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("what", query);
  url.searchParams.set("results_per_page", String(limit));
  url.searchParams.set("content-type", "application/json");

  if (location) {
    url.searchParams.set("where", location);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AdzunaSearchResponse;

  const result = {
    jobs: data.results.map(mapAdzunaJob),
    total: data.count,
  };

  await setCacheRaw(key, result, 3600); // 1 hour TTL for job listings
  return result;
}

export async function getSalaryEstimate(
  occupationTitle: string,
  countryCode = DEFAULT_COUNTRY_CODE,
): Promise<SalaryData> {
  if (!VALID_COUNTRY_CODES.has(countryCode.toLowerCase())) {
    throw new Error(`Invalid country code: ${countryCode}`);
  }

  const key = cacheKey("salary", occupationTitle, countryCode);
  const cached = await getCacheRaw<SalaryData>(key);
  if (cached) return cached;

  const { appId, appKey } = getAdzunaCredentials();

  // Use Adzuna's search with salary data to estimate
  const url = new URL(`${ADZUNA_API_BASE}/${countryCode}/search/1`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("what", occupationTitle);
  url.searchParams.set("results_per_page", "50");
  url.searchParams.set("salary_include_unknown", "0");
  url.searchParams.set("content-type", "application/json");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Adzuna API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AdzunaSearchResponse;

  // Extract salary data from results
  const salaries = data.results
    .filter((j) => j.salary_min !== null && j.salary_max !== null)
    .map((j) => ((j.salary_min ?? 0) + (j.salary_max ?? 0)) / 2)
    .sort((a, b) => a - b);

  if (salaries.length === 0) {
    // Fall back to mean from Adzuna if no individual salaries
    const salaryData: SalaryData = {
      median: data.mean,
      p25: Math.round(data.mean * 0.8),
      p75: Math.round(data.mean * 1.2),
      currency: countryCode === "us" ? "USD" : "GBP",
      source: "adzuna",
      location: countryCode.toUpperCase(),
    };
    await setCacheRaw(key, salaryData, CACHE_TTL);
    return salaryData;
  }

  const p25Index = Math.floor(salaries.length * 0.25);
  const medianIndex = Math.floor(salaries.length * 0.5);
  const p75Index = Math.floor(salaries.length * 0.75);

  const salaryData: SalaryData = {
    median: Math.round(salaries[medianIndex] ?? 0),
    p25: Math.round(salaries[p25Index] ?? 0),
    p75: Math.round(salaries[p75Index] ?? 0),
    currency: countryCode === "us" ? "USD" : "GBP",
    source: "adzuna",
    location: countryCode.toUpperCase(),
  };

  await setCacheRaw(key, salaryData, CACHE_TTL);
  return salaryData;
}
