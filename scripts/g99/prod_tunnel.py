#!/usr/bin/env python3
"""
prod_tunnel.py — hold a persistent SSH tunnel to the G99 PROD Aurora reader so
the Next app can query it live (admin "G99 Websites" detail view).

Binds 127.0.0.1:<PROD_TUNNEL_PORT> (default 5435) → G99 prod:5432 through the
bastion, then blocks. Point G99_PROD_DATABASE_URL at localhost:<port>.

  python prod_tunnel.py            # foreground
  (run in background to keep it up)

Creds come from scripts/g99/.env.g99 (gitignored).
"""

import logging
import os
import sys
import time

from sshtunnel import SSHTunnelForwarder

logging.getLogger("paramiko").setLevel(logging.WARNING)

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(HERE, ".env.g99")


def load_env(path):
    if not os.path.exists(path):
        sys.exit(f"Missing {path}")
    cfg = {}
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line or line.lstrip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
                v = v[1:-1]
            cfg[k] = v
    return cfg


CFG = load_env(ENV_PATH)


def cfg(key, default=None, required=False):
    val = CFG.get(key, os.environ.get(key, default))
    if required and not val:
        sys.exit(f"Missing required config: {key}")
    return val


def main():
    port = int(cfg("PROD_TUNNEL_PORT", "5435"))
    server = SSHTunnelForwarder(
        (cfg("G99_SSH_HOST", required=True), int(cfg("G99_SSH_PORT", "22"))),
        ssh_username=cfg("G99_SSH_USER", required=True),
        ssh_password=cfg("G99_SSH_PASSWORD", required=True),
        remote_bind_address=(
            cfg("G99_PROD_HOST", required=True),
            int(cfg("G99_PROD_PORT", "5432")),
        ),
        local_bind_address=("127.0.0.1", port),
    )
    server.start()
    print(f"✓ G99 PROD tunnel up on 127.0.0.1:{server.local_bind_port} → "
          f"{cfg('G99_PROD_HOST')}:{cfg('G99_PROD_PORT', '5432')}", flush=True)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass
    finally:
        server.stop()


if __name__ == "__main__":
    main()
