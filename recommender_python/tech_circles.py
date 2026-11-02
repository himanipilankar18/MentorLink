"""Unsupervised technical-interest clustering for Tech Circles."""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any

DEFAULT_SEED = 41
MAX_CLUSTERS = 8
_ALIASES = {
    "js": "javascript",
    "nodejs": "node.js",
    "node js": "node.js",
    "reactjs": "react",
    "ml": "machine learning",
    "postgres": "postgresql",
}


def normalize_terms(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    terms: list[str] = []
    for item in value:
        term = re.sub(r"\s+", " ", str(item or "").strip().lower())
        if term:
            terms.append(_ALIASES.get(term, term))
    return list(dict.fromkeys(terms))


def profile_document(profile: dict[str, Any]) -> str:
    terms = normalize_terms(profile.get("skills")) + normalize_terms(profile.get("interests"))
    for project in profile.get("projects") or []:
        if isinstance(project, dict):
            terms += normalize_terms(project.get("technologies"))
            for key in ("title", "description"):
                text = str(project.get(key) or "").lower()
                terms += re.findall(r"[a-z][a-z0-9+#./-]{1,}", text)
    for key in ("bio", "careerInterests", "careerGoals", "expertise", "courses", "certifications"):
        value = profile.get(key)
        if isinstance(value, list):
            terms += normalize_terms(value)
        elif value:
            terms += re.findall(r"[a-z][a-z0-9+#./-]{1,}", str(value).lower())
    return " ".join(dict.fromkeys(_ALIASES.get(term, term) for term in terms))


def _cluster_name(terms: list[str]) -> str:
    if not terms:
        return "Emerging Technical Interests"
    selected = terms[:3]
    return " / ".join(term.title() for term in selected)


def _description(terms: list[str]) -> str:
    if not terms:
        return "Members with developing or mixed technical interests."
    return f"Members exploring {', '.join(terms[:5])}."


def cluster_profiles(profiles: list[dict[str, Any]], seed: int = DEFAULT_SEED) -> dict[str, Any]:
    if not profiles:
        return {
            "algorithm": "kmeans-tfidf",
            "seed": seed,
            "metrics": {"silhouette": None, "daviesBouldin": None, "calinskiHarabasz": None, "stabilityARI": None},
            "clusters": [],
            "assignments": [],
            "profileCount": 0,
        }
    documents = [profile_document(profile) for profile in profiles]
    try:
        from sklearn.cluster import KMeans
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score
    except ImportError as exc:
        raise RuntimeError("Tech Circles requires scikit-learn") from exc

    non_empty = [document for document in documents if document]
    if len(profiles) < 3 or not non_empty:
        assignments = [0] * len(profiles)
        return {
            "algorithm": "kmeans-tfidf",
            "seed": seed,
            "metrics": {"silhouette": None, "daviesBouldin": None, "calinskiHarabasz": None, "stabilityARI": None},
            "clusters": [{
                "id": "0",
                "name": _cluster_name([]),
                "description": _description([]),
                "size": len(profiles),
                "representativeTerms": [],
                "memberIds": [str(profile.get("_id") or profile.get("id")) for profile in profiles],
            }],
            "assignments": [{"userId": str(profile.get("_id") or profile.get("id")), "clusterId": "0", "affinity": 1.0} for profile in profiles],
            "profileCount": len(profiles),
        }

    matrix = TfidfVectorizer(token_pattern=r"(?u)\b[\w+#./-]+\b", min_df=1).fit_transform(documents).toarray()
    max_k = min(MAX_CLUSTERS, len(profiles) - 1)
    best: tuple[float, Any, int] | None = None
    for k in range(2, max_k + 1):
        model = KMeans(n_clusters=k, random_state=seed, n_init=20)
        labels = model.fit_predict(matrix)
        if len(set(labels)) < 2:
            continue
        score = float(silhouette_score(matrix, labels))
        if best is None or score > best[0]:
            best = (score, model, k)
    if best is None:
        model = KMeans(n_clusters=1, random_state=seed, n_init=20).fit(matrix)
        labels = model.labels_
        k = 1
        silhouette = None
        db = None
        ch = None
    else:
        silhouette, model, k = best
        labels = model.labels_
        db = float(davies_bouldin_score(matrix, labels))
        ch = float(calinski_harabasz_score(matrix, labels))

    terms = TfidfVectorizer(token_pattern=r"(?u)\b[\w+#./-]+\b", min_df=1).fit(documents)
    feature_names = terms.get_feature_names_out()
    clusters = []
    assignments = []
    for cluster_id in range(k):
        indexes = [index for index, label in enumerate(labels) if label == cluster_id]
        centroid = model.cluster_centers_[cluster_id]
        representative = [
            feature_names[index]
            for index in centroid.argsort()[::-1]
            if centroid[index] > 0
        ][:8]
        member_ids = [str(profiles[index].get("_id") or profiles[index].get("id")) for index in indexes]
        clusters.append({
            "id": str(cluster_id),
            "name": _cluster_name(representative),
            "description": _description(representative),
            "size": len(indexes),
            "representativeTerms": representative,
            "memberIds": member_ids,
        })
        for index in indexes:
            distances = model.transform(matrix[index:index + 1])[0]
            best_distance = float(distances.min()) if len(distances) else 0
            affinity = 1 / (1 + best_distance)
            assignments.append({
                "userId": member_ids[indexes.index(index)],
                "clusterId": str(cluster_id),
                "affinity": round(affinity, 6),
            })

    stability = []
    if k > 1:
        from sklearn.metrics import adjusted_rand_score
        for repeat_seed in (seed + 1, seed + 2, seed + 3):
            repeat = KMeans(n_clusters=k, random_state=repeat_seed, n_init=20).fit_predict(matrix)
            stability.append(float(adjusted_rand_score(labels, repeat)))
    return {
        "algorithm": "kmeans-tfidf",
        "seed": seed,
        "metrics": {
            "silhouette": silhouette,
            "daviesBouldin": db,
            "calinskiHarabasz": ch,
            "stabilityARI": sum(stability) / len(stability) if stability else None,
        },
        "clusters": clusters,
        "assignments": assignments,
        "profileCount": len(profiles),
    }
