"""Batch-audit candidate homepages and cluster shared CMS/page templates.

This research tool only reads public HTTP/HTTPS pages. It never writes
production sources.json, never sets collection_enabled or endpoint_verified,
and never calls paid search APIs.
"""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
import re
import sys
import tempfile
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
DEFAULT_MAX_WORKERS = 4
HARD_MAX_WORKERS = 6
CONNECT_TIMEOUT = 8
READ_TIMEOUT = 20
MAX_BYTES = 2_000_000
MAX_REDIRECTS = 5
CHUNK_SIZE = 65536
USER_AGENT = (
    "Mozilla/5.0 (compatible; MUHUB-source-audit/1.0; +https://monitor.muhub.cn)"
)
CANDIDATE_FILES = (
    ROOT / "institution_candidates.json",
    ROOT / "technology_supplement_candidates.json",
    ROOT / "public_resource_platform_candidates.json",
)
DIRECTORY_IDENTITY_STATUSES = {
    "official_directory_candidate",
    "official_national_directory_candidate",
    "official_page_link_candidate",
    "verified_official_metadata",
}
COLUMN_KEYWORDS = {
    "announcement": ("公告",),
    "property": ("产权", "国有产权"),
    "asset": ("资产", "罚没"),
    "listing": ("挂牌",),
    "deal": ("成交",),
}
CMS_RULES = (
    ("epoint", ("epoint", "easysite", "epointwebpart", "epointnologin", "国泰新点")),
    ("webbuilder", ("webbuildercommon", "webbuilder")),
    ("jeecms", ("jeecms", "jeeplus", "/r/cms/")),
    ("siteserver", ("siteserver", "sscms")),
    ("hanweb", ("hanweb", "/jcms/", "大汉网络")),
    ("whir", ("ezoffice", "万户", "whir")),
    ("weaver", ("ecology", "weaver")),
    ("govcms", ("govcms",)),
    ("dedecms", ("dedecms", "/templets/default/")),
    ("discuz", ("discuz",)),
    ("wordpress", ("wp-content", "wordpress")),
    ("vue_spa", ("chunk-vendors", "vue.runtime", "__vue__")),
    ("react_spa", ("react.production", "react-dom")),
)
RESTRICTED_STATUS = {401, 403, 407, 412, 423, 429, 451}
DETAIL_RULES = (
    ("jhtml", re.compile(r"\.jhtml(?:$|[?#])", re.I)),
    ("shtml", re.compile(r"\.shtml(?:$|[?#])", re.I)),
    ("gov_dated", re.compile(r"/\d{6,8}/t\d{8}_", re.I)),
    ("jyxx", re.compile(r"/jyxx", re.I)),
    ("infogk", re.compile(r"/infogk|/info/\d+", re.I)),
    ("article", re.compile(r"/article|/content|/detail", re.I)),
    ("html_numeric", re.compile(r"/\d{5,}(?:\.html?)?(?:$|[?#])", re.I)),
)
LIST_SELECTOR_CANDIDATES = (
    "ul li a",
    ".list li a",
    ".news-list a",
    "table tr td a",
    ".article-list a",
    "#jyxx a",
    ".jyxx a",
    ".notice-list a",
)
TRADE_TITLE_MARKERS = ("公共资源", "产权交易", "交易平台", "交易网", "交易中心")
GENERIC_PORTAL_MARKERS = ("人民政府", "政务服务局", "人民政府办公厅")


class UnsafeURLError(ValueError):
    pass


class HostGate:
    def __init__(self):
        self._meta = threading.Lock()
        self._locks = {}

    def slot(self, host):
        key = (host or "").lower()
        with self._meta:
            lock = self._locks.get(key)
            if lock is None:
                lock = threading.Lock()
                self._locks[key] = lock
        return lock


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _is_blocked_ip(ip):
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or not ip.is_global
    )


def _blocked_hostname(host):
    name = (host or "").strip(".").lower()
    if not name:
        return True
    if name in {"localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"}:
        return True
    if name.endswith(".localhost") or name.endswith(".local"):
        return True
    return False


