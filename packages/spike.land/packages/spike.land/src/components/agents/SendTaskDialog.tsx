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
import type { AgentResponse } from "@/lib/validations/agent";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";

interface SendTaskDialogProps {
  agent: AgentResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (agentId: string, prompt: string) => Promise<void>;
}

export function SendTaskDialog({
  agent,
  open,
  onOpenChange,
  onSend,
}: SendTaskDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent || !prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await onSend(agent.id, prompt.trim());
      setPrompt("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send task");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Task to {agent?.displayName}</DialogTitle>
            <DialogDescription>
              Enter a task prompt for the agent to execute. The task will be queued and executed on
              the next heartbeat.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Enter your task prompt..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={5}
              className="resize-none"
              disabled={isLoading}
            />
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!prompt.trim() || isLoading}
            >
              {isLoading
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Send className="mr-2 h-4 w-4" />}
              Send Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
