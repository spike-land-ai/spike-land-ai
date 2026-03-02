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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AgentResponse } from "@/lib/validations/agent";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

interface RenameAgentDialogProps {
  agent: AgentResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (agentId: string, displayName: string) => Promise<void>;
}

export function RenameAgentDialog({ agent, open, onOpenChange, onRename }: RenameAgentDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with a new agent
  useEffect(() => {
    if (agent && open) {
      setDisplayName(agent.displayName);
      setError(null);
    }
  }, [agent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent || !displayName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await onRename(agent.id, displayName.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename agent");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Agent</DialogTitle>
            <DialogDescription>Enter a new display name for this agent.</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My Agent"
                maxLength={100}
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
            <Button type="submit" disabled={!displayName.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="mr-2 h-4 w-4" />
              )}
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
