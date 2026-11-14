# 网页客户端规范

## 支持平台与适配范围

- 第一个版本仅面向电脑浏览器中的网页游玩，界面布局、输入交互及功能效果对照均以电脑网页端为准。
- 手机网页游玩适配不在首版范围内，不要求手机屏幕布局、触屏操作或虚拟摇杆等适配，也不将手机适配问题列为首版交付要求。

## 客户端职责

- Phaser 管理地图、实体、输入、动画、摄像机和特效；React 管理大厅、表单、背包、商店、结算和低频 HUD。
- React 与 Phaser 通过客户端应用层的明确接口交换操作和必要快照，不互读内部对象。当前联机应用组装位于 `src/online`，`src/app` 属于旧演示，不能误作正式入口。
- 不逐帧把完整世界复制到 React 状态，不为弹幕和怪物逐个创建 React 组件。
- Phaser 对象不进入共享战斗模型或服务器消息。
- `src/network` 负责协议适配；战斗、同步、失焦及重连遵守 [客户端战斗与关键同步](../../docs/gameplay/client-presentation.md)。
- 样式使用 CSS Modules，不新增第二套 UI 或状态管理方案。
- 服务器代码、密钥、隐藏掉落表和服务器配置不得进入网页依赖和公开资源。
- 客户端可以降低粒子等表现，但不能减少战斗判定或必要同步。
- 结算界面及个人返回遵守 [核心主循环](../../docs/gameplay/core-loop.md#最终结算界面与返回)。

## 追加读取

- 新功能或旧演示迁移：[开发区入口](../../development/AGENTS.md)；纳入正式源码及发布：[发布流程](../../deploy/release-workflow.md)。当前不因文档约定自动移动既有入口。

- 心法装配、能力触发与供能展示：[核心战斗规则](../../docs/gameplay/core-combat.md)，区分装配操作与自动观察，明确展示资源竞争和缺能原因。
- 大厅、背包、强化、商店：../api-server/rules/economy.md。
- 结算展示：../api-server/rules/settlement.md。
- 网络连接、消息、重连：../../packages/contracts/RULES.md、../room-server/RULES.md。
- 地图、技能或美术表现：../../content/AGENTS.md 中对应内容类型的规范。

- 角色与怪物图像、战斗输入及动作反馈：[实体显示与控制](../../docs/gameplay/entity-controls.md)。
