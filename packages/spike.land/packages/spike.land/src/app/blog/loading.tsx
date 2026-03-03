import { Skeleton } from "@/components/ui/skeleton";

function BlogCardSkeleton({ hero = false }: { hero?: boolean; }) {
  return (
    <div className={`space-y-4 ${hero ? "lg:col-span-3" : ""}`}>
      <Skeleton className={`w-full rounded-2xl ${hero ? "h-72" : "h-48"}`} />
      <div className="space-y-2">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className={`h-6 ${hero ? "w-3/4" : "w-full"}`} />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}

export default function BlogLoading() {
  return (
    <div className="container mx-auto px-4 md:px-6 max-w-7xl pt-24 pb-24">
      {/* Header skeleton */}
      <header className="flex flex-col items-center text-center mb-20 space-y-6 pt-10">
        <Skeleton className="h-7 w-48 rounded-full" />
        <Skeleton className="h-20 w-32" />
        <Skeleton className="h-6 w-96" />
      </header>

      {/* Posts grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
        <BlogCardSkeleton hero />
        {Array.from({ length: 5 }).map((_, i) => <BlogCardSkeleton key={i} />)}
      </div>
    </div>
  );
}
