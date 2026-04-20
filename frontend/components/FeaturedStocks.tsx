"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { fetchSymbols, type SymbolOut } from "@/lib/api";

type FeaturedStocksProps = {
  initial: SymbolOut[];
  symbols: readonly string[];
};

export default function FeaturedStocks({ initial, symbols }: FeaturedStocksProps) {
  const [rows, setRows] = useState<SymbolOut[]>(initial);
  const symbolsQuery = useMemo(() => symbols.join(","), [symbols]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const fresh = await fetchSymbols({
          limit: symbols.length,
          symbols: symbolsQuery,
        });
        if (!cancelled && fresh.length > 0) {
          setRows(fresh);
        }
      } catch {
        // Keep previous data if refresh fails.
      }
    };

    void load();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 60000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [symbols.length, symbolsQuery]);

  const formatINR = (value: number) =>
    value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (rows.length === 0) {
    return (
      <div className="glass-card py-20 flex flex-col items-center justify-center text-center">
        <div className="text-4xl mb-4">?</div>
        <h3 className="text-xl font-bold mb-2">No data available</h3>
        <p className="text-muted text-sm max-w-md">
          We could not fetch the market data. Please check if the backend server is running correctly.
        </p>
        <button className="mt-6 btn-primary !px-8">Retry Connection</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {rows.map((s) => {
        const rawPrice = (s as { current_price?: unknown })?.current_price ?? null;
        const rawChangePct = (s as { change_pct?: unknown })?.change_pct ?? null;

        const price =
          typeof rawPrice === "number"
            ? rawPrice
            : typeof rawPrice === "string"
              ? Number(rawPrice)
              : null;
        const changePct =
          typeof rawChangePct === "number"
            ? rawChangePct
            : typeof rawChangePct === "string"
              ? Number(rawChangePct)
              : null;

        const hasPrice = typeof price === "number" && Number.isFinite(price);
        const hasPct = typeof changePct === "number" && Number.isFinite(changePct);
        const factor = hasPct ? 1 + changePct / 100 : null;
        const change =
          hasPrice && hasPct && factor !== null && factor !== 0 ? price - price / factor : null;
        const hasChange = typeof change === "number" && Number.isFinite(change);
        const isUp = (hasChange ? (change as number) : (hasPct ? (changePct as number) : 0)) >= 0;

        return (
          <Link
            key={s.symbol}
            href={`/stocks/${encodeURIComponent(s.symbol)}`}
            className="glass-card p-4 hover:shadow-2xl hover:shadow-brand/5 hover:-translate-y-1 transition-all duration-300 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-bold tracking-tight mb-1">{s.symbol}</div>
                <div className="text-xs font-medium text-muted line-clamp-1">{s.name ?? "Indian Bluechip"}</div>
              </div>
              <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-muted uppercase tracking-tighter border border-white/5">
                NSE
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-0.5">Price</div>
              <div className="flex items-end justify-between gap-3">
                <div className="text-xl font-black tracking-tight tabular-nums">
                  {hasPrice ? `Rs ${formatINR(price as number)}` : "-"}
                </div>
                {hasPct && hasChange && (
                  <div className={`text-xs font-bold tabular-nums flex items-center gap-1.5 ${isUp ? "text-emerald-400" : "text-rose-400"} whitespace-nowrap`}>
                    <span className="mr-0.5">{isUp ? "^" : "v"}</span>
                    <span>
                      {isUp ? "+" : ""}Rs {formatINR(Math.abs(change as number))}
                    </span>
                    <span className="opacity-90">
                      ({isUp ? "+" : ""}{(changePct as number).toFixed(2)}%)
                    </span>
                  </div>
                )}
                {hasPct && !hasChange && (
                  <div className={`text-xs font-bold tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"} whitespace-nowrap`}>
                    {(changePct as number) >= 0 ? "+" : ""}
                    {(changePct as number).toFixed(2)}%
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand/80 group-hover:text-brand transition-colors">
                Analysis Available
              </div>
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-brand/20 transition-colors">
                <span className="text-xs group-hover:text-brand transition-colors">{">"}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
