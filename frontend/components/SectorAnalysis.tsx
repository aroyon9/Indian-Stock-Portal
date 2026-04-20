"use client";

import { useState } from "react";
import Link from "next/link";

const SECTORS = [
  {
    name: "Information Technology",
    icon: "💻",
    description: "Software, IT Services, and Consulting.",
    stocks: ["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM", "PERSISTENT", "MPHASIS", "COFORGE", "LTTS"],
  },
  {
    name: "Financial Services",
    icon: "🏦",
    description: "Banks, NBFCs, Insurance, and Asset Management.",
    stocks: ["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "INDUSINDBK", "BAJFINANCE", "BAJAJFINSV", "HDFCLIFE", "SBILIFE"],
  },
  {
    name: "FMCG",
    icon: "🛒",
    description: "Fast Moving Consumer Goods like food and personal care.",
    stocks: ["ITC", "HUL", "NESTLEIND", "BRITANNIA", "TATACONSUM", "DABUR", "GODREJCP", "MARICO", "COLPAL", "VBL"],
  },
  {
    name: "Healthcare & Pharma",
    icon: "⚕️",
    description: "Pharmaceuticals, Hospitals, and Healthcare services.",
    stocks: ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP", "LUPIN", "AUROPHARMA", "TORNTPHARM", "ALKEM", "BIOCON"],
  },
  {
    name: "Auto & Auto Components",
    icon: "🚗",
    description: "2-wheelers, 4-wheelers, and commercial vehicles.",
    stocks: ["MARUTI", "M&M", "TATAMOTORS", "BAJAJ-AUTO", "EICHERMOT", "HEROMOTOCO", "TVSMOTOR", "ASHOKLEY", "BOSCHLTD", "MOTHERSON"],
  },
  {
    name: "Oil, Gas & Fuels",
    icon: "🛢️",
    description: "Exploration, refining, and distribution of energy.",
    stocks: ["RELIANCE", "ONGC", "BPCL", "IOC", "COALINDIA", "GAIL", "HINDPETRO", "PETRONET", "ATGL", "GUJGASLTD"],
  },
  {
    name: "Metals & Mining",
    icon: "⛏️",
    description: "Steel, Aluminium, and basic metal production.",
    stocks: ["TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "SAIL", "JINDALSTEL", "NMDC", "HINDZINC", "NATIONALUM", "MOIL"],
  },
  {
    name: "Consumer Durables",
    icon: "📺",
    description: "Electronics, appliances, and durable consumer goods.",
    stocks: ["TITAN", "HAVELLS", "VOLTAS", "DIXON", "BLUESTARCO", "CROMPTON", "WHIRLPOOL", "VGUARD", "TTKPRESTIG", "BATAINDIA"],
  },
  {
    name: "Telecommunication",
    icon: "📡",
    description: "Telecom operators and infrastructure providers.",
    stocks: ["BHARTIARTL", "INDUSTOWER", "IDEA", "TATACOMM", "HFCL", "TEJASNET", "RAILTEL", "STLTECH", "ONMOBILE", "MTNL"],
  },
  {
    name: "Power",
    icon: "⚡",
    description: "Power generation and transmission companies.",
    stocks: ["NTPC", "POWERGRID", "TATAPOWER", "ADANIGREEN", "ADANIPOWER", "TORNTPOWER", "NHPC", "SJVN", "JSWENERGY", "NLCINDIA"],
  },
  {
    name: "Construction",
    icon: "🏗️",
    description: "Infrastructure development and engineering.",
    stocks: ["LT", "GRASIM", "ULTRACEMCO", "AMBUJACEM", "ACC", "SHREECEM", "DALBHARAT", "JKCEMENT", "NCC", "KEC"],
  },
  {
    name: "Capital Goods & Defence",
    icon: "🚀",
    description: "Heavy machinery and defence manufacturing.",
    stocks: ["HAL", "BEL", "SIEMENS", "ABB", "BHEL", "MAZDOCK", "COCHINSHIP", "BEML", "BDL", "GRSE"],
  },
];

export default function SectorAnalysis() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSector, setActiveSector] = useState<string | null>(null);

  return (
    <div 
      className={`glass-card flex flex-col group transition-all duration-500 hover:border-emerald-500/40 relative z-10 ${
        isExpanded ? "md:absolute md:w-[400px] md:top-auto md:shadow-2xl md:shadow-emerald-500/20 max-h-[600px] bg-bg/95 backdrop-blur-xl border-emerald-500/50" : "cursor-pointer h-full"
      }`}
      onClick={() => {
        if (!isExpanded) setIsExpanded(true);
      }}
    >
      {/* Header section identical to original design */}
      <div className={`p-6 flex flex-col justify-between shrink-0 ${!isExpanded ? 'h-full' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Diversity</span>
          <div className="flex items-center gap-2">
            {isExpanded && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                title="Close"
              >
                ✕
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
               <div className="w-3 h-3 border-2 border-current rounded-sm"></div>
            </div>
          </div>
        </div>
        <div>
          <div className="text-3xl font-black tracking-tight mb-1">Sector Analysis</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-emerald-500">{SECTORS.length}</span>
            <span className="text-sm font-medium text-muted">Industry Segments</span>
          </div>
        </div>
      </div>

      {/* Expanded list */}
      <div className={`overflow-y-auto px-6 pb-6 space-y-2 custom-scrollbar transition-all duration-500 ${isExpanded ? 'opacity-100 max-h-[450px]' : 'opacity-0 max-h-0 hidden'}`}>
        <div className="h-px w-full bg-border/50 mb-4" />
        {SECTORS.map((sector) => {
          const isActive = activeSector === sector.name;
          return (
            <div key={sector.name} className="border border-border/40 rounded-lg overflow-hidden bg-white/5 transition-colors hover:bg-white/10">
              <button 
                className="w-full text-left p-3 flex items-center justify-between"
                onClick={(e) => { e.stopPropagation(); setActiveSector(isActive ? null : sector.name); }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{sector.icon}</span>
                  <span className="font-semibold text-sm">{sector.name}</span>
                </div>
                <span className="text-xs text-muted font-bold px-1">{isActive ? '−' : '+'}</span>
              </button>
              
              {isActive && (
                <div className="p-3 pt-0 border-t border-border/30 bg-black/20" onClick={(e) => e.stopPropagation()}>
                  <p className="text-[10px] text-muted mb-2">{sector.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sector.stocks.map(symbol => (
                      <Link 
                        key={symbol} 
                        href={`/stocks/${encodeURIComponent(symbol)}`}
                        className="text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 font-bold tracking-wider rounded hover:bg-emerald-500/20 transition-colors"
                      >
                        {symbol}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
