"""Dataset adapters: parsing, normalization, offline guard, and conversion to objectives.

Offline and deterministic: the parsers run on small local fixtures copied from each dataset's pinned
source, so no network is touched. See docs/datasets.md.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from modelwrecker.datasets import DatasetError, list_datasets, load_cases, to_objective
from modelwrecker.datasets.base import get_dataset
from modelwrecker.datasets.loader import OFFLINE_ENV, parse_file
from modelwrecker.datasets.parsers import parse_agent_injection_bench, parse_injecagent

FIXTURES = Path(__file__).parent / "fixtures" / "datasets"


def test_registry_lists_only_licence_clean_datasets() -> None:
    names = {d.name for d in list_datasets()}
    assert names == {"injecagent", "agent_injection_bench"}
    for info in list_datasets():
        assert info.license in {"MIT", "Apache-2.0"}
        assert info.attribution and len(info.ref) >= 12  # pinned to a commit, with attribution
        assert "{ref}" in info.url  # the URL pins to the recorded commit


def test_injecagent_parses_and_unwraps_the_quote_artifact() -> None:
    rows = json.loads((FIXTURES / "injecagent_sample.json").read_text(encoding="utf-8"))
    cases = parse_injecagent(rows)
    assert len(cases) == 3
    c = cases[0]
    assert c.dataset == "injecagent" and c.category == "indirect_injection"
    assert c.user_instruction and c.attacker_instruction
    # The stored attacker instruction is not wrapped in the dataset's escaped quotes.
    assert not c.attacker_instruction.startswith('"')
    assert c.forbidden_tools  # the attacker tool is marked forbidden


def test_agent_injection_bench_keeps_benign_controls_and_canaries() -> None:
    text = (FIXTURES / "aib_sample.jsonl").read_text(encoding="utf-8")
    rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    cases = parse_agent_injection_bench(rows)
    assert len(cases) == 3
    assert any(c.is_benign for c in cases)  # a benign control is kept
    assert any(not c.is_benign for c in cases)
    attack = next(c for c in cases if not c.is_benign)
    assert attack.forbidden_tools or attack.canaries  # execution constraints are carried through


def test_parser_rejects_a_bad_schema() -> None:
    with pytest.raises(ValueError):
        parse_injecagent([{"wrong": "shape"}])
    with pytest.raises(ValueError):
        parse_agent_injection_bench("not a list")


def test_parse_file_reads_json_and_jsonl() -> None:
    dh = parse_file("injecagent", FIXTURES / "injecagent_sample.json")
    aib = parse_file("agent_injection_bench", FIXTURES / "aib_sample.jsonl")
    assert dh and aib


def test_to_objective_maps_category_and_sets_criteria() -> None:
    cases = parse_file("agent_injection_bench", FIXTURES / "aib_sample.jsonl")
    obj = to_objective(cases[0])
    assert obj.title.startswith("agent_injection_bench:")
    assert obj.category and obj.success_criteria
    assert any(t.framework == "owasp_llm" for t in obj.candidate_taxonomy)


def test_offline_without_a_cache_is_a_clean_error(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MODELWRECKER_DATASETS_DIR", str(tmp_path))
    monkeypatch.setenv(OFFLINE_ENV, "1")
    with pytest.raises(DatasetError) as e:
        load_cases("injecagent", offline=True)
    assert "downloads are off" in str(e.value)


def test_unknown_dataset_raises() -> None:
    with pytest.raises(KeyError):
        get_dataset("nope")
