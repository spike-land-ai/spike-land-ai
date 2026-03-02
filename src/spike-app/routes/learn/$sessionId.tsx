import { useState, useEffect, useCallback } from "react";
import { useParams } from "@tanstack/react-router";
import { ArticleView } from "@/components/quiz/ArticleView";
import { QuizRound } from "@/components/quiz/QuizRound";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { ConflictAlert } from "@/components/quiz/ConflictAlert";
import { BadgeDisplay } from "@/components/quiz/BadgeDisplay";

// ─── Types matching MCP tool outputs ─────────────────────────────────────────

interface QuizQuestion {
  conceptIndex: number;
  question: string;
  options: [string, string, string, string];
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

function generateMockSession(content: string): SessionState {
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 20);
  const numConcepts = Math.min(6, Math.max(3, paragraphs.length || 3));

  const concepts: string[] = [];
  for (let i = 0; i < numConcepts; i++) {
    const p = paragraphs[i % (paragraphs.length || 1)] ?? `Concept ${i + 1}`;
    const sentence = p.split(/[.!?]+/)[0]?.trim() ?? `Concept ${i + 1}`;
    concepts.push(sentence.slice(0, 60));
  }

  const questions: QuizQuestion[] = concepts.slice(0, 3).map((name, idx) => ({
    conceptIndex: idx,
    question: `Which statement about "${name.slice(0, 40)}" is correct?`,
    options: [
      `This accurately reflects: ${name.slice(0, 30)}`,
      `This contradicts: ${name.slice(0, 30)}`,
      `This is unrelated to: ${name.slice(0, 30)}`,
      `This oversimplifies: ${name.slice(0, 30)}`,
    ] as [string, string, string, string],
  }));

  return {
    article: content,
    concepts,
    currentRound: { roundNumber: 1, questions },
    progress: concepts.map((c) => ({ concept: c, mastered: false, correctCount: 0, attempts: 0 })),
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
): { results: AnswerResult[]; conflicts: Conflict[]; nextRound: RoundData | null; badge: BadgeData | null } {
  // In the mock, option 0 is always correct
  const results: AnswerResult[] = answers.map((answer, idx) => ({
    questionIndex: idx,
    concept: state.currentRound.questions[idx]?.question.slice(0, 40) ?? "",
    correct: answer === 0,
    conflict: false,
  }));

  const correctCount = results.filter((r) => r.correct).length;

  // Update progress
  const newProgress = [...state.progress];
  for (let i = 0; i < 3; i++) {
    const q = state.currentRound.questions[i];
    if (q && newProgress[q.conceptIndex]) {
      newProgress[q.conceptIndex] = {
        ...newProgress[q.conceptIndex],
        attempts: newProgress[q.conceptIndex].attempts + 1,
        correctCount: newProgress[q.conceptIndex].correctCount + (results[i]?.correct ? 1 : 0),
        mastered: newProgress[q.conceptIndex].correctCount + (results[i]?.correct ? 1 : 0) >= 2,
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
        token: btoa(JSON.stringify({ sid: "mock", topic: state.concepts[0] ?? "Quiz", score, ts: Date.now() })),
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
    nextQuestions.push({
      conceptIndex: idx,
      question: `Regarding "${name.slice(0, 40)}", which is true?`,
      options: [
        `This accurately reflects: ${name.slice(0, 30)}`,
        `This contradicts: ${name.slice(0, 30)}`,
        `This is unrelated to: ${name.slice(0, 30)}`,
        `This oversimplifies: ${name.slice(0, 30)}`,
      ] as [string, string, string, string],
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
  const [roundHistory, setRoundHistory] = useState<Array<{ round: RoundData; results: AnswerResult[] }>>([]);

  useEffect(() => {
    // Load session data from sessionStorage
    const raw = sessionStorage.getItem(`quiz-${sessionId}`);
    if (raw) {
      try {
        const data = JSON.parse(raw) as { contentUrl?: string; contentText?: string };
        const content = data.contentText ?? data.contentUrl ?? "No content provided";
        setState(generateMockSession(content));
      } catch {
        setState(generateMockSession("No content available. Try creating a new quiz."));
      }
    } else {
      setState(generateMockSession("No content available. Try creating a new quiz from the Learn page."));
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
        <div className="text-gray-400">Loading quiz...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Learning Quiz</h1>
        {!state.completed && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
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
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Next Round
            </button>
          )}
        </>
      )}
    </div>
  );
}
