"""Discover the tools a live MCP server exposes, over streamable HTTP.

This is **discovery only**: the MCP-specific attack surface is a tool whose description hides
instructions (tool poisoning, OWASP MCP03), so modelWrecker reads the server's tool
list and feeds those descriptions into the agent as its (untrusted) tool catalog. modelWrecker never
calls a tool on the server, so connecting cannot cause a side effect on it.

Used by the MCP target when `target_options.mcp_url` is set. Requires the `mcp` extra.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

# a tool whose name or description has one of these verbs is sensitive, so calling it is misuse
_SENSITIVE_HINTS = (
    "write", "send", "delete", "remove", "exec", "run", "shell", "command", "transfer", "pay",
    "email", "post", "create", "update", "drop", "install", "upload", "publish", "grant",
)


def _looks_sensitive(name: str, description: str) -> bool:
    text = f"{name} {description}".lower()
    return any(h in text for h in _SENSITIVE_HINTS)


async def discover_tools(url: str, *, sensitive: set[str] | None = None,
                         timeout: float = 20.0) -> list[dict]:
    """Connect to an MCP server, list its tools, and return them as {name, description, sensitive}.

    A tool is marked sensitive when the operator named it in `sensitive`, or when its name or
    description suggests a state-changing action. Raises RuntimeError with a safe message.
    """
    if not (url.startswith("https://") or url.startswith("http://")):
        raise RuntimeError("the MCP server URL must be http(s)")
    sensitive = sensitive or set()
    try:
        import anyio
        from mcp import ClientSession
        from mcp.client.streamable_http import streamable_http_client
    except ImportError as e:  # pragma: no cover - requires the mcp extra
        raise RuntimeError("connecting to an MCP server needs the `mcp` extra") from e

    try:
        with anyio.fail_after(timeout):
            return await _list_tools(url, sensitive, ClientSession, streamable_http_client)
    except (RuntimeError, TimeoutError):
        raise
    except Exception as e:  # network / protocol errors become a clean, safe message
        raise RuntimeError(
            f"could not discover tools from the MCP server: {type(e).__name__}"
        ) from e


async def _list_tools(url: str, sensitive: set[str], session_class: type,
                      connect: Callable[[str], Any]) -> list[dict]:
    """List the server's tools over one session; nothing on the server is ever called."""
    async with connect(url) as streams:
        read, write = streams[0], streams[1]
        async with session_class(read, write) as session:
            await session.initialize()
            result = await session.list_tools()
            return [_tool_entry(tool, sensitive) for tool in result.tools]


def _tool_entry(tool: Any, sensitive: set[str]) -> dict:
    name = str(tool.name)
    description = str(getattr(tool, "description", "") or "")
    return {
        "name": name,
        "description": description,
        "sensitive": name in sensitive or _looks_sensitive(name, description),
    }
