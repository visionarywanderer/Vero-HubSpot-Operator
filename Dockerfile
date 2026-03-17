# ── build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# better-sqlite3 needs native build tools
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

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

# Copy better-sqlite3 native binding into standalone node_modules
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder /app/node_modules/prebuild-install ./node_modules/prebuild-install
COPY --from=builder /app/node_modules/node-addon-api ./node_modules/node-addon-api

# Create data directory for SQLite (Railway volume mounts here)
RUN mkdir -p /data && chown nextjs:nodejs /data
ENV DATABASE_PATH=/data/vero.db

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
