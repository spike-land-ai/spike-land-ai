"use client";

import { useState } from "react";
import {
  AccessibilityPanel,
  Breadcrumbs,
  CodePreview,
  ComponentSample,
  PageHeader,
  RelatedComponents,
  UsageGuide,
} from "@/components/storybook";
import { OccupationCard } from "@/components/career/OccupationCard";
import { JobListingCard } from "@/components/career/JobListingCard";
import { MatchBadge } from "@/components/career/MatchBadge";
import { SkillProficiencySlider } from "@/components/career/SkillProficiencySlider";
import { CareerHero } from "@/components/career/CareerHero";
import { SalaryChart } from "@/components/career/SalaryChart";
import { SkillGapTable } from "@/components/career/SkillGapTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  MapPin,
  Target,
  TrendingUp,
} from "lucide-react";
import type {
  JobListing,
  Occupation,
  SalaryData,
  SkillGap,
} from "@/lib/career/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockOccupations: Occupation[] = [
  {
    uri: "http://data.europa.eu/esco/occupation/1",
    title: "Full-Stack Developer",
    description:
      "Designs, develops, and maintains web applications across front-end and back-end layers using modern frameworks and cloud infrastructure.",
    iscoGroup: "2512",
    alternativeLabels: ["Web Developer", "Software Engineer"],
    skills: [
      {
        uri: "s1",
        title: "TypeScript",
        skillType: "essential",
        importance: 0.9,
      },
      { uri: "s2", title: "React", skillType: "essential", importance: 0.85 },
      { uri: "s3", title: "Node.js", skillType: "essential", importance: 0.8 },
      { uri: "s4", title: "SQL", skillType: "optional", importance: 0.5 },
    ],
  },
  {
    uri: "http://data.europa.eu/esco/occupation/2",
    title: "Data Scientist",
    description:
      "Analyses complex datasets to derive insights and build predictive models using statistical methods and machine learning techniques.",
    iscoGroup: "2120",
    alternativeLabels: ["ML Engineer", "Data Analyst"],
    skills: [
      { uri: "s5", title: "Python", skillType: "essential", importance: 0.95 },
      {
        uri: "s6",
        title: "Machine Learning",
        skillType: "essential",
        importance: 0.9,
      },
      {
        uri: "s7",
        title: "Statistics",
        skillType: "essential",
        importance: 0.85,
      },
      {
        uri: "s8",
        title: "Data Visualisation",
        skillType: "optional",
        importance: 0.6,
      },
    ],
  },
  {
    uri: "http://data.europa.eu/esco/occupation/3",
    title: "UX Designer",
    description:
      "Creates user-centred designs through research, wireframing, prototyping, and usability testing to improve digital product experiences.",
    iscoGroup: "2166",
    alternativeLabels: ["Product Designer", "Interaction Designer"],
    skills: [
      {
        uri: "s9",
        title: "User Research",
        skillType: "essential",
        importance: 0.9,
      },
      {
        uri: "s10",
        title: "Prototyping",
        skillType: "essential",
        importance: 0.85,
      },
      { uri: "s11", title: "Figma", skillType: "essential", importance: 0.8 },
    ],
  },
  {
    uri: "http://data.europa.eu/esco/occupation/4",
    title: "DevOps Engineer",
    description:
      "Automates and optimises CI/CD pipelines, infrastructure provisioning, and monitoring to improve software delivery speed and reliability.",
    iscoGroup: "2511",
    alternativeLabels: ["Platform Engineer", "SRE"],
    skills: [
      { uri: "s12", title: "Docker", skillType: "essential", importance: 0.9 },
      {
        uri: "s13",
        title: "Kubernetes",
        skillType: "essential",
        importance: 0.85,
      },
      {
        uri: "s14",
        title: "Terraform",
        skillType: "essential",
        importance: 0.8,
      },
      { uri: "s15", title: "Linux", skillType: "essential", importance: 0.75 },
      {
        uri: "s16",
        title: "Monitoring",
        skillType: "optional",
        importance: 0.5,
      },
    ],
  },
];

