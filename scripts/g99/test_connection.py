"""
Test connection to the G99 prod Aurora Postgres via SSH tunnel.

Reads credentials from .env.g99 (same folder). Opens an SSH tunnel through the
EC2 bastion, binds it to LOCAL_PORT (5434 — the port the Next.js app's
G99_DATABASE_URL already expects), connects with psycopg2, and prints a
schema/table overview so we can see what data lives there.

Usage:
    python test_connection.py            # connection test + table overview
    python test_connection.py --keep     # keep the tunnel open (Ctrl+C to stop)
"""

import os
import sys
import time

import psycopg2
import sshtunnel
from sshtunnel import SSHTunnelForwarder

# Generous timeouts — the EC2 bastion can be slow to present its SSH banner.
sshtunnel.SSH_TIMEOUT = 30.0
sshtunnel.TUNNEL_TIMEOUT = 30.0

HERE = os.path.dirname(os.path.abspath(__file__))


def load_env(path: str) -> dict:
    """Tiny .env parser — values taken literally (passwords contain #, \\, $, &)."""
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip()
    return env


def main() -> None:
    cfg = load_env(os.path.join(HERE, ".env.g99"))
    keep_open = "--keep" in sys.argv

    print(f"[1/3] Opening SSH tunnel via {cfg['SSH_USER']}@{cfg['SSH_HOST']} ...")
    tunnel = SSHTunnelForwarder(
        (cfg["SSH_HOST"], int(cfg.get("SSH_PORT", 22))),
        ssh_username=cfg["SSH_USER"],
        ssh_password=cfg["SSH_PASSWORD"],
        remote_bind_address=(cfg["DB_HOST"], int(cfg.get("DB_PORT", 5432))),
        local_bind_address=("127.0.0.1", int(cfg.get("LOCAL_PORT", 5434))),
    )
    tunnel.start()
    print(f"      Tunnel up: localhost:{tunnel.local_bind_port} -> {cfg['DB_HOST']}:{cfg['DB_PORT']}")

    try:
        print(f"[2/3] Connecting to Postgres as {cfg['DB_USER']} / db={cfg['DB_NAME']} ...")
        conn = psycopg2.connect(
            host="127.0.0.1",
            port=tunnel.local_bind_port,
            user=cfg["DB_USER"],
            password=cfg["DB_PASSWORD"],
            dbname=cfg["DB_NAME"],
            connect_timeout=15,
        )
        conn.set_session(readonly=True)
        cur = conn.cursor()

        cur.execute("SELECT version(), current_database(), current_user")
        version, db, user = cur.fetchone()
        print(f"      Connected. {version.split(',')[0]} | db={db} | user={user}")

        print("[3/3] Schema overview:\n")

        # Schemas
        cur.execute("""
            SELECT schema_name FROM information_schema.schemata
            WHERE schema_name NOT IN ('pg_catalog','information_schema')
            ORDER BY 1
        """)
        schemas = [r[0] for r in cur.fetchall()]
        print(f"  Schemas: {', '.join(schemas)}\n")

        # Tables with approximate row counts, biggest first
        cur.execute("""
            SELECT schemaname, relname, n_live_tup
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC
        """)
        rows = cur.fetchall()
        print(f"  {'TABLE':<45} {'~ROWS':>12}")
        print(f"  {'-'*45} {'-'*12}")
        for schema, table, count in rows:
            name = f"{schema}.{table}" if schema != "public" else table
            print(f"  {name:<45} {count:>12,}")
        print(f"\n  Total tables: {len(rows)}")

        # Columns of the tables we care about for the import
        for t in ("businesses", "clinics", "services", "service_clinic", "reviews"):
            cur.execute("""
                SELECT column_name || ' ' || data_type
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%s
                ORDER BY ordinal_position
            """, (t,))
            cols = [r[0] for r in cur.fetchall()]
            if cols:
                print(f"\n  == {t} ==")
                print("  " + ", ".join(cols))

        cur.close()
        conn.close()
        print("\nSUCCESS: SSH tunnel + DB connection both work.")

        if keep_open:
            print(f"\nTunnel staying open on localhost:{tunnel.local_bind_port} — Ctrl+C to stop.")
            try:
                while True:
                    time.sleep(60)
            except KeyboardInterrupt:
                pass
    finally:
        tunnel.stop()
        print("Tunnel closed.")


if __name__ == "__main__":
    main()
