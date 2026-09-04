"""检查各信息源可达性与可解析性，供部署后调优选择器使用。
用法: python scripts/check_sources.py [源ID ...]
输出: 每个源 可达/超时 状态 + 解析到的条目数。
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from app.config import get_sources
from app.scraper import rss as rss_mod, web as web_mod, search as search_mod


def check(src):
    stype = src.get("type")
    url = src.get("url", "")
    name = src.get("name")
    try:
        if stype == "search":
            from app.scraper.pipeline import _source_items
            rows = _source_items(src)
            return name, f"search(有效结果 {len(rows)} 条，查询 {rows.queries_ok}/{rows.queries_planned})", "reach"
        if stype == "rss":
            rows = rss_mod.parse_feed(url)
            return name, f"rss OK {len(rows)} 条", "reach"
        if stype == "web":
            rules = {"item": src.get("item_selector", "h2 a, h3 a"), "date": src.get("date_selector")}
            rows = web_mod.crawl_list(url, rules)
            return name, f"web OK {len(rows)} 条", "reach" if rows else "parse"
        return name, "unknown type", "unknown"
    except Exception as e:  # noqa
        return name, f"FAIL: {type(e).__name__}: {str(e)[:350]}", "fail"


def main():
    srcs = get_sources().get("sources", [])
    wanted = set(sys.argv[1:])
    if wanted:
        srcs = [s for s in srcs if s["id"] in wanted]
    for s in srcs:
        name, msg, status = check(s)
        tag = {"reach": "[OK ]", "parse": "[PARSE]", "fail": "[FAIL]", "unknown": "[ -- ]"}[status]
        print(f"{tag} {name:<28} {s['type']:<8} {msg}")


if __name__ == "__main__":
    main()
