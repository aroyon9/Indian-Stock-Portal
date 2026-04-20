"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  addPortfolioItem,
  fetchWatchlistMetrics,
  fetchPortfolio,
  PortfolioOut,
  removePortfolioItem,
} from "@/lib/api";
import SymbolAutocompleteInput from "@/components/SymbolAutocompleteInput";

type PortfolioMarketMetrics = {
  currentPrice: number | null;
  change1d: number | null;
  rsi: number | null;
  pe: number | null;
};

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioOut[]>([]);
  const [metricsBySymbol, setMetricsBySymbol] = useState<Record<string, PortfolioMarketMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formSymbol, setFormSymbol] = useState("");
  const [formQuantity, setFormQuantity] = useState("1");
  const [formAveragePrice, setFormAveragePrice] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchPortfolio();
      setItems(data);

      const symbols = Array.from(
        new Set(data.map((entry) => entry.symbol.trim().toUpperCase()).filter(Boolean)),
      );

      if (symbols.length === 0) {
        setMetricsBySymbol({});
      } else {
        const metricRows = await fetchWatchlistMetrics(symbols);
        const metricEntries = metricRows.map((row) => [
          row.symbol.trim().toUpperCase(),
          {
            currentPrice: row.current_price ?? null,
            change1d: row.change_1d ?? null,
            rsi: row.rsi ?? null,
            pe: row.pe_ratio ?? null,
          },
        ] as const);
        setMetricsBySymbol(Object.fromEntries(metricEntries));
      }
    } catch (err) {
      console.error(err);
      setMetricsBySymbol({});
      setMessage("Unable to load portfolio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
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
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [load]);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const symbol = formSymbol.trim().toUpperCase();
    const quantity = Number(formQuantity);
    const averagePrice = Number(formAveragePrice);

    if (!symbol) {
      setMessage("Please enter a stock symbol.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Quantity must be greater than 0.");
      return;
    }
    if (!Number.isFinite(averagePrice) || averagePrice <= 0) {
      setMessage("Average price must be greater than 0.");
      return;
    }

    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
    if (!token) {
      setMessage("Please login first to save portfolio holdings.");
      return;
    }

    setSaving(true);
    try {
      await addPortfolioItem({
        symbol,
        quantity,
        average_price: averagePrice,
      });
      setFormSymbol("");
      setFormQuantity("1");
      setFormAveragePrice("");
      setShowForm(false);
      setMessage("Holding saved.");
      await load();
    } catch (err) {
      console.error(err);
      setMessage("Unable to save holding. Please check login and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(symbol: string) {
    setMessage(null);
    setDeletingSymbol(symbol);
    try {
      await removePortfolioItem(symbol);
      setMessage(`${symbol} removed.`);
      await load();
    } catch (err) {
      console.error(err);
      setMessage("Unable to remove holding.");
    } finally {
      setDeletingSymbol(null);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
        <Link href="/" className="text-brand hover:underline underline-offset-4">
          Home
        </Link>
        <span className="text-muted">/</span>
        <span className="text-muted">Portfolio</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">My Portfolio</h1>
          <p className="text-muted font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Real-time tracking of your Indian stock holdings
          </p>
        </div>
        <button
          className="btn-primary py-2 px-6 font-bold text-sm"
          onClick={() => setShowForm((prev) => !prev)}
        >
          {showForm ? "Close" : "+ Add Holding"}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleAdd} className="glass-card relative z-30 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">
              Symbol
            </label>
            <SymbolAutocompleteInput
              value={formSymbol}
              onChange={setFormSymbol}
              className="input-premium w-full"
              placeholder="TCS"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">
              Quantity
            </label>
            <input
              value={formQuantity}
              onChange={(e) => setFormQuantity(e.target.value)}
              className="input-premium w-full"
              placeholder="10"
              type="number"
              min="0.0001"
              step="any"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">
              Avg Price
            </label>
            <input
              value={formAveragePrice}
              onChange={(e) => setFormAveragePrice(e.target.value)}
              className="input-premium w-full"
              placeholder="3500"
              type="number"
              min="0.01"
              step="any"
              required
            />
          </div>
          <button type="submit" className="btn-primary py-3 font-bold" disabled={saving}>
            {saving ? "Saving..." : "Save Holding"}
          </button>
        </form>
      ) : null}

      {message ? <div className="text-sm text-brand">{message}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center p-24">
          <div className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card !py-24 text-center border-dashed border-white/10">
          <div className="text-4xl mb-4 opacity-20">Portfolio</div>
          <h3 className="text-xl font-bold mb-2">Your portfolio is empty</h3>
          <p className="text-sm text-muted mb-6">Start building your wealth by adding your first stock.</p>
          <button className="btn-primary px-8" onClick={() => setShowForm(true)}>
            Create Portfolio
          </button>
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
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">P/E</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">Quantity</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Avg Price</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Invested Value</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-right">Gain/Loss</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item) => {
                  const quantity = Number(item.quantity);
                  const averagePrice = Number(item.average_price);
                  const investedValue = quantity * averagePrice;
                  const metric = metricsBySymbol[item.symbol.trim().toUpperCase()];
                  const currentPrice = metric?.currentPrice;
                  const change1d = metric?.change1d;
                  const rsi = metric?.rsi;
                  const pe = metric?.pe;
                  const currentValue =
                    typeof currentPrice === "number" && Number.isFinite(currentPrice)
                      ? currentPrice * quantity
                      : null;
                  const gainLoss =
                    typeof currentValue === "number" && Number.isFinite(currentValue)
                      ? currentValue - investedValue
                      : null;
                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/stocks/${item.symbol}`} className="flex flex-col">
                          <span className="text-sm font-bold tracking-tight text-white group-hover:text-brand transition-colors">{item.symbol}</span>
                          <span className="text-[10px] font-medium text-muted uppercase tracking-tighter">Equity</span>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black tabular-nums text-white">
                        {typeof currentPrice === "number" && Number.isFinite(currentPrice)
                          ? `Rs ${currentPrice.toFixed(2)}`
                          : "--"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {typeof change1d === "number" && Number.isFinite(change1d) ? (
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-black tabular-nums ${
                              change1d >= 0
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {change1d >= 0 ? "+" : ""}
                            {change1d.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-sm text-muted">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold tabular-nums text-white">
                        {typeof rsi === "number" && Number.isFinite(rsi) ? rsi.toFixed(2) : "--"}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold tabular-nums text-white">
                        {typeof pe === "number" && Number.isFinite(pe) ? pe.toFixed(2) : "--"}
                      </td>
                      <td className="px-6 py-4 text-center text-sm font-bold tabular-nums">
                        {Number.isFinite(quantity) ? quantity : item.quantity}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium tabular-nums text-muted">
                        Rs {Number.isFinite(averagePrice) ? averagePrice.toFixed(2) : item.average_price}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black text-white tabular-nums">
                        Rs {Number.isFinite(investedValue) ? investedValue.toFixed(2) : "0.00"}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black tabular-nums">
                        {typeof gainLoss === "number" && Number.isFinite(gainLoss) ? (
                          <span className={gainLoss >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            Rs {gainLoss.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDelete(item.symbol)}
                          className="text-[10px] font-black uppercase tracking-widest text-rose-400 hover:underline"
                          disabled={deletingSymbol === item.symbol}
                        >
                          {deletingSymbol === item.symbol ? "Deleting..." : "Delete"}
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
