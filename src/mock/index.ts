/**
 * Client-side mock engine — activates automatically when the real Express
 * backend is unreachable (Vercel static deployment, GitHub Pages, etc.).
 *
 * Intercepts window.fetch and window.EventSource so every existing API call
 * in App.tsx / components continues to work without any changes.
 *
 * Simulates: LangGraph pipeline steps, AI root-cause analysis, storm injection,
 * Slack gatekeeper, cosine similarity scoring — all client-side.
 */

// ─── SEED DATA ────────────────────────────────────────────────────────────────
import _seed from '../../.data/alertguard.json';

const seed = _seed as {
  users: any[];
  incidents: any[];
  alerts: any[];
  slackMessages: any[];
  langGraphLogs: any[];
};

// ─── STORM SCENARIOS (inlined from server/simulations.ts) ────────────────────
const SCENARIOS = [
  {
    id: 'postgres-pool-starvation',
    name: 'PostgreSQL Pool Starvation & Cascade 504s',
    description: 'Simulates 80 rapid errors across 4 microservices when checkout DB connection pool maxes out.',
    category: 'database',
    totalAlerts: 80,
    expectedIncidents: 1,
    expectedNoiseReduction: '98.8%',
    services: ['checkout-api', 'order-processor', 'inventory-service', 'payment-worker'],
    templates: [
      { service: 'checkout-api',      severity: 'critical', messageTemplate: (i: number) => `Database connection pool exhausted: 100/100 active connections in checkout-db pool [req_id=ck_${i}_${rnd()}]`, stack: 'Error: ConnectionPoolExhausted\n    at Pool.acquire (/app/node_modules/pg-pool/index.js:312:11)' },
      { service: 'order-processor',   severity: 'critical', messageTemplate: (i: number) => `Knex: Timeout acquiring a connection. The pool is probably full. [thread_${i}]`, stack: 'KnexTimeoutError: Timeout acquiring a connection\n    at Client_PG.acquireConnection (/app/node_modules/knex/lib/client.js:312:26)' },
      { service: 'inventory-service', severity: 'high',     messageTemplate: (i: number) => `SequelizeConnectionAcquireTimeoutError: Operation timeout exceeded 10000ms [inv_${i}]` },
      { service: 'payment-worker',    severity: 'high',     messageTemplate: (i: number) => `HTTP 504 Gateway Timeout: /api/v2/orders/checkout failed waiting for database lock [worker_${i}]` },
      { service: 'checkout-api',      severity: 'critical', messageTemplate: (i: number) => `UnhandledRejection: Pool.query() timed out after 5000ms waiting for available client [cid=${i}]` },
    ],
  },
  {
    id: 'stripe-gateway-outage',
    name: 'Stripe Payment Gateway 504 Timeout Spike',
    description: 'Simulates 50 payment intent timeouts and webhook retry failures across billing services.',
    category: 'third_party',
    totalAlerts: 50,
    expectedIncidents: 1,
    expectedNoiseReduction: '98.0%',
    services: ['billing-service', 'subscription-manager', 'mobile-checkout'],
    templates: [
      { service: 'billing-service',        severity: 'high',   messageTemplate: (i: number) => `Stripe API Error (POST /v1/payment_intents): Request timed out after 30000ms [intent_id=pi_${i}_${rnd()}]`, stack: 'StripeConnectionError: Request timed out\n    at Request.callback (/app/node_modules/stripe/lib/StripeResource.js:142:15)' },
      { service: 'subscription-manager',   severity: 'high',   messageTemplate: (i: number) => `StripeConnectionError: Could not connect to Stripe (api.stripe.com). SSL socket reset [sub_${i}]` },
      { service: 'billing-service',        severity: 'medium', messageTemplate: (i: number) => `StripeRateLimitError: 429 Too many requests during retry burst [attempt_${i}]` },
      { service: 'mobile-checkout',        severity: 'high',   messageTemplate: (i: number) => `PaymentIntent capture failed: upstream 504 on card auth [cart_${i}]` },
    ],
  },
  {
    id: 'redis-cache-stampede',
    name: 'Redis Eviction Cascade & Session Outage',
    description: 'Simulates 40 OOM memory pressure errors across authentication and session gateways.',
    category: 'infrastructure',
    totalAlerts: 40,
    expectedIncidents: 1,
    expectedNoiseReduction: '97.5%',
    services: ['auth-service', 'session-gateway', 'user-profile-api'],
    templates: [
      { service: 'auth-service',       severity: 'high',   messageTemplate: (i: number) => `OOM command not allowed when used memory > maxmemory on session-cache-02 [session_${i}]` },
      { service: 'session-gateway',    severity: 'high',   messageTemplate: (i: number) => `RedisError: Maxmemory reached, failed to write session token for uid_${i}` },
      { service: 'user-profile-api',   severity: 'medium', messageTemplate: (i: number) => `SessionLookupMiss: Fallback to database — Redis refused on port 6379 [req_${i}]` },
    ],
  },
  {
    id: 'triple-multi-cascade',
    name: 'Triple Multi-Cluster Chaos Storm (150 alerts)',
    description: 'Simultaneous DB pool + Stripe outage + Redis eviction to test multi-bucket clustering.',
    category: 'multi_service',
    totalAlerts: 150,
    expectedIncidents: 3,
    expectedNoiseReduction: '98.0%',
    services: ['checkout-api', 'billing-service', 'auth-service', 'order-processor', 'session-gateway', 'payment-worker'],
    templates: [] as any[],
  },
];
SCENARIOS[3].templates = [
  ...SCENARIOS[0].templates,
  ...SCENARIOS[1].templates,
  ...SCENARIOS[2].templates,
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function rnd(len = 6) { return Math.random().toString(36).substring(2, 2 + len); }
function uid(prefix = 'id') { return `${prefix}_${Date.now()}_${rnd()}`; }
function jitter(base: number, spread: number) { return base + Math.floor(Math.random() * spread); }

// ─── IN-MEMORY STORE ─────────────────────────────────────────────────────────
const store = {
  user:          JSON.parse(JSON.stringify(seed.users[0])),
  incidents:     JSON.parse(JSON.stringify(seed.incidents))   as any[],
  alerts:        JSON.parse(JSON.stringify(seed.alerts))      as any[],
  slackMessages: JSON.parse(JSON.stringify(seed.slackMessages)) as any[],
  langGraphLogs: []                                            as any[],
};

// Snapshot for reset
const ORIGINAL = JSON.parse(JSON.stringify({
  incidents: seed.incidents,
  alerts:    seed.alerts,
  slackMessages: seed.slackMessages,
}));

// ─── EVENT BUS (SSE simulation) ──────────────────────────────────────────────
const subscribers = new Set<any>();

function emit(type: string, payload: any) {
  const data = JSON.stringify({ type, payload });
  for (const es of subscribers) {
    try { es._dispatch(data); } catch {}
  }
}

// ─── MOCK EVENTSOURCE ────────────────────────────────────────────────────────
class MockEventSource {
  onopen:    ((e: Event)        => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror:   ((e: Event)        => void) | null = null;

  constructor(_url: string) {
    setTimeout(() => this.onopen?.(new Event('open')), 250);
    subscribers.add(this);
  }

  _dispatch(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  close() { subscribers.delete(this); }
}

// ─── STATS ───────────────────────────────────────────────────────────────────
function computeStats() {
  const total  = store.alerts.length;
  const totInc = store.incidents.length;
  const active = store.incidents.filter((i: any) => i.status !== 'resolved');
  const nrr    = total > totInc ? Math.min(99, Math.round(((total - totInc) / total) * 100)) : 0;

  const svcMap: Record<string, { alertCount: number; incidentCount: number }> = {};
  for (const a of store.alerts) {
    svcMap[a.service] = svcMap[a.service] || { alertCount: 0, incidentCount: 0 };
    svcMap[a.service].alertCount++;
  }
  for (const inc of store.incidents) {
    for (const svc of (inc.services || [])) {
      svcMap[svc] = svcMap[svc] || { alertCount: 0, incidentCount: 0 };
      svcMap[svc].incidentCount++;
    }
  }

  const sevMap: Record<string, number> = {};
  for (const a of store.alerts) sevMap[a.severity] = (sevMap[a.severity] || 0) + 1;

  const now = Date.now();
  const hourlyActivity = Array.from({ length: 12 }, (_, i) => {
    const start = now - (11 - i) * 3_600_000;
    const end   = start + 3_600_000;
    return {
      time: new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rawAlerts:        store.alerts.filter((a: any)   => { const t = +new Date(a.createdAt);   return t >= start && t < end; }).length,
      groupedIncidents: store.incidents.filter((inc: any) => { const t = +new Date(inc.firstSeenAt); return t >= start && t < end; }).length,
    };
  });

  return {
    totalAlerts: total, totalIncidents: totInc,
    noiseReductionPercent: nrr,
    savedNotifications: Math.max(0, total - totInc),
    activeIncidentsCount: active.length,
    resolvedIncidentsCount: store.incidents.filter((i: any) => i.status === 'resolved').length,
    criticalIncidentsCount: store.incidents.filter((i: any) => i.severity === 'critical' && i.status !== 'resolved').length,
    topServices: Object.entries(svcMap).map(([service, c]) => ({ service, ...c })).sort((a, b) => b.alertCount - a.alertCount).slice(0, 6),
    severityBreakdown: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
    hourlyActivity,
  };
}

// ─── AI ROOT-CAUSE ANALYSIS TEMPLATES ────────────────────────────────────────
function generateRCA(service: string, message: string) {
  const m = message.toLowerCase();

  if (m.includes('pool') || m.includes('sequelize') || m.includes('knex') || m.includes('postgres') || m.includes('pg ') || m.includes('connection pool')) {
    return {
      summary: 'PostgreSQL connection pool exhausted causing cascade timeouts across dependent microservices.',
      probableRootCause: `PostgreSQL primary replica pool fully saturated (100/100). Unindexed ORDER BY query in ${service} holding connections open.`,
      affectedComponents: [service, 'checkout-db', 'pg-pool', 'connection-pooler'],
      recommendedAction: 'Scale via PgBouncer transaction-pooling mode or kill blocking query: SELECT pg_terminate_backend(pid) WHERE state = \'idle in transaction\';',
      confidenceScore: parseFloat((0.91 + Math.random() * 0.07).toFixed(2)),
      analyzedAt: new Date().toISOString(),
    };
  }
  if (m.includes('stripe') || m.includes('payment') || m.includes('payment_intents') || m.includes('billing')) {
    return {
      summary: 'Stripe API connectivity degradation causing payment intent creation timeouts and webhook delivery failures.',
      probableRootCause: 'api.stripe.com responding with 504 Gateway Timeout — confirmed upstream Stripe infrastructure incident.',
      affectedComponents: [service, 'stripe-gateway', 'payment-processor', 'webhook-receiver'],
      recommendedAction: 'Enable graceful degradation: queue payment intents in Redis, retry on recovery. Monitor status.stripe.com.',
      confidenceScore: parseFloat((0.87 + Math.random() * 0.10).toFixed(2)),
      analyzedAt: new Date().toISOString(),
    };
  }
  if (m.includes('redis') || m.includes('oom') || m.includes('maxmemory') || m.includes('session') || m.includes('eviction')) {
    return {
      summary: 'Redis OOM condition causing session cache writes to fail and user sessions to invalidate.',
      probableRootCause: 'session-cache-02 hit maxmemory limit. allkeys-lru eviction actively removing hot session keys.',
      affectedComponents: [service, 'redis-session-cache', 'session-gateway', 'auth-cluster'],
      recommendedAction: 'Run: SCAN 0 MATCH "sess:*" COUNT 1000 | xargs redis-cli DEL to free memory, then increase maxmemory to 8GB.',
      confidenceScore: parseFloat((0.93 + Math.random() * 0.06).toFixed(2)),
      analyzedAt: new Date().toISOString(),
    };
  }

  return {
    summary: `Recurring ${service} failure pattern suggesting upstream dependency failure or resource exhaustion.`,
    probableRootCause: `${service} encountering repeated errors — likely downstream dependency latency or memory pressure.`,
    affectedComponents: [service],
    recommendedAction: `Check ${service} pod metrics: kubectl top pod -l app=${service}. Review recent deployment changes.`,
    confidenceScore: parseFloat((0.74 + Math.random() * 0.16).toFixed(2)),
    analyzedAt: new Date().toISOString(),
  };
}

// ─── LANGGRAPH PIPELINE STEP GENERATOR ───────────────────────────────────────
function buildSteps(
  alert: { service: string; message: string },
  outcome: 'attached' | 'new',
  matchType: string,
  similarity: number,
  targetId: string,
) {
  const steps: any[] = [];

  steps.push({ node: 'ingest', status: 'passed', details: `Alert fingerprinted. SHA-256 hash computed. Service: ${alert.service}. Routed to dedup pipeline.`, durationMs: 2 });

  if (matchType === 'exact_hash') {
    steps.push({ node: 'exact_match_check', status: 'matched', details: `Exact SHA-256 hash collision. Alert attached to incident ${targetId.slice(0, 16)} without embedding. O(1) fast-path.`, durationMs: 1 });
    steps.push({ node: 'slack_gatekeeper', status: 'suppressed', details: 'Notification suppressed — exact duplicate. Alert fatigue avoided.', durationMs: 1 });
    return steps;
  }

  steps.push({ node: 'exact_match_check', status: 'passed', details: 'No exact hash match found. Escalating to semantic vector analysis.', durationMs: 1 });
  steps.push({ node: 'vector_embedding', status: 'passed', details: `Gemini text-embedding-004 generated 768-dim vector in ${jitter(18, 14)}ms. L2-normalised for cosine similarity.`, durationMs: jitter(18, 14) });

  if (matchType === 'semantic_cosine') {
    steps.push({ node: 'semantic_similarity', status: 'matched', details: `Cosine similarity ${(similarity * 100).toFixed(1)}% ≥ threshold 84.0%. Alert merged into incident ${targetId.slice(0, 16)}.`, durationMs: jitter(7, 5) });
    steps.push({ node: 'slack_gatekeeper', status: 'suppressed', details: `Notification suppressed — semantic duplicate. Saved 1 on-call page.`, durationMs: 1 });
    return steps;
  }

  if (matchType === 'langgraph_borderline_arbitration') {
    steps.push({ node: 'semantic_similarity', status: 'passed', details: `Cosine score ${(similarity * 100).toFixed(1)}% in borderline zone [75–84%]. Escalating to LangGraph arbitrator.`, durationMs: jitter(7, 5) });
    const decision = outcome === 'attached' ? 'MERGE into existing incident' : 'CREATE new incident';
    steps.push({ node: 'langgraph_borderline_arbitrator', status: 'invoked_gemini', details: `Gemini LLM arbitration: service topology + time-window analysis. Decision: ${decision}. Confidence: ${(0.78 + Math.random() * 0.18).toFixed(2)}.`, durationMs: jitter(290, 180) });
  } else {
    steps.push({ node: 'semantic_similarity', status: 'diverged', details: `Best cosine match ${(similarity * 100).toFixed(1)}% < threshold 84%. No incident cluster matched. Creating new incident.`, durationMs: jitter(7, 5) });
  }

  if (outcome === 'new') {
    steps.push({ node: 'root_cause_synthesis', status: 'passed', details: `Gemini synthesised RCA from alert semantics. Root cause identified. Recommended action generated. Confidence: ${(0.83 + Math.random() * 0.13).toFixed(2)}.`, durationMs: jitter(680, 380) });
    steps.push({ node: 'slack_gatekeeper', status: 'notified', details: `New incident dispatched to #alerts-production. ${jitter(1, 3)} on-call engineer(s) notified via Slack webhook.`, durationMs: jitter(38, 28) });
  } else {
    steps.push({ node: 'slack_gatekeeper', status: 'suppressed', details: 'LangGraph arbitrator decided MERGE. Notification suppressed to prevent duplicate pages.', durationMs: 1 });
  }

  return steps;
}

// ─── ALERT GROUPING ENGINE ───────────────────────────────────────────────────
type AlertInput = { service: string; message: string; severity: string; stack?: string };

function groupingCategory(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('pool') || m.includes('sequelize') || m.includes('knex') || m.includes('postgres') || m.includes('pg ') || m.includes('connection pool') || m.includes('gateway timeout') && m.includes('database')) return 'postgres';
  if (m.includes('stripe') || m.includes('payment_intent') || m.includes('stripeconnection') || m.includes('striperateli')) return 'stripe';
  if (m.includes('redis') || m.includes('oom') || m.includes('maxmemory') || m.includes('session-cache') || m.includes('sessionlookup')) return 'redis';
  return 'generic';
}

function findMatch(alert: AlertInput): { incident: any; similarity: number; matchType: string } | null {
  const cat = groupingCategory(alert.message);
  const actives = store.incidents.filter((i: any) => i.status !== 'resolved');

  for (const inc of actives) {
    const title = (inc.title + ' ' + inc.representativeMessage).toLowerCase();
    const incCat = groupingCategory(title);
    if (cat !== 'generic' && cat === incCat) {
      // Same category → high cosine score
      const sim = parseFloat((0.87 + Math.random() * 0.10).toFixed(3));
      const mt  = sim > 0.99 ? 'exact_hash' : 'semantic_cosine';
      return { incident: inc, similarity: sim, matchType: mt };
    }
  }

  // Borderline: 25% chance for generic alerts to loosely match
  if (actives.length > 0 && Math.random() < 0.25) {
    const inc = actives[Math.floor(Math.random() * actives.length)];
    const sim = parseFloat((0.76 + Math.random() * 0.08).toFixed(3));
    return { incident: inc, similarity: sim, matchType: 'langgraph_borderline_arbitration' };
  }

  return null;
}

function ingestAlert(alert: AlertInput): { incidentId: string; incidentTitle: string; grouped: boolean; similarityScore: number; slackNotified: boolean; noiseReductionPercent: number } {
  const match = findMatch(alert);
  const now   = new Date().toISOString();
  const alertId = uid('alt');

  let incidentId:    string;
  let incidentTitle: string;
  let grouped:       boolean;
  let similarity:    number;
  let matchType:     string;
  let slackNotified: boolean;
  let outcome:       'attached' | 'new';

  if (match) {
    const { incident, similarity: sim, matchType: mt } = match;

    // Borderline — LangGraph might create new anyway (~30%)
    const mergeDecision = mt === 'langgraph_borderline_arbitration' ? Math.random() > 0.3 : true;

    if (mergeDecision) {
      incident.alertCount++;
      incident.lastSeenAt = now;
      incidentId    = incident._id;
      incidentTitle = incident.title;
      grouped       = true;
      similarity    = sim;
      matchType     = mt;
      slackNotified = false;
      outcome       = 'attached';
      emit('incident:updated', { incidentId: incident._id });
    } else {
      // LangGraph decided to create new despite borderline match
      const newInc = makeNewIncident(alert, now);
      store.incidents.unshift(newInc);
      incidentId    = newInc._id;
      incidentTitle = newInc.title;
      grouped       = false;
      similarity    = sim;
      matchType     = 'langgraph_borderline_arbitration';
      slackNotified = true;
      outcome       = 'new';
      emit('incident:created', { incidentId: newInc._id });
      emitSlack(newInc);
    }
  } else {
    const newInc = makeNewIncident(alert, now);
    store.incidents.unshift(newInc);
    incidentId    = newInc._id;
    incidentTitle = newInc.title;
    grouped       = false;
    similarity    = parseFloat((0.12 + Math.random() * 0.55).toFixed(3));
    matchType     = 'new_incident';
    slackNotified = true;
    outcome       = 'new';
    emit('incident:created', { incidentId: newInc._id });
    emitSlack(newInc);
  }

  // Add to alerts store
  const alertRecord = {
    _id: alertId,
    userId: store.user._id,
    service: alert.service,
    message: alert.message,
    stack: alert.stack,
    severity: alert.severity,
    normalizedHash: uid('hash'),
    incidentId,
    similarityScore: similarity,
    groupingReason: matchType,
    createdAt: now,
  };
  store.alerts.unshift(alertRecord);

  // Build LangGraph log
  const steps = buildSteps(alert, outcome, matchType, similarity, incidentId);
  const log = {
    id: uid('log'),
    alertId,
    timestamp: now,
    service: alert.service,
    message: alert.message,
    steps,
    finalOutcome: outcome === 'attached' ? 'attached_to_incident' : 'created_new_incident',
    targetIncidentId: incidentId,
    similarity,
  };
  store.langGraphLogs.unshift(log);
  emit('langgraph:log', log);
  emit('alert:ingested', { alertId, incidentId });

  return {
    incidentId,
    incidentTitle,
    grouped,
    similarityScore: similarity,
    slackNotified,
    noiseReductionPercent: computeStats().noiseReductionPercent,
  };
}

function makeNewIncident(alert: AlertInput, now: string) {
  const rca = generateRCA(alert.service, alert.message);
  return {
    _id: uid('inc'),
    userId: store.user._id,
    title: inferTitle(alert),
    representativeMessage: alert.message,
    services: [alert.service],
    severity: alert.severity,
    alertCount: 1,
    status: 'active',
    firstSeenAt: now,
    lastSeenAt: now,
    notifiedAt: now,
    slackNotificationSent: true,
    rootCauseAnalysis: rca,
    agentTrace: {
      matchType: 'new_incident',
      cosineScore: 0,
      decisionExplanation: `No matching incident found above 84% cosine threshold. New incident created for ${alert.service}.`,
      evaluatedAt: now,
      executionTimeMs: jitter(14, 30),
    },
  };
}

function inferTitle(alert: AlertInput): string {
  const m = alert.message.toLowerCase();
  if (m.includes('pool') || m.includes('sequelize') || m.includes('connection pool')) return `${alert.service}: DB Connection Pool Exhaustion`;
  if (m.includes('stripe') || m.includes('payment_intent'))                           return `${alert.service}: Stripe Gateway Timeout`;
  if (m.includes('redis') || m.includes('oom') || m.includes('maxmemory'))            return `${alert.service}: Redis OOM & Session Eviction`;
  if (m.includes('timeout'))                                                           return `${alert.service}: Request Timeout`;
  if (m.includes('memory') || m.includes('heap'))                                     return `${alert.service}: Memory Pressure`;
  return `${alert.service}: ${alert.severity.toUpperCase()} Error Cluster`;
}

function emitSlack(inc: any) {
  const msg = {
    id: uid('slk'),
    timestamp: new Date().toISOString(),
    channel: '#alerts-production',
    incidentId: inc._id,
    incidentTitle: inc.title,
    severity: inc.severity,
    services: inc.services,
    alertCount: inc.alertCount,
    isEscalation: false,
    rawPayload: {},
    status: 'simulated',
  };
  store.slackMessages.unshift(msg);
  emit('slack:message', msg);
}

// ─── STORM ENGINE ────────────────────────────────────────────────────────────
let isStorming = false;

function runStorm(scenarioId: string, alertCount: number, speedMs: number) {
  if (isStorming) return;
  const scenario = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0];
  const count    = alertCount || scenario.totalAlerts;
  isStorming     = true;

  const progress = { scenarioId: scenario.id, scenarioName: scenario.name, totalAlerts: count, sentAlerts: 0, speedMs };
  emit('storm:started', progress);

  (async () => {
    for (let i = 0; i < count; i++) {
      const tmpl    = scenario.templates[i % scenario.templates.length];
      const message = tmpl.messageTemplate(i + 1);
      ingestAlert({ service: tmpl.service, message, severity: tmpl.severity, stack: (tmpl as any).stack });
      progress.sentAlerts = i + 1;
      emit('storm:progress', { ...progress });
      if (speedMs > 0) await delay(speedMs);
    }
    isStorming = false;
    emit('storm:completed', { ...progress, stats: computeStats() });
  })();
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── MOCK RESPONSE BUILDER ───────────────────────────────────────────────────
function ok(body: any): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function notFound(): Response {
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

// ─── ROUTE HANDLERS ──────────────────────────────────────────────────────────
async function handleRequest(url: string, init?: RequestInit): Promise<Response> {
  const u      = new URL(url, 'http://localhost');
  const path   = u.pathname;
  const method = (init?.method || 'GET').toUpperCase();
  const body   = init?.body ? (() => { try { return JSON.parse(init.body as string); } catch { return {}; } })() : {};

  // GET /api/auth/me
  if (path === '/api/auth/me' && method === 'GET')
    return ok({ user: store.user });

  // POST /api/auth/regenerate-key
  if (path === '/api/auth/regenerate-key' && method === 'POST') {
    store.user.apiKey = `ag_live_${rnd(8)}${rnd(8)}${rnd(4)}`;
    return ok({ apiKey: store.user.apiKey, user: store.user });
  }

  // GET /api/incidents
  if (path === '/api/incidents' && method === 'GET')
    return ok({ incidents: store.incidents });

  // GET /api/incidents/:id
  const incMatch = path.match(/^\/api\/incidents\/([^/]+)$/);
  if (incMatch && method === 'GET') {
    const inc = store.incidents.find((i: any) => i._id === incMatch[1]);
    if (!inc) return notFound();
    const alerts = store.alerts.filter((a: any) => a.incidentId === inc._id).slice(0, 50);
    return ok({ incident: inc, alerts });
  }

  // POST /api/incidents/:id/resolve
  const resolveMatch = path.match(/^\/api\/incidents\/([^/]+)\/resolve$/);
  if (resolveMatch && method === 'POST') {
    const inc = store.incidents.find((i: any) => i._id === resolveMatch[1]);
    if (inc) { inc.status = 'resolved'; emit('incident:resolved', { incidentId: inc._id }); }
    return ok({ success: true });
  }

  // GET /api/alerts
  if (path === '/api/alerts' && method === 'GET') {
    const limit  = parseInt(u.searchParams.get('limit') || '150');
    return ok({ alerts: store.alerts.slice(0, limit) });
  }

  // POST /api/alerts  (custom dispatcher + SDK hub)
  if (path === '/api/alerts' && method === 'POST') {
    const result = ingestAlert(body);
    return ok(result);
  }

  // GET /api/stats
  if (path === '/api/stats' && method === 'GET')
    return ok(computeStats());

  // GET /api/slack/messages
  if (path === '/api/slack/messages' && method === 'GET')
    return ok({ messages: store.slackMessages });

  // GET /api/langgraph/logs
  if (path === '/api/langgraph/logs' && method === 'GET')
    return ok({ logs: store.langGraphLogs.slice(0, 50) });

  // GET /api/simulate/scenarios
  if (path === '/api/simulate/scenarios' && method === 'GET')
    return ok({ scenarios: SCENARIOS.map(({ templates: _t, ...rest }) => rest) });

  // POST /api/simulate/storm
  if (path === '/api/simulate/storm' && method === 'POST') {
    runStorm(body.scenarioId, body.alertCount, body.speedMs ?? 40);
    return ok({ success: true });
  }

  // POST /api/simulate/reset
  if (path === '/api/simulate/reset' && method === 'POST') {
    store.incidents     = JSON.parse(JSON.stringify(ORIGINAL.incidents));
    store.alerts        = JSON.parse(JSON.stringify(ORIGINAL.alerts));
    store.slackMessages = JSON.parse(JSON.stringify(ORIGINAL.slackMessages));
    store.langGraphLogs = [];
    emit('db:reset', {});
    return ok({ success: true });
  }

  // POST /api/settings/slack
  if (path === '/api/settings/slack' && method === 'POST') {
    store.user.slackWebhookUrl = body.slackWebhookUrl || '';
    return ok({ user: store.user });
  }

  // POST /api/settings/grouping
  if (path === '/api/settings/grouping' && method === 'POST') {
    Object.assign(store.user.settings, body);
    return ok({ user: store.user });
  }

  // SSE endpoint — App.tsx will get a real MockEventSource, not a fetch
  if (path === '/api/events') return ok({});

  return notFound();
}

// ─── PUBLIC INSTALL ───────────────────────────────────────────────────────────
export function installMock() {
  // Override EventSource before App mounts so the SSE connection is mocked
  (window as any).EventSource = MockEventSource;

  // Intercept fetch for all /api/* calls
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input
              : input instanceof URL      ? input.href
              : (input as Request).url;
    if (url.startsWith('/api/')) return handleRequest(url, init);
    return orig(input, init);
  };

  console.info('[AlertGuard] Running in demo mode — all API calls are mocked client-side.');
}