def validate_public_http_url(url, resolver=None):
    if not url or not isinstance(url, str):
        raise UnsafeURLError("empty_url")
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURLError("non_http_scheme")
    if parsed.username is not None or parsed.password is not None:
        raise UnsafeURLError("embedded_credentials")
    host = parsed.hostname
    if not host:
        raise UnsafeURLError("missing_host")
    if _blocked_hostname(host):
        raise UnsafeURLError("localhost_or_blocked_host")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None and _is_blocked_ip(ip):
        raise UnsafeURLError("private_or_non_global_ip")
    resolve = socket_resolver if resolver is None else resolver
    for address in resolve(host):
        try:
            resolved = ipaddress.ip_address(address)
        except ValueError:
            continue
        if _is_blocked_ip(resolved):
            raise UnsafeURLError("resolved_private_or_non_global_ip")
    return parsed


def socket_resolver(host, wait_seconds=3):
    import socket

    addresses = []

    def lookup():
        try:
            infos = socket.getaddrinfo(host, None)
        except OSError:
            return
        for info in infos:
            addr = info[4][0] if info[4] else None
            if addr:
                addresses.append(addr)

    worker = threading.Thread(target=lookup, daemon=True)
    worker.start()
    worker.join(wait_seconds)
    return addresses


def default_http_get(url, timeout, headers):
    return requests.get(
        url,
        timeout=timeout,
        headers=headers,
        allow_redirects=False,
        stream=True,
    )


def decode_bytes(raw):
    if raw[:3] == b"\xef\xbb\xbf":
        return raw.decode("utf-8", errors="replace")
    match = re.search(br"charset=[\"']?\s*([a-zA-Z0-9_\-]+)", raw[:4096], re.I)
    if match:
        enc = match.group(1).decode("ascii", "ignore") or "utf-8"
        return raw.decode(enc, errors="replace")
    for enc in ("utf-8", "gb18030", "gbk"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, ValueError):
            continue
    return raw.decode("utf-8", errors="replace")


def classify_exception(exc):
    name = type(exc).__name__
    text = str(exc).lower()
    if isinstance(exc, UnsafeURLError):
        return "unsafe_url"
    if isinstance(exc, (requests.Timeout, TimeoutError)):
        return "timeout"
    if "timeout" in name.lower() or "timed out" in text:
        return "timeout"
    if isinstance(exc, requests.exceptions.SSLError) or "ssl" in name.lower() or "certificate" in text:
        return "certificate_error"
    if (
        "getaddrinfo" in text
        or "nameresolution" in name.lower()
        or "failed to resolve" in text
        or "name or service not known" in text
        or "nodename nor servname" in text
    ):
        return "dns_error"
    if isinstance(exc, requests.exceptions.ConnectionError) or "connection" in name.lower():
        return "connection_error"
    return "request_error"


def classify_http_status(status):
    if status in RESTRICTED_STATUS:
        return "access_restricted"
    if status == 404:
        return "not_found"
    if status >= 400:
        return "http_error"
    if status in {301, 302, 303, 307, 308}:
        return "redirect"
    if status == 200:
        return "accessible"
    return "http_other"


def _path_prefix(url, depth=2):
    parsed = urlparse(url)
    parts = [p for p in parsed.path.split("/") if p]
    if not parts:
        return "/"
    return "/" + "/".join(parts[:depth]).lower()


def _asset_prefixes(soup, tag, attr, limit=8):
    counts = Counter()
    for node in soup.find_all(tag):
        href = node.get(attr) or ""
        if not href or href.startswith("data:"):
            continue
        counts[_path_prefix(href)] += 1
    return [item for item, _ in counts.most_common(limit)]


def detect_generator(soup, headers):
    node = soup.find("meta", attrs={"name": re.compile(r"^generator$", re.I)})
    if node and node.get("content"):
        return node.get("content").strip()[:120]
    powered = headers.get("X-Powered-By") or headers.get("x-powered-by")
    if powered:
        return str(powered).strip()[:120]
    comment = soup.find(string=re.compile(r"powered by|generator", re.I))
    if comment:
        return re.sub(r"\s+", " ", str(comment)).strip()[:120]
    return None


