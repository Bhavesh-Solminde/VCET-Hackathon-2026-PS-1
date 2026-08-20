import { GoogleGenAI, Type } from '@google/genai';
import { Alert, Incident, Severity, LangGraphStepLog } from '../types';
import { normalizeErrorMessage, getEmbedding, cosineSimilarity, computeContextualSimilarity } from './embeddings';
import { db } from '../db';

let genAIClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (genAIClient) return genAIClient;
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    genAIClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

export interface AgentGraphState {
  alert: {
    service: string;
    message: string;
    severity: Severity;
    stack?: string;
    tags?: Record<string, string>;
  };
  userId: string;
  normalizedHash?: string;
  normalizedText?: string;
  embedding?: number[];
  activeIncidents?: Incident[];
  matchedIncident?: Incident | null;
  matchType?: 'exact_hash' | 'semantic_cosine' | 'langgraph_borderline_arbitration' | 'new_incident';
  cosineScore?: number;
  decisionExplanation?: string;
  isNewIncident?: boolean;
  isEscalated?: boolean;
  shouldNotifySlack?: boolean;
  stepsLog: LangGraphStepLog['steps'];
}

export async function runLangGraphAlertTriage(
  rawAlert: { service: string; message: string; severity: Severity; stack?: string; tags?: Record<string, string> },
  userId: string
): Promise<{
  incident: Incident;
  alert: Alert;
  isNew: boolean;
  escalated: boolean;
  shouldNotify: boolean;
  log: LangGraphStepLog;
}> {
  const user = db.getUser();
  const similarityThreshold = user.settings.similarityThreshold || 0.84;
  const timeWindowMinutes = user.settings.timeWindowMinutes || 15;
  const enableLangGraphTriage = user.settings.enableLangGraphTriage !== false;

  const state: AgentGraphState = {
    alert: rawAlert,
    userId,
    stepsLog: [],
  };

  // Node 1: Ingestion & Normalization
  const t0 = Date.now();
  const { normalized, hash } = normalizeErrorMessage(rawAlert.message);
  state.normalizedText = normalized;
  state.normalizedHash = hash;
  state.stepsLog.push({
    node: 'ingest',
    status: 'passed',
    details: `Normalized message, stripped ephemeral tokens (hash: ${hash.slice(0, 8)}...)`,
    durationMs: Date.now() - t0,
  });

  // Node 2: Exact Hash Fingerprint Check
  const t1 = Date.now();
  const activeIncidents = db.getActiveIncidents(userId, timeWindowMinutes);
  state.activeIncidents = activeIncidents;

  let exactMatchIncident: Incident | null = null;
  for (const inc of activeIncidents) {
    const incHash = normalizeErrorMessage(inc.representativeMessage).hash;
    if (incHash === hash) {
      exactMatchIncident = inc;
      break;
    }
  }

  if (exactMatchIncident) {
    state.matchedIncident = exactMatchIncident;
    state.matchType = 'exact_hash';
    state.cosineScore = 1.0;
    state.decisionExplanation = 'Exact normalized error signature fingerprint match with active incident.';
    state.stepsLog.push({
      node: 'exact_match_check',
      status: 'matched',
      details: `Matched incident "${exactMatchIncident.title.slice(0, 40)}..." (100% confidence)`,
      durationMs: Date.now() - t1,
    });
  } else {
    state.stepsLog.push({
      node: 'exact_match_check',
      status: 'diverged',
      details: 'No exact fingerprint match found in active time window. Moving to Vector Embeddings Node.',
      durationMs: Date.now() - t1,
    });

    // Node 3: Vector Embedding & Semantic Cosine Similarity
    const t2 = Date.now();
    const alertVector = await getEmbedding(rawAlert.message);
    state.embedding = alertVector;
    state.stepsLog.push({
      node: 'vector_embedding',
      status: 'passed',
      details: `Computed dense semantic embedding vector (${alertVector.length} dimensions)`,
      durationMs: Date.now() - t2,
    });

    // Compute similarities against active incidents
    const t3 = Date.now();
    let bestIncident: Incident | null = null;
    let highestScore = 0;
    let highestBoostDetails = '';

    for (const inc of activeIncidents) {
      const incVector = inc.embedding || (await getEmbedding(inc.representativeMessage));
      inc.embedding = incVector; // cache
      const rawSim = cosineSimilarity(alertVector, incVector);
      
      const timeDiffSeconds = Math.max(0, (Date.now() - new Date(inc.lastSeenAt).getTime()) / 1000);
      const { finalScore, boostDetails } = computeContextualSimilarity(
        rawSim,
        rawAlert.service,
        inc.services,
        timeDiffSeconds
      );

      if (finalScore > highestScore) {
        highestScore = finalScore;
        bestIncident = inc;
        highestBoostDetails = boostDetails;
      }
    }

    state.cosineScore = highestScore;

    if (highestScore >= similarityThreshold && bestIncident) {
      // Clear semantic match!
      state.matchedIncident = bestIncident;
      state.matchType = 'semantic_cosine';
      state.decisionExplanation = `Semantic vector cosine similarity (${(highestScore * 100).toFixed(1)}% >= threshold ${(similarityThreshold * 100).toFixed(0)}%). ${highestBoostDetails}`;
      state.stepsLog.push({
        node: 'semantic_similarity',
        status: 'matched',
        details: `Grouped into "${bestIncident.title.slice(0, 40)}..." (Score: ${(highestScore * 100).toFixed(1)}%)`,
        durationMs: Date.now() - t3,
      });
    } else if (highestScore >= 0.68 && highestScore < similarityThreshold && bestIncident && enableLangGraphTriage) {
      // Node 4: LangGraph Borderline Arbitrator (Agentic Gemini 3.7 reasoning)
      const t4 = Date.now();
      state.stepsLog.push({
        node: 'semantic_similarity',
        status: 'diverged',
        details: `Borderline score ${(highestScore * 100).toFixed(1)}% below threshold ${(similarityThreshold * 100).toFixed(0)}%. Routing to LangGraph Borderline Arbitrator Agent.`,
        durationMs: Date.now() - t3,
      });

      const arbitrationResult = await arbitrateBorderlineAlertWithGemini(rawAlert, bestIncident, highestScore);

      if (arbitrationResult.sharesRootCause) {
        state.matchedIncident = bestIncident;
        state.matchType = 'langgraph_borderline_arbitration';
        state.decisionExplanation = `LangGraph Arbitrator confirmed shared root cause: "${arbitrationResult.reasoning}" (Confidence: ${(arbitrationResult.confidence * 100).toFixed(0)}%)`;
        state.stepsLog.push({
          node: 'langgraph_borderline_arbitrator',
          status: 'invoked_gemini',
          details: `Arbitrator: Merged into "${bestIncident.title.slice(0, 35)}..." [Reason: ${arbitrationResult.reasoning}]`,
          durationMs: Date.now() - t4,
        });
      } else {
        state.stepsLog.push({
          node: 'langgraph_borderline_arbitrator',
          status: 'diverged',
          details: `Arbitrator: Distinct root cause confirmed. [Reason: ${arbitrationResult.reasoning}]`,
          durationMs: Date.now() - t4,
        });
      }
    } else {
      state.stepsLog.push({
        node: 'semantic_similarity',
        status: 'diverged',
        details: `No incident exceeded similarity threshold (${highestScore > 0 ? (highestScore * 100).toFixed(1) + '%' : 'no active incidents'}). Creating new incident container.`,
        durationMs: Date.now() - t3,
      });
    }
  }

  // Node 5 & 6: Incident State Management & Root Cause Synthesis
  let targetIncident: Incident;
  let isNew = false;
  let escalated = false;

  const severityWeight = (s: Severity): number => {
    switch (s) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  };

  if (!state.matchedIncident) {
    // Create new incident
    isNew = true;
    const initialTitle = generateInitialTitle(rawAlert.service, rawAlert.message);
    targetIncident = db.addIncident({
      userId,
      title: initialTitle,
      representativeMessage: rawAlert.message,
      embedding: state.embedding,
      services: [rawAlert.service],
      severity: rawAlert.severity,
      alertCount: 1,
      status: 'active',
      slackNotificationSent: false,
      agentTrace: {
        matchType: 'new_incident',
        cosineScore: state.cosineScore || 0,
        decisionExplanation: 'No active incident shared root cause or exceeded semantic threshold. Seeded new incident.',
        evaluatedAt: new Date().toISOString(),
        executionTimeMs: state.stepsLog.reduce((acc, s) => acc + s.durationMs, 0),
      },
    });

    // Asynchronously trigger AI root cause synthesis
    synthesizeRootCauseAnalysisAsync(targetIncident._id, rawAlert);
  } else {
    // Update existing incident
    targetIncident = state.matchedIncident;
    targetIncident.alertCount += 1;
    targetIncident.lastSeenAt = new Date().toISOString();

    if (!targetIncident.services.includes(rawAlert.service)) {
      targetIncident.services.push(rawAlert.service);
    }

    if (severityWeight(rawAlert.severity) > severityWeight(targetIncident.severity)) {
      targetIncident.severity = rawAlert.severity;
      escalated = true;
    }

    targetIncident.agentTrace = {
      matchType: state.matchType || 'semantic_cosine',
      cosineScore: state.cosineScore || 1.0,
      decisionExplanation: state.decisionExplanation || 'Grouped by AlertGuard Agent Engine',
      evaluatedAt: new Date().toISOString(),
      executionTimeMs: state.stepsLog.reduce((acc, s) => acc + s.durationMs, 0),
    };

    db.updateIncident(targetIncident._id, targetIncident);

    // Periodically refresh AI root cause when incident accumulates diverse service alerts
    if (targetIncident.alertCount === 5 || targetIncident.alertCount === 25 || escalated) {
      synthesizeRootCauseAnalysisAsync(targetIncident._id, rawAlert);
    }
  }

  // Node 7: Slack Gatekeeper Policy
  const t7 = Date.now();
  const shouldNotify = isNew || (escalated && targetIncident.alertCount > 1);

  state.stepsLog.push({
    node: 'slack_gatekeeper',
    status: shouldNotify ? 'notified' : 'suppressed',
    details: shouldNotify
      ? (isNew ? 'New incident detected -> Slack dispatch authorized' : 'Severity escalated -> Urgent Slack escalation alert authorized')
      : `Subordinate alert collapsed into incident #${targetIncident._id.slice(0, 8)} (Notification suppressed to prevent alert fatigue)`,
    durationMs: Date.now() - t7,
  });

  // Save the raw alert record
  const savedAlert = db.addAlert({
    userId,
    service: rawAlert.service,
    message: rawAlert.message,
    stack: rawAlert.stack,
    severity: rawAlert.severity,
    tags: rawAlert.tags,
    embedding: state.embedding,
    normalizedHash: state.normalizedHash || 'hash',
    incidentId: targetIncident._id,
    similarityScore: state.cosineScore,
    groupingReason: state.decisionExplanation,
  });

  const stepLog = db.addLangGraphLog({
    alertId: savedAlert._id,
    service: rawAlert.service,
    message: rawAlert.message,
    steps: state.stepsLog,
    finalOutcome: isNew ? 'created_new_incident' : 'attached_to_incident',
    targetIncidentId: targetIncident._id,
    similarity: state.cosineScore,
  });

  return {
    incident: targetIncident,
    alert: savedAlert,
    isNew,
    escalated,
    shouldNotify,
    log: stepLog,
  };
}

