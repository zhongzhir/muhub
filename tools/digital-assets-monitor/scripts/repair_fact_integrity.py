"""修复已知错误结构化字段。默认 dry-run 只读，需 --apply 才写库。"""
from __future__ import annotations

import argparse
import os
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import database as db
from app.analysis.structure import structure_item
from app.analysis.summarize import analysis_value_line

URL_CROSS_BORDER = "https://www.spp.gov.cn/spp/llyj/202609/t20260903_736106.shtml"
URL_PROCEDURE = "https://www.spp.gov.cn/spp/llyj/202608/t20260819_735170.shtml"

KNOWN_ANALYSIS = {
    URL_CROSS_BORDER: {
        "information_nature": "理论研究",
        "analysis": (
            "信息性质：理论研究。\n"
            "与数字资产处置的关系：属于跨境追赃法理与制度研究，讨论虚拟货币跨境转移对没收、返还与分享程序的影响。\n"
            "对实际工作的价值：提示虚拟货币跨境转移给没收、资产返还与分享机制带来的程序挑战。\n"
            "证据边界：不属于具体处置案件，文章未披露具体资产数量、案件编号或成交结果。"
        ),
    },
    URL_PROCEDURE: {
        "information_nature": "政策或制度指导",
        "analysis": (
            "信息性质：政策或制度指导。\n"
            "与数字资产处置的关系：属于涉案财物处置制度建议，讨论范围认定、查扣冻程序与监督救济等规则完善方向。\n"
            "对实际工作的价值：提出范围认定、查封扣押冻结程序、监督救济，以及利用区块链进行涉案虚拟财产全流程存证等方向。\n"
            "证据边界：不属于具体案件，文章未披露具体资产数量、案件编号或成交结果。"
        ),
    },
}

TARGET_URLS = (URL_CROSS_BORDER, URL_PROCEDURE)
REPAIR_FIELDS = (
    "amount_value",
    "amount_currency",
    "amount_evidence",
    "institution",
    "institution_type",
    "region",
    "disposal_method",
    "asset_types",
    "information_nature",
    "analysis",
    "summary",
    "tags",
)
SECRET_HINTS = ("invite", "token", "secret", "password", "session")


def _eq(left, right):
    if left is None and (right is None or right == ""):
        return True
    if right is None and (left is None or left == ""):
        return True
    return left == right


def row_value(row, field):
    if row is None:
        return None
    keys = row.keys()
    if field not in keys:
        return None
    return row[field]


def planned_fields(row):
    text = " ".join(
        part for part in (
            row_value(row, "title"),
            row_value(row, "content"),
            row_value(row, "summary"),
        ) if part
    )
    fields = structure_item(
        row_value(row, "title"),
        text,
        url=row_value(row, "url") or "",
        source_name=row_value(row, "source_name") or "",
        source_category=row_value(row, "source_category") or "",
    )
    known = KNOWN_ANALYSIS.get(row_value(row, "url") or "")
    nature = (known or {}).get("information_nature") or fields["information_nature"]
    analysis = (known or {}).get("analysis") or fields["analysis"]
    assets = fields["asset_types"]
    if isinstance(assets, (list, tuple)):
        assets = ",".join(assets)
    return {
        "amount_value": None,
        "amount_currency": None,
        "amount_evidence": None,
        "institution": None,
        "institution_type": None,
        "region": None,
        "disposal_method": None,
        "asset_types": assets or "虚拟货币",
        "information_nature": nature,
        "analysis": analysis,
        "summary": analysis_value_line(analysis),
        "tags": ",".join([nature] + [t for t in (fields["tags"] or []) if t != nature]),
    }


def diff_row(row, planned):
    changes = {}
    for field in REPAIR_FIELDS:
        old = row_value(row, field)
        new = planned[field]
        if not _eq(old, new):
            changes[field] = {"from": old, "to": new}
    return changes


def load_targets(conn):
    rows = []
    for url in TARGET_URLS:
        found = conn.execute("SELECT * FROM items WHERE url=?", (url,)).fetchall()
        rows.extend(found)
    return rows


