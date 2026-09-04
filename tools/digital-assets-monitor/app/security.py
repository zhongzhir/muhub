"""邀请访问鉴权：登录签发 HMAC 会话令牌，中间件校验。"""
import hashlib
import hmac
import os
import secrets
import time

from fastapi import Request, HTTPException

from app.config import get_settings


def _secret():
    if os.environ.get("SESSION_SECRET"):
        return os.environ["SESSION_SECRET"]
    return get_settings().get("access", {}).get("session_secret", "")


def _invite_codes():
    if os.environ.get("INVITE_CODES"):
        return [c.strip() for c in os.environ["INVITE_CODES"].split(",") if c.strip()]
    return get_settings().get("access", {}).get("invite_codes", [])


def validate_config():
    secret = _secret()
    if len(secret) < 32 or secret.startswith("CHANGE_ME") or not _invite_codes():
        raise RuntimeError("Set SESSION_SECRET (32+ random characters) and INVITE_CODES before startup")


def _hours():
    return get_settings().get("access", {}).get("session_hours", 168)


def valid_invite(code):
    return str(code).strip() in _invite_codes()


def _sign(payload):
    return hmac.new(_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token():
    exp = int(time.time()) + int(_hours()) * 3600
    payload = f"t:{exp}"
    return f"{payload}:{_sign(payload)}"


def verify_token(token):
    if not token:
        return False
    try:
        payload, sig = token.rsplit(":", 1)
    except ValueError:
        return False
    if not sig.isascii() or not hmac.compare_digest(sig, _sign(payload)):
        return False
    try:
        kind, exp = payload.split(":")
        return kind == "t" and time.time() < int(exp)
    except (ValueError, TypeError):
        return False


def require_auth(request: Request):
    token = request.headers.get("x-access-token") or request.cookies.get("session")
    if not verify_token(token):
        raise HTTPException(status_code=401, detail="未授权访问，请输入邀请码")
    return None


def make_cookie_value():
    return create_token()


def gen_invite_code():
    return secrets.token_hex(4).upper()
