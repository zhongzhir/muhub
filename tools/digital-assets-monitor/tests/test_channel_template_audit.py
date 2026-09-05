"""Offline tests for batch channel template audit. Network calls are injected."""
import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "research"))

from audit_channel_templates import (
    UnsafeURLError,
    analyze_html,
    atomic_write_json,
    audit_candidate,
    eligible_for_strict_verification,
    run_audit,
    validate_public_http_url,
)

SAMPLE_HTML = """<!doctype html>
<html>
<head>
  <meta name="generator" content="Epoint CMS">
  <title>{title}</title>
  <link rel="stylesheet" href="/EpointNoLogin/css/main.css">
</head>
<body>
  <script src="/EpointNoLogin/js/epoint.min.js"></script>
  <ul class="list">
    <li><a href="/jyxx/gg/001.jhtml">国有产权交易公告第一号样品标题</a></li>
    <li><a href="/jyxx/gg/002.jhtml">国有产权交易公告第二号样品标题</a></li>
    <li><a href="/jyxx/gg/003.jhtml">国有产权交易公告第三号样品标题</a></li>
    <li><a href="/jyxx/gg/004.jhtml">国有产权交易公告第四号样品标题</a></li>
    <li><a href="/jyxx/gg/005.jhtml">国有产权交易公告第五号样品标题</a></li>
  </ul>
  <a href="/cqjy/index.jhtml">产权交易</a>
  <a href="/gp/index.jhtml">挂牌公告</a>
  <a href="/cj/index.jhtml">成交公告</a>
  <a href="/zc/index.jhtml">资产处置</a>
</body>
</html>
"""


class FakeResponse:
    def __init__(self, url, status=200, content=b"", headers=None, location=None):
        self.url = url
        self.status_code = status
        self._content = content
        self.headers = dict(headers or {"Content-Type": "text/html; charset=utf-8"})
        if location:
            self.headers["Location"] = location

    def iter_content(self, chunk_size=65536):
        data = self._content
        for index in range(0, len(data), chunk_size):
            yield data[index:index + chunk_size]

    def close(self):
        return None


def public_entry(**overrides):
    row = {
        "id": "cand-1",
        "name": "示例公共资源交易平台",
        "kind": "public_resource_platform",
        "province": "测试",
        "homepage_candidate": "https://ggzy.example.gov.cn/",
        "identity_status": "official_national_directory_candidate",
        "collection_enabled": False,
        "endpoint_verified": False,
    }
    row.update(overrides)
    return row


def no_dns(_host):
    return []


