"""Batch-audit candidate homepages and cluster shared CMS/page templates.

This research tool only reads public HTTP/HTTPS pages from in-repo candidate
files. It never writes production sources.json, never sets collection_enabled
or endpoint_verified, and never calls paid search APIs.

DNS and redirect checks are preflight only: the process resolves names before
requesting, but requests itself may still connect to a later DNS answer.
Peer IPs are not pinned. Do not feed this script untrusted user-submitted URLs.
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
SCHEMA_VERSION = "2"
DEFAULT_MAX_WORKERS = 4
HARD_MAX_WORKERS = 6
CONNECT_TIMEOUT = 8
READ_TIMEOUT = 20
MAX_BYTES = 2_000_000
MAX_REDIRECTS = 5
CHUNK_SIZE = 65536
DEFAULT_CHECKPOINT_EVERY = 25
DNS_WAIT_SECONDS = 3
USER_AGENT = (
    "Mozilla/5.0 (compatible; MUHUB-source-audit/1.0; +https://monitor.muhub.cn)"
)
CANDIDATE_FILES = (
    ROOT / "institution_candidates.json",
    ROOT / "technology_supplement_candidates.json",
    ROOT / "public_resource_platform_candidates.json",
    ROOT / "police_link_candidates.json",
    ROOT / "police_county_link_candidates.json",
)
POLICE_LINK_FILES = {
    "police_link_candidates.json": "city_link",
    "police_county_link_candidates.json": "county_link",
}
DIRECTORY_IDENTITY_STATUSES = {
    "official_directory_candidate",
    "official_national_directory_candidate",
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
SECURITY_BOUNDARY = (
    "dns_precheck_only; peer IP is not pinned; in-repo candidates only"
)


class UnsafeURLError(ValueError):
    pass


class DnsTimeoutError(Exception):
    pass


class DnsResolutionError(Exception):
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


def stable_candidate_id(kind, name, url):
    raw = "|".join([kind or "", name or "", (url or "").strip()])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


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
    if name in {
        "localhost",
        "localhost.localdomain",
        "ip6-localhost",
        "ip6-loopback",
        "metadata.google.internal",
    }:
        return True
    if name.endswith(".localhost") or name.endswith(".local"):
        return True
    return False


def socket_resolver(host, wait_seconds=DNS_WAIT_SECONDS):
    import socket

    box = {"addresses": [], "error": None}

    def lookup():
        try:
            infos = socket.getaddrinfo(host, None)
        except OSError as exc:
            box["error"] = exc
            return
        found = []
        for info in infos:
            addr = info[4][0] if info[4] else None
            if addr:
                found.append(addr)
        box["addresses"] = found

    worker = threading.Thread(target=lookup, daemon=True)
    worker.start()
    worker.join(wait_seconds)
    if worker.is_alive():
        raise DnsTimeoutError("dns_lookup_timed_out")
    if box["error"] is not None:
        raise DnsResolutionError(str(box["error"]))
    return box["addresses"]


def authorize_host(host, resolver=None):
    if _blocked_hostname(host):
        raise UnsafeURLError("localhost_or_blocked_host")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None:
        if _is_blocked_ip(ip):
            raise UnsafeURLError("private_or_non_global_ip")
        return [str(ip)]
    resolve = socket_resolver if resolver is None else resolver
    try:
        addresses = resolve(host)
    except DnsTimeoutError:
        raise
    except DnsResolutionError:
        raise
    except Exception as exc:
        raise DnsResolutionError(str(exc)[:300]) from exc
    if not addresses:
        raise DnsResolutionError("dns_no_addresses")
    public_ips = []
    blocked = []
    for address in addresses:
        try:
            parsed = ipaddress.ip_address(address)
        except ValueError:
            continue
        if _is_blocked_ip(parsed):
            blocked.append(str(parsed))
        else:
            public_ips.append(str(parsed))
    if blocked:
        raise UnsafeURLError("resolved_private_or_non_global_ip")
    if not public_ips:
        raise DnsResolutionError("dns_no_public_addresses")
    return public_ips


def inspect_public_http_url(url, resolver=None):
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
    resolved_ips = authorize_host(host, resolver=resolver)
    return {"parsed": parsed, "host": host, "resolved_ips": resolved_ips}


def validate_public_http_url(url, resolver=None):
    return inspect_public_http_url(url, resolver=resolver)["parsed"]


def build_session():
    session = requests.Session()
    session.trust_env = False
    session.proxies = {"http": None, "https": None}
    return session


_SESSION = None
_SESSION_LOCK = threading.Lock()


def default_session():
    global _SESSION
    with _SESSION_LOCK:
        if _SESSION is None:
            _SESSION = build_session()
        return _SESSION


def default_http_get(url, timeout, headers):
    return default_session().get(
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
    if isinstance(exc, UnsafeURLError):
        return "unsafe_url"
    if isinstance(exc, DnsTimeoutError):
        return "dns_timeout"
    if isinstance(exc, DnsResolutionError):
        return "dns_error"
    name = type(exc).__name__
    text = str(exc).lower()
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


def template_fingerprint(cms_family, script_prefixes, css_prefixes, detail_families, list_selectors):
    coarse_scripts = _coarse_roots(script_prefixes)
    coarse_css = _coarse_roots(css_prefixes)
    asset_roots = []
    for root in coarse_scripts + coarse_css:
        if root not in asset_roots:
            asset_roots.append(root)
    list_features = [item["selector"] for item in (list_selectors or [])]
    identified = bool(
        (cms_family and cms_family != "unknown")
        or detail_families
        or len(asset_roots) >= 2
        or list_features
    )
    label = "|".join(
        [
            cms_family or "unknown",
            ",".join(detail_families) or "no-detail",
            ",".join(asset_roots[:6]) or "no-assets",
            ",".join(list_features[:4]) or "no-list",
        ]
    )
    digest = hashlib.sha256(label.encode("utf-8")).hexdigest()[:16]
    return digest, label, identified


def analyze_html(html, page_url, headers):
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True)[:200] if soup.title else None
    generator = detect_generator(soup, headers)
    cms_family = detect_cms(html, soup)
    script_prefixes = _asset_prefixes(soup, "script", "src")
    css_prefixes = _asset_prefixes(soup, "link", "href")
    detail_families, detail_samples, detail_counts = collect_detail_patterns(soup, page_url)
    selectors = collect_list_selectors(soup)
    fingerprint, label, identified = template_fingerprint(
        cms_family, script_prefixes, css_prefixes, detail_families, selectors
    )
    columns = collect_column_counts(soup)
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
        "source_layer": entry.get("source_layer"),
        "identity_status": entry.get("identity_status"),
        "official_identity": identity_assessment(entry),
        "confirmed_institution": False,
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
        "schema_version": SCHEMA_VERSION,
        "dns_precheck_ips": [],
        "peer_ip_pinned": False,
        "security_boundary": SECURITY_BOUNDARY,
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


def fetch_public_page(url, http_get=default_http_get, resolver=None, timeout=None, host_gate=None):
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
    resolved_hops = []
    try:
        for _ in range(MAX_REDIRECTS + 1):
            inspection = inspect_public_http_url(current, resolver=resolver)
            resolved_hops.append({"url": current, "ips": inspection["resolved_ips"]})
            host = inspection["host"]
            lock = host_gate.slot(host) if host_gate is not None else None
            try:
                if lock is not None:
                    lock.acquire()
                response = http_get(current, timeout=timeout, headers=headers)
            finally:
                if lock is not None:
                    lock.release()
            status = getattr(response, "status_code", None)
            location = None
            if hasattr(response, "headers"):
                location = response.headers.get("Location") or response.headers.get("location")
            chain.append({"url": current, "status": status, "location": location})
            if status in {301, 302, 303, 307, 308} and location:
                nxt = urljoin(current, location)
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
                "dns_precheck_ips": resolved_hops[-1]["ips"] if resolved_hops else [],
                "dns_hops": resolved_hops,
                "peer_ip_pinned": False,
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
            "dns_precheck_ips": resolved_hops[-1]["ips"] if resolved_hops else [],
            "peer_ip_pinned": False,
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


def audit_candidate(entry, http_get=default_http_get, resolver=None, timeout=None, host_gate=None):
    result = base_result(entry)
    url = entry.get("homepage_candidate")
    try:
        inspection = inspect_public_http_url(url, resolver=resolver)
        result["dns_precheck_ips"] = inspection["resolved_ips"]
    except (UnsafeURLError, DnsTimeoutError, DnsResolutionError) as exc:
        result["error_class"] = classify_exception(exc)
        result["error_type"] = type(exc).__name__
        result["error"] = str(exc)
        if isinstance(exc, UnsafeURLError):
            result["needs_human_review"] = ["unsafe_or_non_public_url"]
        return result
    try:
        fetched = fetch_public_page(
            url, http_get=http_get, resolver=resolver, timeout=timeout, host_gate=host_gate
        )
    except (UnsafeURLError, DnsTimeoutError, DnsResolutionError) as exc:
        result["error_class"] = classify_exception(exc)
        result["error_type"] = type(exc).__name__
        result["error"] = str(exc)[:400]
        return result
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
    result["dns_precheck_ips"] = fetched.get("dns_precheck_ips") or result["dns_precheck_ips"]
    result["peer_ip_pinned"] = False
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
    result["confirmed_institution"] = False
    return result


def normalize_candidate(row, source_path):
    item = dict(row)
    filename = Path(source_path).name
    if filename in POLICE_LINK_FILES:
        item["kind"] = item.get("kind") or "police"
        item["source_layer"] = POLICE_LINK_FILES[filename]
        item.setdefault("identity_status", "official_page_link_candidate")
        item["current_identity_verified"] = False
        item["endpoint_verified"] = False
        item["collection_enabled"] = False
        item["confirmed_institution"] = False
        if not item.get("discovery_evidence_url"):
            item["discovery_evidence_url"] = item.get("evidence_url")
    elif item.get("kind") == "police":
        item.setdefault("source_layer", "province_directory")
        item["confirmed_institution"] = False
    if not item.get("id"):
        item["id"] = stable_candidate_id(
            item.get("kind") or "",
            item.get("name") or "",
            item.get("homepage_candidate") or "",
        )
    return item


def load_candidates(kind, extra_files=None, candidate_files=None):
    rows = []
    files = [Path(p) for p in candidate_files] if candidate_files is not None else list(CANDIDATE_FILES)
    if extra_files:
        files.extend(Path(p) for p in extra_files)
    seen = set()
    for path in files:
        if not path.exists():
            continue
        if path.name == "national_discovery_tasks.csv":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            continue
        for raw in payload:
            row = normalize_candidate(raw, path)
            if row.get("kind") != kind:
                continue
            key = (row.get("kind"), row.get("name"), (row.get("homepage_candidate") or "").rstrip("/"))
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)
    return rows


def police_candidate_counts(rows=None):
    rows = rows if rows is not None else load_candidates("police")
    counts = Counter(row.get("source_layer") or "unknown" for row in rows)
    return {
        "total": len(rows),
        "province_directory": counts.get("province_directory", 0),
        "city_link": counts.get("city_link", 0),
        "county_link": counts.get("county_link", 0),
        "confirmed_institutions": 0,
    }


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


def append_progress(path, result, lock=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(result, ensure_ascii=False) + "\n"

    def _write():
        with open(path, "a", encoding="utf-8", newline="\n") as handle:
            handle.write(line)
            handle.flush()
            os.fsync(handle.fileno())

    if lock is None:
        _write()
    else:
        with lock:
            _write()


def load_progress(path):
    path = Path(path)
    if not path.exists():
        return []
    items = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text:
            continue
        try:
            items.append(json.loads(text))
        except json.JSONDecodeError:
            continue
    return items


def reusable_result(saved, entry):
    if not saved or not saved.get("audit_complete"):
        return False
    return (
        saved.get("id") == entry.get("id")
        and saved.get("requested_url") == entry.get("homepage_candidate")
        and saved.get("schema_version") == SCHEMA_VERSION
    )


def load_existing_results(path):
    path = Path(path)
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    return list(payload.get("results") or [])


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
                "cms_family": row.get("cms_family"),
                "template_label": row.get("template_label"),
                "shared_collector_ready": bool(row.get("shared_collector_ready")),
            }
        )
        labels[fingerprint] = row.get("template_label")
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
    cms_families = sorted({g["cms_family"] for g in grouped if g.get("cms_family") and g["cms_family"] != "unknown"})
    return {
        "generated_at": now_iso(),
        "kind": kind,
        "schema_version": SCHEMA_VERSION,
        "note": (
            "template_fingerprint is a page-structure key; cms_family is coarser. "
            "Neither is a production collector."
        ),
        "group_count": len(grouped),
        "cms_family_count": len(cms_families),
        "cms_families": cms_families,
        "identified_count": sum(g["member_count"] for g in grouped),
        "unidentified_count": len(unidentified),
        "groups": grouped,
        "unidentified": unidentified,
        "collection_enabled": False,
        "endpoint_verified": False,
        "peer_ip_pinned": False,
        "security_boundary": SECURITY_BOUNDARY,
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
                "confirmed_institution": False,
                "note": "May enter the next strict verification round; not an operational source.",
            }
        )
    return {
        "generated_at": now_iso(),
        "kind": kind,
        "schema_version": SCHEMA_VERSION,
        "note": (
            "Promotion here only means eligible for the next strict verification round. "
            "It does not enable collection or mark production coverage."
        ),
        "count": len(rows),
        "candidates": rows,
        "collection_enabled": False,
        "endpoint_verified": False,
        "promoted_to_production": False,
        "peer_ip_pinned": False,
        "security_boundary": SECURITY_BOUNDARY,
    }


def summarize_results(results):
    identified = [row for row in results if row.get("template_identified")]
    cms_families = sorted(
        {
            row.get("cms_family")
            for row in identified
            if row.get("cms_family") and row.get("cms_family") != "unknown"
        }
    )
    fingerprints = {row.get("template_fingerprint") for row in identified if row.get("template_fingerprint")}
    classes = Counter(row.get("error_class") or "unknown" for row in results)
    return {
        "candidates": len(results),
        "http_reachable": sum(1 for row in results if row.get("error_class") == "accessible"),
        "template_identified": len(identified),
        "cms_family_count": len(cms_families),
        "cms_families": cms_families,
        "template_group_count": len(fingerprints),
        "eligible_for_strict_verification": sum(1 for row in results if row.get("eligible_for_strict_verification")),
        "formally_connected": 0,
        "production_success": 0,
        "error_classes": dict(classes),
        "schema_version": SCHEMA_VERSION,
        "collection_enabled": False,
        "endpoint_verified": False,
        "peer_ip_pinned": False,
        "security_boundary": SECURITY_BOUNDARY,
    }


def persist_outputs(output_dir, kind, results):
    output_dir = Path(output_dir)
    payload = {
        "generated_at": now_iso(),
        "kind": kind,
        "schema_version": SCHEMA_VERSION,
        "note": (
            "Per-channel public homepage audit. HTTP reachability is not official identity, "
            "not collection_enabled, and not endpoint_verified. DNS checks are preflight only."
        ),
        "summary": summarize_results(results),
        "results": results,
        "collection_enabled": False,
        "endpoint_verified": False,
        "peer_ip_pinned": False,
        "security_boundary": SECURITY_BOUNDARY,
    }
    groups = build_template_groups(results, kind)
    promotion = build_promotion_candidates(results, kind)
    atomic_write_json(output_dir / "channel_audit_results.json", payload)
    atomic_write_json(output_dir / "channel_template_groups.json", groups)
    atomic_write_json(output_dir / "channel_promotion_candidates.json", promotion)
    return payload, groups, promotion


def write_recovery_checkpoint(output_dir, kind, results):
    keys = [
        {"id": row.get("id"), "requested_url": row.get("requested_url"), "schema_version": row.get("schema_version")}
        for row in results
        if row.get("audit_complete")
    ]
    atomic_write_json(
        Path(output_dir) / "channel_audit_checkpoint.json",
        {
            "updated_at": now_iso(),
            "kind": kind,
            "schema_version": SCHEMA_VERSION,
            "completed_count": len(keys),
            "resume_keys": keys,
            "note": "Recovery data only; not an official result file.",
        },
    )


def scoped_results(candidates, saved_by_key):
    ordered = []
    for entry in candidates:
        key = (entry.get("id"), entry.get("homepage_candidate"), SCHEMA_VERSION)
        item = saved_by_key.get(key)
        if item:
            ordered.append(item)
    return ordered


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
    checkpoint_every=DEFAULT_CHECKPOINT_EVERY,
    progress=None,
):
    workers = max(1, min(int(workers), HARD_MAX_WORKERS))
    checkpoint_every = int(checkpoint_every)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    candidates = load_candidates(kind, extra_files=extra_files, candidate_files=candidate_files)
    if limit is not None:
        candidates = candidates[: int(limit)]
    progress_path = output_dir / "channel_audit_progress.jsonl"
    if not resume:
        if progress_path.exists():
            progress_path.unlink()
        checkpoint_path = output_dir / "channel_audit_checkpoint.json"
        if checkpoint_path.exists():
            checkpoint_path.unlink()
        saved_items = []
    else:
        saved_items = load_progress(progress_path)
        if not saved_items:
            saved_items = load_existing_results(output_dir / "channel_audit_results.json")
    saved_by_key = {}
    for item in saved_items:
        saved_by_key[(item.get("id"), item.get("requested_url"), item.get("schema_version"))] = item
    pending = []
    for entry in candidates:
        key = (entry.get("id"), entry.get("homepage_candidate"), SCHEMA_VERSION)
        previous = saved_by_key.get(key)
        if resume and reusable_result(previous, entry):
            continue
        pending.append(entry)
    gate = HostGate()
    write_lock = threading.Lock()
    log = progress or (lambda *_args, **_kwargs: None)
    completed_since_checkpoint = 0

    def task(entry):
        return audit_candidate(
            entry, http_get=http_get, resolver=resolver, timeout=timeout, host_gate=gate
        )

    def record_item(item):
        nonlocal completed_since_checkpoint
        item["collection_enabled"] = False
        item["endpoint_verified"] = False
        item["schema_version"] = SCHEMA_VERSION
        key = (item.get("id"), item.get("requested_url"), SCHEMA_VERSION)
        with write_lock:
            saved_by_key[key] = item
            append_progress(progress_path, item)
            completed_since_checkpoint += 1
            if checkpoint_every > 0 and completed_since_checkpoint >= checkpoint_every:
                write_recovery_checkpoint(output_dir, kind, scoped_results(candidates, saved_by_key))
                completed_since_checkpoint = 0

    if not pending:
        ordered = scoped_results(candidates, saved_by_key)
        persist_outputs(output_dir, kind, ordered)
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
            record_item(item)
            log(item)

    ordered = scoped_results(candidates, saved_by_key)
    write_recovery_checkpoint(output_dir, kind, ordered)
    persist_outputs(output_dir, kind, ordered)
    return summarize_results(ordered), ordered


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Batch-audit candidate source templates")
    parser.add_argument("--kind", default="public_resource_platform")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=DEFAULT_MAX_WORKERS)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--checkpoint-every", type=int, default=DEFAULT_CHECKPOINT_EVERY)
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
        checkpoint_every=args.checkpoint_every,
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