const mockJobListings: JobListing[] = [
  {
    id: "job-1",
    title: "Senior React Developer",
    company: "TechCorp Ltd",
    location: "London, UK (Remote)",
    salary_min: 65000,
    salary_max: 90000,
    currency: "\u00a3",
    description: "Join our team building next-generation web applications.",
    url: "#",
    created: "2026-02-20",
    category: "IT Jobs",
  },
  {
    id: "job-2",
    title: "Machine Learning Engineer",
    company: "DataFlow AI",
    location: "Berlin, Germany",
    salary_min: 70000,
    salary_max: 110000,
    currency: "\u20ac",
    description: "Work on cutting-edge NLP and computer vision models.",
    url: "#",
    created: "2026-02-18",
    category: "Engineering",
  },
  {
    id: "job-3",
    title: "Junior UX Designer",
    company: "DesignHub",
    location: "Manchester, UK",
    salary_min: null,
    salary_max: 45000,
    currency: "\u00a3",
    description: "Great opportunity for early-career designers.",
    url: "#",
    created: "2026-02-15",
    category: "Design",
  },
];

const mockSalary: SalaryData = {
  median: 72000,
  p25: 55000,
  p75: 95000,
  currency: "\u00a3",
  source: "Adzuna Salary Estimates",
  location: "United Kingdom",
};

const mockSkillGaps: SkillGap[] = [
  {
    skill: {
      uri: "s13",
      title: "Kubernetes",
      skillType: "essential",
      importance: 0.85,
    },
    userProficiency: 1,
    requiredLevel: 4,
    gap: 3,
    priority: "high",
  },
  {
    skill: {
      uri: "s14",
      title: "Terraform",
      skillType: "essential",
      importance: 0.8,
    },
    userProficiency: 2,
    requiredLevel: 4,
    gap: 2,
    priority: "medium",
  },
  {
    skill: {
      uri: "s12",
      title: "Docker",
      skillType: "essential",
      importance: 0.9,
    },
    userProficiency: 3,
    requiredLevel: 4,
    gap: 1,
    priority: "low",
  },
  {
    skill: {
      uri: "s15",
      title: "Linux",
      skillType: "essential",
      importance: 0.75,
    },
    userProficiency: 2,
    requiredLevel: 3,
    gap: 1,
    priority: "low",
  },
  {
    skill: {
      uri: "s16",
      title: "Monitoring",
      skillType: "optional",
      importance: 0.5,
    },
    userProficiency: 0,
    requiredLevel: 3,
    gap: 3,
    priority: "high",
  },
];

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

