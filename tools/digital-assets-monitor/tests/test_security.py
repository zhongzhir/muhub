"""Regression checks; all writes target a temporary database."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["SESSION_SECRET"] = "isolated-test-secret-at-least-32-characters"
os.environ["INVITE_CODES"] = "isolated-test-code"
from app import database as db
_temp = tempfile.TemporaryDirectory()
db.DB_PATH = Path(_temp.name) / "test.db"
from app.main import app
from fastapi.testclient import TestClient
from app import security, scheduler
from app.analysis import stats, classify
from app.scraper import pipeline, rss, search
from app.report import generate_daily_report

class RegressionTests(unittest.TestCase):
    def setUp(self):
        db.init_db()
        self.c = TestClient(app)
        self.c.headers["x-access-token"] = security.create_token()
    def test_auth_required(self):
        self.assertEqual(TestClient(app).get("/api/items").status_code, 401)
    def test_default_secret_rejected(self):
        with patch.dict(os.environ, {"SESSION_SECRET": "CHANGE_ME_generate_a_long_random_string_in_prod"}):
            with self.assertRaises(RuntimeError): security.validate_config()
    def test_malformed_tokens(self):
        for token in ["bad", "x:非ASCII", "t:no:" + security._sign("t:no")]:
            self.assertFalse(security.verify_token(token))
    def test_sql_field_injection(self):
        self.assertEqual(self.c.get("/api/distribution", params={"field":"(SELECT sql FROM sqlite_master)"}).status_code,422)
    def test_pagination_limits(self):
        for query in ["page_size=-1", "page=0", "page_size=100000"]:
            self.assertEqual(self.c.get("/api/items?"+query).status_code,422)
    def test_unsafe_link_rejected(self):
        self.assertEqual(self.c.post("/api/items",json={"title":"test", "url":"javascript:alert(1)"}).status_code,422)
    def test_login_rate_limit(self):
        from app.api.routes import _login_attempts
        _login_attempts.clear()
        for _ in range(10): self.c.post("/api/auth",json={"code":"wrong"})
        self.assertEqual(self.c.post("/api/auth",json={"code":"wrong"}).status_code,429)
        _login_attempts.clear()
    def test_scan_conflict(self):
        scheduler._job_lock.acquire()
        try: self.assertEqual(self.c.post("/api/scan").status_code,409)
        finally: scheduler._job_lock.release()
    def test_failed_search_not_success(self):
        with patch.object(search, "run_search", return_value=None):
            with self.assertRaises(Exception): search.run_all_queries(["test"])
    def test_invalid_feed_not_success(self):
        from types import SimpleNamespace
        with patch.object(rss, "fetch", return_value=SimpleNamespace(content=b"<html>blocked</html>")):
            with self.assertRaises(Exception): rss.parse_feed("https://example.com")
    def test_relevance(self):
        self.assertFalse(classify.is_relevant("法院拍卖二手汽车"))
        self.assertFalse(classify.is_relevant("比特币价格上涨"))
        self.assertTrue(classify.is_relevant("DOJ cryptocurrency forfeiture case"))
    def test_currency_and_report_idempotence(self):
        with db.get_db(write=True) as conn:
            conn.execute("DELETE FROM items")
            conn.execute("DELETE FROM reports")
            for title, currency in [("人民币涉案虚拟货币处置", "人民币"),("美元涉案虚拟货币处置", "美元")]:
                pipeline.process_item(conn,{"title":title,"url":"https://example.com/"+currency},{"name":"test","category":"测试","type":"manual"},0)
                conn.execute(
                    "UPDATE items SET amount_value=100,amount_currency=?,amount_evidence=? WHERE title=?",
                    (currency, f"100{currency}涉案虚拟货币", title),
                )
        self.assertEqual(stats.overview()["amount_rmb"],100)
        self.assertEqual(stats.overview()["amount_usd"],100)
        self.assertIsNotNone(generate_daily_report())
        self.assertIsNone(generate_daily_report())

if __name__ == "__main__": unittest.main()
