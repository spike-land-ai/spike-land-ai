import { useState } from "react";

interface Props {
  url: string;
  connected: boolean;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}

export function ConnectionPanel({ url, connected, onConnect, onDisconnect }: Props) {
  const [inputUrl, setInputUrl] = useState(url);

  return (
    <div className="flex items-center gap-4 p-4 border-b border-border bg-card dark:glass-card backdrop-blur-sm">
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] ring-2 ring-green-500/20' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] ring-2 ring-red-500/20'}`} />
        <span className="text-xs font-semibold tracking-wide uppercase">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
      <div className="flex-1 flex items-center">
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          className="w-full px-4 py-2 text-sm border rounded-lg bg-background/50 border-border focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
          placeholder="http://localhost:3100/mcp"
          disabled={connected}
        />
      </div>
      <div className="flex items-center gap-3">
        {connected ? (
          <button 
            onClick={onDisconnect} 
            className="px-5 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 active:scale-[0.98] transition-all shadow-sm"
          >
            Disconnect
          </button>
        ) : (
          <button 
            onClick={() => onConnect(inputUrl)} 
            className="px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm shadow-primary/20"
          >
            Connect
          </button>
        )}
        {!connected && (
          <div className="hidden lg:block text-[11px] text-muted-foreground leading-tight">
            Run <code className="bg-muted px-1.5 py-0.5 rounded-md font-mono text-primary">npx @spike-land-ai/qa-studio --http</code><br/>locally to connect.
          </div>
        )}
      </div>
    </div>
  );
}
