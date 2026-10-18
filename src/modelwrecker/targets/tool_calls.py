"""Read the tool calls a model asked for, from the TOOL_CALL text protocol or the native tool API.

Calls are only read and recorded here. Nothing ever executes a tool a model asks for.
"""

from __future__ import annotations

import json

from ..providers.base import Completion

TOOL_CALL_MARKER = "TOOL_CALL:"


def _balanced_object(text: str, start: int) -> str | None:
    """Return the JSON object starting at the first '{' at/after `start`, matching nested braces."""
    i = text.find("{", start)
    if i < 0:
        return None
    depth = 0
    in_string = False
    is_escaped = False
    for j in range(i, len(text)):
        char = text[j]
        if in_string:
            if is_escaped:
                is_escaped = False
            elif char == "\\":
                is_escaped = True
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[i : j + 1]
    return None


def parse_tool_calls(text: str) -> list[dict]:
    """Every `TOOL_CALL: {"name": ..., "args": ...}` in a reply, in order; bad JSON is skipped."""
    calls: list[dict] = []
    text = text or ""
    position = 0
    while True:
        marker_at = text.find(TOOL_CALL_MARKER, position)
        if marker_at < 0:
            break
        block = _balanced_object(text, marker_at + len(TOOL_CALL_MARKER))
        position = marker_at + len(TOOL_CALL_MARKER)
        if block is None:
            continue
        position = text.find(block, position) + len(block)
        try:
            call = json.loads(block)
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(call, dict) and call.get("name"):
            calls.append({"name": str(call["name"]), "args": call.get("args", {}) or {}})
    return calls


def native_calls(completion: Completion) -> list[dict]:
    """Tool calls the model returned through the provider's tool API (not the text protocol)."""
    calls: list[dict] = []
    for tool_call in completion.tool_calls or []:
        function = tool_call.get("function") if isinstance(tool_call, dict) else None
        name = (function or {}).get("name")
        if not name:
            continue
        calls.append({"name": str(name), "args": _native_args((function or {}).get("arguments")),
                      "id": tool_call.get("id") if isinstance(tool_call, dict) else None})
    return calls


def _native_args(raw: object) -> dict:
    """Native arguments arrive as a JSON string or a dict; anything else becomes {}."""
    try:
        args = json.loads(raw) if isinstance(raw, str) and raw.strip() else raw
    except (json.JSONDecodeError, ValueError):
        args = {}
    return args if isinstance(args, dict) else {}
