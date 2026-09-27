# ShopSphere QA Application

ShopSphere is a separate sample storefront built to exercise BugLens end to end. The stack includes a React storefront, FastAPI store API, a flaky payment simulator, automated regression tests, BugLens failure ingestion, and a source ZIP export.

## Run

From the repository root, start ShopSphere and BugLens together:

```bash
docker compose up --build
```

To enable the ShopSphere assistant, set your Gemini API key before starting the stack:

```powershell
$env:GEMINI_API_KEY = "your-api-key"
docker compose up --build
```

The assistant opens from the floating button in the lower-right corner. Set `GEMINI_MODEL` to override the default `gemini-3.8-flash` model. Keep the key on the backend; it is never sent to the browser.

- Storefront: http://localhost:3000
- API / OpenAPI: http://localhost:8000/docs
- Payment simulator: http://localhost:8003/health
- BugLens dashboard: http://localhost:3001

In the dashboard, choose **Import ShopSphere** to import the starter failures and any failures captured from live checkout or pytest. Choose **Export application** to download the ShopSphere source bundle.

The downloaded source bundle contains its own compose file. After extracting it, run `docker compose up --build` from the extracted `shopsphere` directory to launch ShopSphere without the BugLens dashboard.

## Intended QA targets

1. **Cart total:** adding two items shows one unit price in the subtotal. The item count and line total reveal the mismatch.
2. **Coupon checkout:** coupon-bearing payment requests fail randomly at a 60% default rate in the payment mock.
3. **Payment recovery:** failed checkout clears the cart and leaves the created order pending.
4. **Frontend price sort:** selecting **Price: low to high** orders products from high to low. The storefront posts evidence to `/api/buglens/failures` on first selection.

The first three defects have regression tests in `automation/tests/test_shopsphere.py`; those tests assert the expected correct behavior and therefore fail until the defects are fixed. A pytest hook posts failures to ShopSphere while the API is running.

## API endpoints

- `GET /api/products` catalog, optional `category` and `q` filters
- `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/{product_id}`, `DELETE /api/cart/items/{product_id}`
- `POST /api/checkout` simulated checkout
- `POST /api/chat` Gemini-powered shopping assistant
- `GET /api/buglens/failures` starter and captured failure evidence
- `POST /api/buglens/failures` record a frontend or test failure
- `GET /api/export` download a ZIP containing application source and QA tests