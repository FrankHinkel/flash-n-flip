# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS builder

ARG API_INTERNAL_URL=http://127.0.0.1:4000

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536
ENV API_INTERNAL_URL=$API_INTERNAL_URL

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm assets:brand:check
RUN pnpm curated:bundle
RUN pnpm exec turbo run build --concurrency=1 \
    --filter=@flashcards/api \
    --filter=@flashcards/web
RUN mkdir -p /runtime \
    && node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/bin/esbuild apps/api/src/rendezvous-runtime.ts \
      --bundle \
      --platform=node \
      --format=cjs \
      --target=node22 \
      --define:process.env.FNF_RENDEZVOUS_RUNTIME_MAIN='"true"' \
      --outfile=/runtime/rendezvous-server.cjs

FROM node:22-bookworm-slim AS api-runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /runtime/rendezvous-server.cjs /app/server.cjs

USER node
CMD ["node", "/app/server.cjs"]

FROM node:22-bookworm-slim AS web-runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone /app
COPY --from=builder --chown=node:node /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public /app/apps/web/public

USER node
CMD ["node", "/app/apps/web/server.js"]
