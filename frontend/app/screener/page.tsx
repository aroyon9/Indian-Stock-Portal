import Link from "next/link";
import ScreenerTable from "@/components/ScreenerTable";

type ScreenerPageProps = {
  searchParams?: {
    index_key?: string;
    rsi_min?: string;
    rsi_max?: string;
    change_min?: string;
    limit?: string;
    breakout_only?: string;
  };
};

export default function ScreenerPage({ searchParams }: ScreenerPageProps) {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-sm text-brand font-bold uppercase tracking-widest mb-4">
            <Link href="/" className="hover:text-emerald-400 transition-colors">Home</Link>
            <span className="text-muted/50">/</span>
            <span>Screener</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Stock Screener</h1>
          <p className="text-muted font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand animate-pulse"></span>
            Advanced technical & fundamental filters for Indian markets
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
          <span className="text-brand">Strategy:</span> Breakout Momentum
        </div>
      </div>
      
      <div className="animate-in slide-in-from-bottom duration-700">
        <ScreenerTable
          initialIndexKey={searchParams?.index_key ?? "nifty500"}
          initialRsiMin={searchParams?.rsi_min ?? "52"}
          initialRsiMax={searchParams?.rsi_max ?? "78"}
          initialChangeMin={searchParams?.change_min ?? "1.2"}
          initialMaxResults={searchParams?.limit ?? "25"}
          initialBreakoutOnly={searchParams?.breakout_only !== "false"}
          autoFetchOnMount
        />
      </div>
    </div>
  );
}
