"""Keep an MCP config path inside the one directory the server may read configs from."""

from __future__ import annotations

from pathlib import Path

from .guardrail_error import GuardrailError

# config files must look like config files; anything else (a .env file, a key file) is refused
CONFIG_SUFFIXES = (".yaml", ".yml")


def _refuse(message: str, code: str = "path_out_of_scope") -> GuardrailError:
    return GuardrailError(message, check="path_scope", code=code)


def resolve_config_path(config_dir: Path, config_path: object) -> Path:
    """Resolve a config path and confirm it is a .yaml/.yml file inside config_dir, or raise."""
    if not isinstance(config_path, str) or not config_path.strip():
        raise _refuse("config_path must be a non-empty string", "invalid_path")
    if "\x00" in config_path or "://" in config_path:
        raise _refuse(f"config_path {config_path!r} is not a local file path", "invalid_path")
    raw = Path(config_path)
    candidate = raw if raw.is_absolute() else config_dir / raw
    try:
        resolved = candidate.resolve()
    except (OSError, RuntimeError, ValueError) as e:
        raise _refuse(f"config_path {config_path!r} cannot be resolved", "invalid_path") from e
    try:
        resolved.relative_to(config_dir)
    except ValueError as e:
        raise _refuse(
            f"config_path {config_path!r} is outside the allowed config directory") from e
    if resolved.suffix.lower() not in CONFIG_SUFFIXES:
        raise _refuse(f"config_path must end in {' or '.join(CONFIG_SUFFIXES)}", "invalid_path")
    if not resolved.is_file():
        raise _refuse(f"config file {config_path!r} not found in the allowed config directory",
                      "config_not_found")
    return resolved
