# Development Guide

This guide explains how to set up the BugLens AI workspace locally and run the app stack.

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker and Docker Compose
- Git
- An Anthropic API key

## Environment setup

Create a local environment file:

```bash
cp .env.example .env
```

Populate the values in `.env`:

```env
ANTHROPIC_API_KEY=your_key_here
POSTGRES_DB=buglens
POSTGRES_USER=buglens
POSTGRES_PASSWORD=buglens
```

## Start services

```bash
docker compose up --build -d
```

This should start the backend, frontend, AI investigator, mock payment API, and supporting infrastructure.

## Run the test suite

```bash
pytest automation/tests/test_shopsphere.py -v
```

## Local app endpoints

- Frontend: http://localhost:3000
- Dashboard: http://localhost:3001
- ShopSphere backend: http://localhost:8000
- AI investigator: http://localhost:8002
- Mock payment API: http://localhost:8003

## Troubleshooting

### Docker build issues

- Ensure Docker is running
- Rebuild with clean cache if needed:

```bash
docker compose down -v
docker compose up --build -d
```

### Missing API key

The AI investigator needs a valid `ANTHROPIC_API_KEY` in `.env`.

### Test failures not appearing

Check the generated artifacts in `data/failures/` and `data/test_runs/`.
