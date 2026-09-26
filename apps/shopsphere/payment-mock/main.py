import os
import random
import uuid

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="ShopSphere Payment Simulator", version="1.0.0")
COUPON_FAILURE_RATE = float(os.getenv("COUPON_FAILURE_RATE", "0.6"))


class ChargeRequest(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "USD"
    coupon_code: str | None = None
    order_id: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "payment-mock"}


@app.post("/charge")
def charge(request: ChargeRequest) -> dict[str, str | float]:
    if request.coupon_code and random.random() < COUPON_FAILURE_RATE:
        raise HTTPException(status_code=500, detail="Payment provider failed while processing coupon order")
    return {
        "payment_id": f"PAY-{uuid.uuid4().hex[:10].upper()}",
        "order_id": request.order_id,
        "amount": request.amount,
        "currency": request.currency,
        "status": "paid",
    }