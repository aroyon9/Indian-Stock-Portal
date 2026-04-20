# Frontend (Next.js 14)

Minimal UI for the portal.

Env:

- `BACKEND_INTERNAL_URL` (optional override) for the Next.js proxy route
  - if unset, proxy tries: `http://127.0.0.1:8010`, `http://localhost:8010`, `http://127.0.0.1:8000`, `http://localhost:8000`

## Dev

```bash
npm install
npm.cmd run dev
```

If you're on Windows PowerShell and `npm` fails with "running scripts is disabled", run `dev.cmd` instead (or use `npm.cmd`).

`npm.cmd run dev` uses `next dev` (hot reload) and automatically falls back to `dev:standalone` if `next dev` fails with `spawn EPERM`.

`dev:standalone` and `build` now clean `.next`/`.turbo` first to avoid stale chunk/cache issues.
