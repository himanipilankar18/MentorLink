"""Evidence-gating experiment for the MentorConnect research paper.

Question: does counting only mentee-verified sessions (V3) make mentor ranking robust to
reputation manipulation, compared with ranking on all logged activity (V1, legacy)?

A synthetic campus is generated with HIDDEN ground truth (each mentor's real expertise and
mentoring quality). Rankers only see what the platform would see: profiles and session logs.
Some mentors are manipulators:
  - stuffer:   adds many popular skills/interests to their profile
  - inflator:  self-logs many unverified "5-star, resolved" sessions (legacy mentors could set ratings)
  - colluder:  has two friends confirm a handful of fake 5-star sessions (passes the gate)

Rankers (the real MentorConnect engine is used for V1/V3):
  random, popularity (most logged sessions), content-only (V3 with no history),
  V1 (legacy: all logs count), V3-ungated (V3 fed every log as if confirmed), V3 (evidence-gated).

Usage (repo root, venv active):
  python -m research.evidence_gating.run_experiment --seeds 11,23,37,41,59 --out research/evidence_gating/results
"""

from __future__ import annotations

import argparse
import json
import math
import random
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path

from recommender_python.engine import recommend

NOW = datetime(2026, 11, 1, tzinfo=timezone.utc)
TOPICS = {
    "Web Development": ["javascript", "react", "node.js", "html", "css"],
    "Machine Learning": ["python", "machine learning", "tensorflow", "pandas"],
    "Data Structures": ["c++", "algorithms", "data structures", "java"],
    "Mobile Development": ["kotlin", "android", "flutter", "dart"],
    "Cloud Computing": ["aws", "docker", "kubernetes", "linux"],
    "Cybersecurity": ["cybersecurity", "networking", "cryptography"],
    "Data Analytics": ["sql", "statistics", "power bi", "excel"],
    "UI/UX Design": ["figma", "ui/ux", "prototyping"],
    "DevOps": ["git", "ci/cd", "jenkins", "terraform"],
    "Embedded Systems": ["arduino", "embedded c", "iot"],
}
POPULAR_SKILLS = ["python", "javascript", "react", "machine learning", "java", "c++", "sql", "aws", "docker", "android"]
DEPARTMENTS = ["COMPS", "COMPS", "IT", "CSE"]
AVAILABILITY = ["weekdays", "weekends", "flexible"]
RELEVANT_QUALITY = 0.65  # a mentor is "relevant" if they cover the need AND their hidden quality is at least this


