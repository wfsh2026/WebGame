# 项目入口与规范导航

## 项目类型

纯 Web、俯视角 2D、多人联机肉鸽生存竞技游戏，不使用 Unity。完整秘境由秘境大厅及多轮小秘境组成。

涉及账号入场、房间、阶段切换、轮间成长、玩法完成或奖励结算时，必读 [游戏核心主循环](docs/gameplay/core-loop.md)。该流程为固定规则，不属于共创可修改内容；仅用户明确要求变更核心规则时才可修改。

当前已实现并部署首版联机秘境。继续开发先读 [当前实现与开发交接](docs/current-state.md)中的简要状态与代码入口，再按任务选择相关文档，不一次读取全部实现与历史记录；不要重新搭建已有账号、房间、战斗或资产系统。

## 技术栈约定

- 全栈 TypeScript；客户端 Phaser + React + CSS Modules + Vite。
- Node.js；Colyseus 管理联机协调房间，Fastify 管理大厅业务。
- PostgreSQL + Prisma；JSON + Zod；pnpm workspace。
- 修改技术、依赖或根工程配置时读取 [技术栈约定](docs/technology.md)。

## 目录结构

| 目录 | 用途 |
| --- | --- |
| `development` | 未发布功能的开发验证区，迁移尚未实施 |
| `apps/web` | 网页客户端 |
| `apps/room-server` | 联机协调、必要转发与掉落同步 |
| `apps/api-server` | 账号、大厅、永久资产和结算发放 |
| `packages` | 契约、纯战斗逻辑、内容格式与扩展接口 |
| `content` | 公共内容和独立秘境内容包 |
| `tools` / `deploy` | 内容处理工具 / 部署 |
| `docs` | 跨领域的代码、技术及目录约定 |
| `releases` | 生成的发布产物，不提交 Git，不代表已部署 |

新增模块或调整引用关系时读取 [目录与依赖规则](docs/directory-rules.md)。

## 按任务读取

不要一次读取所有规范。先定位任务类型，再读取对应入口及其明确要求的关联文件；跨领域任务读取涉及的各份规则。相对路径以当前文件所在目录为基准解析。

| 本次任务 | 需要读取 |
| --- | --- |
| 任何代码开发 | [通用代码与协作规范](docs/development.md) |
| 物品等级、槽位解锁、局内构筑成长 | [构筑成长规则](docs/gameplay/build-growth.md)，再按内容和资产领域读取 |
| 新功能开发、开发体验或旧演示迁移 | [开发区入口](development/AGENTS.md)及[先测试网页、确认后正式发布的流程](deploy/release-workflow.md)，再按领域读取规范 |
| 功能转正、发布产物或环境隔离 | [开发与发布流程](deploy/release-workflow.md) |
| 死亡、全队失败、物品损失、装备掉落或经验惩罚 | [死亡与失败惩罚](docs/gameplay/failure-penalties.md)，再读取结算与经济规范 |
| 心法、技能、辅助、战斗供能或攻击计时 | [核心战斗规则](docs/gameplay/core-combat.md)，再按内容或模块入口读取对应规范 |
| 角色、地图、怪物、技能、事件、美术或内容包 | [内容分类入口](content/AGENTS.md)，再选择对应类型 |
| 角色与怪物显示、移动、冲刺、格挡或基础行为 | [实体显示与控制](docs/gameplay/entity-controls.md) |
| 网页界面、游戏表现、输入 | [客户端入口](apps/web/AGENTS.md) |
| 房间、同步、联机协调、玩法运行 | [房间入口](apps/room-server/AGENTS.md) |
| 客户端移动、攻击预测、投射物或怪物连续表现 | [客户端连续表现与同步](docs/gameplay/client-presentation.md)及涉及的客户端、房间或模拟规则 |
| 账号、大厅、角色、背包、商店 | [业务服务入口](apps/api-server/AGENTS.md) |
| 结算或奖励发放 | [结算规则](apps/api-server/rules/settlement.md)及[经济规则](apps/api-server/rules/economy.md) |
| 公共消息或接口契约 | [契约规则](packages/contracts/RULES.md) |
| 可复用战斗算法 | [模拟规则](packages/simulation/RULES.md) |
| 内容字段、格式或导出数据 | [格式规则](packages/content-schema/RULES.md) |
| 新玩法扩展接口 | [扩展规则](packages/content-sdk/RULES.md) |
| 资源与配置工具 | [工具入口](tools/AGENTS.md) |
| 部署配置 | [部署入口](deploy/AGENTS.md) |

文档仅记录已确认规则或可核实事实，不写入待确认事项、未采纳方案或猜测；缺少决定时在对话中提出，确认后再写入。详细要求见 [文档维护规则](docs/development.md#文档维护)。

同一规则只在所属领域文档维护，其他文件保留一句适用说明和链接；新增规则优先修改原文，避免在末尾反复追加。入口只维护导航，新增内容类型时补充对应规则文件和路由。
