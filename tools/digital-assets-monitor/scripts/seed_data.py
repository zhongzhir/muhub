"""补充/重置种子数据。
用法: python scripts/seed_data.py         # 追加缺失的种子
      python scripts/seed_data.py --reset # 清空并重建"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from app import database as db
from app.seed import seed

db.init_db()
conn = db.connect()
try:
    if "--reset" in sys.argv:
        conn.execute("DELETE FROM items")
        conn.commit()
        print("已清空 items")
    conn.execute("BEGIN")
    n = seed(conn)
    conn.commit()
    total = conn.execute("SELECT COUNT(*) c FROM items").fetchone()["c"]
    print(f"本次写入种子 {n} 条，当前共 {total} 条")
finally:
    conn.close()
