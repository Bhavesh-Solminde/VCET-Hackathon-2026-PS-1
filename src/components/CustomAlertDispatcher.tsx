import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Severity } from '../types';

interface CustomAlertDispatcherProps {
  onSendAlert: (alert: { service: string; message: string; severity: Severity; stack?: string }) => Promise<any>;
}

export const CustomAlertDispatcher: React.FC<CustomAlertDispatcherProps> = ({ onSendAlert }) => {
  const [service, setService] = useState('checkout-api');
  const [severity, setSeverity] = useState<Severity>('critical');
  const [message, setMessage] = useState('Database connection pool exhausted: 100/100 active connections');
  const [stack, setStack] = useState('Error: ConnectionPoolExhausted\n    at Pool.acquire (/app/pg-pool/index.js:312:11)\n    at CheckoutController.createOrder (/app/controllers/checkout.js:42:18)');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const presets = [
    {
      label: 'PostgreSQL Pool Starvation',
      service: 'checkout-api',
      severity: 'critical' as Severity,
      message: 'Knex: Timeout acquiring a connection. The pool is probably full. [req_id=' + Math.random().toString(36).substring(7) + ']',
      stack: 'KnexTimeoutError: Timeout acquiring a connection\n    at Client_PG.acquireConnection (/app/node_modules/knex/lib/client.js:312:26)',
    },
    {
      label: 'PostgreSQL 504 (Inventory)',
      service: 'inventory-service',
      severity: 'high' as Severity,
      message: 'SequelizeConnectionAcquireTimeoutError: Operation timeout exceeded 10000ms',
      stack: 'SequelizeConnectionAcquireTimeoutError: Operation timeout exceeded\n    at ConnectionManager.getConnection',
    },
    {
      label: 'Stripe Gateway Timeout',
      service: 'billing-service',
      severity: 'high' as Severity,
      message: 'Stripe API Error (POST /v1/payment_intents): Request timed out after 30000ms',
      stack: 'StripeConnectionError: Request timed out\n    at Request.callback (/app/node_modules/stripe/lib/StripeResource.js:142:15)',
    },
    {
      label: 'Redis Session Cache OOM',
      service: 'auth-service',
      severity: 'medium' as Severity,
      message: 'OOM command not allowed when used memory > maxmemory on session-cache-02',
      stack: 'RedisError: OOM command not allowed\n    at RedisClient.execute (/app/node_modules/ioredis/lib/redis.js:88:12)',
    },
  ];

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSending(true);
    setResult(null);
    try {
      const res = await onSendAlert({ service, message, severity, stack: stack.trim() ? stack : undefined });
      setResult({ success: true, data: res });
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const applyPreset = (preset: typeof presets[0]) => {
    setService(preset.service);
    setSeverity(preset.severity);
    setMessage(preset.message);
    setStack(preset.stack);
  };

  const inputClass = 'w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg font-mono text-[11px] text-zinc-200 placeholder-zinc-600';
  const labelClass = 'font-condensed text-[10px] font-semibold tracking-widest text-zinc-500 uppercase block mb-1.5';

  return (
    <div className="space-y-4 max-w-4xl mx-auto font-mono">
      {/* Preset buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-condensed text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">Presets:</span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 font-mono text-[10px] text-zinc-300 transition cursor-pointer font-semibold"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleDispatch} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className={labelClass}>Service / Origin</label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. checkout-api"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Severity Level</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="critical">Critical (P1 Outage)</option>
              <option value="high">High (P2 Degradation)</option>
              <option value="medium">Medium (P3 Warning)</option>
              <option value="low">Low (P4 Informational)</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Log Message</label>
          <textarea
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Error message…"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Stack Trace (Optional)</label>
          <textarea
            rows={2}
            value={stack}
            onChange={(e) => setStack(e.target.value)}
            placeholder="Stack trace…"
            className={`${inputClass} text-[10px] text-zinc-400`}
          />
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 rounded-xl font-mono text-[11px] font-bold flex items-center justify-center space-x-2 transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{isSending ? 'EVALUATING VIA LANGGRAPH…' : 'DISPATCH ALERT TO PIPELINE'}</span>
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-xl border font-mono text-xs space-y-3 ${
          result.success ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-red-400/5 border-red-400/20'
        }`}>
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-[11px]">
            <CheckCircle2 className="w-4 h-4" />
            <span>ALERT EVALUATED VIA LANGGRAPH ENGINE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700">
              <span className="text-zinc-500 block mb-0.5">Incident ID</span>
              <span className="text-blue-400 font-bold">#{result.data?.incidentId?.slice(0, 16)}</span>
            </div>
            <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700">
              <span className="text-zinc-500 block mb-0.5">Grouping Outcome</span>
              <span className={result.data?.grouped ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {result.data?.grouped ? 'Deduplicated (Joined Bucket)' : 'New Incident Created'}
              </span>
            </div>
            <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700">
              <span className="text-zinc-500 block mb-0.5">Cosine Similarity</span>
              <span className="text-zinc-200 font-bold">{(result.data?.similarityScore * 100).toFixed(1)}%</span>
            </div>
            <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700">
              <span className="text-zinc-500 block mb-0.5">Notification</span>
              <span className="text-purple-400 font-bold">
                {result.data?.slackNotified ? 'Dispatched to Slack' : 'Suppressed (Fatigue Saved)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
