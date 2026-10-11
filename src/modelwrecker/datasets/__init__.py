"""Benchmark dataset adapters (docs/datasets.md).

No dataset is bundled into the package or the Docker image. Each adapter loads a license-clean
dataset at runtime from a pinned source (a specific commit), caches it locally, validates its
schema, and converts its cases into modelWrecker `Objective`s. Downloads can be turned off; then
only
a cached copy is used. Each dataset's licence and attribution live in `DATASETS` and
docs/datasets.md.
"""

from __future__ import annotations

from .base import DatasetCase, DatasetInfo, get_dataset, list_datasets, to_objective
from .loader import DatasetError, load_cases

__all__ = [
    "DatasetCase",
    "DatasetInfo",
    "DatasetError",
    "get_dataset",
    "list_datasets",
    "load_cases",
    "to_objective",
]
