"""Selectable MentorConnect recommendation versions.

V1 mirrors the frozen JavaScript baseline. Later versions are research-track
extensions and are intentionally selectable without changing the production
JavaScript response contract.
"""

from __future__ import annotations

import hashlib
import math
import random
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

INTERNAL_WEIGHTS = {"skills": 0.20, "interests": 0.12, "availability": 0.08, "goals": 0.18}
EXTERNAL_WEIGHTS = {"skills": 0.35, "interests": 0.25, "availability": 0.15, "goals": 0.25}
STOPWORDS = {
    "a", "an", "are", "as", "at", "be", "by", "from", "in", "is", "it",
    "of", "on", "or", "that", "the", "this", "to",
    "engineering", "programming", "software", "technology", "technologies",
}
MENTORING_INTERACTION_TYPES = {
    "chat", "video call", "in-person", "email", "forum discussion",
    "code review", "project guidance",
}


class RecommendationError(ValueError):
    """Raised for invalid recommendation input or unavailable model support."""


def _number(value: Any, fallback: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return fallback
    return result if math.isfinite(result) else fallback


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _array(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    aliases = {
        "js": "javascript",
        "javascript": "javascript",
        "nodejs": "node.js",
        "node js": "node.js",
        "reactjs": "react",
        "ml": "machine learning",
        "postgres": "postgresql",
        "c++": "c++",
        "c plus plus": "c++",
    }
    terms = []
    for item in value:
        term = str(item or "").strip().lower()
        if term:
            terms.append(aliases.get(term, term))
    return list(dict.fromkeys(terms))


def _profile_terms(user: dict[str, Any], keys: Iterable[str]) -> set[str]:
    terms: set[str] = set()
    for key in keys:
        value = user.get(key)
        if isinstance(value, list):
            terms.update(_array(value))
        elif value not in (None, ""):
            terms.update(_array([value]))
    return terms


def _learning_needs(user: dict[str, Any]) -> set[str]:
    return _profile_terms(user, (
        "helpWanted", "needs", "learningGoal", "learningGoals",
        "skillsToLearn", "topicsToLearn", "externalGoals",
    ))


def _mentor_expertise(user: dict[str, Any]) -> set[str]:
    expertise = _profile_terms(user, (
        "skills", "topicsCanHelp", "offers", "expertise", "interests",
        "careerTrack",
    ))
    for project in user.get("projects") or []:
        if isinstance(project, dict):
            expertise.update(_array(project.get("technologies")))
    return expertise


def tokenize_profile_text(value: Any, *, v2: bool = False) -> list[str]:
    if value is None:
        return []
    text = str(value).lower()
    text = __import__("re").sub(r"https?://\S+", " ", text)
    text = text.replace("_", " ")
    text = __import__("re").sub(r"[^a-z0-9\s+.#/\-]+", " ", text)
    tokens = [token.strip() for token in __import__("re").split(r"\s+", text.strip())]
    return [
        token for token in tokens
        if token and len(token) > 1 and not __import__("re").fullmatch(r"[-.#+/]+", token)
        and (not v2 or token not in STOPWORDS)
    ]


def _profile_text(user: dict[str, Any], *, v2: bool = False, include_projects: bool = True) -> str:
    values: list[str] = []

    def add(value: Any) -> None:
        if value is None:
            return
        if isinstance(value, list):
            for item in value:
                add(item)
            return
        if isinstance(value, dict):
            for item in value.values():
                add(item)
            return
        values.extend(tokenize_profile_text(value, v2=v2))

    add(user.get("skills"))
    add(user.get("interests"))
    add(user.get("bio"))
    if include_projects:
        for project in user.get("projects") or []:
            if isinstance(project, dict):
                add(project.get("title"))
                add(project.get("description"))
                add(project.get("technologies"))
    return " ".join(dict.fromkeys(values))


def _project_relevance(seeker: dict[str, Any], candidate: dict[str, Any]) -> float:
    """Measure directional overlap between seeker needs and mentor projects."""
    project_terms: set[str] = set()
    for project in candidate.get("projects") or []:
        if not isinstance(project, dict):
            continue
        project_terms.update(_array(project.get("technologies")))
        for key in ("title", "description", "technologies"):
            project_terms.update(tokenize_profile_text(project.get(key), v2=True))

    seeker_terms = _learning_needs(seeker)
    if not seeker_terms:
        seeker_terms = set(_array(seeker.get("skills"))) | set(_array(seeker.get("interests")))
    if not seeker_terms or not project_terms:
        return 0.0
    return len(seeker_terms & project_terms) / len(seeker_terms)


def _tfidf(documents: list[str]) -> tuple[list[str], list[list[float]]]:
    valid = [document.split() for document in documents]
    vocabulary = sorted({term for document in valid for term in document})
    frequencies = Counter(term for document in valid for term in set(document))
    count = len(valid) or 1
    vectors: list[list[float]] = []
    for document in valid:
        terms = Counter(document)
        length = len(document)
        vectors.append([
            (terms[term] / length) * (math.log((1 + count) / (1 + frequencies[term])) + 1)
            if length else 0.0
            for term in vocabulary
        ])
    return vocabulary, vectors


def _cosine(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    magnitude_left = math.sqrt(sum(value * value for value in left))
    magnitude_right = math.sqrt(sum(value * value for value in right))
    if not magnitude_left or not magnitude_right:
        return 0.0
    return _clamp(dot / (magnitude_left * magnitude_right), 0.0, 1.0)


def _strength(user: dict[str, Any]) -> float:
    score = 0
    if user.get("profilePicture") or user.get("hasProfilePicture"):
        score += 20
    if len(user.get("skills") or []) >= 3:
        score += 20
    if isinstance(user.get("bio"), str) and user["bio"].strip():
        score += 20
    if user.get("projects"):
        score += 20
    if user.get("cgpa") not in (None, ""):
        score += 20
    return score / 100


def _availability(value: Any) -> list[int]:
    normalized = str(value or "").lower()
    return [int(normalized == item) for item in ("weekdays", "weekends", "flexible")]


def _features(user: dict[str, Any], seeker: dict[str, Any], vocabulary: list[str], analytics: dict[str, Any]) -> list[float]:
    terms = set(_array(user.get("skills"))) | set(_array(user.get("interests")))
    department = str(seeker.get("department") or "").upper() == str(user.get("department") or "").upper()
    core = [
        *[float(term in terms) for term in vocabulary],
        _clamp(_number(user.get("year")) / 5, 0, 1),
        0 if user.get("cgpa") in (None, "") else _clamp(_number(user.get("cgpa")) / 10, 0, 1),
        _strength(user),
        *map(float, _availability(user.get("availability"))),
        float(department),
    ]
    return core + [
        _clamp(_number(analytics.get("totalInteractions")) / 100, 0, 1),
        _clamp(_number(analytics.get("avgSatisfaction")) / 5, 0, 1),
        _clamp(_number(analytics.get("acceptedMentorships")) / 40, 0, 1),
        _clamp(_number(analytics.get("completionRate")), 0, 1),
        _clamp(_number(analytics.get("subjectBreadth")) / 12, 0, 1),
        _clamp(_number(analytics.get("recencyScore")), 0, 1),
    ]


def _distance(left: list[float], right: list[float]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(left, right)))


def _mean(points: list[list[float]], dimensions: int) -> list[float]:
    if not points:
        return [0.0] * dimensions
    return [sum(point[index] for point in points) / len(points) for index in range(dimensions)]


def _mulberry32(seed: int):
    state = seed & 0xFFFFFFFF

    def random_value() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        value = ((state ^ (state >> 15)) * (1 | state)) & 0xFFFFFFFF
        value ^= (value + (((value ^ (value >> 7)) * (61 | value)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((value ^ (value >> 14)) & 0xFFFFFFFF) / 4294967296

    return random_value


def _kmeans(points: list[list[float]], desired_k: int, rng) -> dict[str, Any]:
    count = len(points)
    if not count:
        return {"assignments": [], "centroids": [], "k": 0, "iterations": 0, "inertia": 0.0}
    if count < 3:
        return {"assignments": [0] * count, "centroids": [_mean(points, len(points[0]))], "k": 1, "iterations": 1, "inertia": 0.0}
    k = int(_clamp(math.floor(desired_k), 2, count))
    centroids = [points[int(rng() * count)][:]]
    while len(centroids) < k:
        distances = [min(_distance(point, centroid) for centroid in centroids) ** 2 for point in points]
        total = sum(distances)
        if total <= 0:
            index = int(rng() * count)
        else:
            threshold = rng() * total
            index = count - 1
            for candidate, distance in enumerate(distances):
                threshold -= distance
                if threshold <= 0:
                    index = candidate
                    break
        centroids.append(points[index][:])

    assignments = [-1] * count
    changed = True
    iterations = 0
    while changed and iterations < 35:
        changed = False
        iterations += 1
        for index, point in enumerate(points):
            distances = [_distance(point, centroid) for centroid in centroids]
            nearest = min(range(len(distances)), key=lambda position: distances[position])
            if assignments[index] != nearest:
                assignments[index] = nearest
                changed = True
        groups = [[] for _ in centroids]
        for index, cluster in enumerate(assignments):
            groups[cluster].append(points[index])
        centroids = [
            _mean(group, len(points[0])) if group else points[int(rng() * count)][:]
            for group in groups
        ]
    inertia = sum(_distance(points[index], centroids[cluster]) ** 2 for index, cluster in enumerate(assignments))
    return {"assignments": assignments, "centroids": centroids, "k": k, "iterations": iterations, "inertia": inertia}


def _analytics(candidates: list[dict[str, Any]], interactions: list[dict[str, Any]], achievements: list[dict[str, Any]], mentorships: list[dict[str, Any]], now: str, confirmed_only: bool) -> dict[str, dict[str, float]]:
    result: dict[str, dict[str, float]] = {}
    now_value = _date_value(now)
    for candidate in candidates:
        candidate_id = str(candidate.get("id") or candidate.get("_id"))
        precomputed = next((row for row in interactions if str(row.get("_id")) == candidate_id and "totalInteractions" in row), None)
        related = [] if precomputed is not None else [
            row for row in interactions
            if str(row.get("mentorId") or row.get("_id")) == candidate_id
            and str(row.get("interactionType", "")).lower() in MENTORING_INTERACTION_TYPES
            and (not confirmed_only or row.get("confirmationStatus") == "confirmed")
        ]
        ratings = [_number(row.get("satisfactionRating")) for row in related if _number(row.get("satisfactionRating")) > 0]
        dates = [_date_value(row.get("timestamp") or row.get("createdAt")) for row in related]
        dates = [date for date in dates if date]
        accepted = sum(
            _number(row.get("count"))
            for row in mentorships
            if isinstance(row.get("_id"), dict)
            and str(row["_id"].get("mentorId")) == candidate_id
            and str(row["_id"].get("status", "")).lower() == "accepted"
        ) or sum(1 for row in mentorships if str(row.get("mentorId")) == candidate_id and str(row.get("status", "")).lower() == "accepted")
        terminated = sum(
            _number(row.get("count"))
            for row in mentorships
            if isinstance(row.get("_id"), dict)
            and str(row["_id"].get("mentorId")) == candidate_id
            and str(row["_id"].get("status", "")).lower() == "terminated"
        ) or sum(1 for row in mentorships if str(row.get("mentorId")) == candidate_id and str(row.get("status", "")).lower() == "terminated")
        pending = sum(
            _number(row.get("count"))
            for row in mentorships
            if isinstance(row.get("_id"), dict)
            and str(row["_id"].get("mentorId")) == candidate_id
            and str(row["_id"].get("status", "")).lower() == "pending"
        )
        rejected = sum(
            _number(row.get("count"))
            for row in mentorships
            if isinstance(row.get("_id"), dict)
            and str(row["_id"].get("mentorId")) == candidate_id
            and str(row["_id"].get("status", "")).lower() == "rejected"
        ) or sum(1 for row in mentorships if str(row.get("mentorId")) == candidate_id and str(row.get("status", "")).lower() == "rejected")
        # Pre-aggregated stats carry no session dates, so use their last-session timestamp.
        last = _date_value(precomputed.get("lastInteractionAt")) if precomputed else max(dates, default=0)
        if precomputed:
            recommend_yes = _number(precomputed.get("recommendYes"))
            recommend_answers = _number(precomputed.get("recommendAnswers"))
        else:
            answers = [row.get("menteeWouldRecommend") for row in related if row.get("menteeWouldRecommend") in (True, False)]
            recommend_yes, recommend_answers = float(sum(1 for a in answers if a)), float(len(answers))
        achievement = next((row for row in achievements if str(row.get("_id")) == candidate_id), {})
        result[candidate_id] = {
            "totalInteractions": _number(precomputed.get("totalInteractions")) if precomputed else len(related),
            "avgSatisfaction": _number(precomputed.get("avgSatisfaction")) if precomputed else (sum(ratings) / len(ratings) if ratings else 0),
            "ratingCount": _number(precomputed.get("ratingCount")) if precomputed else len(ratings),
            "subjectBreadth": _number(precomputed.get("subjectBreadth")) if precomputed else len({row.get("subjectTag") for row in related if row.get("subjectTag")}),
            "uniqueMentees": _number(precomputed.get("uniqueMentees")) if precomputed else len({str(row.get("menteeId")) for row in related if row.get("menteeId")}),
            "resolvedInteractions": _number(precomputed.get("resolvedInteractions")) if precomputed else sum(
                1 for row in related if str(row.get("outcomeStatus", "")).lower() == "resolved"
            ),
            "acceptedMentorships": accepted,
            "activeMentorships": accepted + pending,
            "rejectedRequests": rejected,
            # Share of requests the mentor said yes to, with a Beta(2,2) prior so new mentors start at 0.5.
            "responsiveness": (accepted + terminated + 2) / (accepted + terminated + rejected + 4),
            "recommendYes": recommend_yes,
            "recommendAnswers": recommend_answers,
            "completionRate": (
                _clamp(
                    _number(precomputed.get("verifiedCompletedSessions")) / _number(precomputed.get("totalInteractions")),
                    0,
                    1,
                )
                if precomputed is not None and _number(precomputed.get("totalInteractions")) > 0
                else 0
                if precomputed is not None
                else _clamp(
                    sum(
                        1 for row in related
                        if str(row.get("outcomeStatus", "")).lower() == "resolved"
                        or row.get("followUpCompleted") is True
                    ) / len(related),
                    0,
                    1,
                ) if related else 0
            ),
            "recencyScore": _clamp(1 - ((now_value - last) / (90 * 24 * 60 * 60)), 0, 1) if last else 0,
            "achievementLevel": _number(achievement.get("achievementLevel")),
            "achievementPoints": _number(achievement.get("achievementPoints")),
            "achievementInteractions": _number(achievement.get("achievementInteractions")),
            "achievementMentees": _number(achievement.get("achievementMentees")),
            "achievementRating": _number(achievement.get("achievementRating")),
            "achievementTitles": achievement.get("achievementTitles") or [],
            "achievementCount": _number(achievement.get("achievementCount")),
        }
        result[candidate_id]["achievementProgressStars"] = _achievement_progress_stars(result[candidate_id])
    return result


def _date_value(value: Any) -> float:
    if not value:
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return 0


def _academic_socialisation(stats: dict[str, Any] | None, now: str | None = None) -> float:
    """Return a bounded V4-only signal from existing academic chat activity.

    The route supplies counts for active groups shared with the seeker and
    messages authored by the candidate in those groups. Message content is
    deliberately not sent to or inspected by the recommender.
    """
    stats = stats or {}
    shared_groups = _clamp(_number(stats.get("sharedGroupCount")) / 5, 0, 1)
    messages = 1 - math.exp(-_number(stats.get("candidateMessageCount")) / 10)
    recency = 0.0
    last_chat = _date_value(stats.get("lastChatAt"))
    if last_chat and now:
        recency = _clamp(1 - ((_date_value(now) - last_chat) / (90 * 24 * 60 * 60)), 0, 1)
    return _clamp(shared_groups * 0.45 + messages * 0.40 + recency * 0.15, 0, 1)


ACHIEVEMENT_REQUIREMENTS = (
    (3, 2, 1),
    (8, 3, 3),
    (15, 5, 6),
    (30, 8, 12),
    (50, 12, 20),
)


def _achievement_progress_stars(stats: dict[str, Any]) -> float:
    """Estimate verified achievement progress without awarding an achievement.

    Awarded levels remain authoritative. The fractional progress toward the
    next level is the weakest of its verified interaction, mentee, and outcome
    requirements, so one inflated counter cannot create false evidence.
    """
    awarded = _clamp(_number(stats.get("achievementLevel")), 0, 5)
    if awarded >= 5:
        return 5.0
    interactions, mentees, resolved = ACHIEVEMENT_REQUIREMENTS[int(awarded)]
    observed_interactions = max(
        _number(stats.get("totalInteractions")),
        _number(stats.get("achievementInteractions")),
    )
    observed_mentees = max(
        _number(stats.get("uniqueMentees")),
        _number(stats.get("achievementMentees")),
    )
    observed_resolved = _number(stats.get("resolvedInteractions"))
    progress = min(
        observed_interactions / interactions if interactions else 0,
        observed_mentees / mentees if mentees else 0,
        observed_resolved / resolved if resolved else 0,
    )
    return _clamp(awarded + _clamp(progress, 0, 1), 0, 5)


def _eligible(seeker: dict[str, Any], candidates: list[dict[str, Any]], mentorships: list[dict[str, Any]], now: str, external: bool, version: str) -> list[dict[str, Any]]:
    seeker_id = str(seeker.get("id") or seeker.get("_id"))
    blocked = {
        str(row.get("mentorId")) for row in mentorships
        if str(row.get("menteeId")) == seeker_id and str(row.get("status", "")).lower() in {"pending", "accepted"}
    }
    pool = []
    for candidate in candidates:
        candidate_id = str(candidate.get("id") or candidate.get("_id"))
        if candidate_id == seeker_id or candidate.get("isActive") is False or candidate_id in blocked:
            continue
        if external:
            if (
                str(candidate.get("role", "")).lower() in {"senior", "faculty"}
                and candidate.get("availableForExternalGuidance") is True
                and _date_value(candidate.get("externalGuidanceLockedUntil")) > _date_value(now)
            ):
                pool.append(candidate)
            continue
        if version == "v2.1" and (seeker.get("helpWanted") or seeker.get("needs")):
            offered = set(_array(candidate.get("topicsCanHelp"))) | set(_array(candidate.get("offers")))
            wanted = set(_array(seeker.get("helpWanted"))) | set(_array(seeker.get("needs")))
            if offered and wanted and not offered.intersection(wanted):
                continue
        if version == "v2.1" and candidate.get("role") in {"seeking", "peer"} and not candidate.get("offers"):
            continue
        if str(candidate.get("mentorshipIntent", "")).lower() not in {"offering", "both"}:
            continue
        # No seniority rule: any year or role can mentor any other.
        pool.append(candidate)
    return sorted(pool, key=lambda candidate: str(candidate.get("id") or candidate.get("_id")))


def _weights(profile: str) -> dict[str, float]:
    return dict(EXTERNAL_WEIGHTS if profile == "external" else INTERNAL_WEIGHTS)


def _score(seeker: dict[str, Any], candidate: dict[str, Any], stats: dict[str, Any], fit: float, primary: bool, content: float, project: float, version: str, profile: str) -> tuple[float, dict[str, int | float], dict[str, float]]:
    existing_skills = set(_array(seeker.get("skills")))
    candidate_capabilities = _mentor_expertise(candidate)
    learning_needs = _learning_needs(seeker)
    learning_alignment = (
        len(learning_needs & candidate_capabilities) / len(learning_needs)
        if learning_needs else 0
    )
    seeker_needs = (
        learning_needs
        if learning_needs
        else existing_skills | set(_array(seeker.get("interests")))
    )
    skill = (
        len(seeker_needs & candidate_capabilities) / len(seeker_needs)
        if seeker_needs else 0
    )
    needs = set(_array(seeker.get("interests"))) | existing_skills
    capabilities = set(_array(candidate.get("skills"))) | set(_array(candidate.get("interests")))
    has_department = bool(str(seeker.get("department") or "").strip() and str(candidate.get("department") or "").strip())
    department = 0 if version == "v2.2" else float(has_department and str(seeker.get("department")).upper() == str(candidate.get("department")).upper())
    has_year = seeker.get("year") not in (None, "") and candidate.get("year") not in (None, "")
    progression = _clamp((_number(candidate.get("year")) - _number(seeker.get("year")) + 2) / 6, 0, 1) if has_year else 0
    has_availability = bool(str(seeker.get("availability") or "").strip() and str(candidate.get("availability") or "").strip())
    availability = (1 if str(candidate.get("availability")).lower() == str(seeker.get("availability")).lower() else 0.6) if has_availability else 0
    rating_count = _number(stats.get("ratingCount"))
    if rating_count > 0:
        rating_confidence = rating_count / (rating_count + 5)
        smoothed_rating = ((3.5 * 5) + (_number(stats.get("avgSatisfaction")) * rating_count)) / (5 + rating_count)
        rating_quality = (smoothed_rating / 5) * 0.6 * rating_confidence
    else:
        rating_confidence = 0
        rating_quality = (_number(stats.get("avgSatisfaction")) / 5) * 0.6
    quality = _clamp(rating_quality + _number(stats.get("completionRate")) * 0.4, 0, 1)
    # "Would you recommend this mentor?" answers, pulled toward 70% until there are a few.
    recommend_answers = _number(stats.get("recommendAnswers"))
    would_recommend = (_number(stats.get("recommendYes")) + 1.4) / (recommend_answers + 2) if recommend_answers > 0 else None
    if version == "v3" and would_recommend is not None:
        quality = _clamp(quality * 0.8 + would_recommend * 0.2, 0, 1)
    responsiveness = _clamp(_number(stats.get("responsiveness"), 0.5), 0, 1)
    activity = _clamp((_number(stats.get("totalInteractions")) / 60) * 0.5 + _number(stats.get("recencyScore")) * 0.5, 0, 1)
    achievement_progress = _clamp(_number(stats.get("achievementProgressStars")) / 5, 0, 1)
    achievement_confidence = 1.0 if _number(stats.get("achievementLevel")) > 0 else 0.0
    mentoring_evidence = _clamp(
        achievement_progress * 0.25
        + (_number(stats.get("achievementInteractions")) / 100) * 0.25
        + (_number(stats.get("achievementMentees")) / 40) * 0.20
        + (_number(stats.get("achievementRating")) / 5) * 0.15
        + (_number(stats.get("totalInteractions")) / 60) * 0.15,
        0,
        1,
    )
    enriched = 0.0
    if version == "v3":
        seeker_topics = _learning_needs(seeker)
        mentor_topics = _mentor_expertise(candidate)
        enriched = len(seeker_topics & mentor_topics) / len(seeker_topics | mentor_topics) if seeker_topics | mentor_topics else 0
    values = {"skills": skill, "interests": content, "project": project, "department": department, "progression": progression, "availability": availability, "goals": quality, "activity": activity, "profile": _strength(candidate), "cluster": fit, "enriched": enriched, "responsiveness": responsiveness}
    weights = _weights(profile)
    if version == "v2.0":
        total = sum(weights.values()) + 0.10 + 0.10 + 0.11 + 0.08 + 0.03 + 0.05
        coefficients = {key: value / total for key, value in {**weights, "department": .10, "progression": .10, "activity": .11, "profile": .08, "cluster": .03, "primary": .05}.items()}
        raw = sum(values[key] * coefficients[key] for key in values if key in coefficients) + (coefficients["primary"] if primary else 0)
    elif version == "v3":
        coefficient_values = {
            **weights,
            "department": .10,
            "progression": .10,
            "activity": .11,
            "profile": .08,
            "cluster": .03,
            "primary": .05,
            "enriched": .05,
            "mentoring": .08,
            "project": .10,
            "responsiveness": .05,
        }
        total = sum(coefficient_values.values())
        coefficients = {key: value / total for key, value in coefficient_values.items()}
        raw = sum(values[key] * coefficients[key] for key in values if key in coefficients)
        raw += coefficients["primary"] if primary else 0
        raw += mentoring_evidence * coefficients["mentoring"]
    else:
        raw = skill * weights["skills"] + content * weights["interests"] + department * .10 + progression * .10 + availability * weights["availability"] + quality * weights["goals"] + activity * .11 + _strength(candidate) * .08 + fit * .03 + (.05 if primary else 0)
        if version == "v2.4":
            raw += 0
    exposure_penalty = 0.0
    if version == "v3":
        capacity = _number(candidate.get("maxMentees"), 0)
        exposure = _number(candidate.get("exposureCount"), _number(candidate.get("activeMentees"), 0))
        if capacity > 0:
            exposure_penalty = _clamp(exposure / capacity, 0, 1) * 0.05
            raw -= exposure_penalty
    raw = _clamp(raw, 0, 1)
    components = {
        "skillAlignment": round(skill * 100), "contentSimilarity": round(content * 100),
        "departmentMatch": round(department * 100), "academicProgression": round(progression * 100),
        "availabilityMatch": round(availability * 100), "mentorQuality": round(quality * 100),
        "activitySignal": round(activity * 100), "profileStrength": round(_strength(candidate) * 100),
        "projectRelevance": round(project * 100),
        "clusterFit": round(fit * 100), "clusterBonus": round((.05 if primary else 0) * 100),
        "mentoringEvidence": round(mentoring_evidence * 100),
        "achievementConfidence": round(achievement_confidence * 100),
        "achievementProgressStars": round(achievement_progress * 5, 2),
        "responsiveness": round(responsiveness * 100),
        "wouldRecommendRate": None if would_recommend is None else round(would_recommend * 100),
    }
    if version == "v3":
        contributions = {
            "contentSimilarity": content * coefficients["interests"],
            "projectRelevance": project * coefficients["project"],
            "departmentMatch": department * coefficients["department"],
            "academicProgression": progression * coefficients["progression"],
            "availabilityMatch": availability * coefficients["availability"],
            "mentorQuality": quality * coefficients["goals"],
            "activitySignal": activity * coefficients["activity"],
            "profileStrength": _strength(candidate) * coefficients["profile"],
            "clusterFit": fit * coefficients["cluster"],
            "primaryClusterBonus": coefficients["primary"] if primary else 0,
            "enrichedProfile": enriched * coefficients["enriched"],
            "mentoringEvidence": mentoring_evidence * coefficients["mentoring"],
            "skillAlignment": max(skill - learning_alignment, 0) * coefficients["skills"],
            "learningNeedsCompatibility": min(skill, learning_alignment) * coefficients["skills"],
            "responsiveness": responsiveness * coefficients["responsiveness"],
            "exposurePenalty": -exposure_penalty,
        }
    else:
        contributions = {
            "skillAlignment": skill * weights["skills"],
            "contentSimilarity": content * weights["interests"],
            "departmentMatch": department * (0 if version == "v2.2" else 0.10),
            "academicProgression": progression * 0.10,
            "availabilityMatch": availability * weights["availability"],
            "mentorQuality": quality * weights["goals"],
            "activitySignal": activity * 0.11,
            "profileStrength": _strength(candidate) * 0.08,
            "clusterFit": fit * 0.03,
            "primaryClusterBonus": 0.05 if primary else 0,
            "enrichedProfile": enriched * 0.05,
            "mentoringEvidence": mentoring_evidence * 0.08,
            "projectRelevance": project * 0.10,
            "exposurePenalty": -exposure_penalty,
        }
    return raw, components, contributions


def recommend(*, seeker: dict[str, Any], candidates: list[dict[str, Any]], interactions: list[dict[str, Any]] | None = None, achievements: list[dict[str, Any]] | None = None, mentorships: list[dict[str, Any]] | None = None, version: str = "v1", options: dict[str, Any] | None = None) -> dict[str, Any]:
    """Generate recommendations for a selectable version.

    V4 requires optional XGBoost/SHAP dependencies and a trained model supplied
    through the options mapping; it never silently falls back to another model.
    """
    options = options or {}
    version = version.lower()
    if version not in {"v1", "v2.0", "v2.1", "v2.2", "v2.3", "v2.4", "v3", "v4"}:
        raise RecommendationError(f"Unsupported recommendation version: {version}")
    interactions = interactions or []
    achievements = achievements or []
    mentorships = mentorships or []
    if version == "v4":
        return _recommend_v4(seeker, candidates, interactions, achievements, mentorships, options)
    now = options.get("now") or datetime.now(timezone.utc).isoformat()
    profile = options.get("weightProfile", "internal")
    excluded = {str(value) for value in options.get("excludedMentorIds", [])}
    pool = [
        candidate for candidate in _eligible(seeker, candidates, mentorships, now, profile == "external", version)
        if str(candidate.get("id") or candidate.get("_id")) not in excluded
    ]
    if not pool:
        return {"recommendations": [], "clustering": {"model": "kmeans", "clusterCount": 0, "clusters": []}, "version": version}
    confirmed_only = version != "v1"
    analytics = _analytics(pool, interactions, achievements, mentorships, now, confirmed_only)
    vocabulary = sorted(set(_array(seeker.get("skills")) + _array(seeker.get("interests")) + [term for candidate in pool for term in _array(candidate.get("skills")) + _array(candidate.get("interests"))]))
    vectors = [_features(candidate, seeker, vocabulary, analytics[str(candidate.get("id") or candidate.get("_id"))]) for candidate in pool]
    documents = [_profile_text(seeker, v2=version != "v1", include_projects=False)] + [_profile_text(candidate, v2=version != "v1", include_projects=False) for candidate in pool]
    text_vocabulary, text_vectors = _tfidf(documents)
    if version == "v2.4":
        clustering = _topic_clusters(vectors, documents, options)
    else:
        seed = int(options.get("seed", 0))
        if version != "v1":
            digest = hashlib.sha256(str(seeker.get("id") or seeker.get("_id")).encode()).digest()
            seed = int.from_bytes(digest[:4], "big")
        clustering = _kmeans(vectors, _cluster_count(len(pool)), _mulberry32(seed))
    seeker_vector = _features(seeker, seeker, vocabulary, {})
    primary = min(range(len(clustering["centroids"])), key=lambda index: _distance(seeker_vector, clustering["centroids"][index][:len(seeker_vector)])) if clustering["centroids"] else 0
    ranking = []
    for index, candidate in enumerate(pool):
        cluster = clustering["assignments"][index] if clustering["assignments"] else 0
        centroid = clustering["centroids"][cluster] if clustering["centroids"] else []
        distance = _clamp(_distance(vectors[index], centroid) / math.sqrt(len(vectors[index]) or 1), 0, 1) if centroid else 0
        content = _cosine(text_vectors[0], text_vectors[index + 1])
        project = _project_relevance(seeker, candidate)
        raw, components, contributions = _score(seeker, candidate, analytics[str(candidate.get("id") or candidate.get("_id"))], _clamp(1 - distance, 0, 1), cluster == primary, content, project, version, profile)
        ranking.append({
            "id": str(candidate.get("id") or candidate.get("_id")), "mentor": candidate,
            "score": round(raw * 100), "scoreRaw": raw, "components": components,
            "evidence": {"sharedContentTokens": sorted(set(documents[0].split()) & set(documents[index + 1].split()))[:8]},
            "meta": {"clusterId": cluster, "isPrimaryCluster": cluster == primary, "distance": round(distance, 4)},
        })
        if version == "v2.3" or version == "v3":
            ranking[-1]["explanation"] = {
                "method": "additive",
                "contributions": {key: round(value, 8) for key, value in contributions.items() if value},
            }
            if options.get("demoEvidence"):
                ranking[-1]["explanation"]["notice"] = "Fictional demo mentoring evidence contributed to this score."
                ranking[-1]["demoEvidenceNotice"] = "Fictional demo mentoring evidence"
        ranking[-1].update({
            "matchScore": ranking[-1]["score"],
            "scoreComponents": ranking[-1]["components"],
            "sharedContentTokens": ranking[-1]["evidence"]["sharedContentTokens"],
            "contentExplanation": (
                "Strong profile overlap across skills, interests, bio, and project experience."
                if content >= 0.7 else
                "Moderate profile similarity based on shared skills, interests, and profile information."
                if content >= 0.3 else
                "Limited textual profile overlap."
            ),
            "cluster": ranking[-1]["meta"],
            "mentorAnalytics": {
                "totalInteractions": analytics[str(candidate.get("id") or candidate.get("_id"))].get("totalInteractions", 0),
                "avgSatisfaction": round(analytics[str(candidate.get("id") or candidate.get("_id"))].get("avgSatisfaction", 0), 2),
                "completionRate": round(analytics[str(candidate.get("id") or candidate.get("_id"))].get("completionRate", 0) * 100, 1),
                "recencyScore": round(analytics[str(candidate.get("id") or candidate.get("_id"))].get("recencyScore", 0) * 100, 1),
                "activeMentorships": analytics[str(candidate.get("id") or candidate.get("_id"))].get("activeMentorships", 0),
                "subjectBreadth": analytics[str(candidate.get("id") or candidate.get("_id"))].get("subjectBreadth", 0),
                "achievementLevel": analytics[str(candidate.get("id") or candidate.get("_id"))].get("achievementLevel", 0),
                "achievementProgressStars": analytics[str(candidate.get("id") or candidate.get("_id"))].get("achievementProgressStars", 0),
                "achievementInteractions": analytics[str(candidate.get("id") or candidate.get("_id"))].get("achievementInteractions", 0),
                "achievementMentees": analytics[str(candidate.get("id") or candidate.get("_id"))].get("achievementMentees", 0),
                "achievementTitles": analytics[str(candidate.get("id") or candidate.get("_id"))].get("achievementTitles", []),
                "achievementCount": analytics[str(candidate.get("id") or candidate.get("_id"))].get("achievementCount", 0),
            },
        })
    ranking.sort(key=lambda item: (-item["scoreRaw"], item["id"]))
    limit = max(1, min(int(options.get("limit", 10)), 50))
    clusters = [{"clusterId": index, "size": clustering["assignments"].count(index), "ids": [pool[position].get("id", pool[position].get("_id")) for position, cluster in enumerate(clustering["assignments"]) if cluster == index]} for index in range(clustering["k"])]
    return {"recommendations": ranking[:limit], "clustering": {"model": "nmf" if version == "v2.4" else "kmeans", "clusterCount": clustering["k"], "vocabularySize": len(text_vocabulary), "iterations": clustering.get("iterations", 0), "inertia": round(clustering.get("inertia", 0), 4), "selectedCluster": primary, "clusters": clusters}, "version": version}


def _cluster_count(count: int) -> int:
    return 1 if count < 3 else int(_clamp(round(math.sqrt(count / 2)), 2, min(6, count)))


def _topic_clusters(vectors: list[list[float]], documents: list[str], options: dict[str, Any]) -> dict[str, Any]:
    """Use NMF when scikit-learn is available, with explicit K-Means comparison."""
    try:
        from sklearn.decomposition import NMF
        from sklearn.feature_extraction.text import TfidfVectorizer
    except ImportError as exc:
        raise RecommendationError("V2.4 requires scikit-learn for NMF topic discovery") from exc
    count = len(vectors)
    k = _cluster_count(count)
    matrix = TfidfVectorizer(token_pattern=r"(?u)\b[\w+#./-]+\b").fit_transform(documents).toarray()
    model = NMF(n_components=k, init="nndsvda", random_state=options.get("seed", 0), max_iter=500)
    transformed = model.fit_transform(matrix)
    assignments = [max(range(k), key=lambda index: row[index]) for row in transformed[1:]]
    centroids = [_mean([vectors[index] for index, cluster in enumerate(assignments) if cluster == group], len(vectors[0])) for group in range(k)]
    return {"assignments": assignments, "centroids": centroids, "k": k, "iterations": int(model.n_iter_), "inertia": float(model.reconstruction_err_)}


def _recommend_v4(
    seeker: dict[str, Any],
    candidates: list[dict[str, Any]],
    interactions: list[dict[str, Any]],
    achievements: list[dict[str, Any]],
    mentorships: list[dict[str, Any]],
    options: dict[str, Any],
) -> dict[str, Any]:
    try:
        import shap
        import xgboost
    except ImportError as exc:
        raise RecommendationError("V4 requires installed xgboost and shap packages") from exc
    model = options.get("model")
    if model is None or not hasattr(model, "predict"):
        raise RecommendationError("V4 requires a trained XGBoost ranking model in options.model")
    base = recommend(
        seeker=seeker,
        candidates=candidates,
        interactions=interactions,
        achievements=achievements,
        mentorships=mentorships,
        version="v3",
        options={**options, "model": None},
    )
    rows = base["recommendations"]
    now = options.get("now") or datetime.now(timezone.utc).isoformat()
    socialisation = options.get("academicSocialisation") or {}
    features = [
        [
            item["scoreRaw"],
            *item["components"].values(),
            _academic_socialisation(
                socialisation.get(item["id"]),
                now,
            ),
        ]
        for item in rows
    ]
    predictions = model.predict(features)
    explainer = shap.TreeExplainer(model)
    explanations = explainer.shap_values(features)
    for item, prediction, explanation in zip(rows, predictions, explanations):
        item["scoreRaw"] = float(prediction)
        item["score"] = round(_clamp(float(prediction), 0, 1) * 100)
        item["explanation"] = {"method": "TreeSHAP", "contributions": [float(value) for value in explanation]}
    rows.sort(key=lambda item: (-item["scoreRaw"], item["id"]))
    return {"recommendations": rows, "clustering": base["clustering"], "version": "v4"}
