#!/usr/bin/env python3
"""
harvest_websites.py — Phase 0 (v2) G99 medspa-website harvest.

Reads G99 PROD (read-only, through an SSH tunnel) and writes ONE ROW PER UNIQUE
website into medspa-map's `g99_clinic_websites` table on Neon.

Filters (a clinic is kept only if ALL hold):
  • business is VALID     — clinic.tenant_id resolves to a non-deleted business
  • business is MEDSPA     — businesses.specialization_id ∈ MEDSPA set (Medical
                             Aesthetics / Cosmetics / Plastic Surgery / Dermatology)
  • NOT dental-only        — businesses.dental_specialization_only = false
  • NOT test/internal      — business_config.is_test_business / internal_business
  • website is real        — domain not in the junk/placeholder blocklist
                             (growth99, instagram, …) and not "n/a"

Each unique website stores the arrays of every matching G99 clinic id + business
(tenant) id; full per-clinic detail is fetched LIVE from prod by those ids.

Usage:
    python harvest_websites.py --check     # tunnel + filtered count, no writes
    python harvest_websites.py             # rebuild the table

Config: scripts/g99/.env.g99 (gitignored). Read-only on G99; writes only Neon.
"""

import logging
import os
import re
import sys
from urllib.parse import urlsplit

import psycopg2
import psycopg2.extras
from sshtunnel import SSHTunnelForwarder

logging.getLogger("paramiko").setLevel(logging.WARNING)

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(HERE, ".env.g99")

# G99 specialization ids treated as "medspa" (see specializations table).
# 1 Medical Aesthetics · 2 Medical Cosmetics · 67 Plastic Surgery · 68 Dermatology.
MEDSPA_SPECIALIZATION_IDS = [1, 2, 67, 68]


def load_env(path):
    if not os.path.exists(path):
        sys.exit(f"Missing {path}. Copy the template and fill in credentials.")
    cfg = {}
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key, val = key.strip(), val.strip()
            if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                val = val[1:-1]
            cfg[key] = val
    return cfg


_CFG = load_env(ENV_PATH)


def cfg(key, default=None, required=False):
    val = _CFG.get(key, os.environ.get(key, default))
    if required and not val:
        sys.exit(f"Missing required config: {key}")
    return val


# ── website filtering ─────────────────────────────────────────────────────────
BLOCKED_DOMAINS = {
    "growth99.com", "growthemr.com", "example.com", "test.com",
    "instagram.com", "facebook.com", "fb.com", "twitter.com", "x.com",
    "tiktok.com", "youtube.com", "youtu.be", "linkedin.com",
    "yelp.com", "google.com", "goo.gl", "maps.app.goo.gl",
    "linktr.ee", "bit.ly", "gogroth.com",
}
JUNK_RAW = {"", "n/a", "na", "none", "null", "-", ".", "http://", "https://"}


def website_domain(website: str) -> str:
    if not website:
        return ""
    w = website.strip()
    try:
        u = w if w.startswith("http") else f"https://{w}"
        host = urlsplit(u).hostname or ""
        return re.sub(r"^www\.", "", host).lower()
    except Exception:
        h = re.sub(r"^https?://", "", w)
        h = re.sub(r"^www\.", "", h)
        return h.split("/")[0].lower()


def is_blocked(domain: str) -> bool:
    if not domain:
        return True
    return any(domain == b or domain.endswith("." + b) for b in BLOCKED_DOMAINS)


# ── SQL ──────────────────────────────────────────────────────────────────────
G99_QUERY = """
    SELECT c.id                 AS clinic_id,
           c.tenant_id          AS tenant_id,
           c.name               AS clinic_name,
           c.website            AS website,
           b.name               AS business_name,
           s.name               AS specialization
    FROM clinics c
    JOIN businesses b ON b.id = c.tenant_id AND b.deleted IS NOT TRUE
    LEFT JOIN specializations s ON s.id = b.specialization_id
    LEFT JOIN LATERAL (
      SELECT bool_or(bc.is_test_business) AS is_test,
             bool_or(bc.internal_business) AS is_internal
      FROM business_config bc
      WHERE bc.tenant_id = c.tenant_id
    ) cfg ON TRUE
    WHERE c.deleted IS NOT TRUE
      AND c.website IS NOT NULL AND TRIM(c.website) <> ''
      AND b.specialization_id = ANY(%s::bigint[])
      AND COALESCE(b.dental_specialization_only, false) = false
      AND COALESCE(cfg.is_test, false) = false
      AND COALESCE(cfg.is_internal, false) = false
"""

COUNT_QUERY = """
    SELECT count(*) FROM clinics c
    JOIN businesses b ON b.id = c.tenant_id AND b.deleted IS NOT TRUE
    WHERE c.deleted IS NOT TRUE AND c.website IS NOT NULL AND TRIM(c.website) <> ''
      AND b.specialization_id = ANY(%s::bigint[])
      AND COALESCE(b.dental_specialization_only, false) = false
"""

