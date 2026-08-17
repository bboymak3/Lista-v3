# Cron Setup — GPS Auto-Purge

This document explains how to schedule the **GPS auto-purge** cron job in production.

The cron job calls the endpoint `POST /api/cron/purge-gps`, which:

1. Deletes `LocationPing` records older than **30 days**.
2. Deletes read `Notification` records (`leida = 1`) older than **90 days**.

The endpoint is protected by a secret header `X-Cron-Secret` that must match the
environment variable `CRON_SECRET`.

---

## 1. Configure the secret

### Cloudflare Workers (OpenNext)

Add a `CRON_SECRET` variable in `wrangler.toml` (under `[vars]`) or via the
Cloudflare dashboard → Workers & Pages → **lista** → Settings → Variables and Secrets.

```bash
# Generate a strong secret
openssl rand -hex 32
```

Add to `wrangler.toml`:

```toml
[vars]
CRON_SECRET = "your-generated-secret-here"
```

> **Tip**: For sensitive values, prefer **Secrets** (encrypted) over plain Vars.
> Dashboard → Workers & Pages → lista → Settings → Variables and Secrets → Add Secret.

For local development, add it to `.dev.vars`:

```bash
echo 'CRON_SECRET="dev-secret-change-me"' >> .dev.vars
```

---

## 2. Option A — Cloudflare Cron Trigger (recommended)

The `wrangler.toml` already declares a Cron Trigger:

```toml
[triggers]
crons = ["0 3 * * *"]   # daily at 03:00 UTC
```

### Important: handling the `scheduled` event

OpenNext's worker does **not** automatically route the Cloudflare `scheduled`
event to a Next.js API route. The Cron Trigger in `wrangler.toml` will fire the
worker's `scheduled()` handler, but our purge logic lives in
`/api/cron/purge-gps`. To bridge this gap, you have two options:

#### Option A1 — External monitor (simplest, recommended)

Use an external HTTP monitor that POSTs to the cron endpoint with the secret
header at the desired schedule. This works regardless of OpenNext limitations.

Services that work well:

- **UptimeRobot** — create an "HTTP(s)" monitor, set keyword/JSON check, method
  POST, custom header `X-Cron-Secret: <your-secret>`, schedule daily.
- **cron-job.org** — free external cron, supports custom headers + POST method.
- **GitHub Actions** — `schedule: cron: '0 3 * * *'` with a `curl` step.

Example GitHub Actions workflow (`.github/workflows/purge-gps.yml`):

```yaml
name: Purge GPS
on:
  schedule:
    - cron: '0 3 * * *'   # 03:00 UTC daily
  workflow_dispatch:
jobs:
  purge:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger purge endpoint
        run: |
          curl -sS -X POST \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            "https://lista.workers.dev/api/cron/purge-gps"
```

> Add `CRON_SECRET` as a repository secret in GitHub.

#### Option A2 — Worker `scheduled()` handler

If you want to keep everything inside Cloudflare, override the OpenNext worker
entry to handle `scheduled`. This requires forking/customizing the
`.open-next/worker.js` after build:

```js
// .open-next/worker.js (post-build patch)
import openNextHandler from 'open-next/dist/handlers/node.js'

export default {
  async fetch(req, env, ctx) {
    return openNextHandler.fetch(req, env, ctx)
  },
  async scheduled(event, env, ctx) {
    // Manually invoke the purge endpoint inside the worker
    const url = `https://${env.NEXT_PUBLIC_APP_URL || 'lista.workers.dev'}/api/cron/purge-gps`
    await fetch(url, {
      method: 'POST',
      headers: { 'X-Cron-Secret': env.CRON_SECRET },
    })
    ctx.waitUntil(Promise.resolve())
  },
}
```

> This patch must be re-applied after each `bun run build:cf`. We recommend
> **Option A1** for simplicity.

---

## 3. Option B — Manual / one-off purge

You can trigger the endpoint manually any time:

```bash
curl -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  https://lista.workers.dev/api/cron/purge-gps
```

A `GET` request is also accepted (for monitors that don't support POST):

```bash
curl -H "X-Cron-Secret: $CRON_SECRET" \
  https://lista.workers.dev/api/cron/purge-gps
```

### Expected response

```json
{
  "ok": true,
  "deleted": 42,
  "details": {
    "locationPings": 38,
    "notifications": 4,
    "gpsCutoff": "2024-08-15T03:00:00.000Z",
    "notifCutoff": "2024-06-16T03:00:00.000Z"
  }
}
```

---

## 4. Removing the built-in Cron Trigger

If you prefer to rely only on external monitors (Option A1), you can remove
the `[triggers]` section from `wrangler.toml` to avoid Cloudflare invoking the
worker's `scheduled` event. This is harmless either way when Option A1 is used.

---

## 5. Verifying it works

After triggering, check Cloudflare Workers logs in the dashboard (Logs tab) or
run `wrangler tail lista` to see the request hit `/api/cron/purge-gps`.

Verify database by counting rows:

```sql
-- D1 console (Cloudflare dashboard)
SELECT COUNT(*) FROM v3_location_pings WHERE timestamp < datetime('now', '-30 days');
SELECT COUNT(*) FROM v3_notifications WHERE createdAt < datetime('now', '-90 days') AND leida = 1;
```

Both counts should be 0 after a successful purge.
