# Deploy LIV8 Command Center to Render

## Quick Deploy (Recommended)

### Step 1: Push to GitHub
```bash
cd command-center
git init
git add .
git commit -m "Initial commit - LIV8 Command Center"
git remote add origin https://github.com/YOUR_USERNAME/liv8-command-center.git
git push -u origin main
```

### Step 2: Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** > **Blueprint**
3. Connect your GitHub repository
4. Render will detect the `render.yaml` and create both services

### Step 3: Set Environment Variables

In your Render dashboard, set these environment variables for the **liv8-ai-server**:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Claude API key |
| `OPENAI_API_KEY` | No | Optional GPT fallback |
| `FRESHDESK_DOMAIN` | No | Your Freshdesk subdomain |
| `FRESHDESK_API_KEY` | No | Freshdesk API key |
| `FRESHDESK_AGENT_ID` | No | Your agent ID in Freshdesk |

### Step 4: Update Frontend API URL

In the **liv8-command-center** service settings, set:
- `VITE_API_URL` = `liv8-ai-server.onrender.com` (your backend URL)

---

## Manual Deploy (Alternative)

### Backend (liv8-ai-server)

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Settings:
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && node server.js`
   - **Environment**: Node
4. Add environment variables (see above)

### Frontend (liv8-command-center)

1. Create a new **Static Site** on Render
2. Connect your GitHub repo
3. Settings:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add redirect rule: `/* -> /index.html` (for SPA routing)
5. Set `VITE_API_URL` to your backend URL

---

## Environment Variables Reference

### Required
```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional
```env
OPENAI_API_KEY=sk-...
FRESHDESK_DOMAIN=yourcompany
FRESHDESK_API_KEY=your-api-key
FRESHDESK_AGENT_ID=123456789
TASKMAGIC_WEBHOOK_URL=https://...
GOOGLE_CALENDAR_EMAIL=your@email.com
GOOGLE_CLIENT_ID=your-client-id
SCHEDULE_ENABLED=true
AI_PROVIDER=claude
```

---

## After Deployment

Your command center will be available at:
- **Frontend**: `https://liv8-command-center.onrender.com`
- **API**: `https://liv8-ai-server.onrender.com`

The AI agents will run 24/7 with scheduled ticket analysis at:
- 8 AM EST
- 12 PM EST
- 4 PM EST
- 12 AM EST

---

## Updating

Push changes to GitHub and Render will auto-deploy:
```bash
git add .
git commit -m "Update feature"
git push
```

---

## Troubleshooting

### "Server not responding"
- Check Render logs for errors
- Verify ANTHROPIC_API_KEY is set correctly
- Wait 2-3 minutes for cold start on free tier

### "CORS errors"
- The backend already has CORS enabled for all origins
- If issues persist, check the API URL in frontend config

### "Scheduled jobs not running"
- Set `SCHEDULE_ENABLED=true` in environment variables
- Check server logs for scheduler initialization
