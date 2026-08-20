import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { StatsResponse } from '../types';
import { TrendingDown, Server } from 'lucide-react';

interface AnalyticsViewProps {
  stats: StatsResponse | null;
}

const tooltipStyle = {
  backgroundColor: '#18181b',
  borderColor: '#3f3f46',
  borderRadius: '8px',
  fontSize: '11px',
  fontFamily: 'JetBrains Mono, monospace',
  color: '#f4f4f5',
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ stats }) => {
  if (!stats) return null;

  const serviceChartData = stats.topServices.map((s) => ({
    name: s.service,
    rawAlerts: s.alertCount,
    incidents: s.incidentCount,
  }));

  const severityColors: Record<string, string> = {
    critical: '#f87171',
    high: '#fbbf24',
    medium: '#facc15',
    low: '#60a5fa',
  };

  return (
    <div className="space-y-4 font-mono">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline chart */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center space-x-1.5">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              <span className="font-condensed text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                Volume Comparison — Raw vs Collapsed
              </span>
            </div>
            <span className="font-mono text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              {stats.noiseReductionPercent}% REDUCTION
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.hourlyActivity}>
                <defs>
                  <linearGradient id="rawColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="incColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#3f3f46" fontSize={10} tick={{ fill: '#71717a' }} />
                <YAxis stroke="#3f3f46" fontSize={10} tick={{ fill: '#71717a' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="rawAlerts" name="Raw Errors" stroke="#f87171" strokeWidth={2} fillOpacity={1} fill="url(#rawColor)" />
                <Area type="monotone" dataKey="groupedIncidents" name="Grouped Incidents" stroke="#60a5fa" strokeWidth={2} fillOpacity={1} fill="url(#incColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Service breakdown */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center space-x-1.5">
              <Server className="w-4 h-4 text-purple-400" />
              <span className="font-condensed text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                Service Error Volume
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-600">Ingested Events</span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceChartData}>
                <XAxis dataKey="name" stroke="#3f3f46" fontSize={9} angle={-15} textAnchor="end" height={40} tick={{ fill: '#71717a' }} />
                <YAxis stroke="#3f3f46" fontSize={10} tick={{ fill: '#71717a' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="rawAlerts" name="Raw Errors" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Severity breakdown */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <span className="font-condensed text-[10px] font-semibold tracking-widest text-zinc-500 uppercase block mb-3">
          Severity Composition Matrix
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.severityBreakdown.map((sev) => (
            <div key={sev.severity} className="p-3 bg-zinc-800 rounded-xl border border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <span className="font-condensed text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                  {sev.severity}
                </span>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: severityColors[sev.severity] || '#60a5fa' }}
                />
              </div>
              <span className="font-mono text-2xl font-bold text-zinc-100 block">{sev.count}</span>
              <span className="font-mono text-[10px] text-zinc-600">events</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
