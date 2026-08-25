# Multi-stage build for @hotel/api. Build context MUST be the repo root:
#   docker build -f apps/api/Dockerfile -t hotel-api .
FROM node:22-alpine AS base
RUN npm install -g pnpm@11.22.0
WORKDIR /repo

# --- deps: install with the FULL workspace manifest set. Every workspace package.json
# must be present or pnpm re-resolves mid-build (a `pnpm exec`/`run` deps check would
# trigger a full reinstall). This stage is discarded — the runtime image is built from
# the pruned `pnpm deploy` output, not from here — so installing all workspaces is free. ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/staff/package.json apps/staff/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile

# --- build: compile shared, then the api ---
FROM deps AS build
COPY . .
RUN pnpm --filter @hotel/shared build \
  && pnpm --filter @hotel/api exec prisma generate \
  && pnpm --filter @hotel/api build \
  && pnpm --filter @hotel/api deploy --prod --legacy /app
# `prisma generate` above is required for `nest build` (tsc needs the generated
# @prisma/client types: StaffRole, Channel, …) and produces the client + WASM query
# compiler in the pnpm store (Prisma 7 has no native engine binary). At runtime
# @prisma/client does `require('.prisma/client/default')`, which resolves to a sibling
# `.prisma/client` dir next to the @prisma/client package — but `pnpm deploy` doesn't
# create it. So copy the generated client from the build store into that exact path in
# the pruned /app tree. The final `test` fails the build if the WASM compiler didn't land.
RUN set -e; \
    SRC=$(dirname "$(find /repo/node_modules/.pnpm -name 'query_compiler_fast_bg.wasm' -path '*/.prisma/client/*' | head -1)"); \
    DEST="$(dirname "$(dirname "$(readlink -f /app/node_modules/@prisma/client)")")/.prisma/client"; \
    echo "prisma client: $SRC -> $DEST"; \
    mkdir -p "$DEST"; \
    cp -a "$SRC/." "$DEST/"; \
    test -f "$DEST/query_compiler_fast_bg.wasm"

# --- runtime: minimal production image ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 4000
USER node
CMD ["node", "dist/main.js"]
