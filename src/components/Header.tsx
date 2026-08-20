import React, { useState } from 'react';
import {
  ShieldAlert,
  Activity,
  Terminal,
  Slack,
  GitFork,
  BarChart3,
  Send,
  Copy,
  Check,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { User, StatsResponse } from '../types';

interface HeaderProps {
  activeTab: 'incidents' | 'langgraph' | 'sdk' | 'slack' | 'custom' | 'analytics';
  setActiveTab: (tab: 'incidents' | 'langgraph' | 'sdk' | 'slack' | 'custom' | 'analytics') => void;
  user: User | null;
  stats: StatsResponse | null;
  isConnected: boolean;
  isStorming: boolean;
  onResetDb: () => void;
}

const tabs = [
  { id: 'incidents', label: 'INCIDENT COMMAND', icon: Activity },
  { id: 'langgraph', label: 'LANGGRAPH PIPELINE', icon: GitFork },
  { id: 'sdk', label: 'NODE.JS SDK', icon: Terminal },
  { id: 'slack', label: 'SLACK GATEKEEPER', icon: Slack },
  { id: 'custom', label: 'ALERT DISPATCHER', icon: Send },
  { id: 'analytics', label: 'NOISE TELEMETRY', icon: BarChart3 },
] as const;

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  user,
  stats,
  isConnected,
  isStorming,
  onResetDb,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = () => {
    if (user?.apiKey) {
      navigator.clipboard.writeText(user.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-900 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between h-13 py-2.5">
          {/* Wordmark */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-condensed text-base font-bold tracking-widest text-zinc-100 uppercase">
                AlertGuard
              </span>
            </div>

            <div className="h-4 w-px bg-zinc-700 hidden sm:block" />

            <div className="hidden md:flex items-center space-x-2">
              <span className="font-mono text-[10px] font-semibold text-zinc-500 px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800/50">
                MERN+LANGGRAPH
              </span>
              <span className="font-mono text-[10px] text-zinc-600">v2.4.1</span>
            </div>
          </div>

          {/* Right: status + actions */}
          <div className="flex items-center space-x-2">
            {/* Live NRR badge */}
            {stats && (
              <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="font-mono text-[10px] font-bold text-amber-400">
                  {stats.noiseReductionPercent}% NOISE REDUCED
                </span>
              </div>
            )}

            {/* Storm indicator */}
            {isStorming && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-storm-blink" />
                <span className="font-mono text-[10px] font-bold text-red-400">STORM ACTIVE</span>
              </div>
            )}

            {/* Connection dot */}
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={isConnected ? { boxShadow: '0 0 6px rgba(52,211,153,0.6)' } : {}}
              />
              <span className="font-mono text-[10px] text-zinc-500 hidden sm:block">
                {isConnected ? 'LIVE' : 'POLLING'}
              </span>
            </div>

            {/* API key */}
            {user?.apiKey && (
              <button
                onClick={handleCopyKey}
                title="Copy API Key"
                className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-mono text-[10px] text-zinc-400 transition cursor-pointer"
              >
                <code className="text-blue-400 font-semibold">
                  {user.apiKey.slice(0, 8)}…{user.apiKey.slice(-3)}
                </code>
                {copiedKey
                  ? <Check className="w-3 h-3 text-emerald-400" />
                  : <Copy className="w-3 h-3 text-zinc-500" />
                }
              </button>
            )}

            {/* Reset */}
            <button
              onClick={onResetDb}
              title="Reset Sample Data"
              className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="flex space-x-0.5 overflow-x-auto no-scrollbar pb-0">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as typeof activeTab)}
                className={`flex items-center space-x-1.5 px-3 py-2.5 text-[11px] font-condensed font-semibold tracking-wider transition whitespace-nowrap cursor-pointer border-b-2 ${
                  active
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {id === 'incidents' && stats && stats.activeIncidentsCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-mono text-[9px] font-bold">
                    {stats.activeIncidentsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
