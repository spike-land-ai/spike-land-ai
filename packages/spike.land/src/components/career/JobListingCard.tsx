import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { JobListing } from "@/lib/career/types";

interface JobListingCardProps {
  job: JobListing;
}

export function JobListingCard({ job }: JobListingCardProps) {
  return (
    <Card className="bg-zinc-900 border-white/[0.06] hover:border-white/[0.12] transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-white truncate">{job.title}</h3>
            <p className="text-xs text-zinc-400">{job.company}</p>
            <p className="text-xs text-zinc-500 mt-1">{job.location}</p>
          </div>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-blue-400 shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        {(job.salary_min !== null || job.salary_max !== null) && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/20">
              {job.salary_min && job.salary_max
                ? `${job.currency}${job.salary_min.toLocaleString()} - ${job.currency}${job.salary_max.toLocaleString()}`
                : job.salary_min
                  ? `From ${job.currency}${job.salary_min.toLocaleString()}`
                  : `Up to ${job.currency}${(job.salary_max ?? 0).toLocaleString()}`}
            </Badge>
          </div>
        )}
        {job.category && (
          <Badge variant="outline" className="mt-2 text-xs text-zinc-400 border-white/[0.06]">
            {job.category}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
