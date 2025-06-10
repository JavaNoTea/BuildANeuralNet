# 🚀 Deployment Guide: Neural Network Builder

Deploy your Neural Network Builder to `buildaneural.net` using GitHub + Railway (free hosting).

## 📋 Prerequisites

- [GitHub account](https://github.com)
- [Railway account](https://railway.app) (sign up with GitHub)
- Your Squarespace domain: `buildaneural.net`

---

## Step 1: 🐙 Set Up GitHub Repository

### 1.1 Create Repository
```bash
# Navigate to your project directory
cd /home/christian/Documents/nn-builder/nn-builder-without-modal

# Initialize git (if not already)
git init

# Add all files
git add .

# Make initial commit
git commit -m "Initial commit: Neural Network Builder ready for deployment"

# Create repository on GitHub (replace 'your-username')
gh repo create neural-network-builder --public --source=. --remote=origin --push
```

### 1.2 Alternative: Manual GitHub Setup
1. Go to [GitHub.com](https://github.com/new)
2. Create new repository: `neural-network-builder`
3. Set to **Public**
4. Don't initialize with README (we have files already)
5. Copy the commands to push existing repository

---

## Step 2: 🚂 Deploy to Railway

### 2.1 Sign Up for Railway
1. Go to [railway.app](https://railway.app)
2. Click "Sign up with GitHub"
3. Authorize Railway to access your repositories

### 2.2 Deploy Your App
1. Click "New Project" on Railway dashboard
2. Select "Deploy from GitHub repo"
3. Choose your `neural-network-builder` repository
4. Railway will automatically detect the Dockerfile and start deploying

### 2.3 Configure Environment Variables
In your Railway project dashboard:

1. Go to **Variables** tab
2. Add these environment variables:

```bash
# 🔐 SECURITY KEYS (REQUIRED - Generate these!)
SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-encryption-key-here

# 🌐 CORS & DOMAIN SETTINGS
ALLOWED_ORIGINS=https://buildaneural.net,https://your-railway-app.railway.app
ALLOWED_HOSTS=buildaneural.net,your-railway-app.railway.app
FRONTEND_URL=https://buildaneural.net

# 📧 EMAIL SETTINGS (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# 🛠️ PRODUCTION SETTINGS
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
```

### 2.4 Generate Secure Keys
Run these commands to generate secure keys:

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate ENCRYPTION_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## Step 3: 🌐 Configure Your Domain

### 3.1 Get Your Railway URL
1. In Railway dashboard, go to **Settings** → **Domains**
2. Copy your Railway URL (e.g., `https://your-app.railway.app`)

### 3.2 Set Up Custom Domain in Railway
1. In Railway dashboard, go to **Settings** → **Domains**
2. Click "Add Domain"
3. Enter: `buildaneural.net`
4. Railway will provide DNS settings to configure

### 3.3 Configure DNS in Squarespace
1. Log into your Squarespace account
2. Go to **Settings** → **Domains**
3. Click on `buildaneural.net`
4. Go to **DNS Settings**
5. Add these records (provided by Railway):

```
Type: CNAME
Name: @
Value: your-railway-domain.railway.app

Type: CNAME  
Name: www
Value: your-railway-domain.railway.app
```

**Note**: DNS changes can take 24-48 hours to propagate.

---

## Step 4: 🔧 Configure Email (Optional)

If you want user registration/verification emails:

### 4.1 Set Up Gmail App Password
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Go to **Security** → **App passwords**
4. Generate password for "Mail"
5. Use this password in `SMTP_PASSWORD` environment variable

### 4.2 Alternative: Skip Email
If you don't want email features:
- Leave `SMTP_USER` and `SMTP_PASSWORD` empty
- Users will be auto-verified without email confirmation

---

## Step 5: ✅ Verify Deployment

### 5.1 Check Application Health
1. Visit your Railway URL: `https://your-app.railway.app`
2. Test these features:
   - Homepage loads ✓
   - User registration works ✓
   - Neural network builder interface works ✓
   - Code generation works ✓

### 5.2 Check API Health
Visit: `https://your-app.railway.app/ping`
Should return: `{"message": "pong"}`

### 5.3 Test Custom Domain
Once DNS propagates (24-48 hours):
- Visit: `https://buildaneural.net`
- Should show your application ✓

---

## Step 6: 🔄 Continuous Deployment

Your app is now set up for automatic deployment:

1. **Push to GitHub** → **Auto-deploy to Railway**
2. Make changes locally
3. Commit and push:
   ```bash
   git add .
   git commit -m "Update feature X"
   git push origin main
   ```
4. Railway automatically rebuilds and deploys

---

## 🛠️ Troubleshooting

### Common Issues:

#### 1. Build Failures
- Check Railway build logs
- Ensure all dependencies are in `requirements.txt`
- Verify Dockerfile syntax

#### 2. Environment Variables
- Double-check all required variables are set
- Ensure no spaces in variable values
- Check Railway dashboard for typos

#### 3. Domain Not Working
- Wait 24-48 hours for DNS propagation
- Check DNS settings in Squarespace
- Verify CNAME records point to Railway domain

#### 4. CORS Errors
- Ensure `ALLOWED_ORIGINS` includes your domain
- Check browser console for specific errors
- Verify `FRONTEND_URL` is correct

### 📞 Get Help
- Railway Support: [docs.railway.app](https://docs.railway.app)
- GitHub Issues: Create issue in your repository
- Check Railway logs for detailed error messages

---

## 🎉 Success Checklist

- [ ] GitHub repository created and code pushed
- [ ] Railway project deployed successfully
- [ ] Environment variables configured
- [ ] Application accessible via Railway URL
- [ ] Custom domain configured in Railway
- [ ] DNS settings updated in Squarespace
- [ ] Domain resolves to your application (after DNS propagation)
- [ ] All features working correctly
- [ ] Continuous deployment working

---

## 🚀 Your App is Live!

Congratulations! Your Neural Network Builder is now live at:
- **Temporary URL**: `https://your-app.railway.app`
- **Custom Domain**: `https://buildaneural.net` (after DNS propagation)

Users can now:
- ✅ Build neural networks visually
- ✅ Generate PyTorch code
- ✅ Save and load models
- ✅ Create accounts and authenticate
- ✅ Access from anywhere in the world

**Share your creation with the world! 🌍** 