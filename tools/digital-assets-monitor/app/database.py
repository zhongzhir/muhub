"""SQLite 数据层：schema、连接与通用读写助手。"""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("MONITOR_DB_PATH", str(BASE_DIR / "data" / "monitor.db")))


def _ensure_dir():
    os.makedirs(DB_PATH.parent, exist_ok=True)


def connect():
    _ensure_dir()
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


@contextmanager
def get_db(write=False):
    conn = connect()
    try:
        yield conn
        if write:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    source_name TEXT,
    source_category TEXT,
    source_type TEXT,
    publish_date TEXT,
    fetch_date TEXT,
    content TEXT,
    summary TEXT,
    analysis TEXT,
    region TEXT,
    institution TEXT,
    institution_type TEXT,
    asset_types TEXT,
    disposal_method TEXT,
    amount_value REAL,
    amount_currency TEXT,
    amount_evidence TEXT,
    information_nature TEXT,
    importance TEXT DEFAULT 'medium',
    tags TEXT,
    raw TEXT,
    is_processed INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_date ON items(publish_date);
CREATE INDEX IF NOT EXISTS idx_items_cat ON items(source_category);
CREATE INDEX IF NOT EXISTS idx_items_itype ON items(institution_type);
CREATE INDEX IF NOT EXISTS idx_items_region ON items(region);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    source_type TEXT,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 50,
    url TEXT,
    last_scan_at TEXT,
    last_status TEXT,
    item_count INTEGER DEFAULT 0,
    note TEXT
);

CREATE TABLE IF NOT EXISTS scan_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at TEXT,
    sources_planned INTEGER DEFAULT 0,
    sources_ok INTEGER DEFAULT 0,
    sources_failed INTEGER DEFAULT 0,
    new_items INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    status TEXT,
    message TEXT
);

CREATE TABLE IF NOT EXISTS institutions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    province TEXT,
    identity_status TEXT NOT NULL,
    evidence_url TEXT,
    current_identity_verified INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_institutions_kind_province ON institutions(kind, province);
CREATE TABLE IF NOT EXISTS institution_channels (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL,
    url TEXT NOT NULL,
    evidence_url TEXT,
    status TEXT NOT NULL,
    endpoint_verified INTEGER DEFAULT 0,
    collection_enabled INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(institution_id) REFERENCES institutions(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_institution_url ON institution_channels(institution_id, url);

CREATE TABLE IF NOT EXISTS search_candidates (
    fingerprint TEXT PRIMARY KEY,
    source_id TEXT,
    url TEXT,
    status TEXT NOT NULL,
    evidence TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date TEXT,
    title TEXT,
    body TEXT,
    new_item_count INTEGER DEFAULT 0,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS scan_tokens (
    code TEXT PRIMARY KEY,
    created_at TEXT,
    expires_at TEXT,
    active INTEGER DEFAULT 1
);
"""


_ITEM_MIGRATIONS = (
    ("amount_evidence", "TEXT"),
    ("information_nature", "TEXT"),
)


def migrate_schema(conn):
    cols = {row[1] for row in conn.execute("PRAGMA table_info(items)")}
    for name, ddl in _ITEM_MIGRATIONS:
        if name not in cols:
            conn.execute(f"ALTER TABLE items ADD COLUMN {name} {ddl}")


def init_db():
    with get_db(write=True) as db:
        db.executescript(SCHEMA)
        migrate_schema(db)


def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def upsert_source(db, s):
    db.execute(
        """INSERT INTO sources (id, name, category, source_type, enabled, priority, url, note)
           VALUES (:id, :name, :category, :type, :enabled, :priority, :url, :note)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name, category=excluded.category, source_type=excluded.source_type,
             enabled=excluded.enabled, priority=excluded.priority, url=excluded.url, note=excluded.note""",
        s,
    )


def item_exists(db, fingerprint):
    row = db.execute("SELECT id FROM items WHERE fingerprint=?", (fingerprint,)).fetchone()
    return row is not None
