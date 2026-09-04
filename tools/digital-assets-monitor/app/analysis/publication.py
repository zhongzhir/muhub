"""Extract explicit publisher dates. Search-provider timestamps are never authority."""
from datetime import date
import re
from bs4 import BeautifulSoup

PUBLISHED={"firstpublishedtime", "article:published_time", "datepublished", "publishdate", "pubdate"}
MODIFIED={"lastmodifiedtime", "article:modified_time", "datemodified"}

def normalized_date(value):
    match=re.match(r"^\s*(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日|\b|T|[- ])",str(value or ""))
    if not match:return None
    try:return date(*map(int,match.groups())).isoformat()
    except ValueError:return None

def publication_evidence(html, provider_date=None):
    soup=BeautifulSoup(html,"html.parser")
    published=[];modified=[]
    for node in soup.select("meta[content], [itemprop='datePublished'], [itemprop='dateModified']"):
        key=(node.get("name") or node.get("property") or node.get("itemprop") or "").lower()
        value=node.get("content") or node.get("datetime") or node.get_text(strip=True)
        parsed=normalized_date(value)
        if parsed and key in PUBLISHED:published.append({"field":key,"raw":value,"date":parsed})
        if parsed and key in MODIFIED:modified.append({"field":key,"raw":value,"date":parsed})
    dates={entry["date"] for entry in published}
    publisher_date=next(iter(dates)) if len(dates)==1 else None
    provider_day=normalized_date(provider_date)
    return {"publisher_date":publisher_date,"provider_date":provider_date,
            "status":"publisher_metadata" if publisher_date else ("conflicting_publisher_dates" if dates else "unverified"),
            "provider_date_conflict":bool(publisher_date and provider_day and publisher_date!=provider_day),
            "published_evidence":published,"modified_evidence":modified}
