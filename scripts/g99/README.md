# G99 clinic-website harvest (Phase 0)

Copies **every live G99 clinic's website URL** into medspa-map's
`g99_clinic_websites` table (one row per clinic, with the G99 clinic id +
business/tenant id). This is the discovery list that later phases scrape.

- **Read-only** on G99 (prod Aurora reader), reached over an SSH tunnel through
  the bastion.
- The **only** write is an upsert into `g99_clinic_websites` on our Neon DB.
- Junk/placeholder URLs (`growth99.com`, social, `n/a`, …) and test/internal
  businesses are **flagged** (`is_placeholder` / `is_test`), never dropped.

## Setup

```bash
cd scripts/g99
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Credentials live in `scripts/g99/.env.g99` (gitignored). Keys:

| key | meaning |
|-----|---------|
| `G99_SSH_HOST` / `G99_SSH_PORT` / `G99_SSH_USER` / `G99_SSH_PASSWORD` | bastion (jump host), password auth |
| `G99_PROD_HOST` / `G99_PROD_PORT` / `G99_PROD_DB` / `G99_PROD_USER` / `G99_PROD_PASSWORD` | G99 prod Aurora reader (through the tunnel) |
| `LOCAL_BIND_PORT` | local port the tunnel binds (default `55432`) |
| `MEDSPA_DATABASE_URL` | our Neon DB (write target) |

## Run

```bash
# 1) verify the tunnel + prod reachability (no writes)
.venv/bin/python harvest_websites.py --check

# 2) full harvest → upsert into g99_clinic_websites
.venv/bin/python harvest_websites.py
```

Re-running is safe/idempotent (`ON CONFLICT (g99_clinic_id) DO UPDATE`).

## Notes
- Uses SSH **password** auth. To use a key instead, swap `ssh_password=` for
  `ssh_pkey=` in `open_tunnel()`.
- `websiteDomain()` mirrors `web/src/lib/admin/clinic-save.ts` so domains match
  the app's dedup key.
- ⚠️ Rotate all credentials before launch (see `TASKS.md` §6.5).
