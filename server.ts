import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { ingestAlert } from './server/agent/groupingEngine';
import { runSimulationStorm, STORM_SCENARIOS, getStormStatus } from './server/simulations';
import { sendSlackIncidentNotification } from './server/slack';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Middleware to extract API key from Authorization header or query param
function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let apiKey = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7).trim();
  } else if (req.query.apiKey) {
    apiKey = String(req.query.apiKey).trim();
  }

  const user = apiKey ? db.getUserByApiKey(apiKey) : null;
  // If valid API key found, attach user; otherwise default to primary demo user for ease of testing
  (req as any).user = user || db.getUser();
  next();
}

// ----------------------------------------------------
// REST API ROUTES
// ----------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AlertGuard Engine', timestamp: new Date().toISOString() });
});

// Auth & User Profile
app.get('/api/auth/me', (req, res) => {
  const user = db.getUser();
  res.json({ user });
});

app.post('/api/auth/regenerate-key', (req, res) => {
  const newKey = db.regenerateApiKey();
  res.json({ apiKey: newKey, user: db.getUser() });
});

// Ingest an alert (Called by SDK or test bench)
app.post('/api/alerts', authenticateApiKey, async (req, res) => {
  try {
    const { service, message, severity, stack, tags } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Alert message is required' });
    }

    const authKey = req.headers.authorization?.replace('Bearer ', '') || (req as any).user.apiKey;
    const result = await ingestAlert(
      {
        service: service || 'express-app',
        message,
        severity: severity || 'medium',
        stack,
        tags,
      },
      authKey
    );

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Alert ingestion error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Batch ingestion for storms
app.post('/api/alerts/batch', authenticateApiKey, async (req, res) => {
  try {
    const { alerts } = req.body;
    if (!Array.isArray(alerts)) {
      return res.status(400).json({ error: 'Array of alerts expected in req.body.alerts' });
    }

    const authKey = (req as any).user.apiKey;
    const results = [];
    for (const item of alerts) {
      const r = await ingestAlert(item, authKey);
      results.push(r);
    }

    res.json({ processed: results.length, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Raw alerts feed
app.get('/api/alerts', (req, res) => {
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  const incidentId = req.query.incidentId ? String(req.query.incidentId) : undefined;
  const alerts = db.getAlerts(limit, incidentId);
  res.json({ alerts, count: alerts.length });
});

// Incidents list
app.get('/api/incidents', (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const severity = req.query.severity ? String(req.query.severity) : undefined;
  const search = req.query.q ? String(req.query.q) : undefined;

  const incidents = db.getIncidents(status, severity, search);
  res.json({ incidents, count: incidents.length });
});

// Single incident detail
app.get('/api/incidents/:id', (req, res) => {
  const incident = db.getIncidentById(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  const alerts = db.getAlerts(200, req.params.id);
  res.json({ incident, alerts });
});

// Resolve incident
app.post('/api/incidents/:id/resolve', (req, res) => {
  const updated = db.resolveIncident(req.params.id);
  if (!updated) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  res.json({ incident: updated, success: true });
});

// Stats
app.get('/api/stats', (req, res) => {
  const stats = db.getStats();
  res.json(stats);
});

// Settings: Slack Webhook
app.post('/api/settings/slack', async (req, res) => {
  const { slackWebhookUrl } = req.body;
  const user = db.updateUser({ slackWebhookUrl });

  // If user provided a webhook URL, optionally send a test verification message
  if (slackWebhookUrl && slackWebhookUrl.startsWith('http')) {
    try {
      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🛡️ *AlertGuard Connected!* Your Slack webhook has been verified. Future consolidated incident alerts will arrive in this channel.`,
        }),
      });
    } catch (err) {
      console.warn('Slack verification ping error:', err);
    }
  }

  res.json({ user, success: true });
});

// Settings: Grouping parameters
app.post('/api/settings/grouping', (req, res) => {
  const { similarityThreshold, timeWindowMinutes, enableLangGraphTriage } = req.body;
  const user = db.getUser();
  const updated = db.updateUser({
    settings: {
      ...user.settings,
      similarityThreshold: typeof similarityThreshold === 'number' ? similarityThreshold : user.settings.similarityThreshold,
      timeWindowMinutes: typeof timeWindowMinutes === 'number' ? timeWindowMinutes : user.settings.timeWindowMinutes,
      enableLangGraphTriage: typeof enableLangGraphTriage === 'boolean' ? enableLangGraphTriage : user.settings.enableLangGraphTriage,
    },
  });
  res.json({ settings: updated.settings, success: true });
});

// Slack message history (Simulator stream)
app.get('/api/slack/messages', (req, res) => {
  const messages = db.getSlackMessages();
  res.json({ messages });
});

// LangGraph audit logs
app.get('/api/langgraph/logs', (req, res) => {
  const logs = db.getLangGraphLogs(80);
  res.json({ logs });
});

// Simulations
app.get('/api/simulate/scenarios', (req, res) => {
  res.json({ scenarios: STORM_SCENARIOS });
});

app.get('/api/simulate/status', (req, res) => {
  res.json(getStormStatus());
});

app.post('/api/simulate/storm', async (req, res) => {
  const { scenarioId, alertCount, speedMs } = req.body;
  try {
    const result = await runSimulationStorm(scenarioId, alertCount, speedMs);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/simulate/reset', (req, res) => {
  db.resetDatabase();
  res.json({ success: true, message: 'Database reset to initial demo state' });
});

// Server-Sent Events (SSE) for Real-Time UI Updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

  const unsubscribe = db.subscribe((event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (err) {
      console.warn('SSE write error:', err);
    }
  });

  // Heartbeat every 20 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ----------------------------------------------------
// VITE & STATIC SERVING INTEGRATION
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`AlertGuard Server listening at http://localhost:${PORT}`);
  });
}

startServer();
