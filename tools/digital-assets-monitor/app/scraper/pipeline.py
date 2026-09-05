"""采集流水线：同步源 -> 抓取 -> 去重 -> 分类标注 -> 持久化。"""
import hashlib
import json
from app.scraper.verification import verify_search_item
import logging
from urllib.parse import urlparse
import re
from datetime import datetime

from app import database as db
from app.config import get_sources, get_keywords, get_settings
from app.scraper import rss as rss_mod, web as web_mod, search as search_mod
from app.scraper.base import FetchError
from app.analysis import classify, extract, summarize


def normalize_title(t):
    t = t or ""
    t = t.lower()
    t = re.sub(r"[^\w\u4e00-\u9fa5]+", "", t)
    return t


def make_fingerprint(title, url=None):
    nt = normalize_title(title)
    return hashlib.sha1(f"{nt}|{url or ''}".encode("utf-8")).hexdigest()


def _neg_filter(text, title):
    neg = get_keywords().get("negative_filter", [])
    interest = get_keywords().get("interest_terms", [])
    combined = f"{title or ''} {text or ''}"
    has_interest = any(k.lower() in combined.lower() for k in interest)
    if has_interest:
        return False
    return any(k.lower() in combined.lower() for k in neg)


def _source_items(src):
    stype = src.get("type")
    url = src.get("url", "")
    if stype == "search":
        qf = src.get("query_filter")
        queries = src.get("search_queries")
        if src["id"] != "search-backfill":
            domain = (urlparse(url).hostname or "").removeprefix("www.")
            if not domain:
                raise ValueError("Named search source requires a valid domain")
            terms = queries or (["cryptocurrency forfeiture", "bitcoin seizure"] if src.get("category") == "国际" else ["涉案虚拟货币 处置", "数字资产 罚没"])
            queries = [f"site:{domain} {term}" for term in terms]
        return search_mod.run_all_queries(queries=queries, query_filter=qf)
    if stype == "rss":
        return rss_mod.parse_feed(url)
    if stype == "web":
        rules = {
            "item": src.get("item_selector", "h2 a, h3 a"),
            "date": src.get("date_selector", None),
        }
        rows, seen = [], set()
        pages = src.get("list_urls") or [url]
        if len(pages) > 5:
            raise ValueError("At most five configured list pages per scan")
        for page in pages:
            if urlparse(page).netloc != urlparse(url).netloc:
                raise ValueError("List pages must belong to the configured source")
            for item in web_mod.crawl_list(page, rules):
                if item["url"] not in seen:
                    seen.add(item["url"])
                    if src.get("force_https"):
                        parsed=urlparse(item["url"])
                        host=(parsed.hostname or "") + ((":" + str(parsed.port)) if parsed.port not in (None,80,443) else "")
                        item["url"]=parsed._replace(scheme="https",netloc=host).geturl()
                    if src.get("trust_list_date") and item.get("publish_date"):
                        item["date_origin"]="official_list"
                    rows.append(item)
        return rows
    return []


def _content_text(item):
    return f"{item.get('title', '')} {item.get('summary', '')}"


def should_verify_article(item, source):
    text = _content_text(item)
    return classify.is_relevant(text) or any(
        term.lower() in text.lower() for term in source.get("article_discovery_terms", [])
    )


