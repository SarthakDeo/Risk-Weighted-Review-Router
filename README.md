# Risk-Weighted Review Router — Combined Service

This project combines both workstreams. Person A owns risk ingestion, the risk map, scoring, and feedback. Person B's workflow layer receives GitHub webhooks, routes reviewers, annotates pull requests, and enforces approval gates.

## Overview

The service ingests:
- git history
- incident/postmortem records
- sensitivity tags

It builds a risk map and exposes:
- `POST /score`
- `POST /webhook` for GitHub `pull_request` and `pull_request_review` events
- `GET /health`
- nightly refresh pipeline
- explainable scoring reasons
- Postgres-ready schema and migrations

## Local development

### Backend

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start Postgres for the persistent risk map:
   ```bash
   docker compose up -d postgres
   ```
3. Run migrations:
   ```bash
   $env:DATABASE_URL = 'postgresql://riskuser:riskpass@localhost:5432/risk_router'
   npm run db:migrate
   ```
4. Start the backend service:
   ```bash
   npm run dev
   ```

### Frontend

The frontend is a React + Vite app located in the `frontend/` directory.

5. In a separate terminal, install frontend dependencies and start the dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The UI is available at **http://localhost:5173**.
   API calls are proxied to the backend on port 3000 automatically.

### Docker (frontend only)

To run the frontend via Docker Compose:
```bash
docker compose up frontend
```

### Test the API directly
```bash
curl -X POST http://localhost:3000/score \
  -H 'Content-Type: application/json' \
  -d '{"pr_id":"PR-123","changed_files":["services/payments/charge.go"]}'
```

## API contract

Request:
```json
{
  "pr_id": "PR-123",
  "changed_files": [
    "services/payments/charge.go",
    "services/payments/refund.go"
  ]
}
```

Response:
```json
{
  "risk_score": 0.87,
  "risk_tier": "high",
  "driving_files": [
    "services/payments/charge.go"
  ],
  "driving_reasons": [
    "3 incidents in 180d",
    "tagged: payments",
    "blast radius 14"
  ],
  "related_incidents": [
    "INC-2041",
    "INC-1988"
  ]
}
```

## Configuration

Edit the YAML files under `config/` to adjust:
- scoring weights
- normalization limits
- risk thresholds
- hotfix/bugfix keywords
- sensitivity tags

## Scripts

- `npm run risk-map:refresh` — rebuild the risk map from git + incidents + tags
- `npm run db:migrate` — apply Postgres migrations
- `npm run db:rollback` — roll back the most recent migration
- `npm test` — run the automated test suite

## Important constraints

- Person A owns the risk computation boundary and stable `/score` contract.
- Person B owns the GitHub webhook, routing, annotation, and approval gate layers.
- Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, and `GITHUB_WEBHOOK_SECRET` to enable GitHub workflow events.
- Set `SCORING_SERVICE_STUB=true` only for workflow demos; the unified pipeline otherwise calls the in-process Person A scorer.
- The scoring contract is intentionally stable.
