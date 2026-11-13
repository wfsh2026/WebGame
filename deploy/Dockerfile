FROM node:24.14.0-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api-server ./apps/api-server
COPY apps/room-server ./apps/room-server
COPY content ./content
RUN pnpm install --frozen-lockfile --filter @web-game-world/api-server... --filter @web-game-world/room-server...
RUN pnpm --filter @web-game-world/api-server db:generate
USER node
CMD ["pnpm", "--filter", "@web-game-world/api-server", "start"]