const codeSnippets = {
  occupationCard: `import { OccupationCard } from "@/components/career/OccupationCard";

<OccupationCard
  occupation={{
    uri: "http://data.europa.eu/esco/occupation/1",
    title: "Full-Stack Developer",
    description: "Designs, develops, and maintains web apps...",
    iscoGroup: "2512",
    alternativeLabels: ["Web Developer"],
    skills: [
      { uri: "s1", title: "TypeScript", skillType: "essential", importance: 0.9 },
    ],
  }}
  matchScore={92}
/>`,
  jobListingCard: `import { JobListingCard } from "@/components/career/JobListingCard";

<JobListingCard
  job={{
    id: "job-1",
    title: "Senior React Developer",
    company: "TechCorp Ltd",
    location: "London, UK (Remote)",
    salary_min: 65000,
    salary_max: 90000,
    currency: "\u00a3",
    description: "Join our team building next-gen web apps.",
    url: "https://example.com/job/1",
    created: "2026-02-20",
    category: "IT Jobs",
  }}
/>`,
  skillGapTable: `import { SkillGapTable } from "@/components/career/SkillGapTable";

<SkillGapTable
  gaps={[
    {
      skill: { uri: "s13", title: "Kubernetes", skillType: "essential", importance: 0.85 },
      userProficiency: 1,
      requiredLevel: 4,
      gap: 3,
      priority: "high",
    },
    // ...more gaps
  ]}
/>`,
  matchBadge: `import { MatchBadge } from "@/components/career/MatchBadge";

<MatchBadge score={92} />  {/* Green: 70%+ */}
<MatchBadge score={55} />  {/* Amber: 40-69% */}
<MatchBadge score={25} />  {/* Red: below 40% */}`,
  slider: `import { SkillProficiencySlider } from "@/components/career/SkillProficiencySlider";

const [value, setValue] = useState(3);

<SkillProficiencySlider value={value} onChange={setValue} />`,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CareerStorybookPage() {
  const [sliderValue, setSliderValue] = useState(3);

  return (
    <div className="space-y-16 pb-20">
      <Breadcrumbs />

      <PageHeader
        title="Career Navigator"
        description="The Career Navigator helps users discover occupations that match their skills using the European ESCO framework. It includes skill assessment, occupation matching, job listings, salary data, and skill gap analysis."
        usage="Use these components to build career exploration flows: start with CareerHero, let users assess skills with SkillProficiencySlider, display matches via OccupationCard and MatchBadge, then drill into details with SalaryChart, JobListingCard, and SkillGapTable."
      />

      <UsageGuide
        dos={[
          "Use OccupationCard in a responsive grid for browsing occupations.",
          "Show MatchBadge alongside occupation results to indicate relevance.",
          "Use SalaryChart to give users transparent salary expectations.",
          "Present SkillGapTable after a match to guide upskilling decisions.",
          "Keep CareerHero at the top of career landing pages for context.",
          "Combine JobListingCard with filters for company, location, and salary range.",
        ]}
        donts={[
          "Don't display match scores without explaining the methodology.",
          "Don't show salary data without citing the source.",
          "Avoid overloading a single view with all components at once.",
          "Don't use SkillProficiencySlider without a visible label for the skill name.",
          "Don't show skill gap analysis without the user first completing a self-assessment.",
        ]}
      />

      {/* CareerHero */}
      <ComponentSample
        title="CareerHero"
        description="A full-width hero section introducing the Career Navigator. Uses a gradient background and centred copy."
      >
        <div className="w-full -m-8 md:-m-12">
          <CareerHero />
        </div>
      </ComponentSample>

      {/* OccupationCard */}
      <ComponentSample
        title="OccupationCard"
        description="Displays an occupation with skill count, ISCO code, and optional match score badge. Designed for grid layouts."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {mockOccupations.map((occ, i) => (
            <OccupationCard
              key={occ.uri}
              occupation={occ}
              {...(([92, 78, 55, 34][i]) !== undefined ? { matchScore: [92, 78, 55, 34][i] } : {})}
            />
          ))}
        </div>
      </ComponentSample>

      {/* MatchBadge */}
      <ComponentSample
        title="MatchBadge"
        description="A colour-coded badge showing match percentage. Green for 70%+, amber for 40-69%, red for below 40%."
      >
        <div className="flex flex-wrap gap-6 items-center">
          {[95, 82, 70, 55, 40, 25, 10].map(score => (
            <div key={score} className="flex flex-col items-center gap-2">
              <MatchBadge score={score} />
              <span className="text-xs text-muted-foreground">
                {score >= 70 ? "Strong" : score >= 40 ? "Moderate" : "Low"}
              </span>
            </div>
          ))}
        </div>
      </ComponentSample>

      {/* SkillProficiencySlider */}
      <ComponentSample
        title="SkillProficiencySlider"
        description="An interactive slider (1-5) for users to rate their proficiency in a skill. Labels: Beginner, Basic, Intermediate, Advanced, Expert."
      >
        <div className="space-y-4 w-full max-w-md">
          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground w-28">TypeScript</span>
            <SkillProficiencySlider
              value={sliderValue}
              onChange={setSliderValue}
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground w-28">React</span>
            <SkillProficiencySlider value={4} onChange={() => {}} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground w-28">Kubernetes</span>
            <SkillProficiencySlider value={1} onChange={() => {}} />
          </div>
        </div>
      </ComponentSample>

      {/* Job Listing Cards -- enhanced demo with rich details */}
      <ComponentSample
        title="JobListingCard"
        description="Displays a job listing with company, location, salary range, and category. Includes an external link icon for the full posting."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          {mockJobListings.map(job => <JobListingCard key={job.id} job={job} />)}
        </div>
      </ComponentSample>

      {/* Job Listing Summary Dashboard */}
      <ComponentSample
        title="Job Listings Summary"
        description="A compact dashboard view showing job listing highlights: total count, top locations, salary ranges, and categories at a glance."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <Card className="glass-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Open Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold font-mono text-foreground">
                {mockJobListings.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Matching your profile
              </p>
            </CardContent>
          </Card>

          <Card className="glass-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(
                  new Set(mockJobListings.map(j => j.location.split(",")[0])),
                ).map(
                  loc => (
                    <Badge key={loc} variant="secondary" className="text-xs">
                      {loc}
                    </Badge>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Salary Range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold font-mono text-foreground">
                {"\u00a3"}45k &ndash; {"\u00a3"}110k
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Across all listings
              </p>
            </CardContent>
          </Card>

          <Card className="glass-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(mockJobListings.map(j => j.category)))
                  .map(cat => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {cat}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ComponentSample>

      {/* SalaryChart */}
      <ComponentSample
        title="SalaryChart"
        description="A bar chart showing 25th percentile, median, and 75th percentile salary data. Built with Recharts and wrapped in a Card."
      >
        <div className="w-full max-w-lg">
          <SalaryChart salary={mockSalary} />
        </div>
      </ComponentSample>

      {/* Skill Gap Analysis Demo */}
      <ComponentSample
        title="Skill Gap Analysis"
        description="A comprehensive view combining the SkillGapTable with visual priority indicators. High-priority gaps are flagged with warning icons, medium with targets, and addressed skills with checkmarks."
      >
        <div className="space-y-6 w-full max-w-2xl">
          {/* Visual priority summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="glass-1 border-red-500/20 bg-red-500/5">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {mockSkillGaps.filter(g => g.priority === "high").length} Critical
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Immediate action needed
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-1 border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-4 flex items-center gap-3">
                <Target className="h-5 w-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {mockSkillGaps.filter(g => g.priority === "medium")
                      .length} Moderate
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Plan to improve
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-1 border-green-500/20 bg-green-500/5">
              <CardContent className="pt-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {mockSkillGaps.filter(g => g.priority === "low").length} On Track
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Minor gap remaining
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Skill progress bars */}
          <div className="space-y-3">
            {mockSkillGaps.map(gap => (
              <div key={gap.skill.uri} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {gap.skill.title}
                    </span>
                    <Badge
                      variant={gap.priority === "high"
                        ? "destructive"
                        : gap.priority === "medium"
                        ? "warning"
                        : "success"}
                      className="text-[10px] px-1.5"
                    >
                      {gap.priority}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {gap.userProficiency}/{gap.requiredLevel}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      gap.priority === "high"
                        ? "bg-red-400"
                        : gap.priority === "medium"
                        ? "bg-amber-400"
                        : "bg-green-400"
                    }`}
                    style={{
                      width: `${(gap.userProficiency / gap.requiredLevel) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Upskilling CTA */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Upskilling Recommendations
                </p>
                <p className="text-xs text-muted-foreground">
                  Focus on Kubernetes and Monitoring for the biggest impact
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
          </div>
        </div>
      </ComponentSample>

      {/* SkillGapTable */}
      <ComponentSample
        title="SkillGapTable"
        description="A sortable table showing the gap between required and current skill levels. Colour-coded priority badges (high, medium, low) guide upskilling focus."
      >
        <div className="w-full max-w-2xl">
          <SkillGapTable gaps={mockSkillGaps} />
        </div>
      </ComponentSample>

      {/* Code Snippets */}
      <CodePreview
        code={codeSnippets.occupationCard}
        title="Career Components"
        tabs={[
          { label: "OccupationCard", code: codeSnippets.occupationCard },
          { label: "JobListingCard", code: codeSnippets.jobListingCard },
          { label: "SkillGapTable", code: codeSnippets.skillGapTable },
          { label: "MatchBadge", code: codeSnippets.matchBadge },
          { label: "Slider", code: codeSnippets.slider },
        ]}
      />

      <AccessibilityPanel
        notes={[
          "OccupationCard renders as a link element, fully keyboard-navigable.",
          "MatchBadge uses semantic colour and text to convey status (not colour alone).",
          "SkillProficiencySlider is built on Radix Slider with full ARIA support.",
          "SalaryChart includes a text source citation for non-visual users.",
          "SkillGapTable uses proper table semantics (thead, th, tbody) for screen readers.",
          "All interactive elements meet the 44px minimum touch target guideline.",
          "Colour contrast on badges exceeds WCAG AA for both dark and light themes.",
          "Skill gap progress bars include numeric labels for screen reader context.",
          "Priority summary cards use both icons and text labels for dual encoding.",
        ]}
      />

      <RelatedComponents currentId="career" />
    </div>
  );
}
