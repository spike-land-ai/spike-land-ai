"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScheduledPost {
  id: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  time: string;
  platform: string;
  title: string;
}

interface ScheduleCalendarProps {
  posts: ScheduledPost[];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const platformColors: Record<string, string> = {
  twitter: "bg-sky-500",
  linkedin: "bg-blue-700",
  instagram: "bg-pink-500",
  facebook: "bg-blue-500",
};

function platformColor(platform: string): string {
  return platformColors[platform.toLowerCase()] ?? "bg-zinc-500";
}

export function ScheduleCalendar({ posts }: ScheduleCalendarProps) {
  const postsByDay = Array.from({ length: 7 }, (_, i) => posts.filter(p => p.dayOfWeek === i));

  return (
    <Card className="bg-zinc-900 border-zinc-800 w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-zinc-100">Weekly Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map(day => (
            <div
              key={day}
              className="text-center text-xs font-medium text-zinc-500 pb-2"
            >
              {day}
            </div>
          ))}
          {postsByDay.map((dayPosts, dayIndex) => (
            <div
              key={dayIndex}
              className="min-h-[80px] rounded-lg bg-zinc-800/50 border border-zinc-800 p-1.5 space-y-1"
            >
              {dayPosts.map(post => (
                <div
                  key={post.id}
                  className="group relative"
                  title={`${post.platform} — ${post.time}: ${post.title}`}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded px-1 py-0.5 cursor-default",
                      "hover:bg-zinc-700/60 transition-colors",
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        platformColor(post.platform),
                      )}
                    />
                    <span className="text-[10px] text-zinc-400 truncate leading-tight">
                      {post.time}
                    </span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 hidden group-hover:block">
                    <div className="bg-zinc-700 border border-zinc-600 rounded-md px-2 py-1 text-xs text-zinc-100 whitespace-nowrap shadow-lg">
                      <span className="font-medium capitalize">{post.platform}</span>
                      <span className="text-zinc-400">· {post.time}</span>
                      <div className="text-zinc-300 max-w-[160px] truncate">{post.title}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries(platformColors).map(([platform, color]) => (
            <div key={platform} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", color)} />
              <span className="text-xs text-zinc-500 capitalize">{platform}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
