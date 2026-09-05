"""REST API 路由。"""
from fastapi import APIRouter, Depends, Query, Request, Body
from pydantic import BaseModel, Field
from typing import Optional, Literal
from fastapi import HTTPException
from pydantic import field_validator
from urllib.parse import urlparse
import threading
import time

_login_attempts = {}
_login_lock = threading.Lock()

from app import database as db
from app import scheduler
from app.analysis import stats, classify
from app.config import get_keywords, get_settings
from app.report import latest_report
from app.security import valid_invite, create_token, require_auth


def _public_item(row):
    if row is None:
        return None
    d = dict(row)
    if not (d.get("amount_evidence") or "").strip():
        d["amount_value"] = None
        d["amount_currency"] = None
        d["amount_evidence"] = None
    return d

router = APIRouter(prefix="/api")


class LoginIn(BaseModel):
    code: str


class ItemManual(BaseModel):
    title: str = Field(min_length=1, max_length=1000)
    url: Optional[str] = None
    source_name: Optional[str] = "手工录入"
    source_category: Optional[str] = "其他"
    publish_date: Optional[str] = None
    summary: Optional[str] = None
    region: Optional[str] = None
    institution: Optional[str] = None
    institution_type: Optional[str] = None
    asset_types: Optional[str] = None
    disposal_method: Optional[str] = None
    amount_value: Optional[float] = None
    amount_currency: Optional[str] = None


    @field_validator("url")
    @classmethod
    def safe_url(cls, value):
        if value and (urlparse(value).scheme not in ("http", "https") or not urlparse(value).hostname):
            raise ValueError("URL must use http or https")
        return value


@router.post("/auth")
def login(data: LoginIn, request: Request):
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _login_lock:
        for ip in list(_login_attempts):
            if now - _login_attempts[ip][0] > 300:
                del _login_attempts[ip]
        started, count = _login_attempts.get(key, (now, 0))
        if count >= 10:
            raise HTTPException(429, "尝试次数过多，请五分钟后重试")
        _login_attempts[key] = (started, count + 1)
    if not valid_invite(data.code):
        return {"ok": False, "message": "邀请码无效"}
    return {"ok": True, "token": create_token()}


@router.get("/meta")
def meta():
    kw = get_keywords()
    regions = sorted(set(classify._REGIONS))
    return {
        "app_name": get_settings().get("app_name"),
        "version": get_settings().get("version"),
        "institution_types": list(kw.get("institution_types", {}).keys()),
        "asset_types": list(kw.get("asset_types", {}).keys()),
        "disposal_methods": list(kw.get("disposal_methods", {}).keys()),
        "importance": ["high", "medium", "low"],
        "source_categories": ["公安", "法院", "纪委监委", "人民检察", "财政", "产权交易所", "招投标", "媒体", "行业媒体", "国际", "政策", "综合检索", "其他"],
        "regions": regions,
    }


@router.get("/overview", dependencies=[Depends(require_auth)])
def overview():
    return stats.overview()


@router.get("/trend", dependencies=[Depends(require_auth)])
def trend(days: int = Query(30, ge=1, le=366)):
    return stats.trend(days)


@router.get("/distribution", dependencies=[Depends(require_auth)])
def distribution(field: Literal["institution_type", "source_category", "region", "asset_types", "disposal_method", "importance"] = Query("institution_type")):
    return stats.distribution(field)


@router.get("/heatmap", dependencies=[Depends(require_auth)])
def heatmap(weeks: int = Query(8, ge=1, le=100)):
    return stats.source_category_weeks(weeks)


@router.get("/sources", dependencies=[Depends(require_auth)])
def sources():
    return stats.source_health()


@router.get("/coverage", dependencies=[Depends(require_auth)])
def coverage():
    from app.registry import coverage_summary
    return coverage_summary()


@router.get("/source_rank", dependencies=[Depends(require_auth)])
def source_rank(limit: int = Query(10, ge=1, le=100)):
    return stats.source_rank(limit)


@router.get("/high_value", dependencies=[Depends(require_auth)])
def high_value(limit: int = Query(8, ge=1, le=100)):
    return [_public_item(r) for r in stats.high_value(limit)]


@router.get("/report/latest", dependencies=[Depends(require_auth)])
def report():
    return latest_report()


