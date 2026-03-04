import { useAuth } from "@/hooks/useAuth";

export function SettingsPage() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="displayName" className="mb-1 block text-sm font-medium">Display Name</label>
            <input
              id="displayName"
              type="text"
              defaultValue={isAuthenticated ? (user?.name ?? "") : ""}
              className="w-full rounded-lg border px-4 py-2"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              defaultValue={isAuthenticated ? (user?.email ?? "") : ""}
              className="w-full rounded-lg border px-4 py-2"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="avatarUrl" className="mb-1 block text-sm font-medium">Avatar URL</label>
            <input
              id="avatarUrl"
              type="url"
              defaultValue={isAuthenticated ? ((user?.picture as string) ?? "") : ""}
              className="w-full rounded-lg border px-4 py-2"
              placeholder="https://..."
            />
          </div>
          <button className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
