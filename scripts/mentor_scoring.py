#!/usr/bin/env python3
"""Score mentors based on acceptance behavior and interaction quality."""

import json
import math
import sys
from typing import Any, Dict, List


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        if math.isnan(parsed) or math.isinf(parsed):
            return default
        return parsed
    except (TypeError, ValueError):
        return default


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def round2(value: float) -> float:
    return round(value + 1e-9, 2)


def score_one(stats: Dict[str, Any]) -> Dict[str, float]:
    accepted = as_float(stats.get("acceptedCount"), 0.0)
    rejected = as_float(stats.get("rejectedCount"), 0.0)
    pending = as_float(stats.get("pendingCount"), 0.0)
    total = max(as_float(stats.get("totalRequests"), 0.0), accepted + rejected + pending)
    responded = accepted + rejected

    acceptance_rate = (accepted / responded) if responded > 0 else 0.0
    response_coverage = (responded / total) if total > 0 else 0.0
    volume_norm = clamp(responded / 12.0, 0.0, 1.0)

    avg_satisfaction = clamp(as_float(stats.get("avgSatisfaction"), 0.0), 0.0, 5.0)
    satisfaction_norm = avg_satisfaction / 5.0

    interactions = as_float(stats.get("interactionsCount"), 0.0)
    engagement_norm = clamp(interactions / 20.0, 0.0, 1.0)

    avg_response_hours = max(as_float(stats.get("avgResponseHours"), 0.0), 0.0)
    if avg_response_hours > 0:
        response_speed_norm = clamp(1.0 - min(avg_response_hours / 72.0, 1.0), 0.0, 1.0)
    else:
        response_speed_norm = 0.5 if responded > 0 else 0.2

    acceptance_behavior = (
        (0.60 * acceptance_rate)
        + (0.25 * response_coverage)
        + (0.15 * volume_norm)
    ) * 100.0

    reaction_behavior = (
        (0.50 * satisfaction_norm)
        + (0.30 * engagement_norm)
        + (0.20 * response_speed_norm)
    ) * 100.0

    mentor_score = (0.60 * acceptance_behavior) + (0.40 * reaction_behavior)

    confidence = min(
        1.0,
        (min(1.0, responded / 8.0) * 0.60) + (min(1.0, interactions / 15.0) * 0.40),
    )

    return {
        "mentorScore": round2(mentor_score),
        "acceptanceBehaviorScore": round2(acceptance_behavior),
        "reactionBehaviorScore": round2(reaction_behavior),
        "confidence": round(confidence + 1e-9, 3),
        "breakdown": {
            "acceptanceRate": round(acceptance_rate + 1e-9, 4),
            "responseCoverage": round(response_coverage + 1e-9, 4),
            "avgResponseHours": round2(avg_response_hours),
            "avgSatisfaction": round2(avg_satisfaction),
            "interactionsCount": int(interactions),
        },
    }


def main() -> None:
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"success": False, "message": "Empty input payload"}))
        sys.exit(1)

    payload = json.loads(raw)
    mentors: List[Dict[str, Any]] = payload.get("mentors") or []

    ranked: List[Dict[str, Any]] = []
    for mentor in mentors:
        mentor_id = str(mentor.get("id") or "").strip()
        if not mentor_id:
            continue

        scored = score_one(mentor.get("stats") or {})
        ranked.append({
            "id": mentor_id,
            **scored,
        })

    ranked.sort(
        key=lambda row: (
            -as_float(row.get("mentorScore"), 0.0),
            -as_float(row.get("confidence"), 0.0),
            row.get("id", ""),
        )
    )

    print(json.dumps({"success": True, "ranked": ranked}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pylint: disable=broad-except
        print(json.dumps({"success": False, "message": str(exc)}))
        sys.exit(1)
