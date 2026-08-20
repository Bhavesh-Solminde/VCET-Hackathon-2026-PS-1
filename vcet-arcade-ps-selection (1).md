# VCET Arcade — 30hr Hackathon: Problem Statement Selection

**Stack:** MERN, LangGraph, LangChain, React Native, Next.js
**Task:** Select 2 of 5 problem statements

---

## The 5 Problem Statements

1. **Predictive Cloud-Cost Caching Engine** — dynamic TTL adjustment based on traffic patterns + a "$ saved" dashboard
2. **Static Resource-Leak Guard for CI/CD** — parse code to detect unclosed resources (files, DB connections, sockets), fail builds with auto-patch suggestions
3. **Intelligent Alert Fatigue Reducer** — group/deduplicate noisy monitoring alerts into single incidents
4. **Token-Diet Dynamic Context Compressor** — strip filler text from RAG-retrieved chunks before hitting the LLM
5. **Zero-Copy Binary API Gateway** — replace JSON with Protobuf/Arrow to cut CPU overhead

---

## Selection Parameters Used

**General PS-fit parameters:**
- Time-to-first-demo
- Stack fit (does MERN/LangChain/LangGraph genuinely help, or is it forced?)
- Judging weight vs effort ratio
- Data availability
- Differentiation potential (how many other teams pick this?)
- Team skill alignment
- Scope truncation safety (does a half-done version still look coherent?)

**What makes a PS *inherently* good or bad (regardless of team fit):**
- Clear, bounded problem (one sentence, no "and also")
- Unambiguous success criteria
- Real, specific pain point (not buzzword mashup)
- Reasonable scope for time given
- Doesn't secretly require access/data you don't have
- Room for a visible demo
- Not oversaturated / doesn't write the solution for you
- Judging rubric exists or is inferable

**Added later:** Impressiveness — how much judges are wowed if executed perfectly.

---

## Initial Scoring (before web research)

| # | PS | Score /100 |
|---|---|---|
| 4 | Context Compressor | 88 |
| 3 | Alert Fatigue Reducer | 75 |
| 1 | Cache Eviction | 68 |
| 5 | Zero-Copy Binary Gateway | 50 |
| 2 | Resource-Leak Guard | 40 |

---

## Web Research — Why the Ranking Changed

