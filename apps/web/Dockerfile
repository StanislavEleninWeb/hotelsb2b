# Multi-stage build for @hotel/web. Build context MUST be the repo root:
#   docker build -f apps/web/Dockerfile -t hotel-web .
FROM node:22-alpine AS base
RUN npm install -g pnpm@11.22.0
WORKDIR /repo

# All workspace package.json files must be present or a mid-build `pnpm` invocation
# re-resolves the workspace and triggers a full non-interactive reinstall. This stage
# is discarded (runtime copies only .next/standalone), so installing all workspaces is free.
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/staff/package.json apps/staff/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @hotel/shared build \
  && pnpm --filter @hotel/web build

# Next.js standalone output → minimal runtime image.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
USER node
CMD ["node", "apps/web/server.js"]
