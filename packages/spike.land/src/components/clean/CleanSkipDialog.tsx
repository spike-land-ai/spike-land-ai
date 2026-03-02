"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { CleaningTask } from "@/lib/clean/types";
import { useState } from "react";

interface CleanSkipDialogProps {
  open: boolean;
  task: CleaningTask | null;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export function CleanSkipDialog({ open, task, onConfirm, onCancel }: CleanSkipDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skip this task?</DialogTitle>
          <DialogDescription>
            Totally fine! You can come back to this later. No pressure at all.
          </DialogDescription>
        </DialogHeader>
        {task && (
          <p className="text-sm font-medium text-foreground/80 px-1">
            &ldquo;{task.description}&rdquo;
          </p>
        )}
        <Textarea
          placeholder="Reason (optional) - e.g., need supplies, too tired right now..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Keep it
          </Button>
          <Button onClick={handleConfirm}>Skip for now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
