"""
Authentication, Password Hashing, Salted Phone Privacy & RBAC for JanaDhwani
"""
import hashlib
import hmac
import secrets
import json
from typing import Optional, Dict, Any
from app.config import SECRET_KEY, PHONE_SALT

def hash_password(password: str) -> str:
    """Hash password with PBKDF2-HMAC-SHA256."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${key.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hashed string."""
    try:
        parts = hashed.split("$")
        if len(parts) != 2:
            return False
        salt, expected_hex = parts[0], parts[1]
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return hmac.compare_digest(key.hex(), expected_hex)
    except Exception:
        return False

def hash_phone(phone: str) -> str:
    """
    Deterministic salted SHA-256 phone hash for privacy-preserving deduplication and lookups.
    Never stores plain phone number.
    """
    clean_phone = "".join(filter(str.isdigit, phone))
    salted = f"{PHONE_SALT}:{clean_phone}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest()

def mask_phone(phone: str) -> str:
    """Masks phone number (e.g., 9876543210 -> 98****3210)."""
    clean = "".join(filter(str.isdigit, phone))
    if len(clean) >= 10:
        return f"{clean[:2]}******{clean[-2:]}"
    return "******"

def generate_session_token(user_data: Dict[str, Any]) -> str:
    """Generates an HMAC-signed session token containing user payload."""
    payload = json.dumps(user_data, separators=(",", ":"))
    signature = hmac.new(SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    # Simple base64 or payload:sig encoding
    token_str = f"{payload.encode('utf-8').hex()}:{signature}"
    return token_str

def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and verifies HMAC signature of token."""
    try:
        hex_payload, signature = token.split(":")
        payload = bytes.fromhex(hex_payload).decode("utf-8")
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if hmac.compare_digest(signature, expected_sig):
            return json.loads(payload)
    except Exception:
        pass
    return None
