# ── deps ──────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# better-sqlite3 needs native build tools
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Provide dummy values so next build doesn't fail on env validation
ENV ENCRYPTION_KEY="build-placeholder-key-must-be-32chars!"
RUN npm run build

# ── runner ────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# better-sqlite3 needs libstdc++ at runtime
RUN apk add --no-cache libstdc++

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create data directory for SQLite (Railway volume mounts here)
RUN mkdir -p /data && chown nextjs:nodejs /data
ENV DATABASE_PATH=/data/vero.db

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
