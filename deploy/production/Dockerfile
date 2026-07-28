# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm assets:brand:check
RUN pnpm exec turbo run build --concurrency=1 \
    --filter=@flashcards/api \
    --filter=@flashcards/web \
    --filter=@flashcards/admin

FROM node:22-bookworm-slim AS runtime

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY --from=builder --chown=node:node /app /app

USER node

CMD ["pnpm", "--filter", "@flashcards/api", "start"]
