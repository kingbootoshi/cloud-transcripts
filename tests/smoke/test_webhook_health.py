"""
Smoke test for webhook endpoint health.
Ensures the deployed webhook endpoint exists and returns 401 on bad signature.
"""
import os
import requests
import uuid
import json
import hmac
import hashlib
import pytest


def test_webhook_endpoint_exists_and_validates_signature():
    """
    Test that the webhook endpoint exists and properly validates signatures.
    
    This test ensures:
    1. The webhook URL is properly configured
    2. The endpoint exists (doesn't return 404)
    3. The endpoint validates HMAC signatures (returns 401 for bad signatures)
    """
    # Get webhook URL from environment
    webhook_url = os.environ.get("WEBHOOK_URL")
    if not webhook_url:
        pytest.skip("WEBHOOK_URL not configured for smoke test")
    
    # Create a test payload
    test_payload = {
        "job_id": str(uuid.uuid4()),
        "status": "error",
        "error": "test error message"
    }
    
    # Use a bad signature (all zeros)
    bad_signature = "0" * 64
    payload_json = json.dumps(test_payload)
    
    # Send request with bad signature
    response = requests.post(
        webhook_url,
        headers={
            "X-Modal-Signature": bad_signature,
            "Content-Type": "application/json"
        },
        data=payload_json,
        timeout=10
    )
    
    # Should return 401 Unauthorized for bad signature
    assert response.status_code == 401, (
        f"Webhook unhealthy: expected 401 for bad signature, got {response.status_code}. "
        f"Response: {response.text[:300]}"
    )


def test_webhook_url_format_validation():
    """
    Test that webhook URL validation works correctly.
    """
    from apps.worker.utils import validate_webhook_url
    
    # Valid URLs should not raise
    validate_webhook_url("https://example.com/api/webhook/modal")
    validate_webhook_url("http://localhost:3000/api/webhook/modal")
    
    # Invalid URLs should raise RuntimeError
    with pytest.raises(RuntimeError, match="Webhook URL cannot be empty"):
        validate_webhook_url("")
    
    with pytest.raises(RuntimeError, match="must include route path"):
        validate_webhook_url("https://example.com")
    
    with pytest.raises(RuntimeError, match="must include route path"):
        validate_webhook_url("https://example.com/") 