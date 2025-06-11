import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from jinja2 import Template
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Email configuration
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://www.buildaneural.net")
# Only use development mode if SMTP credentials are missing
DEVELOPMENT_MODE = not (SMTP_USER and SMTP_PASSWORD)

# Email configuration validation
if DEVELOPMENT_MODE:
    print("⚠️  Email service running in development mode - emails will be logged to console")
else:
    print("📧 Email service configured for production - real emails will be sent")

# Email templates
VERIFICATION_EMAIL_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f4f4f4; padding: 20px; }
        .button { 
            display: inline-block; 
            padding: 10px 20px; 
            background-color: #2563eb; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Neural Network Builder!</h1>
        </div>
        <div class="content">
            <h2>Hi {{ username }},</h2>
            <p>Thanks for signing up! Please verify your email address to activate your account.</p>
            <p>Click the button below to verify your email:</p>
            <center>
                <a href="{{ verification_link }}" class="button">Verify Email</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border: 1px solid #ddd;">
                {{ verification_link }}
            </p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Neural Network Builder. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

async def send_verification_email(email: str, username: str, verification_token: str):
    """Send verification email to user"""
    verification_link = f"{FRONTEND_URL}/verify?token={verification_token}"
    
    # In development mode (when no SMTP credentials), just log the email
    if DEVELOPMENT_MODE:
        print("=" * 80)
        print("📧 DEVELOPMENT MODE - EMAIL WOULD BE SENT:")
        print(f"To: {email}")
        print(f"Subject: Verify your Neural Network Builder account")
        print(f"Verification Link: {verification_link}")
        print("=" * 80)
        print("✅ In development, user verification is automatically enabled!")
        print("=" * 80)
        return True
    
    # Send real email when SMTP credentials are available
    print(f"📧 Sending verification email to {email}...")
    
    # Render email template
    template = Template(VERIFICATION_EMAIL_TEMPLATE)
    html_content = template.render(
        username=username,
        verification_link=verification_link
    )
    
    # Create message
    message = MIMEMultipart("alternative")
    message["From"] = SMTP_USER
    message["To"] = email
    message["Subject"] = "Verify your Neural Network Builder account"
    
    # Add HTML part
    html_part = MIMEText(html_content, "html")
    message.attach(html_part)
    
    # Send email
    try:
        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            start_tls=True,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            validate_certs=False,
            timeout=30
        )
        print(f"✅ Verification email sent successfully to {email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email to {email}: {e}")
        return False

async def send_password_reset_email(email: str, username: str, reset_token: str):
    """Send password reset email to user"""
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>Password Reset Request</h2>
            <p>Hi {username},</p>
            <p>We received a request to reset your password. Click the link below to reset it:</p>
            <p><a href="{reset_link}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
        </body>
    </html>
    """
    
    message = MIMEMultipart("alternative")
    message["From"] = SMTP_USER
    message["To"] = email
    message["Subject"] = "Reset your Neural Network Builder password"
    
    html_part = MIMEText(html_content, "html")
    message.attach(html_part)
    
    try:
        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            start_tls=True,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            validate_certs=False,
            timeout=30
        )
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False 