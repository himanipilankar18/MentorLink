"""HTTP API for the Python recommendation engine."""

from __future__ import annotations

from typing import Any

try:
    from fastapi import FastAPI, HTTPException
except ImportError as exc:  # pragma: no cover - exercised by deployment setup
    raise RuntimeError("Install requirements from recommender_python/requirements.txt to run the service") from exc

from .engine import RecommendationError, recommend
from .model_loader import ModelLoadError, load_v4_model
from .tech_circles import cluster_profiles

app = FastAPI(title="MentorConnect Recommendation Service", version="1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/recommend")
def recommendation(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        version = payload.get("version", "v1")
        options = dict(payload.get("options") or {})
        if str(version).lower() == "v4":
            options["model"] = load_v4_model()
        result = recommend(
            seeker=payload.get("seeker") or {},
            candidates=payload.get("candidates") or [],
            interactions=payload.get("interactions") or [],
            achievements=payload.get("achievements") or [],
            mentorships=payload.get("mentorships") or [],
            version=version,
            options=options,
        )
        if options.get("demoEvidence"):
            result["demoEvidenceNotice"] = "Fictional demo mentoring evidence is enabled; verified records are unchanged."
        return result
    except (RecommendationError, ModelLoadError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/tech-circles/cluster")
def tech_circles_cluster(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        profiles = payload.get("profiles") or []
        seed = int(payload.get("seed", 41))
        return cluster_profiles(profiles, seed=seed)
    except (TypeError, ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
