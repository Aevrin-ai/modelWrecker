"""PyRIT-backed attack strategies (ADR-0006): PAIR, TAP, and a simple prompt-sending baseline.

These wrap PyRIT attack executors behind our Strategy interface. Our provider is bridged into a
PyRIT target (see pyrit_bridge), the attack runs, and its result is converted back to our shapes.
PyRIT is an optional dependency; these strategies are only registered when PyRIT imports (see
registry).
"""

from __future__ import annotations

from ..data import TaxonomyRef
from ..interfaces import Capability
from .base import BaseStrategy, StrategyContext, StrategyResult, StrategyRun
from .pyrit_bridge import ensure_pyrit, make_target, make_threshold_scorer, result_to_observation
from .spec import Maturity, StrategySpec

_JAILBREAK_TAX = [
    TaxonomyRef(framework="owasp_llm", id="LLM01", edition="2026"),
    TaxonomyRef(framework="mitre_atlas", id="AML.T0054"),
]


class _PyRITStrategy(BaseStrategy):
    """Shared runner: build a PyRIT attack, execute it, convert the result."""

    def build_attack(self, ctx: StrategyContext):  # pragma: no cover - overridden
        raise NotImplementedError

    async def run(self, ctx: StrategyContext) -> StrategyResult:
        await ensure_pyrit()
        objective = ctx.objective.description or ctx.objective.title
        ctx.emit(f"[{self.name}] running PyRIT attack")
        attack = self.build_attack(ctx)
        result = await attack.execute_async(objective=objective)
        attempt = self._attempt(ctx, objective)
        obs = result_to_observation(result, attempt)
        return StrategyResult(runs=[StrategyRun(attempt=attempt, observation=obs)], note=self.name)


class PyRITPromptSending(_PyRITStrategy):
    name = "pyrit_send"
    version = "1"
    required_target_capabilities = {Capability.SEND_MESSAGE}
    candidate_taxonomy = _JAILBREAK_TAX
    spec = StrategySpec(
        description="Sends the objective through PyRIT's prompt-sending attack (PyRIT-based).",
        family="direct_model_attacks",
        target_types=("chat", "agent", "rag", "mcp"),
        expected_safe_behavior="The model refuses across the attack's turns.",
        success_criteria="The model produces the disallowed content, confirmed on replay.",
        failure_criteria="The model refuses.",
        evidence="The attack transcript and the judge verdict.",
        maturity=Maturity.STABLE,
        notes="Runs only when the optional PyRIT `attacks` extra is installed.",
    )

    def build_attack(self, ctx: StrategyContext):
        from pyrit.executor.attack import PromptSendingAttack

        target = make_target(ctx.target._provider, ctx.target._system)
        return PromptSendingAttack(objective_target=target)


class PyRITPair(_PyRITStrategy):
    name = "pyrit_pair"
    version = "1"
    required_target_capabilities = {Capability.SEND_MULTITURN}
    candidate_taxonomy = _JAILBREAK_TAX
    spec = StrategySpec(
        description=(
            "Runs PyRIT's PAIR attack: an adversarial model refines the prompt over turns."
        ),
        family="direct_model_attacks",
        target_types=("chat", "agent", "rag", "mcp"),
        expected_safe_behavior="The model refuses across the attack's turns.",
        success_criteria="The model produces the disallowed content, confirmed on replay.",
        failure_criteria="The model refuses.",
        evidence="The attack transcript and the judge verdict.",
        maturity=Maturity.STABLE,
        notes="Runs only when the optional PyRIT `attacks` extra is installed.",
    )

    def build_attack(self, ctx: StrategyContext):
        from pyrit.executor.attack import AttackAdversarialConfig, AttackScoringConfig, PAIRAttack

        objective_target = make_target(ctx.target._provider, ctx.target._system, multi_turn=True)
        adversarial = make_target(ctx.attacker, multi_turn=True)
        scorer = make_threshold_scorer(ctx.judge_provider or ctx.attacker)
        return PAIRAttack(
            objective_target=objective_target,
            attack_adversarial_config=AttackAdversarialConfig(target=adversarial),
            attack_scoring_config=AttackScoringConfig(objective_scorer=scorer),
        )


class PyRITTap(_PyRITStrategy):
    name = "pyrit_tap"
    version = "1"
    required_target_capabilities = {Capability.SEND_MULTITURN}
    candidate_taxonomy = _JAILBREAK_TAX
    spec = StrategySpec(
        description=(
            "Runs PyRIT's TAP attack: a tree of attack prompts pruned toward success."
        ),
        family="direct_model_attacks",
        target_types=("chat", "agent", "rag", "mcp"),
        expected_safe_behavior="The model refuses across the attack's turns.",
        success_criteria="The model produces the disallowed content, confirmed on replay.",
        failure_criteria="The model refuses.",
        evidence="The attack transcript and the judge verdict.",
        maturity=Maturity.STABLE,
        notes="Runs only when the optional PyRIT `attacks` extra is installed.",
    )

    def build_attack(self, ctx: StrategyContext):
        from pyrit.executor.attack import AttackAdversarialConfig, AttackScoringConfig, TAPAttack

        objective_target = make_target(ctx.target._provider, ctx.target._system, multi_turn=True)
        adversarial = make_target(ctx.attacker, multi_turn=True)
        scorer = make_threshold_scorer(ctx.judge_provider or ctx.attacker)
        return TAPAttack(
            objective_target=objective_target,
            attack_adversarial_config=AttackAdversarialConfig(target=adversarial),
            attack_scoring_config=AttackScoringConfig(objective_scorer=scorer),
        )
