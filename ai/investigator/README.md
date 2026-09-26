# BugLens AI Investigator

FastAPI service that accepts a ShopSphere/test failure and returns the dashboard's consolidated investigation report schema.

## Run locally

From this directory, install the dependencies and start the API:

```powershell
pip install -r requirements.txt
$env:ANTHROPIC_API_KEY = "your-key"
uvicorn main:app --reload --port 8002
```

Without `ANTHROPIC_API_KEY`, the service runs in `rules-demo` mode: deterministic, evidence-based analysis with `RULE_BASED_FALLBACK` in report metadata. With a key, it uses Claude with a forced structured-report tool schema.

- Health and mode: http://localhost:8002/api/health
- OpenAPI docs: http://localhost:8002/docs
- Analyze: `POST /api/analyze-failure`

Set `ANTHROPIC_MODEL` to select the Claude model and `CORS_ORIGINS` to configure allowed dashboard origins.
