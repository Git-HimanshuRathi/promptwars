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
RUN pnpm --filter @lexguard/api build

# Use `pnpm deploy` to create a flat, self-contained node_modules
# bundle that doesn't rely on pnpm's symlinked virtual store.
# This is the recommended way to deploy pnpm monorepo packages to Docker.
RUN pnpm --filter @lexguard/api deploy --prod /deploy

FROM node:20-alpine AS runtime
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production PORT=8080

# Copy the flat deploy bundle
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /deploy/package.json ./
COPY --from=build /repo/apps/api/dist ./dist
# Workspace packages (compiled TS source referenced via workspace:*)
COPY --from=build /repo/packages/shared ./node_modules/@lexguard/shared
COPY --from=build /repo/packages/ai ./node_modules/@lexguard/ai

USER app
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
