"use client";

import { createChart, ColorType, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

interface ChartProps {
  data: {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }[];
  type: 'candlestick' | 'line';
}

export default function StockChart({ data, type }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#aab6e8",
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 450,
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
      },
    });

    const formattedData = [...data].map((d) => ({
      time: (Math.floor(new Date(d.time).getTime() / 1000)) as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      value: d.close, // for line chart
    })).sort((a, b) => a.time - b.time);

    if (type === 'candlestick') {
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: true,
        wickVisible: true,
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        priceLineVisible: true,
        lastValueVisible: true,
      });
      candlestickSeries.setData(formattedData);
    } else {
      const lineSeries = chart.addLineSeries({
        color: "#7aa2ff",
        lineWidth: 2,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      lineSeries.setData(formattedData);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, type]);

  if (data.length === 0) {
    return (
      <div className="w-full h-[450px] flex items-center justify-center text-sm font-medium text-muted">
        Live chart data is unavailable right now.
      </div>
    );
  }

  return <div ref={chartContainerRef} style={{ width: "100%", height: "450px" }} />;
}
