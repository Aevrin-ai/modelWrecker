"""Shared test setup.

Cloud sync isolation: every test gets an empty, temporary credential folder and no cloud env vars,
so a real device credential on the developer's machine can never be read or used, and `run` never
tries to sync to a real endpoint.
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _isolate_cloud_credentials(tmp_path_factory, monkeypatch):
    from modelwrecker.cloud import credentials

    monkeypatch.setattr(credentials, "_config_dir_override", tmp_path_factory.mktemp("mwcfg"))
    monkeypatch.delenv("MODELWRECKER_DEVICE_TOKEN", raising=False)
    monkeypatch.delenv("MODELWRECKER_CLOUD_URL", raising=False)
