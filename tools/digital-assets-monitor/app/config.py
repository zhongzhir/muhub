"""配置文件加载器：settings / sources / keywords。"""
import json
import threading
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = BASE_DIR / "config"

_lock = threading.Lock()
_cache = {}


def _load(name):
    if name not in _cache:
        with open(CONFIG_DIR / name, "r", encoding="utf-8") as f:
            _cache[name] = json.load(f)
    return _cache[name]


def get_settings():
    return _load("settings.json")


def get_sources():
    return _load("sources.json")


def get_keywords():
    return _load("keywords.json")


def reload_config():
    with _lock:
        _cache.clear()
