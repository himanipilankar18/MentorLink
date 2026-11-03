"""Extended evidence-gating study for the MentorConnect paper.

Adds to run_experiment.py:
  - 20 seeds for the main condition, with paired tests (t-test and Wilcoxon, Holm-corrected)
  - an ablation: the gate without Bayesian shrinkage (raw averages of confirmed feedback)
  - sensitivity sweeps: mentee confirmation rate, collusion strength, history depth

The production engine is not modified. The no-shrinkage ablation loads a patched copy in memory.

Usage (repo root):
  .venv/bin/python -m research.evidence_gating.run_extended --out research/evidence_gating/results
"""

from __future__ import annotations

import argparse
import json
import os
import random
import statistics
import sys
import types
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from scipy import stats

import recommender_python.engine as engine_mod
from research.evidence_gating.run_experiment import NOW, gini, make_population, ndcg_at, relevant, strip

MAIN_SEEDS = [11, 23, 37, 41, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131]
SWEEP_SEEDS = MAIN_SEEDS[:5]
ALL_RANKERS = ["Random", "Popularity", "Content-only", "V1 (all logs)", "V3 ungated", "V3 gated, no shrinkage", "V3 evidence-gated"]
_NOSHRINK = None


def noshrink_recommend():
    """V3 with the gate kept but shrinkage removed: raw mean rating, full confidence, raw recommend rate."""
    global _NOSHRINK
    if _NOSHRINK is None:
        src = Path(engine_mod.__file__).read_text()
        patches = [
            ("rating_confidence = rating_count / (rating_count + 5)", "rating_confidence = 1.0"),
            ('smoothed_rating = ((3.5 * 5) + (_number(stats.get("avgSatisfaction")) * rating_count)) / (5 + rating_count)',
             'smoothed_rating = _number(stats.get("avgSatisfaction"))'),
            ('would_recommend = (_number(stats.get("recommendYes")) + 1.4) / (recommend_answers + 2) if recommend_answers > 0 else None',
             'would_recommend = _number(stats.get("recommendYes")) / recommend_answers if recommend_answers > 0 else None'),
        ]
        for old, new in patches:
            assert src.count(old) == 1, f"engine changed, patch no longer applies: {old}"
            src = src.replace(old, new)
        module = types.ModuleType("recommender_python.engine_noshrink")
        module.__package__ = "recommender_python"
        module.__file__ = engine_mod.__file__
        sys.modules[module.__name__] = module
        exec(compile(src, module.__file__, "exec"), module.__dict__)
        _NOSHRINK = module.recommend
    return _NOSHRINK


def per_mentee_cap(logs):
    latest = {}
    for row in logs:
        if row["confirmationStatus"] != "confirmed":
            continue
        key = (row["mentorId"], row["menteeId"])
        if key not in latest or row["timestamp"] > latest[key]["timestamp"]:
            latest[key] = row
    return list(latest.values())


