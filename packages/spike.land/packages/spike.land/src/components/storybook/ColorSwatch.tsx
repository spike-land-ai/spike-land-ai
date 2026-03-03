import { Badge } from "@/components/ui/badge";

interface ColorSwatchProps {
  name: string;
  hex: string;
  desc: string;
  /** The design/business role of this color (e.g., "Brand", "Accent") - not an ARIA role */
  colorRole?: string;
  contrastPass?: boolean;
}

export function ColorSwatch(
  { name, hex, desc, colorRole, contrastPass }: ColorSwatchProps,
) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border hover:bg-muted/50 transition-colors">
      <div
        className="w-16 h-16 rounded-xl border border-border shadow-sm flex-shrink-0"
        style={{ backgroundColor: hex }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-base">{name}</span>
          {colorRole && <Badge variant="secondary" className="text-xs">{colorRole}</Badge>}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-sm text-muted-foreground font-mono">{hex}</span>
          {contrastPass && (
            <Badge
              variant="outline"
              className="text-xs border-green-500 text-green-500"
            >
              Contrast Pass (AA)
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{desc}</div>
      </div>
    </div>
  );
}
