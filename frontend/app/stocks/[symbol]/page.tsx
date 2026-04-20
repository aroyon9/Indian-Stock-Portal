import Link from "next/link";

import { fetchAnalytics, fetchSymbols } from "@/lib/api";
import ChartContainer from "@/components/ChartContainer";

type StockPageProps = {
  params: { symbol: string };
  searchParams?: {
    from?: string;
    index_key?: string;
    rsi_min?: string;
    rsi_max?: string;
    change_min?: string;
    limit?: string;
    breakout_only?: string;
  };
};

export default async function StockPage({ params, searchParams }: StockPageProps) {
  const symbol = decodeURIComponent(params.symbol);
  const normalizedSymbol = symbol.trim().toUpperCase();
  const isIndexSymbol = normalizedSymbol === "NIFTY 50" || normalizedSymbol === "SENSEX";
  const backHref = searchParams?.from === "screener"
    ? `/screener?index_key=${encodeURIComponent(searchParams.index_key ?? "nifty500")}&rsi_min=${encodeURIComponent(searchParams.rsi_min ?? "52")}&rsi_max=${encodeURIComponent(searchParams.rsi_max ?? "78")}&change_min=${encodeURIComponent(searchParams.change_min ?? "1.2")}&limit=${encodeURIComponent(searchParams.limit ?? "25")}&breakout_only=${encodeURIComponent(searchParams.breakout_only ?? "true")}`
    : "/";
  const [analyticsResult, quoteResult] = await Promise.allSettled([
    fetchAnalytics(symbol),
    isIndexSymbol ? Promise.resolve([]) : fetchSymbols({ symbols: symbol, limit: 1 }),
  ]);
  const analytics = analyticsResult.status === "fulfilled" ? analyticsResult.value : { symbol };
  const quote = quoteResult.status === "fulfilled" ? quoteResult.value[0] : undefined;
  const lastPrice = isIndexSymbol
    ? (analytics.current_price ?? quote?.current_price ?? null)
    : (quote?.current_price ?? analytics.current_price ?? null);
  const prevPrice = analytics.previous_close ?? lastPrice;
  const quoteChangePct = isIndexSymbol ? null : (quote?.change_pct ?? null);
  const derivedQuotePrevPrice =
    lastPrice !== null && quoteChangePct !== null && quoteChangePct > -100
      ? lastPrice / (1 + quoteChangePct / 100)
      : null;
  const priceChange =
    quoteChangePct !== null && lastPrice !== null && derivedQuotePrevPrice !== null
      ? lastPrice - derivedQuotePrevPrice
      : (analytics.day_change ?? (lastPrice !== null && prevPrice !== null ? lastPrice - prevPrice : null));
  const priceChangePct =
    quoteChangePct !== null
      ? quoteChangePct
      : (analytics.day_change_pct ?? (priceChange !== null && prevPrice !== null && prevPrice > 0 ? (priceChange / prevPrice) * 100 : null));

  const formatMarketCap = (mc: number | null | undefined) => {
    if (!mc) return "—";
    if (mc >= 1e12) return `${(mc / 1e12).toFixed(2)}LCr`;
    if (mc >= 1e7) return `${(mc / 1e7).toFixed(2)}Cr`;
    return mc.toLocaleString();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href={backHref} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-brand/20 transition-colors group">
              <span className="text-muted group-hover:text-brand transition-colors text-xl">←</span>
            </Link>
            <h1 className="text-4xl font-black tracking-tight">{symbol}</h1>
            <div className="px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-black uppercase tracking-widest">
              NSE: INDIA
            </div>
          </div>
          <p className="text-muted font-medium flex items-center gap-2 ml-14">
            Interactive Institutional Grade Technical Analysis
          </p>
        </div>

        <div className="glass-card !bg-white/5 !py-4 px-8 flex items-center justify-between md:justify-start gap-12 border-none ring-1 ring-white/10 shadow-2xl">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Last Price</div>
            <div className="text-3xl font-black tracking-tighter tabular-nums">
              {lastPrice !== null ? `₹${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Day Change</div>
            {priceChange !== null && priceChangePct !== null ? (
              <div className={`text-xl font-bold tabular-nums flex items-center gap-1 ${priceChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)} ({priceChangePct.toFixed(2)}%)
                <span className="text-lg">{priceChange >= 0 ? "▲" : "▼"}</span>
              </div>
            ) : (
              <div className="text-xl font-bold text-muted">—</div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Chart Container */}
      <ChartContainer symbol={symbol} initialData={[]} />

      {/* Quick Stats (Google Finance Parity) */}
      <section className="mt-8 mb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-y-8 gap-x-4 border-y border-white/10 py-6">
          
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted mb-1">Open</span>
            <span className="text-sm font-bold tabular-nums">{analytics.regular_market_open !== undefined && analytics.regular_market_open !== null ? analytics.regular_market_open.toFixed(2) : "—"}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted mb-1">High</span>
            <span className="text-sm font-bold tabular-nums">{analytics.day_high !== undefined && analytics.day_high !== null ? analytics.day_high.toFixed(2) : "—"}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted mb-1">Low</span>
            <span className="text-sm font-bold tabular-nums">{analytics.day_low !== undefined && analytics.day_low !== null ? analytics.day_low.toFixed(2) : "—"}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted mb-1">Mkt cap</span>
            <span className="text-sm font-bold tabular-nums">{formatMarketCap(analytics.market_cap)}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted mb-1">P/E ratio</span>
            <span className="text-sm font-bold tabular-nums">{analytics.pe_ratio !== undefined && analytics.pe_ratio !== null ? analytics.pe_ratio.toFixed(2) : "—"}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted mb-1">Div yield</span>
            <span className="text-sm font-bold tabular-nums">{analytics.dividend_yield !== undefined && analytics.dividend_yield !== null ? `${analytics.dividend_yield.toFixed(2)}%` : "—"}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted mb-1">52-wk high</span>
            <span className="text-sm font-bold tabular-nums">{analytics.fifty_two_week_high !== undefined && analytics.fifty_two_week_high !== null ? analytics.fifty_two_week_high.toFixed(2) : "—"}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted mb-1">52-wk low</span>
            <span className="text-sm font-bold tabular-nums">{analytics.fifty_two_week_low !== undefined && analytics.fifty_two_week_low !== null ? analytics.fifty_two_week_low.toFixed(2) : "—"}</span>
          </div>

        </div>
      </section>

      {/* Advanced Analytics */}
      <section>
        <h3 className="text-xl font-bold tracking-tight mb-6">Advanced Analytics</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Technical Indicators */}
          <div className="glass-card flex flex-col">
            <h4 className="text-sm font-black uppercase tracking-widest text-muted mb-6">Technical Indicators</h4>
            <div className="space-y-4">
              
              {/* RSI */}
              <div>
                <div className="text-xs text-muted mb-2 font-medium">Relative Strength Index (RSI)</div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "14D", val: analytics.rsi_14 },
                    { label: "30D", val: analytics.rsi_30 },
                    { label: "50D", val: analytics.rsi_50 },
                    { label: "100D", val: analytics.rsi_100 },
                    { label: "200D", val: analytics.rsi_200 },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/5 rounded p-2 text-center border border-white/5">
                      <div className="text-[10px] text-muted mb-1">{item.label}</div>
                      <div className={`text-sm font-bold ${
                        !item.val ? "text-muted" :
                        item.val < 30 ? "text-emerald-400" :
                        item.val > 70 ? "text-rose-400" :
                        "text-white"
                      }`}>
                        {item.val ? item.val.toFixed(1) : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MACD */}
              <div>
                <div className="text-xs text-muted mb-2 font-medium">MACD (12, 26, 9)</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded p-2 text-center border border-white/5">
                    <div className="text-[10px] text-muted mb-1">MACD</div>
                    <div className="text-sm font-bold tabular-nums">{analytics.macd_value !== undefined && analytics.macd_value !== null ? analytics.macd_value.toFixed(2) : "—"}</div>
                  </div>
                  <div className="bg-white/5 rounded p-2 text-center border border-white/5">
                    <div className="text-[10px] text-muted mb-1">SIGNAL</div>
                    <div className="text-sm font-bold tabular-nums">{analytics.macd_signal !== undefined && analytics.macd_signal !== null ? analytics.macd_signal.toFixed(2) : "—"}</div>
                  </div>
                  <div className="bg-white/5 rounded p-2 text-center border border-white/5">
                    <div className="text-[10px] text-muted mb-1">HISTOGRAM</div>
                    <div className={`text-sm font-bold tabular-nums ${
                      analytics.macd_hist === undefined || analytics.macd_hist === null ? "text-muted" :
                      analytics.macd_hist > 0 ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {analytics.macd_hist !== undefined && analytics.macd_hist !== null ? analytics.macd_hist.toFixed(2) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* EMA */}
              <div>
                <div className="text-xs text-muted mb-2 font-medium">Exponential Moving Averages</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "EMA 20", val: analytics.ema_20 },
                    { label: "EMA 50", val: analytics.ema_50 },
                    { label: "EMA 200", val: analytics.ema_200 },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/5 rounded p-2 flex justify-between items-center border border-white/5 px-3">
                      <div className="text-[10px] text-muted">{item.label}</div>
                      <div className="text-sm font-bold tabular-nums">{item.val !== undefined && item.val !== null ? item.val.toFixed(2) : "—"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bollinger Bands */}
              <div>
                <div className="text-xs text-muted mb-2 font-medium">Bollinger Bands (20, 2)</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded p-2">
                    <div className="text-[10px] text-rose-400/80 mb-1">UPPER</div>
                    <div className="text-sm font-bold tabular-nums text-rose-100">{analytics.bb_upper !== undefined && analytics.bb_upper !== null ? analytics.bb_upper.toFixed(2) : "—"}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded p-2">
                    <div className="text-[10px] text-muted mb-1">MIDDLE</div>
                    <div className="text-sm font-bold tabular-nums text-white">{analytics.bb_middle !== undefined && analytics.bb_middle !== null ? analytics.bb_middle.toFixed(2) : "—"}</div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
                    <div className="text-[10px] text-emerald-400/80 mb-1">LOWER</div>
                    <div className="text-sm font-bold tabular-nums text-emerald-100">{analytics.bb_lower !== undefined && analytics.bb_lower !== null ? analytics.bb_lower.toFixed(2) : "—"}</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Fundamentals */}
          <div className="glass-card flex flex-col">
            <h4 className="text-sm font-black uppercase tracking-widest text-muted mb-6">Fundamental Data</h4>
            <div className="grid grid-cols-2 gap-4">
              
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-[10px] items-center text-muted font-black uppercase tracking-widest mb-1">P/E Ratio</div>
                <div className="text-2xl font-bold tabular-nums">{analytics.pe_ratio !== undefined && analytics.pe_ratio !== null ? analytics.pe_ratio.toFixed(2) : "—"}</div>
              </div>
              
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">P/B Ratio</div>
                <div className="text-2xl font-bold tabular-nums">{analytics.pb_ratio !== undefined && analytics.pb_ratio !== null ? analytics.pb_ratio.toFixed(2) : "—"}</div>
              </div>
              
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Return on Equity</div>
                <div className="text-2xl font-bold tabular-nums">{analytics.roe !== undefined && analytics.roe !== null ? `${analytics.roe.toFixed(2)}%` : "—"}</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Debt to Equity</div>
                <div className={`text-2xl font-bold tabular-nums ${analytics.debt_to_equity !== undefined && analytics.debt_to_equity !== null && analytics.debt_to_equity > 1 ? "text-rose-400" : "text-emerald-400"}`}>
                   {analytics.debt_to_equity !== undefined && analytics.debt_to_equity !== null ? analytics.debt_to_equity.toFixed(2) : "—"}
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Revenue Growth (YoY)</div>
                <div className={`text-2xl font-bold tabular-nums ${analytics.revenue_growth_yoy === undefined || analytics.revenue_growth_yoy === null ? "" : analytics.revenue_growth_yoy > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                   {analytics.revenue_growth_yoy !== undefined && analytics.revenue_growth_yoy !== null ? `${analytics.revenue_growth_yoy > 0 ? "+" : ""}${analytics.revenue_growth_yoy.toFixed(2)}%` : "—"}
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">EPS Growth</div>
                <div className={`text-2xl font-bold tabular-nums ${analytics.eps_growth === undefined || analytics.eps_growth === null ? "" : analytics.eps_growth > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                   {analytics.eps_growth !== undefined && analytics.eps_growth !== null ? `${analytics.eps_growth > 0 ? "+" : ""}${analytics.eps_growth.toFixed(2)}%` : "—"}
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">Promoter Holding</div>
                <div className="text-2xl font-bold tabular-nums">{analytics.promoter_holding !== undefined && analytics.promoter_holding !== null ? `${analytics.promoter_holding.toFixed(2)}%` : "—"}</div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
                <div className="text-[10px] text-muted font-black uppercase tracking-widest mb-1">FII / DII Holding</div>
                <div className="text-2xl font-bold tabular-nums">{analytics.fii_dii_holding !== undefined && analytics.fii_dii_holding !== null ? `${analytics.fii_dii_holding.toFixed(2)}%` : "—"}</div>
              </div>

            </div>
          </div>
          
        </div>
      </section>
    </div>
  );
}
