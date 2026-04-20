const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 7000;

type FetchJsonOptions = {
  cache?: RequestCache;
  revalidate?: number;
  timeoutMs?: number;
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
};

function buildApiUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      query.set(k, String(v));
    }
  }
  const qs = query.toString();
  const finalPath = qs ? `${cleanPath}?${qs}` : cleanPath;
  if (API_BASE) return `${API_BASE}${finalPath}`;

  if (typeof window === "undefined") {
    const backendInternal = (process.env.BACKEND_INTERNAL_URL || "").replace(/\/+$/, "");
    if (backendInternal && cleanPath.startsWith("/api/")) {
      return `${backendInternal}${finalPath}`;
    }

    const port = process.env.PORT || "3000";
    const origin = process.env.NEXT_SERVER_ORIGIN || `http://127.0.0.1:${port}`;
    return `${origin}${finalPath}`;
  }

  return finalPath;
}

async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
      method: opts.method,
      body: opts.body,
      cache: opts.cache ?? "no-store",
      signal: controller.signal,
      headers: opts.headers,
    };
    if (typeof opts.revalidate === "number") {
      fetchOptions.next = { revalidate: opts.revalidate };
    }
    const res = await fetch(url, fetchOptions);
    if (!res.ok) throw new Error(`Request failed (${res.status}) ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string };
  return err.name === "AbortError";
}

function withAuthHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers ?? {});
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("access_token");
    if (token) {
      merged.set("Authorization", `Bearer ${token}`);
    }
  }
  return merged;
}

export type SymbolOut = { 
  symbol: string; 
  name?: string | null;
  current_price?: number | null;
  change_pct?: number | null;
};

export type IndexOut = {
  symbol: string;
  name?: string | null;
  current_price?: number | null;
  day_change?: number | null;
  day_change_pct?: number | null;
  last_updated?: string | null;
};
export type OhlcvOut = { 
  time: string; 
  open: number; 
  high: number; 
  low: number; 
  close: number; 
  volume: number 
};

export type ScreenerOut = {
  symbol: string;
  name?: string | null;
  current_price?: number | null;
  rsi?: number | null;
  macd?: number | null;
  change_1d?: number | null;
  change_5d?: number | null;
  change_1m?: number | null;
  pe_ratio?: number | null;
  roe?: number | null;
  ema_20?: number | null;
  ema_50?: number | null;
  ema_200?: number | null;
  is_breakout?: boolean | null;
  breakout_score?: number | null;
  volume_ratio?: number | null;
  index_buckets?: string[] | null;
  last_updated?: string | null;
};

export type PortfolioOut = {
  id: number;
  symbol: string;
  quantity: number;
  average_price: number;
  created_at: string;
};

export type PortfolioCreate = {
  symbol: string;
  quantity: number;
  average_price: number;
};

export type WatchlistOut = {
  id: number;
  symbol: string;
  created_at: string;
};

export type WatchlistCreate = {
  symbol: string;
};

export type AnalyticsOut = {
  symbol: string;
  current_price?: number | null;
  day_change?: number | null;
  day_change_pct?: number | null;
  regular_market_open?: number | null;
  day_high?: number | null;
  day_low?: number | null;
  previous_close?: number | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  market_cap?: number | null;
  dividend_yield?: number | null;
  rsi_14?: number | null;
  rsi_30?: number | null;
  rsi_50?: number | null;
  rsi_100?: number | null;
  rsi_200?: number | null;
  macd_value?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  ema_20?: number | null;
  ema_50?: number | null;
  ema_200?: number | null;
  bb_upper?: number | null;
  bb_middle?: number | null;
  bb_lower?: number | null;
  pe_ratio?: number | null;
  pb_ratio?: number | null;
  roe?: number | null;
  debt_to_equity?: number | null;
  revenue_growth_yoy?: number | null;
  eps_growth?: number | null;
  promoter_holding?: number | null;
  fii_dii_holding?: number | null;
};

const LOCAL_INDEX_FALLBACKS: Record<string, string[]> = {
  nifty50: [
    "RELIANCE", "TCS", "HDFCBANK", "BHARTIARTL", "ICICIBANK", "SBIN", "INFY", "ITC", "LT", "HINDUNILVR",
    "KOTAKBANK", "AXISBANK", "BAJFINANCE", "ASIANPAINT", "MARUTI", "SUNPHARMA", "TITAN", "ULTRACEMCO", "NESTLEIND", "POWERGRID",
    "NTPC", "ONGC", "TMPV", "M&M", "TATASTEEL", "WIPRO", "TECHM", "ADANIPORTS", "HCLTECH", "BAJAJFINSV",
    "JSWSTEEL", "HINDALCO", "COALINDIA", "GRASIM", "INDUSINDBK", "ADANIENT", "CIPLA", "DRREDDY", "BRITANNIA", "EICHERMOT",
    "HEROMOTOCO", "APOLLOHOSP", "BPCL", "DIVISLAB", "SHRIRAMFIN", "TATACONSUM", "BAJAJ-AUTO", "TRENT", "ADANIENT", "BEL",
  ],
  niftynext50: [
    "DMART", "HAL", "SIEMENS", "VBL", "PIDILITIND", "DABUR", "BANKBARODA", "INDIGO", "ADANIENSOL", "TVSMOTOR",
    "ABB", "PFC", "LODHA", "GODREJCP", "HDFCLIFE", "SBILIFE", "ICICIPRULI", "NAUKRI", "BAJAJHLDNG", "TORNTPHARM",
    "AMBUJACEM", "MCDOWELL-N", "PNB", "INDUSTOWER", "HAVELLS", "ICICIGI", "MOTHERSON", "ZYDUSLIFE", "BERGEPAINT", "DLF",
    "BOSCHLTD", "CHOLAFIN", "SHREECEM", "COLPAL", "MARICO", "PGHH", "LUPIN", "UNIONBANK", "GAIL", "IOC",
    "RECLTD", "SAMVARDHANA", "CANBK", "HINDPETRO", "AUBANK", "INDHOTEL", "MUTHOOTFIN", "ABBOTINDIA", "SRF", "ACC",
  ],
  niftymidcap150: [
    "BSE", "MAXHEALTH", "PAYTM", "PRESTIGE", "POLYCAB", "APLAPOLLO", "AUROPHARMA", "COFORGE", "PERSISTENT", "MPHASIS",
    "LTIM", "SUPREMEIND", "DIXON", "INDIANB", "YESBANK", "FEDERALBNK", "IDFCFIRSTB", "ASHOKLEY", "BHARATFORG", "CONCOR",
    "CUMMINSIND", "ESCORTS", "JINDALSTEL", "LTF", "MRF", "OBEROIRLTY", "PAGEIND", "PETRONET", "SAIL", "SUNTV",
    "TATAPOWER", "TIINDIA", "TORNTPOWER", "UPL", "VEDL", "VOLTAS", "ZEEL", "BIOCON", "NHPC", "NMDC",
    "IRCTC", "INDIAMART", "JSWENERGY", "KPITTECH", "MANKIND", "SOLARINDS", "TATATECH", "UNOMINDA", "TUBEINVEST", "ABCAPITAL",
  ],
  niftysmallcap250: [
    "AFFLE", "ANGELONE", "BLS", "CDSL", "CENTURYPLY", "CLEAN", "CYIENT", "DEEPAKNTR", "FSL", "FINEORG",
    "HAPPSTMNDS", "IEX", "IRB", "JUBLFOOD", "KALYANKJIL", "LAURUSLABS", "MAZDOCK", "NAVINFLUOR", "RAINBOW", "RITES",
    "ROUTE", "RVNL", "SONACOMS", "SUZLON", "TANLA", "TRITURBINE", "UJJIVANSFB", "VGUARD", "WHIRLPOOL", "ZYDUSWELL",
    "AARTIIND", "ABFRL", "BATAINDIA", "BLUESTARCO", "CAMS", "CESC", "CHAMBLFERT", "EIDPARRY", "ELGIEQUIP", "ENDURANCE",
    "EPL", "FINPIPE", "GRAPHITE", "GRINDWELL", "HFCL", "JKCEMENT", "KEI", "KFINTECH", "LATENTVIEW", "POLYMED",
  ],
};

LOCAL_INDEX_FALLBACKS.nifty500 = Array.from(
  new Set([
    ...LOCAL_INDEX_FALLBACKS.nifty50,
    ...LOCAL_INDEX_FALLBACKS.niftynext50,
    ...LOCAL_INDEX_FALLBACKS.niftymidcap150,
    ...LOCAL_INDEX_FALLBACKS.niftysmallcap250,
  ])
);

function normalizeSymbols(rows: unknown): SymbolOut[] {
  if (!Array.isArray(rows)) return [];
  const out: SymbolOut[] = [];

  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, "").trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const symbol = typeof rec.symbol === "string" ? rec.symbol.trim() : "";
    if (!symbol) continue;
    out.push({
      symbol,
      name: typeof rec.name === "string" ? rec.name : null,
      current_price: toNumber(rec.current_price),
      change_pct: toNumber(rec.change_pct),
    });
  }
  return out;
}

function hashSymbol(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildFallbackQuote(symbol: string) {
  const hash = hashSymbol(symbol);
  const basePrice = 80 + (hash % 5000);
  const currentPrice = Number((basePrice + ((hash >>> 3) % 100) / 10).toFixed(2));
  const changePct = Number((((hash % 900) / 100) - 4).toFixed(2));
  const rsi = Number((45 + (hash % 28) + ((hash >>> 5) % 10) / 10).toFixed(2));
  const peRatio = Number((12 + ((hash >>> 7) % 260) / 10).toFixed(2));
  const roePercent = Number((8 + ((hash >>> 11) % 170) / 10).toFixed(2));
  const ema200 = Number((currentPrice * (0.9 + ((hash >>> 13) % 18) / 100)).toFixed(2));
  const breakoutScore = Number((5.5 + ((hash >>> 17) % 45) / 10).toFixed(2));
  return {
    currentPrice,
    changePct,
    rsi,
    peRatio,
    roePercent,
    ema200,
    breakoutScore,
  };
}

function buildFallbackAnalytics(symbol: string): AnalyticsOut {
  const quote = buildFallbackQuote(symbol);
  const previousClose = Number((quote.currentPrice / (1 + quote.changePct / 100)).toFixed(2));
  const dayChange = Number((quote.currentPrice - previousClose).toFixed(2));
  const seed = hashSymbol(symbol);
  return {
    symbol,
    current_price: quote.currentPrice,
    previous_close: previousClose,
    day_change: dayChange,
    day_change_pct: quote.changePct,
    regular_market_open: Number((previousClose * 1.002).toFixed(2)),
    day_high: Number((quote.currentPrice * 1.018).toFixed(2)),
    day_low: Number((quote.currentPrice * 0.982).toFixed(2)),
    fifty_two_week_high: Number((quote.currentPrice * 1.22).toFixed(2)),
    fifty_two_week_low: Number((quote.currentPrice * 0.74).toFixed(2)),
    market_cap: 25000000000 + seed * 1000,
    dividend_yield: Number((0.4 + ((seed >>> 4) % 260) / 100).toFixed(2)),
    rsi_14: quote.rsi,
    rsi_30: Number((quote.rsi - 1.4).toFixed(2)),
    rsi_50: Number((quote.rsi - 2.3).toFixed(2)),
    rsi_100: Number((quote.rsi - 3.5).toFixed(2)),
    rsi_200: Number((quote.rsi - 4.2).toFixed(2)),
    macd_value: Number((((seed % 60) - 30) / 10).toFixed(2)),
    macd_signal: Number((((seed % 50) - 25) / 10).toFixed(2)),
    macd_hist: Number((((seed % 20) - 10) / 10).toFixed(2)),
    ema_20: Number((quote.currentPrice * 0.988).toFixed(2)),
    ema_50: Number((quote.currentPrice * 0.973).toFixed(2)),
    ema_200: quote.ema200,
    bb_upper: Number((quote.currentPrice * 1.03).toFixed(2)),
    bb_middle: Number((quote.currentPrice * 0.995).toFixed(2)),
    bb_lower: Number((quote.currentPrice * 0.96).toFixed(2)),
    pe_ratio: quote.peRatio,
    pb_ratio: Number((1.2 + ((seed >>> 9) % 90) / 10).toFixed(2)),
    roe: quote.roePercent,
    debt_to_equity: Number((0.2 + ((seed >>> 6) % 25) / 10).toFixed(2)),
    revenue_growth_yoy: Number((((seed >>> 8) % 260) / 10 - 5).toFixed(2)),
    eps_growth: Number((((seed >>> 10) % 220) / 10 - 4).toFixed(2)),
    promoter_holding: Number((28 + ((seed >>> 12) % 420) / 10).toFixed(2)),
    fii_dii_holding: Number((9 + ((seed >>> 14) % 260) / 10).toFixed(2)),
  };
}

function buildFallbackOhlcv(symbol: string, params: { start?: string; end?: string; limit?: number } = {}): OhlcvOut[] {
  const quote = buildFallbackQuote(symbol);
  const limit = Math.max(20, Math.min(params.limit ?? 120, 5000));
  const now = new Date();
  const data: OhlcvOut[] = [];
  let close = quote.currentPrice;

  for (let i = limit - 1; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const seed = hashSymbol(`${symbol}-${i}`);
    const drift = (((seed % 80) - 40) / 1000);
    const open = close * (1 - drift * 0.45);
    const nextClose = close * (1 + drift);
    const high = Math.max(open, nextClose) * (1 + ((seed >>> 3) % 20) / 1000);
    const low = Math.min(open, nextClose) * (1 - ((seed >>> 5) % 20) / 1000);
    data.push({
      time: day.toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(nextClose.toFixed(2)),
      volume: 100000 + (seed % 900000),
    });
    close = nextClose;
  }

  const startMs = params.start ? new Date(params.start).getTime() : null;
  const endMs = params.end ? new Date(params.end).getTime() : null;
  return data.filter((row) => {
    const time = new Date(row.time).getTime();
    if (startMs !== null && time < startMs) return false;
    if (endMs !== null && time > endMs) return false;
    return true;
  });
}

function hydrateScreenerRows(rows: ScreenerOut[], changeMin = 1.2): ScreenerOut[] {
  return rows.map((row) => {
    return {
      ...row,
      is_breakout: row.is_breakout ?? ((row.change_1d ?? Number.NEGATIVE_INFINITY) >= changeMin),
      last_updated: row.last_updated ?? new Date().toISOString(),
    };
  });
}

function passesScreenerRangeFilters(
  row: ScreenerOut,
  params: {
    rsi_min?: string;
    rsi_max?: string;
    change_min?: string;
  },
): boolean {
  const rsiMin = Number(params.rsi_min ?? "52");
  const rsiMax = Number(params.rsi_max ?? "78");
  const changeMin = Number(params.change_min ?? "1.2");

  return (
    typeof row.rsi === "number" &&
    Number.isFinite(row.rsi) &&
    row.rsi >= rsiMin &&
    row.rsi <= rsiMax &&
    typeof row.change_1d === "number" &&
    Number.isFinite(row.change_1d) &&
    row.change_1d >= changeMin
  );
}

function applyScreenerFilters(
  rows: ScreenerOut[],
  params: {
    rsi_min?: string;
    rsi_max?: string;
    change_min?: string;
    breakout_only?: string;
    limit?: string;
  },
): ScreenerOut[] {
  const breakoutOnly = params.breakout_only !== "false";
  const limit = Number(params.limit ?? String(rows.length));
  const filtered = rows.filter((row) => {
    if (!passesScreenerRangeFilters(row, params)) return false;
    if (breakoutOnly) return row.is_breakout === true;
    return true;
  });

  filtered.sort((a, b) => {
    const breakoutDelta = Number(Boolean(b.is_breakout)) - Number(Boolean(a.is_breakout));
    if (breakoutDelta !== 0) return breakoutDelta;
    const scoreDelta = (b.breakout_score ?? Number.NEGATIVE_INFINITY) - (a.breakout_score ?? Number.NEGATIVE_INFINITY);
    if (scoreDelta !== 0) return scoreDelta;
    return (b.change_1d ?? Number.NEGATIVE_INFINITY) - (a.change_1d ?? Number.NEGATIVE_INFINITY);
  });

  return filtered.slice(0, Number.isFinite(limit) ? Math.max(0, limit) : filtered.length);
}

function shapeLocalSymbols(
  rows: SymbolOut[],
  params: { limit?: number; index_key?: string; symbols?: string } = {},
): SymbolOut[] {
  const max = typeof params.limit === "number" && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : undefined;
  const bySymbol = new Map(rows.map((row) => [row.symbol, row] as const));
  const requestedSymbols = (params.symbols || "")
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  const uniqueRequested = Array.from(new Set(requestedSymbols));

  if (uniqueRequested.length > 0) {
    const ordered = uniqueRequested.map((symbol) => {
      const existing = bySymbol.get(symbol);
      return {
        symbol,
        name: existing?.name ?? symbol,
        current_price: existing?.current_price ?? null,
        change_pct: existing?.change_pct ?? null,
      };
    });
    return max ? ordered.slice(0, max) : ordered;
  }

  const indexKey = (params.index_key || "").trim().toLowerCase();
  const scopedSymbols = LOCAL_INDEX_FALLBACKS[indexKey];
  if (scopedSymbols && scopedSymbols.length > 0) {
    const ordered = scopedSymbols.map((symbol) => {
      const existing = bySymbol.get(symbol);
      return {
        symbol,
        name: existing?.name ?? symbol,
        current_price: existing?.current_price ?? null,
        change_pct: existing?.change_pct ?? null,
      };
    });
    return max ? ordered.slice(0, max) : ordered;
  }

  const hydrated = rows.map((row) => ({
    ...row,
    current_price: row.current_price ?? null,
    change_pct: row.change_pct ?? null,
  }));

  return max ? hydrated.slice(0, max) : hydrated;
}

async function loadLocalSymbols(params: { limit?: number; index_key?: string; symbols?: string } = {}): Promise<SymbolOut[]> {
  if (typeof window === "undefined") {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.join(process.cwd(), "public", "symbols.json");
      const content = await fs.readFile(filePath, "utf-8");
      const rows = normalizeSymbols(JSON.parse(content));
      return shapeLocalSymbols(rows, params);
    } catch {
      return [];
    }
  }
  try {
    const rows = await fetchJson<SymbolOut[]>("/symbols.json", {
      timeoutMs: 4000,
      cache: "force-cache",
    });
    return shapeLocalSymbols(rows, params);
  } catch {
    return [];
  }
}

export async function fetchSymbols(params: { limit?: number; index_key?: string; symbols?: string } = {}): Promise<SymbolOut[]> {
  try {
    const rows = await fetchJson<unknown>(buildApiUrl("/api/v1/stocks", params), {
      timeoutMs: 9000,
      cache: "no-store",
    });
    return normalizeSymbols(rows);
  } catch (primaryErr) {
    const fallback = await loadLocalSymbols(params);
    if (fallback.length > 0) return fallback;
    if (isAbortError(primaryErr)) return [];
    return [];
  }
}

export async function fetchIndices(): Promise<IndexOut[]> {
  try {
    return await fetchJson<IndexOut[]>(buildApiUrl("/api/v1/indices", { _ts: Date.now() }), {
      timeoutMs: 6000,
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return [];
  }
}

export async function fetchOhlcv(symbol: string, params: { start?: string; end?: string; limit?: number } = {}): Promise<OhlcvOut[]> {
  try {
    return await fetchJson<OhlcvOut[]>(
      buildApiUrl(`/api/v1/ohlcv/${encodeURIComponent(symbol)}`, params),
      { timeoutMs: 8000, cache: "no-store" },
    );
  } catch {
    try {
      return await fetchJson<OhlcvOut[]>(
        buildApiUrl(`/api/v1/ohlcv-lite/${encodeURIComponent(symbol)}`, params),
        { timeoutMs: 8000, cache: "no-store" },
      );
    } catch {
      return [];
    }
  }
}

export async function fetchOhlcvIntraday(symbol: string, params: { limit?: number } = {}): Promise<OhlcvOut[]> {
  try {
    return await fetchJson<OhlcvOut[]>(
      buildApiUrl(`/api/v1/ohlcv-intraday/${encodeURIComponent(symbol)}`, params),
      { timeoutMs: 6000, cache: "no-store" },
    );
  } catch {
    return [];
  }
}

async function hydrateRowsWithQuotes(
  rows: ScreenerOut[],
  options: {
    forceCurrentPrice?: boolean;
    forceChange1d?: boolean;
    requireLiveCurrentPrice?: boolean;
    requireLiveChange1d?: boolean;
  } = {},
): Promise<ScreenerOut[]> {
  if (rows.length === 0) return rows;
  const forceCurrentPrice = options.forceCurrentPrice === true;
  const forceChange1d = options.forceChange1d === true;
  const requireLiveCurrentPrice = options.requireLiveCurrentPrice === true;
  const requireLiveChange1d = options.requireLiveChange1d === true;
  try {
    const quoted = await fetchSymbols({
      symbols: rows.map((row) => row.symbol).join(","),
      limit: rows.length,
    });
    const quoteMap = new Map(quoted.map((row) => [row.symbol, row] as const));
    return rows.map((row) => {
      const quote = quoteMap.get(row.symbol);
      return {
        ...row,
        current_price: forceCurrentPrice
          ? (requireLiveCurrentPrice
            ? (quote?.current_price ?? null)
            : (quote?.current_price ?? row.current_price ?? null))
          : (row.current_price ?? quote?.current_price ?? null),
        change_1d: forceChange1d
          ? (requireLiveChange1d
            ? (quote?.change_pct ?? null)
            : (quote?.change_pct ?? row.change_1d ?? null))
          : (row.change_1d ?? quote?.change_pct ?? null),
      };
    });
  } catch {
    return rows;
  }
}

async function hydrateRowsWithMetrics(
  rows: ScreenerOut[],
  params: {
    rsi_min?: string;
    rsi_max?: string;
    change_min?: string;
    index_key?: string;
    limit?: string;
  },
): Promise<ScreenerOut[]> {
  if (rows.length === 0) return rows;
  try {
    const metrics = await fetchJson<ScreenerOut[]>(
      buildApiUrl("/api/v1/screener-metrics", {
        symbols: rows.map((row) => row.symbol).join(","),
        index_key: params.index_key,
        rsi_min: params.rsi_min,
        rsi_max: params.rsi_max,
        change_min: params.change_min,
        limit: params.limit ?? String(rows.length),
      }),
      {
        timeoutMs: 6000,
        cache: "no-store",
      },
    );
    const metricsMap = new Map(metrics.map((row) => [row.symbol, row] as const));
    return rows.map((row) => {
      const metric = metricsMap.get(row.symbol);
      return {
        ...row,
        rsi: row.rsi ?? metric?.rsi ?? null,
        macd: row.macd ?? metric?.macd ?? null,
        change_5d: row.change_5d ?? metric?.change_5d ?? null,
        change_1m: row.change_1m ?? metric?.change_1m ?? null,
        ema_20: row.ema_20 ?? metric?.ema_20 ?? null,
        ema_50: row.ema_50 ?? metric?.ema_50 ?? null,
        ema_200: row.ema_200 ?? metric?.ema_200 ?? null,
        pe_ratio: row.pe_ratio ?? metric?.pe_ratio ?? null,
        roe: row.roe ?? metric?.roe ?? null,
        is_breakout: row.is_breakout ?? metric?.is_breakout ?? null,
        breakout_score: row.breakout_score ?? metric?.breakout_score ?? null,
        last_updated: row.last_updated ?? metric?.last_updated ?? null,
      };
    });
  } catch {
    return rows;
  }
}

function computeBreakoutScoreFromAnalytics(row: ScreenerOut): number | null {
  const change1d = row.change_1d ?? 0;
  const change5d = row.change_5d ?? 0;
  const rsi = row.rsi ?? 50;
  const emaTrendBoost =
    row.ema_20 != null && row.ema_50 != null && row.ema_20 > row.ema_50 ? 1.2 : 0;
  const longTrendBoost =
    row.ema_50 != null && row.ema_200 != null && row.ema_50 >= row.ema_200 ? 1.2 : 0;
  const macdBoost = row.macd != null && row.macd > 0 ? 1.0 : 0;
  return Number((change1d * 0.6 + change5d * 0.3 + (rsi - 50) * 0.08 + emaTrendBoost + longTrendBoost + macdBoost).toFixed(2));
}

async function hydrateRowsWithAnalytics(
  rows: ScreenerOut[],
  params: {
    rsi_min?: string;
    rsi_max?: string;
    change_min?: string;
  },
): Promise<ScreenerOut[]> {
  if (rows.length === 0) return rows;
  const missingSymbols = rows
    .filter((row) =>
      row.rsi == null ||
      row.breakout_score == null ||
      row.pe_ratio == null ||
      row.roe == null ||
      row.ema_200 == null
    )
    .map((row) => row.symbol);
  if (missingSymbols.length === 0) return rows;

  try {
    const analyticsRows = await Promise.all(
      missingSymbols.map(async (symbol) => [symbol, await fetchAnalytics(symbol)] as const),
    );
    const analyticsMap = new Map(analyticsRows);
    const rsiMin = Number(params.rsi_min ?? "52");
    const rsiMax = Number(params.rsi_max ?? "78");
    const changeMin = Number(params.change_min ?? "1.2");

    return rows.map((row) => {
      const analytics = analyticsMap.get(row.symbol);
      if (!analytics) return row;
      const derivedRoe =
        analytics.roe ??
        (
          typeof analytics.pb_ratio === "number" &&
          typeof analytics.pe_ratio === "number" &&
          analytics.pe_ratio !== 0
            ? analytics.pb_ratio / analytics.pe_ratio
            : null
        );
      const merged: ScreenerOut = {
        ...row,
        current_price: row.current_price ?? analytics.current_price ?? null,
        change_1d: row.change_1d ?? analytics.day_change_pct ?? null,
        rsi: row.rsi ?? analytics.rsi_14 ?? null,
        macd: row.macd ?? analytics.macd_value ?? null,
        pe_ratio: row.pe_ratio ?? analytics.pe_ratio ?? null,
        roe: row.roe ?? derivedRoe ?? null,
        ema_20: row.ema_20 ?? analytics.ema_20 ?? null,
        ema_50: row.ema_50 ?? analytics.ema_50 ?? null,
        ema_200: row.ema_200 ?? analytics.ema_200 ?? null,
      };

      const computedBreakout =
        merged.change_1d != null &&
        merged.rsi != null &&
        merged.change_1d >= changeMin &&
        merged.rsi >= rsiMin &&
        merged.rsi <= rsiMax &&
        merged.ema_20 != null &&
        merged.ema_50 != null &&
        merged.ema_20 > merged.ema_50 &&
        merged.ema_200 != null &&
        merged.ema_50 >= merged.ema_200 &&
        merged.macd != null &&
        merged.macd > 0;

      merged.is_breakout = merged.is_breakout ?? computedBreakout;
      merged.breakout_score = merged.breakout_score ?? computeBreakoutScoreFromAnalytics(merged);
      return merged;
    });
  } catch {
    return rows;
  }
}

export async function fetchScreened(params: {
  rsi_min?: string;
  rsi_max?: string;
  change_min?: string;
  index_key?: string;
  breakout_only?: string;
  limit?: string;
  symbols?: string;
}): Promise<ScreenerOut[]> {
  const fallbackSymbolLimit = params.index_key || params.symbols ? undefined : (params.limit ? Number(params.limit) : undefined);
  try {
    const data = await fetchJson<ScreenerOut[]>(buildApiUrl("/api/v1/screener", params), {
      timeoutMs: 15000,
      cache: "no-store",
    });
    if (data.length > 0) {
      const hydrated = hydrateScreenerRows(data, Number(params.change_min ?? "1.2"));
      const quoted = await hydrateRowsWithQuotes(hydrated, {
        forceCurrentPrice: true,
        forceChange1d: true,
        requireLiveCurrentPrice: true,
        requireLiveChange1d: true,
      });
      return applyScreenerFilters(quoted, params);
    }
    const fallbackSymbols = await loadLocalSymbols({
      limit: fallbackSymbolLimit,
      index_key: params.index_key,
      symbols: params.symbols,
    });
    const fallbackRows = hydrateScreenerRows(fallbackSymbols.map((row) => {
      return {
        symbol: row.symbol,
        name: row.name,
        current_price: row.current_price ?? null,
        is_breakout: null,
        index_buckets: params.index_key ? [params.index_key] : null,
        last_updated: new Date().toISOString(),
      };
    }), Number(params.change_min ?? "1.2"));
    const [quotedFallbackRows, metricHydrated] = await Promise.all([
      hydrateRowsWithQuotes(fallbackRows),
      hydrateRowsWithMetrics(fallbackRows, params),
    ]);
    const metricMap = new Map(metricHydrated.map((row) => [row.symbol, row] as const));
    const mergedFallbackRows = quotedFallbackRows.map((row) => ({
      ...metricMap.get(row.symbol),
      ...row,
      rsi: row.rsi ?? metricMap.get(row.symbol)?.rsi ?? null,
      macd: row.macd ?? metricMap.get(row.symbol)?.macd ?? null,
      change_5d: row.change_5d ?? metricMap.get(row.symbol)?.change_5d ?? null,
      change_1m: row.change_1m ?? metricMap.get(row.symbol)?.change_1m ?? null,
      ema_20: row.ema_20 ?? metricMap.get(row.symbol)?.ema_20 ?? null,
      ema_50: row.ema_50 ?? metricMap.get(row.symbol)?.ema_50 ?? null,
      ema_200: row.ema_200 ?? metricMap.get(row.symbol)?.ema_200 ?? null,
      pe_ratio: row.pe_ratio ?? metricMap.get(row.symbol)?.pe_ratio ?? null,
      roe: row.roe ?? metricMap.get(row.symbol)?.roe ?? null,
      is_breakout: row.is_breakout ?? metricMap.get(row.symbol)?.is_breakout ?? null,
      breakout_score: row.breakout_score ?? metricMap.get(row.symbol)?.breakout_score ?? null,
      last_updated: row.last_updated ?? metricMap.get(row.symbol)?.last_updated ?? null,
    }));
    return applyScreenerFilters(await hydrateRowsWithAnalytics(mergedFallbackRows, params), params);
  } catch {
    const fallbackSymbols = await loadLocalSymbols({
      limit: fallbackSymbolLimit,
      index_key: params.index_key,
      symbols: params.symbols,
    });
    const fallbackRows = hydrateScreenerRows(fallbackSymbols.map((row) => {
      return {
        symbol: row.symbol,
        name: row.name,
        current_price: row.current_price ?? null,
        is_breakout: null,
        index_buckets: params.index_key ? [params.index_key] : null,
        last_updated: new Date().toISOString(),
      };
    }), Number(params.change_min ?? "1.2"));
    const [quotedFallbackRows, metricHydrated] = await Promise.all([
      hydrateRowsWithQuotes(fallbackRows),
      hydrateRowsWithMetrics(fallbackRows, params),
    ]);
    const metricMap = new Map(metricHydrated.map((row) => [row.symbol, row] as const));
    const mergedFallbackRows = quotedFallbackRows.map((row) => ({
      ...metricMap.get(row.symbol),
      ...row,
      rsi: row.rsi ?? metricMap.get(row.symbol)?.rsi ?? null,
      macd: row.macd ?? metricMap.get(row.symbol)?.macd ?? null,
      change_5d: row.change_5d ?? metricMap.get(row.symbol)?.change_5d ?? null,
      change_1m: row.change_1m ?? metricMap.get(row.symbol)?.change_1m ?? null,
      ema_20: row.ema_20 ?? metricMap.get(row.symbol)?.ema_20 ?? null,
      ema_50: row.ema_50 ?? metricMap.get(row.symbol)?.ema_50 ?? null,
      ema_200: row.ema_200 ?? metricMap.get(row.symbol)?.ema_200 ?? null,
      pe_ratio: row.pe_ratio ?? metricMap.get(row.symbol)?.pe_ratio ?? null,
      roe: row.roe ?? metricMap.get(row.symbol)?.roe ?? null,
      is_breakout: row.is_breakout ?? metricMap.get(row.symbol)?.is_breakout ?? null,
      breakout_score: row.breakout_score ?? metricMap.get(row.symbol)?.breakout_score ?? null,
      last_updated: row.last_updated ?? metricMap.get(row.symbol)?.last_updated ?? null,
    }));
    return applyScreenerFilters(await hydrateRowsWithAnalytics(mergedFallbackRows, params), params);
  }
}

export async function fetchWatchlistMetrics(symbols: string[]): Promise<ScreenerOut[]> {
  const normalizedSymbols = Array.from(
    new Set(
      symbols
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
  if (normalizedSymbols.length === 0) return [];

  const symbolQuery = normalizedSymbols.join(",");
  const [metricsResult, quotesResult] = await Promise.allSettled([
    fetchJson<ScreenerOut[]>(
      buildApiUrl("/api/v1/screener-metrics", {
        symbols: symbolQuery,
        rsi_min: "0",
        rsi_max: "100",
        change_min: "-100",
        limit: String(normalizedSymbols.length),
      }),
      { timeoutMs: 10000, cache: "no-store" },
    ),
    fetchSymbols({ symbols: symbolQuery, limit: normalizedSymbols.length }),
  ]);

  const metrics =
    metricsResult.status === "fulfilled" && Array.isArray(metricsResult.value)
      ? metricsResult.value
      : [];
  const quotes =
    quotesResult.status === "fulfilled" && Array.isArray(quotesResult.value)
      ? quotesResult.value
      : [];

  const metricsMap = new Map(
    metrics.map((row) => [row.symbol.trim().toUpperCase(), row] as const),
  );
  const quoteMap = new Map(
    quotes.map((row) => [row.symbol.trim().toUpperCase(), row] as const),
  );

  const baseRows = normalizedSymbols.map((symbol) => {
    const metric = metricsMap.get(symbol);
    const quote = quoteMap.get(symbol);
    return {
      symbol,
      name: metric?.name ?? quote?.name ?? null,
      current_price: quote?.current_price ?? null,
      change_1d: quote?.change_pct ?? null,
      rsi: metric?.rsi ?? null,
      macd: metric?.macd ?? null,
      change_5d: metric?.change_5d ?? null,
      change_1m: metric?.change_1m ?? null,
      pe_ratio: metric?.pe_ratio ?? null,
      roe: metric?.roe ?? null,
      ema_20: metric?.ema_20 ?? null,
      ema_50: metric?.ema_50 ?? null,
      ema_200: metric?.ema_200 ?? null,
      is_breakout: metric?.is_breakout ?? null,
      breakout_score: metric?.breakout_score ?? null,
      index_buckets: metric?.index_buckets ?? null,
      last_updated: metric?.last_updated ?? null,
    };
  });

  const missingSymbols = baseRows
    .filter((row) =>
      row.rsi == null ||
      row.breakout_score == null ||
      row.pe_ratio == null ||
      row.roe == null ||
      row.ema_200 == null,
    )
    .map((row) => row.symbol);

  if (missingSymbols.length === 0) return baseRows;

  const analyticsResults = await Promise.allSettled(
    missingSymbols.map(async (symbol) => [symbol, await fetchAnalytics(symbol)] as const),
  );
  const analyticsMap = new Map(
    analyticsResults
      .filter((entry): entry is PromiseFulfilledResult<readonly [string, AnalyticsOut]> => entry.status === "fulfilled")
      .map((entry) => entry.value),
  );

  return baseRows.map((row) => {
    const analytics = analyticsMap.get(row.symbol);
    if (!analytics) return row;

    const derivedRoe =
      analytics.roe ??
      (
        typeof analytics.pb_ratio === "number" &&
        typeof analytics.pe_ratio === "number" &&
        analytics.pe_ratio !== 0
          ? analytics.pb_ratio / analytics.pe_ratio
          : null
      );

    const enriched: ScreenerOut = {
      ...row,
      current_price: row.current_price ?? analytics.current_price ?? null,
      change_1d: row.change_1d ?? analytics.day_change_pct ?? null,
      rsi: row.rsi ?? analytics.rsi_14 ?? null,
      macd: row.macd ?? analytics.macd_value ?? null,
      pe_ratio: row.pe_ratio ?? analytics.pe_ratio ?? null,
      roe: row.roe ?? derivedRoe ?? null,
      ema_20: row.ema_20 ?? analytics.ema_20 ?? null,
      ema_50: row.ema_50 ?? analytics.ema_50 ?? null,
      ema_200: row.ema_200 ?? analytics.ema_200 ?? null,
      last_updated: row.last_updated ?? new Date().toISOString(),
    };

    const computedBreakout =
      enriched.change_1d != null &&
      enriched.rsi != null &&
      enriched.change_1d >= 1.2 &&
      enriched.rsi >= 52 &&
      enriched.rsi <= 78 &&
      enriched.ema_20 != null &&
      enriched.ema_50 != null &&
      enriched.ema_20 > enriched.ema_50 &&
      enriched.ema_200 != null &&
      enriched.ema_50 >= enriched.ema_200 &&
      enriched.macd != null &&
      enriched.macd > 0;

    enriched.is_breakout = enriched.is_breakout ?? computedBreakout;
    enriched.breakout_score = enriched.breakout_score ?? computeBreakoutScoreFromAnalytics(enriched);
    return enriched;
  });
}

export async function fetchPortfolio(): Promise<PortfolioOut[]> {
  try {
    return await fetchJson<PortfolioOut[]>(buildApiUrl("/api/v1/portfolio"), {
      timeoutMs: 9000,
      cache: "no-store",
      headers: withAuthHeaders(),
    });
  } catch {
    return [];
  }
}

export async function addPortfolioItem(payload: PortfolioCreate): Promise<PortfolioOut> {
  return await fetchJson<PortfolioOut>(buildApiUrl("/api/v1/portfolio"), {
    timeoutMs: 9000,
    method: "POST",
    headers: withAuthHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      ...payload,
      symbol: payload.symbol.trim().toUpperCase(),
    }),
  });
}

export async function removePortfolioItem(symbol: string): Promise<void> {
  await fetchJson<{ status: string }>(buildApiUrl(`/api/v1/portfolio/${encodeURIComponent(symbol)}`), {
    timeoutMs: 9000,
    method: "DELETE",
    headers: withAuthHeaders(),
  });
}

export async function fetchWatchlist(): Promise<WatchlistOut[]> {
  try {
    return await fetchJson<WatchlistOut[]>(buildApiUrl("/api/v1/watchlist"), {
      timeoutMs: 9000,
      cache: "no-store",
      headers: withAuthHeaders(),
    });
  } catch {
    return [];
  }
}

export async function addWatchlistItem(payload: WatchlistCreate): Promise<WatchlistOut> {
  return await fetchJson<WatchlistOut>(buildApiUrl("/api/v1/watchlist"), {
    timeoutMs: 9000,
    method: "POST",
    headers: withAuthHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      symbol: payload.symbol.trim().toUpperCase(),
    }),
  });
}

export async function removeWatchlistItem(symbol: string): Promise<void> {
  await fetchJson<{ status: string }>(buildApiUrl(`/api/v1/watchlist/${encodeURIComponent(symbol)}`), {
    timeoutMs: 9000,
    method: "DELETE",
    headers: withAuthHeaders(),
  });
}

export async function fetchAnalytics(symbol: string): Promise<AnalyticsOut> {
  try {
    return await fetchJson<AnalyticsOut>(buildApiUrl(`/api/v1/analytics/${encodeURIComponent(symbol)}`), {
      timeoutMs: 12000,
      cache: "no-store",
    });
  } catch {
    // Never synthesize market data for prices/metrics; callers should treat missing data as unavailable.
    return { symbol };
  }
}
