# 🚀 Railway + BuildANeural.net Domain Setup Guide

## Current Status: ✅ Railway Deployment Working

Your Neural Network Builder is currently deployed and working at: 
**https://buildaneuralnet-production.up.railway.app/**

## 🔧 Configuration Updates Applied

I've updated your application to support both your current Railway URL and your future `buildaneural.net` domain:

### ✅ Changes Made

1. **API Backend Configuration** (`apps/api/main.py`):
   - Added `buildaneuralnet-production.up.railway.app` to allowed hosts
   - Added Railway URL to CORS origins
   - Kept `buildaneural.net` for future domain transition

2. **Email Service Configuration** (`apps/api/email_service.py`):
   - Currently uses Railway URL for verification emails
   - Ready to switch to `buildaneural.net` when domain is connected

3. **Docker Configuration** (`docker-compose.yml`):
   - Updated environment variables to support both URLs
   - Ready for seamless domain transition

## 🌐 Railway Environment Variables

In your Railway dashboard, set these environment variables:

```bash
# 🔒 SECURITY (Generate these!)
SECRET_KEY=your-super-secure-secret-key-32-chars-min
ENCRYPTION_KEY=your-super-secure-encryption-key

# 🌐 CURRENT SETUP (Railway)
FRONTEND_URL=https://buildaneuralnet-production.up.railway.app
ALLOWED_ORIGINS=https://buildaneuralnet-production.up.railway.app,https://buildaneural.net,https://www.buildaneural.net
ALLOWED_HOSTS=buildaneuralnet-production.up.railway.app,buildaneural.net,www.buildaneural.net

# 📧 EMAIL CONFIGURATION
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password

# 🗄️ DATABASE (Railway PostgreSQL recommended for production)
DATABASE_URL=postgresql://user:password@host:port/database

# 🛡️ SECURITY
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
```

## 🔐 Generate Secure Keys

```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python -c "import secrets; print('ENCRYPTION_KEY=' + secrets.token_urlsafe(32))"
```

## 📧 Email Setup for User Registration

### Option 1: Gmail (Recommended)
1. Enable 2FA on your Gmail account
2. Generate an App Password: Google Account → Security → App Passwords
3. Use your Gmail address as `SMTP_USER`
4. Use the app password as `SMTP_PASSWORD`

### Option 2: SendGrid/Mailgun (For higher volume)
- Update `SMTP_HOST`, `SMTP_PORT` accordingly
- Use your service credentials

## 🌐 Connecting buildaneural.net Domain

### Step 1: In Railway Dashboard
1. Go to your project settings
2. Navigate to "Domains" section
3. Click "Custom Domain"
4. Add `buildaneural.net` and `www.buildaneural.net`
5. Railway will provide DNS records

### Step 2: In Squarespace DNS Settings
1. Go to your Squarespace domain settings
2. Add the DNS records provided by Railway:
   ```
   Type: CNAME
   Name: www
   Value: [Railway-provided-value]
   
   Type: A
   Name: @
   Value: [Railway-provided-IP]
   ```

### Step 3: Update Environment Variables
Once domain is connected, update in Railway:
```bash
FRONTEND_URL=https://buildaneural.net
```

## 🔄 Current Authentication Flow

1. **User Registration**:
   - User visits https://buildaneuralnet-production.up.railway.app/
   - Registers with email/password
   - Verification email sent to: `https://buildaneuralnet-production.up.railway.app/verify?token=...`

2. **After Domain Connection**:
   - User visits https://buildaneural.net/
   - Same registration flow
   - Verification emails point to: `https://buildaneural.net/verify?token=...`

## 🚀 Deploy Updates to Railway

Since this is a public GitHub repo connected to Railway:

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Configure for Railway deployment + future buildaneural.net domain"
   git push origin main
   ```

2. **Railway auto-deploys** from your GitHub repo

3. **Verify the deployment**:
   - Check Railway logs for any errors
   - Test registration/login at your Railway URL
   - Verify email verification works

## 🧪 Testing Checklist

- [ ] Registration works at Railway URL
- [ ] Login works at Railway URL  
- [ ] Email verification sends (check spam folder)
- [ ] Verification links work
- [ ] CORS errors resolved in browser console
- [ ] All neural network builder features work

## 🔧 Database Considerations

### Current: SQLite (Good for development)
- Works with your current setup
- Limited for high traffic

### Recommended: Railway PostgreSQL
```bash
# In Railway, add PostgreSQL service
# Update DATABASE_URL to provided PostgreSQL URL
DATABASE_URL=postgresql://user:password@host:port/database
```

## 🚨 Security Checklist

- [ ] Strong SECRET_KEY and ENCRYPTION_KEY set
- [ ] Email credentials secured (use app passwords)
- [ ] Environment variables set in Railway (not in code)
- [ ] HTTPS enforced (Railway handles this)
- [ ] CORS properly configured for your domains

## 📞 Troubleshooting

### Authentication Issues
1. Check Railway logs: `railway logs`
2. Verify environment variables in Railway dashboard
3. Test API endpoints directly

### Email Issues
1. Test SMTP credentials separately
2. Check spam folder for verification emails
3. Verify SMTP settings in Railway env vars

### Domain Connection Issues
1. Verify DNS propagation: `dig buildaneural.net`
2. Check Railway domain status
3. Wait 24-48 hours for full DNS propagation

## 🎉 You're All Set!

Your application now supports:
- ✅ Current Railway deployment
- ✅ Future buildaneural.net domain
- ✅ Secure authentication
- ✅ Email verification
- ✅ Production-ready configuration

The transition to your custom domain will be seamless once you connect it in Railway! 🚀 