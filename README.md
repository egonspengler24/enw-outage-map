# ENW Live Outage Map

A static, GitHub-Pages-hosted Leaflet map showing:

- **Electricity North West outages** (polygons/lines/points from their open
  data API), refreshed roughly every 5 minutes via a scheduled GitHub Actions
  job that commits `data/outages.json`.
- **Mobile mast / cell locations** (static, from OpenCelliD) as an overlay
  toggle.

The page itself never calls the ENW API directly and never contains the API
key - it just reads the static `data/outages.json` file that Actions keeps
up to date. This keeps the key out of client-side code entirely.

## 1. Get an OpenCelliD key and build the mast layer (optional but wanted)

1. Sign up for a free key at https://opencellid.org/.
2. Run locally (key is only used on your machine, never committed):
   ```bash
   OPENCELLID_API_KEY=your_key_here npm run fetch-masts
   ```
3. This overwrites `data/masts.geojson`. Commit that file - it's static data,
   not a secret.

If you skip this, the map still works, just with an empty mast layer.

## 2. Create the GitHub repo

```bash
cd "OpenDataAPI"
git init
git add .
git commit -m "Initial commit: ENW outage map"
gh repo create <your-repo-name> --public --source=. --remote=origin --push
```

(Or create the repo on github.com first, then `git remote add origin <url>`
and `git push -u origin main`.)

## 3. Add the ENW API key as a repository secret

**Do not put the key in any file that gets committed.** Add it as an
encrypted GitHub Actions secret instead:

```bash
gh secret set ENW_API_KEY --body "your-enw-api-key-here"
```

Or via the web UI: repo → Settings → Secrets and variables → Actions →
"New repository secret" → name `ENW_API_KEY`.

> **Rotate your key.** The key you shared in chat should be treated as
> exposed - request a new one from the ENW open data portal and use that
> for the secret, rather than the one already shown here.

## 4. Allow the workflow to push commits

The scheduled workflow commits the refreshed `data/outages.json` back to the
repo, so it needs write access to contents:

Repo → Settings → Actions → General → "Workflow permissions" → select
**"Read and write permissions"** → Save.

## 5. Enable GitHub Pages

Repo → Settings → Pages → "Build and deployment" → Source: **Deploy from a
branch** → Branch: `main`, folder `/ (root)` → Save.

Your site will be live at `https://<your-username>.github.io/<repo-name>/`
within a minute or two.

## 6. Verify the Action

Repo → Actions → "Update outages" → "Run workflow" (manual trigger via
`workflow_dispatch`) to confirm it fetches and commits successfully before
waiting for the schedule.

## Notes and limitations

- **Refresh timing**: GitHub's `schedule` cron trigger is best-effort, not
  exact - especially on free/public repos, runs can lag 5-15 minutes behind
  the `*/5 * * * *` schedule at busy times. The page itself polls the static
  JSON every 5 minutes regardless.
- **Commit history growth**: with outages changing often, this can create a
  lot of commits over time. That's harmless functionally, but if it bothers
  you, an option later is to write to a dedicated `data` branch and
  force-push a single commit instead of accumulating history on `main`.
- **Mast data caveat**: OpenCelliD entries are crowd-sourced cell
  measurement positions, not officially surveyed mast sites - treat them as
  approximate. Data is CC-BY-SA 4.0; keep the attribution shown in the app.
- **Local preview**: open `index.html` via a local static server (e.g.
  `npx serve .`) - opening the file directly with `file://` will block the
  `fetch()` calls in some browsers.
