"""快速冒烟测试：用 TestClient 验证认证与核心接口。"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
import tempfile
from pathlib import Path
from app import database as db
_test_dir = tempfile.TemporaryDirectory()
db.DB_PATH = Path(_test_dir.name) / "monitor.db"
os.environ["SESSION_SECRET"] = "test-only-secret-not-for-production-0123456789"
os.environ["INVITE_CODES"] = "test-only-invite"
from app.main import app

c = TestClient(app)

print("GET / ->", c.get("/").status_code)

meta = c.get("/api/meta").json()
print("meta institutions:", len(meta["institution_types"]), "regions:", len(meta["regions"]))

# 未授权
print("overview no-auth ->", c.get("/api/overview").status_code)

# 登录
r = c.post("/api/auth", json={"code": "test-only-invite"})
tok = r.json().get("token")
print("auth ok ->", r.json()["ok"], "token len:", len(tok or ""))
c.headers["x-access-token"] = tok

print("overview ->", c.get("/api/overview").json())
print("trend ->", len(c.get("/api/trend?days=30").json()))
print("dist->", len(c.get("/api/distribution?field=institution_type").json()))
print("heatmap ->", len(c.get("/api/heatmap").json()))
print("sources ->", len(c.get("/api/sources").json()), "src health keys ok")
coverage=c.get("/api/coverage").json()
assert coverage["institutions"]["candidates"] >= 94
assert coverage["channels"]["collection_enabled"] == 3
print("coverage ->",coverage["institutions"],coverage["channels"])
print("high_value ->", len(c.get("/api/high_value").json()))
print("items ->", c.get("/api/items?page=1&page_size=5").json().get("total"))
print("SMOKE OK")
