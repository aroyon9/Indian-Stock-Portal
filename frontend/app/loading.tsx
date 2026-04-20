export default function Loading() {
  return (
    <div className="space-y-8 pb-12 animate-pulse">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="glass-card h-40 bg-white/5 border-white/10" />
        ))}
      </section>

      <section className="glass-card h-96 bg-white/5 border-white/10" />
    </div>
  );
}