### PS4 (Context Compressor) — DOWNGRADED
Turned out to be a near-exact match for existing LangChain tutorials (`ContextualCompressionRetriever`, `LLMChainExtractor`/`LLMChainFilter`, Microsoft's LLMLingua). With 50 teams using Claude, everyone independently converges on the same build. **Zero differentiation potential** — dropped as a pick despite high raw score.

### PS3 (Alert Fatigue Reducer) — PROMOTED to golden project
Research showed real tools (PagerDuty, Alertmanager, FireHydrant) mostly use **exact-match deduplication** (`dedup_key`/fingerprint-based). Semantic grouping of *differently-worded* alerts sharing a root cause is a genuine, underserved gap — validated by real complaints (e.g., GitHub issue on Alertmanager's grouping being "not very useful"). This is where LangChain embeddings add real, provable value instead of being bolted on.

### PS1 (Cache Eviction) — kept as safe #2
Research showed this space is dominated by classical/statistical approaches (d-TTL/f-TTL algorithms, adaptive control planes like MIDAS, Redis refresh-ahead). Legitimate engineering problem, but LangChain/LangGraph have no natural role — would be forced in. Safe, demo-friendly ($-saved dashboard), but lower novelty ceiling. A technically sharp judge could point out adaptive caching already exists.

### PS2 (Resource-Leak Guard) — ruled out
Actually a **static-analysis/compiler problem**, not a web-app problem. Requires AST parsing (`@babel/parser`, `ts-morph`, or `tree-sitter`) and control-flow tracing — a completely different discipline from MERN dev. No natural fit for MongoDB, React, LangGraph, RN, or Next.js. High risk (hard to get right, embarrassing if wrong on judge's live example), low visual payoff (just pass/fail CLI output).

### PS5 (Zero-Copy Binary Gateway) — ruled out
A **systems/infra performance problem**. Requires Protobuf/gRPC or Apache Arrow, byte-level optimization, load testing — none of it natural to your stack except the results dashboard (React). Even executed perfectly, the "wow" only lands with judges who understand serialization overhead — low emotional/visual payoff for a general panel.

---

## Final Pick

- **Golden project: PS3 — Alert Fatigue Reducer**
- **Second pick: PS1 — Predictive Cloud-Cost Caching Engine**

Both share: natural stack fit, visually intuitive demos for any judge, and graceful failure (a half-finished version still looks like a coherent product).

---

## PS3 Deep Dive — Alert Fatigue Reducer

### The Problem (plain-language)
Monitoring systems fire hundreds of near-identical alerts for one underlying issue (e.g., "CPU high" x500). Engineers become desensitized to the noise and miss real emergencies buried in the spam.

### The Approach
1. **Alerts come in** — apps POST alert data to your system (simulated via a fake alert generator for the demo)
2. **Decide if alerts are "the same problem"**
   - Baseline: exact-match dedup (like PagerDuty's `dedup_key`) — the safety net
   - Differentiator: embedding-based semantic similarity — group *differently worded* alerts that share a root cause, even across services
3. **Bundle into incident threads** — 500 raw alerts collapse into a handful of incidents on a dashboard
4. **Only notify for what's new/critical** — silent for repeats of a known incident, alert only on new incidents or severity escalation
5. **Show the impact** — live dashboard with a "Noise Reduction Ratio" and a raw-vs-grouped toggle

### Tech Mapping
| Piece | Tool |
|---|---|
| API to receive alerts | Express |
| Store alerts/incidents | MongoDB |
| Alert → meaning vectors | LangChain + embedding model |
| Similarity grouping | Cosine similarity |
| Borderline-case reasoning (stretch) | LangGraph agent |
| Dashboard | React |
| Notifications | Slack webhook |

### MVP Scope
- **Must-have:** backend + exact-match grouping + dashboard + API key check + npm SDK
- **Differentiator:** embedding-based grouping, Noise Reduction Ratio metric, Slack notifications for new/escalating incidents only
- **Stretch:** LangGraph agent explaining *why* it grouped two alerts, `npm publish` live during demo, Discord webhook alongside Slack

---

## Turning PS3 Into a Real npm Package

### Architecture — two pieces
1. **The "Brain"** — your hosted backend (Express + MongoDB + LangChain) doing the actual AI grouping and storage
2. **The npm package** — a thin client SDK devs install; it just forwards alerts to your Brain using an API key (same shape as the Stripe SDK model)

### Example dev integration
```js
const { AlertGuard } = require("alertguard-sdk");
const guard = new AlertGuard({ apiKey: "ag_live_xxxxxxx" });

try {
  await db.connect();
} catch (err) {
  guard.notify({ message: err.message, service: "checkout-api", severity: "high" });
}
```

### API key handling
- MongoDB `users` collection: `{ email, apiKey }`
- Simple middleware on the backend to validate the `Authorization: Bearer <key>` header
- Frontend: a dashboard where users generate their API key/secret

### Publishing
- Full `npm publish` is a stretch goal (nice if there's time), not core — the 3-line integration demo matters more than the registry listing itself.

---

## Real-World Use Cases (why anyone would actually use this)

1. **Startups with flaky backends** — intermittent DB drops causing alert floods; can't justify enterprise tooling cost
2. **Deployed student/side projects** — no one's watching logs at 3am; want lightweight "tell me something broke"
3. **Microservices sharing a root cause** — one DB outage can cause dozens of services to alert simultaneously with unrelated-looking error text; semantic grouping catches this where exact-match tools can't
4. **Cron jobs / background workers** — repeat-failure spam from the same broken scheduled job
5. **Solo devs / small SaaS founders** — their own on-call engineer, underserved by PagerDuty/FireHydrant/Rootly/ilert, which all target companies with budgets

**Pitch line:** "PagerDuty-style AI alert grouping, as a 3-line npm install — free, for solo devs and small teams, not just companies with budgets."

---

## Where Errors Come From (input side)

1. **Manual `guard.notify()` calls** — dev wraps their own try/catch, full control (core, must-build)
2. **Auto-capture** — SDK hooks into `uncaughtException`, `unhandledRejection`, and an Express error-handling middleware (`guard.expressErrorHandler()`) for true zero-config capture (differentiator, build if time allows)
3. **Pulling from existing sources** — tailing log files or ingesting Sentry/Datadog webhooks (stretch/roadmap only, don't build)

**Demo plan:** build a small dummy Express app with a few routes designed to throw errors (DB timeout, payment API failure), attach the SDK's middleware, then hammer it with a script simulating real traffic during the live demo — showing raw alert spam vs. grouped incidents in real time.

---

## Where Alerts Go (output side)

Decided to make notification delivery **pluggable**, not hardcoded to one channel — users paste their own webhook URL/token when setting up their API key.

| Channel | Setup effort | Demo reliability | Decision |
|---|---|---|---|
| Slack | Very low | Excellent | **Build this — primary** |
| Discord | Very low | Excellent | Build if time allows (near-identical code to Slack) |
| Telegram | Low-medium | Good | Skip, mention as roadmap |
| Email | Medium | Slow/laggy for live demo | Skip |
| SMS (Twilio) | High, costs money | Risky | Skip |

The in-app dashboard itself is the primary/always-on notification surface; Slack is the "proof this works outside our own UI too" layer.

---

## Second Problem Statement — Stack Reality Check

To make explicit why PS2 and PS5 don't fit despite being valid problems:

**PS2 (Resource-Leak Guard) would actually need:**
- AST parser (`@babel/parser`, `ts-morph`, or `tree-sitter`) for control-flow analysis
- GitHub Actions/CLI tooling, not a web app
- No natural role for MongoDB, React, LangGraph, RN, or Next.js
- LangChain only usable as a fallback explainer, not for core detection (too unreliable for a correctness tool)

**PS5 (Zero-Copy Binary Gateway) would actually need:**
- Protocol Buffers/gRPC (`protobufjs`, `grpc-js`) or Apache Arrow
- A raw binary-handling proxy layer — Express fights this rather than helping
- Load-testing tooling (`autocannon`, `k6`) for benchmarks
- No natural role for LangChain/LangGraph at all
- Only the results dashboard overlaps with the stated stack

Both are legitimate engineering problems, just belong to *devtools* and *systems/infra* respectively — not the *AI-powered web app* space the given stack is built for.
