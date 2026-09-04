"""Server-only IQS sample test. Hard cumulative cap: 10 attempts; no retries."""
import argparse
import re
import fcntl
import json
import os
import sys
from datetime import datetime, timezone, timedelta
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

parser=argparse.ArgumentParser()
parser.add_argument("--stage", choices=["initial", "targeted"], default="initial")
args=parser.parse_args()
tasks = ([
    ("涉案虚拟货币 处置", "news", None, "NoLimit"),
    ("DOJ cryptocurrency forfeiture", "news", None, "NoLimit")
] if args.stage == "initial" else [
    ("site:justice.gov cryptocurrency forfeiture", "news", "justice.gov", "OneMonth"),
    ("site:spp.gov.cn 涉案虚拟货币 处置", "news", "spp.gov.cn", "OneMonth"),
    ("广东 数据交易所 官方", "discovery", None, "NoLimit"),
    ("四川 技术交易所 官方", "discovery", None, "NoLimit")
])

def assess(item, purpose, expected_domain, window):
    link=item.get("link") or ""
    title=item.get("title") or ""
    parsed=urlparse(link)
    host=(parsed.hostname or "").lower()
    domain_match=not expected_domain or host==expected_domain or host.endswith("."+expected_domain)
    tags=item.get("tags") or {}
    is_list=str(tags.get("isListPage", "")).lower()=="true" or bool(re.search(r"站内检索|站内搜索|搜索结果|search results",title,re.I)) or bool(re.search(r"searchservlet|/search(?:[/.]|$)",parsed.path,re.I))
    text=" ".join(str(item.get(k) or "") for k in ("title","snippet","mainText"))
    topic_match=is_relevant(text) if purpose=="news" else any(k in text for k in ("数据交易", "技术交易", "技术产权", "科技成果交易"))
    published=item.get("publishedTime")
    date_status="unknown"
    if published:
        try:
            date=datetime.fromisoformat(published.replace("Z","+00:00"))
            if date.tzinfo is None:
                date_status="timezone_unknown"
            else:
                age=datetime.now(timezone.utc)-date
                date_status="future" if age.total_seconds()<0 else ("within_30_days" if age<=timedelta(days=30) else "historical")
        except (ValueError,TypeError): date_status="invalid"
    eligible=topic_match and domain_match and (purpose=="discovery" or not is_list) and (window!="OneMonth" or date_status=="within_30_days")
    return {"title":title,"url":link,"publish_date":published,"topic_match":topic_match,
            "domain_match":domain_match,"list_page":is_list,"date_status":date_status,
            "candidate_for_review":eligible,"official_identity_verified":False,
            "snippet":(item.get("snippet") or "")[:350]}

for query, purpose, expected_domain, window in tasks:
    attempt=reserve()
    payload={"query":query,"engineType":"LiteAdvanced","timeRange":window,
             "contents":{"mainText":True,"markdownText":False,"summary":False,"rerankScore":False},
             "advancedParams":{"numResults":"10"}}
    record={"at":datetime.now(timezone.utc).isoformat(),"attempt":attempt,"query":query,"purpose":purpose,"expected_domain":expected_domain,"time_range":window}
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
            row=assess(item,purpose,expected_domain,window)
            if urlparse(row["url"]).scheme in ("http","https"):
                rows.append(row)
        record.update(request_id=data.get("requestId"),cost_credits=data.get("costCredits"),items=rows)
        print(json.dumps({"attempt":attempt,"limit":LIMIT,"query":query,"candidates":len(rows),
              "purpose":purpose,"expected_domain":expected_domain,"candidate_for_review":sum(r["candidate_for_review"] for r in rows),"domain_mismatches":sum(not r["domain_match"] for r in rows),"list_pages":sum(r["list_page"] for r in rows),"samples":sorted(rows,key=lambda r:not r["candidate_for_review"])[:4]},ensure_ascii=False))
    except (requests.RequestException,ValueError,TypeError) as exc:
        record["error_type"]=type(exc).__name__
        print("IQS request failed:",type(exc).__name__,"; attempt consumed, no retry")
        break
    finally:
        fd=os.open(RESULTS,os.O_WRONLY|os.O_APPEND|os.O_CREAT,0o600)
        with os.fdopen(fd,"a") as f:f.write(json.dumps(record,ensure_ascii=False)+"\n")
print("Sample test only: no production ingestion or scheduled IQS calls enabled")
