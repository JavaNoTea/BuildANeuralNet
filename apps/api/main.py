from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os
from datetime import timedelta, datetime
import uuid
import json
import os
from typing import Optional

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import get_db, User, SavedModel, create_tables
from auth import (
    get_password_hash, verify_password, create_access_token, 
    create_refresh_token, create_verification_token,
    get_current_user, get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES, authenticate_user
)
from schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    ModelCreate, ModelUpdate, ModelResponse, ModelListResponse,
    EmailVerification, PasswordReset, PasswordResetRequest
)
from email_service import send_verification_email, send_password_reset_email

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Neural Network Builder API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create database tables on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database tables on application startup"""
    try:
        create_tables()
        print("✅ Database tables created/verified successfully")
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
        # Don't fail startup - tables might already exist

# Security: Add trusted host middleware - Allow Railway subdomains
# Ensure both www and non-www versions are always included
base_hosts = "www.buildaneural.net,buildaneural.net,buildaneuralnet-production.up.railway.app,localhost,127.0.0.1"
allowed_hosts_str = os.getenv("ALLOWED_HOSTS", base_hosts)

# Always ensure www.buildaneural.net is included (in case env var overrides)
required_hosts = ["www.buildaneural.net", "buildaneural.net"]
for host in required_hosts:
    if host not in allowed_hosts_str:
        allowed_hosts_str += f",{host}"

# Add Railway wildcard patterns if not already present
if "up.railway.app" in allowed_hosts_str and "*.up.railway.app" not in allowed_hosts_str:
    allowed_hosts_str += ",*.up.railway.app"

allowed_hosts = [host.strip() for host in allowed_hosts_str.split(",") if host.strip()]
print(f"🔧 Allowed hosts: {allowed_hosts}")  # Debug logging
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

# Security: Fix CORS configuration - NO MORE WILDCARD
allowed_origins = os.getenv("ALLOWED_ORIGINS", "https://www.buildaneural.net,https://buildaneuralnet-production.up.railway.app,https://buildaneural.net,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # 🔒 SECURE: Specific origins only
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # 🔒 SECURE: Include OPTIONS for preflight
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "Accept", "Origin", "X-Requested-With"],  # 🔒 SECURE: Include necessary headers
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    # Debug: Log host header for troubleshooting
    host_header = request.headers.get("host", "NO_HOST")
    print(f"🌐 Request host header: {host_header}")
    
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # Content Security Policy - Strict security for visual app only
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "connect-src 'self';"
    )
    response.headers["Content-Security-Policy"] = csp
    
    return response

# Health check
@app.get("/ping")
@limiter.limit("10/minute")  # Rate limit health checks
def ping(request: Request):
    return {"message": "pong"}

# Authentication endpoints
@app.post("/auth/register", response_model=UserResponse)
@limiter.limit("5/minute")  # Rate limit registration
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user
    verification_token = create_verification_token()
    user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        verification_token=verification_token,
        # Only auto-verify if no SMTP is configured (development mode)
        is_verified=not (os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Send verification email
    email_sent = await send_verification_email(user.email, user.username, verification_token)
    
    # If email sending failed and we're in development mode, auto-verify the user
    if not email_sent and not (os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD")):
        user.is_verified = True
        user.verification_token = None
        db.commit()
        db.refresh(user)
    
    return user

@app.post("/auth/login", response_model=Token)
@limiter.limit("5/minute")  # Rate limit login attempts
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email and password - uses secure authentication"""
    # Use the secure authenticate_user function that handles all security checks
    user = authenticate_user(db, form_data.username, form_data.password, request)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Commit the login timestamp update
    try:
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during login"
        )
    
    # Create tokens
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@app.post("/auth/verify-email")
@limiter.limit("10/minute")  # Rate limit email verification
async def verify_email(request: Request, verification: EmailVerification, db: Session = Depends(get_db)):
    """Verify user's email address"""
    user = db.query(User).filter(User.verification_token == verification.token).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    user.is_verified = True
    user.verification_token = None
    db.commit()
    
    return {"message": "Email verified successfully"}

@app.get("/auth/me", response_model=UserResponse)
@limiter.limit("30/minute")  # Rate limit user info requests
async def get_me(request: Request, current_user: User = Depends(get_current_active_user)):
    """Get current user info"""
    return current_user

