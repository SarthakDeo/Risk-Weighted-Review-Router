# Risk-Weighted Review Router — Person A

This project implements the backend risk intelligence for the Risk-Weighted Review Router. It is completely separated from the GitHub workflow layer and exposes a stable scoring API for Person B.

## Overview

The service ingests:
- git history
- incident/postmortem records
- sensitivity tags

It builds a risk map and exposes:
- `POST /score`
- nightly refresh pipeline
- explainable scoring reasons
- Postgres-ready schema and migrations

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start Postgres if you want the database-backed mode:
   ```bash
   docker compose up -d postgres
   ```
3. Run migrations:
   ```bash
   DATABASE_URL=postgresql://riskuser:riskpass@localhost:5432/risk_router npm run db:migrate
   ```
4. Start the service:
   ```bash
   npm run dev
   ```
5. Test the API:
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

- Person A owns the risk computation boundary.
- Person B only sends the PR and changed file list.
- No GitHub webhook or GitHub check code exists here.
- The scoring contract is intentionally stable.
