"""Egress guard: stop the engine from making requests to places it should not.

Blocks loopback, link-local, private (RFC1918), and cloud-metadata addresses, and limits schemes. This
guards against SSRF and credential theft (see docs/security/THREAT-MODEL.md, threat T2). It must be
re-checked on every redirect by the caller.
"""

from __future__ import annotations

import ipaddress
import socket
from collections.abc import Iterable
from dataclasses import dataclass, field
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


def is_blocked_host(
    host: str, *, allow_private: bool = False, allow_hosts: Iterable[str] = ()
) -> bool:
    """True if the host resolves to (or is) an address we refuse to reach.

    `allow_private` is the escape hatch for deliberately testing a target on a private
    address; it is off by default and the caller must opt in loudly (see
    docs/reference/ENVIRONMENT.md). `allow_hosts` is the narrower opt-in: only the named hosts
    (for example `localhost` for a local model) skip the private check. Cloud metadata hosts
    stay blocked either way.
    """
    host = host.strip().strip("[]").lower()  # tolerate bracketed IPv6
    if host in _METADATA_HOSTS:
        return True
    if allow_private or host in {h.strip().strip("[]").lower() for h in allow_hosts}:
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
    allowed_schemes: Iterable[str] = ("https",),
    allow_private: bool = False,
    allow_hosts: Iterable[str] = (),
) -> None:
    """Raise EgressBlocked if this URL may not be fetched. Call again for each redirect target."""
    schemes = tuple(s.lower() for s in allowed_schemes)
    parsed = urlparse(url)
    if parsed.scheme.lower() not in schemes:
        raise EgressBlocked(f"scheme {parsed.scheme!r} not allowed (allowed: {schemes})")
    if not parsed.hostname:
        raise EgressBlocked(f"no host in url {url!r}")
    if is_blocked_host(parsed.hostname, allow_private=allow_private, allow_hosts=allow_hosts):
        raise EgressBlocked(
            f"host {parsed.hostname!r} is blocked (private/loopback/metadata). To test a local "
            "model on purpose, list it under security.egress.allow_hosts"
        )


def static_check_url(
    url: str,
    *,
    allowed_schemes: Iterable[str] = ("https",),
    allow_private: bool = False,
    allow_hosts: Iterable[str] = (),
) -> None:
    """Like `check_url`, but never resolves DNS, so it works offline (used by `validate`).

    It catches the clear cases: a disallowed scheme, a metadata host, `localhost`, and private or
    loopback IP literals. Hostnames that only resolve to private addresses are caught at request
    time.
    """
    schemes = tuple(s.lower() for s in allowed_schemes)
    parsed = urlparse(url)
    if parsed.scheme.lower() not in schemes:
        raise EgressBlocked(f"scheme {parsed.scheme!r} not allowed (allowed: {schemes})")
    host = (parsed.hostname or "").strip("[]").lower()
    if not host:
        raise EgressBlocked(f"no host in url {url!r}")
    if host in _METADATA_HOSTS:
        raise EgressBlocked(f"host {host!r} is a cloud metadata address")
    if allow_private or host in {h.strip().strip("[]").lower() for h in allow_hosts}:
        return
    if host == "localhost" or host.endswith(".localhost"):
        blocked = True
    else:
        try:
            blocked = _ip_is_blocked(ipaddress.ip_address(host))
        except ValueError:
            blocked = False  # a hostname; resolved and checked on every request instead
    if blocked:
        raise EgressBlocked(
            f"host {host!r} is private or loopback. To test a local model on purpose, list it "
            "under security.egress.allow_hosts"
        )


@dataclass(frozen=True)
class EgressPolicy:
    """The egress rules for one run, built from `security.egress` in the config.

    The default is the strict policy: HTTPS only, no private, loopback, or metadata addresses.
    """

    allowed_schemes: tuple[str, ...] = ("https",)
    allow_private: bool = False
    allow_hosts: tuple[str, ...] = field(default_factory=tuple)

    def check(self, url: str) -> None:
        check_url(
            url,
            allowed_schemes=self.allowed_schemes,
            allow_private=self.allow_private,
            allow_hosts=self.allow_hosts,
        )

    def static_check(self, url: str) -> None:
        static_check_url(
            url,
            allowed_schemes=self.allowed_schemes,
            allow_private=self.allow_private,
            allow_hosts=self.allow_hosts,
        )
