/**
 * Vibe Code route — Monaco editor with HMR live preview.
 *
 * Renders the full-screen LivePreview component as the primary UI.
 * Auto-saves work to localStorage under the "spike-vibe-editor" key.
 *
 * Route: /vibe-code
 */

import { createFileRoute } from "@tanstack/react-router";
import { LivePreview } from "../components/editor/LivePreview";
import type { EditorFile } from "../components/editor/LivePreview";

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/vibe-code")({
  component: VibeCodePage,
});

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function VibeCodePage() {
  const handleDeploy = (files: EditorFile[]) => {
    // TODO: wire to the spike-edge deploy endpoint
    console.info("[Vibe Code] Deploy requested", files.map((f) => f.name));
  };

  return (
    <main
      aria-label="Vibe Code editor"
      className="flex h-[calc(100vh-var(--header-height,0px))] flex-col overflow-hidden bg-background"
    >
      <LivePreview
        storageKey="spike-vibe-editor"
        onDeploy={handleDeploy}
        className="h-full w-full rounded-none border-0"
      />
    </main>
  );
}
