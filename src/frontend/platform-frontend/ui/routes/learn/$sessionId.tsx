import { useCallback, useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { ArticleView } from "../../../core-logic/ArticleView";
import { QuizRound } from "../../components/quiz/QuizRound";
import { QuizProgress } from "../../../core-logic/QuizProgress";
import { ConflictAlert } from "../../../core-logic/ConflictAlert";
import { BadgeDisplay } from "../../components/quiz/BadgeDisplay";

// ─── Types matching MCP tool outputs ─────────────────────────────────────────

interface QuizQuestion {
  conceptIndex: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

interface RoundData {
  roundNumber: number;
  questions: QuizQuestion[];
}

interface AnswerResult {
  questionIndex: number;
  concept: string;
  correct: boolean;
  conflict: boolean;
}

interface ConceptProgress {
  concept: string;
  mastered: boolean;
  correctCount: number;
  attempts: number;
}

interface Conflict {
  concept: string;
  round: number;
  detail: string;
}

interface BadgeData {
  token: string;
  topic: string;
  score: number;
  completedAt: string;
}

interface SessionState {
  article: string;
  concepts: string[];
  currentRound: RoundData;
  progress: ConceptProgress[];
  results: AnswerResult[] | null;
  conflicts: Conflict[];
  score: number;
  completed: boolean;
  badge: BadgeData | null;
}

// ─── Mock quiz engine (mirrors MCP tool logic) ─────────────────────────────

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && !s.startsWith("http"));
}

function generateMockSession(content: string): SessionState {
  // Split into paragraphs, filtering out very short ones and bare URLs
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20 && !p.match(/^https?:\/\/\S+$/));

  // Extract meaningful sentences from all paragraphs
  const allSentences = paragraphs.flatMap(extractSentences);

  // If we don't have enough content, use paragraphs directly
  const sourcePool =
    allSentences.length >= 3 ? allSentences : paragraphs.length >= 1 ? paragraphs : [];

  if (sourcePool.length === 0) {
    // Content is too short or invalid (e.g. bare URL) — return empty state
    return {
      article: content,
      concepts: ["Insufficient content"],
      currentRound: {
        roundNumber: 1,
        questions: [
          {
            conceptIndex: 0,
            question:
              "Not enough content was provided to generate a quiz. Please go back and paste article text.",
            options: ["I understand", "I understand", "I understand", "I understand"] as [
              string,
              string,
              string,
              string,
            ],
            correctIndex: 0,
          },
        ],
      },
      progress: [
        { concept: "Insufficient content", mastered: false, correctCount: 0, attempts: 0 },
      ],
      results: null,
      conflicts: [],
      score: 0,
      completed: false,
      badge: null,
    };
  }

  const numConcepts = Math.min(6, Math.max(3, sourcePool.length));
  const concepts: string[] = [];
  for (let i = 0; i < numConcepts; i++) {
    const raw = sourcePool[i % sourcePool.length] ?? `Concept ${i + 1}`;
    concepts.push(raw.slice(0, 80));
  }

  const questions: QuizQuestion[] = concepts.slice(0, 3).map((name, idx) => {
    const correctIndex = Math.floor(Math.random() * 4);
    const varOpts: [string, string, string, string] = [
      "Concept effectively applies here",
      "Contradicts the core principle",
      "Lacks direct relevance",
      "Misses important nuances"
    ];
    // Randomize the texts so they aren't identical every question
    const shuffledOpts = [...varOpts].sort(() => Math.random() - 0.5);
    const opts: [string, string, string, string] = [
      shuffledOpts[0]!,
      shuffledOpts[1]!,
      shuffledOpts[2]!,
      shuffledOpts[3]!
    ];
    if (correctIndex !== 0) {
      [opts[0], opts[correctIndex]] = [opts[correctIndex]!, opts[0]!];
    }
    return {
      conceptIndex: idx,
      question: `Which statement about "${name.slice(0, 60)}" is correct?`,
      options: opts,
      correctIndex,
    };
  });

  return {
    article: content,
    concepts,
    currentRound: { roundNumber: 1, questions },
    progress: concepts.map((c) => ({
      concept: c,
      mastered: false,
      correctCount: 0,
      attempts: 0,
    })),
    results: null,
    conflicts: [],
    score: 0,
    completed: false,
    badge: null,
  };
}

