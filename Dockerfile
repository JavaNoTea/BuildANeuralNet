# Multi-service Dockerfile for Railway deployment
FROM node:18-alpine AS frontend-builder

# Build frontend
WORKDIR /app/frontend
COPY apps/web/package*.json apps/web/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY apps/web/ ./
RUN pnpm build

# Backend stage
FROM python:3.11-slim AS backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy and install Python dependencies
COPY apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY apps/api/ ./

# Copy built frontend to serve statically
COPY --from=frontend-builder /app/frontend/.next/standalone ./static/
COPY --from=frontend-builder /app/frontend/.next/static ./static/.next/static
COPY --from=frontend-builder /app/frontend/public ./static/public

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Expose port (Railway will set PORT environment variable)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ping || exit 1

# Start the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 