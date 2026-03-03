import { MoreVertical } from "lucide-react";
import { useState, type ReactNode } from "react";

interface ImageCardProps {
  id: string;
  name: string;
  url: string;
  width?: number;
  height?: number;
  selected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  actions?: Array<{ label: string; onClick: () => void; danger?: boolean }>;
  badge?: ReactNode;
  tags?: string[];
  description?: string;
}

export function ImageCard({
  id,
  name,
  url,
  width,
  height,
  selected,
  onSelect,
  onClick,
  actions,
  badge,
  tags,
  description,
}: ImageCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`group relative bg-obsidian-900 rounded-2xl border overflow-hidden transition-all duration-300 hover:border-white/20 ${
        selected ? "border-amber-neon ring-4 ring-amber-neon/20" : "border-white/5"
      }`}
    >
      <div className="aspect-square relative cursor-pointer group" onClick={onClick ?? onSelect}>
        <img src={url} alt={name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {onSelect && (
          <div
            className={`absolute top-3 left-3 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
              selected
                ? "bg-amber-neon border-amber-neon shadow-[0_0_10px_rgba(255,170,0,0.5)]"
                : "border-white/30 bg-black/30 opacity-0 group-hover:opacity-100"
            }`}
          >
            {selected && <span className="text-obsidian-950 text-xs font-black">✓</span>}
          </div>
        )}
        {badge && <div className="absolute top-3 right-3">{badge}</div>}
      </div>

      <div className="p-4 bg-obsidian-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-100 truncate">{name}</p>
            {description && <p className="text-[10px] text-gray-500 truncate mt-0.5 font-medium uppercase tracking-wider">{description}</p>}
          </div>
          {actions && actions.length > 0 && (
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`p-2 rounded-xl transition-all ${menuOpen ? "bg-amber-neon text-obsidian-950" : "hover:bg-white/10 text-gray-500 hover:text-gray-300"}`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 bottom-12 md:bottom-auto md:top-12 z-[110] bg-obsidian-800 border border-white/10 rounded-2xl shadow-2xl py-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-200">
                    {actions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => {
                          action.onClick();
                          setMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                          action.danger
                            ? "text-red-400 hover:bg-red-500/10"
                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        {(tags && tags.length > 0) || (width && height) ? (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex flex-wrap gap-1.5 flex-1">
              {tags?.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-neon/10 text-amber-neon border border-amber-neon/20"
                >
                  {tag}
                </span>
              ))}
            </div>
            {width && height && (
              <span className="text-[9px] font-mono text-gray-600 font-bold">
                {width}×{height}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
