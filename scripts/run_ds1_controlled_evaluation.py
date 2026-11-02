"""Controlled evaluation using copied DS1 profiles and synthetic latent labels.

The database snapshot is observational input only. Synthetic labels are
generated in this isolated script from latent expertise, learning needs, and
career compatibility rules; they are never treated as real outcomes.
"""

from __future__ import annotations

import csv
import json
import math
import random
import statistics
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from recommender_python.engine import recommend

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "research" / "data" / "DS1-snapshot.json"
OUTPUT = ROOT / "research" / "out" / "DS1-controlled"
VERSIONS = ("v1", "v2.0", "v2.1", "v2.2", "v2.3", "v2.4", "v3", "v4")
SEEDS = [11, 23, 37, 41, 59]


def tokens(values: Any) -> set[str]:
    if not isinstance(values, list):
        return set()
    return {str(value).strip().lower() for value in values if str(value or "").strip()}


def latent_relevance(seeker: dict[str, Any], candidate: dict[str, Any]) -> float:
    needs = tokens(seeker.get("skills")) | tokens(seeker.get("interests"))
    expertise = tokens(candidate.get("skills")) | tokens(candidate.get("interests"))
    overlap = len(needs & expertise) / len(needs | expertise) if needs | expertise else 0
    same_department = str(seeker.get("department") or "").upper() == str(candidate.get("department") or "").upper()
    career = tokens(seeker.get("interests")) & tokens(candidate.get("interests"))
    career_score = len(career) / len(tokens(seeker.get("interests")) | tokens(candidate.get("interests"))) if career else 0
    progression = min(max((float(candidate.get("year") or 0) - float(seeker.get("year") or 0)) / 3, 0), 1)
    return overlap * 0.55 + career_score * 0.25 + float(same_department) * 0.10 + progression * 0.10


def eligible(seeker: dict[str, Any], candidate: dict[str, Any]) -> bool:
    if candidate.get("isActive") is False:
        return False
    if str(candidate.get("mentorshipIntent") or "").lower() not in {"offering", "both"}:
        return False
    role = str(candidate.get("role") or "").lower()
    return role in {"faculty", "admin"} or float(candidate.get("year") or -1) > float(seeker.get("year") or -1)


def bootstrap_ci(values: list[float], seed: int = 991) -> tuple[float, float]:
    if not values:
        return (None, None)
    rng = random.Random(seed)
    samples = [statistics.mean(rng.choices(values, k=len(values))) for _ in range(2000)]
    samples.sort()
    return (samples[50], samples[1949])


def mean_sd_ci(values: list[float]) -> dict[str, float | int | None]:
    if not values:
        return {"n": 0, "mean": None, "sd": None, "ci95Low": None, "ci95High": None}
    low, high = bootstrap_ci(values)
    return {
        "n": len(values),
        "mean": statistics.mean(values),
        "sd": statistics.stdev(values) if len(values) > 1 else 0.0,
        "ci95Low": low,
        "ci95High": high,
    }


def hit(ranking: list[str], relevant: set[str], k: int) -> float:
    return float(bool(set(ranking[:k]) & relevant))


def ndcg(ranking: list[str], relevant: set[str], k: int) -> float:
    actual = sum(float(item in relevant) / math.log2(index + 2) for index, item in enumerate(ranking[:k]))
    ideal = sum(1 / math.log2(index + 2) for index in range(min(k, len(relevant))))
    return actual / ideal if ideal else 0.0


def mrr(ranking: list[str], relevant: set[str]) -> float:
    for index, item in enumerate(ranking, 1):
        if item in relevant:
            return 1 / index
    return 0.0


def kendall(left: list[str], right: list[str]) -> float:
    positions = {item: index for index, item in enumerate(right)}
    common = [item for item in left if item in positions]
    pairs = [(a, b) for i, a in enumerate(common) for b in common[i + 1:]]
    if not pairs:
        return 1.0
    concordant = sum(positions[a] < positions[b] for a, b in pairs)
    return (2 * concordant - len(pairs)) / len(pairs)


