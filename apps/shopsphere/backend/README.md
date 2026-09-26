# ShopSphere Store API

FastAPI product, cart, checkout, BugLens evidence, and source-export endpoints. Run with `uvicorn main:app --reload --port 8000` after installing `requirements.txt`.

The API includes three documented QA defects: cart subtotal omits item quantity, coupon payments intermittently fail in the payment mock, and failed payment clears the cart while leaving the order pending. Live checkout errors are captured at `/api/buglens/failures`.
