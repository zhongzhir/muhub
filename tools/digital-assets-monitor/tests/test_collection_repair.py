"""Regression tests for the production zero-result diagnosis."""
import sys
import unittest
import sqlite3
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.scraper import search, web, pipeline
from app import database as db

GOOD = {"title": "DOJ cryptocurrency forfeiture case", "summary": "Bitcoin seizure", "url": "https://www.justice.gov/opa/pr/example"}
JUNK = {"title": "Hatta Resorts hotel", "summary": "Book a holiday", "url": "https://example.org/hotel"}

class CollectionRepairTests(unittest.TestCase):
    def test_irrelevant_engine_does_not_stop_fallback(self):
        with patch.object(search, "_run_engine", side_effect=[[JUNK], [GOOD]]) as fetch:
            self.assertEqual(search.run_search("DOJ cryptocurrency forfeiture"), [GOOD])
            self.assertEqual(fetch.call_count, 2)
    def test_all_irrelevant_is_not_success(self):
        with patch.object(search, "_run_engine", return_value=[JUNK]):
            self.assertIsNone(search.run_search("涉案虚拟货币 处置"))
    def test_domain_mismatch_does_not_stop_fallback(self):
        wrong = dict(GOOD, url="https://justice.gov.evil.example/press")
        with patch.object(search, "_run_engine", side_effect=[[wrong], [GOOD]]) as fetch:
            self.assertEqual(search.run_search("site:justice.gov bitcoin seizure"), [GOOD])
            self.assertEqual(fetch.call_count, 2)
    def test_partial_search_exposed(self):
        with patch.object(search, "run_search", side_effect=[[GOOD], None]):
            rows = search.run_all_queries(["one", "two"], workers=1)
        self.assertEqual((len(rows), rows.queries_ok, rows.queries_failed), (1, 1, 1))
    def test_named_source_uses_site_queries(self):
        with patch.object(search, "run_all_queries", return_value=[]) as query:
            pipeline._source_items({"id":"intl-doj", "type":"search", "url":"https://www.justice.gov/news", "category":"国际"})
        self.assertTrue(all(q.startswith("site:justice.gov ") for q in query.call_args.kwargs["queries"]))
    def test_global_search_attributes_publisher_host(self):
        conn=sqlite3.connect(":memory:");conn.row_factory=sqlite3.Row;conn.executescript(db.SCHEMA)
        pipeline.process_item(conn, GOOD, {"id":"search-backfill", "type":"search", "name":"全网关键词回溯", "category":"综合检索"}, 0)
        self.assertEqual(conn.execute("SELECT source_name FROM items").fetchone()[0], "www.justice.gov")
        conn.close()
    def test_list_title_and_date_are_separate(self):
        page='<li><a href="/spp/xwfbh/wsfbt/202609/t20260904_1.shtml">涉案虚拟货币处置工作情况</a><span>2026年09月04日</span></li>'
        response=SimpleNamespace(content=page.encode(),url="https://www.spp.gov.cn/xwfbh/wsfbt/")
        with patch.object(web, "fetch", return_value=response):
            rows=web.crawl_list(response.url,{"item":"li", "date":"span"})
        self.assertEqual(rows[0]["publish_date"],"2026-09-04")
        self.assertEqual(rows[0]["title"],"涉案虚拟货币处置工作情况")
    def test_ddg_preserves_encoded_target_query(self):
        page='<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fitem%3Fa%3D1%26b%3D2&amp;rut=xyz">Bitcoin seizure report</a></div>'
        self.assertEqual(search.parse_ddg(page)[0]["url"],"https://example.org/item?a=1&b=2")

if __name__ == "__main__": unittest.main()
