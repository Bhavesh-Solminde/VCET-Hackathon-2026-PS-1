import React, { useState } from 'react';
import { Flame, Play, RefreshCw } from 'lucide-react';
import { StormScenario } from '../types';

interface StormBannerProps {
  scenarios: StormScenario[];
  onTriggerStorm: (scenarioId: string, alertCount: number, speedMs: number) => void;
  isStorming: boolean;
  stormProgress: {
    scenarioId: string;
    scenarioName: string;
    totalAlerts: number;
    sentAlerts: number;
    speedMs: number;
  };
}

export const StormBanner: React.FC<StormBannerProps> = ({
  scenarios,
  onTriggerStorm,
  isStorming,
  stormProgress,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>(scenarios[0]?.id || 'postgres-pool-starvation');
  const [alertCount, setAlertCount] = useState<number>(60);
  const [speedMs, setSpeedMs] = useState<number>(40);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const currentScenario = scenarios.find((s) => s.id === selectedScenario) || scenarios[0];

  const progressPercent = stormProgress.totalAlerts > 0
    ? Math.min(100, Math.round((stormProgress.sentAlerts / stormProgress.totalAlerts) * 100))
    : 0;

  return (
    <div className="mb-5 rounded-xl bg-zinc-900 border border-amber-500/20 bg-hazard overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Title */}
          <div className="flex items-start space-x-3">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
              <Flame
                className={`w-4 h-4 text-amber-400 ${isStorming ? 'animate-storm-blink' : ''}`}
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-condensed text-sm font-bold text-zinc-200 uppercase tracking-wide">
                  Alert Storm Simulator
                </span>
                <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  CHAOS INJECTION
                </span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mt-0.5">
                Hammer the cluster with distributed errors to test LangGraph semantic clustering.
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              disabled={isStorming}
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none disabled:opacity-40 cursor-pointer"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (~{s.totalAlerts} alerts)
                </option>
              ))}
            </select>

            <button
              onClick={() => onTriggerStorm(selectedScenario, alertCount, speedMs)}
              disabled={isStorming}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg font-mono text-[11px] font-bold transition cursor-pointer ${
                isStorming
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-wait'
                  : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 border border-amber-500'
              }`}
            >
              {isStorming ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>INJECTING ({progressPercent}%)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>TRIGGER STORM</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="font-mono text-[11px] text-zinc-500 hover:text-amber-400 underline underline-offset-2 transition cursor-pointer"
            >
              {isExpanded ? 'Less' : 'Configure'}
            </button>
          </div>
        </div>

        {/* Storm progress */}
        {isStorming && (
          <div className="mt-4 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between font-mono text-[11px] mb-2">
              <span className="text-amber-400 font-bold flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-storm-blink inline-block" />
                <span>Injecting "{stormProgress.scenarioName}"…</span>
              </span>
              <span className="text-zinc-300 font-bold">
                {stormProgress.sentAlerts} / {stormProgress.totalAlerts} ({progressPercent}%)
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-100 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Expanded tuning */}
        {isExpanded && !isStorming && (
          <div className="mt-4 pt-3 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-[11px]">
            <div>
              <label className="text-zinc-500 font-semibold block mb-2 uppercase tracking-wider text-[10px]">Volume</label>
              <div className="flex items-center space-x-1.5">
                {[30, 60, 100, 150].map((count) => (
                  <button
                    key={count}
                    onClick={() => setAlertCount(count)}
                    className={`px-2.5 py-1 rounded border text-[10px] font-semibold transition cursor-pointer ${
                      alertCount === count
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-zinc-500 font-semibold block mb-2 uppercase tracking-wider text-[10px]">Frequency</label>
              <div className="flex items-center space-x-1.5">
                {[{ label: '20ms', val: 20 }, { label: '50ms', val: 50 }, { label: '120ms', val: 120 }].map((s) => (
                  <button
                    key={s.val}
                    onClick={() => setSpeedMs(s.val)}
                    className={`px-2.5 py-1 rounded border text-[10px] font-semibold transition cursor-pointer ${
                      speedMs === s.val
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-zinc-500 font-semibold block mb-2 uppercase tracking-wider text-[10px]">Expected Result</label>
              <div className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded text-[10px]">
                <span className="text-emerald-400 font-bold">{currentScenario?.expectedNoiseReduction}</span>
                {' → '}
                <span className="text-blue-400 font-bold">{currentScenario?.expectedIncidents} incident(s)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
