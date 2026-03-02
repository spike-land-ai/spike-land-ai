import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Code2 } from "lucide-react";
import { Link } from "@/components/ui/link";

interface AppCardProps {
  title: string;
  description: string;
  slug: string;
  viewCount?: number | undefined;
}

export function AppCard({ title, description, slug, viewCount }: AppCardProps) {
  return (
    <Link href={`/create/${slug}`} className="block">
      <Card className="h-full cursor-pointer border-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="truncate">{title}</span>
            <Code2 className="w-4 h-4 text-muted-foreground shrink-0" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{description}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
            <span>{viewCount !== undefined ? `${viewCount} views` : "Try it"}</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
