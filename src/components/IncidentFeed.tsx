import React, { useState } from 'react';
import {
  Layers,
  ListTree,
  Search,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { Incident, Alert, Severity } from '../types';

interface IncidentFeedProps {
  incidents: Incident[];
  rawAlerts: Alert[];
  onSelectIncident: (incident: Incident) => void;
  onResolveIncident: (id: string, e: React.MouseEvent) => void;
}

const severityDot = (severity: Severity, resolved?: boolean) => {
  if (resolved) return <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />;
  switch (severity) {
    case 'critical':
      return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" style={{ boxShadow: '0 0 5px rgba(248,113,113,0.5)' }} />;
    case 'high':
      return <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />;
    case 'medium':
      return <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />;
    default:
      return <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />;
  }
};

const severityLabel = (severity: Severity) => {
  const map: Record<Severity, string> = {
    critical: 'text-red-400 bg-red-400/10 border-red-400/20',
    high: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    low: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  };
  return map[severity] || map.low;
};

const timeAgo = (isoString: string) => {
  const diff = Math.max(0, Date.now() - new Date(isoString).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
};

export const IncidentFeed: React.FC<IncidentFeedProps> = ({
  incidents,
  rawAlerts,
  onSelectIncident,
  onResolveIncident,
}) => {
  const [viewMode, setViewMode] = useState<'grouped' | 'raw'>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  const allServices = Array.from(new Set(incidents.flatMap((i) => i.services))).sort();

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
    if (serviceFilter !== 'all' && !inc.services.includes(serviceFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.representativeMessage.toLowerCase().includes(q) ||
        inc.services.some((s) => s.toLowerCase().includes(q)) ||
        inc.rootCauseAnalysis?.probableRootCause?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredAlerts = rawAlerts.filter((a) => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (serviceFilter !== 'all' && a.service !== serviceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.message.toLowerCase().includes(q) || a.service.toLowerCase().includes(q);
    }
    return true;
  });

  const selectStyle = 'bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer';

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* View mode toggle */}
        <div className="flex items-center p-0.5 bg-zinc-800 border border-zinc-700 rounded-lg shrink-0 self-start">
          <button
            onClick={() => setViewMode('grouped')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold transition cursor-pointer ${
              viewMode === 'grouped' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>GROUPED ({incidents.length})</span>
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold transition cursor-pointer ${
              viewMode === 'raw' ? 'bg-red-500/80 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>RAW FLOOD ({rawAlerts.length})</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter errors, services…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg font-mono text-[11px] text-zinc-300 placeholder-zinc-600"
            />
          </div>
          {viewMode === 'grouped' && (
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectStyle}>
              <option value="all">Status: ALL</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
            </select>
          )}
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className={selectStyle}>
            <option value="all">Severity: ALL</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className={selectStyle}>
            <option value="all">Service: ALL</option>
            {allServices.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Grouped view */}
      {viewMode === 'grouped' ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          {filteredIncidents.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldAlert className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="font-condensed text-sm font-semibold text-zinc-600 uppercase tracking-wide">No Incidents Found</p>
              <p className="font-mono text-[11px] text-zinc-700 mt-1">
                Trigger an alert storm above to test live semantic grouping.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {filteredIncidents.map((incident) => {
                const isResolved = incident.status === 'resolved';

                return (
                  <div
                    key={incident._id}
                    onClick={() => onSelectIncident(incident)}
                    className={`group px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isResolved
                        ? 'hover:bg-zinc-800/40 opacity-60 hover:opacity-80'
                        : incident.severity === 'critical'
                        ? 'hover:bg-red-500/5 border-l-2 border-l-red-500/50'
                        : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Left */}
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className="pt-1 shrink-0">
                        {severityDot(incident.severity, isResolved)}
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold border ${severityLabel(incident.severity)}`}>
                            {incident.severity.toUpperCase()}
                          </span>

                          <span className="px-2 py-0.5 rounded font-mono text-[9px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {incident.alertCount}× COLLAPSED
                          </span>

                          <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-semibold flex items-center space-x-1 ${
                            isResolved
                              ? 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                              : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isResolved ? 'bg-zinc-500' : 'bg-emerald-400 animate-pulse'}`} />
                            <span>{isResolved ? 'RESOLVED' : 'ACTIVE'}</span>
                          </span>

                          {incident.agentTrace && (
                            <span className="hidden md:inline-flex px-2 py-0.5 rounded font-mono text-[9px] font-semibold bg-purple-400/10 text-purple-400 border border-purple-400/20">
                              {incident.agentTrace.matchType === 'exact_hash'
                                ? 'EXACT HASH'
                                : incident.agentTrace.matchType === 'langgraph_borderline_arbitration'
                                ? 'LANGGRAPH ARB'
                                : `COSINE ${(incident.agentTrace.cosineScore * 100).toFixed(0)}%`}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="font-mono text-sm font-semibold text-zinc-200 group-hover:text-zinc-100 transition truncate">
                          {incident.title}
                        </h4>

                        {/* AI root cause */}
                        {incident.rootCauseAnalysis && (
                          <div className="flex items-start space-x-1.5 font-mono text-[11px] text-zinc-500">
                            <Sparkles className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                            <span className="truncate">{incident.rootCauseAnalysis.probableRootCause}</span>
                          </div>
                        )}

                        {/* Services + time */}
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                          {incident.services.slice(0, 3).map((svc) => (
                            <span key={svc} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                              {svc}
                            </span>
                          ))}
                          {incident.services.length > 3 && (
                            <span className="text-zinc-600">+{incident.services.length - 3}</span>
                          )}
                          <span className="text-zinc-700">·</span>
                          <span className="text-zinc-600">{timeAgo(incident.lastSeenAt)} ago</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectIncident(incident); }}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-mono text-[11px] font-semibold text-zinc-300 transition cursor-pointer"
                      >
                        <span>DRILL DOWN</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {!isResolved && (
                        <button
                          onClick={(e) => onResolveIncident(incident._id, e)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg font-mono text-[10px] font-semibold text-emerald-400 hover:bg-emerald-400/10 border border-emerald-400/20 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>RESOLVE</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Raw flood view */
        <div className="space-y-3">
          <div className="flex items-center space-x-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 font-mono text-[11px] text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              <strong>UN-GROUPED RAW STREAM</strong> — the full alert flood before AlertGuard collapses it.
            </span>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden max-h-[500px] overflow-y-auto divide-y divide-zinc-800">
            {filteredAlerts.map((alert) => (
              <div key={alert._id} className="px-4 py-2.5 hover:bg-zinc-800/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center space-x-2 font-mono text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      alert.severity === 'critical' ? 'bg-red-500/10 text-red-400'
                      : alert.severity === 'high' ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="text-blue-400 font-semibold">{alert.service}</span>
                    <span className="text-zinc-600">{timeAgo(alert.createdAt)} ago</span>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-400 truncate">{alert.message}</p>
                </div>
                <div className="flex items-center space-x-2 font-mono text-[10px] shrink-0">
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                    #{alert.incidentId.slice(0, 10)}
                  </span>
                  {alert.similarityScore && (
                    <span className="text-emerald-400 font-bold">
                      {(alert.similarityScore * 100).toFixed(0)}% sim
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
