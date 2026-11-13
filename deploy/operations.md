# 部署操作与现有环境

核对日期：2026-11-05。操作前重新检查现场，不把历史路径和状态当成任意覆盖服务的授权。

## 目标与保护范围

- SSH：`root@47.117.185.109`，内部测试入口 `http://47.117.185.109:8080/online/`。
- 用户要求当前只用 8080 内部测试，暂不开放 80/443；正式环境仍应按部署规范使用 HTTPS/WSS。
- 保留原首页及 `/mhxy/`，不覆盖旧业务目录、资源、进程或 Nginx 主配置。

## 当前实际结构

| 项目 | 值 |
| --- | --- |
| 系统 | Alibaba Cloud Linux 3，约 2 GB 内存 |
| 部署根目录 | `/opt/web-game-online` |
| 发布目录 | `/opt/web-game-online/releases/<release>` |
| 静态软链接 | `/opt/web-game-online/current`，本次指向 `20261105-04` |
| Docker 命令 | `/opt/web-game-online/runtime/docker/docker` |
| Docker 系统服务 | `web-game-docker.service`，已启用自动启动 |
| 运行时镜像 | `web-game-online-runtime:24.14.0`，Node.js、OpenSSL，代码只读挂载 |
| API 容器 | `web-game-online-api`，主机 `127.0.0.1:13101` → 容器 3101 |
| 房间容器 | `web-game-online-room`，主机 `127.0.0.1:13102` → 容器 3102 |
| 数据库容器 | `web-game-online-database`，PostgreSQL 16.11，主机 `127.0.0.1:15432` → 容器 5432 |
| 网络 / 数据卷 | `web-game-online` / `web-game-online-database` |
| Nginx 游戏配置 | `/etc/nginx/default.d/web-game-online.conf`，仅添加 `/online/` 路由 |

本次核对：前端和房间来自 `20261105-04`，API 容器仍挂载 `20261105-02`。切换 `current` 不会改变容器挂载；后续以 `docker inspect` 的 Mounts 为准，不假定所有服务来自同一目录。

Nginx 将 `/online/api/` 转至 API 的 `/api/`，`/online/room/` 转至房间并升级 WebSocket；静态入口默认文件是 `online.html`。发布资源必须使用 `/online/` base。

真实环境文件在部署根目录的 `api.env`、`room.env`、`database.env`，不得将内容、口令、连接串写入仓库、聊天或浏览器资源。API 与房间共享同一 `INTERNAL_SECRET`。

## 部署文件的区别

- 当前现场使用 `runtime.Dockerfile` 对应的运行时镜像、Linux 依赖及 Prisma Client、只读发布目录和独立 Docker 容器。
- `Dockerfile`、`compose.yaml` 是完整镜像/Compose 的另一条定义，未替换当前现场。不要直接在现有环境 `compose up/down`，避免端口冲突、误用另一命名数据卷或影响现有服务。
- `run-release.sh` 不是完整滚动发布器：它假定网络、数据库、镜像、环境文件、依赖和 Prisma Client 已就绪；发现现有房间容器即退出，API 容器仍在时也有名称冲突。先规划服务切换，不直接当更新命令运行。
- 不复制 Windows `node_modules` 到 Linux；Prisma 当前包含 `native` 和 `debian-openssl-3.0.x` 目标，运行环境需要 OpenSSL。

## 发布顺序

1. 确认授权目标，读取正式与测试入口、容器挂载、状态与原站响应；回退产物在本地或服务器外归档，服务器仅保留一个正式版本和一个测试版本，详见 [版本保留与清理规则](release-workflow.md#服务器版本保留与临时内容清理)。
2. 在新发布目录准备代码、锁定依赖和 Linux 运行产物，核对 migration 影响；数据库迁移不是静态切换，不随回退自动撤销或重建数据库。
3. 发布资源构建：`corepack pnpm --filter @web-game-world/web exec vite build --base=/online/`，不额外运行编译检查。
4. 处理现有对局后再切换房间。启动恢复接口当前会将所有 `active` 场次标为 `interrupted`，不能并行启动另一正式房间进程或盲目重启真实对局。
5. 本次发布前核对活动 `Run` 为 0 且等待房间为空；后续必须重新核对。这不是无竞态的自动排空，有玩家进场时等待或安排维护。
6. 容器明确挂载本次目录，API 无变更不必随静态资源重启；切 `current` 后核对新入口和旧站。
7. Nginx 仅在配置变化时语法检查、平滑 reload，不停止原业务；切换完成后核对当前引用并清理旧版本和临时内容。旧页面需要刷新时提示用户，不长期保留旧哈希资源。

## 读取状态

```bash
readlink /opt/web-game-online/current
/opt/web-game-online/runtime/docker/docker ps
curl -fsS http://127.0.0.1:8080/online/api/health
curl -fsS http://127.0.0.1:8080/online/room/health
```

API 健康接口会访问数据库，房间健康接口返回 `ok`，不能单凭健康接口证明认证、战斗、结算或手感正常。测试授权和已有脚本见 [历史验证](../docs/verification/history.md)。

## 回退与维护

- 回退时从本地或服务器外归档重新部署到对应唯一入口，房间/API 须各自核对挂载及协议兼容性，不能只切软链接就宣称服务全量回退；完成后清理被替换版本及临时内容。
- 不删除数据库卷、不重置账号与奖励、不覆盖环境文件，不通过重建数据库修复发布问题。
- 当前没有自动滚动发布、模拟状态持久化、崩溃补偿、定时备份或已验证的全量恢复流程。
- 原首页和 `/mhxy/` 已做过发布前后响应与内容核对，未来仍须按现场重新确认，不能沿用旧结果。
