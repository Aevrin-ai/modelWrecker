"""Dataset case shape, the dataset registry, and conversion to an Objective.

A `DatasetCase` is one normalized test case from an external benchmark. A `DatasetInfo` records
where the data comes from and its licence, so attribution and terms travel with the data.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..data import Objective, TaxonomyRef


@dataclass(frozen=True)
class DatasetInfo:
    name: str  # the short id used on the CLI and in config
    title: str
    homepage: str
    ref: str  # the pinned commit or revision (never a moving branch)
    license: str  # the data licence, exactly as the source states it
    attribution: str  # the line we keep when we use the data
    coverage: str
    fmt: str  # one of: json, jsonl, csv
    # label -> raw file URL with {ref}. One entry for most; two for a dataset with a benign file.
    files: dict[str, str] = field(default_factory=dict)
    default_category: str = ""  # objective category for chat-behaviour datasets (HarmBench, JBB)


@dataclass
class DatasetCase:
    id: str
    dataset: str
    category: str  # the normalized objective category (see planner._AUTO_ORDER)
    user_instruction: str  # the benign user request, or the harmful behaviour for chat datasets
    attacker_instruction: str = ""  # the injected instruction, empty for a benign control
    tools: list[dict] = field(default_factory=list)  # {name, description, sensitive}
    forbidden_tools: list[str] = field(default_factory=list)  # tools the agent must not call
    canaries: list[str] = field(default_factory=list)  # secrets that must not escape
    is_benign: bool = False  # a benign control case (measures false positives)
    ground_truth: str | None = None  # the dataset's own safe/unsafe label, when given
    raw: dict = field(default_factory=dict)


_IA = "https://raw.githubusercontent.com/uiuc-kang-lab/InjecAgent/{ref}/data/test_cases_dh_base.json"
_AIB = "https://raw.githubusercontent.com/ppradyoth/AgentInjectionBench/{ref}/data/agent_injection_bench.jsonl"
_HB = "https://raw.githubusercontent.com/centerforaisafety/HarmBench/{ref}/data/behavior_datasets/harmbench_behaviors_text_all.csv"
_JBB = "https://huggingface.co/datasets/JailbreakBench/JBB-Behaviors/resolve/{ref}/data/{split}-behaviors.csv"

# pinned, licence-clean datasets only: MCPTox and Tensor Trust have no licence, so they are left out
DATASETS: dict[str, DatasetInfo] = {
    "injecagent": DatasetInfo(
        name="injecagent",
        title="InjecAgent",
        homepage="https://github.com/uiuc-kang-lab/InjecAgent",
        ref="f19c9f2c79a41046eb13c03c51a24c567a8ffa07",
        license="MIT",
        attribution="InjecAgent (Zhan et al., 2024), MIT licence",
        coverage="Indirect prompt injection against tool-using agents (direct-harm cases).",
        fmt="json",
        files={"main": _IA},
    ),
    "agent_injection_bench": DatasetInfo(
        name="agent_injection_bench",
        title="AgentInjectionBench",
        homepage="https://github.com/ppradyoth/AgentInjectionBench",
        ref="325c3ce70f63f1c6fd66c0dd5c7abd4b110a5d30",
        license="Apache-2.0",
        attribution="AgentInjectionBench, Apache-2.0 licence",
        coverage="Agentic prompt injection and unsafe tool calls, with benign controls.",
        fmt="jsonl",
        files={"main": _AIB},
    ),
    "harmbench": DatasetInfo(
        name="harmbench",
        title="HarmBench (text)",
        homepage="https://github.com/centerforaisafety/HarmBench",
        ref="8e1604d1171fe8a48d8febecd22f600e462bdcdd",
        license="MIT",
        attribution="HarmBench (Mazeika et al., 2024), MIT licence",
        coverage="Standardised harmful-behaviour prompts for refusal and jailbreak testing (text).",
        fmt="csv",
        files={"main": _HB},
        default_category="harmful",
    ),
    "jailbreakbench": DatasetInfo(
        name="jailbreakbench",
        title="JailbreakBench (JBB-Behaviors)",
        homepage="https://github.com/JailbreakBench/jailbreakbench",
        ref="886acc352a31533ffbcf4ef22c744658688086fc",
        license="MIT",
        attribution="JailbreakBench JBB-Behaviors, MIT licence",
        coverage="Reproducible jailbreak behaviours with matched benign controls (chat).",
        fmt="csv",
        files={"harmful": _JBB.replace("{split}", "harmful"),
               "benign": _JBB.replace("{split}", "benign")},
        default_category="harmful",
    ),
}

# How AgentInjectionBench's own category maps to a modelWrecker objective category.
_AIB_CATEGORY = {
    "tool_output_injection": "indirect_injection",
    "goal_hijacking": "agent_hijack",
    "privilege_escalation": "excessive_agency",
    "data_exfiltration": "data_exfiltration",
    "mcp_context_poisoning": "mcp_tool_poisoning",
    "tool_shadowing": "mcp_tool_poisoning",
    "multi_turn_stateful": "indirect_injection",
    "benign": "indirect_injection",
}


def list_datasets() -> list[DatasetInfo]:
    return list(DATASETS.values())


def get_dataset(name: str) -> DatasetInfo:
    info = DATASETS.get(name)
    if info is None:
        raise KeyError(f"unknown dataset {name!r}; known: {sorted(DATASETS)}")
    return info


def to_objective(case: DatasetCase) -> Objective:
    """Turn a dataset case into an Objective the engine can run."""
    goal = case.attacker_instruction or case.user_instruction
    return Objective(
        title=f"{case.dataset}:{case.id}",
        description=goal,
        category=_AIB_CATEGORY.get(case.category, case.category),
        success_criteria="The target obeys the harmful or injected instruction.",
        candidate_taxonomy=[
            TaxonomyRef(framework="owasp_llm", id="LLM01", edition="2025"),
            TaxonomyRef(framework="mitre_atlas", id="AML.T0051"),
        ],
    )
