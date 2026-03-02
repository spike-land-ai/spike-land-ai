import { useState } from "react";
import { QuizCard } from "./QuizCard";

interface QuizQuestion {
  conceptIndex: number;
  question: string;
  options: [string, string, string, string];
}

interface AnswerResult {
  questionIndex: number;
  concept: string;
  correct: boolean;
  conflict: boolean;
}

interface QuizRoundProps {
  roundNumber: number;
  questions: QuizQuestion[];
  onSubmit: (answers: [number, number, number]) => void;
  results?: AnswerResult[] | null;
  submitting?: boolean;
}

export function QuizRound({ roundNumber, questions, onSubmit, results, submitting }: QuizRoundProps) {
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);

  const handleSelect = (questionIndex: number, optionIndex: number) => {
    if (results) return; // Don't allow changes after submission
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  const allAnswered = answers.every((a) => a !== null);

  const handleSubmit = () => {
    if (!allAnswered) return;
    onSubmit(answers as [number, number, number]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Round {roundNumber}</h3>
        {results && (
          <span className="text-sm font-medium text-gray-500">
            {results.filter((r) => r.correct).length}/{results.length} correct
          </span>
        )}
      </div>

      {questions.map((q, idx) => (
        <QuizCard
          key={`${roundNumber}-${idx}`}
          questionIndex={idx}
          question={q.question}
          options={q.options}
          selectedAnswer={answers[idx] ?? null}
          onSelect={handleSelect}
          result={results?.[idx] ?? null}
          disabled={!!results || submitting}
        />
      ))}

      {!results && (
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className={`w-full rounded-lg px-6 py-3 text-sm font-semibold transition-colors ${
            allAnswered && !submitting
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "cursor-not-allowed bg-gray-200 text-gray-400"
          }`}
        >
          {submitting ? "Checking..." : "Submit Answers"}
        </button>
      )}
    </div>
  );
}
