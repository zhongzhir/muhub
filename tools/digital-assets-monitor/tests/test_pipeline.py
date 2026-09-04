"""流水线单元测试：验证相关度把关与去重。"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import database as db
from app.scraper.pipeline import process_item, make_fingerprint
from app.analysis import classify

# Tests always use a temporary database, never the live data directory.
import tempfile
from pathlib import Path
_test_dir = tempfile.TemporaryDirectory()
db.DB_PATH = Path(_test_dir.name) / "monitor.db"
db.init_db()


def test_relevance():
    assert classify.is_relevant("某市公安局处置涉案虚拟货币并缴国库") is True
    assert classify.is_relevant("比特币价格突破新高") is False  # 行情新闻不是处置情报
    assert classify.is_relevant("OpenAI 发布最新大模型") is False
    assert classify.is_relevant("豆包日活超两亿") is False
    assert classify.is_relevant("DOJ cryptocurrency forfeiture case") is True


def test_process_item_filters_junk():
    conn = db.connect()
    src = {"name": "测试源", "category": "媒体", "type": "web"}
    junk = {"title": "OpenAI发布地球最强大模型", "url": "https://x.test/1", "summary": "人工智能新模型亮相", "publish_date": None}
    rel = {"title": "某市公安局涉案虚拟货币处置 经香港持牌交易所变现", "url": "https://x.test/2", "summary": "公安 处置 虚拟货币 结汇", "publish_date": "2026-08-01"}
    n = process_item(conn, junk, src, 0)
    assert n == 0, "无关条目应被过滤"
    n = process_item(conn, rel, src, 0)
    assert n == 1, "相关条目应入库"
    # 去重
    n2 = process_item(conn, rel, src, n)
    assert n2 == 1, "重复条目不应再入库"
    conn.commit()
    total = conn.execute("SELECT COUNT(*) c FROM items").fetchone()["c"]
    assert total == 1
    row = conn.execute("SELECT * FROM items").fetchone()
    assert row["institution_type"] == "公安机关"
    assert row["region"] in ("香港", "")  # 文本提及香港持牌所，可能判定为香港
    assert "境外持牌交易所变现" in (row["disposal_method"] or "")
    assert row["importance"] in ("medium", "high", "low")
    conn.close()


def test_region():
    assert classify.classify_region("北京市顺义公安分局") == "北京"
    assert classify.classify_region("上海市宝山区法院") == "上海"
    assert classify.classify_region("温州市公安局联合法院") == "温州"
    assert classify.classify_region("OpenAI 发布") is None


if __name__ == "__main__":
    test_relevance()
    test_process_item_filters_junk()
    test_region()
    print("PIPELINE TESTS OK")
