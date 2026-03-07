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
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <p className="mb-4 text-sm font-medium text-foreground">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-info/15 text-xs font-bold text-info-foreground">
          {questionIndex + 1}
        </span>
        {question}
      </p>
      <div className="space-y-2">
        {options.map((option, idx) => {
          let borderColor = "border-border hover:border-primary/40";
          let bgColor = "bg-card";
          let textColor = "text-foreground";

          if (selectedAnswer === idx) {
            borderColor = "border-primary";
            bgColor = "bg-info/10";
            textColor = "text-primary";
          }

          if (result) {
            if (selectedAnswer === idx) {
              if (result.correct) {
                borderColor = "border-success";
                bgColor = "bg-success/10";
                textColor = "text-success-foreground";
              } else {
                borderColor = "border-destructive";
                bgColor = "bg-destructive/10";
                textColor = "text-destructive-foreground";
              }
            }
            if (result.conflict && selectedAnswer === idx) {
              borderColor = "border-warning";
              bgColor = "bg-warning/10";
              textColor = "text-warning-foreground";
            }
          }

          return (
            <button
              key={idx}
              onClick={() => !disabled && onSelect(questionIndex, idx)}
              disabled={disabled}
              aria-label={`Question ${questionIndex + 1}, ${String.fromCharCode(65 + idx)}: ${option}`}
              className={`flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors ${borderColor} ${bgColor} ${textColor} ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">
                {String.fromCharCode(65 + idx)}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
