"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket } from "lucide-react";

export function JulesHandoffDialog({
  open,
  onOpenChange,
  ticketTitle,
  planPreview,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketTitle: string;
  planPreview: string;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-amber-500" />
            Send to Jules
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            This will create a Jules coding session with the approved plan. Jules will work
            asynchronously and create a PR when done.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          <div>
            <p className="text-xs text-zinc-500 mb-1">Ticket</p>
            <p className="text-sm text-white">{ticketTitle}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">Plan Preview</p>
            <div className="max-h-[200px] overflow-y-auto p-3 rounded-md bg-zinc-800/50 border border-white/5">
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">
                {planPreview.slice(0, 500)}
                {planPreview.length > 500 && "..."}
              </pre>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="text-zinc-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Send to Jules
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
