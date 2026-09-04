"""RSS/Atom 订阅源抓取。"""
import re
from datetime import datetime, timezone

import feedparser
from dateutil import parser as date_parser

from app.scraper.base import fetch, decode


def _pub_date(entry):
    for key in ("published_parsed", "updated_parsed"):
        v = getattr(entry, key, None)
        if v:
            try:
                return datetime(*v[:6], tzinfo=timezone.utc).astimezone().isoformat(timespec="seconds")
            except (TypeError, ValueError, IndexError):
                pass
    for key in ("published", "updated"):
        v = getattr(entry, key, None)
        if v:
            try:
                return date_parser.parse(v).astimezone().isoformat(timespec="seconds")
            except (ValueError, OverflowError):
                pass
    return None


def parse_feed(url):
    """返回 [(title, link, pubdate, summary, content)], 失败抛异常。"""
    resp = fetch(url)
    feed = feedparser.parse(resp.content)
    if not feed.version:
        from app.scraper.base import FetchError
        raise FetchError("Response is not a valid RSS/Atom feed")
    out = []
    for entry in feed.entries:
        title = getattr(entry, "title", "").strip()
        link = getattr(entry, "link", "").strip()
        if not title or not link:
            continue
        summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
        summary = re.sub(r"<[^>]+>", " ", summary) if summary else ""
        content = ""
        if getattr(entry, "content", None):
            try:
                content = entry.content[0].value
                content = re.sub(r"<[^>]+>", " ", content)
            except (IndexError, AttributeError, TypeError):
                content = ""
        out.append({
            "title": title,
            "url": link,
            "publish_date": _pub_date(entry),
            "summary": (summary or content or "").strip()[:1200],
        })
    return out