class ChannelTemplateAuditTests(unittest.TestCase):
    def test_private_and_dangerous_urls_rejected(self):
        blocked = [
            "http://127.0.0.1/",
            "http://localhost/admin",
            "http://192.168.1.8/notice",
            "http://10.0.0.9/",
            "http://172.16.5.4/",
            "http://[::1]/",
            "http://169.254.169.254/latest/meta-data",
            "https://user:pass@example.gov.cn/",
            "ftp://ggzy.example.gov.cn/",
            "file:///etc/passwd",
            "javascript:alert(1)",
        ]
        for url in blocked:
            with self.subTest(url=url):
                with self.assertRaises(UnsafeURLError):
                    validate_public_http_url(url, resolver=no_dns)
        validate_public_http_url("https://ggzy.example.gov.cn/", resolver=no_dns)
        with self.assertRaises(UnsafeURLError):
            validate_public_http_url("https://evil.example", resolver=lambda host: ["127.0.0.1"])
        calls = []

        def http_get(url, timeout, headers):
            calls.append(url)
            return FakeResponse(url)

        result = audit_candidate(
            public_entry(homepage_candidate="http://127.0.0.1/"),
            http_get=http_get,
            resolver=no_dns,
        )
        self.assertEqual(result["error_class"], "unsafe_url")
        self.assertEqual(calls, [])
        self.assertFalse(result["collection_enabled"])
        self.assertFalse(result["endpoint_verified"])

    def test_page_size_limit(self):
        huge = b"<html>" + (b"A" * 2_000_100) + b"</html>"

        def http_get(url, timeout, headers):
            return FakeResponse(url, content=huge)

        result = audit_candidate(public_entry(), http_get=http_get, resolver=no_dns)
        self.assertEqual(result["error_class"], "response_too_large")
        self.assertLessEqual(result["page_bytes"], 2_000_000)
        self.assertIsNone(result["template_fingerprint"])

    def test_timeout_and_403_classification(self):
        def boom(url, timeout, headers):
            raise requests.exceptions.ReadTimeout("read timed out")

        timed = audit_candidate(public_entry(), http_get=boom, resolver=no_dns)
        self.assertEqual(timed["error_class"], "timeout")

        def forbidden(url, timeout, headers):
            return FakeResponse(url, status=403, content=b"blocked")

        denied = audit_candidate(public_entry(), http_get=forbidden, resolver=no_dns)
        self.assertEqual(denied["error_class"], "access_restricted")
        self.assertEqual(denied["http_status"], 403)
        self.assertFalse(denied["eligible_for_strict_verification"])

    def test_redirect_host_is_recorded_not_treated_as_official(self):
        calls = []

        def http_get(url, timeout, headers):
            calls.append(url)
            if url == "https://ggzy.example.gov.cn/":
                return FakeResponse(
                    url,
                    status=302,
                    location="https://other.example.gov.cn/portal",
                )
            return FakeResponse(
                url,
                content=SAMPLE_HTML.format(title="跳转后的门户").encode("utf-8"),
            )

        result = audit_candidate(public_entry(), http_get=http_get, resolver=no_dns)
        self.assertEqual(result["requested_url"], "https://ggzy.example.gov.cn/")
        self.assertEqual(result["final_url"], "https://other.example.gov.cn/portal")
        self.assertTrue(result["redirected_host_differs"])
        self.assertTrue(result["redirected_host_not_treated_as_official"])
        self.assertEqual(result["official_identity"], "still_candidate")
        self.assertIn("redirect_host_changed", result["needs_human_review"])
        self.assertFalse(result["eligible_for_strict_verification"])
        self.assertEqual(calls, ["https://ggzy.example.gov.cn/", "https://other.example.gov.cn/portal"])

    def test_template_fingerprint_is_stable(self):
        first = analyze_html(SAMPLE_HTML.format(title="甲省公共资源交易平台"), "https://a.example.gov.cn/", {})
        second = analyze_html(SAMPLE_HTML.format(title="乙省公共资源交易中心"), "https://b.example.gov.cn/", {})
        self.assertTrue(first["template_identified"])
        self.assertEqual(first["template_fingerprint"], second["template_fingerprint"])
        self.assertEqual(first["cms_family"], "epoint")
        self.assertIn("jhtml", first["detail_path_patterns"])
        self.assertGreater(first["column_link_counts"]["property"], 0)
        other = analyze_html(
            SAMPLE_HTML.format(title="另一套新点皮肤").replace("/EpointNoLogin/js/epoint.min.js", "/custom/skin.js"),
            "https://c.example.gov.cn/",
            {},
        )
        self.assertEqual(first["template_fingerprint"], other["template_fingerprint"])

    def test_generic_government_portal_is_not_promoted(self):
        html = SAMPLE_HTML.format(title="吉林省人民政府")

        def http_get(url, timeout, headers):
            return FakeResponse(url, content=html.encode("utf-8"))

        result = audit_candidate(public_entry(), http_get=http_get, resolver=no_dns)
        self.assertIn("homepage_title_not_trading_platform", result["needs_human_review"])
        self.assertFalse(result["shared_collector_ready"])
        self.assertFalse(result["eligible_for_strict_verification"])

    def test_resume_skips_completed_candidates(self):
        with tempfile.TemporaryDirectory() as folder:
            candidates = Path(folder) / "candidates.json"
            output = Path(folder) / "out"
            rows = [
                public_entry(id="a", homepage_candidate="https://a.example.gov.cn/"),
                public_entry(id="b", homepage_candidate="https://b.example.gov.cn/"),
            ]
            candidates.write_text(json.dumps(rows), encoding="utf-8")
            calls = []

            def http_get(url, timeout, headers):
                calls.append(url)
                return FakeResponse(url, content=SAMPLE_HTML.format(title=url).encode("utf-8"))

            run_audit(
                "public_resource_platform",
                output,
                limit=1,
                workers=1,
                http_get=http_get,
                resolver=no_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(calls, ["https://a.example.gov.cn/"])
            run_audit(
                "public_resource_platform",
                output,
                workers=1,
                resume=True,
                http_get=http_get,
                resolver=no_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(calls, ["https://a.example.gov.cn/", "https://b.example.gov.cn/"])
            saved = json.loads((output / "channel_audit_results.json").read_text(encoding="utf-8"))
            self.assertEqual({row["id"] for row in saved["results"]}, {"a", "b"})

    def test_candidates_are_not_auto_promoted(self):
        sources = Path(__file__).resolve().parents[1] / "config" / "sources.json"
        before = hashlib.sha256(sources.read_bytes()).hexdigest()
        with tempfile.TemporaryDirectory() as folder:
            candidates = Path(folder) / "candidates.json"
            output = Path(folder) / "out"
            candidates.write_text(json.dumps([public_entry()]), encoding="utf-8")

            def http_get(url, timeout, headers):
                return FakeResponse(url, content=SAMPLE_HTML.format(title="示例").encode("utf-8"))

            summary, results = run_audit(
                "public_resource_platform",
                output,
                workers=1,
                http_get=http_get,
                resolver=no_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(summary["formally_connected"], 0)
            self.assertEqual(summary["production_success"], 0)
            self.assertFalse(summary["collection_enabled"])
            self.assertFalse(results[0]["collection_enabled"])
            self.assertFalse(results[0]["endpoint_verified"])
            self.assertTrue(results[0]["eligible_for_strict_verification"])
            self.assertTrue(eligible_for_strict_verification(results[0]))
            promotion = json.loads((output / "channel_promotion_candidates.json").read_text(encoding="utf-8"))
            self.assertFalse(promotion["promoted_to_production"])
            self.assertFalse(promotion["collection_enabled"])
            self.assertFalse(promotion["endpoint_verified"])
            self.assertEqual(promotion["candidates"][0]["next_step"], "strict_verification")
        self.assertEqual(hashlib.sha256(sources.read_bytes()).hexdigest(), before)

    def test_atomic_write_replaces_complete_json(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "channel_audit_results.json"
            path.write_text("{broken", encoding="utf-8")
            atomic_write_json(path, {"ok": True, "items": [1, 2, 3]})
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(payload, {"ok": True, "items": [1, 2, 3]})
            leftovers = [name for name in os.listdir(folder) if name.endswith(".tmp")]
            self.assertEqual(leftovers, [])

    def test_workers_are_capped_and_same_host_serialized(self):
        with tempfile.TemporaryDirectory() as folder:
            candidates = Path(folder) / "candidates.json"
            output = Path(folder) / "out"
            rows = [
                public_entry(id="one", homepage_candidate="https://same.example.gov.cn/a"),
                public_entry(id="two", homepage_candidate="https://same.example.gov.cn/b"),
            ]
            candidates.write_text(json.dumps(rows), encoding="utf-8")
            inflight = []
            max_inflight = [0]
            lock_state = {"active": 0}

            def http_get(url, timeout, headers):
                lock_state["active"] += 1
                max_inflight[0] = max(max_inflight[0], lock_state["active"])
                inflight.append(url)
                lock_state["active"] -= 1
                return FakeResponse(url, content=SAMPLE_HTML.format(title=url).encode("utf-8"))

            run_audit(
                "public_resource_platform",
                output,
                workers=99,
                http_get=http_get,
                resolver=no_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(max_inflight[0], 1)
            self.assertEqual(len(inflight), 2)


if __name__ == "__main__":
    unittest.main()