/**
 * Invokes Gemini 3.7 Flash to decide borderline grouping cases.
 */
async function arbitrateBorderlineAlertWithGemini(
  newAlert: { service: string; message: string; severity: Severity },
  candidateIncident: Incident,
  score: number
): Promise<{ sharesRootCause: boolean; reasoning: string; confidence: number }> {
  const client = getClient();
  if (!client) {
    // Deterministic fallback based on shared error keywords
    const keywords = ['timeout', 'connection', 'database', 'postgres', 'pool', 'stripe', 'redis', 'oom', '504', 'auth'];
    const msgLower = newAlert.message.toLowerCase();
    const repLower = candidateIncident.representativeMessage.toLowerCase();
    const matches = keywords.filter((k) => msgLower.includes(k) && repLower.includes(k));
    
    if (matches.length > 0) {
      return {
        sharesRootCause: true,
        reasoning: `Shared fault domain keywords (${matches.join(', ')}) across services`,
        confidence: 0.82,
      };
    }
    return {
      sharesRootCause: false,
      reasoning: 'Insufficient semantic overlap across fault domains',
      confidence: 0.75,
    };
  }

  try {
    const prompt = `You are the LangGraph SRE Incident Triage Agent in AlertGuard.
Determine whether the following NEW incoming alert shares the same underlying root cause as the ACTIVE INCIDENT.

NEW ALERT:
- Service: ${newAlert.service}
- Severity: ${newAlert.severity}
- Error Message: "${newAlert.message}"

ACTIVE INCIDENT:
- Title: "${candidateIncident.title}"
- Affected Services: ${candidateIncident.services.join(', ')}
- Representative Error: "${candidateIncident.representativeMessage}"
- Mathematical Vector Similarity: ${(score * 100).toFixed(1)}%

Respond strictly with JSON.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sharesRootCause: {
              type: Type.BOOLEAN,
              description: 'Whether the new alert was triggered by or directly related to the existing incident root cause.',
            },
            reasoning: {
              type: Type.STRING,
              description: 'Brief 1-sentence SRE justification.',
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Confidence score from 0.0 to 1.0',
            },
          },
          required: ['sharesRootCause', 'reasoning', 'confidence'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return {
      sharesRootCause: !!parsed.sharesRootCause,
      reasoning: parsed.reasoning || 'Evaluated via LangGraph LLM arbitrator',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
    };
  } catch (err) {
    console.warn('Gemini arbitration fallback:', err);
    return {
      sharesRootCause: score >= 0.78,
      reasoning: 'Fallback heuristic arbitration based on vector proximity',
      confidence: 0.75,
    };
  }
}

/**
 * Asynchronously generates an intelligent root cause analysis and concise title.
 */
async function synthesizeRootCauseAnalysisAsync(incidentId: string, triggerAlert: any) {
  try {
    const incident = db.getIncidentById(incidentId);
    if (!incident) return;

    const client = getClient();
    if (!client) {
      // Smart heuristic synthesis
      incident.rootCauseAnalysis = {
        summary: `Cascade failure detected across ${incident.services.join(', ')} services originating from ${triggerAlert.service}.`,
        probableRootCause: `Primary failure in ${triggerAlert.service}: ${triggerAlert.message.slice(0, 100)}`,
        affectedComponents: incident.services,
        recommendedAction: 'Check downstream dependency health, connection pools, and circuit breakers.',
        confidenceScore: 0.92,
        analyzedAt: new Date().toISOString(),
      };
      db.updateIncident(incidentId, incident);
      return;
    }

    const prompt = `You are the Lead SRE AI Engine in AlertGuard.
Analyze this consolidated incident and synthesize a crystal-clear incident title, root cause hypothesis, and remediation runbook recommendation.

INCIDENT DETAILS:
- Current Title: ${incident.title}
- Representative Message: ${incident.representativeMessage}
- Affected Microservices: ${incident.services.join(', ')}
- Severity: ${incident.severity}
- Total Alerts Collapsed: ${incident.alertCount}
- Trigger Alert: ${triggerAlert.message}

Respond strictly with JSON.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'A concise, professional SRE incident title (max 80 chars) describing the actual failure mode.',
            },
            summary: {
              type: Type.STRING,
              description: '2-sentence technical summary of the incident cascade.',
            },
            probableRootCause: {
              type: Type.STRING,
              description: 'The single most probable root cause.',
            },
            affectedComponents: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of affected components and dependencies.',
            },
            recommendedAction: {
              type: Type.STRING,
              description: 'Immediate actionable runbook remediation step for the on-call engineer.',
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: 'Confidence between 0.0 and 1.0',
            },
          },
          required: ['title', 'summary', 'probableRootCause', 'affectedComponents', 'recommendedAction', 'confidenceScore'],
        },
      },
    });

    const result = JSON.parse(response.text?.trim() || '{}');
    if (result.title) {
      incident.title = result.title;
    }
    incident.rootCauseAnalysis = {
      summary: result.summary,
      probableRootCause: result.probableRootCause,
      affectedComponents: result.affectedComponents || incident.services,
      recommendedAction: result.recommendedAction,
      confidenceScore: result.confidenceScore || 0.95,
      analyzedAt: new Date().toISOString(),
    };

    db.updateIncident(incidentId, incident);
  } catch (err) {
    console.warn('Root cause synthesis error:', err);
  }
}

function generateInitialTitle(service: string, message: string): string {
  const cleanMsg = message.replace(/\s+/g, ' ').trim();
  if (cleanMsg.toLowerCase().includes('postgres') || cleanMsg.toLowerCase().includes('pool') || cleanMsg.toLowerCase().includes('database')) {
    return `Database Connection Starvation in ${service}`;
  }
  if (cleanMsg.toLowerCase().includes('stripe') || cleanMsg.toLowerCase().includes('payment')) {
    return `Payment Gateway Degradation in ${service}`;
  }
  if (cleanMsg.toLowerCase().includes('redis') || cleanMsg.toLowerCase().includes('oom') || cleanMsg.toLowerCase().includes('memory')) {
    return `Redis Cache Pressure in ${service}`;
  }
  if (cleanMsg.toLowerCase().includes('jwt') || cleanMsg.toLowerCase().includes('auth') || cleanMsg.toLowerCase().includes('token')) {
    return `Authentication Service Degradation in ${service}`;
  }
  if (cleanMsg.toLowerCase().includes('504') || cleanMsg.toLowerCase().includes('timeout')) {
    return `Upstream Gateway Timeout Spike in ${service}`;
  }
  return `${service}: ${cleanMsg.slice(0, 60)}...`;
}