def detect_cms(html, soup):
    blob = html.lower()
    for paths in (
        " ".join(node.get("src") or "" for node in soup.find_all("script")),
        " ".join(node.get("href") or "" for node in soup.find_all("link")),
    ):
        blob += " " + paths.lower()
    for family, markers in CMS_RULES:
        if any(marker.lower() in blob for marker in markers):
            return family
    return "unknown"


def collect_detail_patterns(soup, page_url):
    host = (urlparse(page_url).hostname or "").lower()
    families = Counter()
    samples = []
    for node in soup.select("a[href]"):
        href = urljoin(page_url, node.get("href") or "")
        parsed = urlparse(href)
        if parsed.scheme not in ("http", "https"):
            continue
        if (parsed.hostname or "").lower() != host:
            continue
        path = parsed.path or ""
        for name, pattern in DETAIL_RULES:
            if pattern.search(path):
                families[name] += 1
                if len(samples) < 8:
                    samples.append(path[:180])
                break
    return sorted(families), samples, dict(families)


def collect_column_counts(soup):
    counts = {key: 0 for key in COLUMN_KEYWORDS}
    for node in soup.select("a[href]"):
        label = (node.get_text(" ", strip=True) or node.get("title") or "")[:80]
        for key, words in COLUMN_KEYWORDS.items():
            if any(word in label for word in words):
                counts[key] += 1
    return counts


def collect_list_selectors(soup):
    found = []
    for selector in LIST_SELECTOR_CANDIDATES:
        try:
            nodes = soup.select(selector)
        except Exception:
            continue
        titled = 0
        for node in nodes:
            text = node.get_text(" ", strip=True)
            if text and len(text) >= 6:
                titled += 1
        if titled >= 5:
            found.append({"selector": selector, "sample_count": titled})
    return found[:6]


def _coarse_roots(prefixes, limit=4):
    roots = []
    for prefix in prefixes:
        parts = [part for part in prefix.split("/") if part]
        if parts and parts[0] not in roots:
            roots.append(parts[0])
        if len(roots) >= limit:
            break
    return roots


def template_fingerprint(cms_family, generator, script_prefixes, css_prefixes, detail_families):
    coarse_scripts = _coarse_roots(script_prefixes)
    if cms_family and cms_family != "unknown":
        group_key = cms_family
        identified = True
    elif detail_families:
        group_key = "path:" + ",".join(detail_families)
        identified = True
    elif len(coarse_scripts) >= 2:
        group_key = "assets:" + ",".join(coarse_scripts[:3])
        identified = True
    else:
        group_key = "unknown"
        identified = False
    label = "|".join(
        [
            group_key,
            ",".join(detail_families) or "no-detail",
            ",".join(coarse_scripts) or "no-script",
        ]
    )
    digest = hashlib.sha256(group_key.encode("utf-8")).hexdigest()[:16]
    return digest, label, identified


def analyze_html(html, page_url, headers):
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True)[:200] if soup.title else None
    generator = detect_generator(soup, headers)
    cms_family = detect_cms(html, soup)
    script_prefixes = _asset_prefixes(soup, "script", "src")
    css_prefixes = _asset_prefixes(soup, "link", "href")
    detail_families, detail_samples, detail_counts = collect_detail_patterns(soup, page_url)
    fingerprint, label, identified = template_fingerprint(
        cms_family, generator, script_prefixes, css_prefixes, detail_families
    )
    columns = collect_column_counts(soup)
    selectors = collect_list_selectors(soup)
    return {
        "title": title,
        "page_generator": generator,
        "cms_family": cms_family,
        "script_path_features": script_prefixes,
        "css_path_features": css_prefixes,
        "detail_path_patterns": detail_families,
        "detail_path_samples": detail_samples,
        "detail_path_counts": detail_counts,
        "column_link_counts": columns,
        "list_selector_candidates": selectors,
        "template_fingerprint": fingerprint,
        "template_label": label,
        "template_identified": identified,
    }


def title_looks_like_generic_portal(title):
    text = title or ""
    if any(marker in text for marker in TRADE_TITLE_MARKERS):
        return False
    return any(marker in text for marker in GENERIC_PORTAL_MARKERS)