def evaluate(job):
    """Run one population (one seed, one setting) through the requested rankers; return per-ranker means."""
    seed, pop_kwargs, names = job["seed"], job["pop"], job["rankers"]
    pop = make_population(seed, 150, 100, **pop_kwargs)
    mentors, seekers, logs = pop["mentors"], pop["seekers"], pop["interactions"]
    by_id = {m["_id"]: m for m in mentors}
    candidates = [strip(m) for m in mentors]
    ungated = [dict(row, confirmationStatus="confirmed") for row in logs]
    logged = {}
    for row in logs:
        logged[row["mentorId"]] = logged.get(row["mentorId"], 0) + 1
    rnd = random.Random(seed * 7 + 1)

    def engine(version, rows, fn=None):
        fn = fn or engine_mod.recommend

        def rank(seeker):
            out = fn(seeker=strip(seeker), candidates=candidates, interactions=rows, version=version,
                     options={"limit": 50, "seed": seed, "now": NOW.isoformat()})
            return [r["id"] for r in out["recommendations"]]
        return rank

    factories = {
        "Random": lambda: (lambda s: rnd.sample([m["_id"] for m in mentors], 50)),
        "Popularity": lambda: (lambda s: sorted(by_id, key=lambda m: (-logged.get(m, 0), m))[:50]),
        "Content-only": lambda: engine("v3", []),
        "V1 (all logs)": lambda: engine("v1", logs),
        "V3 ungated": lambda: engine("v3", ungated),
        "V3 gated, no shrinkage": lambda: engine("v3", logs, noshrink_recommend()),
        "V3 evidence-gated": lambda: engine("v3", logs),
        # Fair ungated variant: unconfirmed honest sessions carry the mentor's truthful report.
        "V3 ungated, truthful reports": lambda: engine("v3", [dict(row, confirmationStatus="confirmed", **row.get("_report", {})) for row in logs]),
        # Collusion remedy: at most one confirmed record (the latest) per mentor-mentee pair.
        "V3 + one record per mentee": lambda: engine("v3", per_mentee_cap(logs)),
    }
    attackers = {m["_id"] for m in mentors if m["_truth"]["attack"]}
    by_kind = {k: {m["_id"] for m in mentors if m["_truth"]["attack"] == k} for k in ("stuffer", "inflator", "colluder")}
    newcomers = {m["_id"] for m in mentors if not m["_truth"]["attack"] and logged.get(m["_id"], 0) == 0}

    out = {}
    for name in names:
        rank = factories[name]()
        rows = {k: [] for k in ("ndcg10", "p5", "mrr", "manip10", "stuffer10", "inflator10", "colluder10", "new10")}
        exposure = {m["_id"]: 0 for m in mentors}
        for seeker in seekers:
            ranked = rank(seeker)
            top = ranked[:10]
            rows["ndcg10"].append(ndcg_at(ranked, seeker, by_id, 10))
            rows["p5"].append(sum(relevant(seeker, by_id[m]) for m in ranked[:5]) / 5)
            first = next((i for i, m in enumerate(ranked) if relevant(seeker, by_id[m])), None)
            rows["mrr"].append(0 if first is None else 1 / (first + 1))
            rows["manip10"].append(sum(m in attackers for m in top) / 10)
            for kind, ids in by_kind.items():
                rows[f"{kind}10"].append(sum(m in ids for m in top) / 10)
            rows["new10"].append(sum(m in newcomers for m in top) / 10)
            for m in top:
                exposure[m] += 1
        out[name] = {k: statistics.mean(v) for k, v in rows.items()}
        out[name]["gini"] = gini(list(exposure.values()))
    meta = {"manip_pool": len(attackers) / len(mentors), "new_pool": len(newcomers) / len(mentors),
            "confirmed_share": sum(r["confirmationStatus"] == "confirmed" for r in logs) / len(logs), "sessions": len(logs)}
    return {"exp": job["exp"], "setting": job["setting"], "seed": seed, "metrics": out, "meta": meta}


def holm(pvalues):
    order = sorted(range(len(pvalues)), key=lambda i: pvalues[i])
    adjusted, running = [0.0] * len(pvalues), 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(pvalues) - rank) * pvalues[i]))
        adjusted[i] = running
    return adjusted


def paired_tests(runs, target, others, metrics):
    rows = []
    for other in others:
        for metric in metrics:
            a = np.array([r["metrics"][target][metric] for r in runs])
            b = np.array([r["metrics"][other][metric] for r in runs])
            d = a - b
            n = len(d)
            se = d.std(ddof=1) / np.sqrt(n) if n > 1 else 0.0
            half = stats.t.ppf(0.975, n - 1) * se if se else 0.0
            t_p = float(stats.ttest_rel(a, b).pvalue) if se else 1.0
            w_p = float(stats.wilcoxon(a, b).pvalue) if np.any(d != 0) else 1.0
            rows.append({"vs": other, "metric": metric, "diff": float(d.mean()), "ci95": [float(d.mean() - half), float(d.mean() + half)],
                         "t_p": t_p, "wilcoxon_p": w_p, "wins": int((d > 0).sum()), "losses": int((d < 0).sum()), "n": n})
    for key in ("t_p", "wilcoxon_p"):
        for row, adj in zip(rows, holm([r[key] for r in rows])):
            row[key + "_holm"] = adj
    return rows


