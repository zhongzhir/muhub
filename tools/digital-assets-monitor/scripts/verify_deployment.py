"""Server-only authenticated acceptance; never prints credentials."""
import argparse
import json
import urllib.request
import urllib.error
from pathlib import Path

args=argparse.ArgumentParser()
args.add_argument("--scan",action="store_true")
options=args.parse_args()
base="https://monitor.muhub.cn"
config=dict(line.split("=",1) for line in Path("/etc/digital-assets-monitor.env").read_text().splitlines() if line and not line.startswith("#"))
token=None

def api(path,data=None):
    headers={"Content-Type":"application/json"}
    if token: headers["x-access-token"]=token
    body=json.dumps(data).encode() if data is not None else None
    with urllib.request.urlopen(urllib.request.Request(base+path,data=body,headers=headers),timeout=30) as response:
        return json.load(response)

try:
    api("/api/overview")
except urllib.error.HTTPError as exc:
    assert exc.code==401, f"Anonymous access returned {exc.code}"
else:
    raise RuntimeError("Anonymous data access was not rejected")
login=api("/api/auth",{"code":config["INVITE_CODES"].split(",")[0]})
assert login.get("ok") and login.get("token"), "Authentication failed"
token=login["token"]
print("HTTPS and authentication: passed")
print("Overview:",json.dumps(api("/api/overview"),ensure_ascii=False))
state=api("/api/scan/status")
if options.scan and not state.get("running"):
    print("Scan started:",api("/api/scan",{}))
print("Scan status:",json.dumps(api("/api/scan/status"),ensure_ascii=False))
print("Latest scan logs:",json.dumps(api("/api/scan/logs?limit=2"),ensure_ascii=False))
