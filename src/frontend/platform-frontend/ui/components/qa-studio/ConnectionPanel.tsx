import { useState } from "react";
import { Plug, Unplug } from "lucide-react";

interface Props {
  url: string;
  connected: boolean;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
}

export function ConnectionPanel({ url, connected, onConnect, onDisconnect }: Props) {
  const [inputUrl, setInputUrl] = useState(url);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 border border-border">
        <div className={`w-2 h-2 rounded-full transition-all duration-500 ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
        <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="flex items-center gap-1.5 bg-background border border-border rounded-md px-2 py-1 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          className="w-[200px] text-xs bg-transparent outline-none placeholder:text-muted-foreground/50"
          placeholder="http://localhost:3100/mcp"
          disabled={connected}
        />
      </div>

      {connected ? (
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 rounded-md hover:bg-destructive/20 active:scale-[0.98] transition-all"
        >
          <Unplug className="w-3.5 h-3.5" />
          Disconnect
        </button>
      ) : (
        <button
          onClick={() => onConnect(inputUrl)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
        >
          <Plug className="w-3.5 h-3.5" />
          Connect
        </button>
      )}
    </div>
  );
}
