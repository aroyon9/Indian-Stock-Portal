from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import secrets

import bcrypt
from jose import jwt

from app.core.config import settings

_PBKDF2_PREFIX = "pbkdf2_sha256"
_PBKDF2_ITERATIONS = 210_000
_PBKDF2_SALT_BYTES = 16
_PBKDF2_DKLEN = 32


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(raw: str) -> bytes:
    padded = raw + ("=" * (-len(raw) % 4))
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _pbkdf2_digest(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=_PBKDF2_DKLEN,
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_PBKDF2_SALT_BYTES)
    digest = _pbkdf2_digest(password, salt, _PBKDF2_ITERATIONS)
    return f"{_PBKDF2_PREFIX}${_PBKDF2_ITERATIONS}${_b64encode(salt)}${_b64encode(digest)}"


def _verify_pbkdf2(password: str, password_hash: str) -> bool:
    parts = password_hash.split("$")
    if len(parts) != 4:
        return False
    prefix, rounds_raw, salt_raw, digest_raw = parts
    if prefix != _PBKDF2_PREFIX:
        return False
    try:
        rounds = int(rounds_raw)
        salt = _b64decode(salt_raw)
        expected = _b64decode(digest_raw)
    except (ValueError, TypeError):
        return False

    actual = _pbkdf2_digest(password, salt, rounds)
    return hmac.compare_digest(actual, expected)


def _verify_legacy_bcrypt(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def verify_password(password: str, password_hash: str) -> bool:
    if password_hash.startswith(f"{_PBKDF2_PREFIX}$"):
        return _verify_pbkdf2(password, password_hash)
    return _verify_legacy_bcrypt(password, password_hash)


def create_access_token(subject: str) -> str:
    expire = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
