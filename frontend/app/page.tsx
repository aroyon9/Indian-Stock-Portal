import Link from "next/link";

import { fetchIndices, fetchSymbols, type IndexOut } from "@/lib/api";
import MarketIndices from "@/components/MarketIndices";
import MarketSentiment from "@/components/MarketSentiment";
import FeaturedStocks from "@/components/FeaturedStocks";

const HOME_FEATURED_SYMBOLS = [
  "RELIANCE",
  "TCS",
  "HDFCBANK",
  "INFY",
  "ICICIBANK",
  "SBIN",
  "ITC",
  "LT",
] as const;

export default async function HomePage() {
  const [symbols, indicesBase] = await Promise.all([
    fetchSymbols({
      limit: HOME_FEATURED_SYMBOLS.length,
      symbols: HOME_FEATURED_SYMBOLS.join(","),
    }),
    fetchIndices(),
  ]);

  const bySymbol = new Map<string, IndexOut>();
  for (const q of indicesBase) bySymbol.set(q.symbol, q);
  const indices = Array.from(bySymbol.values());

  return (
    <div className="space-y-8 pb-12 relative overflow-hidden">
      {/* Hero / Hero Stats Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MarketIndices initial={indices} />

        <Link href="/sectors" className="glass-card flex flex-col justify-between group transition-all duration-300 hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Diversity</span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
               <div className="w-3 h-3 border-2 border-current rounded-sm"></div>
            </div>
          </div>
          <div>
            <div className="text-3xl font-black tracking-tight mb-1 group-hover:text-emerald-400 transition-colors">Sector Analysis</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-emerald-500">12</span>
              <span className="text-sm font-medium text-muted">Industry Segments</span>
            </div>
          </div>
        </Link>

        <div className="glass-card flex flex-col justify-between bg-gradient-to-br from-brand/10 to-transparent border-brand/20">
          <div className="mb-4">
             <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-brand/10 text-[10px] font-bold text-brand uppercase tracking-tighter">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
               </span>
               Live Market
             </div>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted font-medium leading-relaxed">
              Find breakout opportunities with our advanced technical filters.
            </p>
            <Link href="/screener" className="btn-primary w-full inline-flex items-center justify-center gap-2 font-bold group">
              Open Screener
              <span className="group-hover:translate-x-1 transition-transform">&gt;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Discovery Section */}
      <section>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold tracking-tight">Market Discover</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand/10 text-brand uppercase border border-brand/20">Active</span>
            </div>
            <p className="text-sm text-muted">Explore trending symbols and institutional-grade analytics.</p>
          </div>
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <MarketSentiment indices={indices} />
            <button className="hidden xl:inline-flex text-xs font-bold uppercase tracking-widest text-brand hover:underline decoration-2 underline-offset-4 transition-all whitespace-nowrap">
              View All
            </button>
          </div>
        </div>

        <FeaturedStocks initial={symbols} symbols={HOME_FEATURED_SYMBOLS} />
      </section>
    </div>
  );
}
