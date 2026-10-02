"""Shared test setup.

Cloud sync isolation: every test gets an empty, temporary credential folder and no cloud env vars,
so a real device credential on the developer's machine can never be read or used, and `run` never
tries to sync to a real endpoint.

Entitlements (issue #11): the engine trusts only a test key here, never the production one. Every
test runs with a test-signed entitlement that switches every feature on and has no limits, so tests
of strategies and targets are not shaped by plan rules. Mark a test `@pytest.mark.free_plan` to run
it with no entitlement (the free baseline). `sign_entitlement` signs custom tokens for entitlement
tests.
"""

from __future__ import annotations

import base64
import json
import time

import pytest

TEST_ISSUER = "https://test.invalid"
TEST_KID = "test-key"


def pytest_configure(config):
    config.addinivalue_line("markers", "free_plan: run without an entitlement (the free baseline)")


@pytest.fixture(scope="session")
def _test_signing_key():
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    key = Ed25519PrivateKey.generate()
    raw = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    return key, base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


@pytest.fixture(scope="session")
def sign_entitlement(_test_signing_key):
    """Return a function that signs an entitlement the engine will trust in tests."""
    key, _ = _test_signing_key

    def sign(*, plan="pro", limits=None, features=None, usage=None, iat=None, exp=None,
             kid=TEST_KID, iss=TEST_ISSUER) -> str:
        now = int(time.time())
        payload = {
            "v": 1, "iss": iss, "sub": "test-user", "dev": "test-device", "plan": plan,
            "limits": limits if limits is not None else
            {"campaigns": None, "attacks": None, "devices": None, "projects": None},
            "features": features if features is not None else
            {"advanced_strategies": True, "mcp": True, "analytics": True,
             "evidence_storage": True, "enterprise": True},
            "usage": usage or {}, "plan_ends_at": None,
            "iat": now if iat is None else iat, "exp": now + 3600 if exp is None else exp,
        }
        head = _b64(json.dumps({"alg": "EdDSA", "typ": "mw-entitlement", "kid": kid}).encode())
        body = _b64(json.dumps(payload).encode())
        return f"{head}.{body}.{_b64(key.sign(f'{head}.{body}'.encode()))}"

    return sign


@pytest.fixture(autouse=True)
def _isolate_cloud_credentials(tmp_path_factory, monkeypatch):
    from modelwrecker.cloud import credentials

    monkeypatch.setattr(credentials, "_config_dir_override", tmp_path_factory.mktemp("mwcfg"))
    monkeypatch.delenv("MODELWRECKER_DEVICE_TOKEN", raising=False)
    monkeypatch.delenv("MODELWRECKER_CLOUD_URL", raising=False)


@pytest.fixture(autouse=True)
def _test_entitlement(request, monkeypatch, _isolate_cloud_credentials, _test_signing_key,
                      sign_entitlement):
    from modelwrecker.entitlements import token

    _, public = _test_signing_key
    monkeypatch.setattr(token, "_keys_override", {TEST_KID: public})
    monkeypatch.setattr(token, "_issuers_override", frozenset({TEST_ISSUER}))
    if request.node.get_closest_marker("free_plan"):
        monkeypatch.delenv("MODELWRECKER_ENTITLEMENT", raising=False)
    else:
        monkeypatch.setenv("MODELWRECKER_ENTITLEMENT", sign_entitlement())
