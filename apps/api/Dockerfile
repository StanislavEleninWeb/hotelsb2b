# Multi-stage build for @hotel/api. Build context MUST be the repo root:
#   docker build -f apps/api/Dockerfile -t hotel-api .
FROM node:22-alpine AS base
RUN npm install -g pnpm@11.22.0
WORKDIR /repo

# --- deps: install with the full workspace manifest set (good layer caching) ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# --- build: compile shared, then the api ---
FROM deps AS build
COPY . .
RUN pnpm --filter @hotel/shared build \
  && pnpm --filter @hotel/api build \
  && pnpm --filter @hotel/api deploy --prod /app

# --- runtime: minimal production image ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 4000
USER node
CMD ["node", "dist/main.js"]
