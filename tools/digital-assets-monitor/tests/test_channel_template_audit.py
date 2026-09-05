"""Offline tests for batch channel template audit. Network calls are injected."""
import hashlib
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "research"))

from audit_channel_templates import (
    DnsResolutionError,
    DnsTimeoutError,
    SCHEMA_VERSION,
    UnsafeURLError,
    analyze_html,
    atomic_write_json,
    audit_candidate,
    eligible_for_strict_verification,
    inspect_public_http_url,
    load_candidates,
    persist_outputs,
    police_candidate_counts,
    run_audit,
    stable_candidate_id,
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

ALT_DETAIL_HTML = SAMPLE_HTML.replace("/jyxx/gg/", "/info/").replace(".jhtml", ".shtml")
PUBLIC_IP = "8.8.8.8"


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


def public_dns(_host):
    return [PUBLIC_IP]


def empty_dns(_host):
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
                    validate_public_http_url(url, resolver=public_dns)
        inspected = inspect_public_http_url("https://ggzy.example.gov.cn/", resolver=public_dns)
        self.assertEqual(inspected["resolved_ips"], [PUBLIC_IP])
        with self.assertRaises(UnsafeURLError):
            validate_public_http_url("https://evil.example", resolver=lambda host: ["127.0.0.1"])
        with self.assertRaises(UnsafeURLError):
            validate_public_http_url("https://mixed.example", resolver=lambda host: [PUBLIC_IP, "10.0.0.1"])
        calls = []

        def http_get(url, timeout, headers):
            calls.append(url)
            return FakeResponse(url)

        result = audit_candidate(
            public_entry(homepage_candidate="http://127.0.0.1/"),
            http_get=http_get,
            resolver=public_dns,
        )
        self.assertEqual(result["error_class"], "unsafe_url")
        self.assertEqual(calls, [])
        self.assertFalse(result["collection_enabled"])
        self.assertFalse(result["endpoint_verified"])

    def test_empty_or_failed_dns_is_not_treated_as_public(self):
        with self.assertRaises(DnsResolutionError):
            inspect_public_http_url("https://ggzy.example.gov.cn/", resolver=empty_dns)

        def boom(_host):
            raise DnsTimeoutError("dns_lookup_timed_out")

        with self.assertRaises(DnsTimeoutError):
            inspect_public_http_url("https://ggzy.example.gov.cn/", resolver=boom)
        calls = []

        def http_get(url, timeout, headers):
            calls.append(url)
            return FakeResponse(url)

        missing = audit_candidate(public_entry(), http_get=http_get, resolver=empty_dns)
        self.assertEqual(missing["error_class"], "dns_error")
        timed = audit_candidate(public_entry(), http_get=http_get, resolver=boom)
        self.assertEqual(timed["error_class"], "dns_timeout")
        self.assertEqual(calls, [])

    def test_page_size_limit(self):
        huge = b"<html>" + (b"A" * 2_000_100) + b"</html>"

        def http_get(url, timeout, headers):
            return FakeResponse(url, content=huge)

        result = audit_candidate(public_entry(), http_get=http_get, resolver=public_dns)
        self.assertEqual(result["error_class"], "response_too_large")
        self.assertLessEqual(result["page_bytes"], 2_000_000)
        self.assertIsNone(result["template_fingerprint"])

    def test_timeout_and_403_classification(self):
        def boom(url, timeout, headers):
            raise requests.exceptions.ReadTimeout("read timed out")

        timed = audit_candidate(public_entry(), http_get=boom, resolver=public_dns)
        self.assertEqual(timed["error_class"], "timeout")

        def forbidden(url, timeout, headers):
            return FakeResponse(url, status=403, content=b"blocked")

        denied = audit_candidate(public_entry(), http_get=forbidden, resolver=public_dns)
        self.assertEqual(denied["error_class"], "access_restricted")
        self.assertEqual(denied["http_status"], 403)
        self.assertFalse(denied["eligible_for_strict_verification"])

    def test_redirect_host_is_recorded_not_treated_as_official(self):
        calls = []
        resolved = []

        def resolver(host):
            resolved.append(host)
            return [PUBLIC_IP]

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

        result = audit_candidate(public_entry(), http_get=http_get, resolver=resolver)
        self.assertEqual(result["requested_url"], "https://ggzy.example.gov.cn/")
        self.assertEqual(result["final_url"], "https://other.example.gov.cn/portal")
        self.assertTrue(result["redirected_host_differs"])
        self.assertTrue(result["redirected_host_not_treated_as_official"])
        self.assertEqual(result["official_identity"], "still_candidate")
        self.assertIn("redirect_host_changed", result["needs_human_review"])
        self.assertFalse(result["eligible_for_strict_verification"])
        self.assertEqual(calls, ["https://ggzy.example.gov.cn/", "https://other.example.gov.cn/portal"])
        self.assertIn("ggzy.example.gov.cn", resolved)
        self.assertIn("other.example.gov.cn", resolved)
        self.assertFalse(result["peer_ip_pinned"])

    def test_template_fingerprint_splits_structure_not_province(self):
        first = analyze_html(SAMPLE_HTML.format(title="甲省公共资源交易平台"), "https://a.example.gov.cn/", {})
        second = analyze_html(SAMPLE_HTML.format(title="乙省公共资源交易中心"), "https://b.example.gov.cn/", {})
        self.assertTrue(first["template_identified"])
        self.assertEqual(first["template_fingerprint"], second["template_fingerprint"])
        self.assertEqual(first["cms_family"], "epoint")
        self.assertEqual(first["cms_family"], second["cms_family"])
        self.assertIn("jhtml", first["detail_path_patterns"])
        self.assertGreater(first["column_link_counts"]["property"], 0)
        other_detail = analyze_html(
            ALT_DETAIL_HTML.format(title="另一路径结构的新点站点"),
            "https://c.example.gov.cn/",
            {},
        )
        self.assertEqual(other_detail["cms_family"], "epoint")
        self.assertNotEqual(first["template_fingerprint"], other_detail["template_fingerprint"])

    def test_generic_government_portal_is_not_promoted(self):
        html = SAMPLE_HTML.format(title="吉林省人民政府")

        def http_get(url, timeout, headers):
            return FakeResponse(url, content=html.encode("utf-8"))

        result = audit_candidate(public_entry(), http_get=http_get, resolver=public_dns)
        self.assertIn("homepage_title_not_trading_platform", result["needs_human_review"])
        self.assertFalse(result["shared_collector_ready"])
        self.assertFalse(result["eligible_for_strict_verification"])

    def test_resume_skips_completed_candidates_but_rechecks_url_and_schema(self):
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
                resolver=public_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(calls, ["https://a.example.gov.cn/"])
            first = json.loads((output / "channel_audit_results.json").read_text(encoding="utf-8"))
            self.assertEqual([row["id"] for row in first["results"]], ["a"])
            run_audit(
                "public_resource_platform",
                output,
                workers=1,
                resume=True,
                http_get=http_get,
                resolver=public_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(calls, ["https://a.example.gov.cn/", "https://b.example.gov.cn/"])
            saved = json.loads((output / "channel_audit_results.json").read_text(encoding="utf-8"))
            self.assertEqual({row["id"] for row in saved["results"]}, {"a", "b"})
            self.assertTrue(all(row["schema_version"] == SCHEMA_VERSION for row in saved["results"]))

            changed = [
                public_entry(id="a", homepage_candidate="https://a2.example.gov.cn/"),
                public_entry(id="b", homepage_candidate="https://b.example.gov.cn/"),
            ]
            candidates.write_text(json.dumps(changed), encoding="utf-8")
            run_audit(
                "public_resource_platform",
                output,
                workers=1,
                resume=True,
                http_get=http_get,
                resolver=public_dns,
                candidate_files=[candidates],
            )
            self.assertIn("https://a2.example.gov.cn/", calls)
            self.assertEqual(calls.count("https://b.example.gov.cn/"), 1)

    def test_limit_does_not_mix_out_of_scope_old_results(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "out"
            output.mkdir()
            stale = public_entry(id="stale", homepage_candidate="https://old.example.gov.cn/")
            stale_result = audit_candidate(
                stale,
                http_get=lambda url, timeout, headers: FakeResponse(
                    url, content=SAMPLE_HTML.format(title="旧").encode("utf-8")
                ),
                resolver=public_dns,
            )
            (output / "channel_audit_progress.jsonl").write_text(
                json.dumps(stale_result, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            candidates = Path(folder) / "candidates.json"
            rows = [
                public_entry(id="a", homepage_candidate="https://a.example.gov.cn/"),
                public_entry(id="b", homepage_candidate="https://b.example.gov.cn/"),
            ]
            candidates.write_text(json.dumps(rows), encoding="utf-8")

            def http_get(url, timeout, headers):
                return FakeResponse(url, content=SAMPLE_HTML.format(title=url).encode("utf-8"))

            summary, results = run_audit(
                "public_resource_platform",
                output,
                limit=1,
                workers=1,
                resume=True,
                http_get=http_get,
                resolver=public_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(summary["candidates"], 1)
            self.assertEqual([row["id"] for row in results], ["a"])
            saved = json.loads((output / "channel_audit_results.json").read_text(encoding="utf-8"))
            self.assertEqual([row["id"] for row in saved["results"]], ["a"])
            self.assertNotIn("stale", {row["id"] for row in saved["results"]})

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
                resolver=public_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(summary["formally_connected"], 0)
            self.assertEqual(summary["production_success"], 0)
            self.assertFalse(summary["collection_enabled"])
            self.assertFalse(results[0]["collection_enabled"])
            self.assertFalse(results[0]["endpoint_verified"])
            self.assertFalse(results[0]["confirmed_institution"])
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
                time.sleep(0.02)
                lock_state["active"] -= 1
                return FakeResponse(url, content=SAMPLE_HTML.format(title=url).encode("utf-8"))

            run_audit(
                "public_resource_platform",
                output,
                workers=99,
                http_get=http_get,
                resolver=public_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(max_inflight[0], 1)
            self.assertEqual(len(inflight), 2)

    def test_redirects_to_same_host_are_serialized(self):
        with tempfile.TemporaryDirectory() as folder:
            candidates = Path(folder) / "candidates.json"
            output = Path(folder) / "out"
            rows = [
                public_entry(id="left", homepage_candidate="https://left.example.gov.cn/"),
                public_entry(id="right", homepage_candidate="https://right.example.gov.cn/"),
            ]
            candidates.write_text(json.dumps(rows), encoding="utf-8")
            shared = "https://shared.example.gov.cn/portal"
            max_shared = [0]
            active = {"n": 0}
            gate = threading.Lock()

            def http_get(url, timeout, headers):
                if url in {"https://left.example.gov.cn/", "https://right.example.gov.cn/"}:
                    return FakeResponse(url, status=302, location=shared)
                with gate:
                    active["n"] += 1
                    max_shared[0] = max(max_shared[0], active["n"])
                time.sleep(0.05)
                with gate:
                    active["n"] -= 1
                return FakeResponse(url, content=SAMPLE_HTML.format(title=url).encode("utf-8"))

            run_audit(
                "public_resource_platform",
                output,
                workers=2,
                http_get=http_get,
                resolver=public_dns,
                candidate_files=[candidates],
            )
            self.assertEqual(max_shared[0], 1)

    def test_police_province_city_and_county_candidates_load(self):
        rows = load_candidates("police")
        counts = police_candidate_counts(rows)
        self.assertGreaterEqual(counts["province_directory"], 32)
        self.assertGreaterEqual(counts["city_link"], 1)
        self.assertGreaterEqual(counts["county_link"], 1)
        self.assertGreater(counts["total"], counts["province_directory"])
        self.assertEqual(counts["confirmed_institutions"], 0)
        self.assertTrue(all(row.get("kind") == "police" for row in rows))
        self.assertTrue(all(row.get("id") for row in rows))
        self.assertTrue(all(row.get("homepage_candidate") for row in rows))
        generated = [
            row for row in rows if row.get("source_layer") in {"city_link", "county_link"}
        ]
        self.assertTrue(generated)
        for row in generated:
            self.assertEqual(
                row["id"],
                stable_candidate_id("police", row["name"], row["homepage_candidate"]),
            )
            self.assertEqual(row.get("identity_status"), "official_page_link_candidate")
            self.assertFalse(row.get("confirmed_institution"))
        names = {row["name"] for row in rows}
        self.assertIn("北京市公安局", names)
        self.assertTrue(any("公安局" in (row["name"] or "") and row.get("source_layer") == "city_link" for row in rows))
        self.assertTrue(any(row.get("source_layer") == "county_link" for row in rows))

    def test_official_files_are_not_rewritten_for_every_candidate(self):
        with tempfile.TemporaryDirectory() as folder:
            candidates = Path(folder) / "candidates.json"
            output = Path(folder) / "out"
            rows = [
                public_entry(
                    id=f"n{index}",
                    homepage_candidate=f"https://n{index}.example.gov.cn/",
                    name=f"模拟平台{index}",
                )
                for index in range(500)
            ]
            candidates.write_text(json.dumps(rows), encoding="utf-8")
            writes = {"n": 0}
            original = persist_outputs

            def counted(output_dir, kind, results):
                writes["n"] += 1
                return original(output_dir, kind, results)

            def http_get(url, timeout, headers):
                return FakeResponse(url, content=SAMPLE_HTML.format(title=url).encode("utf-8"))

            with patch("audit_channel_templates.persist_outputs", counted):
                summary, results = run_audit(
                    "public_resource_platform",
                    output,
                    workers=6,
                    http_get=http_get,
                    resolver=public_dns,
                    candidate_files=[candidates],
                    checkpoint_every=25,
                )
            self.assertEqual(len(results), 500)
            self.assertEqual(summary["candidates"], 500)
            self.assertLess(writes["n"], 500)
            self.assertEqual(writes["n"], 1)
            progress_lines = (output / "channel_audit_progress.jsonl").read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(progress_lines), 500)
            checkpoint = json.loads((output / "channel_audit_checkpoint.json").read_text(encoding="utf-8"))
            self.assertEqual(checkpoint["completed_count"], 500)


if __name__ == "__main__":
    unittest.main()
