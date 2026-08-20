export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentStatus = 'active' | 'investigating' | 'mitigated' | 'resolved';

export interface Alert {
  _id: string;
  userId: string;
  service: string;
  message: string;
  stack?: string;
  severity: Severity;
  tags?: Record<string, string>;
  embedding?: number[];
  normalizedHash: string;
  incidentId: string;
  similarityScore?: number;
  groupingReason?: string;
  createdAt: string;
}

export interface Incident {
  _id: string;
  userId: string;
  title: string;
  representativeMessage: string;
  embedding?: number[];
  services: string[];
  severity: Severity;
  alertCount: number;
  status: IncidentStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  notifiedAt?: string;
  slackNotificationSent: boolean;
  rootCauseAnalysis?: {
    summary: string;
    probableRootCause: string;
    affectedComponents: string[];
    recommendedAction: string;
    confidenceScore: number;
    analyzedAt: string;
  };
  agentTrace?: {
    matchType: 'exact_hash' | 'semantic_cosine' | 'langgraph_borderline_arbitration' | 'new_incident';
    cosineScore: number;
    decisionExplanation: string;
    evaluatedAt: string;
    executionTimeMs: number;
  };
}

export interface User {
  _id: string;
  email: string;
  apiKey: string;
  slackWebhookUrl?: string;
  createdAt: string;
  settings: {
    similarityThreshold: number; // e.g. 0.85
    timeWindowMinutes: number;   // e.g. 15
    autoResolveMinutes: number;  // e.g. 60
    enableLangGraphTriage: boolean;
  };
}

export interface StatsResponse {
  totalAlerts: number;
  totalIncidents: number;
  noiseReductionPercent: number;
  savedNotifications: number;
  activeIncidentsCount: number;
  resolvedIncidentsCount: number;
  criticalIncidentsCount: number;
  topServices: { service: string; alertCount: number; incidentCount: number }[];
  severityBreakdown: { severity: Severity; count: number }[];
  hourlyActivity: { time: string; rawAlerts: number; groupedIncidents: number }[];
}

export interface SlackMessageRecord {
  id: string;
  timestamp: string;
  channel: string;
  incidentId: string;
  incidentTitle: string;
  severity: Severity;
  services: string[];
  alertCount: number;
  isEscalation: boolean;
  rawPayload: any;
  status: 'delivered' | 'simulated' | 'failed';
  errorMessage?: string;
}

export interface LangGraphStepLog {
  id: string;
  alertId: string;
  timestamp: string;
  service: string;
  message: string;
  steps: {
    node: 'ingest' | 'exact_match_check' | 'vector_embedding' | 'semantic_similarity' | 'langgraph_borderline_arbitrator' | 'root_cause_synthesis' | 'slack_gatekeeper';
    status: 'passed' | 'matched' | 'diverged' | 'invoked_gemini' | 'notified' | 'suppressed';
    details: string;
    durationMs: number;
  }[];
  finalOutcome: 'attached_to_incident' | 'created_new_incident';
  targetIncidentId?: string;
  similarity?: number;
}
