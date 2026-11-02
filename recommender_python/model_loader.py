"""Secure loading of explicitly configured XGBoost recommendation models."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any


class ModelLoadError(RuntimeError):
    """Raised when the configured V4 model cannot be loaded safely."""


def load_v4_model(model_path: str | os.PathLike[str] | None = None) -> Any:
    configured = model_path or os.environ.get("RECOMMENDATION_MODEL_PATH")
    if not configured:
        raise ModelLoadError(
            "V4 requires RECOMMENDATION_MODEL_PATH pointing to a saved XGBoost model"
        )

    path = Path(configured).expanduser().resolve()
    if not path.is_file():
        raise ModelLoadError(f"V4 model file does not exist: {path}")
    if path.suffix.lower() not in {".json", ".ubj", ".model", ".bin"}:
        raise ModelLoadError(
            "V4 model must use an XGBoost model extension: .json, .ubj, .model, or .bin"
        )
    max_bytes = int(os.environ.get("RECOMMENDATION_MODEL_MAX_BYTES", 512 * 1024 * 1024))
    if path.stat().st_size > max_bytes:
        raise ModelLoadError(f"V4 model exceeds the configured size limit of {max_bytes} bytes")

    try:
        import xgboost as xgb
    except ImportError as exc:
        raise ModelLoadError("V4 requires the xgboost package") from exc

    try:
        model = xgb.XGBRanker()
        model.load_model(str(path))
    except Exception as exc:
        raise ModelLoadError(f"Unable to load compatible XGBoost ranker from {path}: {exc}") from exc

    if not hasattr(model, "predict"):
        raise ModelLoadError(f"Loaded V4 model is not a prediction-capable XGBoost ranker: {path}")
    return model
