import { Zap, Github, Globe, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface TopBarProps {
  balance: number;
  balanceLoading: boolean;
}

export function TopBar({ balance, balanceLoading }: TopBarProps) {
  const { logout } = useAuth();

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">P</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-100">Pixel Studio</h1>
      </div>

      <div className="flex items-center gap-4">
        <a
          href="https://github.com/spike-land-ai/mcp-image-studio"
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          title="View Source on GitHub"
        >
          <Github className="w-5 h-5" />
        </a>
        <a
          href="https://spike.land"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-accent-400 hover:text-accent-300 hover:bg-accent-500/10 transition-colors"
          title="Visit Spike.land"
        >
          <Globe className="w-4 h-4" />
          <span>spike.land</span>
        </a>
        <span className="h-4 w-px bg-gray-700 mx-1"></span>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
          100/week
        </span>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700">
          <Zap className="w-4 h-4 text-accent-400" />
          <span className="text-sm font-medium text-gray-200">
            {balanceLoading ? "..." : (balance ?? 0).toLocaleString()}
          </span>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">/ week</span>
            <span className="text-xs text-gray-600">resets weekly</span>
          </div>
        </div>
        {useAuth().isLoggedIn ? (
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 transition-colors border border-accent-500/20"
            title="Sign In"
          >
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
