# 当前实现与开发交接

## 当前版本与状态

已实现并部署 `forest-survival`（林地围猎）首版内部联机测试，内容版本 `1.0.0`、协议版本 `1`；记录基准为 2026-11-05，后续以代码和部署现场为准。不得重建已有账号、房间、战斗或资产系统。

本文件仅提供导航和代码入口。按任务读取下表中的相关文档，不要求一次读完全部实现参数、运行命令和历史记录。

## 按任务读取

| 任务 | 文档 |
| --- | --- |
| 修改首版秘境、角色实例或数值 | [首版实现说明](implementation/forest-survival.md) |
| 物品等级、槽位与局内构筑成长 | [构筑成长规范](gameplay/build-growth.md) |
| 查找尚未完成的功能及规则与实现差异 | [实现限制](implementation/limitations.md) |
| 启动本地客户端、API、房间和数据库 | [本地运行](local-running.md) |
| 修改移动、攻击或怪物连续表现 | [客户端连续表现与同步](gameplay/client-presentation.md) |
| 查看已有验证脚本和历史测量 | [历史验证](verification/history.md)；仅在用户要求时执行 |
| 开发新功能或迁移旧演示 | [开发区入口](../development/AGENTS.md) |
| 功能转正、打包及环境隔离 | [开发与发布流程](../deploy/release-workflow.md) |
| 操作现有服务器、发布、重启或回退 | [部署操作](../deploy/operations.md) |

## 关键限制

- 2026-11-13 起采用 [客户端战斗与关键同步](gameplay/client-presentation.md)：客户端运行战斗，服务器保留联机协调、转发、掉落同步及永久保存。代码迁移尚未在本次规范任务中实施，下方入口及历史实现不代表已完成新职责。
- 开发区迁移和独立开发环境未完成；当前网站仍是内部测试入口。
- 独立个人单轮记录、失败物资/装备损失、经验扣除和结算弹窗等已确认规则尚有代码待补齐。
- 商店、经营、永久强化、PvP 和通用内容扩展尚未完成，旧演示不是正式业务。
- 房间启动恢复会中断所有活动场次，操作前必读部署说明，不能盲目重启或并行启动正式房间进程。

## 实际代码入口

| 路径 | 职责 |
| --- | --- |
| `apps/web/online.html`、`src/online/main.tsx` | 真实联机入口、账号、大厅、房间、成长、HUD 和结算 |
| `apps/web/src/network/online.ts` | HTTP 与 Colyseus 适配，使用 Vite `BASE_URL` |
| `apps/web/src/game/online-scene.ts` | Phaser 输入、按帧绘制、静态网格缓存 |
| `apps/web/src/game/presentation-world.ts` | 连续模拟、预测、服务器结果合并、远端校正和效果去重 |
| `packages/simulation/src/index.ts` | 共享属性、移动、供能、攻击、怪物与命中，区分正式模拟与 `presentationOnly` |
| `packages/contracts/src/index.ts` | 网络类型与 Zod 校验，协议版本当前为 `1` |
| `packages/content-schema/src/index.ts` | 首个内容包和受限地图格式的校验，不是完整通用内容平台 |
| `content/packs/forest-survival` | 单份清单、出生点地图与自制 SVG 头像，无隐藏掉落配置 |
| `apps/room-server/src/index.ts` | 认证、阶段、正式模拟、位置输入、快照与成果提交 |
| `apps/api-server/src/index.ts` | 账号、角色初始化、会话、大厅查询和结算路由 |
| `apps/api-server/prisma` | 数据模型与 migration |

API 和房间目前集中于入口文件，尚未拆成规划目录中的各业务模块。后续按复杂度拆分，不假定空目录已有实现。网页 `src/app`、`lobby`、`combat-lab` 是保留的本地演示，不能将演示余额接入真实资产。
