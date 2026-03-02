"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuestionOption {
  id: string;
  text: string;
}

interface UniquenessQuestionCardProps {
  question: string;
  options: QuestionOption[];
  selectedOptionId?: string;
  onSelect?: (id: string) => void;
  questionNumber: number;
  totalQuestions: number;
}

export function UniquenessQuestionCard({
  question,
  options,
  selectedOptionId,
  onSelect,
  questionNumber,
  totalQuestions,
}: UniquenessQuestionCardProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
            Question {questionNumber} of {totalQuestions}
          </Badge>
          <span className="text-xs text-zinc-500 font-mono">
            {Math.round((questionNumber / totalQuestions) * 100)}%
          </span>
        </div>
        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          />
        </div>
        <CardTitle className="text-lg text-zinc-100 mt-4 leading-snug">{question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect?.(option.id)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border text-sm transition-all duration-150",
              selectedOptionId === option.id
                ? "bg-violet-500/15 border-violet-500/50 text-violet-200 font-medium"
                : "bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800",
            )}
          >
            {option.text}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
