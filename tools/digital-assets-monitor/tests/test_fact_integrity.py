"""事实完整性、数量证据与驾驶舱下钻回归测试。"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("SESSION_SECRET", "isolated-test-secret-at-least-32-characters")
os.environ.setdefault("INVITE_CODES", "isolated-test-code")

from app import database as db

_temp = tempfile.TemporaryDirectory()
db.DB_PATH = Path(_temp.name) / "fact.db"
db.init_db()

from fastapi.testclient import TestClient
from app.main import app
from app import security
from app.analysis import classify, extract
from app.analysis.structure import structure_item
from app.scraper.pipeline import process_item
from scripts.repair_fact_integrity import (
    URL_CROSS_BORDER,
    URL_PROCEDURE,
    repair_database,
)

ARTICLE_1 = (
    "反腐败跨境追赃法理基础的双重意蕴。2026年立法动态与课题年度研究指出，"
    "虚拟货币跨境转移给没收、资产返还与分享机制带来程序挑战。"
    "如果在法院审理，境外持牌交易所也可能被讨论。作者单位在北京。"
)
ARTICLE_2 = (
    "完善程序机制提升刑事涉案财物处置质效。《刑事诉讼法》第144条围绕查封、扣押、冻结制度。"
    "应充分发挥检察监督职能，并探索利用区块链进行涉案虚拟财产全流程存证。"
    "文章讨论范围认定与监督救济，不是一次具体扣押。"
)


class AmountEvidenceTests(unittest.TestCase):
    def test_year_is_not_token_count(self):
        self.assertEqual(extract.extract_amount("2026年立法动态讨论虚拟货币跨境追赃"), (None, None, None))

    def test_article_number_is_not_token_count(self):
        self.assertEqual(
            extract.extract_amount("刑事诉讼法第144条完善查封扣押冻结与虚拟货币处置"),
            (None, None, None),
        )

    def test_explicit_coin_counts(self):
        self.assertEqual(extract.extract_amount("缴获2026枚比特币并依法处置")[0:2], (2026.0, "枚"))
        self.assertIn("2026", extract.extract_amount("缴获2026枚比特币并依法处置")[2])
        self.assertIn("枚", extract.extract_amount("缴获2026枚比特币并依法处置")[2])
        self.assertIn("比特币", extract.extract_amount("缴获2026枚比特币并依法处置")[2])
        self.assertEqual(extract.extract_amount("扣押 144 枚 USDT")[0:2], (144.0, "枚"))
        self.assertEqual(extract.extract_amount("查获2.5万枚以太币")[0:2], (25000.0, "枚"))
        self.assertEqual(extract.extract_amount("platform seized 100 BTC last week")[0:2], (100.0, "枚"))

    def test_distant_keyword_does_not_capture_first_number(self):
        self.assertEqual(
            extract.extract_amount("2026年发布。后文才提到虚拟货币和比特币。"),
            (None, None, None),
        )


class PolicyArticleTests(unittest.TestCase):
    def test_research_article_has_no_fake_event(self):
        fields = structure_item(
            "反腐败跨境追赃法理基础的双重意蕴",
            ARTICLE_1,
            url=URL_CROSS_BORDER,
            source_name="最高人民检察院",
            source_category="政策",
        )
        self.assertEqual(fields["information_nature"], "理论研究")
        self.assertIsNone(fields["amount_value"])
        self.assertIsNone(fields["institution"])
        self.assertIsNone(fields["institution_type"])
        self.assertIsNone(fields["region"])
        self.assertIsNone(fields["disposal_method"])
        self.assertEqual(fields["asset_types"], ["虚拟货币"])
        self.assertIn("信息性质", fields["analysis"])
        self.assertIn("对实际工作的价值", fields["analysis"])
        self.assertIn("证据边界", fields["analysis"])
        self.assertNotIn("2026枚", fields["analysis"])

    def test_procedure_article_has_no_fake_event(self):
        fields = structure_item(
            "完善程序机制提升刑事涉案财物处置质效",
            ARTICLE_2,
            url=URL_PROCEDURE,
            source_name="最高人民检察院",
        )
        self.assertEqual(fields["information_nature"], "政策或制度指导")
        self.assertIsNone(fields["amount_value"])
        self.assertIsNone(fields["institution"])
        self.assertNotEqual(fields["institution"], "充分发挥检察")
        self.assertIsNone(fields["disposal_method"])
        self.assertEqual(fields["asset_types"], ["虚拟货币"])
        self.assertIn("区块链", fields["analysis"])
        self.assertIn("未披露", fields["analysis"])

    def test_generic_virtual_currency_label(self):
        self.assertEqual(classify.classify_asset_types("讨论虚拟货币处置制度"), ["虚拟货币"])


class PipelineAndUiTests(unittest.TestCase):
    def setUp(self):
        db.init_db()
        conn = db.connect()
        conn.execute("DELETE FROM items")
        conn.commit()
        conn.close()

    def test_pipeline_does_not_store_year_as_amount(self):
        conn = db.connect()
        n = process_item(
            conn,
            {
                "title": "反腐败跨境追赃法理基础的双重意蕴",
                "url": URL_CROSS_BORDER,
                "summary": ARTICLE_1,
                "publish_date": "2026-09-03",
            },
            {"name": "最高人民检察院", "category": "政策", "type": "web"},
            0,
        )
        conn.commit()
        self.assertEqual(n, 1)
        row = conn.execute("SELECT * FROM items WHERE url=?", (URL_CROSS_BORDER,)).fetchone()
        self.assertIsNone(row["amount_value"])
        self.assertIsNone(row["amount_currency"])
        self.assertIsNone(row["amount_evidence"])
        self.assertFalse(row["institution"])
        self.assertFalse(row["region"])
        self.assertFalse(row["disposal_method"])
        conn.close()

    def test_pipeline_stores_evidenced_count(self):
        conn = db.connect()
        process_item(
            conn,
            {
                "title": "某市公安局扣押2026枚比特币并依法处置",
                "url": "https://example.com/btc-count",
                "summary": "某市公安局查获2026枚比特币，经香港持牌交易所变现",
                "publish_date": "2026-09-01",
            },
            {"name": "测试源", "category": "公安机关", "type": "web"},
            0,
        )
        conn.commit()
        row = conn.execute("SELECT * FROM items WHERE url=?", ("https://example.com/btc-count",)).fetchone()
        self.assertEqual(row["amount_value"], 2026)
        self.assertEqual(row["amount_currency"], "枚")
        self.assertIn("2026", row["amount_evidence"])
        self.assertIn("比特币", row["amount_evidence"])
        conn.close()

    def test_repair_script_is_idempotent(self):
        conn = db.connect()
        conn.execute(
            """INSERT INTO items (fingerprint,title,url,source_name,source_category,source_type,publish_date,fetch_date,
               content,summary,analysis,region,institution,institution_type,asset_types,disposal_method,
               amount_value,amount_currency,importance,tags,is_processed,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                "fp-a", "反腐败跨境追赃法理基础的双重意蕴", URL_CROSS_BORDER, "最高人民检察院", "政策", "web",
                "2026-09-03", "2026-09-03", ARTICLE_1, ARTICLE_1[:40], "错误分析", "北京", "人民法院",
                "人民法院", "其他代币", "境外持牌交易所变现", 2026, "枚", "high", "错误", 1, db.now_iso(), db.now_iso(),
            ),
        )
        conn.execute(
            """INSERT INTO items (fingerprint,title,url,source_name,source_category,source_type,publish_date,fetch_date,
               content,summary,analysis,region,institution,institution_type,asset_types,disposal_method,
               amount_value,amount_currency,importance,tags,is_processed,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                "fp-b", "完善程序机制提升刑事涉案财物处置质效", URL_PROCEDURE, "最高人民检察院", "政策", "web",
                "2026-08-19", "2026-08-19", ARTICLE_2, ARTICLE_2[:40], "错误分析", None, "充分发挥检察",
                "人民检察院", "其他代币", "涉案管控/扣押", 144, "枚", "medium", "错误", 1, db.now_iso(), db.now_iso(),
            ),
        )
        conn.commit()
        conn.close()
        preview = repair_database(db.DB_PATH, apply=False)
        self.assertEqual(len(preview["items"]), 2)
        self.assertTrue(any(item["changes"] for item in preview["items"]))
        first = repair_database(db.DB_PATH, apply=True)
        self.assertTrue(first["backup"])
        conn = db.connect()
        a = conn.execute("SELECT * FROM items WHERE url=?", (URL_CROSS_BORDER,)).fetchone()
        b = conn.execute("SELECT * FROM items WHERE url=?", (URL_PROCEDURE,)).fetchone()
        self.assertEqual(conn.execute("SELECT COUNT(*) c FROM items").fetchone()["c"], 2)
        conn.close()
        self.assertIsNone(a["amount_value"])
        self.assertIsNone(b["amount_value"])
        self.assertIsNone(a["institution"])
        self.assertIsNone(b["institution"])
        self.assertEqual(a["information_nature"], "理论研究")
        self.assertEqual(b["information_nature"], "政策或制度指导")
        self.assertIn("跨境追赃法理", a["analysis"])
        self.assertIn("区块链", b["analysis"])
        second = repair_database(db.DB_PATH, apply=True)
        self.assertTrue(all(not item["changes"] for item in second["items"]))

    def test_frontend_and_api_contract(self):
        root = Path(__file__).resolve().parents[1]
        html = (root / "static" / "index.html").read_text(encoding="utf-8")
        js = (root / "static" / "js" / "app.js").read_text(encoding="utf-8")
        css = (root / "static" / "css" / "app.css").read_text(encoding="utf-8")
        self.assertIn("latestIntel", html)
        self.assertIn("查看全部情报", html)
        self.assertIn("noopener noreferrer", js)
        self.assertIn("goItems", js)
        self.assertIn("fetch_from", js)
        self.assertIn("处置价值分析", js)
        self.assertNotIn('row("摘要"', js)
        self.assertNotIn("content).slice(0, 400)", js)
        self.assertIn("url-break", css)
        self.assertIn("word-break:break-all", css)
        client = TestClient(app)
        client.headers["x-access-token"] = security.create_token()
        conn = db.connect()
        process_item(
            conn,
            {
                "title": "某市公安局扣押2026枚比特币并依法处置",
                "url": "https://example.com/shown",
                "summary": "某市公安局查获2026枚比特币，经香港持牌交易所变现",
                "publish_date": "2026-09-01",
            },
            {"name": "测试源", "category": "公安机关", "type": "web"},
            0,
        )
        process_item(
            conn,
            {
                "title": "反腐败跨境追赃法理基础的双重意蕴",
                "url": URL_CROSS_BORDER,
                "summary": ARTICLE_1,
                "publish_date": "2026-09-03",
            },
            {"name": "最高人民检察院", "category": "政策", "type": "web"},
            0,
        )
        conn.commit()
        conn.close()
        items = client.get("/api/items?page=1&page_size=10").json()["items"]
        self.assertTrue(any(i["url"] == "https://example.com/shown" for i in items))
        shown = next(i for i in items if i["url"] == "https://example.com/shown")
        policy = next(i for i in items if i["url"] == URL_CROSS_BORDER)
        self.assertEqual(shown["amount_value"], 2026)
        self.assertTrue(shown["amount_evidence"])
        self.assertIsNone(policy["amount_value"])
        high = client.get("/api/items", params={"importance": "high"}).json()
        self.assertTrue(all(i["importance"] == "high" for i in high["items"]))
        today = client.get("/api/items", params={"fetch_from": "2099-01-01", "fetch_to": "2099-01-01"}).json()
        self.assertEqual(today["total"], 0)
        detail = client.get(f"/api/items/{policy['id']}").json()
        self.assertNotIn("摘要", detail.get("analysis") or "")
        self.assertIn("信息性质", detail["analysis"])
        self.assertEqual(detail["url"], URL_CROSS_BORDER)


if __name__ == "__main__":
    unittest.main()
