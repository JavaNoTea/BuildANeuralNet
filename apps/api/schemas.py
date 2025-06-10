from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Token schemas
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

# Model schemas
class ModelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    model_data: str

    class Config:
        protected_namespaces = ()

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    model_data: Optional[str] = None

    class Config:
        protected_namespaces = ()

class ModelResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str]
    model_data: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
        protected_namespaces = ()

class ModelListResponse(BaseModel):
    models: List[ModelResponse]
    total: int

# Email verification schemas
class EmailVerification(BaseModel):
    token: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    new_password: str

# Code generation schemas
class CodeGenerationResponse(BaseModel):
    model_id: str
    pytorch_code: str
    model_name: str 