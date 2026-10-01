# ADR-0004 - Separate attacker, target, and judge

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Model the **attacker**, **target**, and **judge** as three distinct roles with distinct code and distinct
configured endpoints. They are never merged. The attacker role is the planner + (inside some strategies)
an attacker LLM; the target is the system under test; the judge is the verdict ensemble.

## Why
- It is modelWrecker's central architectural rule and matches Aevrin's role-separation design, which works.
- Mixing roles causes bias (a model judging its own attack), coupling, and confused evidence. Separation
  gives clean evidence ("attacker X, target Y, judge Z"), lets each role use the best/cheapest model, and
  supports the fully-local and mixed configurations.

## Alternatives
- **One model does attack+judge** - cheaper but biased and not credible; rejected.
- **Attacker LLM as the whole engine** (a tool-calling-terminal model) - flexible but puts
  selection logic in prompts and makes "the engine" the tool list. We keep an attacker LLM available
  *inside* strategies but put selection in a code planner (ADR-0005).

## Trade-offs
- Three endpoints to configure instead of one; more moving parts. Worth it for unbiased, reproducible,
  explainable results.
