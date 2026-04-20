"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { SymbolOut } from "@/lib/api";

type SymbolAutocompleteInputProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  maxResults?: number;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function SymbolAutocompleteInput({
  value,
  onChange,
  placeholder = "TCS",
  className,
  required,
  disabled,
  maxResults = 8,
}: SymbolAutocompleteInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [symbols, setSymbols] = useState<SymbolOut[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/symbols.json");
        if (!response.ok) return;
        const payload = (await response.json()) as unknown;
        if (!Array.isArray(payload)) return;
        const rows = payload
          .filter((row): row is SymbolOut => {
            if (!row || typeof row !== "object") return false;
            const rec = row as Record<string, unknown>;
            return typeof rec.symbol === "string" && rec.symbol.trim().length > 0;
          })
          .map((row) => ({
            symbol: row.symbol.trim().toUpperCase(),
            name: typeof row.name === "string" && row.name.trim() ? row.name : null,
          }));

        if (!cancelled) setSymbols(rows);
      } catch {
        if (!cancelled) setSymbols([]);
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
    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const results = useMemo(() => {
    const query = normalize(value);
    if (!query) return [] as SymbolOut[];

    const matches = symbols.filter((row) => {
      const symbol = row.symbol?.toLowerCase() ?? "";
      const name = (row.name ?? "").toLowerCase();
      return symbol.includes(query) || name.includes(query);
    });

    matches.sort((a, b) => {
      const left = normalize(a.symbol);
      const right = normalize(b.symbol);
      const leftStarts = left.startsWith(query) ? 0 : 1;
      const rightStarts = right.startsWith(query) ? 0 : 1;
      if (leftStarts !== rightStarts) return leftStarts - rightStarts;
      return left.localeCompare(right);
    });

    return matches.slice(0, maxResults);
  }, [value, symbols, maxResults]);

  function selectSymbol(symbol: string) {
    onChange(symbol.trim().toUpperCase());
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        required={required}
        disabled={disabled}
      />

      {open && value.trim() && (
        <div className="absolute left-0 right-0 mt-2 z-[120] max-h-72 overflow-auto rounded-xl border border-gray-100 bg-white py-1 shadow-2xl">
          {loading && symbols.length === 0 ? (
            <div className="px-3 py-2 text-xs font-medium text-gray-500">Loading...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs font-medium text-gray-500">No matches</div>
          ) : (
            <div className="flex flex-col">
              {results.map((row) => (
                <button
                  key={row.symbol}
                  type="button"
                  onClick={() => selectSymbol(row.symbol)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{row.name || row.symbol}</span>
                  <span className="text-xs font-semibold text-gray-400">{row.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
