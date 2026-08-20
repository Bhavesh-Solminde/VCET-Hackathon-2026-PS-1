import { ingestAlert } from './agent/groupingEngine';
import { Severity } from './types';
import { db } from './db';

export interface StormScenario {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'third_party' | 'infrastructure' | 'multi_service';
  totalAlerts: number;
  expectedIncidents: number;
  expectedNoiseReduction: string;
  services: string[];
  templates: {
    service: string;
    messageTemplate: (i: number) => string;
    severity: Severity;
    stack?: string;
  }[];
}

export const STORM_SCENARIOS: StormScenario[] = [
  {
    id: 'postgres-pool-starvation',
    name: 'PostgreSQL Pool Starvation & Cascade 504s',
    description: 'Simulates 80 rapid errors across 4 microservices when checkout DB connection pool maxes out at 100 clients.',
    category: 'database',
    totalAlerts: 80,
    expectedIncidents: 1,
    expectedNoiseReduction: '98.8%',
    services: ['checkout-api', 'order-processor', 'inventory-service', 'payment-worker'],
    templates: [
      {
        service: 'checkout-api',
        messageTemplate: (i) => `Database connection pool exhausted: 100/100 active connections in checkout-db pool [req_id=ck_${i}_${Math.random().toString(36).substring(7)}]`,
        severity: 'critical',
        stack: 'Error: ConnectionPoolExhausted\n    at Pool.acquire (/app/node_modules/pg-pool/index.js:312:11)\n    at CheckoutController.createOrder (/app/src/controllers/checkout.js:42:18)',
      },
      {
        service: 'order-processor',
        messageTemplate: (i) => `Knex: Timeout acquiring a connection. The pool is probably full. Are you missing a .transacting(trx)? [thread_${i}]`,
        severity: 'critical',
        stack: 'KnexTimeoutError: Timeout acquiring a connection\n    at Client_PG.acquireConnection (/app/node_modules/knex/lib/client.js:312:26)',
      },
      {
        service: 'inventory-service',
        messageTemplate: (i) => `SequelizeConnectionAcquireTimeoutError: Operation timeout exceeded 10000ms waiting for available client [inv_${i}]`,
        severity: 'high',
      },
      {
        service: 'payment-worker',
        messageTemplate: (i) => `HTTP 504 Gateway Timeout: /api/v2/orders/checkout failed waiting for database lock [worker_job_${i}]`,
        severity: 'high',
      },
      {
        service: 'checkout-api',
        messageTemplate: (i) => `UnhandledRejection: Pool.query() timed out after 5000ms waiting for available client client_id=${i}`,
        severity: 'critical',
      },
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
      {
        service: 'billing-service',
        messageTemplate: (i) => `Stripe API Error (POST /v1/payment_intents): Request timed out after 30000ms [intent_id=pi_${i}_${Math.random().toString(36).substring(5)}]`,
        severity: 'high',
        stack: 'StripeConnectionError: Request timed out\n    at Request.callback (/app/node_modules/stripe/lib/StripeResource.js:142:15)',
      },
      {
        service: 'subscription-manager',
        messageTemplate: (i) => `StripeConnectionError: Could not connect to Stripe (api.stripe.com). SSL socket connection reset [sub_${i}]`,
        severity: 'high',
      },
      {
        service: 'billing-service',
        messageTemplate: (i) => `StripeRateLimitError: 429 Too many requests on account acct_1N9x82 during retry burst [attempt_${i}]`,
        severity: 'medium',
      },
      {
        service: 'mobile-checkout',
        messageTemplate: (i) => `PaymentIntent capture failed: upstream 504 timeout on card payment authorization [cart_${i}]`,
        severity: 'high',
      },
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
      {
        service: 'auth-service',
        messageTemplate: (i) => `OOM command not allowed when used memory > maxmemory on session-cache-02 [session_${i}]`,
        severity: 'high',
      },
      {
        service: 'session-gateway',
        messageTemplate: (i) => `RedisError: Maxmemory reached, failed to write session token key for user uid_${i}`,
        severity: 'high',
      },
      {
        service: 'user-profile-api',
        messageTemplate: (i) => `SessionLookupMiss: Fallback to database due to Redis connection refused on port 6379 [req_${i}]`,
        severity: 'medium',
      },
    ],
  },
  {
    id: 'triple-multi-cascade',
    name: 'Triple Multi-Cluster Chaos Storm (150 alerts)',
    description: 'Simultaneous database pool exhaustion + Stripe webhook failure + Redis eviction to test multi-bucket clustering.',
    category: 'multi_service',
    totalAlerts: 150,
    expectedIncidents: 3,
    expectedNoiseReduction: '98.0%',
    services: ['checkout-api', 'order-processor', 'billing-service', 'auth-service', 'session-gateway', 'payment-worker'],
    templates: [], // dynamically merged from above
  },
];

// Initialize templates for triple multi cascade
STORM_SCENARIOS[3].templates = [
  ...STORM_SCENARIOS[0].templates,
  ...STORM_SCENARIOS[1].templates,
  ...STORM_SCENARIOS[2].templates,
];

let isSimulating = false;
let activeStormProgress = {
  running: false,
  scenarioId: '',
  scenarioName: '',
  totalAlerts: 0,
  sentAlerts: 0,
  speedMs: 80,
};

export function getStormStatus() {
  return activeStormProgress;
}

export async function runSimulationStorm(
  scenarioId: string,
  alertCount = 50,
  delayMs = 60
): Promise<{ success: boolean; totalSent: number; scenario: StormScenario }> {
  if (isSimulating) {
    throw new Error('A simulation storm is already running');
  }

  const scenario = STORM_SCENARIOS.find((s) => s.id === scenarioId) || STORM_SCENARIOS[0];
  const count = alertCount || scenario.totalAlerts;

  isSimulating = true;
  activeStormProgress = {
    running: true,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    totalAlerts: count,
    sentAlerts: 0,
    speedMs: delayMs,
  };

  db.emit('storm:started', activeStormProgress);

  (async () => {
    try {
      for (let i = 0; i < count; i++) {
        const tmpl = scenario.templates[i % scenario.templates.length];
        const message = tmpl.messageTemplate(i + 1);

        await ingestAlert({
          service: tmpl.service,
          message,
          severity: tmpl.severity,
          stack: tmpl.stack,
        });

        activeStormProgress.sentAlerts = i + 1;
        db.emit('storm:progress', activeStormProgress);

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      isSimulating = false;
      activeStormProgress.running = false;
      db.emit('storm:completed', {
        ...activeStormProgress,
        stats: db.getStats(),
      });
    }
  })();

  return {
    success: true,
    totalSent: count,
    scenario,
  };
}
