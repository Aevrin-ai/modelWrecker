"""Parse each dataset's raw records into normalized `DatasetCase`s.

Kept separate from the network loader so parsing is pure and unit-testable from a local fixture. A
parser takes a dict of label -> rows (most datasets have one label, "main"; JailbreakBench has
"harmful" and "benign").
"""

from __future__ import annotations

from .base import DatasetCase


# InjecAgent wraps text in literal quotes; strip one pair so a detector cannot key on the wrapper
def _unwrap(text: str) -> str:
    stripped = (text or "").strip()
    if len(stripped) >= 2 and stripped[0] == '"' and stripped[-1] == '"':
        stripped = stripped[1:-1].replace('\\"', '"')
    return stripped


def parse_injecagent(files: dict) -> list[DatasetCase]:
    """InjecAgent direct-harm cases: a user task plus an attacker instruction via a tool."""
    rows = files["main"]
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
        if key in seen:
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


def parse_agent_injection_bench(files: dict) -> list[DatasetCase]:
    """AgentInjectionBench rows: attack and benign cases with forbidden tools and canaries."""
    rows = files["main"]
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
        forbidden = execution.get("forbidden_tools") or []
        tools = []
        for t in r.get("tools_available") or []:
            if isinstance(t, dict) and t.get("name"):
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
            forbidden_tools=[str(t) for t in forbidden],
            canaries=[str(c) for c in (execution.get("canary_secrets") or [])],
            is_benign=(category == "benign" or r.get("ground_truth") == "safe"),
            ground_truth=str(r.get("ground_truth")) if r.get("ground_truth") else None,
            raw={"severity": r.get("severity"), "injection_surface": r.get("injection_surface")},
        ))
    return out


def _behavior_case(row: dict, i: int, *, benign: bool) -> DatasetCase:
    goal = str(row.get("Goal") or row.get("Behavior") or "")
    return DatasetCase(
        id=str(row.get("Index", row.get("BehaviorID", i))),
        dataset="jailbreakbench",
        category="benign" if benign else "harmful",
        user_instruction=goal,
        is_benign=benign,
        ground_truth="safe" if benign else "unsafe",
        raw={"category": row.get("Category"), "source": row.get("Source")},
    )


def parse_harmbench(files: dict) -> list[DatasetCase]:
    """HarmBench text behaviours: standardised harmful requests (no benign set)."""
    rows = files["main"]
    if not isinstance(rows, list) or not rows or "Behavior" not in rows[0]:
        raise ValueError("HarmBench data is missing the Behavior column")
    out: list[DatasetCase] = []
    for i, r in enumerate(rows):
        out.append(DatasetCase(
            id=str(r.get("BehaviorID", i)),
            dataset="harmbench",
            category="harmful",
            user_instruction=str(r.get("Behavior") or ""),
            ground_truth="unsafe",
            raw={"functional": r.get("FunctionalCategory"),
                 "semantic": r.get("SemanticCategory"), "context": r.get("ContextString")},
        ))
    return out


def parse_jailbreakbench(files: dict) -> list[DatasetCase]:
    """JailbreakBench JBB-Behaviors: harmful behaviours plus matched benign controls."""
    harmful = files.get("harmful")
    benign = files.get("benign")
    if not isinstance(harmful, list) or not harmful or "Goal" not in harmful[0]:
        raise ValueError("JailbreakBench harmful data is missing or malformed")
    out = [_behavior_case(r, i, benign=False) for i, r in enumerate(harmful)]
    out += [_behavior_case(r, i, benign=True) for i, r in enumerate(benign or [])]
    return out


PARSERS = {
    "injecagent": parse_injecagent,
    "agent_injection_bench": parse_agent_injection_bench,
    "harmbench": parse_harmbench,
    "jailbreakbench": parse_jailbreakbench,
}
