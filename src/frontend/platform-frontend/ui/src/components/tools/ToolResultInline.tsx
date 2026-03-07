import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ToolResultInlineProps {
  result?: unknown;
  error?: unknown;
}

export function ToolResultInline({ result, error }: ToolResultInlineProps) {
  const [showJson, setShowJson] = useState(false);

  if (error) {
    const errorObj = error as { message?: string };
    return (
      <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm flex items-start gap-2">
        <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="font-mono whitespace-pre-wrap break-all">
          {errorObj?.message || String(error)}
        </div>
      </div>
    );
  }

  if (!result) return null;

  const resObj = result as { isError?: boolean; content?: Record<string, unknown>[] };
  const isErrorResult = resObj.isError;
  const content = resObj.content || [];

  return (
    <div className={`rounded-lg border p-3 text-sm ${isErrorResult ? "border-destructive/50 bg-destructive/10" : "border-border bg-muted/30"}`}>
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
        {isErrorResult ? (
          <AlertCircle className="w-4 h-4 text-destructive" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        )}
        <span className="font-semibold">{isErrorResult ? "Execution Error" : "Success"}</span>
        <div className="ml-auto">
          <button
            onClick={() => setShowJson(!showJson)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showJson ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            RAW JSON
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {content.map((block: Record<string, unknown>, idx: number) => {
          if (block.type === "text") {
            return (
              <div key={idx} className="font-mono text-xs whitespace-pre-wrap break-words bg-background p-2 rounded border border-border">
                {String(block.text)}
              </div>
            );
          }
          if (block.type === "image") {
            return (
              <div key={idx} className="bg-background p-2 rounded border border-border">
                <img src={`data:${String(block.mimeType)};base64,${String(block.data)}`} alt="Tool result" className="max-w-full rounded" />
              </div>
            );
          }
          if (block.type === "resource") {
             const res = block.resource as { uri?: string; text?: string } | undefined;
             return (
               <div key={idx} className="font-mono text-xs whitespace-pre-wrap break-words bg-background p-2 rounded border border-border">
                 <strong>{String(res?.uri || "Unknown")}</strong>
                 <br />
                 {String(res?.text || "")}
               </div>
             )
          }
          return null;
        })}
      </div>

      {showJson && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <pre className="text-[10px] font-mono p-2 bg-background rounded overflow-x-auto border border-border">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
