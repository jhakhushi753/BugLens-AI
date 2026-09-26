from __future__ import annotations

import io
import json
import logging
import os
import urllib.error
import urllib.request
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shopsphere")

app = FastAPI(title="ShopSphere Store API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PRODUCTS: list[dict[str, Any]] = [
    {"id": "p-001", "name": "Forma Everyday Sneaker", "category": "Footwear", "price": 129.00, "compare_at": 159.00, "rating": 4.8, "reviews": 124, "color": "Chalk / Moss", "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85", "tag": "BESTSELLER", "description": "A lightweight everyday sneaker with recycled knit and a cushioned cork footbed."},
    {"id": "p-002", "name": "Arc Wireless Headphones", "category": "Technology", "price": 189.00, "compare_at": None, "rating": 4.9, "reviews": 87, "color": "Ink", "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85", "tag": "NEW", "description": "Studio-tuned wireless audio, soft memory-foam cushions, and 36-hour battery life."},
    {"id": "p-003", "name": "Field Notes Weekender", "category": "Accessories", "price": 98.00, "compare_at": 120.00, "rating": 4.7, "reviews": 56, "color": "Natural / Olive", "image": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=85", "tag": "-18%", "description": "A durable canvas carryall with a padded sleeve and easy-access pockets."},
    {"id": "p-004", "name": "Stillpoint Table Lamp", "category": "Home", "price": 146.00, "compare_at": None, "rating": 4.6, "reviews": 42, "color": "Warm white", "image": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85", "tag": None, "description": "A sculptural, dimmable lamp with a brushed-aluminum stem and linen shade."},
    {"id": "p-005", "name": "Tempo Field Watch", "category": "Accessories", "price": 235.00, "compare_at": 280.00, "rating": 4.9, "reviews": 109, "color": "Silver / Forest", "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85", "tag": "LIMITED", "description": "A clean, water-resistant timepiece with a brushed steel case and recycled strap."},
    {"id": "p-006", "name": "Studio Chair No. 4", "category": "Home", "price": 320.00, "compare_at": None, "rating": 4.8, "reviews": 31, "color": "Sage / Ash", "image": "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=85", "tag": None, "description": "A compact lounge chair shaped for slow mornings and long reading sessions."},
    {"id": "p-007", "name": "Cloudline Camera", "category": "Technology", "price": 449.00, "compare_at": 499.00, "rating": 4.7, "reviews": 64, "color": "Silver", "image": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85", "tag": "SAVE $50", "description": "A pocket-sized mirrorless camera for bright, detailed everyday photography."},
    {"id": "p-008", "name": "Drift Overshirt", "category": "Apparel", "price": 110.00, "compare_at": None, "rating": 4.5, "reviews": 73, "color": "Rust / Ecru", "image": "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=85", "tag": "JUST IN", "description": "A soft organic-cotton layer with a relaxed cut and corozo buttons."},
]

CART: dict[str, int] = {}
ORDERS: list[dict[str, Any]] = []
CAPTURED_FAILURES: list[dict[str, Any]] = []
PAYMENT_API_URL = os.getenv("PAYMENT_API_URL", "http://localhost:8003")
REPO_ROOT = Path(__file__).resolve().parents[3]


class AddCartItem(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=20)


class UpdateCartItem(BaseModel):
    quantity: int = Field(ge=0, le=20)


class CheckoutRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=160)
    coupon_code: str | None = None


def cart_snapshot() -> dict[str, Any]:
    lines = []
    for product_id, quantity in CART.items():
        product = next((item for item in PRODUCTS if item["id"] == product_id), None)
        if product:
            lines.append({"product": product, "quantity": quantity, "line_total": round(product["price"] * quantity, 2)})
    subtotal = round(sum(line["product"]["price"] for line in lines), 2)
    return {"items": lines, "item_count": sum(CART.values()), "subtotal": subtotal, "shipping": 0 if subtotal >= 150 else 8, "currency": "USD"}


def send_payment(payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{PAYMENT_API_URL.rstrip('/')}/charge",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "shopsphere-api"}


@app.get("/api/products")
def list_products(category: str | None = None, q: str | None = None) -> list[dict[str, Any]]:
    products = PRODUCTS
    if category and category.lower() != "all":
        products = [item for item in products if item["category"].lower() == category.lower()]
    if q:
        query = q.strip().lower()
        products = [item for item in products if query in item["name"].lower() or query in item["description"].lower()]
    return products


@app.get("/api/cart")
def get_cart() -> dict[str, Any]:
    return cart_snapshot()


@app.post("/api/cart/items")
def add_cart_item(item: AddCartItem) -> dict[str, Any]:
    if not any(product["id"] == item.product_id for product in PRODUCTS):
        raise HTTPException(status_code=404, detail="Product not found")
    CART[item.product_id] = min(20, CART.get(item.product_id, 0) + item.quantity)
    return cart_snapshot()


@app.patch("/api/cart/items/{product_id}")
def update_cart_item(product_id: str, item: UpdateCartItem) -> dict[str, Any]:
    if product_id not in CART:
        raise HTTPException(status_code=404, detail="Cart item not found")
    if item.quantity == 0:
        CART.pop(product_id, None)
    else:
        CART[product_id] = item.quantity
    return cart_snapshot()


@app.delete("/api/cart/items/{product_id}")
def remove_cart_item(product_id: str) -> dict[str, Any]:
    CART.pop(product_id, None)
    return cart_snapshot()


@app.delete("/api/cart")
def clear_cart() -> dict[str, Any]:
    CART.clear()
    return cart_snapshot()


@app.post("/api/checkout")
def checkout(request: CheckoutRequest) -> dict[str, Any]:
    snapshot = cart_snapshot()
    if not snapshot["items"]:
        raise HTTPException(status_code=400, detail="Your cart is empty")
    discount = round(snapshot["subtotal"] * 0.1, 2) if (request.coupon_code or "").strip().upper() == "SAVE10" else 0
    order = {
        "id": f"SS-{uuid.uuid4().hex[:8].upper()}",
        "customer_name": request.customer_name,
        "email": request.email,
        "items": snapshot["items"],
        "discount": discount,
        "total": round(snapshot["subtotal"] + snapshot["shipping"] - discount, 2),
        "status": "PENDING",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    ORDERS.append(order)
    try:
        payment = send_payment({"amount": order["total"], "currency": "USD", "coupon_code": request.coupon_code, "order_id": order["id"]})
        order["status"] = "PAID"
        order["payment_id"] = payment.get("payment_id")
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        logger.error("Payment processing failed: %s", error)
        CAPTURED_FAILURES.insert(0, {
            "test_name": "test_checkout_with_coupon" if request.coupon_code else "test_checkout_payment_failure",
            "test_id": "SS-PAY-LIVE", "test_suite": "shopsphere-checkout", "app_name": "ShopSphere",
            "environment": "Local QA", "browser": "Not captured", "run_id": order["id"],
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "failure_message": f"Checkout returned a payment error: {error}",
            "stack_trace": "HTTPError raised while calling the payment mock from send_payment().",
            "logs": f"Payment processing failed: {error}. Cart cleared; order remains {order['status']}.",
            "network_logs": "POST /api/checkout -> payment request failed",
            "screenshot_summary": "Checkout error shown after payment failure.", "module": "Checkout / payment handling",
            "failure_count": "1", "failure_pattern": "New failure captured from live checkout",
            "last_success": "Not recorded", "recent_commits": "Not recorded", "artifact_paths": "Not recorded",
        })
        CART.clear()
        raise HTTPException(status_code=502, detail="Payment processing failed. Please try again.") from error
    CART.clear()
    return {"order": order, "cart": cart_snapshot()}


@app.get("/api/orders")
def list_orders() -> list[dict[str, Any]]:
    return ORDERS


@app.get("/api/buglens/failures")
def buglens_failures() -> list[dict[str, str]]:
    now = datetime.now(timezone.utc).isoformat()
    seeded = [
        {
            "test_name": "test_cart_total_calculation", "test_id": "SS-CART-01", "test_suite": "shopsphere-checkout",
            "app_name": "ShopSphere", "environment": "Local QA", "browser": "Chromium", "run_id": "SS-DEMO-01",
            "executed_at": now, "failure_message": "Expected cart total $258.00, received $129.00",
            "stack_trace": "AssertionError: expected total 258.00, got 129.00\\n  at test_cart_total_calculation (automation/tests/test_shopsphere.py)",
            "logs": "Cart contains 2 items at $129.00 each. Reported total: $129.00.", "network_logs": "GET /api/cart -> 200; subtotal=129.00; item_count=2",
            "screenshot_summary": "Cart drawer shows quantity 2 but the subtotal equals one unit price.", "module": "Cart totals",
            "failure_count": "4", "failure_pattern": "Consistent across the last 4 runs", "last_success": "Not recorded",
            "recent_commits": "Not recorded", "artifact_paths": "Not recorded",
        },
        {
            "test_name": "test_checkout_with_coupon", "test_id": "SS-PAY-02", "test_suite": "shopsphere-checkout",
            "app_name": "ShopSphere", "environment": "Local QA", "browser": "Chromium", "run_id": "SS-DEMO-02",
            "executed_at": now, "failure_message": "POST /charge returned HTTP 500 while coupon SAVE10 was present",
            "stack_trace": "HTTPError: 500 Internal Server Error\\n  at checkout (automation/tests/test_shopsphere.py)",
            "logs": "Payment mock rejected request after coupon validation.", "network_logs": "POST /charge -> 500 Internal Server Error",
            "screenshot_summary": "Checkout displays a payment error after submitting SAVE10.", "module": "Payment / coupon checkout",
            "failure_count": "3", "failure_pattern": "Intermittent: 3 failures in 5 runs", "last_success": "Intermittent success in same run",
            "recent_commits": "Not recorded", "artifact_paths": "Not recorded",
        },
        {
            "test_name": "test_checkout_payment_failure", "test_id": "SS-ORDER-03", "test_suite": "shopsphere-checkout",
            "app_name": "ShopSphere", "environment": "Local QA", "browser": "Chromium", "run_id": "SS-DEMO-03",
            "executed_at": now, "failure_message": "Expected failed payment to preserve cart; cart was empty after request",
            "stack_trace": "AssertionError: expected cart item count 1, received 0\\n  at test_checkout_payment_failure (automation/tests/test_shopsphere.py)",
            "logs": "Payment processing failed: gateway declined request. Cart cleared; order remains PENDING.",
            "network_logs": "POST /api/checkout -> 502; subsequent GET /api/cart -> item_count=0",
            "screenshot_summary": "Checkout shows an error while the cart drawer is empty.", "module": "Checkout error handling",
            "failure_count": "2", "failure_pattern": "Consistent after payment decline", "last_success": "Not recorded",
            "recent_commits": "Not recorded", "artifact_paths": "Not recorded",
        },
        {
            "test_name": "test_product_price_sort_order", "test_id": "SS-UI-04", "test_suite": "shopsphere-catalog",
            "app_name": "ShopSphere", "environment": "Local QA", "browser": "Chromium", "run_id": "SS-DEMO-04",
            "executed_at": now, "failure_message": "Expected ascending prices after selecting Price: low to high; got $449.00 before $89.00",
            "stack_trace": "AssertionError: first visible price 449.00 is greater than final visible price 89.00\\n  at test_product_price_sort_order (automation/tests/test_shopsphere.py)",
            "logs": "Catalog sort selection: price-ascending. First result: 449.00. Last result: 89.00.",
            "network_logs": "GET /api/products -> 200; sorting performed in browser",
            "screenshot_summary": "Price: low to high is selected, but the most expensive product appears first.",
            "module": "Product catalog / price sorting", "failure_count": "1", "failure_pattern": "Consistent on first run",
            "last_success": "Not recorded", "recent_commits": "Not recorded", "artifact_paths": "Not recorded",
        },
    ]
    return seeded + CAPTURED_FAILURES


@app.post("/api/buglens/failures")
def capture_buglens_failure(failure: dict[str, Any]) -> dict[str, str]:
    if not failure.get("test_name") or not failure.get("failure_message"):
        raise HTTPException(status_code=422, detail="test_name and failure_message are required")
    failure.setdefault("test_id", f"SS-{uuid.uuid4().hex[:6].upper()}")
    failure.setdefault("test_suite", "shopsphere")
    failure.setdefault("app_name", "ShopSphere")
    failure.setdefault("environment", "Local QA")
    failure.setdefault("browser", "Not captured")
    failure.setdefault("run_id", f"SS-{uuid.uuid4().hex[:8].upper()}")
    failure.setdefault("executed_at", datetime.now(timezone.utc).isoformat())
    CAPTURED_FAILURES.insert(0, failure)
    return {"status": "captured", "test_name": failure["test_name"]}


@app.get("/api/export")
def export_application() -> StreamingResponse:
    included_files = [
        "apps/shopsphere/README.md",
        "apps/shopsphere/docker-compose.yml",
        "apps/shopsphere/backend/main.py",
        "apps/shopsphere/backend/requirements.txt",
        "apps/shopsphere/backend/Dockerfile",
        "apps/shopsphere/backend/README.md",
        "apps/shopsphere/frontend/package.json",
        "apps/shopsphere/frontend/package-lock.json",
        "apps/shopsphere/frontend/index.html",
        "apps/shopsphere/frontend/vite.config.ts",
        "apps/shopsphere/frontend/tsconfig.json",
        "apps/shopsphere/frontend/Dockerfile",
        "apps/shopsphere/frontend/README.md",
        "apps/shopsphere/frontend/src/App.tsx",
        "apps/shopsphere/frontend/src/main.tsx",
        "apps/shopsphere/frontend/src/styles.css",
        "apps/shopsphere/payment-mock/main.py",
        "apps/shopsphere/payment-mock/requirements.txt",
        "apps/shopsphere/payment-mock/Dockerfile",
        "apps/shopsphere/payment-mock/README.md",
        "automation/conftest.py",
        "automation/requirements.txt",
        "automation/tests/test_shopsphere.py",
    ]
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, mode="w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for relative_path in included_files:
            source = REPO_ROOT / relative_path
            if source.is_file():
                archive_path = relative_path.removeprefix("apps/shopsphere/")
                bundle.write(source, arcname=f"shopsphere/{archive_path}")
    archive.seek(0)
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="ShopSphere-source.zip"'},
    )