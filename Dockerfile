# Simple Railway deployment - Static Next.js + FastAPI
FROM node:18-alpine AS frontend-builder

# Build Next.js app with static export
WORKDIR /app/frontend
COPY apps/web/package*.json ./
COPY apps/web/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY apps/web/ ./
# Build and export as static files
RUN pnpm run build

# Python backend stage
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory  
WORKDIR /app

# Copy and install Python dependencies
COPY requirements-production.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && pip cache purge

# Copy backend code
COPY apps/api/ ./

# Copy built frontend files
COPY --from=frontend-builder /app/frontend/out ./static/
COPY --from=frontend-builder /app/frontend/.next ./static/.next/

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Start FastAPI server (will serve both API and static files)
CMD uvicorn main:app --host 0.0.0.0 --port $PORT 