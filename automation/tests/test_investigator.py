import importlib.util
import sys
import urllib.error
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def load_investigator():
    path = ROOT / "ai/investigator/main.py"
    spec = importlib.util.spec_from_file_location("buglens_investigator_test_module", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


investigator = load_investigator()


def cart_failure():
    return investigator.FailureEvidence(
        test_name="test_cart_total_calculation",
        test_id="SS-CART-01",
        test_suite="shopsphere-checkout",
        app_name="ShopSphere",
        environment="Local QA",
        browser="Chromium",
        run_id="SS-GEMINI-TEST",
        failure_message="Expected cart total $258.00, received $129.00",
        stack_trace="AssertionError: expected total 258.00, got 129.00",
        logs="Cart contains 2 items at $129.00 each. Reported total: $129.00.",
        module="Cart totals",
    )


def test_gemini_function_call_returns_dashboard_report(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-only")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.8-flash")
    report = investigator.analyze_with_rules(cart_failure())
    gemini_response = {
        "candidates": [{
            "content": {
                "parts": [{
                    "functionCall": {
                        "name": "submit_investigation_report",
                        "args": report.model_dump(),
                    }
                }]
            }
        }]
    }
    captured = {}

    def fake_generate(payload, endpoint):
        captured["payload"] = payload
        captured["endpoint"] = endpoint
        return gemini_response

    monkeypatch.setattr(investigator, "_generate_with_gemini", fake_generate)
    result = investigator.analyze_with_gemini(cart_failure())

    assert result.classification == "APPLICATION_BUG"
    assert result.expected_result == "$258.00"
    assert result.actual_result == "$129.00"
    assert "RULE_BASED_FALLBACK" not in result.metadata.flags
    assert captured["payload"]["tool_config"]["function_calling_config"]["mode"] == "ANY"
    parameters = captured["payload"]["tools"][0]["function_declarations"][0]["parameters"]
    assert "root_cause" in parameters["properties"]
    assert "summary" in parameters["properties"]["root_cause"]["properties"]
    assert "gemini-3.8-flash:generateContent" in captured["endpoint"]


def test_gemini_quota_falls_back_and_requires_review(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-only")

    def rate_limited(_payload, _endpoint):
        raise urllib.error.HTTPError(
            "https://provider.invalid",
            429,
            "Too Many Requests",
            {},
            None,
        )

    monkeypatch.setattr(investigator, "_generate_with_gemini", rate_limited)
    result = investigator.analyze_with_gemini(cart_failure())

    assert result.classification == "APPLICATION_BUG"
    assert result.metadata.requires_human_review is True
    assert "GEMINI_QUOTA_FALLBACK" in result.metadata.flags
