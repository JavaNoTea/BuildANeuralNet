# Optimized Dockerfile for Railway deployment - v2
FROM python:3.11-slim

# Install only essential system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy and install minimal Python dependencies (NO PYTORCH)
COPY requirements-production.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && pip cache purge

# Copy backend code
COPY apps/api/ ./

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Start the application (Railway sets PORT automatically)
CMD uvicorn main:app --host 0.0.0.0 --port $PORT 