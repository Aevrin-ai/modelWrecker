import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { apiClient } from "@/api";
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

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      apiClient
        .search(query)
        .then((r) => {
          if (live) {
            setResults(r);
            setActive(0);
          }
        })
        .catch(() => {
          if (live) setResults([]);
        });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (document.activeElement?.tagName !== "INPUT") {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(r: SearchResult) {
    navigate(r.href);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Type to search..."
        aria-label="Search projects, targets, campaigns, findings, devices, and reports"
        className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm sm:pr-16 transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[0.65rem] text-muted-foreground sm:flex">
        Ctrl K
      </kbd>

      {open && query.trim() && (
        <div className="absolute left-0 top-10 z-50 w-[min(28rem,calc(100vw-1rem))] overflow-hidden rounded-md border bg-popover p-1 shadow-popover animate-fade-in">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                  i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
              >
                <span className="min-w-14 shrink-0 text-xs font-medium text-muted-foreground">
                  {KIND_LABEL[r.kind]}
                </span>
                <span className="flex-1 truncate">{r.title}</span>
                <span className="truncate text-xs text-muted-foreground">{r.subtitle}</span>
                {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
