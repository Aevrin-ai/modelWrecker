# ADR-0007 - Multi-signal judge ensemble

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
The judge combines several **signals** - LLM judge (StrongREJECT-style rubric), secret detector
(detect-secrets), PII detector (Presidio), rule/regex, structured-output judge, tool-action validator,
and a differential (A/B) judge - into one verdict via a per-objective weighted combiner. Judges must pass
**calibration** on benign fixtures before their success rate is trusted.

## Why
- A single LLM judge produces false positives/negatives and is swayed by fluent, "safe-looking" output
  and framing. Deterministic detectors catch concrete leaks/actions an LLM judge misses, and
  let a weak LLM judge be out-voted.
- Calibration prevents a mis-tuned judge from manufacturing findings (Aevrin's judge self-test principle).
- Different objectives need different signals (PII vs tool misuse), so weighting is per-objective.

## Alternatives
- **LLM judge only** - simplest, but unreliable and the top source of false findings. Rejected.
- **Rules only** - deterministic but misses semantic bypasses. Rejected.

## Trade-offs
- More components and model/compute cost per judgement. Mitigated: deterministic signals are cheap; the
  LLM signal can be a small model; calibration is a one-time per-config cost. The payoff is trustworthy
  findings, which is the whole point (Aevrin "validated").
