# ADR-0001 - Language and stack

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Implement modelWrecker in **Python 3.12+**, async-first (httpx), with Pydantic v2 for data/config,
Typer for the CLI, and uv for dependency/venv management.

## Why
Every library we want to reuse - PyRIT, garak, the MCP Python SDK, Presidio, detect-secrets, the OpenAI
and Anthropic SDKs - is Python. Choosing Python means we can wrap them behind interfaces instead of
reimplementing. The red-team workload is I/O-bound (model calls), which async handles well.

## Alternatives
- **TypeScript/Node** - promptfoo and Portkey live here, but the attack-algorithm and detector ecosystem
  (PyRIT/garak/Presidio) is Python; we'd be reimplementing more.
- **Go/Rust** - great for a gateway, poor fit for reusing the Python red-team ecosystem.

## Trade-offs
- Python packaging and perf are weaker than Go/Rust, mitigated by uv + async + keeping the core small.
- Ties us to the Python supply chain (hence the hygiene rules in ADR-0003 and ADR-0010).
