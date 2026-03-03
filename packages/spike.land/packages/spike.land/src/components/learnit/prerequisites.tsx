import { getPrerequisites } from "@/lib/learnit/relation-service";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";
import Link from "next/link";

interface PrerequisitesProps {
  topicId: string;
  className?: string;
}

export async function Prerequisites(
  { topicId, className }: PrerequisitesProps,
) {
  const prerequisites = await getPrerequisites(topicId);

  if (prerequisites.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-3">
        <BookOpen className="w-4 h-4" />
        <h4 className="font-medium text-sm">Before you start</h4>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Make sure you understand these topics first:
      </p>
      <ul className="space-y-2">
        {prerequisites.map(topic => (
          <li key={topic.id}>
            <Link
              href={`/learnit/${topic.slug}`}
              className="text-sm font-medium text-amber-500 hover:text-amber-400 hover:underline"
            >
              {topic.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
