"""Fail closed for search hits; fetch only explicitly configured article channels."""
import re
from datetime import date
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
from app.analysis.publication import publication_evidence
from app.analysis.classify import is_relevant
from app.scraper.base import decode


def verify_search_item(item, source):
    result = dict(item)
    evidence = {"status": "needs_article_rule", "provider_date": item.get("publish_date")}
    result["verification"] = evidence
    selector = source.get("article_selector")
    if not selector:
        return result
    target, origin = urlparse(item.get("url") or ""), urlparse(source.get("url") or "")
    if (target.scheme not in ("https", "http") or not origin.hostname
            or target.hostname != origin.hostname or target.username or target.password
            or target.netloc != origin.netloc):
        evidence["status"] = "needs_domain_review"
        return result
    if source.get("article_path_pattern") and not re.fullmatch(source["article_path_pattern"], target.path):
        evidence["status"] = "not_article_path"
        return result
    try:
        # Redirects require a separately reviewed channel; never follow blindly.
        with requests.get(item["url"], timeout=(5, 15), allow_redirects=False, stream=True) as response:
            if response.status_code != 200:
                evidence["status"] = "article_http_" + str(response.status_code)
                return result
            if "html" not in response.headers.get("Content-Type", "").lower():
                evidence["status"] = "unsupported_content_type"
                return result
            chunks, size = [], 0
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > 2_000_000:
                    evidence["status"] = "article_too_large"
                    return result
                chunks.append(chunk)
        html = decode(b"".join(chunks))
        evidence.update(publication_evidence(html, item.get("publish_date")))
        soup = BeautifulSoup(html, "html.parser")
        nodes = soup.select(selector)
        if len(nodes) != 1:
            evidence["status"] = "article_container_missing_or_ambiguous"
            return result
        for node in nodes[0].select("script, style, nav, header, footer"):
            node.decompose()
        body = nodes[0].get_text(" ", strip=True)
        if len(body) < 100 or not is_relevant(body):
            evidence["status"] = "article_body_insufficient_or_irrelevant"
            return result
        published = evidence.get("publisher_date")
        if not published:
            return result
        if published > date.today().isoformat():
            evidence["status"] = "future_publication_date"
            return result
        evidence["status"] = "verified_article"
        result["publish_date"] = published
        result["summary"] = body
        return result
    except Exception as exc:
        evidence["status"] = "article_fetch_failed"
        evidence["error_type"] = type(exc).__name__
        return result
