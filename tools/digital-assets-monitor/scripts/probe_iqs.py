"""Server-only IQS sample test. Hard cumulative cap: 10 attempts; no retries."""
import fcntl
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import requests

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.analysis.classify import is_relevant

LIMIT=10
COUNTER=Path("/var/lib/digital-assets-monitor/iqs-probe-attempts.txt")
RESULTS=Path("/var/lib/digital-assets-monitor/iqs-probe-results.jsonl")
config=dict(line.split("=",1) for line in Path("/etc/digital-assets-monitor.env").read_text().splitlines() if line and not line.startswith("#"))
key=config.get("IQS_API_KEY", "").strip()
if not key:
    raise SystemExit("IQS_API_KEY is missing; no API request sent")

def reserve():
    fd=os.open(COUNTER,os.O_RDWR|os.O_CREAT,0o600)
    with os.fdopen(fd,"r+") as f:
        fcntl.flock(f,fcntl.LOCK_EX)
        value=f.read().strip()
        used=int(value) if value else 0
        if used < 0 or used >= LIMIT:
            raise SystemExit("10-attempt verification budget exhausted; no API request sent")
        used+=1
        f.seek(0);f.truncate();f.write(str(used));f.flush();os.fsync(f.fileno())
        return used

queries=["涉案虚拟货币 处置", "DOJ cryptocurrency forfeiture"]
for query in queries:
    attempt=reserve()
    payload={"query":query,"engineType":"LiteAdvanced","timeRange":"NoLimit",
             "contents":{"mainText":True,"markdownText":False,"summary":False,"rerankScore":False},
             "advancedParams":{"numResults":10}}
    record={"at":datetime.now(timezone.utc).isoformat(),"attempt":attempt,"query":query}
    try:
        response=requests.post("https://cloud-iqs.aliyuncs.com/search/unified",
            headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"},
            json=payload,timeout=(5,20),allow_redirects=False)
        record["http_status"]=response.status_code
        if response.status_code != 200:
            print("IQS HTTP",response.status_code,"attempt",attempt,"/",LIMIT,"; stopping without retry")
            break
        data=response.json()
        if not isinstance(data,dict) or not isinstance(data.get("pageItems"),list):
            raise ValueError("Unexpected IQS response schema")
        rows=[]
        for item in data["pageItems"]:
            text=" ".join(str(item.get(k) or "") for k in ("title","snippet","mainText"))
            link=item.get("link") or ""
            if urlparse(link).scheme not in ("http","https"):continue
            rows.append({"title":item.get("title"),"url":link,"publish_date":item.get("publishedTime"),
                         "relevant":is_relevant(text),"snippet":(item.get("snippet") or "")[:500]})
        record.update(request_id=data.get("requestId"),cost_credits=data.get("costCredits"),items=rows)
        print(json.dumps({"attempt":attempt,"limit":LIMIT,"query":query,"candidates":len(rows),
              "relevant":sum(r["relevant"] for r in rows),"samples":sorted(rows,key=lambda r:not r["relevant"])[:3]},ensure_ascii=False))
    except (requests.RequestException,ValueError,TypeError) as exc:
        record["error_type"]=type(exc).__name__
        print("IQS request failed:",type(exc).__name__,"; attempt consumed, no retry")
        break
    finally:
        fd=os.open(RESULTS,os.O_WRONLY|os.O_APPEND|os.O_CREAT,0o600)
        with os.fdopen(fd,"a") as f:f.write(json.dumps(record,ensure_ascii=False)+"\n")
print("Sample test only: no production ingestion or scheduled IQS calls enabled")
