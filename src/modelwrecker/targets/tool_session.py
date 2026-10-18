"""Drive a tool-using model for one turn or a bounded session, recording every tool call.

Shared by the agent, MCP, memory, and multi-agent targets. Tool calls are only observed and
recorded: modelWrecker never executes a tool, so an attack can never cause a real side effect.
"""

from __future__ import annotations

from ..data import Observation, ToolCall
from ..providers.base import BaseProvider, Completion
from .tool_calls import native_calls, parse_tool_calls
from .tool_catalog import agent_system_prompt, generation_options

# what a tool with no fixture answers in a simulated session
NOT_EXECUTED = "(the test harness recorded this call; it was not executed)"


def _usage_meta(completions: list[Completion]) -> dict:
    return {
        "prompt_tokens": sum(c.usage.prompt_tokens for c in completions),
        "completion_tokens": sum(c.usage.completion_tokens for c in completions),
    }


def _sensitive_names(tools: list[dict]) -> set[str]:
    return {tool["name"] for tool in tools if tool["sensitive"]}


async def run_tool_agent(provider: BaseProvider, system: str | None, tools: list[dict], text: str,
                         **opts: object) -> Observation:
    """Drive one agent turn: present the tools, let the model respond, record any tool calls.

    The tool descriptions are passed to the model verbatim (so a poisoned description can
    influence it - the point of the MCP tool-poisoning test).
    """
    sensitive = _sensitive_names(tools)
    messages = [
        {"role": "system", "content": agent_system_prompt(system, tools)},
        {"role": "user", "content": text},
    ]
    completion = await provider.generate(messages, **generation_options(tools, opts))
    calls = [{"name": c["name"], "args": c["args"]} for c in native_calls(completion)]
    calls += parse_tool_calls(completion.text)
    called_sensitive = [c["name"] for c in calls if c["name"] in sensitive]
    return Observation(
        attempt_id="",
        response=completion.text,
        reasoning=completion.reasoning,
        tool_calls=[ToolCall(name=c["name"], args=c["args"]) for c in calls],
        target_meta={
            "model": completion.model,
            "latency_ms": completion.latency_ms,
            "tool_calls": [c["name"] for c in calls],
            "sensitive_tool_calls": called_sensitive,
            **_usage_meta([completion]),
        },
    )


async def run_tool_session(provider: BaseProvider, system: str | None, tools: list[dict],
                           task: str, environment: dict[str, str], max_steps: int = 4,
                           **opts: object) -> Observation:
    """Drive a bounded multi-step tool session with simulated tool results.

    The model asks for tools with TOOL_CALL lines. A tool named in `environment` answers with that
    fixture text; any other tool answers that the call was recorded and not executed. Nothing is
    ever executed, and the loop stops after `max_steps` model turns, so a target cannot loop without
    bound. Every call is recorded in order.
    """
    generation = generation_options(tools, opts)
    messages: list[dict] = [
        {"role": "system", "content": agent_system_prompt(system, tools)},
        {"role": "user", "content": task},
    ]
    completions: list[Completion] = []
    calls: list[dict] = []
    for _ in range(max(1, max_steps)):
        completion = await provider.generate(messages, **generation)
        completions.append(completion)
        step_native = native_calls(completion)
        step_text = parse_tool_calls(completion.text)
        step_calls = [{"name": c["name"], "args": c["args"]} for c in step_native] + step_text
        if not step_calls:
            break
        calls.extend(step_calls)
        messages.extend(_tool_replies(completion, step_native, step_text, environment))
    return _session_observation(completions, calls, tools)


def _tool_replies(completion: Completion, step_native: list[dict], step_text: list[dict],
                  environment: dict[str, str]) -> list[dict]:
    """Echo the model's turn, then feed each tool its fixture result.

    Native tool calls must be answered with role "tool" messages keyed by id; text calls get one
    user TOOL_RESULT message.
    """
    assistant: dict = {"role": "assistant", "content": completion.text or ""}
    if completion.tool_calls:
        assistant["tool_calls"] = completion.tool_calls
        assistant["content"] = completion.text or None
    replies = [assistant]
    for call in step_native:
        replies.append({"role": "tool", "tool_call_id": call.get("id") or call["name"],
                        "content": environment.get(call["name"], NOT_EXECUTED)})
    if step_text:
        results = [f"TOOL_RESULT {c['name']}:\n{environment.get(c['name'], NOT_EXECUTED)}"
                   for c in step_text]
        replies.append({"role": "user", "content": "\n\n".join(results)})
    return replies


def _session_observation(completions: list[Completion], calls: list[dict],
                         tools: list[dict]) -> Observation:
    sensitive = _sensitive_names(tools)
    last = completions[-1]
    return Observation(
        attempt_id="",
        response="\n\n".join(c.text for c in completions if c.text),
        reasoning=last.reasoning,
        tool_calls=[ToolCall(name=c["name"], args=c["args"]) for c in calls],
        target_meta={
            "model": last.model,
            "latency_ms": sum(c.latency_ms for c in completions),
            "steps": len(completions),
            "tool_calls": [c["name"] for c in calls],
            "sensitive_tool_calls": [c["name"] for c in calls if c["name"] in sensitive],
            **_usage_meta(completions),
        },
    )
