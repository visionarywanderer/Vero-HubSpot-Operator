# ── build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# better-sqlite3 needs native build tools
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Ensure public dir exists (Next.js standalone expects it)
RUN mkdir -p public

# Provide dummy values so next build doesn't fail on env validation
ENV ENCRYPTION_KEY="build-placeholder-key-must-be-32chars!"
RUN npm run build

# ── runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# better-sqlite3 needs libstdc++ at runtime
RUN apk add --no-cache libstdc++

# Copy standalone build (includes most node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy public-app.json so the dynamic scope reader can find it at runtime
COPY --from=builder /app/hubspot-project/src/app/public-app.json ./hubspot-project/src/app/public-app.json

# Overlay full node_modules so native bindings (better-sqlite3) are present
COPY --from=builder /app/node_modules ./node_modules

# Create data directory for SQLite (Railway volume mounts here)
RUN mkdir -p /data
ENV DATABASE_PATH=/data/vero.db

EXPOSE 8080
CMD ["node", "server.js"]
