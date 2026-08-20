# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo developers, small SaaS founders, and indie teams who are their own on-call engineer. They're watching a deployment fail at 3am, flooded with hundreds of near-identical alerts from a single broken database connection — and they don't have a PagerDuty budget.

## Product Purpose

AlertGuard reduces alert fatigue by collapsing hundreds of noisy, duplicate monitoring alerts into a handful of meaningful incidents. Where tools like PagerDuty use exact-match deduplication (fingerprint/`dedup_key`), AlertGuard adds semantic grouping via embeddings — differently-worded alerts sharing a root cause collapse into one incident, even across services. Success is when an engineer under pressure sees 3 incidents instead of 500 raw alerts and acts on the right one.

## Positioning

PagerDuty-style AI alert grouping as a 3-line npm install — free, for solo devs and small teams who can't justify enterprise tooling. The differentiator is semantic similarity (LangChain embeddings + cosine distance) catching root-cause groups that exact-match tools miss, proven by a live "Noise Reduction Ratio" metric.

## Operating Context

- Engineers install the npm SDK (`alertguard-sdk`), wrap try/catch blocks or attach Express middleware, and paste an API key from the dashboard
- The dashboard is the primary monitoring surface: live Incident Feed, raw vs. grouped toggle, Noise Reduction Ratio
- Slack webhooks deliver new/escalating incident notifications — suppressed for duplicates
- A Storm Simulator lets judges and developers trigger synthetic alert floods to demo the grouping in real time
- LangGraph agent handles borderline grouping decisions (0.70–0.83 cosine similarity range), reasoning about whether two differently-worded alerts share a root cause
- Real-time updates via Server-Sent Events

## Capabilities and Constraints

- Backend: Express + MongoDB + LangChain + LangGraph + Gemini embeddings
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Tabs/views: Incidents, LangGraph Pipeline Visualizer, SDK Integration Hub, Slack Simulator, Custom Alert Dispatcher, Analytics
- Metrics: Total Alerts, Grouped Incidents, Suppressed Notifications, Noise Reduction Ratio (the headline number)
- Real-time SSE streaming for all data updates
- npm SDK is the developer integration surface; API key auth via Bearer token
- Storm Simulator: 4 preset scenarios (DB outage, OOM cascade, payment gateway failure, etc.)

## Brand Commitments

Name: AlertGuard. Tagline direction: "noise → signal." Version shown: v2.4.1. Stack badge shown to judges: MERN+LANGGRAPH.

## Evidence on Hand

- Live working dashboard with real SSE-powered incident feed
- Storm simulator for judge demo (fires synthetic alert floods and shows real-time grouping)
- LangGraph pipeline with 6 named nodes (Input Normalizer → Fingerprint → Dense Embeddings → Cosine Distance → Gemini Arbitrator → Slack Gatekeeper)
- Noise Reduction Ratio metric (live, animated)
- npm SDK integration code (3-line integration example)
- Slack webhook integration

## Product Principles

1. **Signal over noise** — every design decision prioritizes showing what matters, not what arrived.
2. **Transparency of mechanism** — the LangGraph pipeline is visible, not hidden. Judges and users should understand why two alerts were grouped.
3. **Confidence at 3am** — the interface must work for an engineer under stress: fast scanning, clear severity, zero ambiguity.
4. **Proof over claim** — the Noise Reduction Ratio is the product's single most important number; it must be unmissable.
5. **SDK simplicity** — the integration story is 3 lines of code; the dashboard should feel like the natural companion to those 3 lines.
