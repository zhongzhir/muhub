"""驾驶舱统计聚合。"""
from datetime import datetime, timedelta
from app import database as db


def _day(dt=None):
    d = dt or datetime.now()
    return d.strftime("%Y-%m-%d")


def overview():
    conn = db.connect()
    try:
        total = conn.execute("SELECT COUNT(*) c FROM items").fetchone()["c"]
        today = conn.execute("SELECT COUNT(*) c FROM items WHERE substr(fetch_date,1,10)=?", (_day(),)).fetchone()["c"]
        week = conn.execute(
            "SELECT COUNT(*) c FROM items WHERE substr(fetch_date,1,10) >= ?",
            ((datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),),
        ).fetchone()["c"]
        high = conn.execute("SELECT COUNT(*) c FROM items WHERE importance='high'").fetchone()["c"]
        sources_total = conn.execute("SELECT COUNT(*) c FROM sources WHERE enabled=1").fetchone()["c"]
        sources_ok = conn.execute("SELECT COUNT(*) c FROM sources WHERE enabled=1 AND last_status LIKE '成功%'").fetchone()["c"]
        regions = conn.execute("SELECT COUNT(DISTINCT region) c FROM items WHERE region IS NOT NULL").fetchone()["c"]
        amount = conn.execute(
            "SELECT SUM(amount_value) s FROM items WHERE amount_currency IN ('人民币','元') AND amount_value IS NOT NULL"
        ).fetchone()["s"]
        amount_usd = conn.execute(
            "SELECT SUM(amount_value) s FROM items WHERE amount_currency='美元' AND amount_value IS NOT NULL"
        ).fetchone()["s"]
        last_report = conn.execute(
            "SELECT report_date, new_item_count, title FROM reports ORDER BY report_date DESC LIMIT 1"
        ).fetchone()
        return {
            "total_items": total,
            "new_today": today,
            "new_week": week,
            "high_value": high,
            "sources_total": sources_total,
            "sources_ok": sources_ok,
            "regions": regions,
            "amount_rmb": round(amount or 0, 2),
            "amount_usd": round(amount_usd or 0, 2),
            "last_report_date": last_report["report_date"] if last_report else None,
            "last_report_new": last_report["new_item_count"] if last_report else 0,
        }
    finally:
        conn.close()


def trend(days=30):
    conn = db.connect()
    try:
        start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        rows = conn.execute(
            "SELECT substr(COALESCE(publish_date, fetch_date),1,10) d, COUNT(*) c "
            "FROM items WHERE substr(COALESCE(publish_date, fetch_date),1,10)>=? GROUP BY d ORDER BY d",
            (start,),
        ).fetchall()
        return [{"date": r["d"], "count": r["c"]} for r in rows]
    finally:
        conn.close()


def distribution(field="institution_type"):
    if field not in {"institution_type", "source_category", "region", "asset_types", "disposal_method", "importance"}:
        raise ValueError("Unsupported distribution field")
    conn = db.connect()
    try:
        rows = conn.execute(
            f"SELECT {field} k, COUNT(*) c FROM items WHERE {field} IS NOT NULL AND {field}!='' GROUP BY {field} ORDER BY c DESC"
        ).fetchall()
        return [{"name": r["k"], "value": r["c"]} for r in rows]
    finally:
        conn.close()


def source_category_weeks(weeks=8):
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT source_category, substr(COALESCE(publish_date, fetch_date),1,10) d, COUNT(*) c "
            "FROM items WHERE substr(COALESCE(publish_date, fetch_date),1,10)>=? "
            "GROUP BY source_category, d",
            ((datetime.now() - timedelta(weeks=weeks)).strftime("%Y-%m-%d"),),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def source_health():
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT id, name, category, source_type, enabled, priority, last_scan_at, last_status, item_count, url "
            "FROM sources ORDER BY priority DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def source_rank(limit=10):
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT source_name, COUNT(*) c FROM items GROUP BY source_name ORDER BY c DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [{"name": r["source_name"], "value": r["c"]} for r in rows]
    finally:
        conn.close()


def high_value(limit=8):
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT id, title, url, region, institution, institution_type, asset_types, disposal_method, "
            "amount_value, amount_currency, importance, publish_date, tags, source_name "
            "FROM items WHERE importance='high' ORDER BY COALESCE(amount_value,0) DESC, publish_date DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
