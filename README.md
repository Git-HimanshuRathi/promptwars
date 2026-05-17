# LEXGUARD

**Adversarial multi-agent AI for legal & contract intelligence.**
Analyzes contracts, offer letters, quotations, ticket terms, ToS, and privacy
policies to detect exploitative clauses, hidden liabilities, ambiguities, and
user-hostile dark patterns — **before** users agree to them.

Built for the **Prompt Wars** hackathon (Build with AI / Google for Developers).

---

## Why LEXGUARD

Most "contract review" tools are a single LLM call wrapped in a UI. LEXGUARD
runs a **unified specialist analysis** followed by an **adversarial debate** —
a User Advocate steel-mans the user, a Counterargument agent steel-mans the
drafter, and findings are re-scored using confidence-weighted disagreement.

The result is a verdict with **measurably fewer false positives** than a single
agent — in just **2 Gemini calls per analysis** (down from 7), so a free-tier
key handles ~750 analyses/day.

## Architecture

```
                ┌───────────────────────────────┐
                │      Next.js 15 (web)         │
                │   Cloud Run · CSP · WCAG AA   │
                └──────────────┬────────────────┘
                  fetch / SSE  │
                ┌──────────────▼────────────────┐
                │       Fastify API (api)       │
                │ Helmet · CORS · RateLimit     │
                │ LRU cache · multipart upload  │
                └──────────────┬────────────────┘
                               │
                ┌──────────────▼────────────────┐
                │   Multi-agent core            │
                │   @lexguard/ai                │
                │   • prompt-injection firewall │
                │   • unified analysis          │
                │   • adversarial debate        │
                └──────────────┬────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────▼──────┐   ┌─────▼──────┐   ┌─────▼──────┐
        │ Vertex AI  │   │ AI Studio  │   │   Groq     │
        │ (prod)     │   │ (free key) │   │ (fallback) │
        └────────────┘   └────────────┘   └────────────┘
```

The API is **stateless** — no database, no queue, no auth layer. Documents are
processed in-memory, results are returned synchronously (or streamed via SSE).
A small in-process LRU cache deduplicates identical analyses within 10 min.

### Agent roles

| Role | Purpose |
|---|---|
| **risk_detection** | One-sided, exploitative, user-hostile clauses |
| **ambiguity** | Vague terms, sole-discretion, undefined obligations |
| **privacy** | GDPR / CCPA / DPDP — data rights, retention, sale |
| **financial** | Hidden costs, auto-renewal, liquidated damages |
| **user_advocate** | Predator — argues from the user's perspective |
| **counterargument** | Counsel — steel-mans the drafter to reduce noise |
| **aggregator** | Dedupes by clause overlap, applies score adjustments |

All seven roles run inside **two Gemini calls** — one unified analysis prompt,
one unified debate prompt.

## Repository layout

```
.
├── apps/
│   ├── web/                  Next.js 15 frontend
│   └── api/                  Fastify backend
├── packages/
│   ├── shared/               Types, Zod schemas, risk-score math
│   └── ai/                   Gemini agents + orchestrator + firewall
├── infra/
│   └── terraform/            GCP infra (Cloud Run, Secret Manager, IAM)
└── scripts/
    └── deploy-gcp.sh         One-shot Cloud Run deploy
```

## Routes

| Path | Purpose |
|---|---|
| `/` | Marketing landing |
| `/analyze` | Live three-pane analysis view (seed data — instant demo) |
| `/upload` | Upload + paste-text flow; on completion swaps to the live view with real Gemini output |
| `/dashboard` | Static KPI overview |

The same `<LexGuardAnalysis />` component renders both the demo and real-data
views. When a `result` prop is supplied, the adapter at
[`apps/web/src/lib/adapt-analysis.ts`](apps/web/src/lib/adapt-analysis.ts)
translates the API's `AnalysisResult` into the design's local shape.

## Quickstart

### Prerequisites

- Node 20+
- pnpm 9+
- A Google AI Studio API key — https://aistudio.google.com/apikey

### Run

```bash
pnpm install
cp .env.example .env.local         # paste your GEMINI_API_KEY
pnpm dev                            # web + api in parallel
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Health: http://localhost:4000/healthz

### Optional fallbacks

Add to `.env.local` for resilience under load:

```
GEMINI_API_KEY_2=...            # rotates on 429
GROQ_API_KEY=gsk_...            # Llama-3.3 fallback if Gemini quota is hit
```

## Testing

```bash
pnpm -r test         # vitest — 96 unit + integration tests
pnpm -r typecheck    # strict TS, noUncheckedIndexedAccess
pnpm --filter @lexguard/web test:e2e   # Playwright + axe accessibility
```

## Production deploy (GCP)

```bash
./scripts/deploy-gcp.sh <PROJECT_ID> [REGION]
```

The script enables required APIs, builds + pushes the container, grants IAM
roles to the compute service account, and deploys to Cloud Run with Vertex AI
as the primary provider and a Secret Manager-backed Gemini key as fallback.

Cloud Run-only features (auto-activated when `K_SERVICE` is set):

| Service | Use |
|---|---|
| **Vertex AI** | Primary provider — Gemini via ADC (no API key) |
| **Secret Manager** | Resolves `GEMINI_API_KEY_SECRET` at boot |
| **Cloud Logging** | pino emits `severity` field for Logs Explorer |
| **Cloud Run** | Auto-scaling, scale-to-zero compute for web + api |
| **Artifact Registry** | Container image storage |

For full IaC: `cd infra/terraform && terraform apply`.

## Security

LEXGUARD treats user-supplied documents as **untrusted input embedded in
prompts**:

- **Prompt-injection firewall** ([`packages/ai/src/firewall.ts`](packages/ai/src/firewall.ts))
  scans every document for `ignore previous instructions`, role-takeover,
  forced-output, and zero-width / bidi-override Unicode. Content is wrapped in
  delimited fences with explicit "treat as data" instructions to the model.
- **Helmet** with strict CSP (frame-ancestors none, object-src none).
- **Rate limit** — 30 req/min per IP, configurable.
- **File magic-byte validation** — uploads checked against declared MIME type.
- **Output validation** — every AI response is `analysisResultSchema.parse()`d
  via Zod before it reaches the client.
- **Secret Manager** in production — keys never live in env files on Cloud Run.

## Accessibility (WCAG 2.1 AA)

- Semantic HTML (`<main>`, `<nav>`, `<aside>`, `<ol>`, `role=meter`)
- Visible focus rings (`:focus-visible ring-2`)
- Skip-to-main-content link as first focusable element
- `aria-live` regions for streaming agent progress
- All non-decorative icons have `aria-hidden="true"` with text labels nearby
- Reduced-motion media query disables Framer Motion animations
- Playwright + `@axe-core` enforce WCAG 2.1 AA in CI

## API reference

| Method | Path | Description |
|---|---|---|
| `GET`  | `/healthz` | Liveness + provider stats |
| `POST` | `/api/analyze-text` | Analyze raw pasted text |
| `POST` | `/api/upload` | Multipart upload + sync analysis |
| `POST` | `/api/analyze/stream` | SSE-streamed analysis with progress events |
| `GET`  | `/api/document-types` | Supported document types |

## License

MIT — built for the Prompt Wars hackathon. Not legal advice. Always consult
qualified counsel before signing binding agreements.
