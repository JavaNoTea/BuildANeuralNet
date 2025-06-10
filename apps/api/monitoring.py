"""
Comprehensive monitoring and security logging system
"""

import logging
import json
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from sqlalchemy.orm import Session
from fastapi import Request, Response
import psutil
import threading
from collections import defaultdict, deque
import os

from database import SecurityLog, get_db

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('security.log'),
        logging.StreamHandler()
    ]
)

security_logger = logging.getLogger("security")
performance_logger = logging.getLogger("performance")
audit_logger = logging.getLogger("audit")

class SecurityEventType(Enum):
    """Security event types"""
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGIN_BLOCKED = "LOGIN_BLOCKED"
    ACCOUNT_LOCKOUT = "ACCOUNT_LOCKOUT"
    PASSWORD_RESET = "PASSWORD_RESET"
    EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY"
    API_ABUSE = "API_ABUSE"
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS"
    DATA_ACCESS = "DATA_ACCESS"
    ADMIN_ACTION = "ADMIN_ACTION"
    PAYMENT_EVENT = "PAYMENT_EVENT"
    CODE_EXECUTION = "CODE_EXECUTION"
    FILE_ACCESS = "FILE_ACCESS"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"

class AlertSeverity(Enum):
    """Alert severity levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

@dataclass
class SecurityEvent:
    """Security event data structure"""
    event_type: SecurityEventType
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    severity: AlertSeverity = AlertSeverity.LOW
    description: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

@dataclass
class PerformanceMetric:
    """Performance monitoring data"""
    endpoint: str
    method: str
    response_time: float
    status_code: int
    user_id: Optional[str] = None
    timestamp: datetime = None
    memory_usage: Optional[float] = None
    cpu_usage: Optional[float] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

class ThreatDetector:
    """Real-time threat detection system"""
    
    def __init__(self):
        self.failed_attempts = defaultdict(list)
        self.request_patterns = defaultdict(lambda: deque(maxlen=100))
        self.suspicious_ips = set()
        self.blocked_ips = set()
        
        # Threat thresholds
        self.max_failed_attempts = 5
        self.max_requests_per_minute = 60
        self.suspicious_patterns = [
            r'(\.\./){2,}',  # Path traversal
            r'<script.*?>',  # XSS attempts
            r'union.*select',  # SQL injection
            r'eval\s*\(',  # Code injection
            r'exec\s*\(',  # Code execution
        ]
    
    def analyze_request(self, request: Request, user_id: str = None) -> List[SecurityEvent]:
        """Analyze incoming request for threats"""
        events = []
        ip_address = self._get_client_ip(request)
        
        # Check if IP is already blocked
        if ip_address in self.blocked_ips:
            events.append(SecurityEvent(
                event_type=SecurityEventType.UNAUTHORIZED_ACCESS,
                ip_address=ip_address,
                severity=AlertSeverity.HIGH,
                description="Request from blocked IP address"
            ))
        
        # Rate limiting check
        now = datetime.utcnow()
        self.request_patterns[ip_address].append(now)
        
        # Count requests in last minute
        minute_ago = now - timedelta(minutes=1)
        recent_requests = [
            req_time for req_time in self.request_patterns[ip_address] 
            if req_time > minute_ago
        ]
        
        if len(recent_requests) > self.max_requests_per_minute:
            events.append(SecurityEvent(
                event_type=SecurityEventType.RATE_LIMIT_EXCEEDED,
                ip_address=ip_address,
                user_id=user_id,
                severity=AlertSeverity.MEDIUM,
                description=f"Rate limit exceeded: {len(recent_requests)} requests/minute"
            ))
            self.suspicious_ips.add(ip_address)
        
        # Analyze request content for malicious patterns
        malicious_events = self._check_malicious_patterns(request, user_id, ip_address)
        events.extend(malicious_events)
        
        return events
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _check_malicious_patterns(self, request: Request, user_id: str, ip_address: str) -> List[SecurityEvent]:
        """Check request for malicious patterns"""
        events = []
        
        # Check URL path
        path = str(request.url.path)
        query = str(request.url.query) if request.url.query else ""
        
        import re
        for pattern in self.suspicious_patterns:
            if re.search(pattern, path + query, re.IGNORECASE):
                events.append(SecurityEvent(
                    event_type=SecurityEventType.SUSPICIOUS_ACTIVITY,
                    user_id=user_id,
                    ip_address=ip_address,
                    severity=AlertSeverity.HIGH,
                    description=f"Malicious pattern detected: {pattern}",
                    context={"path": path, "query": query}
                ))
        
        return events
    
    def record_failed_login(self, ip_address: str, user_id: str = None):
        """Record failed login attempt"""
        now = datetime.utcnow()
        self.failed_attempts[ip_address].append(now)
        
        # Clean old attempts (older than 30 minutes)
        cutoff = now - timedelta(minutes=30)
        self.failed_attempts[ip_address] = [
            attempt for attempt in self.failed_attempts[ip_address]
            if attempt > cutoff
        ]
        
        # Check if threshold exceeded
        if len(self.failed_attempts[ip_address]) >= self.max_failed_attempts:
            self.blocked_ips.add(ip_address)
            return True
        
        return False

class PerformanceMonitor:
    """Application performance monitoring"""
    
    def __init__(self):
        self.metrics = deque(maxlen=1000)
        self.endpoint_stats = defaultdict(list)
        self.alerts = []
        
        # Performance thresholds
        self.slow_response_threshold = 2.0  # seconds
        self.high_memory_threshold = 80.0  # percentage
        self.high_cpu_threshold = 80.0  # percentage
    
    def record_request(self, metric: PerformanceMetric):
        """Record request performance metric"""
        self.metrics.append(metric)
        self.endpoint_stats[f"{metric.method} {metric.endpoint}"].append(metric.response_time)
        
        # Check for performance issues
        self._check_performance_alerts(metric)
    
    def _check_performance_alerts(self, metric: PerformanceMetric):
        """Check for performance-related alerts"""
        # Slow response alert
        if metric.response_time > self.slow_response_threshold:
            self.alerts.append({
                'type': 'SLOW_RESPONSE',
                'endpoint': metric.endpoint,
                'response_time': metric.response_time,
                'timestamp': metric.timestamp
            })
        
        # Memory usage alert
        if metric.memory_usage and metric.memory_usage > self.high_memory_threshold:
            self.alerts.append({
                'type': 'HIGH_MEMORY',
                'memory_usage': metric.memory_usage,
                'timestamp': metric.timestamp
            })
        
        # CPU usage alert
        if metric.cpu_usage and metric.cpu_usage > self.high_cpu_threshold:
            self.alerts.append({
                'type': 'HIGH_CPU',
                'cpu_usage': metric.cpu_usage,
                'timestamp': metric.timestamp
            })
    
    def get_endpoint_stats(self, endpoint: str) -> Dict[str, float]:
        """Get performance statistics for an endpoint"""
        times = self.endpoint_stats.get(endpoint, [])
        if not times:
            return {}
        
        return {
            'count': len(times),
            'avg_response_time': sum(times) / len(times),
            'min_response_time': min(times),
            'max_response_time': max(times),
            'p95_response_time': sorted(times)[int(len(times) * 0.95)] if len(times) > 20 else max(times)
        }
    
    def get_system_metrics(self) -> Dict[str, float]:
        """Get current system performance metrics"""
        try:
            return {
                'cpu_percent': psutil.cpu_percent(interval=1),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent,
                'load_average': os.getloadavg()[0] if hasattr(os, 'getloadavg') else 0
            }
        except Exception as e:
            performance_logger.error(f"Error getting system metrics: {e}")
            return {}

class SecurityLogger:
    """Centralized security logging system"""
    
    def __init__(self):
        self.threat_detector = ThreatDetector()
        self.performance_monitor = PerformanceMonitor()
        self._setup_file_rotation()
    
    def _setup_file_rotation(self):
        """Setup log file rotation"""
        from logging.handlers import RotatingFileHandler
        
        # Security log rotation
        security_handler = RotatingFileHandler(
            'logs/security.log', maxBytes=50*1024*1024, backupCount=10
        )
        security_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s'
        ))
        security_logger.addHandler(security_handler)
        
        # Performance log rotation
        perf_handler = RotatingFileHandler(
            'logs/performance.log', maxBytes=50*1024*1024, backupCount=5
        )
        perf_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(message)s'
        ))
        performance_logger.addHandler(perf_handler)
    
    def log_security_event(self, event: SecurityEvent, db: Session = None):
        """Log security event to database and file"""
        try:
            # Log to file
            security_logger.info(
                f"{event.event_type.value} | User: {event.user_id} | "
                f"IP: {event.ip_address} | Severity: {event.severity.value} | "
                f"Description: {event.description}"
            )
            
            # Store in database if available
            if db:
                db_event = SecurityLog(
                    user_id=event.user_id,
                    ip_address=event.ip_address,
                    user_agent=event.user_agent,
                    event_type=event.event_type.value,
                    event_description=event.description,
                    severity=event.severity.value,
                    endpoint=event.endpoint,
                    method=event.method,
                    status_code=event.status_code,
                    context=event.context
                )
                db.add(db_event)
                # Let calling code handle commit
                
        except Exception as e:
            security_logger.error(f"Failed to log security event: {e}")
    
    def log_performance_metric(self, metric: PerformanceMetric):
        """Log performance metric"""
        try:
            self.performance_monitor.record_request(metric)
            
            performance_logger.info(
                f"{metric.method} {metric.endpoint} | "
                f"Response: {metric.response_time:.3f}s | "
                f"Status: {metric.status_code} | "
                f"User: {metric.user_id}"
            )
            
        except Exception as e:
            performance_logger.error(f"Failed to log performance metric: {e}")
    
    def analyze_request(self, request: Request, user_id: str = None) -> List[SecurityEvent]:
        """Analyze request for security threats"""
        return self.threat_detector.analyze_request(request, user_id)
    
    def get_security_dashboard_data(self, db: Session) -> Dict[str, Any]:
        """Get security dashboard data"""
        try:
            now = datetime.utcnow()
            last_24h = now - timedelta(hours=24)
            last_hour = now - timedelta(hours=1)
            
            # Query recent events
            recent_events = db.query(SecurityLog).filter(
                SecurityLog.created_at >= last_24h
            ).all()
            
            # Count events by type
            event_counts = defaultdict(int)
            severity_counts = defaultdict(int)
            hourly_events = defaultdict(int)
            
            for event in recent_events:
                event_counts[event.event_type] += 1
                severity_counts[event.severity] += 1
                hour = event.created_at.hour
                hourly_events[hour] += 1
            
            # Get performance stats
            system_metrics = self.performance_monitor.get_system_metrics()
            
            return {
                'total_events_24h': len(recent_events),
                'critical_events_24h': severity_counts.get('CRITICAL', 0),
                'high_events_24h': severity_counts.get('HIGH', 0),
                'blocked_ips': len(self.threat_detector.blocked_ips),
                'suspicious_ips': len(self.threat_detector.suspicious_ips),
                'event_counts': dict(event_counts),
                'severity_counts': dict(severity_counts),
                'hourly_distribution': dict(hourly_events),
                'system_metrics': system_metrics,
                'performance_alerts': self.performance_monitor.alerts[-10:],  # Last 10 alerts
            }
            
        except Exception as e:
            security_logger.error(f"Error generating dashboard data: {e}")
            return {}

# Global security logger instance
security_monitor = SecurityLogger()

# Middleware for automatic monitoring
class SecurityMonitoringMiddleware:
    """FastAPI middleware for automatic security monitoring"""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        
        # Create request object for analysis
        request = Request(scope, receive)
        
        # Analyze request for threats
        user_id = None  # Would extract from JWT token if available
        security_events = security_monitor.analyze_request(request, user_id)
        
        # Log security events
        for event in security_events:
            db_gen = get_db()
            db = next(db_gen)
            try:
                security_monitor.log_security_event(event, db)
            finally:
                db.close()
        
        # Continue with request processing
        response_sent = False
        status_code = 500
        
        async def send_wrapper(message):
            nonlocal response_sent, status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            elif message["type"] == "http.response.body" and not response_sent:
                response_sent = True
                
                # Log performance metric
                response_time = time.time() - start_time
                system_metrics = security_monitor.performance_monitor.get_system_metrics()
                
                metric = PerformanceMetric(
                    endpoint=request.url.path,
                    method=request.method,
                    response_time=response_time,
                    status_code=status_code,
                    user_id=user_id,
                    memory_usage=system_metrics.get('memory_percent'),
                    cpu_usage=system_metrics.get('cpu_percent')
                )
                
                security_monitor.log_performance_metric(metric)
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)

# Background task for alert processing
async def process_alerts():
    """Background task to process and send alerts"""
    while True:
        try:
            # Check for critical alerts
            alerts = security_monitor.performance_monitor.alerts
            critical_alerts = [alert for alert in alerts if alert.get('type') in ['HIGH_MEMORY', 'HIGH_CPU']]
            
            # In a real application, you would send these alerts via email, Slack, etc.
            if critical_alerts:
                security_logger.critical(f"Critical alerts detected: {len(critical_alerts)}")
            
            # Sleep for 1 minute before next check
            await asyncio.sleep(60)
            
        except Exception as e:
            security_logger.error(f"Error in alert processing: {e}")
            await asyncio.sleep(60)

# Function to start background monitoring
def start_background_monitoring():
    """Start background monitoring tasks"""
    try:
        os.makedirs('logs', exist_ok=True)
        
        # Start alert processing in background
        asyncio.create_task(process_alerts())
        
        security_logger.info("Security monitoring system started")
        
    except Exception as e:
        security_logger.error(f"Failed to start monitoring: {e}")

# Export key functions and classes
__all__ = [
    'SecurityEvent', 'SecurityEventType', 'AlertSeverity',
    'PerformanceMetric', 'SecurityLogger', 'security_monitor',
    'SecurityMonitoringMiddleware', 'start_background_monitoring'
] 