def connect_readonly(db_path):
    path = Path(db_path)
    if not path.is_file():
        raise FileNotFoundError(f"database is not an existing file: {path}")
    conn = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def connect_writable(db_path):
    path = Path(db_path)
    if not path.is_file():
        raise FileNotFoundError(f"database is not an existing file: {path}")
    conn = sqlite3.connect(str(path.resolve()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def unique_backup_path(db_path):
    db_path = Path(db_path)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    candidate = db_path.with_name(f"{db_path.stem}.factfix-{stamp}{db_path.suffix}")
    if candidate.exists():
        raise FileExistsError(f"backup already exists: {candidate}")
    return candidate


def restrict_admin_only(path):
    """备份仅允许管理员与当前操作用户读写，去掉 Users 等继承权限。

    Windows UAC 下，未提升进程的 Administrators 属于 deny-only SID；
    若 ACL 只有 Administrators，创建备份的同一进程将无法复验文件。
    """
    path = str(Path(path))
    if os.name == "nt":
        user = os.environ.get("USERNAME") or os.getlogin()
        completed = subprocess.run(
            [
                "icacls", path, "/inheritance:r",
                "/grant:r", "Administrators:F",
                "/grant:r", f"{user}:(R,W)",
            ],
            capture_output=True,
            text=True,
        )
        if completed.returncode != 0:
            raise RuntimeError(completed.stderr or completed.stdout or "icacls failed")
        return
    os.chmod(path, 0o600)


def backup_sqlite(src_path, dest_path):
    dest_path = Path(dest_path)
    if dest_path.exists():
        raise FileExistsError(f"backup already exists: {dest_path}")
    flags = os.O_CREAT | os.O_EXCL | os.O_RDWR
    if hasattr(os, "O_BINARY"):
        flags |= os.O_BINARY
    fd = os.open(str(dest_path), flags, 0o600)
    os.close(fd)
    src = sqlite3.connect(str(src_path))
    dst = sqlite3.connect(str(dest_path))
    try:
        src.backup(dst)
    except Exception:
        dst.close()
        src.close()
        dest_path.unlink(missing_ok=True)
        raise
    dst.close()
    src.close()
    restrict_admin_only(dest_path)


def apply_changes(conn, item_id, planned):
    conn.execute(
        """UPDATE items SET
             amount_value=:amount_value, amount_currency=:amount_currency, amount_evidence=:amount_evidence,
             institution=:institution, institution_type=:institution_type, region=:region,
             disposal_method=:disposal_method, asset_types=:asset_types, information_nature=:information_nature,
             analysis=:analysis, summary=:summary, tags=:tags, updated_at=:updated_at
           WHERE id=:id""",
        dict(planned, id=item_id, updated_at=db.now_iso()),
    )


def redact(value):
    text = str(value)
    low = text.lower()
    if any(h in low for h in SECRET_HINTS):
        return "[redacted]"
    return value


def _plan(conn):
    pending = []
    for row in load_targets(conn):
        planned = planned_fields(row)
        changes = diff_row(row, planned)
        pending.append({
            "id": row["id"],
            "url": row_value(row, "url"),
            "planned": planned,
            "changes": {
                k: {"from": redact(v["from"]), "to": redact(v["to"])}
                for k, v in changes.items()
            },
            "_raw_changes": changes,
            "_row": row,
        })
    return pending


def repair_database(db_path, apply=False):
    path = Path(db_path)
    if not path.is_file():
        raise FileNotFoundError(f"database is not an existing file: {path}")
    if not apply:
        conn = connect_readonly(path)
        try:
            return {"apply": False, "backup": None, "items": _plan(conn)}
        finally:
            conn.close()

    readonly = connect_readonly(path)
    try:
        pending = _plan(readonly)
    finally:
        readonly.close()
    if not any(item["_raw_changes"] for item in pending):
        return {"apply": True, "backup": None, "items": pending}

    backup_path = unique_backup_path(path)
    backup_sqlite(path, backup_path)
    conn = connect_writable(path)
    try:
        conn.execute("BEGIN")
        db.migrate_schema(conn)
        for item in pending:
            if item["_raw_changes"]:
                apply_changes(conn, item["id"], item["planned"])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"apply": True, "backup": str(backup_path), "items": pending}


def main(argv=None):
    parser = argparse.ArgumentParser(description="修复最高检理论研究栏目两条记录的错误结构化字段")
    parser.add_argument("--db", default=str(db.DB_PATH), help="SQLite 路径")
    parser.add_argument("--apply", action="store_true", help="写入数据库；默认只预览")
    args = parser.parse_args(argv)
    result = repair_database(args.db, apply=args.apply)
    print(f"{'APPLY' if args.apply else 'DRY-RUN'} db={Path(args.db).resolve()} matched={len(result['items'])}")
    if result.get("backup"):
        print(f"backup={result['backup']}")
    changed_ids = []
    for item in result["items"]:
        print(f"id={item['id']} url={item['url']} changed={list(item['changes'])}")
        for field, delta in item["changes"].items():
            print(f"  {field}: {delta['from']!r} -> {delta['to']!r}")
        if item["changes"]:
            changed_ids.append(str(item["id"]))
    if not args.apply:
        print("no writes")
    elif not changed_ids:
        print("already consistent, no writes")
    else:
        print("applied ids=" + ",".join(changed_ids))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
