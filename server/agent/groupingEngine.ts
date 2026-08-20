import { db } from '../db';
import { Severity, Alert, Incident } from '../types';
import { runLangGraphAlertTriage } from './langgraphAgent';
import { sendSlackIncidentNotification } from '../slack';

export interface IngestAlertInput {
  service: string;
  message: string;
  severity?: Severity;
  stack?: string;
  tags?: Record<string, string>;
}

export interface IngestionResult {
  incidentId: string;
  grouped: boolean;
  incidentTitle: string;
  alertId: string;
  similarityScore: number;
  slackNotified: boolean;
  noiseReductionPercent: number;
}

/**
 * High-throughput, resilient alert ingestion engine.
 */
export async function ingestAlert(
  input: IngestAlertInput,
  apiKey?: string
): Promise<IngestionResult> {
  const user = apiKey ? db.getUserByApiKey(apiKey) || db.getUser() : db.getUser();
  const severity: Severity = input.severity || 'medium';

  // Run alert through LangGraph triage pipeline
  const result = await runLangGraphAlertTriage(
    {
      service: input.service || 'unknown-service',
      message: input.message || 'Unknown error occurred',
      severity,
      stack: input.stack,
      tags: input.tags,
    },
    user._id
  );

  let slackNotified = false;

  // If new incident or escalated, dispatch notification
  if (result.shouldNotify) {
    await sendSlackIncidentNotification(user, result.incident, result.isNew, result.escalated);
    result.incident.slackNotificationSent = true;
    result.incident.notifiedAt = new Date().toISOString();
    db.updateIncident(result.incident._id, result.incident);
    slackNotified = true;
  }

  const stats = db.getStats();

  // Broadcast realtime update to connected SSE clients
  db.emit('alert:ingested', {
    alert: result.alert,
    incident: result.incident,
    isNew: result.isNew,
    stats,
  });

  return {
    incidentId: result.incident._id,
    grouped: !result.isNew,
    incidentTitle: result.incident.title,
    alertId: result.alert._id,
    similarityScore: result.alert.similarityScore || 1.0,
    slackNotified,
    noiseReductionPercent: stats.noiseReductionPercent,
  };
}
