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
      let fetchedText: string | undefined;

      // If URL mode, fetch the actual content from the URL
      if (inputMode === "url") {
        try {
          const res = await fetch(contentUrl.trim());
          if (!res.ok) {
            throw new Error(`Failed to fetch URL (${res.status})`);
          }
          const html = await res.text();
          // Extract text content from HTML
          const doc = new DOMParser().parseFromString(html, "text/html");
          // Remove script and style elements
          for (const el of doc.querySelectorAll("script, style, nav, header, footer")) {
            el.remove();
          }
          // Try to get article/main content first, fall back to body
          const mainContent =
            doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body;
          fetchedText = (mainContent?.textContent ?? "")
            .replace(/\s+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

          if (fetchedText.length < 50) {
            throw new Error("Could not extract enough text content from the URL.");
          }
        } catch (fetchErr) {
          // If fetch fails (CORS, network, etc.), show a helpful error
          const msg =
            fetchErr instanceof Error ? fetchErr.message : "Failed to fetch URL content";
          setError(
            `${msg}. Try pasting the article text directly using the "Paste Text" tab instead.`,
          );
          setLoading(false);
          return;
        }
      }

      // Create a session ID
      const sessionId = crypto.randomUUID();

      // Store the actual text content in sessionStorage
      const sessionData = {
        contentUrl: inputMode === "url" ? contentUrl : undefined,
        contentText: inputMode === "url" ? fetchedText : contentText,
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
        <h1 className="text-2xl font-bold text-foreground">LearnIt Quiz Tool</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is an AI-powered learning and quiz tool (not platform documentation). Paste a URL or content, read the article, then prove your understanding through a quiz.
          Earn a shareable badge when you master all concepts.
        </p>
      </div>

      {/* Input mode tabs */}
      <div role="tablist" aria-label="Content input mode" className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        <button
          role="tab"
          aria-selected={inputMode === "url"}
          aria-controls="learn-panel-url"
          id="learn-tab-url"
          tabIndex={inputMode === "url" ? 0 : -1}
          onClick={() => setInputMode("url")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            inputMode === "url"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          URL
        </button>
        <button
          role="tab"
          aria-selected={inputMode === "text"}
          aria-controls="learn-panel-text"
          id="learn-tab-text"
          tabIndex={inputMode === "text" ? 0 : -1}
          onClick={() => setInputMode("text")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            inputMode === "text"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Paste Text
        </button>
      </div>

      {/* Content input */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {inputMode === "url" ? (
          <div id="learn-panel-url" role="tabpanel" aria-labelledby="learn-tab-url">
            <label htmlFor="learn-content-url" className="mb-2 block text-sm font-medium text-foreground">Content URL</label>
            <input
              id="learn-content-url"
              type="url"
              value={contentUrl}
              onChange={(e) => setContentUrl(e.target.value)}
              placeholder="https://en.wikipedia.org/wiki/..."
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        ) : (
          <div id="learn-panel-text" role="tabpanel" aria-labelledby="learn-tab-text">
            <label htmlFor="learn-content-text" className="mb-2 block text-sm font-medium text-foreground">Content Text</label>
            <textarea
              id="learn-content-text"
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="Paste the article or content you want to learn from..."
              rows={10}
              className="w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">{contentText.length} characters</p>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className={`mt-4 w-full rounded-lg px-6 py-3 text-sm font-semibold transition-colors ${
            loading
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {loading ? "Creating Quiz..." : "Start Quiz"}
        </button>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border bg-muted/50 p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          How it works
        </h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <span>Paste a URL or content to learn from</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <span>Read the generated article summary</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              3
            </span>
            <span>Answer quiz rounds (3 questions each) to prove understanding</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              4
            </span>
            <span>Master all concepts to earn a shareable badge</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
