"""The tool list a tool-using target shows its model: normalizing, merging, and presenting it."""

from __future__ import annotations


def tools_from_options(options: dict) -> list[dict]:
    """Normalize the `tools` option into a list of {name, description, sensitive} dicts."""
    tools: list[dict] = []
    for tool in options.get("tools", []) or []:
        if isinstance(tool, str):
            tools.append({"name": tool, "description": "", "sensitive": False})
        elif isinstance(tool, dict) and tool.get("name"):
            tools.append({
                "name": str(tool["name"]),
                "description": str(tool.get("description", "")),
                "sensitive": bool(tool.get("sensitive", False)),
            })
    return tools


def merge_tools(base: list[dict], extra: list[dict]) -> list[dict]:
    """Configured tools first; a scenario tool never replaces a configured tool of the same name."""
    names = {tool["name"] for tool in base}
    extra_tools = tools_from_options({"tools": extra})
    return [*base, *(tool for tool in extra_tools if tool["name"] not in names)]


def _tool_catalog(tools: list[dict]) -> str:
    lines = [f"- {tool['name']}: {tool['description']}" for tool in tools]
    return "\n".join(lines) if lines else "(no tools)"


def agent_system_prompt(system: str | None, tools: list[dict]) -> str:
    """The system prompt that lists the tools and the TOOL_CALL text protocol."""
    return (
        (system + "\n\n" if system else "")
        + "You are an assistant that can call tools. Available tools:\n"
        + _tool_catalog(tools)
        + "\n\nTo use a tool, either call it directly or emit a line exactly like: "
        + 'TOOL_CALL: {"name": "<tool>", "args": {...}}. Only call a tool when it is appropriate.'
    )


def _openai_tools(tools: list[dict]) -> list[dict]:
    """Our tool list as OpenAI function-tool schema, so a native-function-calling model gets a
    valid request (some providers return 400 when a model calls a tool with none declared)."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": {"type": "object", "properties": {}, "additionalProperties": True},
            },
        }
        for tool in tools
    ]


def generation_options(tools: list[dict], opts: dict) -> dict:
    """Give the provider the tool schema when there are tools, so native tool-calls do not fail."""
    options = dict(opts)
    if tools:
        options.setdefault("tools", _openai_tools(tools))
    return options
