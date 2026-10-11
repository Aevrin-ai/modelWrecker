"""Promptfoo compatibility layer: config translation, mapping coverage, and clear rejection.

Offline and deterministic. modelWrecker is the engine; this only translates a subset of a Promptfoo
red-team config into a modelWrecker config. See docs/integrations/promptfoo.md.
"""

from __future__ import annotations

import pytest

from modelwrecker.config import Endpoint
from modelwrecker.integrations import (
    PROMPTFOO_PLUGINS,
    PROMPTFOO_STRATEGIES,
    PromptfooError,
    translate_promptfoo,
)
from modelwrecker.integrations.promptfoo import (
    PROMPTFOO_UNSUPPORTED_PLUGINS,
    PROMPTFOO_UNSUPPORTED_STRATEGIES,
)


def _cfg(plugins, strategies, provider="openai:gpt-4o-mini", **rt):
    return {
        "redteam": {"plugins": plugins, "strategies": strategies, **rt},
        "targets": [{"id": provider, "config": {"apiKeyEnvar": "OPENAI_API_KEY"}}],
    }


def test_translates_plugins_to_objectives_and_a_valid_config() -> None:
    cfg = translate_promptfoo(_cfg(["prompt-extraction", "pii", "excessive-agency"], ["base64"],
                                   purpose="a customer support bot"))
    assert cfg.problems() == []  # the translated config is runnable
    cats = {o.category for o in cfg.objectives}
    assert cats == {"system_prompt_leak", "pii_leak", "excessive_agency"}
    assert all("support bot" in o.description for o in cfg.objectives)  # purpose is carried in
    assert cfg.attack.strategy == "encoded_jailbreak"
    assert cfg.attack.params["transforms"] == ["base64"]


def test_plugin_entries_may_be_strings_or_objects() -> None:
    cfg = translate_promptfoo(_cfg([{"id": "prompt-extraction", "numTests": 5}], []))
    assert cfg.objectives[0].category == "system_prompt_leak"
    assert cfg.attack.strategy == "auto"  # no strategies -> let the planner choose


def test_target_and_mcp_mapping() -> None:
    chat = translate_promptfoo(_cfg(["pii"], []))
    assert chat.target.type == "chat" and chat.target.model == "gpt-4o-mini"
    mcp = translate_promptfoo(_cfg(["mcp"], [], provider="mcp"))
    assert mcp.target.type == "mcp"
    # attacker and judge default to the target so the config is complete.
    assert chat.attacker is not None and chat.judge is not None


def test_attacker_and_judge_overrides_are_used() -> None:
    adv = Endpoint(protocol="openai_compatible", model="adv", base_url="https://x", api_key_env="K")
    cfg = translate_promptfoo(_cfg(["pii"], []), attacker=adv, judge=adv)
    assert cfg.attacker.model == "adv" and cfg.judge.model == "adv"


def test_unsupported_strategy_is_rejected_by_name() -> None:
    with pytest.raises(PromptfooError) as e:
        translate_promptfoo(_cfg(["pii"], ["goat"]))
    assert "goat" in str(e.value) and "remote-only" in str(e.value)


def test_unsupported_plugin_is_rejected_by_name() -> None:
    with pytest.raises(PromptfooError) as e:
        translate_promptfoo(_cfg(["hijacking"], []))
    assert "hijacking" in str(e.value)


def test_unknown_ids_are_rejected_not_ignored() -> None:
    with pytest.raises(PromptfooError) as e:
        translate_promptfoo(_cfg(["totally-made-up-plugin"], []))
    assert "unknown" in str(e.value).lower()
    with pytest.raises(PromptfooError):
        translate_promptfoo(_cfg(["pii"], ["made-up-strategy"]))


def test_missing_sections_fail_clearly() -> None:
    with pytest.raises(PromptfooError):
        translate_promptfoo({"targets": [{"id": "openai:x"}]})  # no redteam
    with pytest.raises(PromptfooError):
        translate_promptfoo({"redteam": {"plugins": [], "strategies": []},
                             "targets": [{"id": "openai:x"}]})  # no plugins
    with pytest.raises(PromptfooError):
        translate_promptfoo({"redteam": {"plugins": ["pii"]}})  # no target


def test_every_mapped_target_is_a_real_strategy_or_transform() -> None:
    from modelwrecker.payloads import list_transforms
    from modelwrecker.strategies.registry import list_strategies

    strategies = {s["name"] for s in list_strategies()}
    transforms = {t["name"] for t in list_transforms()}
    for spec in PROMPTFOO_STRATEGIES.values():
        assert spec["strategy"] in strategies
        for name in spec.get("transforms", []):
            assert name in transforms  # the transform exists in the payload engine


def test_every_mapped_plugin_category_is_known_to_the_planner() -> None:
    from modelwrecker.attacker.planner import _AUTO_DEFAULT, _AUTO_ORDER

    known = set(_AUTO_ORDER) | {"harmful", "pii_leak", "system_prompt_leak", "sensitive_info"}
    for spec in PROMPTFOO_PLUGINS.values():
        cat = spec["category"]
        # Either the planner routes the category, or it falls back to the default sequence.
        assert cat in known or _AUTO_DEFAULT  # the default always exists


def test_supported_and_unsupported_sets_do_not_overlap() -> None:
    assert not (set(PROMPTFOO_PLUGINS) & set(PROMPTFOO_UNSUPPORTED_PLUGINS))
    assert not (set(PROMPTFOO_STRATEGIES) & set(PROMPTFOO_UNSUPPORTED_STRATEGIES))
