import sys
import unittest
import sqlite3
from pathlib import Path
from unittest.mock import patch, MagicMock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.scraper.verification import verify_search_item
from app.scraper.pipeline import process_item
from app import database as db

class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.item = {"title": "涉案虚拟货币处置公告", "url": "https://www.spp.gov.cn/a.shtml", "publish_date": "2026-08-11"}
        self.source = {"id": "spp", "type": "search", "name": "最高检", "url": "https://www.spp.gov.cn/", "article_selector": "article"}

    @patch("app.scraper.verification.requests.get")
    def test_no_rule_no_request(self, get):
        self.source.pop("article_selector")
        self.assertEqual(verify_search_item(self.item, self.source)["verification"]["status"], "needs_article_rule")
        get.assert_not_called()

    @patch("app.scraper.verification.requests.get")
    def test_foreign_domain_no_request(self, get):
        self.item["url"] = "https://evil.test/a"
        self.assertEqual(verify_search_item(self.item, self.source)["verification"]["status"], "needs_domain_review")
        get.assert_not_called()

    @patch("app.scraper.verification.requests.get")
    def test_original_date_and_body(self, get):
        response = MagicMock(status_code=200, headers={"Content-Type": "text/html"})
        response.iter_content.return_value = [('<meta name="firstpublishedtime" content="2026-07-12"><article>' + '公安机关依法处置涉案虚拟货币。' * 20 + '</article>').encode()]
        get.return_value.__enter__.return_value = response
        item = verify_search_item(self.item, self.source)
        self.assertEqual(item["publish_date"], "2026-07-12")
        self.assertEqual(item["verification"]["status"], "verified_article")
        self.assertTrue(item["verification"]["provider_date_conflict"])
        conn = sqlite3.connect(":memory:")
        conn.executescript(db.SCHEMA)
        self.assertEqual(process_item(conn, item, self.source, 0), 1)
        self.assertEqual(conn.execute("SELECT publish_date FROM items").fetchone()[0], "2026-07-12")
        conn.close()

    def test_unverified_candidate_retained_not_published(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(db.SCHEMA)
        for _ in range(2):
            self.assertEqual(process_item(conn, self.item, self.source, 0), 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM items").fetchone()[0], 0)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM search_candidates").fetchone()[0], 1)
        conn.close()

if __name__ == "__main__": unittest.main()
