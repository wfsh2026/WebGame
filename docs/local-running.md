# 本地运行

以下步骤针对当前已有联机实现，不代表新的 development/ 统一开发入口已完成。运行前阅读 [当前限制](implementation/limitations.md)，不连接玩家正式数据库。

需要 Node.js、Corepack 和独立本地 PostgreSQL 数据库。pnpm 已锁定为 12.16.1；其余版本以包清单与锁文件为准。

```powershell
corepack pnpm install --frozen-lockfile
$env:DATABASE_URL = 'postgresql://<本地用户>:<本地密码>@127.0.0.1:5432/<本地数据库>'
$env:INTERNAL_SECRET = '<至少32字符的本地随机值>'
corepack pnpm --filter @web-game-world/api-server db:generate
corepack pnpm --filter @web-game-world/api-server db:deploy
corepack pnpm --filter @web-game-world/api-server start
```

第二个终端设置相同 `INTERNAL_SECRET` 后运行 `corepack pnpm --filter @web-game-world/room-server start`；第三个终端运行 `corepack pnpm --filter @web-game-world/web dev`。根目录另有 `dev:api`、`dev:room`、`dev` 快捷脚本；没有全局 pnpm shim 时优先直接调用各包。

- 默认 API 3101、房间 3102、Vite `127.0.0.1:5173`；真实联机页 `/online.html`，开发代理 `/api`、`/room`。
- 可覆盖 `PORT`、`API_INTERNAL_URL`、`ROOM_INTERNAL_URL`，不要给不同进程误用相同 `PORT`。
- 当前启动脚本不自动读取 `.env`，需显式提供进程环境；占位值不是可用凭据。
- migration 前确认目标是本地数据库，不把线上连接串写入仓库或聊天。
