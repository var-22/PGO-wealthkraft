# PGO Wealth customer app: one image that serves both the built app and its API on port 4100.
# The calc-service is not part of this image; point CALC_SERVICE_URL at wherever it runs.

# ---- 1. build the frontend ----
FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. backend dependencies (production only) ----
FROM node:22-alpine AS backend-deps
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- 3. the image that runs ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=4100 \
    DATA_DIR=/data

# The backend looks for the built app at ../../frontend/dist from backend/src, so the two folders
# keep the same layout as in the repository.
WORKDIR /app/backend
COPY --from=backend-deps /build/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY --from=frontend /build/frontend/dist /app/frontend/dist

# Users, transactions and the day's analysis live in /data; mount a volume there to keep them.
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4100/api/health || exit 1

CMD ["node", "src/server.js"]
