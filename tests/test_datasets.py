"""Dataset adapters: parsing, normalization, offline guard, and conversion to objectives.

Offline and deterministic: the parsers run on small local fixtures copied from each dataset's pinned
source, so no network is touched. See docs/datasets.md.
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import pytest

from modelwrecker.datasets import DatasetError, list_datasets, load_cases, to_objective
from modelwrecker.datasets.base import get_dataset
from modelwrecker.datasets.loader import OFFLINE_ENV, parse_files
from modelwrecker.datasets.parsers import (
    parse_agent_injection_bench,
    parse_harmbench,
    parse_injecagent,
    parse_jailbreakbench,
)

FIXTURES = Path(__file__).parent / "fixtures" / "datasets"


def _json(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _jsonl(name):
    text = (FIXTURES / name).read_text(encoding="utf-8")
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def _csv(name):
    return list(csv.DictReader(io.StringIO((FIXTURES / name).read_text(encoding="utf-8"))))


def test_registry_lists_only_licence_clean_datasets() -> None:
    names = {d.name for d in list_datasets()}
    assert names == {"injecagent", "agent_injection_bench", "harmbench", "jailbreakbench"}
    for info in list_datasets():
        assert info.license in {"MIT", "Apache-2.0"}
        assert info.attribution and len(info.ref) >= 12  # pinned to a commit, with attribution
        assert info.files and all("{ref}" in u for u in info.files.values())


def test_injecagent_parses_and_unwraps_the_quote_artifact() -> None:
    cases = parse_injecagent({"main": _json("injecagent_sample.json")})
    assert len(cases) == 3
    c = cases[0]
    assert c.dataset == "injecagent" and c.category == "indirect_injection"
    assert c.user_instruction and c.attacker_instruction
    assert not c.attacker_instruction.startswith('"')  # the escaped-quote wrapper is stripped
    assert c.forbidden_tools


def test_agent_injection_bench_keeps_benign_controls_and_canaries() -> None:
    cases = parse_agent_injection_bench({"main": _jsonl("aib_sample.jsonl")})
    assert len(cases) == 3
    assert any(c.is_benign for c in cases) and any(not c.is_benign for c in cases)
    attack = next(c for c in cases if not c.is_benign)
    assert attack.forbidden_tools or attack.canaries


def test_harmbench_text_parses_harmful_behaviours() -> None:
    cases = parse_harmbench({"main": _csv("harmbench_sample.csv")})
    assert len(cases) == 3
    assert all(c.category == "harmful" and not c.is_benign for c in cases)
    assert all(c.user_instruction for c in cases)


def test_jailbreakbench_pairs_harmful_with_benign_controls() -> None:
    cases = parse_jailbreakbench({
        "harmful": _csv("jbb_harmful_sample.csv"),
        "benign": _csv("jbb_benign_sample.csv"),
    })
    assert sum(1 for c in cases if c.is_benign) == 2
    assert sum(1 for c in cases if not c.is_benign) == 3
    assert all(c.user_instruction for c in cases)


def test_parser_rejects_a_bad_schema() -> None:
    with pytest.raises(ValueError):
        parse_injecagent({"main": [{"wrong": "shape"}]})
    with pytest.raises(ValueError):
        parse_agent_injection_bench({"main": "not a list"})
    with pytest.raises(ValueError):
        parse_harmbench({"main": [{"no": "behavior"}]})


def test_parse_files_reads_each_format() -> None:
    assert parse_files("injecagent", {"main": FIXTURES / "injecagent_sample.json"})
    assert parse_files("agent_injection_bench", {"main": FIXTURES / "aib_sample.jsonl"})
    assert parse_files("harmbench", {"main": FIXTURES / "harmbench_sample.csv"})
    assert parse_files("jailbreakbench", {
        "harmful": FIXTURES / "jbb_harmful_sample.csv",
        "benign": FIXTURES / "jbb_benign_sample.csv",
    })


def test_to_objective_maps_category_and_sets_criteria() -> None:
    cases = parse_files("agent_injection_bench", {"main": FIXTURES / "aib_sample.jsonl"})
    obj = to_objective(cases[0])
    assert obj.title.startswith("agent_injection_bench:")
    assert obj.category and obj.success_criteria
    assert any(t.framework == "owasp_llm" for t in obj.candidate_taxonomy)


def test_offline_without_a_cache_is_a_clean_error(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MODELWRECKER_DATASETS_DIR", str(tmp_path))
    monkeypatch.setenv(OFFLINE_ENV, "1")
    with pytest.raises(DatasetError) as e:
        load_cases("harmbench", offline=True)
    assert "downloads are off" in str(e.value)


def test_unknown_dataset_raises() -> None:
    with pytest.raises(KeyError):
        get_dataset("nope")
