import { GitBranch, LayoutTemplate, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyWorkspace({
  onNew,
  onTemplate,
}: {
  onNew: () => void;
  onTemplate: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-zinc-950">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="text-center space-y-8 max-w-md px-6 relative z-10">
        <div className="mx-auto w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center shadow-2xl shadow-purple-500/10 backdrop-blur-xl">
          <GitBranch className="w-12 h-12 text-purple-400 drop-shadow-md" />
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 tracking-tight">
            State Machine Studio
          </h2>
          <p className="text-[15px] text-zinc-400 leading-relaxed font-medium">
            Create, visualize, and simulate complex hierarchical state machines with live
            transitions, AI assistance, and interactive debugging.
          </p>
        </div>
        <div className="flex gap-4 items-center justify-center pt-2">
          <Button
            onClick={onNew}
            className="h-11 px-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-600 hover:from-indigo-400 hover:via-purple-400 hover:to-purple-500 text-white shadow-lg shadow-purple-500/25 border-0 rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Machine
          </Button>
          <Button
            variant="outline"
            onClick={onTemplate}
            className="h-11 px-6 bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl font-medium backdrop-blur-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            <LayoutTemplate className="w-4 h-4 mr-2" />
            Templates
          </Button>
        </div>
      </div>
    </div>
  );
}
