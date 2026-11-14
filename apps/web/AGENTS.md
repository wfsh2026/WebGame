# 网页客户端入口

修改代码前读 [客户端规则](RULES.md)和[通用开发规范](../../docs/development.md)，按任务追加读取：

- 角色、怪物、技能表现：[实体显示与控制](../../docs/gameplay/entity-controls.md)。
- 战斗运行及同步：[客户端战斗与关键同步](../../docs/gameplay/client-presentation.md)。
- 美术制作、替换及运行时绘制：[资源规则](../../content/rules/assets.md)。
- 构建、测试网页及发布：[发布流程](../../deploy/release-workflow.md)。

真实联机入口为 `online.html` 和 `src/online/main.tsx`；`src/app`、`lobby`、`combat-lab` 是保留的本地演示，不能作为正式实现依据。
