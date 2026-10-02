# modelWrecker container. Same core engine as the pip package (one engine, many distributions).
# Runs as a non-root user, with no host access beyond what you explicitly mount.
# Security rules: docs/security/docker.md. How to run it: docs/deployment/docker.md.
#
# Build:   docker build -t modelwrecker:local .
#          docker build -t modelwrecker:local --build-arg EXTRAS=mcp,attacks .   (adds PyRIT)
# Run:     docker compose run --rm modelwrecker run /config/campaign.yaml

# Base image pinned by tag AND digest so a rebuild gets the same bytes. Bump both together on purpose.
ARG PYTHON_IMAGE=python:3.12.15-slim-bookworm@sha256:7ec4715ec1f0fc9a6d4835b995d2b6e921ea23ff8b354c33f6f9fb82f5882ac7

# ---- build stage: install the engine into a self-contained virtual environment ----
FROM ${PYTHON_IMAGE} AS build

# Optional extras to install (comma list from pyproject.toml): mcp, attacks, scan, judges, providers.
ARG EXTRAS=mcp

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /src
COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install ".[${EXTRAS}]"

# ---- runtime stage: only the venv, no source tree, no build cache ----
FROM ${PYTHON_IMAGE} AS runtime

LABEL org.opencontainers.image.title="modelWrecker" \
      org.opencontainers.image.description="AI red teaming engine (local engine container)" \
      org.opencontainers.image.licenses="Apache-2.0"

# No .pyc writes (the root filesystem is read-only at run time), unbuffered logs, venv on PATH.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:${PATH}"

# Unprivileged user. /work is the working dir; /work/runs is where run artifacts land.
# /config is the mount point for read-only campaign configs.
RUN groupadd --gid 10001 wrecker \
    && useradd --uid 10001 --gid 10001 --no-create-home --home-dir /tmp --shell /usr/sbin/nologin wrecker \
    && mkdir -p /work/runs /config \
    && chown -R 10001:10001 /work

COPY --from=build /opt/venv /opt/venv

WORKDIR /work
USER 10001:10001

# No HEALTHCHECK: this is a run-to-completion CLI, not a long-running service, so there is nothing to
# probe. Docker reports the exit code instead (0 = ok, 2 = config error).
HEALTHCHECK NONE

# SIGINT lets `docker stop` interrupt a campaign the same way Ctrl-C does, instead of waiting for a
# SIGKILL. Events already written to the run dir stay on disk.
STOPSIGNAL SIGINT

# Default command shows help; override with: docker compose run --rm modelwrecker run /config/x.yaml
ENTRYPOINT ["modelwrecker"]
CMD ["--help"]
