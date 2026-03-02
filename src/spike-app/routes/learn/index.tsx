import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export function LearnIndexPage() {
  const [contentUrl, setContentUrl] = useState("");
  const [contentText, setContentText] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "text">("url");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleStart = async () => {
    const hasContent = inputMode === "url" ? contentUrl.trim() : contentText.trim();
    if (!hasContent) {
      setError("Please provide content to learn from.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a session ID from the content (in production, this calls the MCP tool)
      const sessionId = crypto.randomUUID();

      // Store content in sessionStorage for the quiz page to use
      const sessionData = {
        contentUrl: inputMode === "url" ? contentUrl : undefined,
        contentText: inputMode === "text" ? contentText : undefined,
      };
      sessionStorage.setItem(`quiz-${sessionId}`, JSON.stringify(sessionData));

      navigate({ to: "/learn/$sessionId", params: { sessionId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quiz session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Learn & Verify</h1>
        <p className="mt-2 text-sm text-gray-500">
          Paste a URL or content, read the article, then prove your understanding through a quiz.
          Earn a shareable badge when you master all concepts.
        </p>
      </div>

      {/* Input mode tabs */}
      <div className="flex gap-1 rounded-lg border bg-gray-50 p-1">
        <button
          onClick={() => setInputMode("url")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            inputMode === "url"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          URL
        </button>
        <button
          onClick={() => setInputMode("text")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            inputMode === "text"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Paste Text
        </button>
      </div>

      {/* Content input */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        {inputMode === "url" ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Content URL</label>
            <input
              type="url"
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              placeholder="https://en.wikipedia.org/wiki/..."
              className="w-full rounded-lg border px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ) : (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Content Text</label>
            <textarea
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="Paste the article or content you want to learn from..."
              rows={10}
              className="w-full resize-y rounded-lg border px-4 py-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              {contentText.length} characters
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={handleStart}
          disabled={loading}
          className={`mt-4 w-full rounded-lg px-6 py-3 text-sm font-semibold transition-colors ${
            loading
              ? "cursor-not-allowed bg-gray-200 text-gray-400"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {loading ? "Creating Quiz..." : "Start Quiz"}
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-xl border bg-gray-50 p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          How it works
        </h3>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">1</span>
            <span>Paste a URL or content to learn from</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">2</span>
            <span>Read the generated article summary</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">3</span>
            <span>Answer quiz rounds (3 questions each) to prove understanding</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">4</span>
            <span>Master all concepts to earn a shareable badge</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
