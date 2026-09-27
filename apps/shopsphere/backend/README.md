# ShopSphere Store API

FastAPI product, cart, checkout, Gemini chat, BugLens evidence, and source-export endpoints. Run with `uvicorn main:app --reload --port 8000` after installing `requirements.txt`.

Set `GEMINI_API_KEY` before starting the API to enable `POST /api/chat`. The optional `GEMINI_MODEL` variable defaults to `gemini-3.8-flash`.

The API includes three documented QA defects: cart subtotal omits item quantity, coupon payments intermittently fail in the payment mock, and failed payment clears the cart while leaving the order pending. Live checkout errors are captured at `/api/buglens/failures`.
