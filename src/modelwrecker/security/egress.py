"""Egress guard: stop the engine from making requests to places it should not.

Blocks loopback, link-local, private (RFC1918), and cloud-metadata addresses, and limits schemes. This
guards against SSRF and credential theft (see docs/security/THREAT-MODEL.md, threat T2). It must be
re-checked on every redirect by the caller.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

# Cloud metadata endpoints that must never be reachable from an attack.
_METADATA_HOSTS = {"169.254.169.254", "metadata.google.internal", "fd00:ec2::254"}


class EgressBlocked(ValueError):
    """Raised when a URL is not allowed to be fetched."""


def _ip_is_blocked(ip: ipaddress._BaseAddress) -> bool:
    return (
        ip.is_loopback
        or ip.is_link_local
        or ip.is_private
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def is_blocked_host(host: str, *, allow_private: bool = False) -> bool:
    """True if the host resolves to (or is) an address we refuse to reach.

    `allow_private` is the escape hatch for deliberately testing a target on a private address; it is off
    by default and the caller must opt in loudly (see docs/reference/ENVIRONMENT.md).
    """
    host = host.strip().strip("[]")  # tolerate bracketed IPv6
    if host in _METADATA_HOSTS:
        return True
    if allow_private:
        return False
    # Direct IP literal.
    try:
        return _ip_is_blocked(ipaddress.ip_address(host))
    except ValueError:
        pass
    # Hostname: resolve every address it maps to and block if any is private.
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        # Cannot resolve -> treat as blocked (fail safe, not open).
        return True
    for info in infos:
        addr = info[4][0]
        try:
            if _ip_is_blocked(ipaddress.ip_address(addr)):
                return True
        except ValueError:
            continue
    return False


def check_url(
    url: str,
    *,
    allowed_schemes: tuple[str, ...] = ("https",),
    allow_private: bool = False,
) -> None:
    """Raise EgressBlocked if this URL may not be fetched. Call again for each redirect target."""
    parsed = urlparse(url)
    if parsed.scheme.lower() not in allowed_schemes:
        raise EgressBlocked(f"scheme {parsed.scheme!r} not allowed (allowed: {allowed_schemes})")
    if not parsed.hostname:
        raise EgressBlocked(f"no host in url {url!r}")
    if is_blocked_host(parsed.hostname, allow_private=allow_private):
        raise EgressBlocked(f"host {parsed.hostname!r} is blocked (private/loopback/metadata)")
