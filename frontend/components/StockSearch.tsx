"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchSymbols, type SymbolOut } from "@/lib/api";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-70">
      <path
        d="M10.5 18.5a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function StockSearch({ initialSymbols }: { initialSymbols?: SymbolOut[] } = {}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [symbols, setSymbols] = useState<SymbolOut[]>(() => initialSymbols ?? []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/symbols.json");
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setSymbols(data);
        }
      } catch (err) {
        console.error("Failed to load symbols for search:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Array.isArray(initialSymbols) && initialSymbols.length > 0 && symbols.length === 0) {
      setSymbols(initialSymbols);
    }
  }, [initialSymbols, symbols.length]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];

    const matches = symbols.filter((s) => {
      const sym = s.symbol?.toLowerCase() ?? "";
      const name = (s.name ?? "").toLowerCase();
      return sym.includes(q) || name.includes(q);
    });

    matches.sort((a, b) => {
      const qa = normalize(a.symbol);
      const qb = normalize(b.symbol);
      const aStarts = qa.startsWith(q) ? 0 : 1;
      const bStarts = qb.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return qa.localeCompare(qb);
    });

    return matches.slice(0, 8);
  }, [query, symbols]);

  useEffect(() => {
    results.slice(0, 4).forEach((result) => {
      router.prefetch(`/stocks/${encodeURIComponent(result.symbol)}`);
    });
  }, [results, router]);

  function go(symbol: string) {
    const sym = symbol.trim();
    if (!sym) return;
    setOpen(false);
    setQuery("");
    router.push(`/stocks/${encodeURIComponent(sym)}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (results.length > 0) return go(results[0].symbol);
    if (query.trim()) return go(query.trim().toUpperCase());
  }

  return (
    <div ref={rootRef} className="relative">
      <form onSubmit={onSubmit}>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted pointer-events-none">
            <SearchIcon />
          </div>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search for IN Stocks"
            autoComplete="off"
            className="search-premium w-full pl-10 pr-3 text-sm font-medium"
            aria-label="Search stocks"
          />
        </div>
      </form>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl z-50 max-h-80 overflow-auto border border-gray-100 py-2">
          {loading && symbols.length === 0 ? (
            <div className="px-4 py-3 text-sm font-medium text-gray-500">Loading…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm font-medium text-gray-500">
              No matches
            </div>
          ) : (
            <div className="flex flex-col">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  type="button"
                  onClick={() => go(r.symbol)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {r.name || r.symbol}
                  </span>
                  <span className="text-xs text-gray-400 font-semibold">{r.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
