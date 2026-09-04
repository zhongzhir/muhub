"""Read-only public channel probe. Uses no database and no IQS."""
import json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.config import get_sources
from app.scraper.pipeline import _source_items,should_verify_article
from app.scraper.verification import verify_search_item
ids={"police-tianjin","police-ningde","police-chongqing"}
out=[]
for source in get_sources()["sources"]:
    if source["id"] not in ids: continue
    rows=_source_items(source)
    selected=[item for item in rows if should_verify_article(item,source)]
    # Verify one ordinary sample too, so body and official identity rules are exercised.
    probes=[]
    for item in (selected or rows[:1]):
        probes.append(verify_search_item(item,source))
        if len(probes)>=10: break
    out.append({"id":source["id"],"list_items":len(rows),"discovery_candidates":len(selected),
        "verified_relevant":sum(i["verification"]["status"]=="verified_article" for i in probes),
        "probe_statuses":[i["verification"]["status"] for i in probes]})
print(json.dumps(out,ensure_ascii=False,indent=2))
