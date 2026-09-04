"""Read-only public HTTP probe; isolated SQLite only, no IQS or production writes."""
import json
import sqlite3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import get_sources
from app import database as db
from app.scraper.pipeline import _source_items, _content_text, process_item, should_verify_article
from app.scraper.verification import verify_search_item
from app.analysis.classify import is_relevant

source = next(s for s in get_sources()["sources"] if s["id"] == "policy-supreme")
rows = _source_items(source)
candidates = [item for item in rows if should_verify_article(item, source)][:5]
conn = sqlite3.connect(":memory:")
conn.executescript(db.SCHEMA)
result = {"source": source["url"], "list_count": len(rows), "relevant_candidates_tested": len(candidates), "inserted": 0, "samples": []}
for item in candidates:
    verified = verify_search_item(item, source)
    result["inserted"] = process_item(conn, verified, source, result["inserted"])
    result["samples"].append({"title": item["title"], "url": item["url"], "verification": verified["verification"]})
result["evidence_rows"] = conn.execute("SELECT COUNT(*) FROM items WHERE raw IS NOT NULL").fetchone()[0]
print(json.dumps(result, ensure_ascii=False, indent=2))
conn.close()
