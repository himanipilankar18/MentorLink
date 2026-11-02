import unittest

from .tech_circles import cluster_profiles, profile_document


class TechCirclesTests(unittest.TestCase):
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

    def test_empty_dataset_is_supported(self):
        result = cluster_profiles([], seed=41)
        self.assertEqual(result["profileCount"], 0)
        self.assertEqual(result["clusters"], [])


if __name__ == "__main__":
    unittest.main()
