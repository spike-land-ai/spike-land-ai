import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { User, Settings, LogOut, ChevronDown, Shield, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

export function LoginButton() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (isLoading) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted animate-pulse">
        <Loader2 className="size-4 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Button
        onClick={() => login()}
        className="rounded-xl px-5 font-bold shadow-lg shadow-primary/20"
      >
        Sign in
      </Button>
    );
  }

  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          "flex items-center gap-2 rounded-xl p-1 pr-3 transition-all duration-200 border border-transparent",
          menuOpen ? "bg-muted border-border" : "hover:bg-muted"
        )}
        aria-label={`Account menu for ${user.name ?? user.email ?? "User"}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <div className="relative">
          {user.picture ? (
            <img src={user.picture} alt="" className="h-8 w-8 rounded-lg object-cover shadow-sm" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[10px] font-black text-primary-foreground shadow-inner">
              {initials}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
        </div>
        <div className="hidden flex-col items-start sm:flex">
          <span className="text-xs font-bold leading-none text-foreground">
            {user.name ?? user.preferred_username ?? "User"}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {user.tier ?? "Pro Member"}
          </span>
        </div>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform duration-200", menuOpen && "rotate-180")} />
      </button>

      {menuOpen && (
        <div 
          role="menu" 
          className="absolute right-0 top-full z-[100] mt-2 w-56 origin-top-right rounded-2xl border border-border bg-card p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="px-3 py-3 mb-1 border-b border-border/50">
            <p className="truncate text-sm font-black text-foreground">{user.name ?? "User"}</p>
            {user.email && <p className="truncate text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{user.email}</p>}
          </div>
          
          <div className="space-y-0.5">
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-muted-foreground rounded-xl hover:bg-muted hover:text-foreground transition-colors"
            >
              <Settings className="size-4" />
              Account Settings
            </Link>
            <Link
              to="/settings"
              search={{ tab: "billing" }}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-muted-foreground rounded-xl hover:bg-muted hover:text-foreground transition-colors"
            >
              <CreditCard className="size-4" />
              Billing & Credits
            </Link>
            <div className="h-px bg-border/50 my-1 mx-2" />
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm font-bold text-destructive rounded-xl hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="size-4" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
