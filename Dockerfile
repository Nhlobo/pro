# syntax=docker/dockerfile:1.7
# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps with cache-friendly layering.
# npm ci requires package-lock.json to be in sync with package.json — it is,
# as of the regenerated lockfile. --legacy-peer-deps is required because a
# couple of transitive packages (react-day-picker, jspdf-autotable) declare
# older peer ranges than the pinned major versions of their peers
# (date-fns v4, jspdf v4) that this app actually uses; the versions in the
# lockfile are verified to build and run correctly together.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Build the SPA
COPY . .
# Vite needs VITE_* vars at build time. Pass via --build-arg if you self-host.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN npm run build

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


