"""Verify a signed entitlement (issue #11).

The cloud signs with an Ed25519 private key that only it holds. The engine ships the matching public
keys below, so it can check a token offline. A token is `header.payload.signature`, each part
base64url, with the signature over `header.payload`. Anything that fails a check is rejected;
nothing is trusted from an unsigned or expired token.
"""

from __future__ import annotations

import base64
import binascii
import json
import time

from .model import FEATURES, METERS, Entitlement

# Public keys only (safe to publish). The cloud lists the active key at /api/v1/entitlements/keys.
# Rotating the signing key means adding the new public key here in a release before the cloud uses
# it.
TRUSTED_KEYS: dict[str, str] = {
    "2026-10-a": "trSV1ue_ymSzW9Ga60p5rH2maEuebDE_Dk72NHicYp4",
}
ISSUERS = frozenset({"https://app.aevrin.net"})

# Tests replace these with their own key and issuer.
_keys_override: dict[str, str] | None = None
_issuers_override: frozenset[str] | None = None

MAX_TOKEN_BYTES = 8192
CLOCK_SKEW_S = 300


class EntitlementError(ValueError):
    """The token cannot be trusted. The message says why, without echoing the token."""


def _b64(part: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))
    except (binascii.Error, ValueError) as e:
        raise EntitlementError("the entitlement is not valid base64url") from e


def _keys() -> dict[str, str]:
    return _keys_override if _keys_override is not None else TRUSTED_KEYS


def _issuers() -> frozenset[str]:
    return _issuers_override if _issuers_override is not None else ISSUERS


def verify_token(token: str, *, now: float | None = None) -> Entitlement:
    """Return the entitlement in `token`, or raise EntitlementError."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

    token = (token or "").strip()
    if not token or len(token) > MAX_TOKEN_BYTES:
        raise EntitlementError("no entitlement, or it is too large")
    parts = token.split(".")
    if len(parts) != 3:
        raise EntitlementError("the entitlement is not in header.payload.signature form")
    try:
        header = json.loads(_b64(parts[0]))
        payload = json.loads(_b64(parts[1]))
    except (ValueError, UnicodeDecodeError) as e:
        raise EntitlementError("the entitlement is not valid JSON") from e
    if not isinstance(header, dict) or not isinstance(payload, dict):
        raise EntitlementError("the entitlement has an unexpected shape")
    if header.get("alg") != "EdDSA" or header.get("typ") != "mw-entitlement":
        raise EntitlementError("the entitlement uses an unexpected algorithm")
    kid = str(header.get("kid") or "")
    public = _keys().get(kid)
    if not public:
        raise EntitlementError(f"the entitlement was signed with an unknown key {kid!r}; "
                               "update modelwrecker")
    try:
        Ed25519PublicKey.from_public_bytes(_b64(public)).verify(
            _b64(parts[2]), f"{parts[0]}.{parts[1]}".encode("ascii"))
    except (InvalidSignature, ValueError) as e:
        raise EntitlementError("the entitlement signature does not match") from e

    if payload.get("v") != 1 or payload.get("iss") not in _issuers():
        raise EntitlementError("the entitlement is from an unexpected issuer or version")
    now = time.time() if now is None else now
    try:
        iat, exp = int(payload["iat"]), int(payload["exp"])
    except (KeyError, TypeError, ValueError) as e:
        raise EntitlementError("the entitlement has no valid time window") from e
    if iat > now + CLOCK_SKEW_S:
        raise EntitlementError("the entitlement is dated in the future; check this machine's clock")
    if exp <= now:
        raise EntitlementError("the entitlement has expired")

    limits_raw = payload.get("limits") or {}
    features_raw = payload.get("features") or {}
    if not isinstance(limits_raw, dict) or not isinstance(features_raw, dict):
        raise EntitlementError("the entitlement has an unexpected shape")
    limits: dict[str, int | None] = {}
    for m in METERS:
        v = limits_raw.get(m)
        limits[m] = None if v is None else max(0, int(v))
    features = {f: features_raw.get(f) is True for f in FEATURES}
    usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
    return Entitlement(
        plan=str(payload.get("plan") or "free"),
        limits=limits,
        features=features,
        usage=usage,
        subject=str(payload.get("sub") or ""),
        device=payload.get("dev"),
        issued_at=iat,
        expires_at=exp,
        plan_ends_at=payload.get("plan_ends_at"),
        key_id=kid,
        signed=True,
    )
