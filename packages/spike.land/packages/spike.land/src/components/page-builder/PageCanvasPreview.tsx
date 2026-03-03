"use client";

import { cn } from "@/lib/utils";

type BlockType = "hero" | "text" | "image" | "cta" | "divider";

interface CanvasBlock {
  id: string;
  type: BlockType;
  content: string;
}

interface PageCanvasPreviewProps {
  blocks: CanvasBlock[];
  className?: string;
}

const blockStyles: Record<BlockType, string> = {
  hero:
    "bg-gradient-to-r from-violet-900/40 to-indigo-900/40 border border-violet-700/30 rounded-xl p-6 min-h-[100px]",
  text: "bg-zinc-900 border border-zinc-800 rounded-lg p-4 min-h-[60px]",
  image: "bg-zinc-800/50 border border-dashed border-zinc-600 rounded-xl p-4 min-h-[80px]",
  cta: "bg-indigo-900/30 border border-indigo-600/40 rounded-xl p-4 min-h-[60px]",
  divider: "py-2",
};

const blockLabels: Record<BlockType, string> = {
  hero: "Hero",
  text: "Text",
  image: "Image",
  cta: "Call to Action",
  divider: "Divider",
};

function BlockPlaceholder({ block }: { block: CanvasBlock; }) {
  if (block.type === "divider") {
    return (
      <div
        className={blockStyles.divider}
        role="separator"
        aria-label="Divider block"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-zinc-700" />
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
            {blockLabels.divider}
          </span>
          <div className="flex-1 h-px bg-zinc-700" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(blockStyles[block.type], "relative group")}>
      <div className="absolute top-2 right-2">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50">
          {blockLabels[block.type]}
        </span>
      </div>
      {block.type === "hero" && (
        <div className="space-y-2 pr-16">
          <div className="h-3 w-3/4 bg-zinc-600/60 rounded animate-pulse" />
          <div className="h-2 w-1/2 bg-zinc-700/60 rounded" />
          <div className="mt-3 h-7 w-24 bg-violet-600/50 border border-violet-500/30 rounded-lg" />
        </div>
      )}
      {block.type === "text" && (
        <div className="space-y-1.5 pr-16">
          <div className="h-2 w-full bg-zinc-700/60 rounded" />
          <div className="h-2 w-5/6 bg-zinc-700/60 rounded" />
          <div className="h-2 w-3/4 bg-zinc-700/60 rounded" />
        </div>
      )}
      {block.type === "image" && (
        <div className="flex flex-col items-center justify-center gap-2 pr-16 text-zinc-500">
          <div className="w-10 h-10 rounded-lg border-2 border-dashed border-zinc-600 flex items-center justify-center">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="text-[11px]">{block.content}</span>
        </div>
      )}
      {block.type === "cta" && (
        <div className="flex items-center gap-3 pr-16">
          <div className="space-y-1 flex-1">
            <div className="h-2 w-2/3 bg-indigo-400/40 rounded" />
            <div className="h-2 w-1/2 bg-zinc-600/40 rounded" />
          </div>
          <div className="h-7 w-20 bg-indigo-600/60 border border-indigo-500/40 rounded-lg shrink-0" />
        </div>
      )}
    </div>
  );
}

export function PageCanvasPreview({ blocks, className }: PageCanvasPreviewProps) {
  return (
    <div
      className={cn(
        "w-full space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-4",
        className,
      )}
      role="region"
      aria-label="Page canvas preview"
    >
      {blocks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-sm">
          <span>No blocks added yet.</span>
          <span className="text-xs mt-1">Use the palette to add blocks.</span>
        </div>
      )}
      {blocks.map(block => <BlockPlaceholder key={block.id} block={block} />)}
    </div>
  );
}
