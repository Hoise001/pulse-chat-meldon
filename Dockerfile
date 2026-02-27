# Stage 1: Build
FROM oven/bun:1.3.5 AS builder
WORKDIR /app

# Vite replaces import.meta.env.VITE_* at build time — they must be available
# as real environment variables when `vite build` runs inside this stage.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY . .
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 bun install
RUN cd apps/server \
    && bun run /app/docker/patch-migrations.ts ./src/db/migrations
RUN cd apps/server && bun run build/build.ts --target linux-x64

# Stage 2: Runtime
FROM oven/bun:1.3.5
COPY --from=builder /app/apps/server/build/out/pulse-linux-x64 /pulse
COPY --from=builder /app/docker/pulse-entrypoint.sh /entrypoint.sh
ENV RUNNING_IN_DOCKER=true

RUN chmod +x /pulse /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
