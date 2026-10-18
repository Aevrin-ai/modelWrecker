import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { apiClient } from "@/api";
import type { SearchResult } from "@/types";
import { SearchResultsList } from "./SearchResultsList";

// waits for a short typing pause before asking the API
const SEARCH_DEBOUNCE_MS = 180;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let live = true;
    const debounceTimer = setTimeout(() => {
      apiClient
        .search(query)
        .then((found) => {
          if (live) {
            setResults(found);
            setActive(0);
          }
        })
        .catch(() => {
          if (live) setResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(debounceTimer);
    };
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      const isShortcut = (e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/";
      if (!isShortcut || document.activeElement?.tagName === "INPUT") return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function openResult(result: SearchResult) {
    navigate(result.href);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      openResult(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
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
        <SearchResultsList query={query} results={results} activeIndex={active} onHover={setActive} onSelect={openResult} />
      )}
    </div>
  );
}
