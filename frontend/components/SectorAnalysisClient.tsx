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

export default function SectorAnalysisClient() {
  const [activeSector, setActiveSector] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {SECTORS.map((sector) => {
        const isActive = activeSector === sector.name;
        return (
          <div 
            key={sector.name} 
            className={`glass-card group flex flex-col transition-all duration-300 relative overflow-hidden cursor-pointer hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10 ${isActive ? 'border-brand shadow-lg shadow-brand/10' : ''}`}
            onClick={() => setActiveSector(isActive ? null : sector.name)}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{sector.icon}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-brand text-bg' : 'bg-white/5 text-muted group-hover:bg-brand/15 group-hover:text-brand'}`}>
                  <span className={isActive ? "hidden" : "inline group-hover:hidden"}>+</span>
                  <span className={isActive ? "inline" : "hidden group-hover:inline"}>-</span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">{sector.name}</h3>
              <p className="text-sm text-muted">{sector.description}</p>
            </div>
            
            <div className={`transition-all duration-500 ease-in-out px-6 ${isActive ? 'max-h-[340px] opacity-100 pb-6' : 'max-h-0 opacity-0 pb-0 group-hover:max-h-[340px] group-hover:opacity-100 group-hover:pb-6'}`}>
              <div className="w-full h-px bg-border/50 mb-4"></div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand mb-3">Top Sector Stocks</div>
              <div className="flex flex-wrap gap-2">
                {sector.stocks.map(symbol => (
                  <Link 
                    key={symbol} 
                    href={`/stocks/${encodeURIComponent(symbol)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand text-xs font-bold rounded hover:bg-brand/20 transition-colors"
                  >
                    {symbol}
                    <span className="text-[10px] opacity-60">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
