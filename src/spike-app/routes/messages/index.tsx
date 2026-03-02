import { Link } from "@tanstack/react-router";

const conversations = [
  {
    userId: "alice",
    name: "Alice",
    lastMessage: "Sounds good, let me check.",
    time: "2m ago",
    unread: true,
  },
  {
    userId: "bob",
    name: "Bob",
    lastMessage: "The deployment looks fine.",
    time: "1h ago",
    unread: false,
  },
  {
    userId: "carol",
    name: "Carol",
    lastMessage: "Can you review my PR?",
    time: "3h ago",
    unread: false,
  },
];

export function MessagesIndexPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>
      <div className="divide-y rounded-xl border bg-white">
        {conversations.map((conv) => (
          <Link
            key={conv.userId}
            to="/messages/$userId"
            params={{ userId: conv.userId }}
            className="flex items-center gap-4 p-4 hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
              {conv.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${conv.unread ? "font-semibold" : "font-medium"}`}>
                  {conv.name}
                </span>
                <span className="text-xs text-gray-400">{conv.time}</span>
              </div>
              <p className="truncate text-sm text-gray-500">{conv.lastMessage}</p>
            </div>
            {conv.unread && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