def make_population(seed: int, n_mentors: int, n_seekers: int, attacker_rate: float, history_scale: float = 1.0,
                    confirm_prob: float = 0.65, colluder_friends: int = 2, colluder_sessions: tuple = (4, 8)) -> dict:
    rnd = random.Random(seed)
    topic_names = list(TOPICS)
    mentors, interactions = [], []

    def session(mentor_id, mentee, days_ago, status, rating=None, resolved=False, follow=False, recommend_flag=None):
        return {
            "mentorId": mentor_id, "menteeId": mentee, "interactionType": rnd.choice(["Chat", "Video Call", "Code Review", "Project Guidance"]),
            "confirmationStatus": status, "satisfactionRating": rating,
            "outcomeStatus": "resolved" if resolved else "unresolved", "followUpCompleted": follow,
            "menteeWouldRecommend": recommend_flag, "timestamp": (NOW - timedelta(days=days_ago)).isoformat(),
        }

    def j_rating(q):  # J-shaped: extremes over-represented
        w = [0.03 + 0.12 * (1 - q), 0.02 + 0.06 * (1 - q), 0.04 + 0.12 * (1 - q), 0.15 + 0.25 * (1 - abs(q - 0.6)), 0.10 + 0.9 * q ** 2]
        return 1 + rnd.choices(range(5), weights=w)[0]

    # What an honest mentor would have reported for a session the mentee never confirmed. Drawn from a
    # separate random stream so the population itself is identical to earlier runs.
    rep = random.Random(seed * 1_000_003 + 7)

    def truthful_report(q):
        w = [0.03 + 0.12 * (1 - q), 0.02 + 0.06 * (1 - q), 0.04 + 0.12 * (1 - q), 0.15 + 0.25 * (1 - abs(q - 0.6)), 0.10 + 0.9 * q ** 2]
        return {"satisfactionRating": 1 + rep.choices(range(5), weights=w)[0],
                "outcomeStatus": "resolved" if rep.random() < 0.25 + 0.6 * q else "unresolved",
                "followUpCompleted": rep.random() < 0.2 + 0.4 * q, "menteeWouldRecommend": rep.random() < q}

    n_attackers = round(n_mentors * attacker_rate)
    kinds = ["stuffer", "inflator", "colluder"]
    for i in range(n_mentors):
        mid = f"m{i:04d}"
        attack = kinds[i % 3] if i < n_attackers else None
        expertise = rnd.sample(topic_names, rnd.choice([1, 2, 2, 3]))
        quality = rnd.betavariate(2, 4) if attack else rnd.betavariate(5, 2)
        skills = [s for t in expertise for s in rnd.sample(TOPICS[t], min(len(TOPICS[t]), rnd.choice([2, 3])))]
        if rnd.random() < 0.2:  # honest noise: an unrelated skill
            skills.append(rnd.choice(POPULAR_SKILLS))
        interests = list(expertise)
        if attack == "stuffer":
            skills = list(dict.fromkeys(skills + POPULAR_SKILLS))
            interests = list(dict.fromkeys(interests + rnd.sample(topic_names, 5)))
        mentors.append({
            "_id": mid, "name": f"Mentor {i}", "role": rnd.choice(["senior", "senior", "junior"]), "year": rnd.choice([2, 3, 4]),
            "department": rnd.choice(DEPARTMENTS), "availability": rnd.choice(AVAILABILITY), "mentorshipIntent": rnd.choice(["offering", "both"]),
            "isActive": True, "skills": list(dict.fromkeys(skills)), "interests": interests,
            "bio": "Happy to help with " + ", ".join(expertise), "projects": [{"title": f"{expertise[0]} project", "technologies": skills[:3]}],
            "hasProfilePicture": rnd.random() < 0.9,
            "_truth": {"expertise": expertise, "quality": quality, "attack": attack},
        })

        # Honest history: how busy a mentor is is only weakly related to how good they are.
        busy = math.exp(rnd.gauss(1.3, 0.9)) * (0.7 + 0.6 * quality)
        if rnd.random() < 0.2:
            busy = 0  # new mentors with no history yet
        for _ in range(min(int(40 * history_scale), int(busy * history_scale))):
            mentee = f"x{rnd.randrange(400)}"
            days = rnd.uniform(1, 180)
            if rnd.random() < confirm_prob:  # the mentee confirmed and gave feedback
                interactions.append(session(mid, mentee, days, "confirmed", j_rating(quality), rnd.random() < 0.25 + 0.6 * quality,
                                            rnd.random() < 0.2 + 0.4 * quality, rnd.random() < quality))
            else:  # logged but never confirmed
                row = session(mid, mentee, days, "pending")
                row["_report"] = truthful_report(quality)
                interactions.append(row)

        if attack == "inflator":  # self-reported, never verified
            for _ in range(rnd.randint(20, 40)):
                interactions.append(session(mid, f"x{rnd.randrange(400)}", rnd.uniform(1, 60), "pending", 5, True, True, True))
        if attack == "colluder":  # two friends confirm fake glowing sessions
            for k in range(rnd.randint(*colluder_sessions)):
                interactions.append(session(mid, f"friend-{mid}-{k % colluder_friends}", rnd.uniform(1, 60), "confirmed", 5, True, True, True))

    seekers = []
    for j in range(n_seekers):
        need = rnd.sample(topic_names, rnd.choice([1, 1, 2]))
        skills = [rnd.choice(TOPICS[t]) for t in need] + ([rnd.choice(POPULAR_SKILLS)] if rnd.random() < 0.4 else [])
        seekers.append({
            "_id": f"s{j:04d}", "role": "junior", "year": rnd.choice([1, 2, 3]), "department": rnd.choice(DEPARTMENTS),
            "availability": rnd.choice(AVAILABILITY), "mentorshipIntent": "seeking", "isActive": True,
            "skills": list(dict.fromkeys(skills)), "interests": need, "_truth": {"need": need},
        })
    return {"mentors": mentors, "seekers": seekers, "interactions": interactions}