DDL = """
DROP VIEW IF EXISTS public.g99_websites;
DROP TABLE IF EXISTS public.g99_clinic_websites;
CREATE TABLE public.g99_clinic_websites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain           text UNIQUE NOT NULL,
  website          text NOT NULL,
  g99_clinic_ids   bigint[] NOT NULL DEFAULT '{}',
  g99_business_ids bigint[] NOT NULL DEFAULT '{}',
  clinic_count     integer NOT NULL DEFAULT 0,
  business_count   integer NOT NULL DEFAULT 0,
  business_name    text,
  clinic_name      text,
  specialization   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_g99_clinic_websites_domain ON public.g99_clinic_websites(domain);
"""

INSERT = """
INSERT INTO public.g99_clinic_websites
  (domain, website, g99_clinic_ids, g99_business_ids, clinic_count, business_count,
   business_name, clinic_name, specialization)
VALUES %s
"""


# ── connections ───────────────────────────────────────────────────────────────
def open_tunnel():
    return SSHTunnelForwarder(
        (cfg("G99_SSH_HOST", required=True), int(cfg("G99_SSH_PORT", "22"))),
        ssh_username=cfg("G99_SSH_USER", required=True),
        ssh_password=cfg("G99_SSH_PASSWORD", required=True),
        remote_bind_address=(
            cfg("G99_PROD_HOST", required=True),
            int(cfg("G99_PROD_PORT", "5432")),
        ),
        local_bind_address=("127.0.0.1", int(cfg("LOCAL_BIND_PORT", "55432"))),
    )


def g99_connect(tunnel):
    conn = psycopg2.connect(
        host="127.0.0.1",
        port=tunnel.local_bind_port,
        dbname=cfg("G99_PROD_DB", "postgres"),
        user=cfg("G99_PROD_USER", required=True),
        password=cfg("G99_PROD_PASSWORD", required=True),
        connect_timeout=30,
    )
    conn.set_session(readonly=True, autocommit=True)
    return conn


# ── flows ────────────────────────────────────────────────────────────────────
def run_check():
    print("→ Opening SSH tunnel to G99 prod …")
    with open_tunnel() as tunnel:
        conn = g99_connect(tunnel)
        try:
            with conn.cursor() as cur:
                cur.execute(COUNT_QUERY, (MEDSPA_SPECIALIZATION_IDS,))
                n = cur.fetchone()[0]
        finally:
            conn.close()
    print(f"✓ Tunnel OK — medspa clinics with a website (valid biz, not dental-only): {n}")


def run_harvest():
    print("→ Reading medspa clinics from G99 prod …")
    with open_tunnel() as tunnel:
        conn = g99_connect(tunnel)
        try:
            with conn.cursor() as cur:
                cur.execute(G99_QUERY, (MEDSPA_SPECIALIZATION_IDS,))
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        finally:
            conn.close()
    print(f"  fetched {len(rows)} medspa clinic rows")

    # Group surviving clinics by unique website domain.
    by_domain: dict[str, dict] = {}
    n_blocked = 0
    for r in rows:
        raw = (r["website"] or "").strip()
        domain = website_domain(raw)
        if is_blocked(domain) or raw.lower() in JUNK_RAW:
            n_blocked += 1
            continue
        d = by_domain.get(domain)
        if not d:
            d = {
                "website": f"https://{domain}",
                "clinic_ids": [],
                "business_ids": set(),
                "business_name": r["business_name"],
                "clinic_name": r["clinic_name"],
                "specialization": r["specialization"],
            }
            by_domain[domain] = d
        d["clinic_ids"].append(int(r["clinic_id"]))
        if r["tenant_id"] is not None:
            d["business_ids"].add(int(r["tenant_id"]))

    values = []
    for domain, d in by_domain.items():
        clinic_ids = sorted(set(d["clinic_ids"]))
        business_ids = sorted(d["business_ids"])
        values.append((
            domain,
            d["website"],
            clinic_ids,
            business_ids,
            len(clinic_ids),
            len(business_ids),
            d["business_name"],
            d["clinic_name"],
            d["specialization"],
        ))

    print("→ Rebuilding Neon g99_clinic_websites …")
    conn = psycopg2.connect(cfg("MEDSPA_DATABASE_URL", required=True))
    try:
        with conn.cursor() as cur:
            cur.execute(DDL)
            psycopg2.extras.execute_values(cur, INSERT, values, page_size=500)
        conn.commit()
    finally:
        conn.close()

    multi_loc = sum(1 for _, d in by_domain.items() if len(set(d["clinic_ids"])) > 1)
    multi_biz = sum(1 for _, d in by_domain.items() if len(d["business_ids"]) > 1)
    print("✓ Harvest complete.")
    print(f"  unique medspa websites written    : {len(values)}")
    print(f"  clinic rows scanned               : {len(rows)}")
    print(f"  excluded (junk/placeholder site)  : {n_blocked}")
    print(f"  multi-location websites (>1 clinic): {multi_loc}")
    print(f"  multi-business websites (>1 biz)   : {multi_biz}")


def main():
    if "--check" in sys.argv:
        run_check()
    else:
        run_harvest()


if __name__ == "__main__":
    main()
