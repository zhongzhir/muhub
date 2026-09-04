"""查看/生成情报日报（调试用）。
用法:
  python scripts/generate_report.py          # 今日无新增则不生成，仅打印最新报告
  python scripts/generate_report.py --force  # 强制生成一份日报"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from app import database as db
from app.report import generate_daily_report, latest_report

db.init_db()
force = "--force" in sys.argv
if force:
    r = generate_daily_report(force=True)
    print("【已生成】", (r or {}).get("title"), "新增", (r or {}).get("new_item_count"))
else:
    r = latest_report()
    if r:
        print(r["title"], "新增", r["new_item_count"], "条")
        print(r["body"])
    else:
        print("暂无日报（今日无新增，按规则不生成）")
