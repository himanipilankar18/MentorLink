import unittest
import types
from unittest.mock import patch

from recommender_python.engine import (
    RecommendationError,
    _achievement_progress_stars,
    _academic_socialisation,
    recommend,
    tokenize_profile_text,
)


def profile(identifier, **extra):
    value = {
        "_id": identifier,
        "department": "CSE",
        "year": 4,
        "availability": "weekdays",
        "role": "senior",
        "mentorshipIntent": "offering",
        "skills": ["javascript", "node.js"],
        "interests": ["web"],
        "bio": "Experienced JavaScript and Node.js mentor.",
        "projects": [],
    }
    value.update(extra)
    return value


class RecommendationEngineTests(unittest.TestCase):
    def setUp(self):
        self.seeker = profile(
            "seeker",
            year=2,
            role="junior",
            mentorshipIntent="seeking",
            skills=["javascript"],
            interests=["web"],
        )

    def test_v1_is_repeatable_with_same_seed(self):
        payload = {
            "seeker": self.seeker,
            "candidates": [profile("b"), profile("a")],
            "options": {"seed": 11, "now": "2026-01-01T00:00:00+00:00"},
        }
        first = recommend(**payload)
        second = recommend(**payload)
        self.assertEqual(first, second)

    def test_v20_uses_seeker_seed_and_missing_values_get_no_credit(self):
        result = recommend(
            seeker=self.seeker,
            candidates=[profile("missing", department="", year=None, availability="", role="faculty")],
            version="v2.0",
            options={"now": "2026-01-01T00:00:00+00:00"},
        )
        components = result["recommendations"][0]["scoreComponents"]
        self.assertEqual(components["departmentMatch"], 0)
        self.assertEqual(components["academicProgression"], 0)
        self.assertEqual(components["availabilityMatch"], 0)

    def test_v21_directional_need_filter(self):
        result = recommend(
            seeker={**self.seeker, "helpWanted": ["python"]},
            candidates=[profile("wrong", topicsCanHelp=["java"]), profile("right", topicsCanHelp=["python"])],
            version="v2.1",
        )
        self.assertEqual([item["id"] for item in result["recommendations"]], ["right"])

    def test_v3_directional_learning_needs_rank_expertise(self):
        result = recommend(
            seeker={**self.seeker, "skills": ["html"], "helpWanted": ["python"]},
            candidates=[
                profile("expert", skills=["python"], topicsCanHelp=["python"]),
                profile("unrelated", skills=["rust"], topicsCanHelp=["rust"]),
            ],
            version="v3",
        )
        recommendations = result["recommendations"]
        self.assertEqual(recommendations[0]["id"], "expert")
        self.assertEqual(recommendations[0]["scoreComponents"]["skillAlignment"], 100)
        self.assertGreater(
            recommendations[0]["explanation"]["contributions"]["learningNeedsCompatibility"],
            recommendations[1]["explanation"]["contributions"].get("learningNeedsCompatibility", 0),
        )

    def test_v3_aliases_equivalent_skills(self):
        result = recommend(
            seeker={**self.seeker, "skills": ["html"], "helpWanted": ["js"]},
            candidates=[profile("candidate", skills=["JavaScript"])],
            version="v3",
        )
        self.assertEqual(result["recommendations"][0]["scoreComponents"]["skillAlignment"], 100)

    def test_v3_accepted_mentorship_is_not_completed_quality(self):
        result = recommend(
            seeker=self.seeker,
            candidates=[profile("candidate")],
            interactions=[{
                "_id": "candidate",
                "totalInteractions": 2,
                "avgSatisfaction": 5,
                "verifiedCompletedSessions": 0,
            }],
            mentorships=[{
                "_id": {"mentorId": "candidate", "status": "accepted"},
                "count": 10,
            }],
            version="v3",
        )
        self.assertEqual(result["recommendations"][0]["scoreComponents"]["mentorQuality"], 60)

    def test_v3_confirmed_completed_interaction_improves_quality(self):
        result = recommend(
            seeker=self.seeker,
            candidates=[profile("candidate")],
            interactions=[{
                "_id": "candidate",
                "totalInteractions": 2,
                "avgSatisfaction": 5,
                "verifiedCompletedSessions": 2,
            }],
            version="v3",
        )
        self.assertGreater(result["recommendations"][0]["scoreComponents"]["mentorQuality"], 0)

    def test_v3_explanation_contributions_match_raw_score(self):
        result = recommend(
            seeker={**self.seeker, "helpWanted": ["python"]},
            candidates=[profile("candidate", skills=["python"])],
            version="v3",
        )
        recommendation = result["recommendations"][0]
        contribution_total = sum(recommendation["explanation"]["contributions"].values())
        self.assertAlmostEqual(contribution_total, recommendation["scoreRaw"], places=7)

    def test_v3_required_controlled_compatibility_cases(self):
        exact = recommend(
            seeker={**self.seeker, "skills": [], "helpWanted": ["python"]},
            candidates=[profile("mentor", skills=["python"])],
            version="v3",
        )["recommendations"][0]
        self.assertEqual(exact["scoreComponents"]["skillAlignment"], 100)

        unrelated = recommend(
            seeker={**self.seeker, "skills": [], "helpWanted": ["python"]},
            candidates=[profile("mentor", skills=["rust"])],
            version="v3",
        )["recommendations"][0]
        self.assertEqual(unrelated["scoreComponents"]["skillAlignment"], 0)

        partial = recommend(
            seeker={**self.seeker, "skills": [], "helpWanted": ["python", "sql"]},
            candidates=[profile("mentor", skills=["python"])],
            version="v3",
        )["recommendations"][0]
        self.assertEqual(partial["scoreComponents"]["skillAlignment"], 50)

        project_match = recommend(
            seeker={**self.seeker, "skills": [], "helpWanted": ["machine learning"]},
            candidates=[profile("mentor", skills=[], projects=[{
                "title": "Research",
                "description": "",
                "technologies": ["machine learning"],
            }])],
            version="v3",
        )["recommendations"][0]
        self.assertEqual(project_match["scoreComponents"]["skillAlignment"], 100)

        no_history = recommend(
            seeker=self.seeker,
            candidates=[profile("mentor")],
            version="v3",
        )["recommendations"][0]
        self.assertEqual(no_history["scoreComponents"]["mentorQuality"], 0)
        self.assertEqual(no_history["scoreComponents"]["activitySignal"], 0)

        verified = recommend(
            seeker=self.seeker,
            candidates=[profile("mentor")],
            interactions=[{
                "_id": "mentor",
                "totalInteractions": 2,
                "avgSatisfaction": 5,
                "verifiedCompletedSessions": 2,
            }],
            version="v3",
        )["recommendations"][0]
        self.assertGreater(verified["scoreComponents"]["mentorQuality"], 0)

        profile_view_only = recommend(
            seeker=self.seeker,
            candidates=[profile("mentor")],
            interactions=[{
                "mentorId": "mentor",
                "interactionType": "Profile View",
                "confirmationStatus": "confirmed",
            }],
            version="v3",
        )["recommendations"][0]
        self.assertEqual(profile_view_only["scoreComponents"]["activitySignal"], 0)

        unavailable = recommend(
            seeker=self.seeker,
            candidates=[profile("mentor", availability="weekends")],
            version="v3",
        )["recommendations"][0]
        self.assertEqual(unavailable["scoreComponents"]["availabilityMatch"], 60)

        ineligible = recommend(
            seeker=self.seeker,
            candidates=[profile("mentor", mentorshipIntent="seeking", year=4)],
            version="v3",
        )
        self.assertEqual(ineligible["recommendations"], [])

        missing = recommend(
            seeker={**self.seeker, "department": "", "year": None, "availability": ""},
            candidates=[profile("mentor", role="faculty", department="", year=None, availability="")],
            version="v3",
        )["recommendations"][0]
        self.assertEqual(missing["scoreComponents"]["departmentMatch"], 0)
        self.assertEqual(missing["scoreComponents"]["academicProgression"], 0)
        self.assertEqual(missing["scoreComponents"]["availabilityMatch"], 0)

    def test_v22_does_not_use_department_credit(self):
        result = recommend(
            seeker=self.seeker,
            candidates=[profile("candidate")],
            version="v2.2",
        )
        self.assertEqual(result["recommendations"][0]["scoreComponents"]["departmentMatch"], 0)

    def test_v23_returns_additive_contributions(self):
        result = recommend(seeker=self.seeker, candidates=[profile("candidate")], version="v2.3")
        self.assertEqual(result["recommendations"][0]["explanation"]["method"], "additive")

    def test_v24_requires_nmf_dependency(self):
        try:
            result = recommend(seeker=self.seeker, candidates=[profile("candidate")], version="v2.4")
        except RecommendationError as error:
            self.assertIn("scikit-learn", str(error))
        else:
            self.assertEqual(result["clustering"]["model"], "nmf")

    def test_v3_emits_exposure_contribution(self):
        result = recommend(
            seeker=self.seeker,
            candidates=[profile("candidate", maxMentees=2, exposureCount=2, learningGoal=["python"], topicsCanHelp=["python"])],
            version="v3",
        )
        self.assertIn("exposurePenalty", result["recommendations"][0]["explanation"]["contributions"])

    def test_v3_uses_verified_mentoring_evidence(self):
        baseline = recommend(
            seeker=self.seeker,
            candidates=[profile("candidate")],
            version="v3",
        )["recommendations"][0]
        evidenced = recommend(
            seeker=self.seeker,
            candidates=[profile("candidate")],
            achievements=[{
                "_id": "candidate",
                "achievementLevel": 5,
                "achievementInteractions": 80,
                "achievementMentees": 30,
                "achievementRating": 5,
            }],
            version="v3",
        )["recommendations"][0]
        self.assertGreater(evidenced["score"], baseline["score"])
        self.assertEqual(evidenced["scoreComponents"]["mentoringEvidence"], 75)
        self.assertIn("mentoringEvidence", evidenced["explanation"]["contributions"])

    def test_achievement_progress_stars_use_all_verified_requirements(self):
        self.assertEqual(
            _achievement_progress_stars({
                "achievementLevel": 1,
                "totalInteractions": 4,
                "uniqueMentees": 2,
                "resolvedInteractions": 1,
            }),
            1 + (1 / 3),
        )
        self.assertEqual(
            _achievement_progress_stars({
                "achievementLevel": 1,
                "totalInteractions": 8,
                "uniqueMentees": 3,
                "resolvedInteractions": 2,
            }),
            1 + (2 / 3),
        )

    def test_v3_recommendation_uses_progress_stars(self):
        baseline = recommend(
            seeker=self.seeker,
            candidates=[profile("candidate")],
            version="v3",
        )["recommendations"][0]
        progressing = recommend(
            seeker=self.seeker,
            candidates=[profile("candidate")],
            interactions=[{
                "_id": "candidate",
                "totalInteractions": 8,
                "uniqueMentees": 3,
                "resolvedInteractions": 3,
                "verifiedCompletedSessions": 3,
            }],
            achievements=[{
                "_id": "candidate",
                "achievementLevel": 1,
                "achievementInteractions": 3,
                "achievementMentees": 2,
            }],
            version="v3",
        )["recommendations"][0]
        self.assertGreater(
            progressing["mentorAnalytics"]["achievementProgressStars"],
            baseline["mentorAnalytics"]["achievementProgressStars"],
        )
        self.assertGreater(progressing["score"], baseline["score"])

    def test_academic_socialisation_uses_existing_chat_aggregates(self):
        baseline = _academic_socialisation({}, "2026-01-01T00:00:00+00:00")
        active = _academic_socialisation(
            {
                "sharedGroupCount": 2,
                "candidateMessageCount": 10,
                "lastChatAt": "2025-12-20T00:00:00+00:00",
            },
            "2026-01-01T00:00:00+00:00",
        )
        self.assertEqual(baseline, 0)
        self.assertGreater(active, baseline)
        self.assertLessEqual(active, 1)

    def test_v4_passes_academic_socialisation_to_model(self):
        captured = []

        class FakeModel:
            def predict(self, rows):
                captured.extend(rows)
                return [0.5 for _ in rows]

        class FakeExplainer:
            def __init__(self, model):
                self.model = model

            def shap_values(self, rows):
                return [[0.0] * len(row) for row in rows]

        with patch.dict(
            "sys.modules",
            {
                "xgboost": types.SimpleNamespace(),
                "shap": types.SimpleNamespace(TreeExplainer=FakeExplainer),
            },
        ):
            recommend(
                seeker=self.seeker,
                candidates=[profile("candidate")],
                version="v4",
                options={
                    "model": FakeModel(),
                    "now": "2026-01-01T00:00:00+00:00",
                    "academicSocialisation": {
                        "candidate": {
                            "sharedGroupCount": 1,
                            "candidateMessageCount": 2,
                            "lastChatAt": "2025-12-31T00:00:00+00:00",
                        },
                    },
                },
            )
        self.assertEqual(len(captured), 1)
        self.assertGreater(captured[0][-1], 0)

    def test_technical_tokens_and_invalid_version(self):
        self.assertEqual(
            tokenize_profile_text("C++, C#, Node.js, .NET and JavaScript!", v2=True),
            ["c++", "c#", "node.js", ".net", "and", "javascript"],
        )
        with self.assertRaises(RecommendationError):
            recommend(seeker=self.seeker, candidates=[], version="v9")


if __name__ == "__main__":
    unittest.main()
