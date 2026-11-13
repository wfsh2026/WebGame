# 技术栈约定

全栈使用 TypeScript，启用严格类型检查。浏览器使用 Phaser 表现游戏世界，React 实现大厅、菜单和低频 HUD；Vite 负责前端开发与构建。服务器使用 Node.js，Colyseus 承载秘境房间，Fastify 承载大厅接口。PostgreSQL 保存永久数据，Prisma 处理数据访问。JSON 内容由 Zod 校验。

运行时、框架和依赖已经锁定。以各 `package.json` 和 `pnpm-lock.yaml` 为准，不直接使用浮动版本上线，不为功能任务自行升级。

- 大厅和 HUD 样式使用 CSS Modules；仓库采用 pnpm workspace。
- Prisma 处理 PostgreSQL 数据访问；不在业务模块自行引入第二套 ORM。
- 初期不引入 Redis、消息队列、微服务或完整 ECS 框架。
- 当前已有可运行客户端、房间、API 与数据库；首版范围及启动方式见 [当前实现](current-state.md)。

## 当前锁定版本（2026-11-05）

| 组件 | 版本 |
| --- | --- |
| Node.js / pnpm | 24.14.0 / 12.16.1 |
| Phaser | 3.90.0 |
| React / React DOM | 19.3.1 |
| Vite / TypeScript | 8.3.6 / 7.0.2 |
| Colyseus core / 浏览器 SDK | 0.16.24 / 0.16.22 |
| Fastify | 5.12.8 |
| Prisma | 6.19.3 |
| Zod | 4.6.7 |
| PostgreSQL（测试容器） | 16.11 |

锁文件优先于本表；版本变更后再同步文档。测试服务器当前由 Nginx 直接分发静态资源，未配置 CDN。

## 待确定的产品参数

首版已采用 1～4 人合作、两轮各 180 秒刷怪及 30 秒重连等具体实现，见当前实现文档。目标设备/浏览器、横竖屏、平台通用人数范围、PvP、经营、永久强化影响及完整异常补偿仍待确定。

资源、同步频率和实体数量预算依据这些参数制定，不将临时假设写成正式限制。
