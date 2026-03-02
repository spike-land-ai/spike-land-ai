import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stripMarkdown } from "@/lib/learnit/utils";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

interface TopicCardProps {
  title: string;
  description: string;
  slug: string;
  viewCount?: number;
}

export function TopicCard({ title, description, slug, viewCount }: TopicCardProps) {
  return (
    <Link href={`/learnit/${slug}`} className="block transition-all hover:-translate-y-1">
      <Card className="h-full hover:shadow-md cursor-pointer border-primary/10 hover:border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-lg">
            {title}
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {stripMarkdown(description)}
          </p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
            <span>{viewCount !== undefined ? `${viewCount} views` : "Start learning"}</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
