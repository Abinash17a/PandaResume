# 🚀 Railway Deployment Guide

## Step 1: Deploy Backend (Node.js/Express)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add Railway deployment config"
   git push origin main
   ```

2. **Deploy to Railway:**
   - Go to [railway.app](https://railway.app)
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Choose the `server` folder
   - Click "Deploy"

3. **Set Environment Variables:**
   - In Railway dashboard → Settings → Variables
   - Add: `NODE_ENV = production`
   - Add: `AI_SERVICE_URL = https://your-ai-service.railway.app` (get this after step 2)

## Step 2: Deploy AI Service (Python/FastAPI)

1. **Deploy to Railway:**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select the same repository
   - Choose the `ai-service` folder
   - Click "Deploy"

2. **Get the URL:**
   - Railway will give you a URL like: `https://your-ai-service.railway.app`

## Step 3: Update Frontend

1. **Update API URLs in frontend:**
   - Find where you make API calls
   - Replace `http://localhost:5000` with your Railway backend URL
   - Example: `https://your-backend.railway.app`

2. **Update Backend CORS:**
   - In `server/index.js`, replace `your-netlify-domain.netlify.app` with your actual Netlify domain

3. **Redeploy to Netlify:**
   - Push changes to GitHub
   - Netlify will auto-redeploy

## Environment Variables Needed

### Backend:
- `NODE_ENV = production`
- `AI_SERVICE_URL = https://your-ai-service.railway.app`
- `PORT = 5000` (Railway sets this automatically)

### AI Service:
- `PORT = 8000` (Railway sets this automatically)

## Testing

1. Test backend: `https://your-backend.railway.app/ats-check`
2. Test AI service: `https://your-ai-service.railway.app/analyze`
3. Test full app on Netlify

## Cost

- **Free Tier:** $0/month (both services)
- **Limitations:** 500 hours/month, 100MB RAM
- **Upgrade:** $5-20/month for more resources

## Troubleshooting

- If AI service fails: Check logs in Railway dashboard
- If CORS errors: Update the origin URL in backend
- If 504 errors: Services might be starting up (wait 2-3 minutes)
