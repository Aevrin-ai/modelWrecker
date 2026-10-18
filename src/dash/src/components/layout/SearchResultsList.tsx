import { CornerDownLeft } from "lucide-react";
import type { SearchResult } from "@/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  project: "Project",
  target: "Target",
  campaign: "Campaign",
  finding: "Finding",
  device: "Device",
  report: "Report",
};

export interface SearchResultsListProps {
  query: string;
  results: SearchResult[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (result: SearchResult) => void;
}

export function SearchResultsList({ query, results, activeIndex, onHover, onSelect }: SearchResultsListProps) {
  return (
    <div className="absolute left-0 top-10 z-50 w-[min(28rem,calc(100vw-1rem))] overflow-hidden rounded-md border bg-popover p-1 shadow-popover animate-fade-in">
      {results.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          No matches for &ldquo;{query}&rdquo;
        </p>
      ) : (
        results.map((result, i) => (
          <button
            key={`${result.kind}-${result.id}`}
            type="button"
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(result)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
              i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
            )}
          >
            <span className="min-w-14 shrink-0 text-xs font-medium text-muted-foreground">
              {KIND_LABEL[result.kind]}
            </span>
            <span className="flex-1 truncate">{result.title}</span>
            <span className="truncate text-xs text-muted-foreground">{result.subtitle}</span>
            {i === activeIndex && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
          </button>
        ))
      )}
    </div>
  );
}
