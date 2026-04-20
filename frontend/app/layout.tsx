import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import StockSearch from "@/components/StockSearch";
import TickerTape from "@/components/TickerTape";
import NavAuthControls from "@/components/NavAuthControls";

export const metadata = {
  title: "Indian Stock Market Portal",
  description: "Starter portal with FastAPI + TimescaleDB"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="sticky top-0 z-50 mb-8">
            <div className="space-y-3">
              <nav className="glass-card flex items-center justify-between py-4 relative z-[60]">
              <div className="flex items-center gap-4 min-w-0">
                <Link href="/" className="flex items-center gap-2 group transition-all duration-300 transform hover:scale-105 shrink-0">
                  <div className="min-w-[2rem] px-1 h-8 bg-brand rounded-lg flex items-center justify-center shadow-lg shadow-brand/20 group-hover:rotate-12 transition-transform">
                    <span className="text-bg text-sm font-bold">ISP</span>
                  </div>
                  <div>
                    <span className="text-xl font-bold tracking-tight text-brand">Indian Stock Market Portal</span>
                    <p className="text-[10px] text-muted font-medium uppercase tracking-widest leading-none mt-1">Market Intelligence</p>
                  </div>
                </Link>

                <div className="hidden lg:block w-[360px] max-w-[40vw]">
                  <StockSearch />
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-8">
                <div className="flex items-center gap-6">
                  {["Screener", "Portfolio", "Watchlist"].map((item) => (
                    <Link 
                      key={item} 
                      href={`/${item.toLowerCase()}`}
                      className="text-sm font-medium text-muted hover:text-brand transition-colors relative group py-2"
                    >
                      {item}
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand transition-all duration-300 group-hover:w-full"></span>
                    </Link>
                  ))}
                </div>
                
                <div className="h-4 w-px bg-border mx-2"></div>
                
                <NavAuthControls />
              </div>
              </nav>

              <div className="hidden md:block">
                <TickerTape limit={50} />
              </div>
            </div>
          </header>
          
          <main className="animate-in fade-in duration-700">
            {children}
          </main>
          
          <footer className="mt-20 py-10 border-t border-border/50 text-center">
            <p className="text-sm text-muted">Copyright 2026 Indian Stock Market Portal. Powered by FastAPI & Next.js.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}

