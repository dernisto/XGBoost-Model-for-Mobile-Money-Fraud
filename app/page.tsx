"use client";

import {
  Activity,
  AlertTriangle,
  Gauge,
  Package,
  Scale,
  Timer,
  TrendingDown,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SiloStatus = "LOW LEVEL" | "NORMAL" | "HIGH LEVEL" | "OFFLINE";

type SiloData = {
  weight: number;
  percentage: number;
  minThreshold: number;
  maxThreshold: number;
  consumptionRate: number;
  daysOfSupply: number;
  status: SiloStatus;
  timestamp: string;
};

type HistoryPoint = {
  time: string;
  weight: number;
};

const POLL_INTERVAL = 5000;
const STALE_TIMEOUT = 15000;
const CAPACITY_KG = 20;

const statusInfo: Record<
  SiloStatus,
  { explanation: string; toneClass: string; badgeClass: string }
> = {
  "LOW LEVEL": {
    explanation: "Load is below the minimum threshold.",
    toneClass: "text-red-600",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  NORMAL: {
    explanation: "Load is within the operating range.",
    toneClass: "text-amber-600",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "HIGH LEVEL": {
    explanation: "Silo is at or above the maximum threshold.",
    toneClass: "text-emerald-600",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  OFFLINE: {
    explanation: "Unable to retrieve live data from the Blynk device.",
    toneClass: "text-slate-500",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number, fractionDigits = 2): string {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : "--";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );

  if (diffSeconds < 60) return `Updated ${diffSeconds} second${diffSeconds === 1 ? "" : "s"} ago`;
  const minutes = Math.floor(diffSeconds / 60);
  return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

function buildPolylinePoints(history: HistoryPoint[], width: number, height: number): string {
  if (history.length === 0) {
    return "";
  }

  const maxWeight = Math.max(...history.map((point) => point.weight), 1);

  return history
    .map((point, index) => {
      const x = history.length === 1 ? width / 2 : (index / (history.length - 1)) * width;
      const y = height - (point.weight / maxWeight) * height;
      return `${x},${clamp(y, 0, height)}`;
    })
    .join(" ");
}

function DataCard({
  title,
  value,
  unit,
  icon,
}: {
  title: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-3 flex items-center justify-between text-slate-500">
        <h3 className="text-sm font-medium tracking-wide">{title}</h3>
        {icon}
      </div>
      <p className="text-2xl font-semibold text-slate-900">
        {value} <span className="text-base font-medium text-slate-500">{unit}</span>
      </p>
    </article>
  );
}

export default function Home() {
  const [data, setData] = useState<SiloData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchSiloData = async () => {
      try {
        const response = await fetch("/api/silo", { cache: "no-store" });
        const payload = (await response.json()) as SiloData & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Blynk connection unavailable");
        }

        if (cancelled) return;

        setData(payload);
        setError(null);
        setLastSuccessAt(Date.now());
        setHistory((previous) => {
          const next = [
            ...previous,
            {
              time: new Date(payload.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              weight: payload.weight,
            },
          ];
          return next.slice(-50);
        });
      } catch {
        if (cancelled) return;
        setError("Blynk connection unavailable");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchSiloData();
    const interval = setInterval(fetchSiloData, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isStale = lastSuccessAt !== null && now - lastSuccessAt > STALE_TIMEOUT;
  const noDataYet = !loading && !data && !error;

  const effectiveStatus: SiloStatus = useMemo(() => {
    if (!data || error || isStale) {
      return "OFFLINE";
    }
    return data.status;
  }, [data, error, isStale]);

  const statusDetails = statusInfo[effectiveStatus];
  const progress = clamp(data?.percentage ?? 0, 0, 100);
  const chartPoints = buildPolylinePoints(history, 600, 180);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                SMART SILO
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">MONITORING SYSTEM</h1>
              <p className="mt-2 text-sm text-slate-500">Powered by ESP32 + Blynk IoT</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">System status</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                  {effectiveStatus === "OFFLINE" ? (
                    <WifiOff className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Wifi className="h-4 w-4 text-emerald-600" />
                  )}
                  {effectiveStatus === "OFFLINE" ? "OFFLINE" : "ONLINE"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Last updated</p>
                <p className="mt-1 text-sm font-semibold">{timeAgo(data?.timestamp ?? null)}</p>
              </div>
            </div>
          </div>
        </header>

        {loading && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">Connecting to Smart Silo...</p>
          </section>
        )}

        {error && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">Unable to connect to Smart Silo.</p>
            <p className="mt-1 text-sm text-slate-500">Blynk connection unavailable</p>
          </section>
        )}

        {noDataYet && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">Waiting for the first reading...</p>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-slate-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Silo level</h2>
            </div>

            <div className="flex flex-col items-center gap-5">
              <div
                className="relative grid h-56 w-56 place-items-center rounded-full transition-all duration-500"
                style={{
                  background: `conic-gradient(#16a34a ${progress}%, #e2e8f0 ${progress}% 100%)`,
                }}
              >
                <div className="grid h-44 w-44 place-items-center rounded-full bg-white shadow-inner">
                  <p className="text-5xl font-bold tracking-tight">{formatNumber(progress, 0)}%</p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-slate-500">Current capacity</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatNumber(data?.weight ?? 0, 2)} kg / {CAPACITY_KG} kg
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-slate-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Silo status</h2>
            </div>

            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusDetails.badgeClass}`}
            >
              {effectiveStatus}
            </span>
            <p className={`mt-4 text-base font-medium ${statusDetails.toneClass}`}>{statusDetails.explanation}</p>
            {isStale && (
              <p className="mt-2 text-sm text-slate-500">Latest reading is stale. Reconnecting...</p>
            )}
          </article>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DataCard
            title="TOTAL WEIGHT"
            value={formatNumber(data?.weight ?? 0, 2)}
            unit="kg"
            icon={<Scale className="h-5 w-5" />}
          />
          <DataCard
            title="DAYS OF SUPPLY"
            value={formatNumber(data?.daysOfSupply ?? 0, 1)}
            unit="days"
            icon={<Timer className="h-5 w-5" />}
          />
          <DataCard
            title="CONSUMPTION RATE"
            value={formatNumber(data?.consumptionRate ?? 0, 2)}
            unit="kg/day"
            icon={<TrendingDown className="h-5 w-5" />}
          />
          <DataCard
            title="MINIMUM THRESHOLD"
            value={formatNumber(data?.minThreshold ?? 0, 2)}
            unit="kg"
            icon={<Activity className="h-5 w-5" />}
          />
          <DataCard
            title="MAXIMUM THRESHOLD"
            value={formatNumber(data?.maxThreshold ?? 0, 2)}
            unit="kg"
            icon={<Package className="h-5 w-5" />}
          />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Weight history</h2>
              <p className="text-sm text-slate-500">LIVE SESSION HISTORY</p>
            </div>
            <p className="text-xs text-slate-400">Latest 50 readings while this page is open</p>
          </div>

          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              Waiting for data
            </p>
          ) : (
            <div className="space-y-3">
              <div className="h-52 w-full rounded-2xl bg-slate-50 p-4">
                <svg viewBox="0 0 600 180" className="h-full w-full" role="img" aria-label="Weight history chart">
                  <polyline
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={chartPoints}
                  />
                </svg>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{history[0]?.time}</span>
                <span>{history[history.length - 1]?.time}</span>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
