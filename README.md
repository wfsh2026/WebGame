# WebGameWorld

纯 Web、俯视角 2D、多人联机肉鸽生存竞技游戏。

玩家在大厅准备角色和物资，进入不同玩法的秘境，通过局内行为获得个人积分，再获得用于大厅成长和经营的结算奖励。

完整秘境由秘境大厅和多轮小秘境组成：休息等待 → 小秘境玩法 → 单轮结算 → 返回秘境大厅成长，循环至全部轮次完成，再最终结算并返回游戏大厅。具体流程见 [游戏核心主循环（固定规则）](docs/gameplay/core-loop.md)，共创内容不得修改该流程。

## 当前状态

已实现并部署“林地围猎”内部联机测试版：真实账号和初始角色、1～4 人房间、自动战斗、三类近战怪物、两轮小秘境、轮间成长及永久奖励结算。

测试入口：<http://47.117.185.109:8080/online/>。用户要求目前仅使用 8080 内部测试，保留原首页及 `/mhxy/`，不自行开放 80/443 或替换原站点。

客户端流畅性优先：本地移动、冲刺和自动攻击即时推进，投射物与怪物逐帧表现；服务器接受合法范围内的客户端位置，裁定实际伤害、生命值、死亡、成果与奖励。不能恢复为“等待服务器回包才移动”。

继续开发先读 [当前实现与开发交接](docs/current-state.md)，即时表现见 [客户端连续表现与同步](docs/gameplay/client-presentation.md)，现有服务器操作见 [部署说明](deploy/operations.md)。

## 技术方向

| 范围 | 技术 |
| --- | --- |
| 统一语言 | TypeScript，严格模式 |
| 游戏表现 | Phaser |
| 大厅与界面 | React、CSS Modules |
| 前端开发与构建 | Vite |
| 权威房间 | Node.js、Colyseus |
| 大厅业务接口 | Node.js、Fastify |
| 持久化 | PostgreSQL、Prisma |
| 内容格式与校验 | JSON、Zod |
| 仓库 | pnpm workspace |
| 部署方向 | Linux、Docker、静态资源 CDN |

依赖已锁定，具体版本以各包清单和 `pnpm-lock.yaml` 为准，不使用浮动版本部署。初期不引入 Redis、消息队列、微服务或完整 ECS 框架。

## 本地启动

先按 [本地运行说明](docs/local-running.md) 配置独立的 PostgreSQL 数据库、进程环境变量和 Prisma Client，再分别运行：

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @web-game-world/api-server start
corepack pnpm --filter @web-game-world/room-server start
corepack pnpm --filter @web-game-world/web dev
```

三个服务在独立终端运行。Vite 默认 `http://127.0.0.1:5173`，真实联机入口是 `/online.html`；`/` 和 `/#combat-lab` 保留为本地演示，不连接正式资产。

根目录也有 `dev:api`、`dev:room`、`dev` 快捷脚本；上面直接调用各包，可避免未启用全局 pnpm shim 时快捷脚本内部找不到 `pnpm`。

## 目录入口

- `apps/web`：网页客户端。
- `apps/room-server`：权威秘境房间。
- `apps/api-server`：账号、大厅、永久资产与奖励发放。
- `packages`：契约、纯战斗逻辑、内容格式、扩展接口。
- `content`：公共内容和独立秘境内容包。
- `tools`：资源、配置处理工具。
- `deploy`：部署配置。
- `docs`：跨领域约定；具体规则在各模块的 `RULES.md` 或 `rules/` 中维护。

`content-sdk` 目前只有规则，通用内容扩展、PvP、经营、商店和装备掉落体系尚未实现；已有演示界面不代表业务已接入。

## 开始协作

先阅读 [AGENTS.md](AGENTS.md)，按任务类型定位模块入口及规则，不需要一次读取所有规范。

例如，调整怪物配置时读取 [内容分类入口](content/AGENTS.md) 和 [怪物规则](content/rules/enemies.md)；修改奖励发放时读取 [业务服务入口](apps/api-server/AGENTS.md) 和 [结算规则](apps/api-server/rules/settlement.md)。

按需读取 [首版参数](docs/implementation/forest-survival.md)、[实现限制](docs/implementation/limitations.md)或[历史验证](docs/verification/history.md)。目标设备、平台通用人数范围、PvP、角色经营及峰值资源预算仍需后续确定，不能把首版参数扩大为全平台规则。
