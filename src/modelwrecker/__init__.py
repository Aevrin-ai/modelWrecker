"""modelWrecker - an AI red teaming engine.

modelWrecker safely attacks AI systems (LLMs, chatbots, agents, RAG, MCP-connected tools) to find
security weaknesses, and turns each verified weakness into a reproducible finding.

This package is in early scaffolding (Phase 4 of the roadmap). The data models, interfaces, config,
security helpers, and CLI skeleton are in place; concrete provider/target/strategy/judge adapters and
the attack loop are built next. See docs/ for the design, and docs/index.md for the map.
"""

__version__ = "0.0.1"