def identity_assessment(entry):
    status = entry.get("identity_status") or "candidate"
    if status in DIRECTORY_IDENTITY_STATUSES:
        return "official_directory_evidence"
    return "still_candidate"


def empty_page_features():
    return {
        "title": None,
        "page_generator": None,
        "cms_family": None,
        "script_path_features": [],
        "css_path_features": [],
        "detail_path_patterns": [],
        "detail_path_samples": [],
        "detail_path_counts": {},
        "column_link_counts": {key: 0 for key in COLUMN_KEYWORDS},
        "list_selector_candidates": [],
        "template_fingerprint": None,
        "template_label": None,
        "template_identified": False,
    }


def base_result(entry):
    return {
        "id": entry.get("id"),
        "name": entry.get("name"),
        "kind": entry.get("kind"),
        "province": entry.get("province"),
        "identity_status": entry.get("identity_status"),
        "official_identity": identity_assessment(entry),
        "requested_url": entry.get("homepage_candidate"),
        "final_url": None,
        "redirect_chain": [],
        "redirected_host_differs": False,
        "redirected_host_not_treated_as_official": True,
        "http_status": None,
        "content_type": None,
        "page_bytes": 0,
        "response_ms": None,
        "error_class": None,
        "error_type": None,
        "error": None,
        "audit_complete": True,
        "collection_enabled": False,
        "endpoint_verified": False,
        "shared_collector_ready": False,
        "eligible_for_strict_verification": False,
        "needs_human_review": [],
        "checked_at": now_iso(),
        **empty_page_features(),
    }


def read_limited_body(response, max_bytes=MAX_BYTES):
    data = bytearray()
    truncated = False
    for chunk in response.iter_content(CHUNK_SIZE):
        if not chunk:
            continue
        data.extend(chunk)
        if len(data) > max_bytes:
            truncated = True
            del data[max_bytes:]
            break
    return bytes(data), truncated


def fetch_public_page(url, http_get=default_http_get, resolver=None, timeout=None):
    timeout = timeout or (CONNECT_TIMEOUT, READ_TIMEOUT)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    current = url
    chain = []
    started = time.perf_counter()
    response = None
    try:
        for _ in range(MAX_REDIRECTS + 1):
            validate_public_http_url(current, resolver=resolver)
            response = http_get(current, timeout=timeout, headers=headers)
            status = getattr(response, "status_code", None)
            location = None
            if hasattr(response, "headers"):
                location = response.headers.get("Location") or response.headers.get("location")
            chain.append({"url": current, "status": status, "location": location})
            if status in {301, 302, 303, 307, 308} and location:
                nxt = urljoin(current, location)
                try:
                    validate_public_http_url(nxt, resolver=resolver)
                except UnsafeURLError as exc:
                    elapsed = int((time.perf_counter() - started) * 1000)
                    return {
                        "ok": False,
                        "requested_url": url,
                        "final_url": current,
                        "redirect_chain": chain,
                        "http_status": status,
                        "content_type": (response.headers or {}).get("Content-Type"),
                        "page_bytes": 0,
                        "response_ms": elapsed,
                        "body": b"",
                        "error_class": "unsafe_url",
                        "error_type": type(exc).__name__,
                        "error": str(exc),
                    }
                current = nxt
                if hasattr(response, "close"):
                    response.close()
                continue
            body, truncated = read_limited_body(response)
            elapsed = int((time.perf_counter() - started) * 1000)
            content_type = (response.headers or {}).get("Content-Type")
            result = {
                "ok": status == 200 and not truncated,
                "requested_url": url,
                "final_url": getattr(response, "url", None) or current,
                "redirect_chain": chain,
                "http_status": status,
                "content_type": content_type,
                "page_bytes": len(body),
                "response_ms": elapsed,
                "body": body,
                "headers": dict(response.headers or {}),
                "truncated": truncated,
            }
            if truncated:
                result["error_class"] = "response_too_large"
            elif status != 200:
                result["error_class"] = classify_http_status(status)
            return result
        elapsed = int((time.perf_counter() - started) * 1000)
        return {
            "ok": False,
            "requested_url": url,
            "final_url": current,
            "redirect_chain": chain,
            "http_status": None,
            "content_type": None,
            "page_bytes": 0,
            "response_ms": elapsed,
            "body": b"",
            "error_class": "too_many_redirects",
        }
    finally:
        if response is not None and hasattr(response, "close"):
            try:
                response.close()
            except Exception:
                pass