function evaluateMockAnswers(
  state: SessionState,
  answers: [number, number, number],
): {
  results: AnswerResult[];
  conflicts: Conflict[];
  nextRound: RoundData | null;
  badge: BadgeData | null;
} {
  const results: AnswerResult[] = answers.map((answer, idx) => ({
    questionIndex: idx,
    concept: state.currentRound.questions[idx]?.question.slice(0, 40) ?? "",
    correct: answer === state.currentRound.questions[idx]?.correctIndex,
    conflict: false,
  }));

  const correctCount = results.filter((r) => r.correct).length;

  // Update progress
  const newProgress = [...state.progress];
  for (let i = 0; i < 3; i++) {
    const q = state.currentRound.questions[i];
    if (q && newProgress[q.conceptIndex]) {
      const current = newProgress[q.conceptIndex]!;
      newProgress[q.conceptIndex] = {
        ...current,
        concept: current.concept,
        attempts: current.attempts + 1,
        correctCount: current.correctCount + (results[i]?.correct ? 1 : 0),
        mastered: current.correctCount + (results[i]?.correct ? 1 : 0) >= 2,
      };
    }
  }

  const allMastered = newProgress.every((p) => p.mastered);

  if (allMastered) {
    const score = Math.round((correctCount / 3) * 100);
    return {
      results,
      conflicts: [],
      nextRound: null,
      badge: {
        token: btoa(
          JSON.stringify({
            sid: "mock",
            topic: state.concepts[0] ?? "Quiz",
            score,
            ts: Date.now(),
          }),
        ),
        topic: state.concepts[0] ?? "Quiz",
        score,
        completedAt: new Date().toISOString(),
      },
    };
  }

  // Generate next round with different concepts
  const nextRoundNumber = state.currentRound.roundNumber + 1;
  const unmasteredIndices = newProgress
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.mastered)
    .map(({ i }) => i);

  const nextQuestions: QuizQuestion[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = unmasteredIndices[i % unmasteredIndices.length] ?? i;
    const name = state.concepts[idx] ?? `Concept ${idx}`;
    const correctIndex = Math.floor(Math.random() * 4);
    const varOpts: [string, string, string, string] = [
      "Concept effectively applies here",
      "Contradicts the core principle",
      "Lacks direct relevance",
      "Misses important nuances"
    ];
    // Randomize the texts so they aren't identical every question
    const shuffledOpts = [...varOpts].sort(() => Math.random() - 0.5);
    const opts: [string, string, string, string] = [
      shuffledOpts[0]!,
      shuffledOpts[1]!,
      shuffledOpts[2]!,
      shuffledOpts[3]!
    ];
    if (correctIndex !== 0) {
      [opts[0], opts[correctIndex]] = [opts[correctIndex]!, opts[0]!];
    }
    nextQuestions.push({
      conceptIndex: idx,
      question: `Regarding "${name.slice(0, 60)}", which is true?`,
      options: opts,
      correctIndex,
    });
  }

  return {
    results,
    conflicts: [],
    nextRound: { roundNumber: nextRoundNumber, questions: nextQuestions },
    badge: null,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LearnSessionPage() {
  const { sessionId } = useParams({ from: "/learn/$sessionId" });
  const [state, setState] = useState<SessionState | null>(null);
  const [articleCollapsed, setArticleCollapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [_roundHistory, setRoundHistory] = useState<
    Array<{ round: RoundData; results: AnswerResult[] }>
  >([]);

  useEffect(() => {
    // Load session data from sessionStorage
    const raw = sessionStorage.getItem(`quiz-${sessionId}`);
    if (raw) {
      try {
        const data = JSON.parse(raw) as {
          contentUrl?: string;
          contentText?: string;
        };
        const content = data.contentText ?? "No content provided";
        setState(generateMockSession(content));
      } catch {
        setState(generateMockSession("No content available. Try creating a new quiz."));
      }
    } else {
      setState(
        generateMockSession("No content available. Try creating a new quiz from the Learn page."),
      );
    }
  }, [sessionId]);

  const handleSubmit = useCallback(
    (answers: [number, number, number]) => {
      if (!state) return;
      setSubmitting(true);

      // Simulate API delay
      setTimeout(() => {
        const { results, conflicts, nextRound, badge } = evaluateMockAnswers(state, answers);

        // Save current round to history
        setRoundHistory((prev) => [...prev, { round: state.currentRound, results }]);

        const correctCount = results.filter((r) => r.correct).length;
        const totalAttempts = state.progress.reduce((s, p) => s + p.attempts, 0) + 3;
        const totalCorrect = state.progress.reduce((s, p) => s + p.correctCount, 0) + correctCount;

        setState({
          ...state,
          results,
          conflicts: [...state.conflicts, ...conflicts],
          score: Math.round((totalCorrect / totalAttempts) * 100),
          completed: !!badge,
          badge,
          currentRound: nextRound ?? state.currentRound,
          progress: state.progress.map((p, i) => {
            const q = state.currentRound.questions.find((q) => q.conceptIndex === i);
            if (!q) return p;
            const qIdx = state.currentRound.questions.indexOf(q);
            const isCorrect = results[qIdx]?.correct ?? false;
            return {
              ...p,
              attempts: p.attempts + 1,
              correctCount: p.correctCount + (isCorrect ? 1 : 0),
              mastered: p.correctCount + (isCorrect ? 1 : 0) >= 2,
            };
          }),
        });
        setSubmitting(false);
      }, 500);
    },
    [state],
  );

  const handleNextRound = useCallback(() => {
    if (!state) return;
    setState({ ...state, results: null });
  }, [state]);

  if (!state) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading quiz...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Learning Quiz</h1>
        {!state.completed && (
          <span className="rounded-full bg-info/10 px-3 py-1 text-sm font-medium text-info-foreground">
            Score: {state.score}%
          </span>
        )}
      </div>

      {/* Badge display when completed */}
      {state.completed && state.badge && (
        <BadgeDisplay
          token={state.badge.token}
          topic={state.badge.topic}
          score={state.badge.score}
          completedAt={state.badge.completedAt}
        />
      )}

      {/* Article */}
      {!state.completed && (
        <ArticleView
          content={state.article}
          collapsed={articleCollapsed}
          onToggle={() => setArticleCollapsed(!articleCollapsed)}
        />
      )}

      {/* Progress */}
      {!state.completed && <QuizProgress progress={state.progress} />}

      {/* Conflict alert */}
      {state.conflicts.length > 0 && <ConflictAlert conflicts={state.conflicts} />}

      {/* Current quiz round */}
      {!state.completed && (
        <>
          <QuizRound
            roundNumber={state.currentRound.roundNumber}
            questions={state.currentRound.questions}
            onSubmit={handleSubmit}
            results={state.results}
            submitting={submitting}
          />

          {/* Next round button */}
          {state.results && !state.completed && (
            <button
              onClick={handleNextRound}
              className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Next Round
            </button>
          )}
        </>
      )}
    </div>
  );
}