def gain(seeker, mentor):
    need = set(seeker["_truth"]["need"])
    cover = len(need & set(mentor["_truth"]["expertise"])) / len(need)
    return cover * mentor["_truth"]["quality"]


def relevant(seeker, mentor):
    return gain(seeker, mentor) > 0 and mentor["_truth"]["quality"] >= RELEVANT_QUALITY and not mentor["_truth"]["attack"]


def ndcg_at(ranked, seeker, by_id, k=10):
    gains = [gain(seeker, by_id[m]) for m in ranked[:k]]
    dcg = sum(g / math.log2(i + 2) for i, g in enumerate(gains))
    ideal = sorted((gain(seeker, m) for m in by_id.values()), reverse=True)[:k]
    idcg = sum(g / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else 0.0


def gini(values):
    values = sorted(values)
    n, total = len(values), sum(values)
    if not n or not total:
        return 0.0
    return sum((2 * (i + 1) - n - 1) * v for i, v in enumerate(values)) / (n * total)


def strip(user):
    return {k: v for k, v in user.items() if k != "_truth"}


def run_rankers(pop, seed, k=10):
    mentors, seekers, logs = pop["mentors"], pop["seekers"], pop["interactions"]
    by_id = {m["_id"]: m for m in mentors}
    candidates = [strip(m) for m in mentors]
    ungated = [dict(row, confirmationStatus="confirmed") for row in logs]
    logged = {}
    for row in logs:
        logged[row["mentorId"]] = logged.get(row["mentorId"], 0) + 1
    rnd = random.Random(seed * 7 + 1)

    def engine(version, rows):
        def rank(seeker):
            out = recommend(seeker=strip(seeker), candidates=candidates, interactions=rows, version=version,
                            options={"limit": 50, "seed": seed, "now": NOW.isoformat()})
            return [r["id"] for r in out["recommendations"]]
        return rank

    rankers = {
        "Random": lambda s: rnd.sample([m["_id"] for m in mentors], 50),
        "Popularity": lambda s: sorted(by_id, key=lambda m: (-logged.get(m, 0), m))[:50],
        "Content-only": engine("v3", []),
        "V1 (all logs)": engine("v1", logs),
        "V3 ungated": engine("v3", ungated),
        "V3 evidence-gated": engine("v3", logs),
    }
    attackers = {m["_id"] for m in mentors if m["_truth"]["attack"]}
    by_kind = {kind: {m["_id"] for m in mentors if m["_truth"]["attack"] == kind} for kind in ("stuffer", "inflator", "colluder")}
    newcomers = {m["_id"] for m in mentors if not m["_truth"]["attack"] and logged.get(m["_id"], 0) == 0}

    results = {}
    for name, rank in rankers.items():
        ndcg, p5, rr, att, new_share = [], [], [], [], []
        kind_share = {kind: [] for kind in by_kind}
        exposure = {m["_id"]: 0 for m in mentors}
        for seeker in seekers:
            ranked = rank(seeker)
            top = ranked[:k]
            ndcg.append(ndcg_at(ranked, seeker, by_id, k))
            p5.append(sum(relevant(seeker, by_id[m]) for m in ranked[:5]) / 5)
            first = next((i for i, m in enumerate(ranked) if relevant(seeker, by_id[m])), None)
            rr.append(0 if first is None else 1 / (first + 1))
            att.append(sum(m in attackers for m in top) / k)
            for kind, ids in by_kind.items():
                kind_share[kind].append(sum(m in ids for m in top) / k)
            new_share.append(sum(m in newcomers for m in top) / k)
            for m in top:
                exposure[m] += 1
        results[name] = {
            "ndcg10": statistics.mean(ndcg), "p5": statistics.mean(p5), "mrr": statistics.mean(rr),
            "attacker_share10": statistics.mean(att),
            **{f"{kind}_share10": statistics.mean(v) for kind, v in kind_share.items()},
            "newcomer_share10": statistics.mean(new_share), "exposure_gini": gini(list(exposure.values())),
        }
    meta = {"mentors": len(mentors), "seekers": len(seekers), "sessions": len(logs),
            "attackers": len(attackers), "attacker_pool_share": len(attackers) / len(mentors),
            "newcomers": len(newcomers), "newcomer_pool_share": len(newcomers) / len(mentors),
            "confirmed_share": sum(r["confirmationStatus"] == "confirmed" for r in logs) / len(logs)}
    return results, meta


def summarise(runs):
    names = runs[0][0].keys()
    metrics = runs[0][0][next(iter(names))].keys()
    return {name: {m: {"mean": statistics.mean(r[0][name][m] for r in runs),
                       "sd": statistics.pstdev(r[0][name][m] for r in runs)} for m in metrics} for name in names}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", default="11,23,37,41,59")
    parser.add_argument("--mentors", type=int, default=150)
    parser.add_argument("--seekers", type=int, default=100)
    parser.add_argument("--attack-rates", default="0,0.1,0.2,0.3")
    parser.add_argument("--main-rate", type=float, default=0.15)
    parser.add_argument("--out", default="research/evidence_gating/results")
    args = parser.parse_args()
    seeds = [int(s) for s in args.seeds.split(",")]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    main_runs = [run_rankers(make_population(s, args.mentors, args.seekers, args.main_rate), s) for s in seeds]
    report = {"config": vars(args), "main": summarise(main_runs), "population": [m for _, m in main_runs], "sweep": {}}
    for rate in [float(r) for r in args.attack_rates.split(",")]:
        runs = [run_rankers(make_population(s, args.mentors, args.seekers, rate), s) for s in seeds]
        summary = summarise(runs)
        report["sweep"][str(rate)] = {name: {k: summary[name][k]["mean"] for k in ("ndcg10", "attacker_share10")}
                                      for name in ("V1 (all logs)", "V3 ungated", "V3 evidence-gated", "Content-only")}
    (out / "results.json").write_text(json.dumps(report, indent=2))

    print(f"Main condition: attacker rate {args.main_rate}, seeds {seeds}")
    print(f"{'Ranker':22} {'NDCG@10':>14} {'P@5':>14} {'MRR':>14} {'Attack@10':>14} {'Newcomer@10':>12} {'Gini':>6}")
    for name, m in report["main"].items():
        f = lambda key: f"{m[key]['mean']:.3f}±{m[key]['sd']:.3f}"
        print(f"{name:22} {f('ndcg10'):>14} {f('p5'):>14} {f('mrr'):>14} {f('attacker_share10'):>14} {m['newcomer_share10']['mean']:>12.3f} {m['exposure_gini']['mean']:>6.3f}")
    print("\nBy attack type (share of top-10):")
    for name, m in report["main"].items():
        print(f"{name:22} stuffer {m['stuffer_share10']['mean']:.3f}  inflator {m['inflator_share10']['mean']:.3f}  colluder {m['colluder_share10']['mean']:.3f}")
    print("\nSweep (NDCG@10 / attacker share@10):")
    for rate, rows in report["sweep"].items():
        print(rate, {n: (round(v["ndcg10"], 3), round(v["attacker_share10"], 3)) for n, v in rows.items()})
    print("\nPopulation:", report["population"][0])


if __name__ == "__main__":
    main()
