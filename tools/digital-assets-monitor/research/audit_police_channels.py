"""Audit directory candidates and harvest explicitly labelled public police links."""
import concurrent.futures
from datetime import datetime, timezone
import json
import sys
import hashlib
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
ROOT = Path(__file__).resolve().parent

def inspect(entry):
    result = {"institution_id": entry["id"], "name": entry["name"], "province": entry["province"],
              "directory_evidence": entry["discovery_evidence_url"], "requested_url": entry["homepage_candidate"],
              "checked_at": datetime.now(timezone.utc).isoformat(), "status": "unreachable", "links": []}
    try:
        with requests.get(entry["homepage_candidate"], timeout=(5, 8), stream=True) as response:
            result.update(http_status=response.status_code, final_url=response.url)
            data = bytearray()
            for chunk in response.iter_content(65536):
                data.extend(chunk)
                if len(data) > 2_000_000:
                    result["status"] = "response_too_large"
                    return result
            response.raise_for_status()
        soup = BeautifulSoup(bytes(data), "html.parser")
        result["title"] = soup.title.get_text(strip=True) if soup.title else None
        result["status"] = "http_ok_identity_unverified"
        seen = set()
        for a in soup.select("a[href]"):
            label = a.get_text(" ", strip=True) or a.get("title", "")
            url = urljoin(result["final_url"], a["href"])
            host = urlparse(url).hostname or ""
            if (re.fullmatch(r"[\u4e00-\u9fff]{2,30}公安(?:厅|局|分局)(?:门户网站|官方网站|网站)?", label)
                    and urlparse(url).scheme in ("http", "https")
                    and host.endswith(".gov.cn") and (label, url) not in seen):
                seen.add((label, url))
                result["links"].append({"name": label, "homepage_candidate": url,
                    "evidence_url": result["final_url"], "identity_status": "official_page_link_candidate",
                    "collection_enabled": False})
    except Exception as exc:
        result["error_type"] = type(exc).__name__
    return result

if __name__ == "__main__":
    entries = [r for r in json.loads((ROOT / "institution_candidates.json").read_text(encoding="utf-8")) if r["kind"] == "police"]
    phase = "province"
    if "--city" in sys.argv:
        phase = "city"
        known_hosts = {urlparse(row["homepage_candidate"]).hostname for row in entries}
        candidates = json.loads((ROOT / "police_link_candidates.json").read_text(encoding="utf-8"))
        targets = {}
        for row in candidates:
            parsed = urlparse(row["homepage_candidate"])
            if parsed.hostname in known_hosts:
                continue
            key = (parsed.hostname, parsed.path.rstrip("/"))
            targets.setdefault(key, {"id": hashlib.sha256(row["homepage_candidate"].encode()).hexdigest()[:16],
                "name": row["name"], "province": None, "homepage_candidate": row["homepage_candidate"],
                "discovery_evidence_url": row["evidence_url"]})
        entries = list(targets.values())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(inspect, entries))
    (ROOT / ("police_city_channel_audit.json" if phase == "city" else "police_channel_audit.json")).write_text(json.dumps(results, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    links = {}
    for row in results:
        for link in row["links"]:
            key = (link["name"], link["homepage_candidate"])
            if key not in links:
                links[key] = dict(link, evidence_urls=[])
            links[key]["evidence_urls"].append(link["evidence_url"])
    (ROOT / ("police_county_link_candidates.json" if phase == "city" else "police_link_candidates.json")).write_text(json.dumps(list(links.values()), ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"audited": len(results), "http_ok": sum(r["status"]=="http_ok_identity_unverified" for r in results), "unique_link_candidates": len(links), "operational_channels_added": 0}, ensure_ascii=False))
