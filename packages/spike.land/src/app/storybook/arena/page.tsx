"use client";

import {
  AccessibilityPanel,
  Breadcrumbs,
  CodePreview,
  ComponentSample,
  PageHeader,
  RelatedComponents,
  UsageGuide,
} from "@/components/storybook";
import { ChallengeCard } from "@/components/arena/ChallengeCard";
import { PhaseSteps } from "@/components/arena/PhaseSteps";
import { TokenCounter } from "@/components/arena/TokenCounter";
import { SubmissionCard } from "@/components/arena/SubmissionCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Award,
  Crown,
  Flame,
  Medal,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import type { ArenaPhase } from "@/lib/arena/types";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockChallenges = [
  {
    id: "chess-grandmaster-ai",
    title: "Chess Grandmaster AI",
    description:
      "Build a React chess interface with drag-and-drop pieces, legal move highlighting, and a basic minimax AI opponent.",
    category: "GAMES",
    difficulty: "EXPERT",
    submissionCount: 47,
  },
  {
    id: "strategy-war-map",
    title: "Strategy War Map",
    description:
      "Create an interactive hex-grid war map with unit placement, terrain types, and turn-based movement rules.",
    category: "GAMES",
    difficulty: "ADVANCED",
    submissionCount: 23,
  },
  {
    id: "pixel-art-editor",
    title: "Pixel Art Editor",
    description:
      "Design a pixel art editor with a color palette, grid canvas, undo/redo, and export to PNG.",
    category: "CREATIVE",
    difficulty: "INTERMEDIATE",
    submissionCount: 89,
  },
  {
    id: "quiz-arena-builder",
    title: "Quiz Arena Builder",
    description:
      "Create a multiplayer quiz game with timed rounds, score tracking, and a podium finish screen.",
    category: "EDUCATION",
    difficulty: "BEGINNER",
    submissionCount: 156,
  },
];

const mockLeaderboard = [
  {
    rank: 1,
    userId: "u1",
    userName: "NovaStar",
    userImage: null,
    elo: 2147,
    wins: 34,
    losses: 6,
    draws: 2,
    streak: 7,
    bestElo: 2147,
  },
  {
    rank: 2,
    userId: "u2",
    userName: "PixelForge",
    userImage: null,
    elo: 1983,
    wins: 28,
    losses: 11,
    draws: 3,
    streak: 3,
    bestElo: 2010,
  },
  {
    rank: 3,
    userId: "u3",
    userName: "CodeAlchemist",
    userImage: null,
    elo: 1876,
    wins: 22,
    losses: 14,
    draws: 5,
    streak: -2,
    bestElo: 1920,
  },
  {
    rank: 4,
    userId: "u4",
    userName: "ByteQueen",
    userImage: null,
    elo: 1801,
    wins: 19,
    losses: 15,
    draws: 4,
    streak: 1,
    bestElo: 1855,
  },
  {
    rank: 5,
    userId: "u5",
    userName: "SyntaxSamurai",
    userImage: null,
    elo: 1745,
    wins: 16,
    losses: 18,
    draws: 6,
    streak: 0,
    bestElo: 1800,
  },
];

const mockSubmissions = [
  {
    id: "sub-1",
    status: "SCORED",
    codespaceUrl: "https://spike.land/live/chess-demo",
    reviewScore: 0.92,
    eloChange: 24,
    iterations: 3,
    inputTokens: 1240,
    outputTokens: 3800,
    totalDurationMs: 12400,
    userName: "NovaStar",
    userImage: null,
    reviewCount: 2,
  },
  {
    id: "sub-2",
    status: "REVIEWING",
    codespaceUrl: "https://spike.land/live/strategy-map",
    reviewScore: null,
    eloChange: null,
    iterations: 2,
    inputTokens: 980,
    outputTokens: 2900,
    totalDurationMs: 8700,
    userName: "PixelForge",
    userImage: null,
    reviewCount: 0,
  },
  {
    id: "sub-3",
    status: "FAILED",
    codespaceUrl: null,
    reviewScore: null,
    eloChange: -15,
    iterations: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalDurationMs: null,
    userName: "CodeAlchemist",
    userImage: null,
    reviewCount: 0,
    errors: [
      {
        error: "Module not found: @/components/Board",
        iteration: 0,
        fixed: false,
      },
    ],
  },
];

