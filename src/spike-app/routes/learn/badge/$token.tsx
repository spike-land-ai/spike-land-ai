import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { BadgeDisplay } from "@/components/quiz/BadgeDisplay";

interface BadgePayload {
  sid: string;
  topic: string;
  score: number;
  ts: number;
}

export function BadgePage() {
  const { token } = useParams({ from: "/learn/badge/$token" });

  const payload = useMemo((): BadgePayload | null => {
    try {
      const parts = token.split(".");
      if (parts.length !== 2) return null;
      const payloadStr = atob(parts[0]!);
      return JSON.parse(payloadStr) as BadgePayload;
    } catch {
      return null;
    }
  }, [token]);

  if (!payload) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">Invalid Badge</p>
          <p className="mt-2 text-sm text-gray-500">This badge link is invalid or has been tampered with.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <BadgeDisplay
        token={token}
        topic={payload.topic}
        score={payload.score}
        completedAt={new Date(payload.ts).toISOString()}
      />
    </div>
  );
}
