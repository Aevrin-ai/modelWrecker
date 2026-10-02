"""Cloud sync, engine side (ROADMAP 10.4, 10.8, 10.9).

This package does not run attacks. It signs the CLI in as a device, reads finished run folders,
builds a metadata-only summary, and sends it to the control-plane API. The HTTP contract lives in
docs/architecture/control-plane-api.md; the privacy rules in docs/architecture/data-flow.md.
"""

from __future__ import annotations

from .client import (
    DEFAULT_API_URL,
    ENV_URL,
    CloudClient,
    CloudError,
    DeviceCode,
    InsecureUrlError,
    LoginOutcome,
    TokenResult,
    TokenStatus,
    poll_for_token,
    resolve_api_url,
    validate_api_url,
)
from .credentials import (
    ENV_TOKEN,
    CredentialError,
    DeviceCredential,
    credential_path,
    delete_credential,
    load_credential,
    save_credential,
)
from .outbox import MARKER, SyncReport, mark_synced, pending_runs, sync_pending, sync_run
from .summarize import NotARunError, build_sync_body

__all__ = [
    "DEFAULT_API_URL",
    "ENV_TOKEN",
    "ENV_URL",
    "MARKER",
    "CloudClient",
    "CloudError",
    "CredentialError",
    "DeviceCode",
    "DeviceCredential",
    "InsecureUrlError",
    "LoginOutcome",
    "NotARunError",
    "SyncReport",
    "TokenResult",
    "TokenStatus",
    "build_sync_body",
    "credential_path",
    "delete_credential",
    "load_credential",
    "mark_synced",
    "pending_runs",
    "poll_for_token",
    "resolve_api_url",
    "save_credential",
    "sync_pending",
    "sync_run",
    "validate_api_url",
]
