import React from 'react';
import { TrendingDown } from 'lucide-react';
import confetti from 'canvas-confetti';
import { StatsResponse } from '../types';

interface MetricCardsProps {
  stats: StatsResponse | null;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ stats }) => {
  if (!stats) return null;

  const triggerCelebration = () => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.65 },
      colors: ['#f59e0b', '#fbbf24', '#22c55e', '#a855f7'],
    });
  };

  const nrr = stats.noiseReductionPercent;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {/* Noise Reduction Ratio — instrument fill bar */}
      <div
        onClick={triggerCelebration}
        className="md:col-span-2 rounded-xl bg-zinc-900 border border-amber-500/25 p-4 cursor-pointer bg-graticule hover:border-amber-500/50 transition-colors group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
              Noise Reduction Ratio
            </span>
          </div>
          <span
            className="w-2 h-2 rounded-full bg-emerald-400"
            style={{ boxShadow: '0 0 7px rgba(52,211,153,0.6)' }}
          />
        </div>

        {/* Instrument fill bar */}
        <div className="h-6 bg-zinc-950 rounded border border-zinc-700 overflow-hidden mb-3 relative">
          <div
            className="h-full nrr-bar transition-all duration-700 ease-out"
            style={{ width: `${nrr}%` }}
          />
          {/* Graticule tick marks at 25%, 50%, 75% */}
          {[25, 50, 75].map((tick) => (
            <div
              key={tick}
              className="absolute top-0 h-full w-px bg-zinc-800"
              style={{ left: `${tick}%` }}
            />
          ))}
        </div>

        <div className="flex items-baseline justify-between">
          <span className="font-mono text-3xl font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
            {nrr}%
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            {stats.savedNotifications} alerts collapsed
          </span>
        </div>
      </div>

      {/* Raw Alert Stream */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 hover:border-zinc-700 transition-colors">
        <div className="flex items-center space-x-2 mb-3">
          <span
            className="w-2 h-2 rounded-full bg-red-400 shrink-0"
            style={{ boxShadow: '0 0 6px rgba(248,113,113,0.5)' }}
          />
          <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
            Raw Alert Stream
          </span>
        </div>
        <span className="font-mono text-3xl font-bold text-zinc-100 block">{stats.totalAlerts}</span>
        <p className="mt-1.5 font-mono text-[11px] text-zinc-600">
          {stats.topServices.length} microservices
        </p>
      </div>

      {/* Grouped Incidents */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 hover:border-zinc-700 transition-colors">
        <div className="flex items-center space-x-2 mb-3">
          <span
            className="w-2 h-2 rounded-full bg-blue-400 shrink-0"
            style={{ boxShadow: '0 0 6px rgba(96,165,250,0.5)' }}
          />
          <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
            Grouped Incidents
          </span>
        </div>
        <span className="font-mono text-3xl font-bold text-zinc-100 block">{stats.totalIncidents}</span>
        <p className="mt-1.5 font-mono text-[11px] text-zinc-600">
          {stats.activeIncidentsCount} active · {stats.criticalIncidentsCount} critical
        </p>
      </div>
    </div>
  );
};
