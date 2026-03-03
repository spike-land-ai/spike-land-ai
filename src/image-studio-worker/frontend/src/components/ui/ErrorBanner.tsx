import { AlertCircle, X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <p className="flex-1 text-sm text-red-300">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
