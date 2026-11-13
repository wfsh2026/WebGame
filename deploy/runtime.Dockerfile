FROM docker.m.daocloud.io/library/node:24.14.0-bookworm-slim
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
USER node
CMD ["node", "--import", "tsx", "apps/api-server/src/index.ts"]
