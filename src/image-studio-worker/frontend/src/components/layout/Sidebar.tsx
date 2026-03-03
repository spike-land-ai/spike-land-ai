import { useState, useRef, useEffect } from "react";
import {
  Box,
  Archive,
  Cpu,
  Share2,
  Settings,
  Activity,
  Zap,
  LogOut
} from "lucide-react";

export type Workspace = "studio" | "archive" | "intelligence" | "showcase" | "settings";

interface NavItem {
  id: Workspace;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const WORKSPACES: NavItem[] = [
  { id: "studio", label: "Studio", icon: Zap },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "intelligence", label: "Intelligence", icon: Cpu },
  { id: "showcase", label: "Showcase", icon: Share2 },
];

interface SidebarUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

interface SidebarProps {
  active: Workspace;
  onNavigate: (workspace: any) => void;
  user?: SidebarUser | null;
  onLogout?: () => void;
}

function getInitial(user: SidebarUser): string {
  if (user.name) return user.name[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

function UserAvatar({ user, size = "md", onClick }: { user: SidebarUser; size?: "sm" | "md"; onClick?: () => void }) {
  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  if (user.image) {
    return (
      <button onClick={onClick} className={`${dim} rounded-xl overflow-hidden hover:ring-2 ring-amber-neon/50 transition-all cursor-pointer`}>
        <img src={user.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </button>
    );
  }
  return (
    <button onClick={onClick} className={`${dim} rounded-xl bg-gradient-to-tr from-amber-neon to-emerald-neon flex items-center justify-center hover:ring-2 ring-amber-neon/50 transition-all cursor-pointer`}>
      <span className={`${textSize} font-bold text-obsidian-950`}>{getInitial(user)}</span>
    </button>
  );
}

export function Sidebar({ active, onNavigate, user, onLogout }: SidebarProps) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    if (showPopover) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopover]);
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-20 glass-panel flex-col items-center py-8 z-50 border-r-0 rounded-r-3xl my-4 ml-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-neon flex items-center justify-center mb-12 shadow-[0_0_20px_rgba(255,170,0,0.3)]">
          <Box className="w-7 h-7 text-obsidian-950 stroke-[2.5]" />
        </div>

        <nav className="flex-1 space-y-6">
          {WORKSPACES.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`group relative p-4 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? "bg-amber-neon/10 text-amber-neon" 
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
                }`}
                title={label}
              >
                <Icon className={`w-6 h-6 ${isActive ? "drop-shadow-[0_0_8px_rgba(255,170,0,0.5)]" : ""}`} />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-neon rounded-r-full shadow-[0_0_10px_rgba(255,170,0,0.8)]" />
                )}
                
                {/* Tooltip */}
                <div className="absolute left-20 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-obsidian-800 border border-white/10 text-xs font-medium text-gray-200 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {label}
                </div>
              </button>
            );
          })}
        </nav>

        <div className="space-y-4">
          <button className="p-4 rounded-2xl text-gray-500 hover:text-emerald-neon hover:bg-white/5 transition-all">
            <Activity className="w-6 h-6" />
          </button>
          <button
            onClick={() => onNavigate("settings")}
            className={`p-4 rounded-2xl transition-all ${
              active === "settings" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings className="w-6 h-6" />
          </button>
          {user && (
            <div className="relative" ref={popoverRef}>
              <UserAvatar user={user} size="sm" onClick={() => setShowPopover(!showPopover)} />
              {showPopover && (
                <div className="absolute left-16 bottom-0 w-52 rounded-xl bg-obsidian-800 border border-white/10 shadow-xl p-3 z-50">
                  <div className="mb-2">
                    {user.name && <div className="text-sm font-semibold text-white truncate">{user.name}</div>}
                    {user.email && <div className="text-[10px] text-gray-400 truncate">{user.email}</div>}
                  </div>
                  <button
                    onClick={() => { setShowPopover(false); onLogout?.(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-white/5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] glass-panel border-t border-white/10 flex items-start justify-around px-6 pt-3 pb-[env(safe-area-inset-bottom)] z-[100] rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {WORKSPACES.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
                isActive ? "text-amber-neon scale-110" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <div className={`p-2 rounded-xl transition-all ${isActive ? "bg-amber-neon/10" : ""}`}>
                <Icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_8px_rgba(255,170,0,0.5)]" : ""}`} />
              </div>
              <span className="text-[7px] font-black uppercase tracking-[0.2em]">{label}</span>
            </button>
          );
        })}
        <button 
          onClick={() => onNavigate("settings")}
          className={`flex flex-col items-center gap-1.5 transition-all ${
            active === "settings" ? "text-white scale-110" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <div className={`p-2 rounded-xl transition-all ${active === "settings" ? "bg-white/10" : ""}`}>
            <Settings className="w-5 h-5" />
          </div>
          <span className="text-[7px] font-black uppercase tracking-[0.2em]">Settings</span>
        </button>
      </nav>
    </>
  );
}
