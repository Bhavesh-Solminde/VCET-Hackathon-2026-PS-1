import React, { useState } from 'react';
import { Copy, Check, Play, Server, CheckCircle2 } from 'lucide-react';
import { User, Severity } from '../types';

interface SdkIntegrationHubProps {
  user: User | null;
  onSendAlert: (alert: { service: string; message: string; severity: Severity; stack?: string }) => Promise<any>;
}

export const SdkIntegrationHub: React.FC<SdkIntegrationHubProps> = ({ user, onSendAlert }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sandboxRoute, setSandboxRoute] = useState<string>('checkout');
  const [isFiringSandbox, setIsFiringSandbox] = useState<boolean>(false);
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);

  const apiKey = user?.apiKey || 'ag_live_7e8b24901f4c4a169b';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const expressSnippet = `// 1. Install SDK: npm install alertguard-sdk
const express = require('express');
const { AlertGuard } = require('alertguard-sdk');

const app = express();
const guard = new AlertGuard({
  apiKey: '${apiKey}',
  serviceName: 'checkout-api' // Auto-tags all errors
});

// Auto-catch unhandled rejections & crashes
guard.captureUnhandled();

app.get('/checkout', (req, res) => {
  throw new Error('Payment gateway timeout on Stripe endpoint');
});

// Zero-config Express error middleware
app.use(guard.expressErrorHandler());

app.listen(3000);`;

  const manualNotifySnippet = `// Manual error reporting anywhere in your backend
const { AlertGuard } = require('alertguard-sdk');
const guard = new AlertGuard({ apiKey: '${apiKey}' });

try {
  await database.query('SELECT * FROM orders');
} catch (err) {
  await guard.notify({
    service: 'order-processor',
    message: err.message,
    severity: 'critical',
    stack: err.stack,
  });
}`;

  const routes = [
    { id: 'checkout', label: 'GET /api/checkout', err: 'Payment gateway timeout on Stripe', svc: 'checkout-api' },
    { id: 'db', label: 'POST /api/orders/submit', err: 'SequelizeConnectionAcquireTimeoutError: DB pool full', svc: 'order-processor' },
    { id: 'redis', label: 'GET /api/auth/session', err: 'RedisConnectionError: OOM memory exceeded', svc: 'auth-service' },
  ];

  const handleTestSandbox = async () => {
    setIsFiringSandbox(true);
    setSandboxResult(null);
    let payload: { service: string; message: string; severity: Severity; stack?: string } = {
      service: 'checkout-api',
      message: 'Payment gateway timeout on Stripe endpoint [req_id=' + Math.random().toString(36).substring(7) + ']',
      severity: 'high',
      stack: 'Error: Payment gateway timeout\n    at /app/routes/checkout.js:42:15',
    };
    if (sandboxRoute === 'db') {
      payload = {
        service: 'order-processor',
        message: 'SequelizeConnectionAcquireTimeoutError: Database pool exhausted (100/100)',
        severity: 'critical',
        stack: 'SequelizeConnectionAcquireTimeoutError: Timeout acquiring client\n    at Pool.acquire',
      };
    } else if (sandboxRoute === 'redis') {
      payload = {
        service: 'auth-service',
        message: 'RedisConnectionError: OOM command not allowed when used memory > maxmemory',
        severity: 'medium',
        stack: 'RedisError: OOM command not allowed\n    at RedisClient.execute',
      };
    }
    try {
      const res = await onSendAlert(payload);
      setSandboxResult({ success: true, data: res, payload });
    } catch (err: any) {
      setSandboxResult({ success: false, error: err.message });
    } finally {
      setIsFiringSandbox(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Code snippets */}
        <div className="space-y-4 font-mono">
          {/* Install */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase block mb-2">
              1. NPM Installation
            </span>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs">
              <code className="text-blue-400 font-semibold">npm install alertguard-sdk</code>
              <button
                onClick={() => copyToClipboard('npm install alertguard-sdk', 'npm')}
                className="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer transition"
              >
                {copiedCode === 'npm' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Express snippet */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
                2. Express Middleware Integration
              </span>
              <button
                onClick={() => copyToClipboard(expressSnippet, 'express')}
                className="flex items-center space-x-1 font-mono text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                {copiedCode === 'express' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>COPY</span>
              </button>
            </div>
            <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-[10px] text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
              {expressSnippet}
            </pre>
          </div>

          {/* Manual notify snippet */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
                3. Manual guard.notify()
              </span>
              <button
                onClick={() => copyToClipboard(manualNotifySnippet, 'manual')}
                className="flex items-center space-x-1 font-mono text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                {copiedCode === 'manual' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>COPY</span>
              </button>
            </div>
            <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-[10px] text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
              {manualNotifySnippet}
            </pre>
          </div>
        </div>

        {/* Live sandbox */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4 font-mono">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span className="font-condensed text-sm font-bold text-zinc-200 uppercase tracking-wide">
                Interactive Express Sandbox
              </span>
            </div>
            <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
              ACTIVE AGENT
            </span>
          </div>

          <p className="font-mono text-[11px] text-zinc-500">
            Execute simulated route errors to see the Express error handler catch and deduplicate them in real time.
          </p>

          <div className="space-y-2">
            {routes.map((r) => (
              <div
                key={r.id}
                onClick={() => setSandboxRoute(r.id)}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                  sandboxRoute === r.id
                    ? 'bg-amber-500/8 border-amber-500/30 text-zinc-200'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <div>
                  <span className="font-bold block font-mono text-xs text-zinc-200">{r.label}</span>
                  <span className="text-[10px] text-zinc-600">{r.err}</span>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 border border-zinc-600">
                  {r.svc}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleTestSandbox}
            disabled={isFiringSandbox}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 rounded-xl font-mono text-[11px] font-bold flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isFiringSandbox ? 'INTERCEPTING ERROR…' : 'EXECUTE ROUTE & INTERCEPT'}</span>
          </button>

          {sandboxResult && (
            <div className={`p-4 rounded-xl border font-mono text-xs space-y-2 ${
              sandboxResult.success ? 'bg-emerald-400/5 border-emerald-400/20' : 'bg-red-400/5 border-red-400/20'
            }`}>
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-[11px]">
                <CheckCircle2 className="w-4 h-4" />
                <span>SDK INTERCEPTED & DEDUPLICATED VIA LANGGRAPH</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div><span className="text-zinc-500">Incident ID:</span> <span className="text-blue-400">#{sandboxResult.data?.incidentId?.slice(0, 16)}</span></div>
                <div><span className="text-zinc-500">Title:</span> <span className="text-zinc-300">{sandboxResult.data?.incidentTitle}</span></div>
                <div>
                  <span className="text-zinc-500">Deduplicated:</span>{' '}
                  <span className={sandboxResult.data?.grouped ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {sandboxResult.data?.grouped ? 'YES — Notification Suppressed' : 'NO — New Incident Created'}
                  </span>
                </div>
                <div><span className="text-zinc-500">Noise Reduction:</span> <span className="text-emerald-400 font-bold">{sandboxResult.data?.noiseReductionPercent}%</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
