import Link from "next/link";
import SectorAnalysisClient from "@/components/SectorAnalysisClient";

export const metadata = {
  title: "Sector Analysis | Indian Stock Market Portal",
  description: "Browse 12 Indian stock market sectors and discover top growth stocks.",
};

export default function SectorsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col mb-8">
        <div className="flex items-center gap-3 text-sm text-brand font-bold uppercase tracking-widest mb-4">
          <Link href="/" className="hover:text-emerald-400 transition-colors">Home</Link>
          <span className="text-muted/50">/</span>
          <span>Sectors</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">Sector Analysis</h1>
        <p className="text-muted text-lg max-w-2xl">
          Explore top growth stocks across the 12 major segments of the Indian Stock Market. Click on any sector to view its constituent companies.
        </p>
      </div>

      <SectorAnalysisClient />
    </div>
  );
}
