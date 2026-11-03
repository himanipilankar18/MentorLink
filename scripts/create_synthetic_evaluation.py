"""Create a deterministic, explicitly synthetic recommendation benchmark.

The relevance labels are generated from profile overlap rules and are not
ground-truth user outcomes. Metrics from this dataset must not be presented as
production accuracy.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "research" / "data" / "synthetic-mentorconnect-evaluation.json"

TRACKS = [
    ("python", "machine learning", "data science"),
    ("java", "data structures", "competitive programming"),
    ("javascript", "web development", "react"),
    ("sql", "database systems", "data analytics"),
    ("cybersecurity", "cloud computing", "devops"),
    ("embedded systems", "iot", "electronics"),
]


def profile(identifier: str, year: int, skills: list[str], interests: list[str], intent: str) -> dict:
    return {
        "_id": identifier,
        "department": "COMPS",
        "year": year,
        "role": "senior" if year >= 4 else "junior",
        "mentorshipIntent": intent,
        "availability": "flexible",
        "skills": skills,
        "interests": interests,
        "bio": f"Synthetic benchmark profile focused on {' and '.join(skills)}.",
        "projects": [{"title": f"{identifier} project", "description": "Synthetic evaluation project", "technologies": skills}],
        "cgpa": 8.5,
    }


def main() -> None:
    populations = []
    for index, track in enumerate(TRACKS):
        seeker_id = f"synthetic-seeker-{index + 1}"
        seeker = profile(seeker_id, 2, [track[0]], [track[1]], "seeking")
        candidates = []
        relevant = []
        for candidate_index in range(8):
            candidate_id = f"synthetic-{index + 1}-{candidate_index + 1}"
            if candidate_index < 3:
                skills = list(track)
                interests = list(track[1:])
                relevant.append(candidate_id)
            else:
                other = TRACKS[(index + candidate_index) % len(TRACKS)]
                skills = list(other)
                interests = list(other[1:])
            candidates.append(profile(candidate_id, 4, skills, interests, "offering"))
        populations.append({
            "seekers": [seeker],
            "candidates": candidates,
            "interactions": [],
            "mentorships": [],
            "weightProfile": "internal",
            "now": "2026-11-02T00:00:00+00:00",
            "relevantBySeeker": {seeker_id: relevant},
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "datasetType": "synthetic",
        "warning": "Labels are generated from deterministic profile-overlap rules; metrics are not production accuracy.",
        "populations": populations,
    }, indent=2), encoding="utf-8")
    print(f"Created {OUTPUT} with {len(populations)} populations.")


if __name__ == "__main__":
    main()
