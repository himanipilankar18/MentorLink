"""Research-only evaluation utilities.

This module consumes supplied datasets and writes measured artifacts. It never
creates labels or results when the requested dataset is absent.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from typing import Any


def hit_at_k(ranking: list[str], relevant: set[str], k: int) -> float:
    return float(bool(set(ranking[:k]) & relevant))


def ndcg_at_k(ranking: list[str], relevant: set[str], k: int) -> float:
    gains = [1.0 if item in relevant else 0.0 for item in ranking[:k]]
    actual = sum(gain / math.log2(index + 2) for index, gain in enumerate(gains))
    ideal = sum(1 / math.log2(index + 2) for index in range(min(k, len(relevant))))
    return actual / ideal if ideal else 0.0


def reciprocal_rank(ranking: list[str], relevant: set[str]) -> float:
    for index, item in enumerate(ranking, 1):
        if item in relevant:
            return 1 / index
    return 0.0


def kendall_tau(left: list[str], right: list[str]) -> float:
    positions = {item: index for index, item in enumerate(right)}
    common = [item for item in left if item in positions]
    if len(common) < 2:
        return 1.0
    concordant = discordant = 0
    for index, item in enumerate(common):
        for later in common[index + 1:]:
            if positions[item] < positions[later]:
                concordant += 1
            else:
                discordant += 1
    return (concordant - discordant) / (concordant + discordant or 1)


def top_k_overlap(left: list[str], right: list[str], k: int) -> float:
    first, second = set(left[:k]), set(right[:k])
    return len(first & second) / len(first | second) if first | second else 1.0


def exposure_gini(rankings: list[list[str]], decay: float = 1.0) -> float:
    exposure: dict[str, float] = {}
    for ranking in rankings:
        for index, item in enumerate(ranking):
            exposure[item] = exposure.get(item, 0) + 1 / ((index + 1) ** decay)
    values = sorted(exposure.values())
    if not values or sum(values) == 0:
        return 0.0
    weighted = sum((index + 1) * value for index, value in enumerate(values))
    return (2 * weighted) / (len(values) * sum(values)) - (len(values) + 1) / len(values)


def ari_nmi(labels_left: list[Any], labels_right: list[Any]) -> dict[str, float | None]:
    try:
        from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
    except ImportError:
        return {"ari": None, "nmi": None}
    return {
        "ari": float(adjusted_rand_score(labels_left, labels_right)),
        "nmi": float(normalized_mutual_info_score(labels_left, labels_right)),
    }


def explanation_faithfulness(before: list[float], after: list[float], removed: list[float]) -> float:
    if not before or len(before) != len(after) or len(before) != len(removed):
        return 0.0
    total_change = sum(abs(left - right) for left, right in zip(before, after))
    explained_change = sum(abs(value) for value in removed)
    return explained_change / total_change if total_change else 1.0


def evaluate_runs(runs: list[dict[str, Any]], relevant_by_seeker: dict[str, set[str]], k: int = 10) -> dict[str, Any]:
    rankings = {
        run["seed"]: {
            seeker: [entry["id"] for entry in entries]
            for seeker, entries in run["rankings"].items()
        }
        for run in runs
    }
    first = rankings[runs[0]["seed"]] if runs else {}
    all_pairs = [
        (seeker, ranking, relevant_by_seeker.get(seeker, set()))
        for seeker, ranking in first.items()
    ]
    metrics = {
        "Hit@K": sum(hit_at_k(ranking, relevant, k) for _, ranking, relevant in all_pairs) / len(all_pairs) if all_pairs else 0,
        "NDCG@K": sum(ndcg_at_k(ranking, relevant, k) for _, ranking, relevant in all_pairs) / len(all_pairs) if all_pairs else 0,
        "MRR": sum(reciprocal_rank(ranking, relevant) for _, ranking, relevant in all_pairs) / len(all_pairs) if all_pairs else 0,
        "top10Overlap": [],
        "kendallTauB": [],
        "rankingStability": 1.0,
        "exposureGini": exposure_gini([ranking[:k] for _, ranking, _ in all_pairs]),
    }
    for index, left in enumerate(runs):
        for right in runs[index + 1:]:
            left_rankings = rankings[left["seed"]]
            right_rankings = rankings[right["seed"]]
            for seeker in left_rankings.keys() & right_rankings.keys():
                metrics["top10Overlap"].append(top_k_overlap(left_rankings[seeker], right_rankings[seeker], 10))
                metrics["kendallTauB"].append(kendall_tau(left_rankings[seeker], right_rankings[seeker]))
    metrics["rankingStability"] = sum(metrics["kendallTauB"]) / len(metrics["kendallTauB"]) if metrics["kendallTauB"] else 1.0
    metrics["top10OverlapMean"] = sum(metrics["top10Overlap"]) / len(metrics["top10Overlap"]) if metrics["top10Overlap"] else 1.0
    return metrics


def write_artifacts(result: dict[str, Any], output_dir: str | Path, rows: list[dict[str, Any]] | None = None) -> None:
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "evaluation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    if rows is not None:
        with (directory / "evaluation.csv").open("w", newline="", encoding="utf-8") as handle:
            fields = sorted({key for row in rows for key in row})
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        return
    scalar_metrics = {key: value for key, value in result.items() if isinstance(value, (int, float))}
    if scalar_metrics:
        figure, axis = plt.subplots(figsize=(8, 4))
        axis.bar(list(scalar_metrics), list(scalar_metrics.values()))
        axis.tick_params(axis="x", rotation=45)
        figure.tight_layout()
        figure.savefig(directory / "evaluation.png", dpi=160)
        plt.close(figure)
