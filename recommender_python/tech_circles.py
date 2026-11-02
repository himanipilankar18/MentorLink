"""Evidence-based technical domain discovery and ranking for Tech Circles."""

from __future__ import annotations

from typing import Any

from .skill_features import (
    INVALID_SKILL_TERMS,
    audit_skills,
    normalize_skill_values,
    normalize_text_terms,
)

DEFAULT_SEED = 41
MAX_CLUSTERS = 15
MIN_DOMAIN_AFFINITY = 0.72

_NOISE = {
    "project", "projects", "profile", "mentorlink", "fictional", "demo",
    "git", "github", "exploring", "explore", "peer", "peers", "student",
    "students", "user", "users", "account", "mentor", "mentee", "technical",
    "technology", "technologies", "interest", "interests", "experience",
    "work", "working", "using", "use", "built", "build", "developing",
    "development", "based", "help", "learning", "learn", "and", "the",
    "with", "for", "from", "this", "that", "into", "about", "years",
    "site", "application", "app", "full", "stack", "campus", "portal",
    "shopping", "mobile", "design", "designer", "prototype", "model",
    "models", "prediction", "classifier", "text", "product",
} | INVALID_SKILL_TERMS

_DOMAIN_RULES = [
    ("Web Development", "Web interfaces, applications, and full-stack systems.",
     {"javascript", "typescript", "react", "angular", "vue", "html", "css",
      "node.js", "express", "next.js", "frontend", "backend", "full stack",
      "web development"}),
    ("Machine Learning & AI", "Machine learning, artificial intelligence, and intelligent applications.",
     {"python", "machine learning", "deep learning", "tensorflow", "pytorch",
      "nlp", "natural language processing", "computer vision", "ai", "artificial intelligence"}),
    ("UI/UX Design", "User experience, interface design, and product prototyping.",
     {"figma", "sketch", "adobe xd", "ui", "ux", "ui/ux", "wireframing",
      "prototyping", "user research", "interaction design"}),
    ("Data Science", "Data analysis, statistics, visualization, and data platforms.",
     {"python", "pandas", "numpy", "sql", "r", "statistics", "data science",
      "data analysis", "tableau", "power bi", "matplotlib", "spark"}),
    ("App Development", "Mobile and cross-platform application development.",
     {"android", "ios", "kotlin", "swift", "flutter", "dart", "react native",
      "mobile development", "app development"}),
    ("Cybersecurity", "Security engineering, secure systems, and threat analysis.",
     {"cybersecurity", "security", "ethical hacking", "penetration testing",
      "network security", "cryptography", " kali", "owasp"}),
    ("Cloud Computing & DevOps", "Cloud infrastructure, deployment, and reliable operations.",
     {"aws", "azure", "gcp", "cloud", "docker", "kubernetes", "terraform",
      "jenkins", "devops", "ci/cd", "linux"}),
    ("Embedded Systems & IoT", "Embedded software, electronics, and connected devices.",
     {"c", "c++", "arduino", "raspberry pi", "embedded", "iot", "microcontroller",
      "electronics", "robotics", "verilog"}),
]


def _terms(value: Any) -> list[str]:
    return normalize_text_terms(value)


def normalize_terms(value: Any) -> list[str]:
    return _terms(value)


def _profile_evidence(profile: dict[str, Any]) -> dict[str, list[str]]:
    evidence = {
        "skills": normalize_skill_values(profile.get("skills")),
        "interests": _terms(profile.get("interests")),
        "projects": [],
        "technologies": [],
        "experience": _terms(profile.get("experience")),
        "courses": _terms(profile.get("courses")),
        "certifications": _terms(profile.get("certifications")),
        "career": _terms(profile.get("careerInterests")) + _terms(profile.get("careerGoals")),
    }
    for project in profile.get("projects") or []:
        if not isinstance(project, dict):
            continue
        evidence["projects"].extend(_terms(project.get("title")))
        evidence["projects"].extend(_terms(project.get("description")))
        evidence["technologies"].extend(_terms(project.get("technologies")))
    for key in evidence:
        evidence[key] = list(dict.fromkeys(evidence[key]))
    return evidence


def profile_document(profile: dict[str, Any]) -> str:
    evidence = _profile_evidence(profile)
    weighted = (
        evidence["skills"] * 8
        + evidence["technologies"] * 2
        + evidence["interests"] * 2
        + evidence["projects"]
        + evidence["experience"]
        + evidence["courses"]
        + evidence["certifications"]
        + evidence["career"]
    )
    return " ".join(dict.fromkeys(weighted))


def skill_document(profile: dict[str, Any]) -> str:
    """Return only normalized structured skills for the clustering matrix."""
    return " ".join(normalize_skill_values(profile.get("skills")))


