"""每日情报简报：仅在当日有新情报时才生成报告（无新消息不报告）。"""
from datetime import datetime
from app import database as db


def _today_items(conn):
    today = datetime.now().strftime("%Y-%m-%d")
    rows = conn.execute(
        "SELECT title, url, source_name, source_category, region, institution_type, "
        "asset_types, disposal_method, amount_value, amount_currency, amount_evidence, importance, tags, analysis, publish_date "
        "FROM items WHERE substr(fetch_date,1,10)=? ORDER BY importance DESC, publish_date DESC",
        (today,),
    ).fetchall()
    return [dict(r) for r in rows]


def _fmt_amount(amt, cur, evidence=None):
    if not amt or not evidence:
        return ""
    unit = "枚" if cur == "枚" else (cur or "元")
    return f"（{amt:,.0f} {unit}）"


def generate_daily_report(force=False):
    conn = db.connect()
    try:
        items = _today_items(conn)
        if not items and not force:
            return None
        today = datetime.now().strftime("%Y-%m-%d")
        previous = conn.execute("SELECT new_item_count FROM reports WHERE report_date=? ORDER BY id DESC LIMIT 1", (today,)).fetchone()
        if previous and previous["new_item_count"] == len(items) and not force:
            return None
        conn.execute("DELETE FROM reports WHERE report_date=?", (today,))
        high = [i for i in items if i["importance"] == "high"]
        title = f"数字资产处置情报日报 · {today}"
        lines = [
            f"本期新增情报 {len(items)} 条，其中高价值信息 {len(high)} 条。",
            "",
            "—— 今日重点关注 ——",
        ]
        for i in high[:6]:
            meta = "、".join([x for x in [i["region"], i["institution_type"], i["disposal_method"]] if x])
            lines.append(
                f"• 【高价值】{i['title']}{_fmt_amount(i['amount_value'], i['amount_currency'], i.get('amount_evidence'))}"
            )
            lines.append(f"   {meta}｜来源：{i['source_name']}｜{i.get('analysis') or ''}")
            if i["url"]:
                lines.append(f"   链接：{i['url']}")
        lines.append("")
        lines.append("—— 分类概览 ——")
        by_cat = {}
        for i in items:
            by_cat[i["source_category"] or "其他"] = by_cat.get(i["source_category"] or "其他", 0) + 1
        for k, v in sorted(by_cat.items(), key=lambda x: -x[1]):
            lines.append(f"• {k}：{v} 条")
        body = "\n".join(lines)
        conn.execute(
            "INSERT INTO reports (report_date, title, body, new_item_count, created_at) VALUES (?,?,?,?,?)",
            (today, title, body, len(items), db.now_iso()),
        )
        conn.commit()
        return {"date": today, "title": title, "body": body, "new_item_count": len(items)}
    finally:
        conn.close()


def latest_report():
    conn = db.connect()
    try:
        r = conn.execute("SELECT report_date, title, body, new_item_count, created_at FROM reports ORDER BY report_date DESC, id DESC LIMIT 1").fetchone()
        return dict(r) if r else None
    finally:
        conn.close()
