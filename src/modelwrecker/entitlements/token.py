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

# public keys only (safe to publish); a rotated key ships here in a release before the cloud uses it
TRUSTED_KEYS: dict[str, str] = {
    "2026-10-a": "trSV1ue_ymSzW9Ga60p5rH2maEuebDE_Dk72NHicYp4",
}
ISSUERS = frozenset({"https://app.aevrin.net"})

# tests replace these with their own key and issuer
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
    """Return the entitlement in `token`, or raise EntitlementError.

    The checks run in this order: form, JSON shape, algorithm, signing key, signature, issuer and
    version, then the time window. Nothing in the payload is used before the signature matches.
    """
    parts, header, payload = _decode(token)
    kid = _verify_signature(parts, header)
    if payload.get("v") != 1 or payload.get("iss") not in _issuers():
        raise EntitlementError("the entitlement is from an unexpected issuer or version")
    iat, exp = _time_window(payload, time.time() if now is None else now)
    return _entitlement_from(payload, kid, iat, exp)


def _decode(token: str) -> tuple[list[str], dict, dict]:
    """Split a token into its three parts and decode the header and payload JSON."""
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
    return parts, header, payload


def _verify_signature(parts: list[str], header: dict) -> str:
    """Check the Ed25519 signature with a trusted public key; return the key id."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

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
    return kid


def _time_window(payload: dict, now: float) -> tuple[int, int]:
    try:
        iat, exp = int(payload["iat"]), int(payload["exp"])
    except (KeyError, TypeError, ValueError) as e:
        raise EntitlementError("the entitlement has no valid time window") from e
    if iat > now + CLOCK_SKEW_S:
        raise EntitlementError("the entitlement is dated in the future; check this machine's clock")
    if exp <= now:
        raise EntitlementError("the entitlement has expired")
    return iat, exp


def _entitlement_from(payload: dict, kid: str, iat: int, exp: int) -> Entitlement:
    limits_raw = payload.get("limits") or {}
    features_raw = payload.get("features") or {}
    if not isinstance(limits_raw, dict) or not isinstance(features_raw, dict):
        raise EntitlementError("the entitlement has an unexpected shape")
    limits: dict[str, int | None] = {}
    for meter in METERS:
        value = limits_raw.get(meter)
        limits[meter] = None if value is None else max(0, int(value))
    features = {feature: features_raw.get(feature) is True for feature in FEATURES}
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
