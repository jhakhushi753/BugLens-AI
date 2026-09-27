from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any, Callable

from fastapi import HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("shopsphere.chatbot")


class ChatMessage(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)


CHAT_TOOLS = [{
    "function_declarations": [
        {
            "name": "search_products",
            "description": "Find ShopSphere products by a natural-language query or category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Words describing the product the customer wants."},
                    "category": {"type": "string", "description": "Optional category such as Home, Apparel, or Technology."},
                },
            },
        },
        {
            "name": "get_cart",
            "description": "Show the customer's current shopping bag and totals.",
            "parameters": {"type": "object", "properties": {}},
        },
        {
            "name": "add_to_cart",
            "description": "Add a product to the customer's shopping bag. Use only after the customer clearly asks to add it.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "The exact ShopSphere product id."},
                    "quantity": {"type": "integer", "description": "Number of items to add, from 1 to 20."},
                },
                "required": ["product_id"],
            },
        },
    ],
}]


class ChatbotAgent:
    def __init__(
        self,
        products: list[dict[str, Any]],
        cart: dict[str, int],
        cart_snapshot: Callable[[], dict[str, Any]],
    ) -> None:
        self.products = products
        self.cart = cart
        self.cart_snapshot = cart_snapshot

    def run_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "search_products":
            query = str(arguments.get("query", "")).strip().lower()
            category = str(arguments.get("category", "")).strip().lower()
            matches = [
                product for product in self.products
                if (not category or product["category"].lower() == category)
                and (not query or query in f'{product["name"]} {product["category"]} {product["description"]}'.lower())
            ]
            exact_match = bool(matches)
            if not matches and query:
                matches = [product for product in self.products if not category or product["category"].lower() == category]
            return {
                "products": [
                    {key: product[key] for key in ("id", "name", "category", "price", "rating", "reviews", "color", "description")}
                    for product in matches[:6]
                ],
                "exact_match": exact_match,
            }
        if name == "get_cart":
            return {"cart": self.cart_snapshot()}
        if name == "add_to_cart":
            product_id = str(arguments.get("product_id", ""))
            quantity = max(1, min(20, int(arguments.get("quantity", 1))))
            if not any(product["id"] == product_id for product in self.products):
                return {"error": "That product was not found in the ShopSphere catalog."}
            self.cart[product_id] = min(20, self.cart.get(product_id, 0) + quantity)
            return {"cart": self.cart_snapshot(), "added_product_id": product_id, "quantity_added": quantity}
        return {"error": f"Unknown tool: {name}"}

    @staticmethod
    def generate(payload: dict[str, Any], endpoint: str) -> dict[str, Any]:
        for attempt in range(3):
            outbound = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(outbound, timeout=25) as response:
                    return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as error:
                if error.code not in {429, 500, 502, 503, 504} or attempt == 2:
                    raise
                time.sleep(0.5 * (attempt + 1))
        raise RuntimeError("Gemini request retry limit reached")

    def respond(self, request: ChatRequest) -> dict[str, str]:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="Chat is not configured. Add GEMINI_API_KEY to the ShopSphere API environment.")

        contents = [
            {
                "role": "model" if message.role == "assistant" else "user",
                "parts": [{"text": message.content}],
            }
            for message in request.messages
            if message.role in {"user", "assistant"}
        ]
        system_prompt = (
            "You are the ShopSphere shopping agent. Be warm, concise, and practical. "
            "Help customers discover products, compare options, and understand shipping or returns. "
            "Use search_products when the customer asks for recommendations or product details. "
            "Use get_cart when they ask about their bag. Use add_to_cart only when they explicitly ask to add a specific product. "
            "Never place an order, process payment, claim an item is in stock, or invent catalog details. "
            f"Catalog: {json.dumps(self.products)}"
        )
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "tools": CHAT_TOOLS,
            "generationConfig": {"temperature": 0.5, "maxOutputTokens": 500},
        }
        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{os.getenv('GEMINI_MODEL', 'gemini-3.8-flash')}:generateContent?key={api_key}"
        )
        try:
            for _ in range(4):
                result = self.generate(payload, endpoint)
                parts = result["candidates"][0]["content"]["parts"]
                function_calls = [part["functionCall"] for part in parts if "functionCall" in part]
                if not function_calls:
                    reply = next(part["text"] for part in parts if "text" in part)
                    return {"reply": reply}
                payload["contents"].append({"role": "model", "parts": parts})
                for function_call in function_calls:
                    tool_result = self.run_tool(function_call["name"], function_call.get("args", {}))
                    payload["contents"].append({
                        "role": "user",
                        "parts": [{"functionResponse": {
                            "name": function_call["name"],
                            "id": function_call.get("id"),
                            "response": {"result": tool_result},
                        }}],
                    })
            raise HTTPException(status_code=502, detail="The shopping assistant could not complete that request.")
        except (urllib.error.HTTPError, urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError) as error:
            logger.warning("Gemini chat request failed: %s", error)
            raise HTTPException(status_code=502, detail="The shopping assistant is temporarily unavailable.") from error