def summarise(runs):
    names = runs[0]["metrics"].keys()
    keys = runs[0]["metrics"][next(iter(names))].keys()
    return {n: {k: {"mean": statistics.mean(r["metrics"][n][k] for r in runs), "sd": statistics.stdev(r["metrics"][n][k] for r in runs) if len(runs) > 1 else 0.0}
                for k in keys} for n in names}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="research/evidence_gating/results")
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    parser.add_argument("--suite", choices=["full", "revision"], default="full")
    args = parser.parse_args()

    if args.suite == "revision":
        return run_revision(args)

    jobs = [{"exp": "main", "setting": "rate=0.15", "seed": s, "pop": {"attacker_rate": 0.15}, "rankers": ALL_RANKERS} for s in MAIN_SEEDS]
    jobs += [{"exp": "mature", "setting": "history=4", "seed": s, "pop": {"attacker_rate": 0.15, "history_scale": 4.0}, "rankers": ALL_RANKERS}
             for s in MAIN_SEEDS[:10]]
    core = ["Content-only", "V1 (all logs)", "V3 ungated", "V3 evidence-gated"]
    for p in (0.35, 0.5, 0.8):
        jobs += [{"exp": "confirm", "setting": f"confirm={p}", "seed": s, "pop": {"attacker_rate": 0.15, "confirm_prob": p}, "rankers": core} for s in SWEEP_SEEDS]
    for friends, sess in ((2, (4, 8)), (5, (10, 20)), (10, (20, 40))):
        jobs += [{"exp": "collusion", "setting": f"friends={friends},sessions={sess[0]}-{sess[1]}", "seed": s,
                  "pop": {"attacker_rate": 0.15, "colluder_friends": friends, "colluder_sessions": sess},
                  "rankers": ["Content-only", "V1 (all logs)", "V3 gated, no shrinkage", "V3 evidence-gated"]} for s in SWEEP_SEEDS]
    for scale in (0.5, 2.0):
        jobs += [{"exp": "history", "setting": f"history={scale}", "seed": s, "pop": {"attacker_rate": 0.15, "history_scale": scale}, "rankers": core}
                 for s in SWEEP_SEEDS]

    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        results = []
        for r in pool.map(evaluate, jobs):
            results.append(r)
            print(f"done {r['exp']:9} {r['setting']:28} seed {r['seed']}", flush=True)

    report = {"seeds_main": MAIN_SEEDS, "seeds_sweep": SWEEP_SEEDS, "experiments": {}}
    groups = {}
    for r in results:
        groups.setdefault((r["exp"], r["setting"]), []).append(r)
    for (exp, setting), runs in groups.items():
        entry = {"n_seeds": len(runs), "summary": summarise(runs),
                 "meta": {k: statistics.mean(r["meta"][k] for r in runs) for k in runs[0]["meta"]},
                 "per_seed": [{"seed": r["seed"], "metrics": r["metrics"]} for r in runs]}
        if exp in ("main", "mature"):
            entry["tests"] = paired_tests(runs, "V3 evidence-gated", ["V1 (all logs)", "V3 ungated", "V3 gated, no shrinkage", "Content-only"],
                                          ["ndcg10", "p5", "mrr", "manip10", "new10"])
        report["experiments"].setdefault(exp, {})[setting] = entry
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "extended.json").write_text(json.dumps(report, indent=2))
    print("wrote", out / "extended.json")


def run_revision(args):
    """Reviewer-requested conditions: a fair ungated baseline and a collusion remedy."""
    rankers = ["Content-only", "V3 ungated, truthful reports", "V3 + one record per mentee", "V3 evidence-gated"]
    jobs = [{"exp": "main", "setting": "rate=0.15", "seed": s, "pop": {"attacker_rate": 0.15}, "rankers": rankers} for s in MAIN_SEEDS]
    jobs += [{"exp": "mature", "setting": "history=4", "seed": s, "pop": {"attacker_rate": 0.15, "history_scale": 4.0}, "rankers": rankers}
             for s in MAIN_SEEDS[:10]]
    for friends, sess in ((2, (4, 8)), (5, (10, 20)), (10, (20, 40))):
        jobs += [{"exp": "collusion", "setting": f"friends={friends},sessions={sess[0]}-{sess[1]}", "seed": s,
                  "pop": {"attacker_rate": 0.15, "colluder_friends": friends, "colluder_sessions": sess},
                  "rankers": ["Content-only", "V3 + one record per mentee", "V3 evidence-gated"]} for s in SWEEP_SEEDS]
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(evaluate, jobs))
    report = {"experiments": {}}
    groups = {}
    for r in results:
        groups.setdefault((r["exp"], r["setting"]), []).append(r)
    for (exp, setting), runs in groups.items():
        entry = {"n_seeds": len(runs), "summary": summarise(runs), "per_seed": [{"seed": r["seed"], "metrics": r["metrics"]} for r in runs]}
        if exp in ("main", "mature"):
            entry["tests"] = paired_tests(runs, "V3 evidence-gated", ["V3 ungated, truthful reports", "V3 + one record per mentee", "Content-only"],
                                          ["ndcg10", "p5", "mrr", "manip10", "colluder10", "new10"])
        report["experiments"].setdefault(exp, {})[setting] = entry
    out = Path(args.out)
    (out / "revision.json").write_text(json.dumps(report, indent=2))
    print("wrote", out / "revision.json")


if __name__ == "__main__":
    main()
