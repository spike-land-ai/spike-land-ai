import { JobListingCard } from "./JobListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobListing } from "@/lib/career/types";

interface JobListingsPanelProps {
  jobs: JobListing[];
  isLoading: boolean;
}

export function JobListingsPanel({ jobs, isLoading }: JobListingsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 bg-zinc-800" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        No job listings found for this occupation in your area.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">{jobs.length} listings found</p>
      {jobs.map((job) => (
        <JobListingCard key={job.id} job={job} />
      ))}
    </div>
  );
}
