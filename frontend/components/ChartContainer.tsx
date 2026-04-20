"use client";

import { useState, useEffect } from "react";
import { fetchOhlcv, OhlcvOut } from "@/lib/api";
import StockChart from "./StockChart";

interface ChartContainerProps {
  symbol: string;
  initialData: OhlcvOut[];
}

export default function ChartContainer({ symbol, initialData }: ChartContainerProps) {
  const [data, setData] = useState<OhlcvOut[]>(initialData);
  const [timeframe, setTimeframe] = useState("1M");
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        let params: { limit?: number; start?: string } = { limit: 260 };
        const now = new Date();
        
        if (timeframe === "1D") {
          params.limit = 80; // enough points for intraday-like view (still daily data in API)
        } else if (timeframe === "5D") {
          const start = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
          params.start = start.toISOString();
          params.limit = 40;
        } else if (timeframe === "1M") {
          const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          params.start = start.toISOString();
          params.limit = 80;
        } else if (timeframe === "6M") {
          const start = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          params.start = start.toISOString();
          params.limit = 300;
        } else if (timeframe === "YTD") {
          const start = new Date(now.getFullYear(), 0, 1);
          params.start = start.toISOString();
          params.limit = 400;
        } else if (timeframe === "1Y") {
          const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          params.start = start.toISOString();
          params.limit = 600;
        } else if (timeframe === "5Y") {
          const start = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
          params.start = start.toISOString();
          // must be > 250 so backend (mock/yfinance) requests multi-year data
          params.limit = 2000;
        } else if (timeframe === "MAX") {
          params.limit = 5000;
        }

        const newData = await fetchOhlcv(symbol, params);
        if (newData.length > 0) {
          setData(newData);
        } else if (initialData.length === 0) {
          setData([]);
        }
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (timeframe !== "INIT") {
       loadData();
    }
  }, [initialData.length, symbol, timeframe]);

  return (
    <div className="glass-card !p-2 bg-black/40 border-white/5 shadow-inner">
      <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Range</span>
            <div className="flex bg-white/5 p-1 rounded-lg gap-1">
              {["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"].map((i) => (
                <button
                  key={i}
                  onClick={() => setTimeframe(i)}
                  className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${
                    timeframe === i ? "bg-brand text-bg shadow-lg shadow-brand/20" : "text-muted hover:text-white"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block"></div>

          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black text-muted uppercase tracking-widest">Style</span>
             <div className="flex bg-white/5 p-1 rounded-lg gap-1">
                {(['candlestick', 'line'] as const).map(t => (
                  <button 
                    key={t}
                    onClick={() => setChartType(t)}
                    className={`px-3 py-1 text-[10px] font-bold rounded capitalize transition-all ${
                       chartType === t ? 'bg-brand text-bg shadow-lg shadow-brand/20' : 'text-muted hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
             </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary !py-1.5 !px-4 text-[10px] font-bold">+ Comparative</button>
          <button className="btn-primary !py-1.5 !px-4 text-[10px] font-bold">Indicators</button>
        </div>
      </div>

      <div className="p-2 relative min-h-[450px]">
        {loading && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-xl">
            <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
          </div>
        )}
        <StockChart data={data} type={chartType} />
      </div>
    </div>
  );
}
