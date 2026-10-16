# Daily autopilot: one-time setup

Autopilot runs on GitHub Actions (`.github/workflows/daily-autopilot.yml`) every day at 11:30 AM Central.
It writes a script with Claude Sonnet (about 2 cents a day, max 3 calls per run), voices it with a free
edge-tts voice, renders a 1080x1920 Short with ffmpeg, and uploads it to Red Sky Archive as a Public Short
(not made for kids, AI-voice "altered or synthetic content" flag on). The run log and the pause switch live on the
`autopilot-state` branch and show on the **Daily autopilot** page in the app.

## 1. Google Cloud (about 10 minutes)
1. Follow steps 1 to 4 of `docs/youtube-setup.md` (project, enable YouTube Data API v3, OAuth consent screen,
   Web OAuth client with redirect `https://creatorai-os.vercel.app/api/youtube/callback`).
2. Important for autopilot: on **OAuth consent screen**, click **Publish app** (switch to In production).
   In Testing mode Google kills the refresh token after 7 days and autopilot would stop. You do not need
   Google verification for your own account; you will just see an "unverified app" screen once. Click
   **Advanced > Go to CreatorAI (unsafe)** then **Allow**.
3. In Vercel add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Settings > Environment Variables), then redeploy.

## 2. Get the token (you only click Allow)
1. Open https://creatorai-os.vercel.app/integrations and click **Connect YouTube**.
   Sign in with the Google account that owns Red Sky Archive and choose that channel. Click **Allow**.
2. Open https://creatorai-os.vercel.app/autopilot and click **Show token**. Use the Copy buttons.

## 3. Paste into GitHub secrets
Go to https://github.com/matpcul-tech/creator-os/settings/secrets/actions > **New repository secret**, add:
- `YT_REFRESH_TOKEN`: from the Autopilot page
- `YT_CLIENT_ID`: from the Autopilot page (same as Vercel)
- `YT_CLIENT_SECRET`: the client secret from Google Cloud
- `ANTHROPIC_API_KEY`: your Anthropic key (without it, autopilot uses plain fact-based template scripts)

## 4. Test
GitHub > Actions > **Daily autopilot** > **Run workflow**, tick **dry_run**. The MP4 appears as the
`short` artifact on the run page. Untick dry_run to post for real.

## Optional: control from the app
Create a fine-grained GitHub token (github.com/settings/personal-access-tokens) for only `matpcul-tech/creator-os`
with **Contents: Read and write** and **Actions: Read and write**. Add it in Vercel as `GITHUB_AUTOPILOT_TOKEN`
and redeploy. The Pause, Resume, Run now and Test render buttons then work from the Autopilot page.
Without it, pause by editing `config.json` on the `autopilot-state` branch (`"paused": true`).

## Editing the books
`autopilot/library.json` holds every title, the only facts the AI may use, the call to action, links,
hashtags and images (in `autopilot/assets`). Scripts are checked for length, dashes and names that are
not in the facts; failures are retried, then replaced by a safe template script.
