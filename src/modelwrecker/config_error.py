"""The error raised for an invalid config."""


class ConfigError(ValueError):
    """Raised when a config is invalid. Mapped to a clean CLI error, never a stack trace."""
