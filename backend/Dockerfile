# TrustVault Backend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source and database migrations
COPY src/ ./src/
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install curl for container health checks
RUN apk --no-cache add curl

# Create non-root user and private storage directory
RUN addgroup -S trustvault && adduser -S trustvault -G trustvault
RUN mkdir -p storage/uploads && chown -R trustvault:trustvault /app

COPY package*.json ./
RUN npm ci --only=production

# Copy compiled files and migrations
COPY --from=builder /app/dist ./dist
COPY database/ /app/database/

USER trustvault

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
