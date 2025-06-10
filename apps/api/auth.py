from datetime import datetime, timedelta
from typing import Optional, Union
import os
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import secrets
import re
from database import get_db, User
import bcrypt
import logging

# Password security configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Security settings
MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_DURATION_MINUTES = 30
PASSWORD_MIN_LENGTH = 8
PASSWORD_REQUIRE_UPPERCASE = True
PASSWORD_REQUIRE_LOWERCASE = True
PASSWORD_REQUIRE_NUMBERS = True
PASSWORD_REQUIRE_SPECIAL = True

# Setup logging for security events
security_logger = logging.getLogger("security")
security_logger.setLevel(logging.INFO)

def log_security_event(event_type: str, user_id: str = None, ip_address: str = None, details: str = None):
    """Log security-related events"""
    security_logger.info(f"Security Event: {event_type} | User: {user_id} | IP: {ip_address} | Details: {details}")

class PasswordValidator:
    """Enhanced password validation"""
    
    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, list[str]]:
        """Validate password meets security requirements"""
        errors = []
        
        if len(password) < PASSWORD_MIN_LENGTH:
            errors.append(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long")
        
        if PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter")
        
        if PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter")
        
        if PASSWORD_REQUIRE_NUMBERS and not re.search(r'\d', password):
            errors.append("Password must contain at least one number")
        
        if PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one special character")
        
        # Check for common weak patterns
        if re.search(r'(.)\1{2,}', password):  # Three consecutive same characters
            errors.append("Password cannot contain three consecutive identical characters")
        
        if re.search(r'(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)', password.lower()):
            errors.append("Password cannot contain common sequential patterns")
        
        # Check against common passwords
        common_passwords = [
            'password', '123456', 'password123', 'admin', 'qwerty', 
            'letmein', 'welcome', 'monkey', '1234567890'
        ]
        if password.lower() in common_passwords:
            errors.append("Password is too common and not allowed")
        
        return len(errors) == 0, errors

class LoginAttemptTracker:
    """Track and manage login attempts per IP/user"""
    
    def __init__(self):
        self.attempts = {}  # In production, use Redis or database
        self.lockouts = {}
    
    def get_attempt_key(self, identifier: str) -> str:
        return f"login_attempts:{identifier}"
    
    def get_lockout_key(self, identifier: str) -> str:
        return f"login_lockout:{identifier}"
    
    def is_locked_out(self, identifier: str) -> bool:
        """Check if IP/user is currently locked out"""
        lockout_key = self.get_lockout_key(identifier)
        if lockout_key in self.lockouts:
            lockout_until = self.lockouts[lockout_key]
            if datetime.utcnow() < lockout_until:
                return True
            else:
                # Lockout expired, clean up
                del self.lockouts[lockout_key]
                if self.get_attempt_key(identifier) in self.attempts:
                    del self.attempts[self.get_attempt_key(identifier)]
        return False
    
    def record_failed_attempt(self, identifier: str, ip_address: str = None, user_id: str = None):
        """Record a failed login attempt"""
        attempt_key = self.get_attempt_key(identifier)
        
        if attempt_key not in self.attempts:
            self.attempts[attempt_key] = {
                'count': 0,
                'first_attempt': datetime.utcnow(),
                'last_attempt': datetime.utcnow()
            }
        
        self.attempts[attempt_key]['count'] += 1
        self.attempts[attempt_key]['last_attempt'] = datetime.utcnow()
        
        # Log the failed attempt
        log_security_event(
            "FAILED_LOGIN", 
            user_id=user_id, 
            ip_address=ip_address,
            details=f"Attempt #{self.attempts[attempt_key]['count']}"
        )
        
        # Check if we need to lock out
        if self.attempts[attempt_key]['count'] >= MAX_LOGIN_ATTEMPTS:
            lockout_until = datetime.utcnow() + timedelta(minutes=LOGIN_LOCKOUT_DURATION_MINUTES)
            self.lockouts[self.get_lockout_key(identifier)] = lockout_until
            
            log_security_event(
                "ACCOUNT_LOCKOUT", 
                user_id=user_id, 
                ip_address=ip_address,
                details=f"Locked until {lockout_until}"
            )
            
            return True  # Locked out
        
        return False  # Not locked out yet
    
    def record_successful_attempt(self, identifier: str, ip_address: str = None, user_id: str = None):
        """Record a successful login attempt"""
        # Clear any existing attempts/lockouts
        attempt_key = self.get_attempt_key(identifier)
        lockout_key = self.get_lockout_key(identifier)
        
        if attempt_key in self.attempts:
            del self.attempts[attempt_key]
        if lockout_key in self.lockouts:
            del self.lockouts[lockout_key]
        
        log_security_event(
            "SUCCESSFUL_LOGIN", 
            user_id=user_id, 
            ip_address=ip_address,
            details="Login successful"
        )

# Global login attempt tracker (in production, use Redis)
login_tracker = LoginAttemptTracker()

def get_client_ip(request: Request) -> str:
    """Extract client IP from request, considering proxies"""
    # Check for forwarded IP headers (common with load balancers)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to direct connection IP
    return request.client.host if request.client else "unknown"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        log_security_event("PASSWORD_VERIFICATION_ERROR", details=str(e))
        return False

def get_password_hash(password: str) -> str:
    """Hash a password with bcrypt"""
    # Validate password strength before hashing
    is_valid, errors = PasswordValidator.validate_password_strength(password)
    if not is_valid:
        raise ValueError(f"Password validation failed: {'; '.join(errors)}")
    
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_verification_token() -> str:
    """Create a secure email verification token"""
    return secrets.token_urlsafe(32)

def create_password_reset_token() -> str:
    """Create a secure password reset token"""
    return secrets.token_urlsafe(32)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id is None or token_type != "access":
            log_security_event("INVALID_TOKEN", details="Invalid token format")
            raise credentials_exception
            
    except JWTError as e:
        log_security_event("JWT_ERROR", details=str(e))
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        log_security_event("USER_NOT_FOUND", user_id=user_id)
        raise credentials_exception
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        log_security_event("INACTIVE_USER_ACCESS", user_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user"
        )
    
    return current_user

def authenticate_user(db: Session, email: str, password: str, request: Request = None) -> Union[User, bool]:
    """Authenticate user with enhanced security checks"""
    client_ip = get_client_ip(request) if request else "unknown"
    
    # Check if IP is locked out
    if login_tracker.is_locked_out(client_ip):
        log_security_event("LOCKOUT_ACCESS_ATTEMPT", ip_address=client_ip)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Too many failed login attempts. Try again in {LOGIN_LOCKOUT_DURATION_MINUTES} minutes."
        )
    
    # Find user
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Record failed attempt for non-existent user
        login_tracker.record_failed_attempt(client_ip, ip_address=client_ip)
        log_security_event("LOGIN_NONEXISTENT_USER", ip_address=client_ip, details=f"Email: {email}")
        return False
    
    # Check if user account is locked
    if not user.is_active:
        log_security_event("LOGIN_INACTIVE_USER", user_id=user.id, ip_address=client_ip)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account is deactivated"
        )
    
    # Verify password
    if not verify_password(password, user.hashed_password):
        # Record failed attempt
        is_locked = login_tracker.record_failed_attempt(
            f"user:{user.id}", 
            ip_address=client_ip, 
            user_id=user.id
        )
        
        if is_locked:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account temporarily locked due to too many failed attempts. Try again in {LOGIN_LOCKOUT_DURATION_MINUTES} minutes."
            )
        
        return False
    
    # Successful authentication
    login_tracker.record_successful_attempt(
        f"user:{user.id}", 
        ip_address=client_ip, 
        user_id=user.id
    )
    
    # Update last login (but don't commit here - let the calling endpoint handle it)
    user.last_login = datetime.utcnow()
    user.last_login_ip = client_ip
    
    return user 