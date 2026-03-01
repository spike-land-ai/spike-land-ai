import { Outlet, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useStdb } from "@/hooks/useStdb";
import { LoginButton } from "@/components/LoginButton";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/tools", label: "Tools" },
  { to: "/apps", label: "Apps" },
  { to: "/store", label: "Store" },
  { to: "/messages", label: "Messages" },
  { to: "/analytics", label: "Analytics" },
  { to: "/settings", label: "Settings" },
] as const;

export function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { connected } = useStdb();
  useAnalytics();

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white shadow-lg transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <span className="text-xl font-bold">Spike</span>
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`}
            title={connected ? "Connected" : "Disconnected"}
          />
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-100 [&.active]:bg-blue-50 [&.active]:text-blue-700"
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t p-4">
          <LoginButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center border-b bg-white px-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded p-2 hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-4 flex-1 text-lg font-bold">Spike</span>
          <LoginButton />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
