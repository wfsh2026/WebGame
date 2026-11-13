#!/usr/bin/env bash
set -euo pipefail
release_dir="$(realpath "${1:?provide an absolute release directory}")"
deployment_dir="$(realpath "${2:-/opt/web-game-online}")"
case "$release_dir" in "$deployment_dir"/releases/*) ;; *) echo 'Release must be inside the deployment releases directory' >&2; exit 1 ;; esac
docker_bin="$deployment_dir/runtime/docker/docker"
if "$docker_bin" container inspect web-game-online-room >/dev/null 2>&1; then
  echo 'Existing room service found. Drain its sessions before replacing it; this script will not interrupt active games.' >&2
  exit 1
fi
"$docker_bin" run --rm --network web-game-online --env-file "$deployment_dir/api.env" --mount "type=bind,src=$release_dir,dst=/app" web-game-online-runtime:24.14.0 node apps/api-server/node_modules/prisma/build/index.js migrate deploy --schema apps/api-server/prisma/schema.prisma
"$docker_bin" run -d --name web-game-online-api --network web-game-online --restart unless-stopped --memory 256m --log-opt max-size=10m --log-opt max-file=3 --env-file "$deployment_dir/api.env" -p 127.0.0.1:13101:3101 --mount "type=bind,src=$release_dir,dst=/app,readonly" web-game-online-runtime:24.14.0
"$docker_bin" run -d --name web-game-online-room --network web-game-online --restart unless-stopped --memory 384m --log-opt max-size=10m --log-opt max-file=3 --env-file "$deployment_dir/room.env" -p 127.0.0.1:13102:3102 --mount "type=bind,src=$release_dir,dst=/app,readonly" web-game-online-runtime:24.14.0 node --import tsx apps/room-server/src/index.ts
ln -sfn "$release_dir" "$deployment_dir/current"
