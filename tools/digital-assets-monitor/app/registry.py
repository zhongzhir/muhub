"""Synchronize evidenced candidates. Discovery is never promoted to operational coverage."""
import hashlib,json
from pathlib import Path
from app import database as db
from app.config import get_sources
ROOT=Path(__file__).resolve().parents[1]/"research"

def _id(name,url): return hashlib.sha256((name+"|"+(url or "")).encode()).hexdigest()[:16]

def sync_registry():
    files=[ROOT/"institution_candidates.json",ROOT/"technology_supplement_candidates.json",ROOT/"public_resource_platform_candidates.json"]
    conn=db.connect()
    try:
        conn.execute("BEGIN")
        for path in files:
            if not path.exists(): continue
            for row in json.loads(path.read_text(encoding="utf-8")):
                iid=row.get("id") or _id(row["name"],row.get("homepage_candidate"))
                conn.execute("""INSERT INTO institutions VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,kind=excluded.kind,province=excluded.province,
                    identity_status=excluded.identity_status,evidence_url=excluded.evidence_url,
                    current_identity_verified=excluded.current_identity_verified,updated_at=excluded.updated_at""",
                    (iid,row["name"],row["kind"],row.get("province"),row.get("identity_status","candidate"),
                     row.get("discovery_evidence_url"),int(row.get("current_identity_verified",False)),db.now_iso()))
                if row.get("homepage_candidate"):
                    url=row["homepage_candidate"].strip();cid=_id(iid,url)
                    conn.execute("""INSERT INTO institution_channels VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                        evidence_url=excluded.evidence_url,status=excluded.status,endpoint_verified=excluded.endpoint_verified,
                        collection_enabled=excluded.collection_enabled,updated_at=excluded.updated_at""",
                        (cid,iid,url,row.get("discovery_evidence_url"),"homepage_candidate",
                         int(row.get("endpoint_verified",False)),int(row.get("collection_enabled",False)),db.now_iso()))
        for filename in ("police_link_candidates.json","police_county_link_candidates.json"):
            path=ROOT/filename
            if not path.exists(): continue
            for row in json.loads(path.read_text(encoding="utf-8")):
                url=row["homepage_candidate"].strip();iid=_id(row["name"],url)
                evidence=(row.get("evidence_urls") or [row.get("evidence_url")])[0]
                conn.execute("INSERT OR IGNORE INTO institutions VALUES (?,?,?,?,?,?,?,?)",
                    (iid,row["name"],"police",None,row.get("identity_status","official_page_link_candidate"),evidence,0,db.now_iso()))
                conn.execute("INSERT OR REPLACE INTO institution_channels VALUES (?,?,?,?,?,?,?,?)",
                    (_id(iid,url),iid,url,evidence,"official_page_link_candidate",0,0,db.now_iso()))
        # Only channels with locally configured, publicly exercised fail-closed rules are operational.
        for source in get_sources().get("sources", []):
            if not source.get("track_production_endpoint"):
                continue
            name=source.get("registry_institution_name",source["name"])
            kind=source.get("registry_kind","publisher")
            province=source.get("registry_province")
            found=conn.execute("SELECT id FROM institutions WHERE name=? AND kind=? ORDER BY current_identity_verified DESC LIMIT 1",(name,kind)).fetchone()
            iid=found["id"] if found else _id(name,source["url"])
            conn.execute("INSERT OR IGNORE INTO institutions VALUES (?,?,?,?,?,?,?,?)",
                (iid,name,kind,province,"verified_official_metadata",source["url"],1,db.now_iso()))
            conn.execute("UPDATE institutions SET identity_status='verified_official_metadata',current_identity_verified=1,updated_at=? WHERE id=?",(db.now_iso(),iid))
            conn.execute("""INSERT INTO institution_channels VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                institution_id=excluded.institution_id,url=excluded.url,evidence_url=excluded.evidence_url,
                collection_enabled=1,updated_at=excluded.updated_at""",
                ("configured-"+source["id"],iid,source["url"],source["url"],"configured_pending_production",0,1,db.now_iso()))
        conn.commit()
    finally: conn.close()

def coverage_summary():
    conn=db.connect()
    try:
        a=conn.execute("SELECT COUNT(*) total,SUM(current_identity_verified) verified FROM institutions").fetchone()
        c=conn.execute("SELECT COUNT(*) total,SUM(endpoint_verified) verified,SUM(collection_enabled) enabled FROM institution_channels").fetchone()
        groups=[dict(r) for r in conn.execute("SELECT kind,COUNT(*) candidates,SUM(current_identity_verified) identity_verified FROM institutions GROUP BY kind ORDER BY kind")]
        province_presence=[dict(r) for r in conn.execute("SELECT kind,COUNT(DISTINCT province) provinces_with_candidates,SUM(current_identity_verified) identity_verified FROM institutions WHERE province IS NOT NULL AND province!='兵团' GROUP BY kind ORDER BY kind")]
        return {"institutions":{"candidates":a["total"],"identity_verified":a["verified"] or 0},
                "channels":{"candidates":c["total"],"endpoint_verified":c["verified"] or 0,"collection_enabled":c["enabled"] or 0},"by_kind":groups,"province_presence":province_presence}
    finally:conn.close()
