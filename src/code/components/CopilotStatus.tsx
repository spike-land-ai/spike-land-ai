import { copilotService } from "@/services/CopilotService";
import type { CopilotStatus as CopilotStatusType } from "@/services/types";
import React, { useEffect, useState } from "react";

export const CopilotStatus: React.FC = () => {
  const [status, setStatus] = useState<CopilotStatusType>(() => copilotService.getStatus());

  useEffect(() => {
    const unsubscribe = copilotService.onStatusChange(setStatus);

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.shiftKey && e.key.toUpperCase() === "A") {
        e.preventDefault();
        copilotService.toggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      unsubscribe();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => copilotService.toggle()}
      title={`Copilot: ${status} (Ctrl+Shift+A to toggle)`}
      className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white backdrop-blur-sm transition-opacity hover:bg-black/60"
    >
      {status === "active" && (
        <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />
      )}
      {status === "loading" && (
        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
      )}
      {status === "offline" && (
        <span className="h-2 w-2 rounded-full bg-gray-400 shrink-0" />
      )}
      <span className={status === "disabled" ? "line-through opacity-50" : ""}>
        Copilot
      </span>
    </button>
  );
};
