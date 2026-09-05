"""Frontend parse check: Python tests must not pass if app.js cannot start."""
import shutil
import subprocess
import unittest
from pathlib import Path

JS = Path(__file__).resolve().parents[1] / "static" / "js" / "app.js"


class FrontendJsTests(unittest.TestCase):
    def test_app_js_parses_with_node(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "node is required: run `node --check static/js/app.js`")
        completed = subprocess.run(
            [node, "--check", str(JS)],
            capture_output=True,
            text=True,
            cwd=str(JS.parent.parent),
        )
        self.assertEqual(completed.returncode, 0, completed.stderr or completed.stdout)

    def test_render_helpers_are_complete(self):
        text = JS.read_text(encoding="utf-8")
        self.assertIn("function renderRose(c, data)", text)
        self.assertIn("function renderBar(c, data)", text)
        self.assertIn("rows.map((d, i) => ({", text)
        self.assertNotIn("rows.map((d, i) => d.value)", text)
        self.assertIn('closest("a, button")', text)
