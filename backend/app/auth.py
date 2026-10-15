import datetime
import hashlib
import os
import jwt
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import User, AuditLog

# Try importing argon2, fallback to PBKDF2-HMAC-SHA256 (100k+ iterations)
try:
    from argon2 import PasswordHasher
    ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=1)
    HASHER = "argon2"
except Exception:
    HASHER = "pbkdf2"

def hash_password(password: str) -> str:
    if HASHER == "argon2":
        try:
            return ph.hash(password)
        except Exception:
            pass
    # Fallback PBKDF2-HMAC-SHA256
    salt = os.urandom(16).hex()
    iterations = 120_000
    derived = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), iterations)
    return f"pbkdf2:sha256:{iterations}${salt}${derived.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("$argon2"):
        try:
            from argon2 import PasswordHasher
            return PasswordHasher().verify(hashed_password, plain_password)
        except Exception:
            return False
    elif hashed_password.startswith("pbkdf2:sha256:"):
        try:
            parts = hashed_password.split("$")
            header = parts[0]
            iterations = int(header.split(":")[-1])
            salt = parts[1]
            stored_hash = parts[2]
            check_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), iterations).hex()
            return check_hash == stored_hash
        except Exception:
            return False
    else:
        # Check standard sha256 or bcrypt if present
        return False

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        user_id = int(user_id_raw)
    except Exception:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently inactive or suspended by administrator"
        )
    return user

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires role in {allowed_roles}, your role is '{current_user.role}'"
            )
        return current_user
    return role_checker

def log_audit(
    db: Session,
    user_id: Optional[int],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None
):
    try:
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            details_json=details or {},
            ip_address=ip_address,
            timestamp=datetime.datetime.utcnow()
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        # Logging failure should not break request
        print(f"Failed to record audit log: {e}")
