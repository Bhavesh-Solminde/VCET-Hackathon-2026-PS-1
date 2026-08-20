import React, { useState } from 'react';
import { Slack, Send, Check, ShieldCheck } from 'lucide-react';
import { SlackMessageRecord, User } from '../types';

interface SlackSimulatorProps {
  messages: SlackMessageRecord[];
  user: User | null;
  onSaveWebhook: (webhookUrl: string) => Promise<boolean>;
}

export const SlackSimulator: React.FC<SlackSimulatorProps> = ({ messages, user, onSaveWebhook }) => {
  const [webhookUrl, setWebhookUrl] = useState<string>(user?.slackWebhookUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await onSaveWebhook(webhookUrl);
    setIsSaving(false);
    if (ok) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Webhook settings */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Slack className="w-4 h-4 text-emerald-400" />
              <span className="font-condensed text-sm font-bold text-zinc-200 uppercase tracking-wide">
                Slack Webhook Integration
              </span>
            </div>
            <p className="font-mono text-[11px] text-zinc-500">
              Forward consolidated LangGraph incidents to your production Slack channel.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto font-mono">
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/…"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full md:w-80 px-3 py-1.5 bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-300 placeholder-zinc-600 rounded-lg"
            />
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer transition"
            >
              {savedSuccess ? (
                <><Check className="w-3.5 h-3.5" /><span>VERIFIED!</span></>
              ) : (
                <><Send className="w-3.5 h-3.5" /><span>{isSaving ? 'TESTING…' : 'SAVE & TEST PING'}</span></>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Slack channel simulator */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Channel header */}
        <div className="bg-zinc-800 border-b border-zinc-700 px-4 py-2.5 flex items-center justify-between font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="text-zinc-500 font-bold text-xs">#</span>
            <span className="font-bold text-xs text-zinc-200">alerts-production</span>
            <span className="text-[10px] text-zinc-600">· Consolidated Incidents Only</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 5px rgba(52,211,153,0.5)' }} />
            <span>AlertGuard Bot connected</span>
          </div>
        </div>

        {/* Messages */}
        <div className="p-4 space-y-3.5 max-h-[450px] overflow-y-auto font-mono text-[11px]">
          {messages.length === 0 ? (
            <div className="p-8 text-center text-zinc-600">
              No Slack notifications dispatched yet. Trigger an alert storm to observe output.
            </div>
          ) : (
            messages.map((msg) => {
              const isCritical = msg.severity === 'critical';
              return (
                <div key={msg.id} className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                    <Slack className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-baseline space-x-2">
                      <span className="font-bold text-xs text-zinc-200">AlertGuard Bot</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-700 text-zinc-400 border border-zinc-600 font-bold">APP</span>
                      <span className="text-[10px] text-zinc-600">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className={`p-3.5 rounded-xl border space-y-2.5 ${
                      isCritical
                        ? 'bg-red-400/5 border-red-400/20'
                        : 'bg-zinc-800 border-zinc-700'
                    }`}>
                      <div className="flex items-center space-x-1.5 font-bold text-xs">
                        <span className={isCritical ? 'text-red-400' : 'text-amber-400'}>
                          {msg.isEscalation ? '[ESCALATION]' : '[INCIDENT DETECTED]'}
                        </span>
                        <span className="text-zinc-300 truncate">{msg.incidentTitle}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                          <span className="text-zinc-600 block text-[9px]">Severity</span>
                          <span className={`font-bold ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                            {msg.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                          <span className="text-zinc-600 block text-[9px]">Collapsed</span>
                          <span className="font-bold text-blue-400">{msg.alertCount}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 sm:col-span-2">
                          <span className="text-zinc-600 block text-[9px]">Services</span>
                          <span className="text-zinc-300 font-bold truncate block">{msg.services.join(', ')}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-zinc-700/50 flex items-center justify-between text-[10px] text-zinc-600">
                        <span className="flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{msg.status === 'delivered' ? 'Live webhook delivered' : 'Simulated locally'}</span>
                        </span>
                        <span className="font-mono text-zinc-700">#{msg.incidentId.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
