import React, { useState } from 'react';
import { GitFork, Layers, Bot, Slack, Activity, Zap, Terminal } from 'lucide-react';
import { LangGraphStepLog, User } from '../types';

interface LangGraphVisualizerProps {
  logs: LangGraphStepLog[];
  user: User | null;
  onUpdateSettings: (similarityThreshold: number, timeWindowMinutes: number, enableLangGraphTriage: boolean) => void;
}

export const LangGraphVisualizer: React.FC<LangGraphVisualizerProps> = ({
  logs,
  user,
  onUpdateSettings,
}) => {
  const [threshold, setThreshold] = useState<number>(user?.settings.similarityThreshold || 0.84);
  const [windowMinutes, setWindowMinutes] = useState<number>(user?.settings.timeWindowMinutes || 15);
  const [enableAgent, setEnableAgent] = useState<boolean>(user?.settings.enableLangGraphTriage !== false);
  const [selectedLog, setSelectedLog] = useState<LangGraphStepLog | null>(logs[0] || null);

  const nodes = [
    {
      id: 'ingest',
      tag: '__start__',
      name: 'Input Normalizer',
      description: 'Strips dynamic UUIDs, timestamps, and query hashes.',
      color: '#60a5fa',
    },
    {
      id: 'exact_match_check',
      tag: 'Fingerprint_Node',
      name: 'Exact Hash Fast-Path',
      description: 'O(1) signature deduplication in sliding window.',
      color: '#34d399',
    },
    {
      id: 'vector_embedding',
      tag: 'Vector_Node',
      name: 'Dense Embeddings',
      description: 'Generates semantic vectors with Gemini SDK.',
      color: '#c084fc',
    },
    {
      id: 'semantic_similarity',
      tag: 'Cosine_Node',
      name: 'Cosine Distance',
      description: 'Evaluates vector cosine distance & service topology.',
      color: '#7dd3fc',
    },
    {
      id: 'langgraph_borderline_arbitrator',
      tag: 'Arbitrator_Node',
      name: 'Gemini 3.7 Arbitrator',
      description: 'LLM reasoning on borderline (0.70–0.83 sim) alerts.',
      color: '#fbbf24',
    },
    {
      id: 'slack_gatekeeper',
      tag: 'Policy_Node',
      name: 'Slack Gatekeeper',
      description: 'Suppresses duplicate notifications to eliminate noise.',
      color: '#f87171',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Pipeline graph */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 bg-graticule overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
              State Machine Graph · LangGraph Topology
            </span>
            <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
              COMPILED
            </span>
          </div>
          <span className="font-mono text-[10px] text-zinc-600">6 NODES</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {nodes.map((node, index) => (
            <div
              key={node.id}
              className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[9px] font-bold italic uppercase" style={{ color: node.color }}>
                    {node.tag}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: node.color, boxShadow: `0 0 5px ${node.color}80` }} />
                </div>
                <div className="font-mono text-[11px] font-bold text-zinc-200">{node.name}</div>
                <div className="mt-1 font-mono text-[10px] text-zinc-600 leading-tight">{node.description}</div>
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-800 flex justify-between font-mono text-[9px] text-zinc-600">
                <span>NODE 0{index + 1}</span>
                <span className="text-emerald-400 font-bold">ACTIVE</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Inspector + Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inspector */}
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase block">
              Node Inspector & Tuning
            </span>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 font-mono text-xs">
              <div className="text-[11px] text-purple-400 font-semibold">current_node: "arbitrator_router"</div>

              <div className="space-y-2 pt-2 border-t border-zinc-800 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Cosine Threshold</span>
                  <span className="text-amber-400 font-bold">{(threshold * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min="0.70" max="0.95" step="0.01" value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full cursor-pointer" />

                <div className="flex justify-between items-center pt-1">
                  <span className="text-zinc-500">Time Window</span>
                  <span className="text-blue-400 font-bold">{windowMinutes} min</span>
                </div>
                <input type="range" min="5" max="60" step="5" value={windowMinutes}
                  onChange={(e) => setWindowMinutes(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer" />
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <label className="flex items-center space-x-2 cursor-pointer font-mono text-[11px] text-zinc-300">
                  <input type="checkbox" checked={enableAgent} onChange={(e) => setEnableAgent(e.target.checked)}
                    className="rounded border-zinc-600 bg-zinc-800 text-purple-500" />
                  <span>Gemini 3.7 Borderline Triage</span>
                </label>
              </div>

              <button
                onClick={() => onUpdateSettings(threshold, windowMinutes, enableAgent)}
                className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg font-mono text-[11px] font-bold transition cursor-pointer"
              >
                APPLY PARAMETERS
              </button>
            </div>
          </div>

          {/* State schema */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-500 uppercase block mb-2">
              LangGraph State Schema
            </span>
            <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-[10px] text-purple-300 whitespace-pre-wrap">
{`AlertState {
  raw_alert: NormalizedAlert,
  fingerprint_hash: str,
  dense_embedding: List[float],
  similarity_scores: Dict[str, float],
  arbitration_verdict: Optional[str],
  active_incident_id: str
}`}
            </pre>
          </div>
        </div>

        {/* Runtime logs */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
          <div className="bg-zinc-900 px-4 py-2.5 border-b border-zinc-800 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              <span className="font-condensed text-[11px] font-semibold tracking-widest text-zinc-400 uppercase">
                Runtime Logs · MERN + LangGraph Agent
              </span>
            </div>
            <span className="font-mono text-[10px] text-emerald-400 font-bold">SSE :3000</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2 max-h-[380px]">
            {logs.length === 0 ? (
              <div className="p-8 text-center font-mono text-[11px] text-zinc-600">
                No LangGraph runtime logs yet. Trigger an alert storm to observe state execution.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`p-2.5 rounded-lg border font-mono transition cursor-pointer ${
                    selectedLog?.id === log.id
                      ? 'bg-zinc-800 border-amber-500/30'
                      : 'bg-zinc-900/80 border-zinc-800 hover:bg-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 text-[10px] mb-1.5">
                    <span className="text-zinc-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className="text-amber-400 font-bold">[{log.service.toUpperCase()}]</span>
                    <span className="text-blue-400 font-semibold">{log.finalOutcome}</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] truncate mb-2">{log.message}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {log.steps.map((step, sIdx) => (
                      <span
                        key={sIdx}
                        className={`px-2 py-0.5 rounded font-mono text-[9px] font-semibold border ${
                          step.status === 'matched'
                            ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                            : step.status === 'invoked_gemini'
                            ? 'bg-purple-400/10 text-purple-400 border-purple-400/20'
                            : step.status === 'notified'
                            ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                        }`}
                      >
                        {step.node}: {step.status} ({step.durationMs}ms)
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
