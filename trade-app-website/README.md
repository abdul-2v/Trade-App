# Tradarr website

A simple, responsive landing page for Tradarr. This folder is deliberately separate from the Expo iPhone application at the repository root.

## Connect it to Vercel

1. In Vercel, import the GitHub repository `abdul-2v/Trade-App`.
2. Set **Root Directory** to `trade-app-website` (not the repository root).
3. Select **Framework Preset: Other**, if Vercel does not detect it automatically.
4. Leave Build Command and Output Directory empty; this is a static HTML/CSS site with no build step.
5. Deploy. Future pushes to the Git production branch deploy the website automatically.

## Files

- `index.html`: landing page content
- `styles.css`: responsive styling
- `vercel.json`: basic Vercel configuration

No API keys, Supabase credentials or npm installation required. Website buttons navigate only to sections of this preview; booking, accounts and other app functionality have not been connected yet.
