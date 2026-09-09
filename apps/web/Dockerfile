FROM node:22-alpine AS build
ARG NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN
ARG NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT
ENV NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN=$NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN
ENV NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT=$NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @flashcards/web... build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/apps/web/.next/standalone ./
COPY --from=build /workspace/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