def host_of(url):
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def shared_collector_ready(result):
    columns = result.get("column_link_counts") or {}
    has_columns = any(columns.get(key, 0) > 0 for key in ("announcement", "property", "asset", "listing", "deal"))
    return bool(
        result.get("error_class") == "accessible"
        and result.get("template_identified")
        and (has_columns or result.get("list_selector_candidates"))
        and not result.get("redirected_host_differs")
    )


def eligible_for_strict_verification(result):
    columns = result.get("column_link_counts") or {}
    useful = any(columns.get(key, 0) > 0 for key in ("announcement", "property", "listing", "deal"))
    return bool(
        shared_collector_ready(result)
        and result.get("official_identity") == "official_directory_evidence"
        and useful
    )


def audit_candidate(entry, http_get=default_http_get, resolver=None, timeout=None):
    result = base_result(entry)
    url = entry.get("homepage_candidate")
    try:
        validate_public_http_url(url, resolver=resolver)
    except UnsafeURLError as exc:
        result["error_class"] = "unsafe_url"
        result["error_type"] = type(exc).__name__
        result["error"] = str(exc)
        result["needs_human_review"] = ["unsafe_or_non_public_url"]
        return result
    try:
        fetched = fetch_public_page(url, http_get=http_get, resolver=resolver, timeout=timeout)
    except Exception as exc:
        result["error_class"] = classify_exception(exc)
        result["error_type"] = type(exc).__name__
        result["error"] = str(exc)[:400]
        return result
    result["final_url"] = fetched.get("final_url")
    result["redirect_chain"] = fetched.get("redirect_chain") or []
    result["http_status"] = fetched.get("http_status")
    result["content_type"] = fetched.get("content_type")
    result["page_bytes"] = fetched.get("page_bytes") or 0
    result["response_ms"] = fetched.get("response_ms")
    requested_host = host_of(url)
    final_host = host_of(result["final_url"] or "")
    result["redirected_host_differs"] = bool(final_host and requested_host and final_host != requested_host)
    if result["redirected_host_differs"]:
        result["needs_human_review"].append("redirect_host_changed")
    error_class = fetched.get("error_class")
    if error_class:
        result["error_class"] = error_class
        result["error_type"] = fetched.get("error_type")
        result["error"] = fetched.get("error")
        if error_class != "accessible":
            return result
    body = fetched.get("body") or b""
    content_type = (result["content_type"] or "").lower()
    if "html" not in content_type and not body.lstrip()[:64].lower().startswith((b"<!doctype html", b"<html")):
        result["error_class"] = "unsupported_content_type"
        return result
    try:
        html = decode_bytes(body)
        result.update(analyze_html(html, result["final_url"] or url, fetched.get("headers") or {}))
    except Exception as exc:
        result["error_class"] = "parse_error"
        result["error_type"] = type(exc).__name__
        result["error"] = str(exc)[:400]
        return result
    result["error_class"] = "accessible"
    requested_scheme = urlparse(url or "").scheme
    final_scheme = urlparse(result["final_url"] or "").scheme
    if requested_scheme == "https" and final_scheme == "http":
        result["needs_human_review"].append("https_downgraded_to_http")
    if result["redirected_host_differs"]:
        result["official_identity"] = "still_candidate"
        result["needs_human_review"].append("redirected_domain_not_official_site")
    if title_looks_like_generic_portal(result.get("title")):
        result["needs_human_review"].append("homepage_title_not_trading_platform")
        result["shared_collector_ready"] = False
        result["eligible_for_strict_verification"] = False
    else:
        result["shared_collector_ready"] = shared_collector_ready(result)
        result["eligible_for_strict_verification"] = eligible_for_strict_verification(result)
    if not result["shared_collector_ready"] and "template_or_listing_unclear" not in result["needs_human_review"]:
        if "homepage_title_not_trading_platform" not in result["needs_human_review"]:
            result["needs_human_review"].append("template_or_listing_unclear")
    result["collection_enabled"] = False
    result["endpoint_verified"] = False
    return result


