"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { fetchIndices, fetchOhlcvIntraday, type IndexOut } from "@/lib/api";

function formatNumber(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="mt-3 h-12" />;
  }

  const width = 180;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = values[values.length - 1] >= values[0];
  const stroke = isUp ? "#34d399" : "#fb7185";

  return (
    <div className="mt-3 h-12 px-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}

function IndexCard({
  title,
  quote,
  points,
  hoverBorderClass,
}: {
  title: string;
  quote?: IndexOut | null;
  points?: number[];
  hoverBorderClass?: string;
}) {
  const price = quote?.current_price ?? null;
  const change = quote?.day_change ?? null;
  const changePct = quote?.day_change_pct ?? null;

  const isUp = typeof change === "number" && change >= 0;
  const changeClass = typeof change === "number" ? (isUp ? "text-emerald-400" : "text-rose-400") : "text-muted";

  return (
    <Link
      href={`/stocks/${encodeURIComponent(title)}`}
      className={`glass-card !p-5 flex flex-col justify-between group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${hoverBorderClass ?? ""}`}
    >
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{title}</div>
      <div className="mt-3 text-2xl font-black tracking-tight tabular-nums group-hover:text-white transition-colors">
        {typeof price === "number" ? formatNumber(price) : "\u2014"}
      </div>
      <div className={`mt-2 text-sm font-bold tabular-nums flex items-center gap-1.5 ${changeClass}`}>
        {typeof change === "number" ? (
          <>
            <span>
              <span className="mr-1">{isUp ? "\u25B2" : "\u25BC"}</span>
              {isUp ? "+" : ""}
              {formatNumber(Math.abs(change))}
            </span>
            {typeof changePct === "number" && (
              <span className="opacity-90">
                ({isUp ? "+" : ""}
                {changePct.toFixed(2)}%)
              </span>
            )}
          </>
        ) : (
          "\u2014"
        )}
      </div>
      <Sparkline values={points ?? []} />
    </Link>
  );
}

export default function MarketIndices({ initial }: { initial?: IndexOut[] }) {
  const [data, setData] = useState<IndexOut[] | undefined>(initial);
  const [chartPoints, setChartPoints] = useState<Record<string, number[]>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const freshIndices = await fetchIndices().catch(() => [] as IndexOut[]);
        if (!cancelled && freshIndices.length > 0) setData(freshIndices);
      } catch (err) {
        console.error("Failed to load indices:", err);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") load();
    }

    load();
    document.addEventListener("visibilitychange", onVisibilityChange);
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCharts() {
      try {
        const [niftyRows, sensexRows] = await Promise.all([
          fetchOhlcvIntraday("NIFTY 50", { limit: 120 }).catch(() => []),
          fetchOhlcvIntraday("SENSEX", { limit: 120 }).catch(() => []),
        ]);

        if (cancelled) return;
        setChartPoints({
          "NIFTY 50": niftyRows.map((row) => row.close).filter((value) => Number.isFinite(value)),
          SENSEX: sensexRows.map((row) => row.close).filter((value) => Number.isFinite(value)),
        });
      } catch {
        if (!cancelled) setChartPoints({});
      }
    }

    loadCharts();
    return () => {
      cancelled = true;
    };
  }, []);

  const bySymbol = useMemo(() => {
    const map = new Map<string, IndexOut>();
    for (const q of data ?? []) map.set(q.symbol, q);
    return map;
  }, [data]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <IndexCard title="NIFTY 50" quote={bySymbol.get("NIFTY 50")} points={chartPoints["NIFTY 50"]} hoverBorderClass="hover:border-brand/40" />
      <IndexCard title="SENSEX" quote={bySymbol.get("SENSEX")} points={chartPoints["SENSEX"]} hoverBorderClass="hover:border-emerald-500/40" />
    </div>
  );
}