@router.get("/items", dependencies=[Depends(require_auth)])
def items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    institution_type: Optional[str] = None,
    region: Optional[str] = None,
    asset_types: Optional[str] = None,
    importance: Optional[str] = None,
    source_category: Optional[str] = None,
    disposal_method: Optional[str] = None,
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    fetch_from: Optional[str] = None,
    fetch_to: Optional[str] = None,
    source_name: Optional[str] = None,
):
    conn = db.connect()
    try:
        where = "WHERE 1=1"
        params = []
        if institution_type and institution_type != "全部":
            where += " AND institution_type=?"; params.append(institution_type)
        if region and region != "全部":
            where += " AND region=?"; params.append(region)
        if asset_types and asset_types != "全部":
            where += " AND asset_types LIKE ?"; params.append(f"%{asset_types}%")
        if importance and importance != "全部":
            where += " AND importance=?"; params.append(importance)
        if source_category and source_category != "全部":
            where += " AND source_category=?"; params.append(source_category)
        if disposal_method and disposal_method != "全部":
            where += " AND disposal_method=?"; params.append(disposal_method)
        if q:
            where += " AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)"
            qq = f"%{q}%"; params += [qq, qq, qq]
        if date_from:
            where += " AND COALESCE(publish_date,fetch_date)>=?"; params.append(date_from)
        if date_to:
            where += " AND COALESCE(publish_date,fetch_date)<=?"; params.append(date_to)
        if fetch_from:
            where += " AND substr(fetch_date,1,10)>=?"; params.append(fetch_from)
        if fetch_to:
            where += " AND substr(fetch_date,1,10)<=?"; params.append(fetch_to)
        if source_name and source_name != "全部":
            where += " AND source_name=?"; params.append(source_name)
        total = conn.execute(f"SELECT COUNT(*) c FROM items {where}", params).fetchone()["c"]
        offset = (page - 1) * page_size
        rows = conn.execute(
            f"SELECT id,title,url,source_name,source_category,region,institution,institution_type,"
            f"asset_types,disposal_method,amount_value,amount_currency,amount_evidence,information_nature,"
            f"importance,tags,publish_date,fetch_date,analysis "
            f"FROM items {where} ORDER BY COALESCE(publish_date,fetch_date) DESC, id DESC LIMIT ? OFFSET ?",
            params + [page_size, offset],
        ).fetchall()
        return {"total": total, "page": page, "page_size": page_size, "items": [_public_item(r) for r in rows]}
    finally:
        conn.close()


@router.get("/items/{item_id}", dependencies=[Depends(require_auth)])
def item_detail(item_id: int):
    conn = db.connect()
    try:
        r = conn.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
        return _public_item(r) if r else None
    finally:
        conn.close()


@router.post("/items", dependencies=[Depends(require_auth)])
def add_item(data: ItemManual):
    from app.scraper.pipeline import make_fingerprint, process_item
    from app import database as db
    from datetime import datetime
    conn = db.connect()
    try:
        conn.execute("BEGIN")
        src = {"name": data.source_name, "category": data.source_category or "其他", "type": "manual"}
        it = {
            "title": data.title,
            "url": data.url,
            "publish_date": data.publish_date or datetime.now().strftime("%Y-%m-%d"),
            "summary": data.summary or "",
        }
        if db.item_exists(conn, make_fingerprint(data.title, data.url)):
            conn.commit()
            return {"ok": False, "message": "已存在该条情报"}
        amount_value = data.amount_value
        amount_currency = data.amount_currency
        if amount_value is None or not amount_currency:
            amount_value = amount_currency = None
        else:
            # 手工录入没有原文证据时不落库金额/数量
            amount_value = amount_currency = None
        now = db.now_iso()
        conn.execute(
            """INSERT INTO items (fingerprint,title,url,source_name,source_category,source_type,publish_date,fetch_date,
               content,summary,analysis,region,institution,institution_type,asset_types,disposal_method,
               amount_value,amount_currency,amount_evidence,information_nature,importance,tags,is_processed,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (make_fingerprint(data.title, data.url), data.title, data.url, data.source_name, data.source_category,
             "manual", data.publish_date or datetime.now().strftime("%Y-%m-%d"), now,
             data.summary or "", data.summary or "", "", data.region, data.institution, data.institution_type,
             data.asset_types, data.disposal_method, amount_value, amount_currency, None, None,
             "medium", (data.asset_types or "虚拟货币"), 1, now, now),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/items/{item_id}", dependencies=[Depends(require_auth)])
def delete_item(item_id: int):
    conn = db.connect()
    try:
        conn.execute("DELETE FROM items WHERE id=?", (item_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.post("/scan", dependencies=[Depends(require_auth)])
def trigger_scan():
    return scheduler.start_manual()


@router.get("/scan/status", dependencies=[Depends(require_auth)])
def scan_status():
    return scheduler.scan_status()


@router.get("/scan/logs", dependencies=[Depends(require_auth)])
def scan_logs(limit: int = Query(15, ge=1, le=100)):
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT run_at, sources_planned, sources_ok, sources_failed, new_items, total_items, status, message "
            "FROM scan_logs ORDER BY run_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
