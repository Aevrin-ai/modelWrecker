"""Redaction: remove secrets before anything is written to a log or evidence.

Covers API keys, auth headers, device tokens, and common secret-bearing fields. PII redaction
(Presidio) plugs in as a judge signal and an optional deeper pass later. See
docs/security/SECURITY.md (threat T3).
"""

from __future__ import annotations

import re

REDACTED = "[REDACTED]"

# Field names whose values are always secrets.
_SECRET_KEYS = {
    "api_key",
    "apikey",
    "authorization",
    "x-api-key",
    "password",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "device_token",
    "device_code",
}

# Patterns for secrets that appear inside free text.
_PATTERNS = [
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),  # OpenAI-style keys
    re.compile(r"\bsk-ant-[A-Za-z0-9_-]{16,}\b"),  # Anthropic-style keys
    re.compile(r"\bBearer\s+[A-Za-z0-9._-]{10,}\b", re.IGNORECASE),  # bearer tokens
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),  # AWS access key id
    re.compile(r"\bmwd_[A-Za-z0-9_-]{8,}"),  # modelWrecker cloud device tokens
]


def redact_text(text: str) -> str:
    """Redact secret-looking substrings in free text."""
    if not text:
        return text
    out = text
    for pat in _PATTERNS:
        out = pat.sub(REDACTED, out)
    return out


def redact(obj: object) -> object:
    """Recursively redact a dict/list/str. Keys named like secrets have their values replaced;
    string values are scanned for secret patterns. Returns a new structure; does not mutate the
    input."""
    if isinstance(obj, dict):
        result: dict = {}
        for k, v in obj.items():
            if isinstance(k, str) and k.lower() in _SECRET_KEYS:
                result[k] = REDACTED
            else:
                result[k] = redact(v)
        return result
    if isinstance(obj, (list, tuple)):
        return [redact(v) for v in obj]
    if isinstance(obj, str):
        return redact_text(obj)
    return obj
