import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-6 h-2 w-full" />
          <Skeleton className="mt-4 h-8 w-full" />
        </Card>
      ))}
    </div>
  );
}
