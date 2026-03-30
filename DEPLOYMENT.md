# 🚀 Simplified Deployment Guide (Gemini API)

## ✅ What Changed:
- **No more Python AI service needed**
- **Direct Gemini API integration** in Node.js backend
- **Simpler deployment** - only need to deploy the backend
- **Faster response times** - no service-to-service communication

## Step 1: Deploy Backend (Node.js/Express Only)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Switch to Gemini API integration"
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
   - Add: `GEMINI_API_KEY = AIzaSyAfZXNAm3stDQeXNbZlKe9PcpGY6slvzXU` (or your own key)

## Step 2: Update Frontend

1. **Update API URL in frontend:**
   - Find where you make API calls (likely in ATSModal.jsx)
   - Replace `http://localhost:5000` with your Railway backend URL
   - Example: `https://your-backend.railway.app`

2. **Update Backend CORS:**
   - In `server/index.js`, replace `your-netlify-domain.netlify.app` with your actual Netlify domain

3. **Redeploy to Netlify:**
   - Push changes to GitHub
   - Netlify will auto-redeploy

## Environment Variables Needed

### Backend Only:
- `NODE_ENV = production`
- `GEMINI_API_KEY = AIzaSyAfZXNAm3stDQeXNbZlKe9PcpGY6slvzXU`
- `PORT = 5000` (Railway sets this automatically)

## Testing

1. Test backend: `https://your-backend.railway.app/ats-check`
2. Test full app on Netlify

## Cost

- **Railway Backend:** $0/month (free tier)
- **Gemini API:** Free tier generous limits, then pay-per-use
- **Total:** Much cheaper than running separate AI service!

## Benefits of This Approach

✅ **Simpler Architecture** - No Python service to manage  
✅ **Faster Deployment** - Only one service to deploy  
✅ **Lower Costs** - No separate hosting for AI service  
✅ **Better Reliability** - Fewer moving parts  
✅ **Gemini Power** - State-of-the-art AI analysis  
✅ **Easy Scaling** - Just scale the Node.js service  

## Troubleshooting

- If API errors: Check Gemini API key is correct
- If CORS errors: Update the origin URL in backend
- If 504 errors: Service might be starting up (wait 2-3 minutes)
- If rate limited: Gemini has generous limits but may need upgrade

## 🎯 You No Longer Need:
- ❌ Python AI service deployment
- ❌ Docker configuration
- ❌ Multiple service management
- ❌ Complex service-to-service communication

**Your ATS checker is now much simpler and more reliable!** 🚀
