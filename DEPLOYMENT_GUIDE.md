# Deployment Guide for Stickman Fighter

## Hosting Alternatives to Render
Since you mentioned Render is slow, here are robust alternatives for Node.js/Socket.io apps:

1. **Railway (Recommended)**
   - Excellent for WebSocket support.
   - Fast spin-up times.
   - Generous free tier/trial.
   - *How to:* Connect your GitHub repo and it auto-detects `package.json`.

2. **Fly.io**
   - Run your app close to users (low latency).
   - Good for real-time games.
   - Requires command line tool `flyctl`.

3. **Vercel (Serverless)**
   - **Note:** Vercel is great for Next.js but *tricky* for Socket.io because of serverless functions. You would need to use a separate WebSocket provider (like Pusher) or stick to Railway/Fly/Heroku for the custom server. **Avoid Vercel for this specific stateful server code.**

4. **Heroku**
   - Classic, reliable, but no longer free options.

## Deployment Steps (General)
1. **Push your code to GitHub.**
2. **Sign up** for Railway or Fly.io.
3. **Import Project:** Select your `Stickman-Fighter` repo.
4. **Environment Variables:**
   - Ensure `PORT` is exposed (Railway does this automatically).
5. **Install Command:** `npm install`
6. **Start Command:** `node server.js`

## Local Development
To run locally:
1. Open terminal.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in your browser.
