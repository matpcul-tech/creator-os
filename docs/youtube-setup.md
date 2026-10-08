# Turn on YouTube posting (one-time setup)

1. Go to https://console.cloud.google.com/ and create a project, for example "CreatorAI".
2. Go to **APIs & Services > Library**, search for **YouTube Data API v3**, and click **Enable**.
3. Set up **APIs & Services > OAuth consent screen**:
   - User type: **External**.
   - Fill in the app name, a support email, and a developer contact email.
   - Scopes: add `https://www.googleapis.com/auth/youtube.upload`.
   - Publishing status: leave it in **Testing**.
   - Test users: add the Google account that owns your YouTube channel.
   - In Testing mode, refresh tokens expire after 7 days, so you'll press Connect YouTube again about once a week. You can avoid this by publishing the app, which needs Google verification for the YouTube scope.
4. Go to **APIs & Services > Credentials > Create credentials > OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URIs:
     - `https://creatorai-os.vercel.app/api/youtube/callback`
     - Optional, for local testing: `http://localhost:3000/api/youtube/callback`
   - Copy the Client ID and Client secret.
5. In Vercel, go to the creator-os project, then **Settings > Environment Variables**, and add these for Production (and Preview if you want):
   - `GOOGLE_CLIENT_ID`: the client ID
   - `GOOGLE_CLIENT_SECRET`: the client secret
   - Optional: `TOKEN_ENCRYPTION_KEY`, a long random string (`openssl rand -base64 32`). If you skip it, `APP_SESSION_SECRET` is used. If you set it after connecting, you'll need to connect again.
   - Optional: `GOOGLE_REDIRECT_URI`. Only set this if you use a custom domain. It must exactly match one of the URIs from step 4.
6. Redeploy. Then open **Integrations > YouTube** and click **Connect YouTube**. Sign in with the test-user account and allow access.
7. Verify the channel at https://www.youtube.com/verify so custom thumbnails work.

Note: Vercel preview URLs change with every deploy, so the OAuth redirect only works on the domains you list in step 4.
