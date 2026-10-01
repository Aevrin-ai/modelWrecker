"""The security layer: egress guard, redaction, and (later) sandbox + auth helpers.

Imported by providers, targets, and payloads so security is a layer, not a per-call afterthought.
See docs/security/SECURITY.md and docs/security/THREAT-MODEL.md.
"""

from .egress import EgressBlocked, check_url, is_blocked_host
from .redaction import redact, redact_text

__all__ = ["EgressBlocked", "check_url", "is_blocked_host", "redact", "redact_text"]