@app.post("/auth/refresh", response_model=Token)
@limiter.limit("10/minute")  # Rate limit token refresh
async def refresh_token(request: Request, refresh_token: str, db: Session = Depends(get_db)):
    """Refresh access token"""
    try:
        from jose import jwt
        from auth import SECRET_KEY, ALGORITHM
        
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # Create new tokens
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token(
            data={"sub": user.id}, expires_delta=access_token_expires
        )
        new_refresh_token = create_refresh_token(data={"sub": user.id})
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

# Model CRUD endpoints
@app.post("/models", response_model=ModelResponse)
@limiter.limit("20/minute")  # Rate limit model creation
async def create_model(
    request: Request,
    model_data: ModelCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new saved model"""
    model = SavedModel(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=model_data.name,
        description=model_data.description,
        model_data=model_data.model_data
    )
    
    db.add(model)
    db.commit()
    db.refresh(model)
    
    return model

@app.get("/models", response_model=ModelListResponse)
@limiter.limit("60/minute")  # Rate limit model listing
async def list_models(
    request: Request,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List user's saved models"""
    # Limit maximum items per request
    limit = min(limit, 100)
    
    models = db.query(SavedModel).filter(
        SavedModel.user_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    total = db.query(SavedModel).filter(
        SavedModel.user_id == current_user.id
    ).count()
    
    return {"models": models, "total": total}

@app.get("/models/{model_id}", response_model=ModelResponse)
@limiter.limit("60/minute")  # Rate limit model retrieval
async def get_model(
    request: Request,
    model_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific model"""
    model = db.query(SavedModel).filter(
        SavedModel.id == model_id,
        SavedModel.user_id == current_user.id
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return model

@app.put("/models/{model_id}", response_model=ModelResponse)
@limiter.limit("30/minute")  # Rate limit model updates
async def update_model(
    request: Request,
    model_id: str,
    model_update: ModelUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a model"""
    model = db.query(SavedModel).filter(
        SavedModel.id == model_id,
        SavedModel.user_id == current_user.id
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # Update fields
    if model_update.name is not None:
        model.name = model_update.name
    if model_update.description is not None:
        model.description = model_update.description
    if model_update.model_data is not None:
        model.model_data = model_update.model_data
    
    model.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(model)
    
    return model

@app.delete("/models/{model_id}")
@limiter.limit("30/minute")  # Rate limit model deletion
async def delete_model(
    request: Request,
    model_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a model"""
    model = db.query(SavedModel).filter(
        SavedModel.id == model_id,
        SavedModel.user_id == current_user.id
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    db.delete(model)
    db.commit()
    
    return {"message": "Model deleted successfully"}

# Code generation endpoint
@app.post("/models/{model_id}/generate-code")
@limiter.limit("30/minute")  # Rate limit code generation
async def generate_pytorch_code(
    request: Request,
    model_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate PyTorch code for a saved model"""
    model = db.query(SavedModel).filter(
        SavedModel.id == model_id,
        SavedModel.user_id == current_user.id
    ).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    try:
        # Parse model data
        model_data = json.loads(model.model_data) if isinstance(model.model_data, str) else model.model_data
        
        # Generate PyTorch code
        pytorch_code = generate_code_from_model(model_data)
        
        return {
            "model_id": model_id,
            "pytorch_code": pytorch_code,
            "model_name": model.name
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error generating code: {str(e)}"
        )

def generate_code_from_model(model_data):
    """Generate PyTorch code from model configuration"""
    # Basic template for PyTorch model
    code = """import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.utils.data import DataLoader
import torchvision
import torchvision.transforms as transforms

class NeuralNetwork(nn.Module):
    def __init__(self):
        super(NeuralNetwork, self).__init__()
"""
    
    # Parse nodes and connections from model data
    nodes = model_data.get('nodes', [])
    edges = model_data.get('edges', [])
    
    # Add layers based on nodes
    layers = []
    for node in nodes:
        if node.get('type') == 'layer':
            layer_type = node.get('data', {}).get('layerType', 'linear')
            layer_config = node.get('data', {}).get('config', {})
            
            if layer_type == 'linear':
                input_size = layer_config.get('inputSize', 784)
                output_size = layer_config.get('outputSize', 10)
                layers.append(f"        self.fc{len(layers)+1} = nn.Linear({input_size}, {output_size})")
            elif layer_type == 'conv2d':
                in_channels = layer_config.get('inChannels', 1)
                out_channels = layer_config.get('outChannels', 32)
                kernel_size = layer_config.get('kernelSize', 3)
                layers.append(f"        self.conv{len(layers)+1} = nn.Conv2d({in_channels}, {out_channels}, {kernel_size})")
    
    # If no layers found, create a simple default model
    if not layers:
        layers = [
            "        self.fc1 = nn.Linear(784, 128)",
            "        self.fc2 = nn.Linear(128, 64)", 
            "        self.fc3 = nn.Linear(64, 10)"
        ]
    
    code += "\n".join(layers)
    
    code += """

    def forward(self, x):
        x = x.view(x.size(0), -1)  # Flatten for fully connected layers
"""
    
    # Add forward pass
    for i in range(len(layers)):
        if i == len(layers) - 1:
            code += f"        x = self.fc{i+1}(x)  # Output layer\n"
        else:
            code += f"        x = F.relu(self.fc{i+1}(x))\n"
    
    code += """        return x

# Initialize model, loss, and optimizer
model = NeuralNetwork()
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

# Example training loop for MNIST
def train_model(model, train_loader, criterion, optimizer, epochs=5):
    model.train()
    for epoch in range(epochs):
        running_loss = 0.0
        for i, (inputs, labels) in enumerate(train_loader):
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            if i % 100 == 99:
                print(f'Epoch [{epoch+1}/{epochs}], Step [{i+1}], Loss: {running_loss/100:.4f}')
                running_loss = 0.0

# Example usage with MNIST dataset
if __name__ == "__main__":
    # Data loading
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.5,), (0.5,))
    ])
    
    train_dataset = torchvision.datasets.MNIST(root='./data', train=True, 
                                               download=True, transform=transform)
    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    
    # Train the model
    print("Starting training...")
    train_model(model, train_loader, criterion, optimizer, epochs=5)
    print("Training completed!")
"""
    
    return code

# Autosave endpoint
@app.post("/models/autosave")
@limiter.limit("60/minute")  # Rate limit autosave
async def autosave_model(
    request: Request,
    model_data: dict,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Autosave model data"""
    if not current_user:
        return {"message": "Not authenticated, model not saved"}
    
    try:
        # Create or update autosave model
        autosave_name = f"Autosave - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
        
        # Look for existing autosave model
        existing = db.query(SavedModel).filter(
            SavedModel.user_id == current_user.id,
            SavedModel.name.like("Autosave -%")
        ).order_by(SavedModel.updated_at.desc()).first()
        
        if existing:
            existing.model_data = json.dumps(model_data)
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return {"message": "Model autosaved successfully", "model_id": existing.id}
        else:
            new_model = SavedModel(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                name=autosave_name,
                description="Automatically saved model",
                model_data=json.dumps(model_data)
            )
            db.add(new_model)
            db.commit()
            db.refresh(new_model)
            return {"message": "Model autosaved successfully", "model_id": new_model.id}
            
    except Exception as e:
        db.rollback()
        # Don't raise error for autosave - just log and return graceful failure
        return {"message": "Autosave failed, but you can continue working", "error": str(e)}

# Mount static files for frontend
if os.path.exists("static"):
    # Mount Next.js static assets at their expected paths
    app.mount("/_next", StaticFiles(directory="static/_next"), name="nextjs-static")
    # Mount other static files 
    app.mount("/static", StaticFiles(directory="static"), name="static")
    
    # Catch-all route to serve React app for client-side routing
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Don't serve frontend for API routes or static assets
        if (full_path.startswith("api/") or 
            full_path.startswith("auth/") or 
            full_path.startswith("models/") or 
            full_path.startswith("_next/") or 
            full_path.startswith("static/") or 
            full_path == "ping" or
            full_path.endswith(".css") or
            full_path.endswith(".js") or
            full_path.endswith(".ico") or
            full_path.endswith(".svg") or
            full_path.endswith(".png") or
            full_path.endswith(".woff2")):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Serve index.html for all non-API routes
        index_path = "static/index.html"
        if os.path.exists(index_path):
            return FileResponse(index_path)
        else:
            raise HTTPException(status_code=404, detail="Frontend not found")
