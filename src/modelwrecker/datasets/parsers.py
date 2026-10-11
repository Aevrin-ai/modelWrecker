"""Parse each dataset's raw records into normalized `DatasetCase`s.

Kept separate from the network loader so parsing is pure and unit-testable from a local fixture.
"""

from __future__ import annotations

from .base import DatasetCase


# InjecAgent wraps every attacker instruction and tool response in literal quotes with escaped
# inner
# quotes (issue #7); strip a single enclosing pair so a detector cannot key on the wrapper.
def _unwrap(text: str) -> str:
    t = (text or "").strip()
    if len(t) >= 2 and t[0] == '"' and t[-1] == '"':
        t = t[1:-1].replace('\\"', '"')
    return t


def parse_injecagent(rows: object) -> list[DatasetCase]:
    """InjecAgent direct-harm cases: a user task plus an attacker instruction via a tool."""
    if not isinstance(rows, list):
        raise ValueError("InjecAgent data must be a JSON list")
    out: list[DatasetCase] = []
    seen: set[str] = set()
    for i, r in enumerate(rows):
        if not isinstance(r, dict) or not {"User Instruction", "Attacker Instruction"} <= set(r):
            raise ValueError(f"InjecAgent case {i} is missing required fields")
        user = str(r["User Instruction"])
        attacker = _unwrap(str(r["Attacker Instruction"]))
        key = f"{user}\n{attacker}"
        if key in seen:  # dedupe repeated (user, attacker) pairs
            continue
        seen.add(key)
        user_tool = str(r.get("User Tool") or "")
        attacker_tool = str(r.get("Attacker Tools") or "")
        tools = [{"name": user_tool, "description": "the tool the user asked for",
                  "sensitive": False}] if user_tool else []
        if attacker_tool:
            tools.append({"name": attacker_tool, "description": "the tool the attack wants used",
                          "sensitive": True})
        out.append(DatasetCase(
            id=f"dh-{i}",
            dataset="injecagent",
            category="indirect_injection",
            user_instruction=user,
            attacker_instruction=attacker,
            tools=tools,
            forbidden_tools=[attacker_tool] if attacker_tool else [],
            raw={"attack_type": r.get("Attack Type"), "expected": r.get("Expected Achievements")},
        ))
    return out


def parse_agent_injection_bench(rows: object) -> list[DatasetCase]:
    """AgentInjectionBench rows: attack and benign cases with forbidden tools and canaries."""
    if not isinstance(rows, list):
        raise ValueError("AgentInjectionBench data must be a list of rows")
    out: list[DatasetCase] = []
    seen: set[str] = set()
    for i, r in enumerate(rows):
        if not isinstance(r, dict) or "id" not in r or "attack_category" not in r:
            raise ValueError(f"AgentInjectionBench row {i} is missing required fields")
        rid = str(r["id"])
        if rid in seen:
            continue
        seen.add(rid)
        category = str(r["attack_category"])
        execution = r.get("execution") or {}
        convo = r.get("conversation") or []
        user_msg = next((str(m.get("content", "")) for m in convo
                         if isinstance(m, dict) and m.get("role") == "user"), "")
        tools = []
        for t in r.get("tools_available") or []:
            if isinstance(t, dict) and t.get("name"):
                forbidden = execution.get("forbidden_tools") or []
                tools.append({"name": str(t["name"]),
                              "description": str(t.get("description", "")),
                              "sensitive": str(t["name"]) in forbidden})
        out.append(DatasetCase(
            id=rid,
            dataset="agent_injection_bench",
            category=category,
            user_instruction=user_msg,
            attacker_instruction=str(r.get("attacker_intent") or ""),
            tools=tools,
            forbidden_tools=[str(t) for t in (execution.get("forbidden_tools") or [])],
            canaries=[str(c) for c in (execution.get("canary_secrets") or [])],
            is_benign=(category == "benign" or r.get("ground_truth") == "safe"),
            ground_truth=str(r.get("ground_truth")) if r.get("ground_truth") else None,
            raw={"severity": r.get("severity"), "injection_surface": r.get("injection_surface")},
        ))
    return out


PARSERS = {
    "injecagent": parse_injecagent,
    "agent_injection_bench": parse_agent_injection_bench,
}
