"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { toast } from "sonner";
import { Edit2, Save, X } from "lucide-react";

interface EditableMarkdownRendererProps {
  content: string;
  contentId: string;
}

export function EditableMarkdownRenderer({
  content: initialContent,
  contentId,
}: EditableMarkdownRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [editedContent, setEditedContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`edit_md_${contentId}`);
      if (saved) {
        setContent(saved);
        setEditedContent(saved);
      }
    } catch (e) {
      console.error("Session storage failed", e);
    }
  }, [contentId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      sessionStorage.setItem(`edit_md_${contentId}`, editedContent);
      setContent(editedContent);
      setIsEditing(false);

      toast.success("Saved your edits locally!");

      toast.promise(
        fetch("/api/github/issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Documentation Suggestion for ${contentId}`,
            body: `Proposed changes for ${contentId}:\n\n\`\`\`markdown\n${editedContent}\n\`\`\``,
          }),
        }).then(async (res) => {
          if (!res.ok) throw new Error("Failed to create issue");
          return res.json();
        }),
        {
          loading: "Opening GitHub issue with your suggestions...",
          success: (data) => `GitHub issue opened at #${data.number}!`,
          error: "Failed to open GitHub issue.",
        },
      );
    } catch (error) {
      toast.error("Failed to save your edits locally");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4 relative w-full border border-white/10 rounded-xl p-4 bg-black/20">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-primary">Editing Documentation: {contentId}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditedContent(content);
                setIsEditing(false);
              }}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Edits"}
            </Button>
          </div>
        </div>
        <Textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="min-h-[500px] font-mono text-sm bg-black/40 border-white/20 p-4"
        />
      </div>
    );
  }

  return (
    <div className="group relative">
      <Button
        variant="secondary"
        size="sm"
        className="absolute -right-4 -top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
        onClick={() => setIsEditing(true)}
      >
        <Edit2 className="h-4 w-4 mr-2" />
        Edit Page
      </Button>
      <MarkdownRenderer content={content} />
    </div>
  );
}
