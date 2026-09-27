This prototype runs a ShopSphere storefront, its API and payment simulator, the BugLens dashboard, and the BugLens AI Investigator. Reports are saved in browser storage; there is no report database yet. The investigator uses evidence-based rules without a Gemini key and Gemini when `GEMINI_API_KEY` is configured.
# Development Guide

This prototype runs a ShopSphere storefront, its API and payment simulator, and the BugLens dashboard. The investigator currently uses local evidence-based rules and browser storage; no external AI service or database is required.

## Prerequisites

- Docker Desktop with Docker Compose
- Or Python 3.11+ and Node.js 18+ for local service runs

## Start the full stack

From the repository root:

```bash
docker compose up --build
```

The services are available at:

- ShopSphere storefront: http://localhost:3000
- BugLens dashboard: http://localhost:3001
- ShopSphere API and Swagger docs: http://localhost:8000/docs
- Payment mock: http://localhost:8003/health
- AI Investigator docs: http://localhost:8002/docs

## Import failures and export ShopSphere

In the dashboard, select **Import ShopSphere** to load the four starter defect reports and any captured failures. The storefront automatically reports its incorrect price sort to the API; failed checkout requests are captured by the backend. Failed pytest cases are posted automatically when the API is running.
New dashboard investigations and imported failures are sent to the AI Investigator. Set `GEMINI_API_KEY` in the shell or a root `.env` file to use Gemini; without it, the service reports `rules-demo` mode and marks generated reports with `RULE_BASED_FALLBACK`. Gemini quota exhaustion uses evidence-based rules and marks the report for human review.
The report database from the original prototype plan is not part of the current runnable stack.

Select **Export application** in the dashboard to download `ShopSphere-source.zip`. The archive contains the storefront, API, payment simulator, compose configuration, and tests; it excludes dependencies and build output.

## Run services locally

Install backend packages with `pip install -r apps/shopsphere/backend/requirements.txt`, then run the API:

```bash
cd apps/shopsphere/backend
uvicorn main:app --reload --port 8000
```

Run the payment simulator in another terminal with its requirements and `uvicorn main:app --reload --port 8003` from `apps/shopsphere/payment-mock`. Run the storefront with `npm install` and `npm run dev` from `apps/shopsphere/frontend`. Run the dashboard with `npm install` and `npm run dev` from `apps/dashboard`.

## Run the QA suite

Install the test dependencies with `pip install -r automation/requirements.txt`, start the full stack, then run:

```bash
pytest automation/tests/test_shopsphere.py -v
```

Three tests are expected to fail while the intentional backend defects are present. The pytest hook attempts to post each failure to ShopSphere at `/api/buglens/failures`; use **Import ShopSphere** to bring them into the dashboard.

## Intentional defects

- Cart subtotal omits item quantity.
- Coupon payments fail intermittently (60% default failure rate).
- Failed payments clear the cart and leave the order pending.
- **Price: low to high** sorts products from high to low.

These are QA targets, not recommended production behavior. See [apps/shopsphere/README.md](apps/shopsphere/README.md) for details.
