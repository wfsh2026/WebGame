# 公共包入口

修改代码前读取 [通用代码规范](../docs/development.md)。按目标包选择规则：

- 消息、接口结构：[contracts](contracts/RULES.md)。
- 纯战斗逻辑：[simulation](simulation/RULES.md)。
- 内容字段与校验：[content-schema](content-schema/RULES.md)。
- 玩法扩展接口：[content-sdk](content-sdk/RULES.md)。

新增包、修改导出或依赖关系时读取 [目录与依赖规则](../docs/directory-rules.md)。只读取涉及的包，不自动加载全部包规范。
