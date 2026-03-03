"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function PlanEditor({
  planContent,
  isReadOnly,
  onSave,
  isSaving,
}: {
  planContent: string;
  isReadOnly: boolean;
  onSave: (content: string) => void;
  isSaving: boolean;
}) {
  const [content, setContent] = useState(planContent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external changes
  useEffect(() => {
    setContent(planContent);
    setHasUnsavedChanges(false);
  }, [planContent]);

  // Debounced auto-save
  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      setHasUnsavedChanges(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSave(value);
        setHasUnsavedChanges(false);
      }, 2000);
    },
    [onSave],
  );

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const handleManualSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSave(content);
    setHasUnsavedChanges(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium text-zinc-400">
            Implementation Plan
          </h3>
          {hasUnsavedChanges && <span className="text-[10px] text-amber-500">Unsaved</span>}
          {isSaving && <Loader2 className="h-3 w-3 text-zinc-500 animate-spin" />}
        </div>
        {!isReadOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="h-6 px-2 text-xs text-zinc-400 hover:text-white"
          >
            {isSaving
              ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
              : hasUnsavedChanges
              ? <Save className="h-3 w-3 mr-1" />
              : <Check className="h-3 w-3 mr-1" />}
            {isSaving ? "Saving" : hasUnsavedChanges ? "Save" : "Saved"}
          </Button>
        )}
      </div>

      {isReadOnly && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-[10px] text-amber-400">
            Plan is read-only while Jules is working on this ticket.
          </p>
        </div>
      )}

      <div className="flex-1 p-3">
        <Textarea
          value={content}
          onChange={e => handleChange(e.target.value)}
          placeholder={`# Implementation Plan\n\n## Approach\n...\n\n## Files to Modify\n- ...\n\n## Edge Cases\n- ...\n\n## Testing Strategy\n- ...`}
          readOnly={isReadOnly}
          className="h-full min-h-[300px] resize-none bg-zinc-800/30 border-white/5 text-zinc-100 text-sm font-mono placeholder:text-zinc-700 focus:border-amber-500/30"
        />
      </div>
    </div>
  );
}
