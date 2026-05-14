# syntax=docker/dockerfile:1.7
# ---------- Build stage ----------
FROM oven/bun:1.1-alpine AS build
WORKDIR /app

# Install deps with cache-friendly layering
COPY package.json bun.lockb* package-lock.json* ./
RUN if [ -f bun.lockb ]; then bun install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then bun install; \
    else bun install; fi

# Build the SPA
COPY . .
# Vite needs VITE_* vars at build time. Pass via --build-arg if you self-host.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN bun run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime

# SPA-aware nginx config with /healthz endpoint
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets
COPY --from=build /app/dist /usr/share/nginx/html

# Run as non-root for K8s/PaaS security contexts
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
 && touch /var/run/nginx.pid \
 && chown nginx:nginx /var/run/nginx.pid
USER nginx

EXPOSE 8080

# Container-level healthcheck (Docker / Compose / some PaaS)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
