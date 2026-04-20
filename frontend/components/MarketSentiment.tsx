"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchOhlcv, type IndexOut } from "@/lib/api";

const DISPLAY_LOCALE = "en-US";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSentiment(score: number) {
  if (score < 25) return { label: "Extreme Fear", colorClass: "text-rose-400", accent: "#f43f5e" };
  if (score < 45) return { label: "Fear", colorClass: "text-amber-300", accent: "#f59e0b" };
  if (score < 55) return { label: "Neutral", colorClass: "text-white/90", accent: "#eab308" };
  if (score < 75) return { label: "Greed", colorClass: "text-emerald-300", accent: "#22c55e" };
  return { label: "Extreme Greed", colorClass: "text-emerald-400", accent: "#22c55e" };
}

function formatOrdinal(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

type SentimentDay = {
  date: Date;
  label: string;
  score: number;
};

function isSameLocalDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function startOfWeekMonday(d: Date) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = out.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // move back to Monday
  out.setDate(out.getDate() + diff);
  return out;
}

function addDays(d: Date, days: number) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + days);
  return out;
}

function weekMonToFri(monday: Date) {
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

function nextTradingDay(d: Date) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  do {
    out.setDate(out.getDate() + 1);
  } while (isWeekend(out));
  return out;
}

function prevTradingDay(d: Date) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  do {
    out.setDate(out.getDate() - 1);
  } while (isWeekend(out));
  return out;
}

function labelForDate(d: Date, today: Date) {
  if (isSameLocalDate(d, today)) return "TODAY";
  return d.toLocaleDateString(DISPLAY_LOCALE, { weekday: "short" }).toUpperCase();
}