def load_candidates(kind, extra_files=None, candidate_files=None):
    rows = []
    files = [Path(p) for p in candidate_files] if candidate_files is not None else list(CANDIDATE_FILES)
    if extra_files:
        files.extend(Path(p) for p in extra_files)
    seen = set()
    for path in files:
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            continue
        for row in payload:
            if row.get("kind") != kind:
                continue
            key = row.get("id") or (row.get("name"), row.get("homepage_candidate"))
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
    return rows


def atomic_write_text(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def atomic_write_json(path, payload):
    atomic_write_text(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def load_existing_results(path):
    path = Path(path)
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    return list(payload.get("results") or [])


def completed_ids(results):
    done = set()
    for row in results:
        if row.get("audit_complete") and row.get("id"):
            done.add(row["id"])
    return done


def build_template_groups(results, kind):
    groups = defaultdict(list)
    labels = {}
    cms = {}
    for row in results:
        fingerprint = row.get("template_fingerprint")
        if not fingerprint or not row.get("template_identified"):
            continue
        groups[fingerprint].append(
            {
                "id": row.get("id"),
                "name": row.get("name"),
                "province": row.get("province"),
                "requested_url": row.get("requested_url"),
                "final_url": row.get("final_url"),
                "shared_collector_ready": bool(row.get("shared_collector_ready")),
            }
        )
        labels[fingerprint] = (row.get("template_label") or "").split("|", 1)[0] or row.get("cms_family")
        cms[fingerprint] = row.get("cms_family")
    grouped = []
    for fingerprint, members in sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])):
        grouped.append(
            {
                "template_fingerprint": fingerprint,
                "template_label": labels.get(fingerprint),
                "cms_family": cms.get(fingerprint),
                "member_count": len(members),
                "shared_collector_ready_count": sum(1 for m in members if m["shared_collector_ready"]),
                "members": members,
            }
        )
    unidentified = [
        {"id": r.get("id"), "name": r.get("name"), "province": r.get("province"), "error_class": r.get("error_class")}
        for r in results
        if not r.get("template_identified")
    ]
    return {
        "generated_at": now_iso(),
        "kind": kind,
        "note": "Same fingerprint means similar CMS or page structure, not a production collector.",
        "group_count": len(grouped),
        "identified_count": sum(g["member_count"] for g in grouped),
        "unidentified_count": len(unidentified),
        "groups": grouped,
        "unidentified": unidentified,
        "collection_enabled": False,
        "endpoint_verified": False,
    }


def build_promotion_candidates(results, kind):
    rows = []
    for item in results:
        if not item.get("eligible_for_strict_verification"):
            continue
        rows.append(
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "kind": item.get("kind") or kind,
                "province": item.get("province"),
                "requested_url": item.get("requested_url"),
                "final_url": item.get("final_url"),
                "template_fingerprint": item.get("template_fingerprint"),
                "cms_family": item.get("cms_family"),
                "official_identity": item.get("official_identity"),
                "column_link_counts": item.get("column_link_counts"),
                "next_step": "strict_verification",
                "promoted_to_production": False,
                "collection_enabled": False,
                "endpoint_verified": False,
                "note": "May enter the next strict verification round; not an operational source.",
            }
        )
    return {
        "generated_at": now_iso(),
        "kind": kind,
        "note": (
            "Promotion here only means eligible for the next strict verification round. "
            "It does not enable collection or mark production coverage."
        ),
        "count": len(rows),
        "candidates": rows,
        "collection_enabled": False,
        "endpoint_verified": False,
        "promoted_to_production": False,
    }


