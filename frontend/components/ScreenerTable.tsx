"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchScreened, ScreenerOut } from "@/lib/api";

type IndexOption = {
  key: string;
  label: string;
};

const INDEX_OPTIONS: IndexOption[] = [
  { key: "nifty50", label: "Nifty 50" },
  { key: "niftynext50", label: "Nifty Next 50" },
  { key: "niftymidcap150", label: "Nifty Midcap 150" },
  { key: "niftysmallcap250", label: "Nifty Smallcap 250" },
  { key: "nifty500", label: "Nifty 500" },
  { key: "all", label: "All NSE (1000+)" },
];

export default function ScreenerTable({
  initialIndexKey = "nifty500",
  initialRsiMin = "52",
  initialRsiMax = "78",
  initialChangeMin = "1.2",
  initialMaxResults = "25",
  initialBreakoutOnly = true,
  autoFetchOnMount = true,
}: {
  initialIndexKey?: string;
  initialRsiMin?: string;
  initialRsiMax?: string;
  initialChangeMin?: string;
  initialMaxResults?: string;
  initialBreakoutOnly?: boolean;
  autoFetchOnMount?: boolean;
}) {
  const formatRoe = (value: number) => {
    const percent = Math.abs(value) <= 1 ? value * 100 : value;
    return `${percent.toFixed(2)}%`;
  };

  const router = useRouter();
  const pathname = usePathname();
  const [stocks, setStocks] = useState<ScreenerOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexKey, setIndexKey] = useState<string>(initialIndexKey);
  const [rsiMin, setRsiMin] = useState<string>(initialRsiMin);
  const [rsiMax, setRsiMax] = useState<string>(initialRsiMax);
  const [changeMin, setChangeMin] = useState<string>(initialChangeMin);
  const [maxResults, setMaxResults] = useState<string>(initialMaxResults);
  const [breakoutOnly, setBreakoutOnly] = useState<boolean>(initialBreakoutOnly);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [appliedIndexKey, setAppliedIndexKey] = useState<string>(initialIndexKey);
  const [appliedRsiMin, setAppliedRsiMin] = useState<string>(initialRsiMin);
  const [appliedRsiMax, setAppliedRsiMax] = useState<string>(initialRsiMax);
  const [appliedChangeMin, setAppliedChangeMin] = useState<string>(initialChangeMin);
  const [appliedMaxResults, setAppliedMaxResults] = useState<string>(initialMaxResults);
  const [appliedBreakoutOnly, setAppliedBreakoutOnly] = useState<boolean>(initialBreakoutOnly);

  const selectedIndexLabel = useMemo(
    () => INDEX_OPTIONS.find((o) => o.key === indexKey)?.label ?? "All NSE",
    [indexKey]
  );
  const appliedIndexLabel = useMemo(
    () => INDEX_OPTIONS.find((o) => o.key === appliedIndexKey)?.label ?? "All NSE",
    [appliedIndexKey]
  );
  const hasPendingChanges =
    indexKey !== appliedIndexKey ||
    rsiMin !== appliedRsiMin ||
    rsiMax !== appliedRsiMax ||
    changeMin !== appliedChangeMin ||
    maxResults !== appliedMaxResults ||
    breakoutOnly !== appliedBreakoutOnly;

  async function handleFetch() {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = {
        index_key: indexKey,
        rsi_min: rsiMin,
        rsi_max: rsiMax,
        change_min: changeMin,
        breakout_only: String(breakoutOnly),
        limit: maxResults,
      };
      const data = await fetchScreened({
        ...params,
      });
      setStocks(data);
      setAppliedIndexKey(indexKey);
      setAppliedRsiMin(rsiMin);
      setAppliedRsiMax(rsiMax);
      setAppliedChangeMin(changeMin);
      setAppliedMaxResults(maxResults);
      setAppliedBreakoutOnly(breakoutOnly);
      const qs = new URLSearchParams(params);
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    } catch (err) {
      console.error("Failed to fetch screened stocks", err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoFetchOnMount) return;
    void handleFetch();
    // Auto-run on page open so screener prices are always refreshed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetchOnMount]);

  useEffect(() => {
    if (!hasSearched) return;
    let cancelled = false;
    const refreshParams = {
      index_key: appliedIndexKey,
      rsi_min: appliedRsiMin,
      rsi_max: appliedRsiMax,
      change_min: appliedChangeMin,
      breakout_only: String(appliedBreakoutOnly),
      limit: appliedMaxResults,
    };

    const refresh = async () => {
      try {
        const data = await fetchScreened(refreshParams);
        if (!cancelled) setStocks(data);
      } catch {
        // Keep existing rows if background refresh fails.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 60000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [
    hasSearched,
    appliedIndexKey,
    appliedRsiMin,
    appliedRsiMax,
    appliedChangeMin,
    appliedBreakoutOnly,
    appliedMaxResults,
  ]);

  return (
    <div className="space-y-6">
      <div className="glass-card !p-4 md:!p-5 bg-white/5 border-white/10 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse"></span>
            Index
          </div>
          <div className="relative min-w-[240px] flex-1 max-w-[420px]">
            <select
              value={indexKey}
              onChange={(e) => setIndexKey(e.target.value)}
              className="input-premium py-2.5 pr-10 text-sm w-full font-semibold"
            >
              {INDEX_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">▼</span>
          </div>
          <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
            Strategy:
            <span className="text-white">Breakout Momentum</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted ml-1">RSI Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={rsiMin}
                onChange={(e) => setRsiMin(e.target.value)}
                placeholder="Min"
                className="input-premium py-2 text-sm w-full"
              />
              <span className="text-muted text-xs">-</span>
              <input
                type="number"
                value={rsiMax}
                onChange={(e) => setRsiMax(e.target.value)}
                placeholder="Max"
                className="input-premium py-2 text-sm w-full"
              />
            </div>
          </div>

          <div className="flex-1 min-w-[220px] space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted ml-1">Daily Change %</label>
            <input
              type="number"
              value={changeMin}
              onChange={(e) => setChangeMin(e.target.value)}
              placeholder="Min % Change"
              className="input-premium py-2 text-sm w-full"
            />
          </div>

          <div className="min-w-[130px] space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted ml-1">Rows</label>
            <input
              type="number"
              min={1}
              max={300}
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              className="input-premium py-2 text-sm w-full"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-muted pb-2">
            <input
              type="checkbox"
              checked={breakoutOnly}
              onChange={(e) => setBreakoutOnly(e.target.checked)}
              className="accent-blue-500"
            />
            Breakout only
          </label>

          <button
            onClick={handleFetch}
            disabled={loading}
            className="btn-primary py-2.5 px-8 font-bold text-sm min-w-[150px] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span>Scanning</span>
              </>
            ) : (
              <span>Update Results</span>
            )}
          </button>
        </div>
      </div>

      <div className="glass-card !p-0 overflow-hidden border-white/5 shadow-2xl">
        <div className="px-6 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between text-[11px] font-semibold text-muted">
          <span>{hasSearched ? `${appliedIndexLabel} breakout scan` : `${selectedIndexLabel} breakout scan`}</span>
          <span>{loading ? "Refreshing..." : hasSearched ? `${stocks.length} opportunities` : "Select filters and click Update Results"}</span>
        </div>
        {hasSearched && (
          <div className="px-6 py-3 border-b border-white/5 bg-white/[0.03] flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted">
            <span className="text-white">{appliedIndexLabel}</span>
            <span>RSI {appliedRsiMin} - {appliedRsiMax}</span>
            <span>Change {appliedChangeMin}%+</span>
            <span>Rows max {appliedMaxResults}</span>
            <span>{appliedBreakoutOnly ? "Breakout only" : "All matches"}</span>
            {hasPendingChanges && <span className="text-brand">Inputs changed. Click Update Results to apply.</span>}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Symbol</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Current Price</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Change (1D)</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">RSI</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">Breakout</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">Score</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">P/E</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">ROE</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">EMA 200</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stocks.map((s) => (
                <tr key={s.symbol} className="hover:bg-brand/5 transition-colors group">
                  <td className="px-6 py-4">
                    <Link
                      href={`/stocks/${encodeURIComponent(s.symbol)}?from=screener&index_key=${encodeURIComponent(hasSearched ? appliedIndexKey : indexKey)}&rsi_min=${encodeURIComponent(hasSearched ? appliedRsiMin : rsiMin)}&rsi_max=${encodeURIComponent(hasSearched ? appliedRsiMax : rsiMax)}&change_min=${encodeURIComponent(hasSearched ? appliedChangeMin : changeMin)}&limit=${encodeURIComponent(hasSearched ? appliedMaxResults : maxResults)}&breakout_only=${encodeURIComponent(String(hasSearched ? appliedBreakoutOnly : breakoutOnly))}`}
                      className="flex flex-col"
                    >
                      <span className="text-sm font-bold tracking-tight text-white group-hover:text-brand transition-colors">
                        {s.symbol}
                      </span>
                      <span className="text-[10px] font-medium text-muted uppercase tracking-tighter">
                        {s.name || "NSE Listed"}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-white tabular-nums">
                    {typeof s.current_price === "number" ? `Rs ${s.current_price.toFixed(2)}` : "-"}
                  </td>
                  <td className="px-6 py-4">
                    {typeof s.change_1d === "number" ? (
                      <div
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          s.change_1d >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {s.change_1d >= 0 ? "+" : ""}
                        {s.change_1d.toFixed(2)}%
                      </div>
                    ) : (
                      <span className="text-sm text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-white">
                    {typeof s.rsi === "number" ? s.rsi.toFixed(2) : "-"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.is_breakout ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-muted"
                      }`}
                    >
                      {s.is_breakout ? "Yes" : "Watch"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-white">
                    {typeof s.breakout_score === "number" ? s.breakout_score.toFixed(2) : "-"}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium">{typeof s.pe_ratio === "number" ? s.pe_ratio.toFixed(2) : "-"}</td>
                  <td className="px-6 py-4 text-center text-sm font-medium">
                    {typeof s.roe === "number" ? formatRoe(s.roe) : "-"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-mono text-muted">{typeof s.ema_200 === "number" ? s.ema_200.toFixed(2) : "-"}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[10px] font-bold text-muted/60 uppercase tracking-tighter">
                      {s.last_updated
                        ? new Date(s.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "-"}
                    </span>
                  </td>
                </tr>
              ))}

              {!loading && hasSearched && stocks.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium text-muted">No symbols match these breakout filters.</p>
                      <button
                        onClick={() => {
                          setIndexKey("nifty500");
                          setRsiMin("50");
                          setRsiMax("80");
                          setChangeMin("0.8");
                          setMaxResults("25");
                          setBreakoutOnly(true);
                          setStocks([]);
                          setHasSearched(false);
                        }}
                        className="text-xs text-brand hover:underline mt-2"
                      >
                        Reset to recommended filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && !hasSearched && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <p className="text-sm font-medium text-muted">Select an index and filters, then click Update Results.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

