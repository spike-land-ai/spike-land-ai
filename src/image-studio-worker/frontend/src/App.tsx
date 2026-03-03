import { useState, useEffect, useRef } from "react";
import { Sidebar, type Workspace } from "./components/layout/Sidebar";
import { MainContent } from "./components/layout/MainContent";
import { useCredits } from "./hooks/useCredits";
import { useAuth } from "./contexts/AuthContext";
import { ChatWidget } from "./components/ui/ChatWidget";
import { Sparkles, Github, Activity, Zap, Shield, Zap as ZapIcon, Layout, Cpu, Image as ImageIcon, LogOut } from "lucide-react";
import { DragDropProvider } from "./contexts/DragDropContext";
import { eventBus } from "./services/event-bus";

import { InteractivePrompts } from "./components/sections/InteractivePrompts";
import { LiveActivity } from "./components/sections/LiveActivity";
import { AnimatedGenerations } from "./components/sections/AnimatedGenerations";

export function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const hash = window.location.hash.replace("#/", "");
    return ["studio", "gallery", "archive", "intelligence", "showcase", "settings"].includes(hash)
      ? (hash as Workspace)
      : "studio";
  });

  const [isDemo, setIsDemo] = useState(false);
  const { isLoggedIn, user, login, logout, loading: authLoading, error: authError } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);
  const { balance, loading: balanceLoading } = useCredits({ enabled: isLoggedIn || isDemo });

  // Update hash when workspace changes
  useEffect(() => {
    window.location.hash = `/${workspace}`;
  }, [workspace]);

  // Sync state with hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#/", "");
      if (["studio", "gallery", "archive", "intelligence", "showcase", "settings"].includes(hash)) {
        setWorkspace(hash as Workspace);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleEditInteractive = (url: string, prompt: string) => {
    sessionStorage.setItem("studio_initial_image", JSON.stringify({ url, name: prompt }));
    setIsDemo(true);
    window.location.hash = "#/studio";
  };

  // Global paste-to-upload handler (authenticated/demo app)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const formData = new FormData();
          formData.append("file", file);
          formData.append("name", `Pasted-${new Date().toISOString().slice(0, 19)}`);

          try {
            const res = await fetch("/api/gallery/upload", {
              method: "POST",
              body: formData,
            });
            if (res.ok) {
              eventBus.emit("gallery:updated", { reason: "upload" });
            }
          } catch {
            // silently fail
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  if (authLoading) {
    return (
      <div className="h-[100dvh] bg-obsidian-950 flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-neon/20 border-t-amber-neon rounded-full animate-spin" />
          <span className="font-mono text-xs uppercase tracking-widest text-amber-neon/50">Initializing Studio...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn && !isDemo) {
    return (
      <DragDropProvider>
      <div className="min-h-[100dvh] bg-obsidian-950 text-gray-200 overflow-x-hidden relative selection:bg-amber-neon/30 selection:text-white font-sans antialiased">
        {/* Cinematic Neural Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-amber-neon/5 blur-[160px] rounded-full animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-neon/5 blur-[160px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
          <div className="absolute inset-0 canvas-grid opacity-30" />
        </div>

        {/* Floating Navigation */}
        <nav className="fixed top-0 left-0 w-full h-16 md:h-20 flex items-center justify-between px-6 md:px-10 z-50 backdrop-blur-xl bg-obsidian-950/40 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-neon flex items-center justify-center shadow-lg shadow-amber-neon/20">
              <Sparkles className="w-5 h-5 text-obsidian-950 stroke-[2.5]" />
            </div>
            <span className="text-lg font-black tracking-tight uppercase">Pixel<span className="text-amber-neon">Studio</span></span>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            <a href="#features" className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">Abstractions</a>
            <button 
              onClick={() => setIsDemo(true)}
              className="px-4 py-2 rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all active:scale-95"
            >
              Sandbox
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-32 md:pt-40 pb-12 md:pb-24 px-6 md:px-12 z-10 flex flex-col items-center text-center max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-neon/5 border border-amber-neon/10 text-[9px] font-black uppercase tracking-[0.2em] text-amber-neon mb-6 animate-in slide-in-from-bottom-2 duration-700">
            <Activity className="w-3 h-3 animate-pulse" /> Unified Canvas v2.0
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white max-w-4xl mb-6 leading-[0.9] animate-in fade-in slide-in-from-bottom-4 duration-1000">
            CREATE WITH <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-neon via-amber-400 to-amber-600">AI</span>
          </h1>

          <p className="text-base md:text-lg text-gray-500 font-medium max-w-xl mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200 px-4">
            Generate, edit, and enhance images with 40+ AI tools on an infinite canvas workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <button
              onClick={() => login("google")}
              className="group w-full sm:flex-1 flex items-center justify-center gap-3 py-3 px-6 text-sm font-bold rounded-xl bg-white text-gray-950 hover:bg-gray-100 transition-all active:scale-[0.98] shadow-lg shadow-white/5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button
              onClick={() => login("github")}
              className="w-full sm:flex-1 flex items-center justify-center gap-3 py-3 px-6 text-sm font-bold rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              <Github className="w-5 h-5" />
              GitHub
            </button>
          </div>

          {authError && (
            <div className="mt-6 w-full max-w-md px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center animate-in fade-in duration-300">
              {authError}
            </div>
          )}
        </section>

        {/* Feature Grid */}
        <section id="features" className="relative px-6 md:px-12 py-12 md:py-20 z-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {[
            { icon: Layout, title: "Infinite Workspace", color: "amber-neon", text: "No grids. No folders. Just an endless expanse for your assets to breathe and evolve." },
            { icon: Cpu, title: "Neural Orchestrator", color: "emerald-neon", text: "Chain 40+ MCP tools into complex creative workflows with simple natural language." },
            { icon: Shield, title: "Local-First Privacy", color: "blue-400", text: "Your tokens and assets remain within your isolate. Direct provider handshake only." }
          ].map((feat, i) => (
            <div key={i} className="glass-panel rounded-3xl p-8 border-white/5 space-y-4 hover:border-white/20 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <feat.icon className={`w-6 h-6 text-${feat.color}`} />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">{feat.title}</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">{feat.text}</p>
            </div>
          ))}
        </section>

        {/* Pre-Generated Image Demo */}
        <InteractivePrompts onEdit={handleEditInteractive} />

        {/* Live Network Section */}
        <section id="network" className="relative px-6 md:px-12 py-12 md:py-24 z-10 max-w-7xl mx-auto border-t border-white/5">
          <div className="flex flex-col lg:flex-row gap-12 md:gap-20">
            <div className="lg:w-1/3 space-y-8">
              <div className="space-y-3 text-center lg:text-left">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">The Neural<br/><span className="text-emerald-neon">Stream</span></h2>
                <p className="text-sm text-gray-500 font-medium leading-relaxed">Observe real-time manifestations across the Pixel Studio network. Every pixel is proof of an idea taking form.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-amber-neon/5 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-amber-neon" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-widest">1.2M Assets</div>
                    <div className="text-[9px] text-gray-600 font-bold uppercase">Manifested this week</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-neon/5 flex items-center justify-center">
                    <ZapIcon className="w-5 h-5 text-emerald-neon" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-widest">42.8k Ops/s</div>
                    <div className="text-[9px] text-gray-600 font-bold uppercase">Neural throughput</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-6">
              <div className="p-1.5 bg-white/5 rounded-[2.5rem] border border-white/5 backdrop-blur-sm">
                <AnimatedGenerations />
              </div>
              <div className="h-[300px] md:h-[400px]">
                <LiveActivity />
              </div>
            </div>
          </div>
        </section>

        <footer className="relative z-10 py-12 md:py-16 px-6 md:px-12 border-t border-white/5 text-center">
          <div className="flex items-center justify-center gap-3 mb-6 opacity-40">
            <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-obsidian-950 stroke-[2.5]" />
            </div>
            <span className="text-xs font-black tracking-tighter uppercase">PixelStudio</span>
          </div>
          <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em]">Crafted by Spike.Land Neural Dept.</p>
        </footer>

        <ChatWidget />
      </div>
      </DragDropProvider>
    );
  }

  return (
    <DragDropProvider>
    <div className="h-[100dvh] flex flex-col md:flex-row bg-obsidian-950 text-gray-200 overflow-hidden font-sans antialiased selection:bg-amber-neon/20">
      <Sidebar active={workspace} onNavigate={(ws) => setWorkspace(ws as Workspace)} user={user} onLogout={logout} />
      
      <div className="flex-1 flex flex-col relative min-w-0 h-full">
        <header className="absolute top-0 left-0 right-0 h-14 md:h-16 flex items-center justify-between px-4 md:px-10 z-40 bg-obsidian-950/60 backdrop-blur-2xl border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-amber-neon md:hidden flex items-center justify-center shadow-lg shadow-amber-neon/20">
              <Sparkles className="w-5 h-5 text-obsidian-950 stroke-[2.5]" />
            </div>
            <div className="hidden md:block h-6 w-px bg-white/10 mx-2" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500">Node</span>
              <span className="text-xs font-bold text-white capitalize">{workspace}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500">Neural Credits</span>
              <div className="flex items-center gap-2">
                {balanceLoading ? (
                  <div className="w-12 h-3 bg-white/5 animate-pulse rounded" />
                ) : (
                  <span className="text-sm font-black text-amber-neon">{balance ?? 0}</span>
                )}
                <Zap className="w-3 h-3 text-amber-neon fill-amber-neon" />
              </div>
            </div>
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-xl overflow-hidden border border-white/10 hover:border-amber-neon/50 transition-all cursor-pointer shadow-lg"
              >
                {user?.image ? (
                  <img src={user.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-amber-neon to-emerald-neon flex items-center justify-center">
                    <span className="text-xs font-black text-obsidian-950">
                      {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                )}
              </button>
              {showUserMenu && (
                <div
                  className="absolute right-0 top-12 w-56 rounded-2xl bg-obsidian-900 border border-white/10 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  {user?.name && <div className="text-xs font-bold text-white truncate mb-0.5">{user.name}</div>}
                  {user?.email && <div className="text-[9px] text-gray-500 truncate mb-3 font-medium">{user.email}</div>}
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Terminate Session
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`flex-1 flex overflow-hidden relative ${workspace === 'studio' ? '' : 'pt-14 md:pt-16 md:pl-20'}`}>
          <MainContent workspace={workspace} />
        </div>
      </div>
      
      <ChatWidget />
    </div>
    </DragDropProvider>
  );
}