def _domain_for_terms(terms: list[str]) -> tuple[str | None, str | None]:
    term_set = set(terms)
    scores = []
    for name, description, vocabulary in _DOMAIN_RULES:
        matches = term_set.intersection(vocabulary)
        scores.append((len(matches), name, description))
    matches, name, description = max(scores, key=lambda item: (item[0], item[1]))
    return (name, description) if matches >= 2 else (None, None)


def _domain_vocabulary(name: str) -> set[str]:
    return next(vocabulary for label, _, vocabulary in _DOMAIN_RULES if label == name)


def _representative_terms(centroid: Any, feature_names: Any) -> list[str]:
    return [
        str(feature_names[index])
        for index in centroid.argsort()[::-1]
        if centroid[index] > 0 and str(feature_names[index]) not in _NOISE
    ][:8]


def _metric_rank(values: list[float], value: float, reverse: bool = True) -> float:
    ordered = sorted(values, reverse=reverse)
    if not ordered:
        return 0.0
    return 1.0 - (ordered.index(value) / max(1, len(ordered) - 1))


def _cluster_sizes(labels: Any, k: int) -> list[int]:
    return [int(sum(1 for label in labels if int(label) == index)) for index in range(k)]


def _empty_result(seed: int, count: int = 0) -> dict[str, Any]:
    return {
        "algorithm": "kmeans-tfidf-domain-ranking",
        "seed": seed,
        "metrics": {
            "silhouette": None, "daviesBouldin": None, "calinskiHarabasz": None,
            "stabilityARI": None, "inertia": None, "clusterSizes": [], "testedK": [],
            "selectedK": None,
            "featureAudit": None,
        },
        "clusters": [],
        "assignments": [],
        "profileCount": count,
    }


def _fallback_result(profiles: list[dict[str, Any]], seed: int) -> dict[str, Any]:
    result = _empty_result(seed, len(profiles))
    result["clusters"] = [{
        "id": "unclassified",
        "name": "Unclassified Technical Profiles",
        "description": "Profiles without enough coherent technical evidence for a domain.",
        "size": 0,
        "representativeTerms": [],
        "memberIds": [],
        "rankedMembers": [],
        "displayable": False,
    }]
    return result


