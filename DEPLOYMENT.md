# 🚀 Heroku Deployment Guide for GraminStore

## Prerequisites

1. **Heroku CLI** installed and logged in
2. **Git** repository initialized
3. **PostgreSQL** addon available

## Step 1: Install Heroku CLI

```bash
# Ubuntu/Debian
curl https://cli-assets.heroku.com/install-ubuntu.sh | sh

# Or download from: https://devcenter.heroku.com/articles/heroku-cli
```

## Step 2: Login to Heroku

```bash
heroku login
```

## Step 3: Create Heroku App

```bash
# Navigate to backend directory
cd backend

# Create Heroku app
heroku create graminstore-backend

# Or create with specific region
heroku create graminstore-backend --region us
```

## Step 4: Add PostgreSQL Database

```bash
# Add Heroku Postgres addon (free tier)
heroku addons:create heroku-postgresql:mini

# Check database URL
heroku config:get DATABASE_URL
```

## Step 5: Set Environment Variables

```bash
# Set secret key
heroku config:set SECRET_KEY="your-super-secret-key-here"

# Set admin credentials
heroku config:set ADMIN_EMAIL="admin@graminstore.com"
heroku config:set ADMIN_PASSWORD="admin123"

# Optional: Set debug mode
heroku config:set DEBUG="False"
```

## Step 6: Deploy to Heroku

```bash
# Add Heroku remote (if not already added)
git remote add heroku https://git.heroku.com/graminstore-backend.git

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# Or if using master branch
git push heroku master
```

## Step 7: Verify Deployment

```bash
# Check app status
heroku ps

# View logs
heroku logs --tail

# Open app in browser
heroku open
```

## Step 8: Access Your App

- **API Documentation**: `https://graminstore-backend.herokuapp.com/docs`
- **Admin Panel**: `https://graminstore-backend.herokuapp.com/admin`
- **Health Check**: `https://graminstore-backend.herokuapp.com/health`

## Admin Credentials

- **Email**: admin@graminstore.com
- **Password**: admin123

## Database Management

```bash
# Access database console
heroku pg:psql

# View database info
heroku pg:info

# Create database backup
heroku pg:backups:capture
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   heroku logs --tail
   
   # Check Python version
   heroku run python --version
   ```

2. **Database Connection Issues**
   ```bash
   # Check DATABASE_URL
   heroku config:get DATABASE_URL
   
   # Test database connection
   heroku run python -c "from app.models.database import engine; print('DB OK')"
   ```

3. **App Crashes**
   ```bash
   # Check app status
   heroku ps:scale web=1
   
   # Restart app
   heroku restart
   ```

### Useful Commands

```bash
# View all config vars
heroku config

# Set multiple config vars
heroku config:set VAR1=value1 VAR2=value2

# Run one-off commands
heroku run python fake_data.py

# View app info
heroku apps:info

# Rename app
heroku apps:rename new-app-name
```

## Scaling

```bash
# Scale web dynos
heroku ps:scale web=2

# Scale to zero (free tier)
heroku ps:scale web=0
```

## Monitoring

```bash
# View metrics
heroku metrics

# View logs in real-time
heroku logs --tail --source app

# View specific log types
heroku logs --tail --source heroku
```

## Custom Domain (Optional)

```bash
# Add custom domain
heroku domains:add www.yourdomain.com

# Check SSL certificate
heroku certs:info
```

---

## Quick Deploy Script

Save this as `deploy.sh` and run `chmod +x deploy.sh && ./deploy.sh`:

```bash
#!/bin/bash
echo "🚀 Deploying GraminStore to Heroku..."

# Check if logged in
heroku auth:whoami || heroku login

# Create app if it doesn't exist
heroku apps:info graminstore-backend || heroku create graminstore-backend

# Add database
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set SECRET_KEY="$(openssl rand -base64 32)"
heroku config:set ADMIN_EMAIL="admin@graminstore.com"
heroku config:set ADMIN_PASSWORD="admin123"

# Deploy
git add .
git commit -m "Deploy to Heroku $(date)"
git push heroku main

echo "✅ Deployment complete!"
echo "🔗 App URL: https://graminstore-backend.herokuapp.com"
echo "📚 API Docs: https://graminstore-backend.herokuapp.com/docs"
echo "⚙️  Admin: https://graminstore-backend.herokuapp.com/admin"
```
