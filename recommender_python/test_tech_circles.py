import unittest

from .skill_features import audit_skills, normalize_skill_values
from .tech_circles import cluster_profiles, profile_document


class TechCirclesTests(unittest.TestCase):
    def test_normalizes_structured_skill_aliases_without_mutating_input(self):
        source = ["JS", "ReactJS", "Node", "ML", "C plus plus", "ReactJS"]
        self.assertEqual(
            normalize_skill_values(source),
            ["javascript", "react", "node.js", "machine learning", "c++"],
        )
        self.assertEqual(source, ["JS", "ReactJS", "Node", "ML", "C plus plus", "ReactJS"])

    def test_feature_audit_reports_real_skill_coverage(self):
        audit = audit_skills([
            {"skills": ["React", "JavaScript"]},
            {"skills": []},
            {"skills": None},
        ])
        self.assertEqual(audit["totalUsers"], 3)
        self.assertEqual(audit["usersWithUsableSkills"], 1)
        self.assertEqual(audit["usersMissingSkills"], 2)
        self.assertEqual(audit["uniqueNormalizedSkills"], 2)

    def test_normalizes_aliases_and_preserves_technical_terms(self):
        document = profile_document({
            "skills": ["C++", "C#", "Node.js", ".NET", "JavaScript"],
            "interests": ["AI, and web development"],
        })
        self.assertIn("c++", document)
        self.assertIn("c#", document)
        self.assertIn("node.js", document)
        self.assertIn(".net", document)
        self.assertIn("javascript", document)

    def test_skills_drive_non_zero_domain_relevance(self):
        profiles = [
            {"_id": "web", "skills": ["ReactJS", "JS", "HTML", "CSS", "Node"]},
            {"_id": "web2", "skills": ["Angular", "TypeScript", "CSS"]},
            {"_id": "ml", "skills": ["Python", "NLP", "TensorFlow", "PyTorch"]},
            {"_id": "ml2", "skills": ["Python", "Machine Learning", "scikit-learn"]},
            {"_id": "design", "skills": ["Figma", "Wireframing", "Prototyping"]},
            {"_id": "design2", "skills": ["Figma", "UI", "UX"]},
        ]
        result = cluster_profiles(profiles, seed=41)
        ranked = {
            member["userId"]: member
            for cluster in result["clusters"]
            for member in cluster["rankedMembers"]
        }
        self.assertGreater(ranked["web"]["score"], 0)
        self.assertGreater(ranked["ml"]["score"], 0)
        self.assertIn("node.js", ranked["web"]["evidence"])
        self.assertIn("tensorflow", ranked["ml"]["evidence"])

    def test_generic_project_text_does_not_replace_missing_skills(self):
        result = cluster_profiles([
            {
                "_id": "generic",
                "skills": [],
                "projects": [{"title": "Project Profile", "description": "MentorLink demo project exploring peer learning"}],
            },
            {"_id": "web", "skills": ["HTML", "CSS", "JavaScript"]},
            {"_id": "ml", "skills": ["Python", "TensorFlow", "NLP"]},
        ], seed=41)
        self.assertNotIn("generic", {
            member["userId"]
            for cluster in result["clusters"]
            for member in cluster["rankedMembers"]
        })

    def test_missing_profile_data_is_safe(self):
        self.assertEqual(profile_document({"skills": None, "projects": None}), "")
        result = cluster_profiles([{"_id": "1", "skills": None}], seed=41)
        self.assertEqual(result["profileCount"], 1)
        self.assertEqual(len(result["clusters"]), 1)

    def test_repeated_runs_are_deterministic(self):
        profiles = [
            {"_id": "1", "skills": ["Python", "TensorFlow"]},
            {"_id": "2", "skills": ["JavaScript", "React"]},
            {"_id": "3", "skills": ["Python", "Pandas"]},
            {"_id": "4", "skills": ["React", "Node.js"]},
        ]
        first = cluster_profiles(profiles, seed=41)
        second = cluster_profiles(profiles, seed=41)
        self.assertEqual(first, second)
        self.assertEqual({entry["userId"] for entry in first["assignments"]}, {"1", "2", "3", "4"})
        self.assertGreaterEqual(len(first["metrics"]["testedK"]), 1)
        self.assertIn("inertia", first["metrics"])
        self.assertIn("clusterSizes", first["metrics"])

    def test_domain_membership_can_be_soft(self):
        profiles = [
            {"_id": "web", "skills": ["JavaScript", "React", "Node.js"]},
            {"_id": "ml", "skills": ["Python", "TensorFlow", "Pandas"]},
            {"_id": "hybrid", "skills": ["React", "Python", "TensorFlow", "Node.js"]},
            {"_id": "data", "skills": ["Python", "Pandas", "SQL"]},
            {"_id": "cloud", "skills": ["Docker", "Kubernetes", "Node.js"]},
        ]
        result = cluster_profiles(profiles, seed=41)
        memberships = [entry for entry in result["assignments"] if entry["userId"] == "hybrid"]
        self.assertGreaterEqual(len(memberships), 1)
        self.assertTrue(all(0 <= entry["affinity"] <= 1 for entry in memberships))

    def test_empty_dataset_is_supported(self):
        result = cluster_profiles([], seed=41)
        self.assertEqual(result["profileCount"], 0)
        self.assertEqual(result["clusters"], [])


if __name__ == "__main__":
    unittest.main()
