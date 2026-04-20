"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addWatchlistItem,
  fetchWatchlistMetrics,
  fetchWatchlist,
  removeWatchlistItem,
  ScreenerOut,
  WatchlistOut,
} from "@/lib/api";
import SymbolAutocompleteInput from "@/components/SymbolAutocompleteInput";

function formatUpdated(value: string | null | undefined): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistOut[]>([]);
  const [metricsBySymbol, setMetricsBySymbol] = useState<Record<string, ScreenerOut>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formSymbol, setFormSymbol] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const watchlist = await fetchWatchlist();
      setItems(watchlist);

      const symbols = Array.from(
        new Set(watchlist.map((item) => item.symbol.trim().toUpperCase()).filter(Boolean)),
      );
      if (symbols.length === 0) {
        setMetricsBySymbol({});
      } else {
        const screened = await fetchWatchlistMetrics(symbols);
        const metricsMap = Object.fromEntries(
          screened.map((row) => [row.symbol.trim().toUpperCase(), row]),
        );
        setMetricsBySymbol(metricsMap);
      }
    } catch (err) {
      console.error(err);
      setMetricsBySymbol({});
      setMessage("Unable to load watchlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load(false);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(false);
      }
    }, 60000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [load]);

  const orderedItems = useMemo(() => {
    return [...items].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [items]);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const symbol = formSymbol.trim().toUpperCase();
    if (!symbol) {
      setMessage("Please enter a stock symbol.");
      return;
    }

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
    if (!token) {
      setMessage("Please login first to save watchlist symbols.");
      return;
    }

    setSaving(true);
    try {
      await addWatchlistItem({ symbol });
      setFormSymbol("");
      setShowForm(false);
      setMessage("Symbol added to watchlist.");
      await load(false);
    } catch (err) {
      console.error(err);
      setMessage("Unable to add symbol. Please check login and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(symbol: string) {
    setMessage(null);
    setRemovingSymbol(symbol);
    try {
      await removeWatchlistItem(symbol);
      setMessage(`${symbol} removed from watchlist.`);
      await load(false);
    } catch (err) {
      console.error(err);
      setMessage("Unable to remove symbol.");
    } finally {
      setRemovingSymbol(null);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
        <Link href="/" className="text-brand hover:underline underline-offset-4">
          Home
        </Link>
        <span className="text-muted">/</span>
        <span className="text-muted">Watchlist</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">My Watchlist</h1>
          <p className="text-muted font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Personalized list of symbols for rapid trade execution
          </p>
        </div>
        <button
          className="btn-primary py-2 px-6 font-bold text-sm"
          onClick={() => setShowForm((prev) => !prev)}
        >
          {showForm ? "Close" : "+ Add Symbol"}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleAdd} className="glass-card relative z-30 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">
              Symbol
            </label>
            <SymbolAutocompleteInput
              value={formSymbol}
              onChange={setFormSymbol}
              className="input-premium w-full"
              placeholder="ITC"
              required
            />
          </div>
          <button type="submit" className="btn-primary py-3 font-bold" disabled={saving}>
            {saving ? "Saving..." : "Save Symbol"}
          </button>
        </form>
      ) : null}

      {message ? <div className="text-sm text-brand">{message}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center p-24">
          <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
        </div>
      ) : orderedItems.length === 0 ? (
        <div className="glass-card !py-24 text-center border-dashed border-white/10">
          <div className="text-4xl mb-4 opacity-20">*</div>
          <h3 className="text-xl font-bold mb-2">Your watchlist is empty</h3>
          <p className="text-sm text-muted">Add symbols to track market signals and setup opportunities.</p>
        </div>
      ) : (
        <div className="glass-card relative z-0 !p-0 overflow-hidden border-white/5 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">Symbol</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Current Price</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">Change (1D)</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">RSI</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">Breakout</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">Score</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">P/E</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">ROE</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">EMA 200</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Updated</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orderedItems.map((item) => {
                  const symbol = item.symbol.trim().toUpperCase();
                  const metric = metricsBySymbol[symbol];
                  const change1d = metric?.change_1d;
                  const isUp = typeof change1d === "number" && Number.isFinite(change1d) && change1d >= 0;

                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/stocks/${symbol}`} className="flex flex-col">
                          <span className="text-sm font-bold tracking-tight text-white group-hover:text-brand transition-colors">
                            {symbol}
                          </span>
                          <span className="text-[10px] font-medium text-muted uppercase tracking-tighter">
                            {metric?.name || "NSE Listed"}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black tabular-nums text-white">
                        {typeof metric?.current_price === "number" && Number.isFinite(metric.current_price)
                          ? `Rs ${metric.current_price.toFixed(2)}`
                          : "--"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {typeof change1d === "number" && Number.isFinite(change1d) ? (
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-black tabular-nums ${
                              isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {isUp ? "+" : ""}
                            {change1d.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-sm text-muted">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold tabular-nums text-white">
                        {typeof metric?.rsi === "number" && Number.isFinite(metric.rsi) ? metric.rsi.toFixed(2) : "--"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex rounded-md px-2 py-1 text-xs font-black tabular-nums bg-brand/20 text-brand">
                          WATCH
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold tabular-nums text-white">
                        {typeof metric?.breakout_score === "number" && Number.isFinite(metric.breakout_score)
                          ? metric.breakout_score.toFixed(2)
                          : "--"}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold tabular-nums text-white">
                        {typeof metric?.pe_ratio === "number" && Number.isFinite(metric.pe_ratio)
                          ? metric.pe_ratio.toFixed(2)
                          : "--"}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold tabular-nums text-white">
                        {typeof metric?.roe === "number" && Number.isFinite(metric.roe)
                          ? `${metric.roe.toFixed(2)}%`
                          : "--"}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium tabular-nums text-muted">
                        {typeof metric?.ema_200 === "number" && Number.isFinite(metric.ema_200)
                          ? metric.ema_200.toFixed(2)
                          : "--"}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-bold tabular-nums text-muted">
                        {formatUpdated(metric?.last_updated ?? null)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleRemove(symbol)}
                          className="text-[10px] font-black uppercase tracking-widest text-rose-400 hover:underline"
                          disabled={removingSymbol === symbol}
                        >
                          {removingSymbol === symbol ? "Removing..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
