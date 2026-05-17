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
# Build workspace packages first — they export .ts source (fine for tsx/Next.js
# in dev), but Node.js needs compiled .js at runtime.
RUN pnpm --filter @lexguard/shared exec tsc -p tsconfig.json
RUN pnpm --filter @lexguard/ai exec tsc -p tsconfig.json
# Patch package.json exports to dist/ BEFORE pnpm deploy so the deploy bundle
# picks up compiled output (not the .ts source paths used for local dev).
RUN node -e "
  const fs = require('fs');
  for (const dir of ['packages/shared', 'packages/ai']) {
    const p = dir + '/package.json';
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.main = './dist/index.js';
    if (j.exports) {
      for (const [k, v] of Object.entries(j.exports)) {
        if (typeof v === 'string')
          j.exports[k] = v.replace('./src/', './dist/').replace(/\.ts$/, '.js');
      }
    }
    delete j.types;
    fs.writeFileSync(p, JSON.stringify(j, null, 2));
  }
"
RUN pnpm --filter @lexguard/api build
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
