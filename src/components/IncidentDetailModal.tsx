import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  Server,
  GitFork,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Incident, Alert, Severity } from '../types';

interface IncidentDetailModalProps {
  incident: Incident | null;
  alerts: Alert[];
  onClose: () => void;
  onResolve: (id: string) => void;
}

const severityStyle = (severity: Severity) => {
  const map: Record<Severity, string> = {
    critical: 'text-red-400 bg-red-400/10 border-red-400/25',
    high: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
    low: 'text-blue-400 bg-blue-400/10 border-blue-400/25',
  };
  return map[severity] || map.low;
};

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  alerts,
  onClose,
  onResolve,
}) => {
  const [activeTab, setActiveTab] = useState<'root_cause' | 'alerts' | 'agent_trace'>('root_cause');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  if (!incident) return null;

  const isResolved = incident.status === 'resolved';

  const tabs = [
    { id: 'root_cause', label: 'AI ROOT CAUSE', icon: Sparkles },
    { id: 'alerts', label: `ALERTS (${alerts.length || incident.alertCount})`, icon: FileText },
    { id: 'agent_trace', label: 'LANGGRAPH TRACE', icon: GitFork },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl my-6 animate-fade-in-up">
        {/* Modal header */}
        <div className="p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${severityStyle(incident.severity)}`}>
                {incident.severity.toUpperCase()}
              </span>
              <span className="px-2.5 py-0.5 rounded font-mono text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                {incident.alertCount} ALERTS COLLAPSED
              </span>
              <span className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                isResolved ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/25'
              }`}>
                {isResolved ? 'RESOLVED' : 'ACTIVE OUTAGE'}
              </span>
            </div>
            <h2 className="font-mono text-base sm:text-lg font-bold text-zinc-100 tracking-tight">
              {incident.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-600">
              <span>FIRST: {new Date(incident.firstSeenAt).toLocaleTimeString()}</span>
              <span>·</span>
              <span>LAST: {new Date(incident.lastSeenAt).toLocaleTimeString()}</span>
              <span>·</span>
              <span>ID #{incident._id.slice(0, 12)}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {!isResolved && (
              <button
                onClick={() => onResolve(incident._id)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono text-[11px] font-bold transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>RESOLVE</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50 px-5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center space-x-1.5 py-2.5 px-4 font-mono text-[11px] font-bold border-b-2 transition cursor-pointer ${
                activeTab === id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 max-h-[55vh] overflow-y-auto space-y-4 font-mono text-xs">
          {activeTab === 'root_cause' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-400/5 border border-purple-400/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-purple-400 font-bold text-[11px]">
                    <Sparkles className="w-4 h-4" />
                    <span>SYNTHESIZED ROOT CAUSE</span>
                  </div>
                  {incident.rootCauseAnalysis && (
                    <span className="font-mono text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                      {(incident.rootCauseAnalysis.confidenceScore * 100).toFixed(0)}% CONFIDENCE
                    </span>
                  )}
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  {incident.rootCauseAnalysis?.summary || incident.representativeMessage}
                </p>
                {incident.rootCauseAnalysis?.probableRootCause && (
                  <div className="pt-2 border-t border-purple-400/15">
                    <span className="text-[10px] text-purple-400 font-bold block mb-1.5">PROBABLE ROOT CAUSE</span>
                    <p className="text-[11px] text-zinc-200 bg-zinc-950 p-3 rounded-lg border border-zinc-700 font-medium">
                      {incident.rootCauseAnalysis.probableRootCause}
                    </p>
                  </div>
                )}
              </div>

              {incident.rootCauseAnalysis?.recommendedAction && (
                <div className="p-4 rounded-xl bg-emerald-400/5 border border-emerald-400/20 space-y-2">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-[11px]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>ON-CALL RUNBOOK</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-700">
                    {incident.rootCauseAnalysis.recommendedAction}
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center space-x-1.5 text-zinc-500 font-bold text-[10px] uppercase mb-2">
                  <Server className="w-3.5 h-3.5" />
                  <span>Affected Services</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {incident.services.map((svc) => (
                    <span key={svc} className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold text-[10px]">
                      {svc}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 text-[11px] text-zinc-500 font-semibold">
                <span>SHOWING {alerts.length} COLLAPSED ERRORS</span>
                <span className="text-emerald-400 font-bold">DEDUPLICATION ACTIVE</span>
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {alerts.map((alt) => {
                  const expanded = expandedAlertId === alt._id;
                  return (
                    <div key={alt._id} className="p-3 rounded-xl bg-zinc-800 border border-zinc-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center space-x-2 text-[10px]">
                            <span className="text-blue-400 font-bold">{alt.service}</span>
                            <span className="text-zinc-600">{new Date(alt.createdAt).toLocaleTimeString()}</span>
                            {alt.similarityScore && (
                              <span className="text-emerald-400 font-bold">
                                Match: {(alt.similarityScore * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-300 break-all">{alt.message}</p>
                        </div>
                        {alt.stack && (
                          <button
                            onClick={() => setExpandedAlertId(expanded ? null : alt._id)}
                            className="p-1 text-zinc-600 hover:text-zinc-300 cursor-pointer"
                          >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                      {expanded && alt.stack && (
                        <div className="mt-2 pt-2 border-t border-zinc-700">
                          <pre className="p-2 bg-zinc-950 text-zinc-300 rounded-lg text-[10px] overflow-x-auto whitespace-pre">
                            {alt.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'agent_trace' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-purple-400/5 border border-purple-400/20 space-y-3">
                <div className="flex items-center space-x-1.5 text-purple-400 font-bold text-[11px]">
                  <GitFork className="w-4 h-4" />
                  <span>LANGGRAPH STATE MACHINE DECISION</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-700">
                    <span className="text-zinc-500 font-medium block mb-0.5">Strategy</span>
                    <span className="font-bold text-zinc-200">{incident.agentTrace?.matchType || 'Semantic Cosine'}</span>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-700">
                    <span className="text-zinc-500 font-medium block mb-0.5">Cosine Score</span>
                    <span className="font-bold text-emerald-400">
                      {incident.agentTrace?.cosineScore ? `${(incident.agentTrace.cosineScore * 100).toFixed(1)}%` : '100%'}
                    </span>
                  </div>
                </div>
                {incident.agentTrace?.decisionExplanation && (
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold block mb-1.5 uppercase">Agent Justification</span>
                    <p className="text-[11px] text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-700">
                      {incident.agentTrace.decisionExplanation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between font-mono text-[11px] text-zinc-600">
          <span>ALERTGUARD LANGGRAPH ENGINE · {incident.alertCount - 1} REDUNDANT PINGS SUPPRESSED</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold cursor-pointer transition"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
