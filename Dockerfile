# modelWrecker container. Same core engine as the pip package (one engine, many distributions).
# Runs as a non-root user, with no host access beyond what you explicitly mount.
FROM python:3.12-slim AS base

# Don't write .pyc, flush logs, no pip cache layer.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Create an unprivileged user and a writable work dir for mounted configs + run artifacts.
RUN useradd --create-home --uid 10001 wrecker \
    && mkdir -p /work/runs \
    && chown -R wrecker:wrecker /work

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
# Install the engine. Add the mcp extra so the container can also serve the MCP harness tools.
RUN pip install ".[mcp]"

WORKDIR /work
USER wrecker

# Default command shows help; override with: docker run ... modelwrecker run /work/my.yaml
ENTRYPOINT ["modelwrecker"]
CMD ["--help"]
