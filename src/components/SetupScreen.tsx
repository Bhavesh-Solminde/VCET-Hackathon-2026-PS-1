import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Zap,
  Layers,
  BellOff,
} from 'lucide-react';
import { User } from '../types';

interface SetupScreenProps {
  user: User | null;
  onEnterDashboard: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ user, onEnterDashboard }) => {
  const [apiKey, setApiKey] = useState<string>(user?.apiKey || '');
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (user?.apiKey && !apiKey) setApiKey(user.apiKey);
  }, [user?.apiKey]);

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch('/api/auth/regenerate-key', { method: 'POST' });
      const data = await res.json();
      if (data.apiKey) setApiKey(data.apiKey);
    } catch (err) {
      console.error('Failed to regenerate key:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const sdkSnippet = `const { AlertGuard } = require('alertguard-sdk');
const guard = new AlertGuard({ apiKey: '${apiKey || 'ag_live_…'}' });

// Auto-catch Express errors
app.use(guard.expressErrorHandler());`;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Minimal header */}
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-3 flex items-center space-x-2.5">
        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
        </div>
        <span className="font-condensed text-base font-bold tracking-widest text-zinc-100 uppercase">
          AlertGuard
        </span>
        <span className="font-mono text-[10px] text-zinc-600 ml-1">v2.4.1</span>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* Hero */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-mono text-[11px] font-bold text-amber-400 tracking-wider">
                MERN + LANGGRAPH · VCET HACKATHON
              </span>
            </div>

            <h1 className="font-condensed text-4xl sm:text-5xl font-bold text-zinc-100 tracking-tight leading-tight">
              Stop drowning in{' '}
              <span className="text-amber-400">500 alerts</span>.
              <br />
              See{' '}
              <span className="text-emerald-400">3 incidents</span>.
            </h1>

            <p className="font-sans text-zinc-400 text-base max-w-lg mx-auto leading-relaxed">
              AlertGuard uses LangChain embeddings and a LangGraph agent to semantically
              collapse your noisy alert flood into meaningful, actionable incidents.
            </p>
          </div>

          {/* Feature row */}
          <div className="grid grid-cols-3 gap-3 font-mono text-[11px]">
            {[
              { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', label: 'Exact-match dedup', sub: 'O(1) fingerprint fast-path' },
              { icon: Layers, color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', label: 'Semantic grouping', sub: 'LangChain + Gemini embeddings' },
              { icon: BellOff, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', label: 'Noise suppression', sub: 'Slack only on new incidents' },
            ].map(({ icon: Icon, color, bg, label, sub }) => (
              <div key={label} className={`p-3 rounded-xl border ${bg} text-center`}>
                <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
                <div className={`font-semibold ${color} text-[10px]`}>{label}</div>
                <div className="text-zinc-600 text-[10px] mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* API key card */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-700 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="font-condensed text-sm font-bold text-zinc-200 uppercase tracking-wide">
                Your API Key
              </span>
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 font-bold">
                READY TO USE
              </span>
            </div>

            <div className="p-5 space-y-4">
              <p className="font-mono text-[11px] text-zinc-500">
                Use this key to authenticate your SDK and send alerts to the grouping pipeline.
              </p>

              {/* Key display */}
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 font-mono text-sm text-amber-400 font-bold tracking-wide overflow-x-auto whitespace-nowrap no-scrollbar">
                  {apiKey || 'Generating…'}
                </div>
                <button
                  onClick={handleCopy}
                  title="Copy API Key"
                  className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  title="Regenerate API Key"
                  className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition cursor-pointer disabled:opacity-40 shrink-0"
                >
                  <RefreshCw className={`w-5 h-5 ${isRegenerating ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* SDK snippet */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-[11px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-condensed text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                    Quick Integration
                  </span>
                  <span className="text-zinc-700 text-[10px]">npm install alertguard-sdk</span>
                </div>
                <pre className="text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {sdkSnippet}
                </pre>
              </div>

              {/* CTA */}
              <button
                onClick={onEnterDashboard}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-condensed text-base font-bold tracking-wide flex items-center justify-center space-x-2.5 transition cursor-pointer"
              >
                <span>LAUNCH INCIDENT DASHBOARD</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <p className="font-mono text-[10px] text-zinc-700 text-center">
                Full incident command center · Live storm simulator · LangGraph pipeline visualizer
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-3 text-center">
        <p className="font-condensed text-[11px] tracking-widest text-zinc-700 uppercase">
          AlertGuard · MERN + LangChain + LangGraph · VCET Hackathon
        </p>
      </footer>
    </div>
  );
};
