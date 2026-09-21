"""Password hashing + token sessions — stdlib only (no extra deps)."""
import hashlib
import hmac
import os
import re
import secrets

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,24}$")


def valid_email(email: str) -> bool:
    return bool(email and EMAIL_RE.match(email.strip()))


def valid_username(username: str) -> bool:
    return bool(username and USERNAME_RE.match(username.strip()))


def valid_password(password: str) -> tuple[bool, str]:
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        return False, "Password must contain a letter and a number."
    return True, ""


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"pbkdf2${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, hexdk = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
        return hmac.compare_digest(dk.hex(), hexdk)
    except Exception:
        return False


def new_token() -> str:
    return "as_" + secrets.token_urlsafe(32)


def avatar_for(username: str) -> str:
    u = (username or "?").strip()
    if "@" in u and " " not in u:
        u = u.split("@")[0]
    parts = u.replace("_", " ").replace(".", " ").split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return u[:2].upper()
