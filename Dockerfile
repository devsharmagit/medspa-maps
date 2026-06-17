# ─── Stage 1: Build Next.js ───────────────────────────────────────────────────
FROM oven/bun:1 AS web-builder

WORKDIR /app/web

COPY web/package.json web/bun.lock* ./
RUN bun install --frozen-lockfile

COPY web/ ./

# Dummy DB URL so Next.js build doesn't crash — real URL is injected at runtime
ARG DATABASE_URL=postgres://build:build@localhost/build
ARG G99_DATABASE_URL=postgres://build:build@localhost/build
ARG NEXTAUTH_SECRET=build-secret
ARG INTERNAL_API_SECRET=build-secret
ENV DATABASE_URL=$DATABASE_URL
ENV G99_DATABASE_URL=$G99_DATABASE_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV INTERNAL_API_SECRET=$INTERNAL_API_SECRET

RUN bun run build

# ─── Stage 2: Final image ─────────────────────────────────────────────────────
FROM oven/bun:1-debian AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# ── Next.js ───────────────────────────────────────────────────────────────────
COPY --from=web-builder /app/web/public ./web/public
COPY --from=web-builder /app/web/.next ./web/.next
COPY --from=web-builder /app/web/node_modules ./web/node_modules
COPY --from=web-builder /app/web/package.json ./web/package.json
COPY --from=web-builder /app/web/next.config.ts ./web/next.config.ts
COPY --from=web-builder /app/web/scripts ./web/scripts

# ── Cron server ───────────────────────────────────────────────────────────────
COPY cron-server/package.json ./cron-server/package.json
COPY cron-server/bun.lock* ./cron-server/
COPY cron-server/tsconfig.json ./cron-server/tsconfig.json
COPY cron-server/src ./cron-server/src
RUN cd /app/cron-server && bun install --frozen-lockfile

# ── Startup script ────────────────────────────────────────────────────────────
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3000

CMD ["./start.sh"]
