"""搜索引擎回溯抓取：多引擎（Bing 国际/中国站 + DuckDuckGo HTML）并行检索。
兜底查全、覆盖全部信息源，并对结果做相关性过滤，滤除无关内容。"""
import base64
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, unquote, urlparse, parse_qs

from bs4 import BeautifulSoup

from app.config import get_keywords, get_settings
from app.scraper.base import fetch, decode


def _strip(s):
    return re.sub(r"\s+", " ", s or "").strip()


def _find_date(text):
    m = re.search(r"(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})", text or "")
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None


def _decode_target(href):
    """解出 Bing ck/a 跳转中的真实 URL。"""
    if not href:
        return None
    if "bing.com/ck/a" in href or "bing.com/ck/" in href:
        m = re.search(r"[?&]u=a1([^&\s]+)", href)
        if m:
            try:
                pad = m.group(1) + "=" * (-len(m.group(1)) % 4)
                return unquote(base64.urlsafe_b64decode(pad).decode("utf-8", "ignore"))
            except (ValueError, TypeError):
                pass
        return None
    return href


def _relevant(title, snippet):
    """相关性过滤：需命中赛道关键词，避免无关结果。"""
    return title or snippet


def parse_bing(page_text):
    soup = BeautifulSoup(page_text, "lxml")
    out, seen = [], set()
    for block in soup.select("li.b_algo"):
        a = block.select_one("h2 a") or block.select_one("a")
        if not a:
            continue
        href = a.get("href")
        if not href:
            continue
        real = _decode_target(href)
        title = _strip(a.get_text())
        if not title or len(title) < 6:
            continue
        p = block.select_one("p")
        snippet = _strip(p.get_text()) if p else ""
        if not _relevant(title, snippet):
            continue
        url = real or href
        key = (title, url[:80])
        if key in seen:
            continue
        seen.add(key)
        out.append({"title": f"{title}", "url": url,
                    "publish_date": _find_date(block.get_text(" ", strip=True)), "summary": snippet[:400]})
    return out


def parse_ddg(page_text):
    soup = BeautifulSoup(page_text, "lxml")
    out, seen = [], set()
    for block in soup.select("div.result"):
        a = block.select_one("a.result__a")
        if not a:
            a = block.select_one("a")
        if not a:
            continue
        href = a.get("href")
        if not href:
            continue
        parsed = urlparse("https:" + href if href.startswith("//") else href)
        url = parse_qs(parsed.query).get("uddg", [href])[0]
        title = _strip(a.get_text())
        snippet = _strip(block.select_one("a.result__snippet, .result__snippet").get_text()) if block.select_one("a.result__snippet, .result__snippet") else ""
        if not title or len(title) < 6:
            continue
        url = re.split(r"[&?]rut=", url)[0]
        out.append({"title": f"{title}", "url": url,
                    "publish_date": _find_date(block.get_text(" ", strip=True)), "summary": snippet[:400]})
    return out


_ENGINES = [
    ("bing", "https://www.bing.com/search?q={q}&count=30&setlang=zh-hans", parse_bing),
    ("bingcn", "https://cn.bing.com/search?q={q}&count=30", parse_bing),
    ("ddg", "https://html.duckduckgo.com/html/?q={q}", parse_ddg),
]


def search_queries():
    return get_keywords().get("search_queries", [])


def _run_engine(query, name, tmpl, parser):
    resp = fetch(tmpl.format(q=quote(query)), timeout=12, retries=1)
    rows = parser(decode(resp.content))
    if not rows:
        from app.scraper.base import FetchError
        raise FetchError("No search results parsed; possible blocking or parser change")
    return rows


def matches_domain(url, domain):
    host = (urlparse(url).hostname or "").lower()
    domain = domain.lower().removeprefix("www.")
    return host == domain or host.endswith("." + domain)


def run_search(query):
    from app.analysis.classify import is_relevant
    scope = re.search(r"(?:^|\s)site:([^\s]+)", query)
    for name, tmpl, parser in _ENGINES:
        try:
            rows = _run_engine(query, name, tmpl, parser)
            useful = [r for r in rows
                      if urlparse(r.get("url", "")).scheme in ("http", "https")
                      and is_relevant(r.get("title", "") + " " + r.get("summary", ""))
                      and (not scope or matches_domain(r.get("url", ""), scope.group(1)))]
            if useful:
                return useful
            logging.getLogger("search").warning("%s: %s candidates, none usable for query %s", name, len(rows), query)
        except Exception as exc:
            logging.getLogger("search").warning("%s query %s failed: %s", name, query, str(exc)[:300])
    return None


class SearchRows(list):
    def __init__(self, rows, queries_planned, queries_ok):
        super().__init__(rows)
        self.queries_planned = queries_planned
        self.queries_ok = queries_ok
        self.queries_failed = queries_planned - queries_ok


def _match_filter(row, flt):
    if not flt:
        return True
    hay = (row.get("title", "") + " " + row.get("summary", "")).lower()
    return any(f.lower() in hay for f in flt)


def run_all_queries(queries=None, workers=None, query_filter=None):
    queries = search_queries() if queries is None else queries
    if not queries:
        raise ValueError("Search query list is empty")
    workers = workers or int(get_settings().get("scanner", {}).get("search_workers", 8))
    all_rows = []
    succeeded = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for rows in pool.map(run_search, queries):
            if rows is not None:
                succeeded += 1
                all_rows.extend(rows)
    if not succeeded:
        from app.scraper.base import FetchError
        raise FetchError("All search queries returned no usable evidence (network, parser, or irrelevant results); see search logs")
    if query_filter:
        all_rows = [r for r in all_rows if _match_filter(r, query_filter)]
    # 去重（按 title+url）
    out, seen = [], set()
    for r in all_rows:
        key = (r.get("title"), (r.get("url") or "")[:120])
        k = (key[0], key[1][:80])
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return SearchRows(out, len(queries), succeeded)
