# 目录与依赖规范

## 应用目录

| 路径 | 内容 |
| --- | --- |
| `apps/web/src/app` | 当前旧演示入口，待按任务迁入开发区，不作为正式应用层的固定路径 |
| `apps/web/src/online` | 当前真实联机页面与应用组装 |
| `apps/web/src/lobby` | 大厅、背包、商店、强化界面 |
| `apps/web/src/game` | Phaser 场景、地图与实体表现 |
| `apps/web/src/hud` | 战斗界面 |
| `apps/web/src/network` | HTTP、房间连接、消息适配 |
| `apps/web/public` | 无需模块处理的公开静态文件，不存密钥 |
| `apps/room-server/src/rooms` | 房间生命周期和连接管理 |
| `apps/room-server/src/simulation` | 权威模拟的调度与集成 |
| `apps/room-server/src/modes` | 经审核的秘境玩法代码扩展 |
| `apps/room-server/src/settlement` | 本局成果与可信结算提交 |
| `apps/api-server/src/account` | 登录、会话、账号 |
| `apps/api-server/src/character` | 永久角色成长与经营 |
| `apps/api-server/src/inventory` | 永久背包和物资 |
| `apps/api-server/src/economy` | 货币、商店、资产流水 |
| `apps/api-server/src/settlement` | 结算核对、幂等和奖励发放 |

每个应用的启动入口和配置放在其 `src` 或应用根目录，不新建第二个同用途应用。当前联机入口及房间/API 实际代码位置见 [交接文档](current-state.md)；上表业务子目录部分仍是规划，并非已有独立实现。按实际复杂度拆分，避免大量空抽象层。

## 开发与发布目录

- `development/web` 规划为统一开发体验入口，`development/features/<feature-id>` 保存未发布功能；按需包含 `client`、`server`、`content`。
- 开发区复用正式公共能力，正式应用和公共包不反向依赖开发区。具体约束见 [开发区规则](../development/RULES.md)。
- 用户确认后，功能迁入 `apps`、`packages` 或 `content` 对应模块并消除重复实现；正式源码不代表已发布。
- 根 `releases/<release-id>` 仅存生成产物，不手工修改、不提交 Git。客户端和服务器产物分开，只有部署的版本对玩家生效。
- 当前仅定义结构，尚未迁移已有代码；旧演示仍在交接文档记录的位置。开发、转正及环境隔离见 [发布流程](../deploy/release-workflow.md)。

## 公共包

| 包 | 职责 | 允许的依赖方向 |
| --- | --- | --- |
| `contracts` | 网络消息和跨端数据契约 | 保持独立；可使用必要的校验依赖 |
| `simulation` | 纯 TS 战斗数据、数学和规则 | 保持独立，不依赖应用与其他本地包 |
| `content-schema` | 内容配置类型、格式、校验 | 可引用 `contracts`、`simulation` 的公开类型 |
| `content-sdk` | 受控玩法上下文和扩展接口 | 可引用以上公共包 |

应用可依赖这些公共包，公共包不能反向依赖应用。`content-schema` 不依赖 `content-sdk`，避免循环。业务层需要格式转换时在应用适配层完成。

`simulation` 的确定性数据使用普通对象，不使用 Colyseus Schema 类；网络状态由房间适配层映射。

包建立代码时声明 `package.json`、公开导出与直接依赖。当前 `contracts`、`simulation`、`content-schema` 已可运行，`content-sdk` 仅有规则，不能将其当作已配置的运行时包。

## 内容和工具

- `content/common`：审核后的公共内容。
- `content/packs/<pack-id>`：内容包的配置和美术音频资源。
- `tools`：资源/配置处理工具与用户要求时执行的运行验证，不供客户端运行时依赖。
- `deploy`：部署配置，只提交占位或示例配置，不提交真实凭据。
- `docs`：跨领域的代码、技术和目录约定；具体领域规则放在对应模块的 `RULES.md` 或 `rules/` 中。

源配置只保留一份，不在应用中维护副本。当前首包由服务器读取 JSON、客户端构建时引入公开清单/地图；通用导出管线尚未实现。未来含隐藏数据时先分离公开与服务器产物，不能继续整份打包到浏览器。

## 命名和访问

- 目录、包 ID 和内容包 ID 使用小写 kebab-case。
- TypeScript 类型、接口、类使用 PascalCase；变量和函数使用 camelCase。
- 内容 ID 使用 `<pack-id>:<kind>/<name>`，例如 `ruins-survival:enemy/slime`。
- 内容引用使用 ID，不使用跨内容包相对路径。
- 不通过 `../../` 或路径别名绕过包的公开导出。
- 不随意建立 `utils`、`common` 巨型代码模块；共享代码应有明确业务职责。
- 二进制资源规模增加时统一配置 Git LFS，不提交生成缓存和构建产物。

## 规范的位置与发现

- 根 `AGENTS.md` 只说明项目类型、技术栈、目录和读取路由。
- 模块 `AGENTS.md` 是局部导航，`RULES.md` 或 `rules/*.md` 承载具体规则。
- 内容规则按地图、技能、怪物、事件、资源和内容包分类，通过 `content/AGENTS.md` 导航。
- 规则正文只在所属领域维护；其他模块通过链接引用，不复制同一段规则。
- 新增类型同步更新所属入口，新增跨模块任务类型时更新根路由。
- 相对链接以文档所在目录为基准，入口不得要求无条件读取所有规范。

## 所有权

核心维护者管理根配置、依赖、公共包、网络协议、经济和结算。创作者默认仅拥有指定内容包的修改范围。

目录和规范不是实际访问控制。启用远程协作时，应配置受保护分支和必需审核；具体维护者尚未确定，不虚构 CODEOWNERS 账号。不可信外部创作者需要独立提交入口，不能依靠目录约定隔离代码执行。
