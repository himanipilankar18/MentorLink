#!/usr/bin/env python3
import json
import re
import sys
from difflib import SequenceMatcher


def tokenize(text):
    if text is None:
        return []
    return [
        token
        for token in re.split(r"[^a-z0-9]+", str(text).lower())
        if token
    ]


def normalize_text_list(values):
    if not isinstance(values, list):
        return []
    result = []
    for value in values:
        text = str(value or "").strip().lower()
        if text:
            result.append(text)
    return result


def project_tokens(projects):
    if not isinstance(projects, list):
        return []
    tokens = []
    for project in projects:
        if not isinstance(project, dict):
            continue
        fields = [
            project.get("title", ""),
            project.get("description", ""),
            " ".join(project.get("technologies", []) or []),
        ]
        for field in fields:
            tokens.extend(tokenize(field))
    return tokens


def fuzzy_similarity(text, query):
    left = str(text or "").strip().lower()
    right = str(query or "").strip().lower()
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def keyword_score(entry, keywords):
    skills = normalize_text_list(entry.get("skills", []))
    interests = normalize_text_list(entry.get("interests", []))
    projects = project_tokens(entry.get("projects", []))

    haystack = " ".join(skills + interests + projects)
    if not haystack:
        return 0

    score = 0
    for keyword in keywords:
        term = str(keyword or "").strip().lower()
        if not term:
            continue

        if any(term in skill for skill in skills):
            score += 8
        elif any(term in interest for interest in interests):
            score += 6
        elif any(term in token for token in projects):
            score += 5
        elif term in haystack:
            score += 3

        term_tokens = tokenize(term)
        if term_tokens:
            for token in term_tokens:
                score += 1 if token in haystack else 0

    return score


def run_cluster(payload):
    entries = payload.get("entries", [])
    cluster_config = payload.get("clusterConfig", {})
    keywords = cluster_config.get("keywords", [])
    limit = max(1, min(int(payload.get("limit", 15)), 40))

    ranked = []
    for raw in entries:
        if not isinstance(raw, dict):
            continue

        base_score = keyword_score(raw, keywords)
        text_blob = " ".join(
            normalize_text_list(raw.get("skills", []))
            + normalize_text_list(raw.get("interests", []))
            + project_tokens(raw.get("projects", []))
        )

        fuzzy_bonus = 0
        if text_blob:
            fuzzy_values = [fuzzy_similarity(text_blob, keyword) for keyword in keywords]
            best_fuzzy = max(fuzzy_values) if fuzzy_values else 0.0
            if best_fuzzy >= 0.85:
                fuzzy_bonus = 18
            elif best_fuzzy >= 0.75:
                fuzzy_bonus = 10
            elif best_fuzzy >= 0.65:
                fuzzy_bonus = 5

        score = base_score + fuzzy_bonus
        if score < 6:
            continue

        clone = dict(raw)
        clone["_score"] = score
        ranked.append(clone)

    ranked.sort(
        key=lambda item: (
            -int(item.get("_score", 0)),
            -(len(item.get("skills", []) or [])),
            str(item.get("name", "")),
        )
    )

    for item in ranked:
        item.pop("projects", None)

    return {
        "success": True,
        "ranked": ranked[:limit],
    }


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"success": False, "message": "Missing input payload"}))
        sys.exit(1)

    try:
        payload = json.loads(raw)
        result = run_cluster(payload)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"success": False, "message": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
