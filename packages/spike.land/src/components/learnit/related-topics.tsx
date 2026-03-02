import { getRelatedTopics } from "@/lib/learnit/relation-service";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface RelatedTopicsProps {
  topicId: string;
  className?: string;
}

export async function RelatedTopics({ topicId, className }: RelatedTopicsProps) {
  const relatedTopics = await getRelatedTopics(topicId, 5);

  if (relatedTopics.length === 0) {
    return null;
  }

  return (
    <div className={cn("rounded-lg border bg-card p-6", className)}>
      <h3 className="text-lg font-semibold mb-4">Related Topics</h3>
      <ul className="space-y-3">
        {relatedTopics.map((topic) => (
          <li key={topic.id}>
            <Link
              href={`/learnit/${topic.slug}`}
              className="group flex items-start gap-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="w-4 h-4 mt-1 flex-shrink-0 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {topic.title}
                </span>
                {topic.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {topic.description}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
