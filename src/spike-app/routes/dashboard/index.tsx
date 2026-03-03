import { useAuth } from "@/hooks/useAuth";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {isAuthenticated ? `Welcome, ${user?.name ?? "User"}` : "Welcome to Spike"}
      </h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Agent Status">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-gray-300" />
            <span className="text-lg font-medium">--</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">Connection status</p>
        </Card>
        <Card title="Recent Apps">
          <p className="text-sm text-gray-500">No recent apps yet. Create one to get started.</p>
        </Card>
        <Card title="Analytics Overview">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tool calls today</span>
              <span className="font-medium">--</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Active sessions</span>
              <span className="font-medium">--</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
