# Optimized lightweight Dockerfile for Railway
FROM python:3.11-alpine

# Install only essential system dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy and install Python dependencies
COPY apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip cache purge

# Copy backend code
COPY apps/api/ ./

# Create non-root user for security
RUN adduser -D app
RUN chown -R app:app /app
USER app

# Start the application (Railway sets PORT automatically)
CMD uvicorn main:app --host 0.0.0.0 --port $PORT 