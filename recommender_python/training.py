"""Offline V4 XGBoost ranking training helpers.

Labels are accepted from a caller or generated only from an explicitly supplied
simulation seed and latent function; no production labels are inferred.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any


def train_v4_ranker(feature_rows: list[list[float]], labels: list[float], groups: list[int], seed: int = 0) -> Any:
    try:
        import xgboost as xgb
    except ImportError as exc:
        raise RuntimeError("V4 training requires xgboost") from exc
    if len(feature_rows) != len(labels) or sum(groups) != len(labels):
        raise ValueError("feature_rows, labels, and groups must describe the same rows")
    model = xgb.XGBRanker(
        objective="rank:ndcg",
        eval_metric="ndcg",
        tree_method="hist",
        random_state=seed,
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
    )
    model.fit(feature_rows, labels, qid=[group for group, size in enumerate(groups) for _ in range(size)])
    return model


def save_v4_ranker(model: Any, model_path: str | Path) -> Path:
    """Save a trained XGBRanker in XGBoost's portable JSON format."""
    if not hasattr(model, "save_model"):
        raise TypeError("model must provide XGBoost save_model()")
    path = Path(model_path).expanduser().resolve()
    if path.suffix.lower() not in {".json", ".ubj"}:
        raise ValueError("V4 models must be saved as .json or .ubj")
    path.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(path))
    return path
