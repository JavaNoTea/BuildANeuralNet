from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text, ForeignKey, Float, Integer, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from sqlalchemy.sql import func
from sqlalchemy.pool import QueuePool
from cryptography.fernet import Fernet
import os
import base64
import json
from datetime import datetime
from typing import Optional, Dict, Any
import logging

# Database URL - use SQLite for development, can switch to PostgreSQL for production
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nn_builder.db")

# Encryption configuration
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", None)
if not ENCRYPTION_KEY:
    # Generate a key if not provided (in production, this should be set)
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    print("⚠️ WARNING: Generated new encryption key. Set ENCRYPTION_KEY environment variable in production!")

fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

# Enhanced engine configuration for security and performance
if DATABASE_URL.startswith("sqlite"):
    # SQLite configuration
    engine = create_engine(
        DATABASE_URL,
        connect_args={
            "check_same_thread": False,
            "timeout": 20,
            # Enable WAL mode for better concurrent access
            "isolation_level": None,
        },
        echo=False,  # Disable SQL logging in production
        pool_pre_ping=True,  # Verify connections before use
    )
else:
    # PostgreSQL/MySQL configuration with connection pooling
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,  # Number of connections to maintain
        max_overflow=20,  # Additional connections if needed
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=3600,  # Recycle connections every hour
        echo=False,  # Disable SQL logging in production
        connect_args={
            "sslmode": "require",  # Require SSL for PostgreSQL
            "connect_timeout": 10,
        } if DATABASE_URL.startswith("postgresql") else {}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Setup logging
logger = logging.getLogger(__name__)

class EncryptedField:
    """Field that automatically encrypts/decrypts data"""
    
    @staticmethod
    def encrypt(data: str) -> str:
        """Encrypt sensitive data"""
        if not data:
            return data
        try:
            encrypted = fernet.encrypt(data.encode())
            return base64.b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Encryption error: {e}")
            return data
    
    @staticmethod
    def decrypt(encrypted_data: str) -> str:
        """Decrypt sensitive data"""
        if not encrypted_data:
            return encrypted_data
        try:
            decoded = base64.b64decode(encrypted_data.encode())
            decrypted = fernet.decrypt(decoded)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Decryption error: {e}")
            return encrypted_data

class AuditMixin:
    """Mixin for audit fields"""
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String(36), nullable=True)  # User ID who created
    updated_by = Column(String(36), nullable=True)  # User ID who last updated

class User(Base, AuditMixin):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), nullable=True, index=True)
    password_reset_token = Column(String(255), nullable=True, index=True)
    password_reset_expires = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    last_login_ip = Column(String(45), nullable=True)  # IPv6 max length
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    # Relationships
    saved_models = relationship("SavedModel", back_populates="user", cascade="all, delete-orphan")

class SavedModel(Base, AuditMixin):
    __tablename__ = "saved_models"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Model data (encrypted for sensitive models)
    _encrypted_model_data = Column("model_data", Text, nullable=False)
    model_size_bytes = Column(Integer, nullable=True)
    model_version = Column(String(50), default="1.0", nullable=False)
    
    # Security and access control
    is_public = Column(Boolean, default=False, nullable=False)
    is_template = Column(Boolean, default=False, nullable=False)
    access_count = Column(Integer, default=0, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="saved_models")
    
    @property
    def model_data(self) -> str:
        """Get decrypted model data"""
        if self._encrypted_model_data:
            return EncryptedField.decrypt(self._encrypted_model_data)
        return ""
    
    @model_data.setter
    def model_data(self, value: str):
        """Set encrypted model data"""
        if value:
            self._encrypted_model_data = EncryptedField.encrypt(value)
            # Calculate and store size
            self.model_size_bytes = len(value.encode('utf-8'))
        else:
            self._encrypted_model_data = None
            self.model_size_bytes = 0





class SecurityLog(Base, AuditMixin):
    """Security event logging table"""
    __tablename__ = "security_logs"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    ip_address = Column(String(45), nullable=True, index=True)
    user_agent = Column(Text, nullable=True)
    
    # Event details
    event_type = Column(String(100), nullable=False, index=True)
    event_description = Column(Text, nullable=True)
    severity = Column(String(20), default="INFO", nullable=False)  # DEBUG, INFO, WARNING, ERROR, CRITICAL
    
    # Request details
    endpoint = Column(String(255), nullable=True)
    method = Column(String(10), nullable=True)
    status_code = Column(Integer, nullable=True)
    
    # Additional context (encrypted)
    _encrypted_context = Column("context", Text, nullable=True)
    
    @property
    def context(self) -> Optional[Dict[str, Any]]:
        """Get decrypted context data"""
        if self._encrypted_context:
            decrypted = EncryptedField.decrypt(self._encrypted_context)
            try:
                return json.loads(decrypted)
            except json.JSONDecodeError:
                return {}
        return None
    
    @context.setter
    def context(self, value: Optional[Dict[str, Any]]):
        """Set encrypted context data"""
        if value:
            json_str = json.dumps(value)
            self._encrypted_context = EncryptedField.encrypt(json_str)
        else:
            self._encrypted_context = None

class ApiKey(Base, AuditMixin):
    """API key management for programmatic access"""
    __tablename__ = "api_keys"
    
    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    
    # Key details
    name = Column(String(255), nullable=False)
    _encrypted_key_hash = Column("key_hash", String(255), nullable=False)
    prefix = Column(String(10), nullable=False, index=True)  # First few chars for identification
    
    # Permissions and limits
    permissions = Column(Text, nullable=True)  # JSON array of allowed operations
    rate_limit_per_hour = Column(Integer, default=1000, nullable=False)
    allowed_ips = Column(Text, nullable=True)  # JSON array of allowed IP addresses
    
    # Status and usage
    is_active = Column(Boolean, default=True, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    usage_count = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    
    @property
    def key_hash(self) -> str:
        """Get decrypted key hash"""
        if self._encrypted_key_hash:
            return EncryptedField.decrypt(self._encrypted_key_hash)
        return ""
    
    @key_hash.setter
    def key_hash(self, value: str):
        """Set encrypted key hash"""
        if value:
            self._encrypted_key_hash = EncryptedField.encrypt(value)

# Dependency to get DB session
def get_db() -> Session:
    """Get database session with proper error handling"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def create_tables():
    """Create all database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

def backup_database(backup_path: str = None):
    """Create database backup (SQLite only)"""
    if not DATABASE_URL.startswith("sqlite"):
        logger.warning("Database backup only supported for SQLite")
        return False
    
    try:
        import shutil
        from datetime import datetime
        
        if not backup_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"backup_{timestamp}.db"
        
        db_path = DATABASE_URL.replace("sqlite:///", "")
        shutil.copy2(db_path, backup_path)
        logger.info(f"Database backed up to {backup_path}")
        return True
    except Exception as e:
        logger.error(f"Database backup failed: {e}")
        return False

# Initialize database on import
if __name__ == "__main__":
    create_tables() 