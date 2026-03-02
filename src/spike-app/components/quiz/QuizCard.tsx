import { useState } from "react";

interface QuizCardProps {
  questionIndex: number;
  question: string;
  options: [string, string, string, string];
  selectedAnswer: number | null;
  onSelect: (questionIndex: number, optionIndex: number) => void;
  result?: { correct: boolean; conflict: boolean } | null;
  disabled?: boolean;
}

export function QuizCard({
  questionIndex,
  question,
  options,
  selectedAnswer,
  onSelect,
  result,
  disabled,
}: QuizCardProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm font-medium text-gray-700">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
          {questionIndex + 1}
        </span>
        {question}
      </p>
      <div className="space-y-2">
        {options.map((option, idx) => {
          let borderColor = "border-gray-200 hover:border-blue-300";
          let bgColor = "bg-white";

          if (selectedAnswer === idx) {
            borderColor = "border-blue-500";
            bgColor = "bg-blue-50";
          }

          if (result) {
            if (selectedAnswer === idx) {
              if (result.correct) {
                borderColor = "border-green-500";
                bgColor = "bg-green-50";
              } else {
                borderColor = "border-red-500";
                bgColor = "bg-red-50";
              }
            }
            if (result.conflict && selectedAnswer === idx) {
              borderColor = "border-orange-500";
              bgColor = "bg-orange-50";
            }
          }

          return (
            <button
              key={idx}
              onClick={() => !disabled && onSelect(questionIndex, idx)}
              disabled={disabled}
              className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors ${borderColor} ${bgColor} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-gray-500">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="text-gray-700">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
