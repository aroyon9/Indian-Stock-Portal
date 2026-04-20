export default function StockLoading() {
  return (
    <div className="space-y-8 pb-12 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="h-10 w-72 rounded-xl bg-white/5" />
          <div className="h-5 w-56 rounded-lg bg-white/5" />
        </div>
        <div className="glass-card h-24 w-full max-w-md bg-white/5 border-white/10" />
      </div>

      <div className="glass-card h-[560px] bg-white/5 border-white/10" />
      <div className="glass-card h-80 bg-white/5 border-white/10" />
    </div>
  );
}