def process_item(dbconn, item, source, new_count):
    fp = make_fingerprint(item.get("title"), item.get("url"))
    if db.item_exists(dbconn, fp):
        return new_count

    if source.get("type") == "search" or source.get("verify_articles"):
        evidence = item.get("verification") or {"status": "unverified"}
        dbconn.execute(
            "INSERT INTO search_candidates VALUES (?,?,?,?,?,?) "
            "ON CONFLICT(fingerprint) DO UPDATE SET status=excluded.status, evidence=excluded.evidence, updated_at=excluded.updated_at",
            (fp, source.get("id"), item.get("url"), evidence["status"],
             json.dumps(item, ensure_ascii=False), db.now_iso()),
        )
        if evidence.get("status") != "verified_article":
            return new_count

    raw_text = _content_text(item)
    if _neg_filter(raw_text, item.get("title")):
        return new_count
    # 非种子/手工条目需通过赛道相关度把关，过滤噪音
    if source.get("type") not in ("seed", "manual") and not classify.is_relevant(raw_text):
        return new_count

    source = dict(source)
    if source.get("id") == "search-backfill":
        source["name"] = urlparse(item.get("url") or "").hostname or "未知发布域名"
        source["category"] = "综合检索"
    amount_val, amount_cur = extract.extract_amount(raw_text)
    inst = extract.extract_institution(raw_text)
    itype = classify.classify_institution_type(raw_text)
    region = classify.classify_region(raw_text)
    assets = classify.classify_asset_types(raw_text)
    method = classify.classify_disposal_method(raw_text)
    importance = classify.classify_importance(raw_text, amount_val)
    tags = classify.make_tags(raw_text, itype, region, assets, method)

    summary = summarize.default_summary(item.get("summary") or item.get("title"))
    analysis = summarize.build_analysis(
        item.get("title"), raw_text, itype, region, assets, method, amount_val, amount_cur
    )

    now = db.now_iso()
    dbconn.execute(
        """INSERT INTO items (fingerprint, title, url, source_name, source_category, source_type,
             publish_date, fetch_date, content, summary, analysis, region, institution, institution_type,
             asset_types, disposal_method, amount_value, amount_currency, importance, tags, is_processed,
             created_at, updated_at, raw)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            fp, item.get("title"), item.get("url"), source.get("name"), source.get("category"),
            source.get("type"), item.get("publish_date"), now, raw_text, summary, analysis,
            region, inst, itype, ",".join(assets), method, amount_val, amount_cur, importance,
            ",".join(tags), 1, now, now, json.dumps(item.get("verification"), ensure_ascii=False),
        ),
    )
    return new_count + 1


def sync_sources():
    """仅同步信息源注册信息（不抓取），供启动时初始化源列表。"""
    cfg = get_sources().get("sources", [])
    conn = db.connect()
    try:
        conn.execute("BEGIN")
        for s in cfg:
            db.upsert_source(conn, {
                "id": s["id"], "name": s["name"], "category": s.get("category"),
                "type": s.get("type"), "enabled": 1 if s.get("enabled", True) else 0,
                "priority": s.get("priority", 50), "url": s.get("url"), "note": s.get("note"),
            })
        conn.commit()
    finally:
        conn.close()


def run_scan(dbconn=None, manual=False):
    cfg = get_sources().get("sources", [])
    total_planned = len([s for s in cfg if s.get("enabled", True)])
    ok, failed = 0, 0
    new_items = 0
    run_at = db.now_iso()

    conn = db.connect()
    try:
        conn.execute("BEGIN")
        for s in cfg:
            db.upsert_source(conn, {
                "id": s["id"], "name": s["name"], "category": s.get("category"),
                "type": s.get("type"), "enabled": 1 if s.get("enabled", True) else 0,
                "priority": s.get("priority", 50), "url": s.get("url"), "note": s.get("note"),
            })
        conn.commit()
    finally:
        conn.close()

    for src in sorted(cfg, key=lambda s: s.get("type") == "search"):
        if not src.get("enabled", True):
            continue
        try:
            items = _source_items(src)
            if src.get("type") == "search" or src.get("verify_articles"):
                # Perform network work before opening the database write transaction.
                for index, item in enumerate(items):
                    if should_verify_article(item, src):
                        items[index] = verify_search_item(item, src)
                    else:
                        items[index] = dict(item, verification={"status": "irrelevant_candidate"})
            conn = db.connect()
            try:
                conn.execute("BEGIN")
                source_new = 0
                relevant_count = sum(1 for it in items if classify.is_relevant(_content_text(it)) and not _neg_filter(_content_text(it), it.get("title")))
                for it in items:
                    source_new = process_item(conn, it, src, source_new)
                conn.commit()
                new_items += source_new
                query_failed = getattr(items, "queries_failed", 0)
                status = ("部分失败" if query_failed else "成功") + f": 候选{len(items)} 相关{relevant_count} 新增{source_new}"
                if src.get("type") == "search" or src.get("verify_articles"):
                    pending = sum(it.get("verification", {}).get("status") != "verified_article" for it in items)
                    status += f" 待核验{pending}"
                if hasattr(items, "queries_planned"):
                    status += f" 查询有效{items.queries_ok}/{items.queries_planned}"
                conn.execute(
                    """UPDATE sources SET last_scan_at=?, last_status=?, item_count=(SELECT COUNT(*) FROM items WHERE source_name=?) WHERE id=?""",
                    (db.now_iso(), status, src["name"], src["id"]),
                )
                if src.get("track_production_endpoint"):
                    conn.execute("UPDATE institution_channels SET endpoint_verified=1,status='production_scan_ok',updated_at=? WHERE id=?",
                                 (db.now_iso(), "configured-" + src["id"]))
                conn.commit()
            finally:
                conn.close()
            if query_failed:
                failed += 1
            else:
                ok += 1
        except Exception as e:  # noqa
            logger = logging.getLogger("scanner")
            if isinstance(e, FetchError):
                logger.warning("Source %s unavailable: %s", src["id"], str(e)[:350])
            else:
                logger.exception("Source %s failed", src["id"])
            conn = db.connect()
            try:
                conn.execute(
                    "UPDATE sources SET last_scan_at=?, last_status=? WHERE id=?",
                    (db.now_iso(), f"失败: {type(e).__name__}: {str(e)[:350]}", src["id"]),
                )
                if src.get("track_production_endpoint"):
                    conn.execute("UPDATE institution_channels SET endpoint_verified=0,status=?,updated_at=? WHERE id=?",
                                 ("production_scan_failed:" + type(e).__name__, db.now_iso(), "configured-" + src["id"]))
                conn.commit()
            finally:
                conn.close()
            failed += 1

    log_scan(run_at, total_planned, ok, failed, new_items)
    return {
        "run_at": run_at,
        "sources_planned": total_planned,
        "sources_ok": ok,
        "sources_failed": failed,
        "new_items": new_items,
    }


def log_scan(run_at, planned, ok, failed, new_items):
    conn = db.connect()
    try:
        total = conn.execute("SELECT COUNT(*) c FROM items").fetchone()["c"]
        status = "成功" if failed == 0 else ("部分失败" if ok or new_items else "失败")
        conn.execute(
            "INSERT INTO scan_logs (run_at, sources_planned, sources_ok, sources_failed, new_items, total_items, status, message) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (run_at, planned, ok, failed, new_items, total, status,
             f"计划{planned} 成功{ok} 失败{failed} 新增{new_items}"),
        )
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    db.init_db()
    res = run_scan()
    print(res)
