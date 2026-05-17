# LEXGUARD API — minimal Cloud Run image
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/ai/package.json packages/ai/
RUN pnpm install --frozen-lockfile=false --prod=false

FROM deps AS build
COPY . .
# Compile workspace packages to dist/ — tsc is run directly via cd so pnpm
# filter/exec quirks don't interfere.
RUN cd packages/shared && tsc -p tsconfig.json
RUN cd packages/ai && tsc -p tsconfig.json
# Build API while workspace packages still export ./src/*.ts so TypeScript
# (NodeNext mode) can resolve types from source. Patch happens after.
RUN pnpm --filter @lexguard/api build
# NOW patch exports to dist/ so pnpm deploy bundles compiled output, not .ts
RUN node scripts/patch-exports.cjs
# pnpm deploy creates a flat node_modules with no pnpm symlinks — workspace
# packages are included with the patched package.json + compiled dist/.
RUN pnpm --filter @lexguard/api deploy --prod /deploy

FROM node:20-alpine AS runtime
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production PORT=8080

COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /deploy/package.json ./
COPY --from=build /repo/apps/api/dist ./dist

USER app
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
