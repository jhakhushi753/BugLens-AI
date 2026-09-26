import importlib.util
import sys
import urllib.error
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


shop_api = load_module("shopsphere_test_api", ROOT / "apps/shopsphere/backend/main.py")
payment_api = load_module("shopsphere_test_payment", ROOT / "apps/shopsphere/payment-mock/main.py")


@pytest.fixture(autouse=True)
def reset_store_state():
    shop_api.CART.clear()
    shop_api.ORDERS.clear()
    shop_api.CAPTURED_FAILURES.clear()


def test_cart_total_calculation():
    client = TestClient(shop_api.app)
    response = client.post("/api/cart/items", json={"product_id": "p-001", "quantity": 2})
    assert response.status_code == 200
    assert response.json()["subtotal"] == 258.00


def test_checkout_with_coupon(monkeypatch):
    monkeypatch.setattr(payment_api.random, "random", lambda: 0.1)
    client = TestClient(payment_api.app)
    response = client.post("/charge", json={"amount": 100, "currency": "USD", "coupon_code": "SAVE10", "order_id": "SS-TEST"})
    assert response.status_code == 200


def test_checkout_payment_failure(monkeypatch):
    def failed_payment(_payload):
        raise urllib.error.URLError("simulated gateway decline")

    monkeypatch.setattr(shop_api, "send_payment", failed_payment)
    client = TestClient(shop_api.app)
    client.post("/api/cart/items", json={"product_id": "p-001", "quantity": 1})
    response = client.post("/api/checkout", json={"customer_name": "QA Buyer", "email": "qa@example.test"})
    assert response.status_code == 502
    assert client.get("/api/cart").json()["item_count"] == 1


def test_frontend_sort_failure_is_available_to_buglens():
    failures = shop_api.buglens_failures()
    assert any(failure["test_name"] == "test_product_price_sort_order" for failure in failures)
