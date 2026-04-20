"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { fetchAnalytics, fetchSymbols, type SymbolOut } from "@/lib/api";

function formatPrice(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TickerItem({ s }: { s: SymbolOut }) {
  const price = s.current_price ?? null;
  const changePct = s.change_pct ?? null;
  const isUp = typeof changePct === "number" && changePct >= 0;
  const changeClass = typeof changePct === "number" ? (isUp ? "text-emerald-400" : "text-rose-400") : "text-muted";

  return (
    <Link
      href={`/stocks/${encodeURIComponent(s.symbol)}`}
      className="ticker-item group"
      aria-label={`Open ${s.symbol}`}
    >
      <span className="ticker-sym">{s.symbol}</span>
      <span className="ticker-price">{typeof price === "number" ? formatPrice(price) : "—"}</span>
      <span className={`ticker-change ${changeClass}`}>
        {typeof changePct === "number" ? (
          <>
            <span className="ticker-arrow">{isUp ? "▲" : "▼"}</span>
            {isUp ? "+" : ""}
            {Math.abs(changePct).toFixed(2)}%
          </>
        ) : (
          "—"
        )}
      </span>
    </Link>
  );
}

export default function TickerTape({ limit = 50 }: { limit?: number }) {
  const [symbols, setSymbols] = useState<SymbolOut[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchSymbols({ limit, index_key: "nifty50" });
        const normalized = data.filter((s) => !!s?.symbol);
        const missingPriceSymbols = normalized
          .filter((s) => s.current_price == null)
          .map((s) => s.symbol)
          .filter(Boolean);

        if (missingPriceSymbols.length > 0) {
          const analyticsRows = await Promise.all(
            missingPriceSymbols.map(async (symbol) => [symbol, await fetchAnalytics(symbol)] as const),
          );
          const analyticsMap = new Map(analyticsRows);
          const hydrated = normalized.map((s) => {
            const analytics = analyticsMap.get(s.symbol);
            if (!analytics) return s;
            return {
              ...s,
              current_price: s.current_price ?? analytics.current_price ?? null,
              change_pct: s.change_pct ?? analytics.day_change_pct ?? null,
            };
          });
          if (!cancelled) setSymbols(hydrated);
          return;
        }

        if (!cancelled) setSymbols(normalized);
      } catch (err) {
        console.error("Failed to load ticker tape symbols:", err);
      }
    }

    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [limit]);

  const items = useMemo(
    () =>
      [...symbols]
        .sort((a, b) => a.symbol.localeCompare(b.symbol, "en", { sensitivity: "base" }))
        .slice(0, limit),
    [symbols, limit]
  );
  const trackItems = useMemo(() => [...items, ...items], [items]);

  if (items.length === 0) {
    return (
      <div className="ticker-bar" aria-label="Nifty 50 ticker (loading)">
        <div className="ticker-track">
          <div className="ticker-placeholder">Loading market tape…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-bar" aria-label="Nifty 50 ticker">
      <div className="ticker-track">
        {trackItems.map((s, idx) => (
          <TickerItem key={`${s.symbol}-${idx}`} s={s} />
        ))}
      </div>
    </div>
  );
}
