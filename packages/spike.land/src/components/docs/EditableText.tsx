"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Edit2, Save, X } from "lucide-react";

interface EditableTextProps {
  content: string;
  contentId: string;
  className?: string;
}

export function EditableText({ content: initialContent, contentId, className }: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [editedContent, setEditedContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`edit_text_${contentId}`);
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
      sessionStorage.setItem(`edit_text_${contentId}`, editedContent);
      setContent(editedContent);
      setIsEditing(false);

      toast.success("Saved your edits locally!");

      toast.promise(
        fetch("/api/github/issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `Documentation Suggestion for ${contentId}`,
            body: `Proposed changes for ${contentId}:\n\n${editedContent}`,
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
      <div className="space-y-4 w-full border border-white/10 rounded-xl p-4 bg-black/20 my-2">
        <Textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="min-h-[100px] text-sm bg-black/40 border-white/10"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
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
        </div>
      </div>
    );
  }

  return (
    <div className="group relative w-full block">
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 backdrop-blur-sm"
        onClick={() => setIsEditing(true)}
      >
        <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </Button>
      <p className={className}>{content}</p>
    </div>
  );
}