def gini(rankings: list[list[str]]) -> float:
    exposure: dict[str, float] = {}
    for ranking in rankings:
        for index, item in enumerate(ranking, 1):
            exposure[item] = exposure.get(item, 0) + 1 / index
    values = sorted(exposure.values())
    if not values or sum(values) == 0:
        return 0.0
    weighted = sum((index + 1) * value for index, value in enumerate(values))
    return (2 * weighted) / (len(values) * sum(values)) - (len(values) + 1) / len(values)


def main() -> None:
    data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    users = [user for user in data["users"] if user.get("isActive") is not False]
    seekers = [user for user in users if 1 <= int(user.get("year") or 0) <= 3]
    candidates = [user for user in users if str(user.get("mentorshipIntent") or "").lower() in {"offering", "both"}]
    populations = []
    rng = random.Random(20261102)
    for index in range(30):
        seeker = seekers[index % len(seekers)]
        pool = [candidate for candidate in candidates if eligible(seeker, candidate) and str(candidate.get("_id")) != str(seeker.get("_id"))]
        pool = sorted(pool, key=lambda candidate: str(candidate.get("_id")))
        rng.shuffle(pool)
        pool = pool[:min(40, len(pool))]
        labels = sorted(pool, key=lambda candidate: (-latent_relevance(seeker, candidate), str(candidate.get("_id"))))[:3]
        populations.append({
            "id": f"DS1-controlled-{index + 1:02d}",
            "seeker": seeker,
            "candidates": pool,
            "relevant": {str(candidate.get("_id")) for candidate in labels},
        })

    all_results: dict[str, Any] = {"datasetId": "DS1", "experimentType": "controlled-synthetic", "populations": len(populations), "seeds": SEEDS, "versions": {}}
    rows = []
    for version in VERSIONS:
        if version == "v4":
            all_results["versions"][version] = {"status": "unavailable", "reason": "No trained V4 model configured."}
            continue
        per_population: dict[str, dict[str, list[float]]] = {}
        run_rankings = []
        for seed in SEEDS:
            seed_rankings = {}
            for population in populations:
                options = {"seed": seed, "limit": 10, "now": "2026-11-02T00:00:00+00:00"}
                result = recommend(seeker=population["seeker"], candidates=population["candidates"], version=version, options=options)
                ranking = [item["id"] for item in result["recommendations"]]
                seed_rankings[population["id"]] = ranking
                metrics = per_population.setdefault(population["id"], {"hit1": [], "hit5": [], "hit10": [], "ndcg5": [], "ndcg10": [], "mrr": []})
                metrics["hit1"].append(hit(ranking, population["relevant"], 1))
                metrics["hit5"].append(hit(ranking, population["relevant"], 5))
                metrics["hit10"].append(hit(ranking, population["relevant"], 10))
                metrics["ndcg5"].append(ndcg(ranking, population["relevant"], 5))
                metrics["ndcg10"].append(ndcg(ranking, population["relevant"], 10))
                metrics["mrr"].append(mrr(ranking, population["relevant"]))
            run_rankings.append(seed_rankings)
        aggregate = {}
        for metric in ("hit1", "hit5", "hit10", "ndcg5", "ndcg10", "mrr"):
            values = [statistics.mean(metrics[metric]) for metrics in per_population.values()]
            aggregate[metric] = mean_sd_ci(values)
        stability = []
        overlaps = []
        for left_index in range(len(run_rankings)):
            for right_index in range(left_index + 1, len(run_rankings)):
                for population in populations:
                    left = run_rankings[left_index][population["id"]]
                    right = run_rankings[right_index][population["id"]]
                    stability.append(kendall(left, right))
                    overlaps.append(len(set(left[:10]) & set(right[:10])) / len(set(left[:10]) | set(right[:10]) or {1}))
        all_top10 = [run_rankings[0][population["id"]][:10] for population in populations]
        candidate_coverage = len(set(item for ranking in all_top10 for item in ranking)) / len(set(str(candidate.get("_id")) for population in populations for candidate in population["candidates"]))
        aggregate.update({
            "kendallTauB": mean_sd_ci(stability),
            "top10Overlap": mean_sd_ci(overlaps),
            "rankingStability": mean_sd_ci(stability),
            "candidateCoverage": candidate_coverage,
            "exposureGini": gini(all_top10),
        })
        all_results["versions"][version] = {"status": "completed", "metrics": aggregate, "populationCount": len(populations)}
        for metric, stat in aggregate.items():
            if isinstance(stat, dict):
                rows.append({"version": version, "metric": metric, "mean": stat.get("mean"), "sd": stat.get("sd"), "ci95Low": stat.get("ci95Low"), "ci95High": stat.get("ci95High")})
            else:
                rows.append({"version": version, "metric": metric, "mean": stat, "sd": "", "ci95Low": "", "ci95High": ""})

    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "results.json").write_text(json.dumps(all_results, indent=2), encoding="utf-8")
    with (OUTPUT / "results.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["version", "metric", "mean", "sd", "ci95Low", "ci95High"])
        writer.writeheader()
        writer.writerows(rows)
    try:
        import matplotlib.pyplot as plt
        completed = [(version, all_results["versions"][version]["metrics"]["hit10"]["mean"]) for version in VERSIONS if all_results["versions"].get(version, {}).get("status") == "completed"]
        figure, axis = plt.subplots(figsize=(9, 4))
        axis.bar([item[0] for item in completed], [item[1] for item in completed])
        axis.set_ylabel("Mean Hit@10")
        axis.set_title("DS1 controlled synthetic benchmark (not production accuracy)")
        figure.tight_layout()
        figure.savefig(OUTPUT / "hit10.png", dpi=160)
        plt.close(figure)
    except ImportError:
        completed = [(version, all_results["versions"][version]["metrics"]["hit10"]["mean"]) for version in VERSIONS if all_results["versions"].get(version, {}).get("status") == "completed"]
        width, height, margin = 900, 420, 60
        bar_width = (width - 2 * margin) / max(len(completed), 1)
        bars = []
        for index, (version, value) in enumerate(completed):
            x = margin + index * bar_width + bar_width * 0.1
            bar_height = value * (height - 2 * margin)
            y = height - margin - bar_height
            bars.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_width * 0.8:.1f}" height="{bar_height:.1f}" fill="#6366f1"/>'
                        f'<text x="{x + bar_width * 0.4:.1f}" y="{height - margin + 22}" text-anchor="middle" font-size="13">{version}</text>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}"><text x="{width / 2}" y="24" text-anchor="middle" font-size="16">DS1 controlled benchmark — mean Hit@10</text>{"".join(bars)}</svg>'
        (OUTPUT / "hit10.svg").write_text(svg, encoding="utf-8")
    report = ["# DS1 Recommendation Evaluation", "", "This report uses a read-only production snapshot. Observed outcomes and controlled synthetic labels are separated.", "", f"- Controlled populations: {len(populations)}", f"- Seeds: {SEEDS}", "- V4: unavailable because no trained model is configured.", "", "## Results", ""]
    for version in VERSIONS:
        entry = all_results["versions"][version]
        if entry["status"] != "completed":
            report.append(f"- **{version}**: unavailable — {entry['reason']}")
            continue
        metric = entry["metrics"]
        report.append(f"- **{version}** Hit@10 mean={metric['hit10']['mean']:.4f}, SD={metric['hit10']['sd']:.4f}, 95% CI=[{metric['hit10']['ci95Low']:.4f}, {metric['hit10']['ci95High']:.4f}]; candidate coverage={metric['candidateCoverage']:.4f}.")
    (OUTPUT / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
