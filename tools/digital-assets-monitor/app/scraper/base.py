"""通用抓取基础模块：UA 轮换、编码探测、超时与重试。"""
import io
import random
import re
import time

import requests

from app.config import get_settings


class FetchError(Exception):
    pass


def _settings():
    return get_settings().get("scanner", {})


def pick_ua():
    uas = _settings().get("user_agents", [])
    return random.choice(uas) if uas else "Mozilla/5.0"


def throttle():
    p = _settings().get("fetch_pause_range_seconds", [0.3, 1.0])
    time.sleep(random.uniform(*p))


def detect_encoding(raw: bytes):
    if raw[:3] == b"\xef\xbb\xbf":
        return "utf-8"
    m = re.search(br"charset=[\"']?\s*([a-zA-Z0-9_\-]+)", raw[:4096], re.I)
    if m:
        return m.group(1).decode("ascii", "ignore")
    for enc in ("utf-8", "gb18030", "gbk"):
        try:
            raw.decode(enc)
            return enc
        except (UnicodeDecodeError, ValueError):
            continue
    return "utf-8"


def decode(raw: bytes):
    enc = detect_encoding(raw)
    return raw.decode(enc, errors="replace")


def html_response_to_xml(text: str):
    """部分源以 HTML 响应但实测为 XML/ATOM，做必要规范化（去除多余命名空间前缀）。"""
    if text.lstrip().startswith("<?xml"):
        return text
    return text


def fetch(url, headers=None, timeout=None, retries=2):
    t = timeout or _settings().get("request_timeout_seconds", 20)
    base_headers = {
        "User-Agent": pick_ua(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    if headers:
        base_headers.update(headers)
    last_err = None
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, headers=base_headers, timeout=t, allow_redirects=True)
            if resp.status_code >= 400:
                raise FetchError(f"HTTP {resp.status_code}")
            return resp
        except Exception as e:  # noqa
            last_err = e
            time.sleep(0.8 * (attempt + 1))
    raise FetchError(f"fetch failed: {last_err}")


def absolute_url(base, href):
    if not href:
        return None
    href = href.strip()
    if href.startswith("http"):
        return href
    from urllib.parse import urljoin

    result = urljoin(base, href)
    from urllib.parse import urlparse
    return result if urlparse(result).scheme in ("http", "https") else None
