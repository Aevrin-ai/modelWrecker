"""Signed entitlement tokens: verification, and the free baseline when a token is missing or bad.

Offline: tokens are signed with the test key from conftest.py, and the engine trusts only that key.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable

import pytest
from entitlement_fakes import FREE_FEATURES, FREE_LIMITS
from pytest import MonkeyPatch

from modelwrecker.entitlements import (
    FREE_BASELINE,
    EntitlementError,
    load,
    save_token,
    verify_token,
)
from modelwrecker.entitlements import store as ent_store
from modelwrecker.entitlements import token as ent_token


def test_the_production_key_is_a_32_byte_ed25519_key() -> None:
    import base64

    for kid, key in ent_token.TRUSTED_KEYS.items():
        assert len(base64.urlsafe_b64decode(key + "=" * (-len(key) % 4))) == 32, kid
    assert ent_token.ISSUERS == frozenset({"https://app.aevrin.net"})


def test_a_valid_token_verifies(sign_entitlement) -> None:
    ent = verify_token(sign_entitlement(plan="pro", limits=FREE_LIMITS | {"attacks": 100000}))
    assert ent.signed and ent.plan == "pro" and ent.limit("attacks") == 100000


@pytest.mark.parametrize("mutate", ["payload", "signature", "header"])
def test_an_edited_token_is_rejected(sign_entitlement, mutate) -> None:
    h, p, s = sign_entitlement(plan="free", features=FREE_FEATURES).split(".")
    if mutate == "payload":
        import base64
        claims = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
        claims["plan"] = "enterprise"
        claims["features"]["mcp"] = True
        p = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    elif mutate == "signature":
        s = s[:-2] + ("AA" if not s.endswith("AA") else "BB")
    else:
        import base64
        h = base64.urlsafe_b64encode(b'{"alg":"none","typ":"mw-entitlement","kid":"test-key"}'
                                     ).decode().rstrip("=")
    with pytest.raises(EntitlementError):
        verify_token(f"{h}.{p}.{s}")


def test_expired_unknown_key_wrong_issuer_and_future_tokens_are_rejected(sign_entitlement) -> None:
    now = int(time.time())
    with pytest.raises(EntitlementError, match="expired"):
        verify_token(sign_entitlement(iat=now - 100, exp=now - 1))
    with pytest.raises(EntitlementError, match="unknown key"):
        verify_token(sign_entitlement(kid="someone-else"))
    with pytest.raises(EntitlementError, match="issuer"):
        verify_token(sign_entitlement(iss="https://evil.example"))
    with pytest.raises(EntitlementError, match="future"):
        verify_token(sign_entitlement(iat=now + 3600, exp=now + 7200))


def test_a_token_from_the_real_key_is_not_trusted_by_a_different_key(monkeypatch: MonkeyPatch,
        sign_entitlement: Callable[..., str]) -> None:
    monkeypatch.setattr(ent_token, "_keys_override",
                        {"test-key": "trSV1ue_ymSzW9Ga60p5rH2maEuebDE_Dk72NHicYp4"})
    with pytest.raises(EntitlementError, match="signature"):
        verify_token(sign_entitlement())


@pytest.mark.free_plan
def test_no_token_means_the_free_baseline() -> None:
    ent, source = load()
    assert ent == FREE_BASELINE and not ent.signed
    assert "not signed in" in source


@pytest.mark.free_plan
def test_a_tampered_stored_file_falls_back_to_free(sign_entitlement) -> None:
    save_token(sign_entitlement(plan="pro"))
    assert load()[0].plan == "pro"
    path = ent_store.token_path()
    h, p, s = path.read_text().split(".")
    path.write_text(f"{h}.{p}x.{s}")
    ent, source = load()
    assert ent == FREE_BASELINE and "rejected" in source


@pytest.mark.free_plan
def test_save_refuses_an_invalid_token() -> None:
    with pytest.raises(EntitlementError):
        save_token("not.a.token")
    assert not ent_store.token_path().exists()
