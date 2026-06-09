# Creator Stack Hub

Static Next.js 14 marketing hub for Creator Stack — linking Creator OS, Prompt Architect, and Manuscript Studio in one sovereign creator platform.

## Deploy to Vercel

1. Push this repo to GitHub (already done on branch `claude/website-creation-setup-wplcfm`)
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Select the `creator-os` repo, branch `claude/website-creation-setup-wplcfm`
4. Set **Root Directory** to `hub/` in the Vercel project settings
5. Click Deploy — no environment variables needed

## Local dev

```bash
cd hub
npm install
npm run dev
# → http://localhost:3000
```

## Formspree setup (partner form)

1. Go to [formspree.io](https://formspree.io) and create a free account
2. Create a new form, copy the endpoint URL (looks like `https://formspree.io/f/abc123`)
3. Open `hub/components/PartnerSection.tsx` and replace `REPLACE_WITH_YOUR_FORM_ID` with your actual form ID

## Tool links

Update `hub/components/StackVisual.tsx` and `hub/components/Tools.tsx` with your actual Creator OS URL once it is deployed.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS (base/reset only — all design via CSS custom properties in `globals.css`)
- next/font/google — Space Grotesk, Inter, JetBrains Mono
- Formspree for the partner inquiry form (no backend)
