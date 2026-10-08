"""Taxonomy tables and validation.

Only verified entries from the official sources (see docs/research/taxonomies.md). A mapping to an
unknown id is rejected, so a finding can never ship an invented mapping (see
docs/architecture/TAXONOMY.md).

Note: OWASP Agentic (ASI) exact titles for ASI02-ASI09 must be filled from the official 2026 PDF
before those mappings are used; only the confirmed endpoints are included here for now.
"""

from __future__ import annotations

from .data import TaxonomyRef

OWASP_LLM_2026 = {
    "LLM01": "Prompt Injection",
    "LLM02": "Sensitive Information Disclosure",
    "LLM03": "Excessive Agency",
    "LLM04": "Supply Chain",
    "LLM05": "Data and Model Poisoning",
    "LLM06": "Unbounded Consumption",
    "LLM07": "Misinformation",
    "LLM08": "Hidden Context Exposure",
    "LLM09": "Vector and Embedding Weaknesses",
    "LLM10": "Improper Output Handling",
}

OWASP_LLM_2025 = {
    "LLM01": "Prompt Injection",
    "LLM02": "Sensitive Information Disclosure",
    "LLM03": "Supply Chain",
    "LLM04": "Data and Model Poisoning",
    "LLM05": "Improper Output Handling",
    "LLM06": "Excessive Agency",
    "LLM07": "System Prompt Leakage",
    "LLM08": "Vector and Embedding Weaknesses",
    "LLM09": "Misinformation",
    "LLM10": "Unbounded Consumption",
}

OWASP_MCP_2025 = {
    "MCP01": "Token Mismanagement & Secret Exposure",
    "MCP02": "Privilege Escalation via Scope Creep",
    "MCP03": "Tool Poisoning",
    "MCP04": "Software Supply Chain Attacks & Dependency Tampering",
    "MCP05": "Command Injection & Execution",
    "MCP06": "Intent Flow Subversion",
    "MCP07": "Insufficient Authentication & Authorization",
    "MCP08": "Lack of Audit and Telemetry",
    "MCP09": "Shadow MCP Servers",
    "MCP10": "Context Injection & Over-Sharing",
}

# Only confirmed ASI endpoints; ASI02-ASI09 titles to be added from the official PDF.
OWASP_ASI_2026 = {
    "ASI01": "Agent Goal Hijack",
    "ASI10": "Rogue Agents",
}

# Verified ATLAS techniques relevant to LLM attacks.
MITRE_ATLAS = {
    "AML.T0051": "LLM Prompt Injection",
    "AML.T0054": "LLM Jailbreak",
    "AML.T0057": "LLM Data Leakage",
    "AML.T0048": "External Harms",
    "AML.T0043": "Craft Adversarial Data",
    "AML.T0024": "Exfiltration via ML Inference API",
}

_TABLES = {
    ("owasp_llm", "2026"): OWASP_LLM_2026,
    ("owasp_llm", "2025"): OWASP_LLM_2025,
    ("owasp_mcp", "2025"): OWASP_MCP_2025,
    ("owasp_mcp", None): OWASP_MCP_2025,
    ("owasp_asi", "2026"): OWASP_ASI_2026,
    ("owasp_asi", None): OWASP_ASI_2026,
    ("mitre_atlas", None): MITRE_ATLAS,
}


class UnknownTaxonomyEntry(ValueError):
    """Raised when a mapping points to an id that is not in the verified tables."""


def _table_for(framework: str, edition: str | None) -> dict[str, str]:
    table = _TABLES.get((framework, edition))
    if table is None and edition is not None:
        table = _TABLES.get((framework, None))
    if table is None:
        raise UnknownTaxonomyEntry(f"unknown framework/edition: {framework}/{edition}")
    return table


def validate_ref(ref: TaxonomyRef) -> TaxonomyRef:
    """Return the ref with its official title filled in, or raise if the id is not verified."""
    table = _table_for(ref.framework, ref.edition)
    if ref.id not in table:
        raise UnknownTaxonomyEntry(
            f"{ref.framework} {ref.id} (edition {ref.edition}) is not a known entry"
        )
    return ref.model_copy(update={"title": table[ref.id]})

