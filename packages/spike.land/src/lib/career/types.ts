export interface EscoSkill {
  uri: string;
  title: string;
  description: string;
  skillType: "skill" | "knowledge" | "competence";
}

export interface UserSkill {
  uri: string;
  title: string;
  proficiency: number; // 1-5
}

export interface OccupationSkillRequirement {
  uri: string;
  title: string;
  skillType: "essential" | "optional";
  importance: number; // 0-1 weight
}

export interface Occupation {
  uri: string;
  title: string;
  description: string;
  iscoGroup: string;
  skills: OccupationSkillRequirement[];
  alternativeLabels: string[];
}

export interface MatchResult {
  occupation: Occupation;
  score: number; // 0-100
  matchedSkills: number;
  totalRequired: number;
  gaps: SkillGap[];
}

export interface SkillGap {
  skill: OccupationSkillRequirement;
  userProficiency: number; // 0 if not possessed
  requiredLevel: number; // normalized 1-5
  gap: number; // difference
  priority: "high" | "medium" | "low";
}

export interface GeoLocation {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  description: string;
  url: string;
  created: string;
  category: string;
}

export interface SalaryData {
  median: number;
  p25: number;
  p75: number;
  currency: string;
  source: string;
  location: string;
}

export interface AssessmentResult {
  userSkills: UserSkill[];
  matches: MatchResult[];
  timestamp: number;
  location: GeoLocation | null;
}

// ESCO API response types
export interface EscoSearchResponse {
  count: number;
  offset: number;
  total: number;
  _embedded: {
    results: EscoSearchResult[];
  };
}

export interface EscoSearchResult {
  uri: string;
  title: string;
  className: string;
  _links: { self: { href: string } };
}

export interface EscoOccupationDetail {
  uri: string;
  title: string;
  description: { en: { literal: string } };
  code: string;
  _links: {
    hasEssentialSkill: Array<{ uri: string; title: string; skillType: string }>;
    hasOptionalSkill: Array<{ uri: string; title: string; skillType: string }>;
    iscoGroup: Array<{ uri: string; title: string }>;
    broaderOccupation?: Array<{ uri: string; title: string }>;
  };
  alternativeLabel?: { en: string[] };
}

// Adzuna API response types
export interface AdzunaSearchResponse {
  results: AdzunaJob[];
  count: number;
  mean: number;
}

export interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  redirect_url: string;
  created: string;
  category: { label: string };
}
