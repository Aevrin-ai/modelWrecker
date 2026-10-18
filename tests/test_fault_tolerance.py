"""Fault tolerance in the engine: which provider failures are retried, how long to wait, and the
API request id the CLI shows for support.

Offline and deterministic: HTTP goes through httpx.MockTransport. See docs/campaigns/OVERVIEW.md.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from email.utils import format_datetime

import httpx
import pytest

from modelwrecker.campaigns.engine import retry_delay
from modelwrecker.cloud.client import CloudClient, CloudError
from modelwrecker.providers.base import ProviderError
from modelwrecker.providers.openai_compatible import (
    OpenAICompatibleProvider,
    _retry_after_seconds,
)

PUBLIC_IP = "https://93.184.216.34/v1"  # an IP literal, so no DNS lookup is needed offline
API = "https://vyra.test/api/v1"
MESSAGES = [{"role": "user", "content": "hi"}]


async def _failure_from(handler) -> ProviderError:
    """Run one request against `handler` and return the ProviderError it raises."""
    p = OpenAICompatibleProvider(model="m", base_url=PUBLIC_IP)
    p._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    try:
        with pytest.raises(ProviderError) as caught:
            await p.generate(MESSAGES)
    finally:
        await p.aclose()
    return caught.value


def test_an_unclassified_provider_error_stays_retryable() -> None:
    err = ProviderError("something upstream")
    assert err.retryable is True
    assert err.retry_after is None


@pytest.mark.parametrize("status", [400, 401, 403, 404, 422])
async def test_a_request_the_provider_rejects_is_not_retried(status: int) -> None:
    err = await _failure_from(lambda _r: httpx.Response(status, json={"error": "no"}))
    assert err.retryable is False
    assert f"HTTP {status}" in str(err)


@pytest.mark.parametrize("status", [408, 425, 429, 500, 502, 503, 504])
async def test_a_passing_provider_failure_is_retried(status: int) -> None:
    err = await _failure_from(lambda _r: httpx.Response(status, text="busy"))
    assert err.retryable is True


async def test_a_rate_limit_carries_the_provider_retry_after() -> None:
    err = await _failure_from(lambda _r: httpx.Response(429, headers={"Retry-After": "7"}))
    assert err.retryable is True
    assert err.retry_after == 7.0


async def test_a_timeout_is_retried() -> None:
    def slow(_request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("no answer")

    err = await _failure_from(slow)
    assert err.retryable is True
    assert "timeout" in str(err)


async def test_a_reply_that_is_not_json_is_a_wrong_base_url_and_not_retried() -> None:
    err = await _failure_from(lambda _r: httpx.Response(200, text="<html>login</html>"))
    assert err.retryable is False


async def test_a_blocked_address_is_not_retried() -> None:
    p = OpenAICompatibleProvider(model="m", base_url="http://127.0.0.1:11434/v1")
    with pytest.raises(ProviderError) as caught:
        await p.generate(MESSAGES)
    await p.aclose()
    assert caught.value.retryable is False


def test_retry_after_is_read_as_seconds_or_as_an_http_date() -> None:
    assert _retry_after_seconds("5") == 5.0
    soon = format_datetime(datetime.now(UTC) + timedelta(seconds=60), usegmt=True)
    assert 55 <= (_retry_after_seconds(soon) or 0) <= 60
    past = format_datetime(datetime.now(UTC) - timedelta(seconds=60), usegmt=True)
    assert _retry_after_seconds(past) == 0.0
    assert _retry_after_seconds("later") is None
    assert _retry_after_seconds(None) is None


def test_retry_delay_backs_off_with_jitter_and_stays_under_the_cap() -> None:
    assert retry_delay(1, rand=lambda: 0.0) == pytest.approx(0.1)
    assert retry_delay(1, rand=lambda: 1.0) == pytest.approx(0.2)
    assert retry_delay(10, rand=lambda: 1.0) == pytest.approx(2.0)
    assert retry_delay(10, rand=lambda: 0.0) == pytest.approx(1.0)


def test_retry_delay_honors_retry_after_up_to_a_cap() -> None:
    assert retry_delay(1, retry_after=5.0, rand=lambda: 0.0) == pytest.approx(5.0)
    assert retry_delay(1, retry_after=600.0, rand=lambda: 0.0) == pytest.approx(30.0)
    # a Retry-After shorter than the backoff never shortens the wait
    assert retry_delay(10, retry_after=0.01, rand=lambda: 1.0) == pytest.approx(2.0)


def _client_answering(response: httpx.Response) -> CloudClient:
    return CloudClient(API, "mwd_test-token", transport=httpx.MockTransport(lambda _r: response))


def test_a_cloud_error_shows_the_request_id_from_the_body() -> None:
    body = {"error": "service_unavailable", "message": "The service is busy right now.",
            "requestId": "8a1b2c3d4e5f6789-SIN"}
    with _client_answering(httpx.Response(503, json=body)) as c:
        with pytest.raises(CloudError) as caught:
            c.heartbeat()
    assert caught.value.request_id == "8a1b2c3d4e5f6789-SIN"
    assert caught.value.message.endswith("(request id 8a1b2c3d4e5f6789-SIN)")
    assert caught.value.refused is False  # a 503 means "try again later"


def test_a_cloud_error_falls_back_to_the_request_id_header() -> None:
    rid = "11111111-2222-3333-4444-555555555555"
    resp = httpx.Response(500, json={"error": "internal", "message": "x"},
                          headers={"X-Request-Id": rid})
    with _client_answering(resp) as c:
        with pytest.raises(CloudError) as caught:
            c.heartbeat()
    assert caught.value.request_id == rid


def test_a_request_id_with_an_unexpected_shape_is_dropped() -> None:
    body = {"error": "internal", "message": "x", "requestId": "has spaces; and more"}
    with _client_answering(httpx.Response(500, json=body)) as c:
        with pytest.raises(CloudError) as caught:
            c.heartbeat()
    assert caught.value.request_id is None
    assert "request id" not in caught.value.message