def summarize_results(results):
    classes = Counter(row.get("error_class") or "unknown" for row in results)
    return {
        "candidates": len(results),
        "http_reachable": sum(1 for row in results if row.get("error_class") == "accessible"),
        "template_identified": sum(1 for row in results if row.get("template_identified")),
        "eligible_for_strict_verification": sum(1 for row in results if row.get("eligible_for_strict_verification")),
        "formally_connected": 0,
        "production_success": 0,
        "error_classes": dict(classes),
        "collection_enabled": False,
        "endpoint_verified": False,
    }


def persist_outputs(output_dir, kind, results):
    output_dir = Path(output_dir)
    payload = {
        "generated_at": now_iso(),
        "kind": kind,
        "note": (
            "Per-channel public homepage audit. HTTP reachability is not official identity, "
            "not collection_enabled, and not endpoint_verified."
        ),
        "summary": summarize_results(results),
        "results": results,
        "collection_enabled": False,
        "endpoint_verified": False,
    }
    groups = build_template_groups(results, kind)
    promotion = build_promotion_candidates(results, kind)
    atomic_write_json(output_dir / "channel_audit_results.json", payload)
    atomic_write_json(output_dir / "channel_template_groups.json", groups)
    atomic_write_json(output_dir / "channel_promotion_candidates.json", promotion)
    return payload, groups, promotion


def run_audit(
    kind,
    output_dir,
    limit=None,
    workers=DEFAULT_MAX_WORKERS,
    resume=False,
    http_get=default_http_get,
    resolver=None,
    timeout=None,
    extra_files=None,
    candidate_files=None,
    progress=None,
):
    workers = max(1, min(int(workers), HARD_MAX_WORKERS))
    output_dir = Path(output_dir)
    candidates = load_candidates(kind, extra_files=extra_files, candidate_files=candidate_files)
    if limit is not None:
        candidates = candidates[: int(limit)]
    existing = load_existing_results(output_dir / "channel_audit_results.json") if resume else []
    done = completed_ids(existing) if resume else set()
    pending = [row for row in candidates if row.get("id") not in done]
    results_by_id = {row.get("id"): row for row in existing if row.get("id")}
    gate = HostGate()
    write_lock = threading.Lock()
    log = progress or (lambda *_args, **_kwargs: None)

    def task(entry):
        host = host_of(entry.get("homepage_candidate") or "")
        with gate.slot(host):
            return audit_candidate(entry, http_get=http_get, resolver=resolver, timeout=timeout)

    def save_snapshot():
        ordered = []
        seen = set()
        for entry in candidates:
            item = results_by_id.get(entry.get("id"))
            if item:
                ordered.append(item)
                seen.add(entry.get("id"))
        for item in existing:
            if item.get("id") not in seen:
                ordered.append(item)
        persist_outputs(output_dir, kind, ordered)
        return ordered

    if not pending:
        ordered = save_snapshot()
        return summarize_results(ordered), ordered

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(task, entry): entry for entry in pending}
        for future in as_completed(futures):
            entry = futures[future]
            try:
                item = future.result()
            except Exception as exc:
                item = base_result(entry)
                item["error_class"] = classify_exception(exc)
                item["error_type"] = type(exc).__name__
                item["error"] = str(exc)[:400]
            item["collection_enabled"] = False
            item["endpoint_verified"] = False
            with write_lock:
                results_by_id[item.get("id")] = item
                save_snapshot()
            log(item)

    ordered = save_snapshot()
    return summarize_results(ordered), ordered


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Batch-audit candidate source templates")
    parser.add_argument("--kind", default="public_resource_platform")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=DEFAULT_MAX_WORKERS)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--output-dir", default=None)
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    output_dir = Path(args.output_dir) if args.output_dir else ROOT / "batch_audit" / args.kind
    summary, results = run_audit(
        kind=args.kind,
        output_dir=output_dir,
        limit=args.limit,
        workers=args.workers,
        resume=args.resume,
        progress=lambda item: print(
            json.dumps(
                {
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "error_class": item.get("error_class"),
                    "http_status": item.get("http_status"),
                },
                ensure_ascii=False,
            ),
            flush=True,
        ),
    )
    print(json.dumps({"output_dir": str(output_dir), "summary": summary, "audited": len(results)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
