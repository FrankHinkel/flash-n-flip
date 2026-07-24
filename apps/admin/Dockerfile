FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @flashcards/admin... build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/apps/admin/.next/standalone ./
COPY --from=build /workspace/apps/admin/.next/static ./apps/admin/.next/static
USER node
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
