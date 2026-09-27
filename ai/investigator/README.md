# BugLens AI Investigator

FastAPI service that accepts a ShopSphere/test failure and returns the dashboard's consolidated investigation report schema.

## Run locally

From this directory, install the dependencies and start the API:

```powershell
pip install -r requirements.txt
$env:GEMINI_API_KEY = "your-key"
uvicorn main:app --reload --port 8002
```

Without `GEMINI_API_KEY`, the service runs in `rules-demo` mode: deterministic, evidence-based analysis with `RULE_BASED_FALLBACK` in report metadata. With a key, it uses Gemini function calling to return the structured report. On quota exhaustion, it falls back to rules, adds `GEMINI_QUOTA_FALLBACK`, and requires human review.

- Health and mode: http://localhost:8002/api/health
- OpenAPI docs: http://localhost:8002/docs
- Analyze: `POST /api/analyze-failure`

Set `GEMINI_MODEL` to select the Gemini model (default `gemini-3.8-flash`) and `CORS_ORIGINS` to configure allowed dashboard origins.
