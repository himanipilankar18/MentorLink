"""Normalization and audit helpers for structured technical skills."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any

SKILL_ALIASES = {
    "js": "javascript",
    "javascript.js": "javascript",
    "node": "node.js",
    "nodejs": "node.js",
    "node js": "node.js",
    "reactjs": "react",
    "react.js": "react",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "tf": "tensorflow",
    "sklearn": "scikit-learn",
    "scikit learn": "scikit-learn",
    "c plus plus": "c++",
    "cpp": "c++",
    "c sharp": "c#",
}

INVALID_SKILL_TERMS = {
    "project", "projects", "profile", "mentorlink", "fictional", "demo",
    "git", "github", "exploring", "explore", "peer", "peers", "student",
    "students", "user", "users", "account", "mentor", "mentee", "technical",
    "technology", "technologies", "interest", "interests", "experience",
    "work", "working", "using", "use", "built", "build", "developing",
    "development", "based", "help", "learning", "learn", "and", "the",
    "with", "for", "from", "this", "that", "into", "about", "years",
}


def _raw_values(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        values = []
        for item in value:
            if isinstance(item, dict):
                values.extend(
                    str(item.get(key, ""))
                    for key in ("name", "skill", "value", "title")
                    if item.get(key)
                )
            elif item is not None:
                values.append(str(item))
        return values
    if isinstance(value, dict):
        return [
            str(value.get(key, ""))
            for key in ("name", "skill", "value", "title")
            if value.get(key)
        ]
    return []


def normalize_skill_values(value: Any) -> list[str]:
    normalized = []
    for raw in _raw_values(value):
        term = re.sub(r"\s+", " ", raw.strip().lower())
        term = SKILL_ALIASES.get(term, term)
        if term in INVALID_SKILL_TERMS or not term:
            continue
        if len(term) == 1 and term not in {"c", "r"}:
            continue
        normalized.append(term)
    return list(dict.fromkeys(normalized))


def normalize_text_terms(value: Any) -> list[str]:
    terms = []
    for raw in _raw_values(value):
        for term in re.findall(
            r"(?:\.[a-z][a-z0-9-]*|[a-z][a-z0-9+#./-]{1,})",
            raw.lower(),
        ):
            term = SKILL_ALIASES.get(term.strip(",-/"), term.strip(",-/"))
            if term and term not in INVALID_SKILL_TERMS:
                terms.append(term)
    return list(dict.fromkeys(terms))


def audit_skills(profiles: list[dict[str, Any]]) -> dict[str, Any]:
    normalized = [normalize_skill_values(profile.get("skills")) for profile in profiles]
    counts = Counter(term for skills in normalized for term in skills)
    return {
        "totalUsers": len(profiles),
        "usersWithUsableSkills": sum(bool(skills) for skills in normalized),
        "usersMissingSkills": sum(not skills for skills in normalized),
        "uniqueNormalizedSkills": len(counts),
        "mostFrequentSkills": [
            {"skill": skill, "count": count}
            for skill, count in counts.most_common(10)
        ],
        "rareSkills": [
            {"skill": skill, "count": count}
            for skill, count in sorted(counts.items())
            if count == 1
        ][:20],
        "finalFeatureDimensions": [len(counts), len(profiles)],
    }
