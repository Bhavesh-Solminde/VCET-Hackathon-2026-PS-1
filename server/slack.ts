import { Incident, SlackMessageRecord, User } from './types';
import { db } from './db';

/**
 * Sends a rich Block Kit formatted notification to the configured Slack Webhook
 * and logs it into the internal Slack Simulator stream.
 */
export async function sendSlackIncidentNotification(
  user: User,
  incident: Incident,
  isNew: boolean,
  isEscalation = false
): Promise<SlackMessageRecord> {
  const emoji = incident.severity === 'critical' ? '🔴' : incident.severity === 'high' ? '🟠' : incident.severity === 'medium' ? '🟡' : '🔵';
  const headerText = isNew
    ? `${emoji} [NEW INCIDENT] ${incident.title}`
    : isEscalation
    ? `🚨 [ESCALATION to ${incident.severity.toUpperCase()}] ${incident.title}`
    : `⚠️ [INCIDENT UPDATE] ${incident.title}`;

  const payload = {
    text: `${headerText}\nServices: ${incident.services.join(', ')} | Alerts: ${incident.alertCount}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: headerText.slice(0, 150),
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Severity:*\n\`${incident.severity.toUpperCase()}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Alerts Collapsed:*\n*${incident.alertCount}* raw errors`,
          },
          {
            type: 'mrkdwn',
            text: `*Affected Services:*\n${incident.services.map((s) => `\`${s}\``).join(' ')}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${incident.status === 'active' ? '🟢 Active' : '⚪ Resolved'}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Representative Error:*\n>${incident.representativeMessage.slice(0, 300)}`,
        },
      },
    ],
  };

  if (incident.rootCauseAnalysis) {
    payload.blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*AI Root Cause Hypothesis:*\n${incident.rootCauseAnalysis.probableRootCause}\n\n*Recommended Runbook Action:*\n${incident.rootCauseAnalysis.recommendedAction}`,
      },
    });
  }

  let status: 'delivered' | 'simulated' | 'failed' = 'simulated';
  let errorMessage: string | undefined;

  // If user configured a real webhook URL, attempt delivery
  if (user.slackWebhookUrl && user.slackWebhookUrl.startsWith('http')) {
    try {
      const response = await fetch(user.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        status = 'delivered';
      } else {
        status = 'failed';
        errorMessage = `HTTP ${response.status}: ${await response.text()}`;
      }
    } catch (err: any) {
      status = 'failed';
      errorMessage = err.message || 'Network error delivering to Slack';
    }
  }

  const record = db.addSlackMessage({
    channel: '#alerts-production',
    incidentId: incident._id,
    incidentTitle: incident.title,
    severity: incident.severity,
    services: incident.services,
    alertCount: incident.alertCount,
    isEscalation,
    rawPayload: payload,
    status,
    errorMessage,
  });

  return record;
}
