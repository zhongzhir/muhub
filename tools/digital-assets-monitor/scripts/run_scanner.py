"""手动/定时触发一次扫描（供 cron 或手动调用）。
用法: python scripts/run_scanner.py"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from app import database as db
from app.scraper.pipeline import run_scan
from app.report import generate_daily_report
import json

db.init_db()
res = run_scan()
report = generate_daily_report()
print(json.dumps(res, ensure_ascii=False))
if report:
    print("已生成日报:", report["title"], "新增", report["new_item_count"], "条")
else:
    print("无新增情报，不生成报告")