const allPhases: ArenaPhase[] = [
  "PROMPTED",
  "GENERATING",
  "TRANSPILING",
  "REVIEWING",
  "SCORED",
  "FAILED",
];

// ---------------------------------------------------------------------------
// Medal icon helper
// ---------------------------------------------------------------------------

function RankIcon({ rank }: { rank: number; }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-300" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return (
    <span className="font-mono text-muted-foreground text-sm w-5 text-center">
      #{rank}
    </span>
  );
}

function StreakIndicator({ streak }: { streak: number; }) {
  if (streak > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-green-400 font-mono">
        <TrendingUp className="h-3.5 w-3.5" />
        +{streak}
      </span>
    );
  }
  if (streak < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 font-mono">
        <TrendingDown className="h-3.5 w-3.5" />
        {streak}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground font-mono">
      <Minus className="h-3.5 w-3.5" />
      0
    </span>
  );
}

// ---------------------------------------------------------------------------
// ELO animation demo data
// ---------------------------------------------------------------------------

const eloAnimations = [
  { label: "Win (+24)", delta: 24, from: 2123, to: 2147 },
  { label: "Loss (-15)", delta: -15, from: 1891, to: 1876 },
  { label: "Draw (+2)", delta: 2, from: 1799, to: 1801 },
];

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

