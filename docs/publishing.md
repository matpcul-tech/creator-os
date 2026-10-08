# Posting from the app

Open a card in the Planner and scroll to **Post**.

1. Pick platforms.
2. Choose the exported video file and a thumbnail. The newest thumbnail attached in Thumbnails is picked up automatically.
3. Write a caption for each platform. **AI caption** uses the default model and counts toward `AI_DAILY_BUDGET_USD`. Use **Save captions** to keep them on the piece.
4. Post:
   - **YouTube and YouTube Shorts** post for real through the YouTube Data API v3. The flow is resumable `videos.insert`, then `thumbnails.set`. Visibility defaults to Private. You confirm before anything uploads.
   - **TikTok, Instagram, X, LinkedIn, and Threads** use a share kit: copy the caption, download the video and thumbnail, and open the upload page. Their posting APIs need app review or paid access, so the app doesn't pretend to post. After you post, paste the live URL and press **I posted it**. The piece is then marked Published with that platform's URL.

## How YouTube upload works

- The OAuth tokens are stored in the `OAuthToken` table and encrypted with AES-256-GCM (`lib/crypto-box.ts`). The key comes from `TOKEN_ENCRYPTION_KEY`, or from `APP_SESSION_SECRET` if that isn't set.
- When you press Post now, the browser asks `/api/youtube/token` for a short-lived access token and uploads the file straight to Google. This avoids Vercel's 4.5 MB request body limit. The refresh token never leaves the server.
- Custom thumbnails only work on YouTube channels that are verified (phone verification). If the thumbnail step fails, the video still stays uploaded.
- The tests in `tests/youtube.test.ts` mock every network call (`npm test`). Nothing is posted.

## Adding a real connector later

Connectors are listed in `lib/publish/connectors.ts`. To add one:

1. Set its `mode` to `"api"`.
2. Add OAuth routes like the ones in `app/api/youtube/*`.
3. Handle the platform id in `postNow()` in `components/PostFlow.tsx`.

## Scheduling (designed, not built)

- Data: `ContentPiece.scheduledAt` already exists. Add a `PostJob` table (contentId, platform, runAt, status, attempts, lastError, resultUrl).
- Storage: today the video file only lives in the browser. For scheduled posts, the file has to be stored somewhere first, for example Vercel Blob. The job keeps the blob URL.
- Runner: a Vercel Cron job (`vercel.json` `crons`) calls `/api/cron/publish` every 5 minutes. It is protected by `CRON_SECRET`. It claims due jobs, refreshes the YouTube token, uploads from the blob URL, and marks the piece published. It retries up to 3 times.
- Only API connectors can be scheduled. For share-kit platforms, a scheduled time would mean a reminder instead.