def cluster_profiles(profiles: list[dict[str, Any]], seed: int = DEFAULT_SEED) -> dict[str, Any]:
    if not profiles:
        return _empty_result(seed)
    feature_audit = audit_skills(profiles)
    eligible_profiles = [
        profile for profile in profiles
        if normalize_skill_values(profile.get("skills"))
    ]
    documents = [skill_document(profile) for profile in eligible_profiles]
    if len(eligible_profiles) < 3 or len(set(documents)) < 2:
        result = _fallback_result(profiles, seed)
        result["metrics"]["featureAudit"] = feature_audit
        return result

    try:
        from sklearn.cluster import KMeans
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics import (
            adjusted_rand_score, calinski_harabasz_score, davies_bouldin_score,
            silhouette_score,
        )
    except ImportError as exc:
        raise RuntimeError("Tech Circles requires scikit-learn") from exc

    vectorizer = TfidfVectorizer(
        token_pattern=r"(?u)\b[\w+#./-]+\b",
        min_df=1,
        binary=True,
        use_idf=False,
        norm="l2",
    )
    matrix = vectorizer.fit_transform(documents).toarray()
    max_k = min(MAX_CLUSTERS, len(eligible_profiles) - 1)
    candidates = []
    for k in range(2, max_k + 1):
        model = KMeans(n_clusters=k, random_state=seed, n_init=20)
        labels = model.fit_predict(matrix)
        if len(set(labels)) < 2:
            continue
        try:
            metrics = {
                "silhouette": float(silhouette_score(matrix, labels)),
                "daviesBouldin": float(davies_bouldin_score(matrix, labels)),
                "calinskiHarabasz": float(calinski_harabasz_score(matrix, labels)),
            }
        except ValueError:
            continue
        stability = [
            float(adjusted_rand_score(
                labels,
                KMeans(n_clusters=k, random_state=repeat_seed, n_init=20).fit_predict(matrix),
            ))
            for repeat_seed in (seed + 1, seed + 2, seed + 3)
        ]
        candidates.append({
            "k": k, "model": model, "labels": labels,
            "inertia": float(model.inertia_),
            "stabilityARI": sum(stability) / len(stability),
            "clusterSizes": _cluster_sizes(labels, k),
            **metrics,
        })

    if not candidates:
        return _empty_result(seed, len(profiles))

    silhouettes = [item["silhouette"] for item in candidates]
    dbs = [item["daviesBouldin"] for item in candidates]
    chs = [item["calinskiHarabasz"] for item in candidates]
    stabilities = [item["stabilityARI"] for item in candidates]
    for item in candidates:
        item["selectionScore"] = (
            _metric_rank(silhouettes, item["silhouette"])
            + _metric_rank(dbs, item["daviesBouldin"], reverse=False)
            + _metric_rank(chs, item["calinskiHarabasz"])
            + _metric_rank(stabilities, item["stabilityARI"])
        ) / 4
    selected = max(candidates, key=lambda item: (item["selectionScore"], -item["k"]))
    model, labels = selected["model"], selected["labels"]
    feature_names = vectorizer.get_feature_names_out()
    distances = model.transform(matrix)
    clusters = []
    assignments = []

    for cluster_id in range(selected["k"]):
        indexes = [i for i, label in enumerate(labels) if int(label) == cluster_id]
        representative = _representative_terms(model.cluster_centers_[cluster_id], feature_names)
        cluster_skill_terms = list(dict.fromkeys(
            term
            for index in indexes
            for term in normalize_skill_values(eligible_profiles[index].get("skills"))
        ))
        name, description = _domain_for_terms(cluster_skill_terms + representative)
        if not name:
            continue
        display_terms = [term for term in representative if term in _domain_vocabulary(name)]
        display_terms = list(dict.fromkeys(
            [term for term in cluster_skill_terms if term in _domain_vocabulary(name)]
            + display_terms
        ))
        ranked = []
        for index in range(len(eligible_profiles)):
            affinities = [1 / (1 + float(distance)) for distance in distances[index]]
            maximum = max(affinities) if affinities else 1
            affinity = affinities[cluster_id] / maximum if maximum else 0
            evidence = _profile_evidence(eligible_profiles[index])
            domain_matches = []
            domain_vocabulary = _domain_vocabulary(name)
            for term in evidence["skills"]:
                if term in domain_vocabulary:
                    domain_matches.append(term)
            supporting_matches = [
                term for source, terms in evidence.items() if source != "skills"
                for term in terms if term in domain_vocabulary
            ]
            if not domain_matches:
                continue
            matched = list(dict.fromkeys(domain_matches + supporting_matches))
            skill_coverage = min(1.0, len(set(domain_matches)) / 4)
            support_bonus = min(0.15, len(set(supporting_matches)) * 0.03)
            score = min(100.0, round(
                (skill_coverage * 80) + (affinity * 15) + (support_bonus * 100),
                2,
            ))
            ranked.append({
                "userId": str(eligible_profiles[index].get("_id") or eligible_profiles[index].get("id")),
                "score": score,
                "affinity": round(affinity, 6),
                "evidence": list(dict.fromkeys(matched))[:6],
            })
        ranked.sort(key=lambda item: (-item["score"], item["userId"]))
        relevant = [item for item in ranked if item["affinity"] >= MIN_DOMAIN_AFFINITY]
        member_ids = [item["userId"] for item in relevant]
        clusters.append({
            "id": str(cluster_id),
            "name": name,
            "description": description,
            "size": len(member_ids),
            "representativeTerms": display_terms[:8],
            "memberIds": member_ids,
            "rankedMembers": relevant,
        })
        for item in relevant:
            assignments.append({
                "userId": item["userId"],
                "clusterId": str(cluster_id),
                "affinity": item["affinity"],
                "score": item["score"],
                "evidence": item["evidence"],
            })

    merged_domains = {}
    for cluster in clusters:
        existing = merged_domains.get(cluster["name"])
        if not existing:
            merged_domains[cluster["name"]] = cluster
            continue
        ranking = {entry["userId"]: entry for entry in existing["rankedMembers"]}
        for entry in cluster["rankedMembers"]:
            previous = ranking.get(entry["userId"])
            if not previous or entry["score"] > previous["score"]:
                ranking[entry["userId"]] = entry
        existing["representativeTerms"] = list(dict.fromkeys(
            existing["representativeTerms"] + cluster["representativeTerms"],
        ))[:8]
        existing["rankedMembers"] = sorted(
            ranking.values(), key=lambda item: (-item["score"], item["userId"]),
        )
        existing["memberIds"] = [entry["userId"] for entry in existing["rankedMembers"]]
        existing["size"] = len(existing["memberIds"])
    clusters = list(merged_domains.values())
    assignments = [
        {
            "userId": entry["userId"],
            "clusterId": cluster["id"],
            "affinity": entry["affinity"],
            "score": entry["score"],
            "evidence": entry["evidence"],
        }
        for cluster in clusters
        for entry in cluster["rankedMembers"]
    ]
    tested = [{key: value for key, value in item.items() if key not in {"model", "labels"}}
              for item in candidates]
    return {
        "algorithm": "kmeans-skill-multihot-domain-ranking",
        "seed": seed,
        "metrics": {
            "silhouette": selected["silhouette"],
            "daviesBouldin": selected["daviesBouldin"],
            "calinskiHarabasz": selected["calinskiHarabasz"],
            "stabilityARI": selected["stabilityARI"],
            "inertia": selected["inertia"],
            "clusterSizes": selected["clusterSizes"],
            "testedK": tested,
            "selectedK": selected["k"],
            "featureAudit": feature_audit,
        },
        "clusters": clusters,
        "assignments": assignments,
        "profileCount": len(profiles),
    }