const codeSnippets = {
  challenge: `import { ChallengeCard } from "@/components/arena/ChallengeCard";

<ChallengeCard
  id="chess-grandmaster-ai"
  title="Chess Grandmaster AI"
  description="Build a chess interface with drag-and-drop..."
  category="GAMES"
  difficulty="EXPERT"
  submissionCount={47}
/>`,
  leaderboard: `import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table";

{leaderboard.map((entry) => (
  <TableRow key={entry.userId}>
    <TableCell>{entry.rank}</TableCell>
    <TableCell>{entry.userName}</TableCell>
    <TableCell>{entry.elo}</TableCell>
    <TableCell>{entry.wins}/{entry.losses}/{entry.draws}</TableCell>
  </TableRow>
))}`,
  phaseSteps: `import { PhaseSteps } from "@/components/arena/PhaseSteps";

<PhaseSteps currentPhase="GENERATING" />`,
  submission: `import { SubmissionCard } from "@/components/arena/SubmissionCard";

<SubmissionCard
  id="sub-1"
  status="SCORED"
  reviewScore={0.92}
  eloChange={24}
  userName="NovaStar"
  iterations={3}
  inputTokens={1240}
  outputTokens={3800}
  totalDurationMs={12400}
  reviewCount={2}
/>`,
  tokenCounter: `import { TokenCounter } from "@/components/arena/TokenCounter";

<TokenCounter text="Build a chess game with AI opponent..." />`,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArenaPage() {
  return (
    <div className="space-y-16 pb-20">
      <Breadcrumbs />

      <PageHeader
        title="Arena & Gaming"
        description="The Arena is spike.land's competitive AI prompt battleground. Players write single-shot prompts to generate React apps, compete on ELO rankings, and climb leaderboards across creative and technical challenges."
        usage="Use Arena components to display challenges, track submissions through generation phases, show leaderboard rankings, and visualize token usage."
      />

      <UsageGuide
        dos={[
          "Use ChallengeCard in a grid layout for browsing open competitions.",
          "Show PhaseSteps during active submissions to indicate progress.",
          "Display the Leaderboard sidebar alongside challenges for context.",
          "Use SubmissionCard to show detailed results including ELO changes.",
          "Use medal icons (Crown, Medal, Award) for top-3 leaderboard positions.",
        ]}
        donts={[
          "Don't show the full ArenaDashboard in modals or overlays -- it needs space.",
          "Avoid displaying raw ELO numbers without context (rank, streak).",
          "Don't hide the phase indicator during active generation -- users need feedback.",
          "Avoid showing token counts without the TokenCounter component for consistency.",
          "Don't animate ELO changes on initial page load -- only on state transitions.",
        ]}
      />

      {/* Challenge Cards */}
      <ComponentSample
        title="Challenge Cards"
        description="Cards representing open arena challenges. Each card shows the category, difficulty, title, description, and submission count."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {mockChallenges.map(c => (
            <ChallengeCard
              key={c.id}
              id={c.id}
              title={c.title}
              description={c.description}
              category={c.category}
              difficulty={c.difficulty}
              submissionCount={c.submissionCount}
            />
          ))}
        </div>
      </ComponentSample>

      {/* Leaderboard with medal icons */}
      <ComponentSample
        title="Leaderboard"
        description="ELO-based rankings for arena competitors. Top-3 positions receive medal icons (gold crown, silver medal, bronze award). Shows rank, player name, ELO rating, W/L/D record, streak indicator with directional icons, and personal best."
      >
        <div className="w-full max-w-3xl border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground w-16">
                  Rank
                </TableHead>
                <TableHead className="text-muted-foreground">Player</TableHead>
                <TableHead className="text-muted-foreground text-right">
                  ELO
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  W/L/D
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  Streak
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  Best
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockLeaderboard.map(entry => (
                <TableRow
                  key={entry.userId}
                  className="border-border hover:bg-muted/50"
                >
                  <TableCell>
                    <RankIcon rank={entry.rank} />
                  </TableCell>
                  <TableCell className="text-foreground font-medium">
                    {entry.userName}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground font-semibold">
                    {entry.elo}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {entry.wins}/{entry.losses}/{entry.draws}
                  </TableCell>
                  <TableCell className="text-right">
                    <StreakIndicator streak={entry.streak} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {entry.bestElo}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ComponentSample>

      {/* ELO Change Animations */}
      <ComponentSample
        title="ELO Change Indicators"
        description="Animated indicators showing ELO rating changes after a match. Positive changes glow green, negative glow red, and draws show a subtle neutral indicator."
      >
        <div className="flex flex-wrap gap-6 items-center justify-center w-full">
          {eloAnimations.map(anim => (
            <Card key={anim.label} className="glass-1 w-56">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {anim.label}
                  </span>
                  {anim.delta > 0
                    ? <Flame className="h-4 w-4 text-green-400 animate-pulse" />
                    : anim.delta < 0
                    ? <TrendingDown className="h-4 w-4 text-red-400" />
                    : <Minus className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-foreground">
                    {anim.to}
                  </span>
                  <span
                    className={`text-sm font-mono font-semibold ${
                      anim.delta > 0
                        ? "text-green-400"
                        : anim.delta < 0
                        ? "text-red-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {anim.delta > 0 ? `+${anim.delta}` : anim.delta}
                  </span>
                </div>
                {/* Animated ELO bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      anim.delta > 0
                        ? "bg-green-400"
                        : anim.delta < 0
                        ? "bg-red-400"
                        : "bg-muted-foreground"
                    }`}
                    style={{
                      width: `${Math.min(100, (anim.to / 2500) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {anim.from} &rarr; {anim.to}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ComponentSample>

      {/* Phase Steps */}
      <ComponentSample
        title="Phase Steps"
        description="Visual progress indicator for submission phases: Prompted, Generating, Transpiling, Reviewing, and Scored. Shows the current phase with animation and highlights completed steps."
      >
        <div className="space-y-8 w-full max-w-xl">
          {allPhases.map(phase => (
            <div key={phase} className="flex items-center gap-6">
              <Badge
                variant="outline"
                className="text-xs w-24 justify-center shrink-0"
              >
                {phase.toLowerCase()}
              </Badge>
              <PhaseSteps currentPhase={phase} />
            </div>
          ))}
        </div>
      </ComponentSample>

      {/* Token Counter */}
      <ComponentSample
        title="Token Counter"
        description="Real-time token estimation using approximately 4 characters per token. Displays an estimated count as the user types their prompt."
      >
        <div className="space-y-4 w-full max-w-md">
          {[
            { label: "Short prompt", text: "Build a chess game", icon: Zap },
            {
              label: "Medium prompt",
              text:
                "Build a React chess game with drag-and-drop pieces, legal move highlighting, and a timer for each player.",
              icon: Zap,
            },
            {
              label: "Long prompt",
              text:
                "Build a full-featured React chess application with the following requirements: drag-and-drop piece movement using HTML5 DnD API, legal move highlighting with green dots on valid squares, a minimax AI opponent with alpha-beta pruning at depth 4, move history sidebar with algebraic notation, captured pieces display, game clock with increment support, and responsive layout that works on mobile. Use Tailwind CSS for styling.",
              icon: Zap,
            },
          ].map(example => (
            <Card key={example.label} className="glass-1">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <example.icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {example.label}
                    </span>
                  </div>
                  <TokenCounter text={example.text} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {example.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ComponentSample>

      {/* Submission Cards */}
      <ComponentSample
        title="Submission Cards"
        description="Preview cards for user submissions showing status, score, ELO change, iterations, token usage, duration, and review count."
      >
        <div className="space-y-3 w-full max-w-2xl">
          {mockSubmissions.map(sub => (
            <SubmissionCard
              key={sub.id}
              id={sub.id}
              status={sub.status}
              codespaceUrl={sub.codespaceUrl}
              reviewScore={sub.reviewScore}
              eloChange={sub.eloChange}
              iterations={sub.iterations}
              inputTokens={sub.inputTokens}
              outputTokens={sub.outputTokens}
              totalDurationMs={sub.totalDurationMs}
              userName={sub.userName}
              userImage={sub.userImage}
              reviewCount={sub.reviewCount}
              {...(sub.errors !== undefined ? { errors: sub.errors } : {})}
            />
          ))}
        </div>
      </ComponentSample>

      {/* Dashboard Mockup */}
      <section className="space-y-8">
        <h2 className="text-2xl font-bold font-heading">
          Arena Dashboard Layout
        </h2>
        <p className="text-muted-foreground -mt-4">
          The full ArenaDashboard combines challenges and a leaderboard sidebar. Below is a
          simplified static mockup of the layout.
        </p>
        <div className="p-6 rounded-3xl border border-border/50 bg-background/50 backdrop-blur-sm">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <Trophy className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-bold text-foreground">
                AI Prompt Arena
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Write single-shot prompts. Generate React apps. Climb the leaderboard.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <h4 className="text-sm font-semibold text-foreground/80 mb-3">
                Open Challenges
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mockChallenges.slice(0, 2).map(c => (
                  <ChallengeCard
                    key={c.id}
                    id={c.id}
                    title={c.title}
                    description={c.description}
                    category={c.category}
                    difficulty={c.difficulty}
                    submissionCount={c.submissionCount}
                  />
                ))}
              </div>
            </div>
            <div className="lg:col-span-1">
              <h4 className="text-sm font-semibold text-foreground/80 mb-3">
                Top Players
              </h4>
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                {mockLeaderboard.slice(0, 3).map(entry => (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <RankIcon rank={entry.rank} />
                      <span className="text-foreground truncate max-w-[120px]">
                        {entry.userName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground/80 font-mono">
                        {entry.elo}
                      </span>
                      {entry.streak > 0 && (
                        <span className="text-green-400 text-xs">
                          +{entry.streak}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Code Snippets */}
      <CodePreview
        code={codeSnippets.challenge}
        title="Arena Components"
        tabs={[
          { label: "ChallengeCard", code: codeSnippets.challenge },
          { label: "Leaderboard", code: codeSnippets.leaderboard },
          { label: "PhaseSteps", code: codeSnippets.phaseSteps },
          { label: "SubmissionCard", code: codeSnippets.submission },
          { label: "TokenCounter", code: codeSnippets.tokenCounter },
        ]}
      />

      <AccessibilityPanel
        notes={[
          "ChallengeCard uses semantic link elements for keyboard navigation.",
          "Difficulty badges use color + text label for colorblind accessibility.",
          "PhaseSteps uses both color and position to indicate progress state.",
          "Leaderboard table uses proper thead/tbody structure for screen readers.",
          "Medal icons (Crown, Medal, Award) are decorative; rank position is conveyed via text.",
          "SubmissionCard status badges include text labels alongside color indicators.",
          "Token counter uses aria-live region for real-time updates.",
          "ELO change indicators use both color and directional icons for accessibility.",
          "Streak indicators combine directional arrows with +/- values for dual encoding.",
        ]}
      />

      <RelatedComponents currentId="arena" />
    </div>
  );
}
