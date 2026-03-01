import { useState, useCallback } from "react";

interface LivePreviewProps {
  appId: string;
  edgeUrl?: string;
}

export function LivePreview({ appId, edgeUrl = "https://edge.spike.land" }: LivePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  const src = `${edgeUrl}/live/${appId}`;

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(false);
    setKey((k) => k + 1);
  }, []);

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-white" : "relative"}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-gray-50 px-3 py-2">
        <span className="truncate text-xs text-gray-500">{src}</span>
        <div className="flex gap-1">
          <button
            onClick={handleRefresh}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200"
            title="Refresh"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M15.312 4.688a7.5 7.5 0 1 0 .907 9.594l-1.53-1.285A5.5 5.5 0 1 1 14.25 5.75L12 8h6V2l-2.688 2.688z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={() => setFullscreen((f) => !f)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              {fullscreen ? (
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 0 1 1-1h4a1 1 0 0 1 0 2H5v3a1 1 0 0 1-2 0V4zm9-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-2 0V5h-3a1 1 0 0 1-1-1zM4 13a1 1 0 0 1 1 1v2h3a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zm13 0a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1 0-2h3v-2a1 1 0 0 1 1-1z"
                  clipRule="evenodd"
                />
              ) : (
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 0 1 1-1h4a1 1 0 0 1 0 2H5v3a1 1 0 0 1-2 0V4zm9-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-2 0V5h-3a1 1 0 0 1-1-1zM4 13a1 1 0 0 1 1 1v2h3a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zm13 0a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1 0-2h3v-2a1 1 0 0 1 1-1z"
                  clipRule="evenodd"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Iframe */}
      <div className={`relative ${fullscreen ? "h-[calc(100%-40px)]" : "h-[500px]"}`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-gray-400">
            <p className="text-sm">Failed to load preview</p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        <iframe
          key={key}
          src={src}
          title={`Preview ${appId}`}
          sandbox="allow-scripts allow-same-origin"
          className="h-full w-full border-0"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      </div>
    </div>
  );
}

export type { LivePreviewProps };
