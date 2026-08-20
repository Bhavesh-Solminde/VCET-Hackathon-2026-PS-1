import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { StormBanner } from './components/StormBanner';
import { IncidentFeed } from './components/IncidentFeed';
import { IncidentDetailModal } from './components/IncidentDetailModal';
import { LangGraphVisualizer } from './components/LangGraphVisualizer';
import { SdkIntegrationHub } from './components/SdkIntegrationHub';
import { SlackSimulator } from './components/SlackSimulator';
import { CustomAlertDispatcher } from './components/CustomAlertDispatcher';
import { AnalyticsView } from './components/AnalyticsView';
import { SetupScreen } from './components/SetupScreen';
import {
  Incident,
  Alert,
  User,
  StatsResponse,
  SlackMessageRecord,
  LangGraphStepLog,
  StormScenario
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'incidents' | 'langgraph' | 'sdk' | 'slack' | 'custom' | 'analytics'>('incidents');
  const [user, setUser] = useState<User | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rawAlerts, setRawAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [slackMessages, setSlackMessages] = useState<SlackMessageRecord[]>([]);
  const [langGraphLogs, setLangGraphLogs] = useState<LangGraphStepLog[]>([]);
  const [scenarios, setScenarios] = useState<StormScenario[]>([]);

  const [hasEnteredDashboard, setHasEnteredDashboard] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedIncidentAlerts, setSelectedIncidentAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStorming, setIsStorming] = useState(false);
  const [stormProgress, setStormProgress] = useState({
    scenarioId: '',
    scenarioName: '',
    totalAlerts: 0,
    sentAlerts: 0,
    speedMs: 80,
  });

  const fetchData = useCallback(async () => {
    try {
      const [
        userRes,
        incidentsRes,
        alertsRes,
        statsRes,
        slackRes,
        logsRes,
        scenariosRes,
      ] = await Promise.all([
        fetch('/api/auth/me').then((r) => r.json()),
        fetch('/api/incidents').then((r) => r.json()),
        fetch('/api/alerts?limit=150').then((r) => r.json()),
        fetch('/api/stats').then((r) => r.json()),
        fetch('/api/slack/messages').then((r) => r.json()),
        fetch('/api/langgraph/logs').then((r) => r.json()),
        fetch('/api/simulate/scenarios').then((r) => r.json()),
      ]);

      if (userRes.user) setUser(userRes.user);
      if (incidentsRes.incidents) setIncidents(incidentsRes.incidents);
      if (alertsRes.alerts) setRawAlerts(alertsRes.alerts);
      if (statsRes) setStats(statsRes);
      if (slackRes.messages) setSlackMessages(slackRes.messages);
      if (logsRes.logs) setLangGraphLogs(logsRes.logs);
      if (scenariosRes.scenarios) setScenarios(scenariosRes.scenarios);
    } catch (err) {
      console.warn('Data load error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onopen = () => setIsConnected(true);
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'alert:ingested') fetchData();
          else if (['incident:created', 'incident:updated', 'incident:resolved'].includes(parsed.type)) fetchData();
          else if (parsed.type === 'slack:message') setSlackMessages((prev) => [parsed.payload, ...prev.slice(0, 50)]);
          else if (parsed.type === 'langgraph:log') setLangGraphLogs((prev) => [parsed.payload, ...prev.slice(0, 50)]);
          else if (parsed.type === 'storm:started') { setIsStorming(true); setStormProgress(parsed.payload); }
          else if (parsed.type === 'storm:progress') { setIsStorming(true); setStormProgress(parsed.payload); }
          else if (parsed.type === 'storm:completed') { setIsStorming(false); fetchData(); }
          else if (parsed.type === 'db:reset') fetchData();
        } catch (e) { /* ignore heartbeat */ }
      };
      eventSource.onerror = () => setIsConnected(false);
    } catch (err) {
      console.warn('SSE failed:', err);
    }

    const pollInterval = setInterval(() => fetchData(), 4000);
    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [fetchData]);

  const handleSelectIncident = async (incident: Incident) => {
    setSelectedIncident(incident);
    try {
      const res = await fetch(`/api/incidents/${incident._id}`).then((r) => r.json());
      if (res.alerts) setSelectedIncidentAlerts(res.alerts);
    } catch (err) {
      console.warn('Failed to load incident details:', err);
    }
  };

  const handleResolveIncident = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/incidents/${id}/resolve`, { method: 'POST' });
      if (selectedIncident && selectedIncident._id === id)
        setSelectedIncident((prev) => (prev ? { ...prev, status: 'resolved' } : null));
      fetchData();
    } catch (err) {
      console.error('Resolve error:', err);
    }
  };

  const handleTriggerStorm = async (scenarioId: string, alertCount: number, speedMs: number) => {
    try {
      setIsStorming(true);
      await fetch('/api/simulate/storm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, alertCount, speedMs }),
      });
    } catch (err) {
      console.error('Storm launch error:', err);
      setIsStorming(false);
    }
  };

  const handleSendAlert = async (alert: { service: string; message: string; severity: any; stack?: string }) => {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user?.apiKey || ''}`,
      },
      body: JSON.stringify(alert),
    });
    const data = await res.json();
    fetchData();
    return data;
  };

  const handleSaveSlackWebhook = async (slackWebhookUrl: string) => {
    try {
      const res = await fetch('/api/settings/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackWebhookUrl }),
      });
      const data = await res.json();
      if (data.user) setUser(data.user);
      fetchData();
      return true;
    } catch (err) {
      console.error('Save webhook error:', err);
      return false;
    }
  };

  const handleUpdateSettings = async (
    similarityThreshold: number,
    timeWindowMinutes: number,
    enableLangGraphTriage: boolean
  ) => {
    try {
      await fetch('/api/settings/grouping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ similarityThreshold, timeWindowMinutes, enableLangGraphTriage }),
      });
      fetchData();
    } catch (err) {
      console.error('Settings update error:', err);
    }
  };

  const handleResetDb = async () => {
    if (window.confirm('Reset demo database to original sample incidents and clear recent tests?')) {
      await fetch('/api/simulate/reset', { method: 'POST' });
      fetchData();
    }
  };

  if (!hasEnteredDashboard) {
    return (
      <SetupScreen
        user={user}
        onEnterDashboard={() => setHasEnteredDashboard(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        stats={stats}
        isConnected={isConnected}
        isStorming={isStorming}
        onResetDb={handleResetDb}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <MetricCards stats={stats} />

        <StormBanner
          scenarios={scenarios}
          onTriggerStorm={handleTriggerStorm}
          isStorming={isStorming}
          stormProgress={stormProgress}
        />

        {activeTab === 'incidents' && (
          <IncidentFeed
            incidents={incidents}
            rawAlerts={rawAlerts}
            onSelectIncident={handleSelectIncident}
            onResolveIncident={handleResolveIncident}
          />
        )}
        {activeTab === 'langgraph' && (
          <LangGraphVisualizer logs={langGraphLogs} user={user} onUpdateSettings={handleUpdateSettings} />
        )}
        {activeTab === 'sdk' && (
          <SdkIntegrationHub user={user} onSendAlert={handleSendAlert} />
        )}
        {activeTab === 'slack' && (
          <SlackSimulator messages={slackMessages} user={user} onSaveWebhook={handleSaveSlackWebhook} />
        )}
        {activeTab === 'custom' && (
          <CustomAlertDispatcher onSendAlert={handleSendAlert} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView stats={stats} />
        )}
      </main>

      <IncidentDetailModal
        incident={selectedIncident}
        alerts={selectedIncidentAlerts}
        onClose={() => setSelectedIncident(null)}
        onResolve={(id) => handleResolveIncident(id)}
      />

      <footer className="border-t border-zinc-800 bg-zinc-950 py-2.5 text-center">
        <p className="font-condensed text-[11px] tracking-widest text-zinc-600 uppercase">
          AlertGuard Engine · MERN + LangChain + LangGraph · Ready
        </p>
      </footer>
    </div>
  );
}
