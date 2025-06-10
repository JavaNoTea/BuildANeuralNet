# Authentication System Setup Guide

## Backend Setup

1. **Install dependencies**:
   ```bash
   cd apps/api
   pip install -r requirements.txt
   ```

2. **Create `.env` file** in `apps/api/`:
   ```env
   # Database
   DATABASE_URL=sqlite:///./nn_builder.db
   
   # Authentication
   SECRET_KEY=your-secret-key-here  # Generate with: openssl rand -hex 32
   
   # Email Configuration (Gmail)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-specific-password  # Generate from Google Account settings
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

3. **Setting up Gmail SMTP**:
   - Go to your Google Account settings
   - Enable 2-factor authentication
   - Generate an app-specific password for "Mail"
   - Use this password in `SMTP_PASSWORD`

4. **Run the API**:
   ```bash
   cd apps/api
   uvicorn main:app --reload --port 8000
   ```

## Frontend Setup

1. **Install dependencies**:
   ```bash
   cd apps/web
   pnpm install
   ```

2. **Create `.env.local` file** in `apps/web/`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

3. **Run the frontend**:
   ```bash
   cd apps/web
   pnpm run dev
   ```

## Docker Compose Setup

If using Docker Compose:

1. **Install dependencies first** (required for Docker build):
   ```bash
   cd apps/web
   pnpm install
   ```

2. **Rebuild and run with Docker Compose**:
   ```bash
   docker compose down
   docker compose build web
   docker compose up
   ```

## Features Implemented

### User Authentication
- **Registration**: Users can sign up with email, username, and password
- **Email Verification**: Verification emails are sent upon registration
- **Login/Logout**: JWT-based authentication with refresh tokens
- **Continue Without Login**: Users can use the app without an account

### Model Persistence
- **Autosave**: Models are automatically saved every 30 seconds for logged-in users
- **Manual Save**: Users can manually save models with custom names
- **Model Management**: CRUD operations for saved models

### Security Features
- **Password Hashing**: Bcrypt for secure password storage
- **JWT Tokens**: Access and refresh tokens for session management
- **Email Verification**: Ensures valid email addresses
- **CORS Configuration**: Proper cross-origin resource sharing

### UI Components
- **Auth Interface**: Clean authentication interface for login/signup
- **User Menu**: Dropdown menu for user actions
- **Email Verification Page**: Handles verification links
- **Loading States**: Proper loading indicators

## Database Schema

### Users Table
- `id`: UUID primary key
- `email`: Unique email address
- `username`: Unique username
- `hashed_password`: Bcrypt hashed password
- `is_active`: Account status
- `is_verified`: Email verification status
- `verification_token`: Email verification token
- `created_at`: Account creation timestamp

### SavedModels Table
- `id`: UUID primary key
- `user_id`: Foreign key to Users
- `name`: Model name
- `description`: Optional description
- `model_data`: JSON string of nodes and edges
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/verify-email` - Verify email address
- `GET /auth/me` - Get current user info
- `POST /auth/refresh` - Refresh access token

### Models
- `POST /models` - Create new saved model
- `GET /models` - List user's models
- `GET /models/{id}` - Get specific model
- `PUT /models/{id}` - Update model
- `DELETE /models/{id}` - Delete model
- `POST /models/autosave` - Autosave current model

## Production Considerations

1. **Database**: Switch from SQLite to PostgreSQL
2. **Email Service**: Consider using SendGrid or AWS SES for better deliverability
3. **Security**: 
   - Use HTTPS in production
   - Set secure CORS origins
   - Use environment-specific secret keys
   - Enable rate limiting
4. **Performance**:
   - Add Redis for caching
   - Implement database connection pooling
   - Use a CDN for static assets 