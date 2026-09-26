import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

import pytest


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when != "call" or not report.failed:
        return

    evidence = {
        "test_name": item.name,
        "test_id": item.nodeid,
        "test_suite": "shopsphere-automation",
        "app_name": "ShopSphere",
        "environment": os.getenv("ENVIRONMENT", "Local QA"),
        "browser": os.getenv("BROWSER", "API test client"),
        "run_id": os.getenv("TEST_RUN_ID", f"SS-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"),
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "failure_message": str(report.longrepr).splitlines()[-1],
        "stack_trace": str(report.longrepr),
        "logs": "\n".join(text for _title, text in report.sections),
        "network_logs": "Captured by the test client when available.",
        "screenshot_summary": "Not available for API-only tests.",
        "module": item.module.__name__,
        "failure_count": "1",
        "failure_pattern": "New failure captured by pytest",
        "last_success": "Not recorded",
        "recent_commits": "Not recorded",
        "artifact_paths": "Not recorded",
    }
    request = urllib.request.Request(
        f"{os.getenv('BUGLENS_API_URL', 'http://localhost:8000').rstrip('/')}/api/buglens/failures",
        data=json.dumps(evidence).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=2):
            pass
    except (urllib.error.URLError, TimeoutError):
        pass