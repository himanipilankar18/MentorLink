import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from recommender_python.model_loader import ModelLoadError, load_v4_model
from recommender_python.service import recommendation


class ModelLoadingTests(unittest.TestCase):
    def test_missing_model_is_explicit_error(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("RECOMMENDATION_MODEL_PATH", None)
            with self.assertRaises(ModelLoadError):
                load_v4_model()

    def test_invalid_extension_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.txt"
            path.write_text("not a model", encoding="utf-8")
            with self.assertRaises(ModelLoadError):
                load_v4_model(path)

    def test_loader_uses_configured_path(self):
        loaded_paths = []

        class FakeRanker:
            def load_model(self, path):
                loaded_paths.append(path)

            def predict(self, rows):
                return [0.5 for _ in rows]

        fake_xgboost = types.SimpleNamespace(XGBRanker=FakeRanker)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.json"
            path.write_text("valid-for-fake-loader-test", encoding="utf-8")
            with patch.dict(sys.modules, {"xgboost": fake_xgboost}):
                model = load_v4_model(path)
        self.assertIsInstance(model, FakeRanker)
        self.assertEqual(loaded_paths, [str(path)])

    def test_fastapi_handler_reports_missing_v4_model(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("RECOMMENDATION_MODEL_PATH", None)
            with self.assertRaises(Exception) as context:
                recommendation({"version": "v4", "seeker": {}, "candidates": []})
        self.assertIn("RECOMMENDATION_MODEL_PATH", str(context.exception))


if __name__ == "__main__":
    unittest.main()