function MiniMeter({
  value,
  label,
  dim,
  selected,
  onClick,
}: {
  value: number;
  label: string;
  dim?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const pct = clamp(value, 0, 100) / 100;
  const deg = Math.round(pct * 360);
  const base = "rgba(255,255,255,0.14)";
  const fill = dim ? "rgba(34,197,94,0.55)" : "rgba(34,197,94,0.95)";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected ? "true" : "false"}
      className={`flex flex-col items-center gap-1 focus:outline-none ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div
        className={`w-10 h-10 rounded-full grid place-items-center ${dim ? "opacity-70" : ""} ${selected ? "ring-2 ring-emerald-400/60" : ""}`}
        style={{
          background: `conic-gradient(from -90deg, ${fill} ${deg}deg, ${base} 0deg)`,
        }}
      >
        <div className="w-8 h-8 rounded-full bg-bg border border-white/10" />
      </div>
      <div
        className={`text-[10px] font-black uppercase tracking-widest ${
          label === "TODAY" ? "text-muted" : "text-muted/80"
        }`}
      >
        {label}
      </div>
    </button>
  );
}

export default function MarketSentiment({ indices }: { indices: IndexOut[] }) {
  const anchor = useMemo(() => {
    return indices.find((i) => /nifty|sensex|nse/i.test(i.symbol) || /nifty|sensex/i.test(i.name ?? "")) ?? indices[0];
  }, [indices]);

  const initialScore = useMemo(() => {
    const changePct = Number(anchor?.day_change_pct ?? 0);
    return clamp(50 + changePct * 10, 0, 100);
  }, [anchor]);

  const [days, setDays] = useState<SentimentDay[] | null>(null);

  const todayDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const baseDate = useMemo(() => {
    return isWeekend(todayDate) ? prevTradingDay(todayDate) : todayDate;
  }, [todayDate]);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekMonday(baseDate));
  const [selectedDate, setSelectedDate] = useState<Date>(() => baseDate);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!anchor?.symbol) return;
      try {
        const data = await fetchOhlcv(anchor.symbol, { limit: 10 });
        const closes = data
          .map((p) => ({ time: new Date(p.time), close: p.close }))
          .filter((p) => Number.isFinite(p.time.getTime()) && Number.isFinite(p.close))
          .sort((a, b) => a.time.getTime() - b.time.getTime());

        if (closes.length < 3) return;

        const last = closes.slice(-6); // enough to compute 5 daily changes
        const computed: SentimentDay[] = [];
        for (let i = 1; i < last.length; i++) {
          const prev = last[i - 1];
          const curr = last[i];
          const changePct = prev.close > 0 ? ((curr.close - prev.close) / prev.close) * 100 : 0;
          const score = clamp(50 + changePct * 10, 0, 100);
          computed.push({ date: curr.time, label: "", score });
        }

        const trimmed = computed.slice(-5);
        const today = new Date();
        const labels = trimmed.map((d) => labelForDate(d.date, today));
        const out = trimmed.map((d, i) => ({ ...d, label: labels[i] ?? d.label }));

        if (!cancelled) {
          setDays(out);
        }
      } catch {
        // fallback handled below
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [anchor?.symbol]);

  const historyMap = useMemo(() => {
    const map = new Map<string, number>();
    (days ?? []).forEach((d) => map.set(dateKey(d.date), d.score));
    return map;
  }, [days]);

  const lastKnownScore = useMemo(() => {
    if (!days?.length) return initialScore;
    const sorted = [...days].sort((a, b) => a.date.getTime() - b.date.getTime());
    return sorted[sorted.length - 1]?.score ?? initialScore;
  }, [days, initialScore]);

  const scoreForDate = useMemo(() => {
    return (d: Date) => historyMap.get(dateKey(d)) ?? lastKnownScore;
  }, [historyMap, lastKnownScore]);

  const weekDates = useMemo(() => weekMonToFri(weekStart), [weekStart]);

  const windowDays = useMemo((): SentimentDay[] => {
    return weekDates.map((date) => ({
      date,
      label: labelForDate(date, todayDate),
      score: scoreForDate(date),
    }));
  }, [scoreForDate, todayDate, weekDates]);

  const selected = useMemo(() => {
    const selectedK = dateKey(selectedDate);
    return windowDays.find((d) => dateKey(d.date) === selectedK) ?? windowDays[windowDays.length - 1];
  }, [selectedDate, windowDays]);

  const todayScore = scoreForDate(todayDate);
  const today: SentimentDay = { date: todayDate, label: "TODAY", score: todayScore };

  const todaySentiment = getSentiment(today.score);
  const selectedSentiment = getSentiment(selected.score);
  const showChangeSince = !isSameLocalDate(selected.date, today.date);
  const headlineSentiment = showChangeSince ? todaySentiment : selectedSentiment;

  const needle = -90 + (selected.score / 100) * 180;
  const updatedAt = new Date(anchor?.last_updated ?? Date.now());
  const timeText = Number.isFinite(updatedAt.getTime())
    ? updatedAt.toLocaleTimeString(DISPLAY_LOCALE, { hour: "2-digit", minute: "2-digit" }).toUpperCase()
    : "";

  const sinceText = showChangeSince
    ? `${formatOrdinal(selected.date.getDate())} ${selected.date.toLocaleDateString(DISPLAY_LOCALE, { weekday: "short" })}`
    : "";

  const isSelectedToday = isSameLocalDate(selected.date, today.date);
  const isSelectedFuture = selected.date.getTime() > today.date.getTime();

  function handleNext() {
    const next = nextTradingDay(selectedDate);
    setSelectedDate(next);
    setWeekStart(startOfWeekMonday(next));
  }

  return (
    <div className="glass-card !p-4 flex items-center gap-5 bg-white/5 border-white/10 w-full lg:w-auto">
      <div className="flex items-center gap-4 min-w-[260px]">
        <div className="relative w-16 h-16">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(from 180deg, #f43f5e, #f59e0b, #22c55e)",
            }}
          />
          <div className="absolute inset-2 rounded-full bg-bg" />
          <div className="absolute left-0 right-0 bottom-0 h-1/2 bg-bg" />
          <div
            className="absolute left-1/2 bottom-2 w-[2px] h-7 rounded bg-white/90"
            style={{
              transform: `translateX(-50%) rotate(${needle}deg)`,
              transformOrigin: "bottom center",
              boxShadow: "0 0 14px rgba(255,255,255,0.18)",
            }}
          />
          <div className="absolute left-1/2 bottom-[18px] w-2.5 h-2.5 rounded-full bg-bg border border-white/30 -translate-x-1/2" />
          <div className="absolute left-0 top-0 w-full h-full rounded-full ring-1 ring-white/10" />
        </div>

        <div className="leading-tight">
          {showChangeSince ? (
            <div className="text-[11px] font-black tracking-widest text-muted/70 uppercase">Change since {sinceText}</div>
          ) : (
            <div className="text-white font-black tracking-tight text-base">The market is in</div>
          )}

          <div className={`text-lg font-black tracking-tight ${headlineSentiment.colorClass}`}>
            {showChangeSince ? `${selectedSentiment.label} to ${todaySentiment.label}` : `${selectedSentiment.label} zone`}
          </div>

          <div className="text-[10px] font-bold uppercase tracking-widest text-muted/70 mt-1">
            Score{" "}
            {showChangeSince ? (
              <>
                <span style={{ color: selectedSentiment.accent }}>{Math.round(selected.score)}</span>{" "}
                <span className="text-muted/60">→</span>{" "}
                <span style={{ color: todaySentiment.accent }}>{Math.round(today.score)}</span>
              </>
            ) : (
              <span style={{ color: selectedSentiment.accent }}>{Math.round(selected.score)}</span>
            )}
            {anchor?.symbol ? <span className="ml-2 text-muted/50">• {anchor.symbol}</span> : null}
          </div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-5">
        {windowDays.map((d, idx) => (
          <MiniMeter
            key={`${d.label}-${idx}`}
            label={d.label}
            value={d.score}
            dim={dateKey(d.date) !== dateKey(selected.date)}
            selected={dateKey(d.date) === dateKey(selected.date)}
            onClick={() => {
              setSelectedDate(d.date);
              setWeekStart(startOfWeekMonday(d.date));
            }}
          />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="hidden sm:block text-right">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted/60">
            {isSelectedToday ? "TODAY" : isSelectedFuture ? "NEXT" : selected.label}
          </div>
          <div className="text-xs font-bold text-muted/80">
            {isSelectedToday ? timeText : selected.date.toLocaleDateString(DISPLAY_LOCALE, { day: "2-digit", month: "short" })}
          </div>
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 grid place-items-center text-white/80 hover:bg-white/10 transition-colors"
          aria-label="Next trading day"
          title="Next trading day"
        >
          <span className="text-xl leading-none">›</span>
        </button>
      </div>
    </div>
  );
}
