# 大厅业务服务规范

- 使用 Fastify 组织接口，PostgreSQL 保存永久数据，Prisma 处理数据访问。
- account 管理身份和会话，character 管理角色成长与经营，inventory 管理背包，economy 管理货币与商店，settlement 管理奖励发放。
- 客户端请求经过身份、格式和业务权限处理，不能指定可信余额、物品结果或奖励金额。
- 不在本服务实现逐帧战斗；只接受授权房间提交的可信成果。
- 不创建重复资产系统，不将数据库模型直接当作公共接口返回。
- 不在日志中输出凭证、账号隐私、密钥或连接字符串。

## 按任务追加读取

- 角色成长、经营、背包、商店、物资或货币：rules/economy.md。
- 结算、重试和奖励：rules/settlement.md，同时读取 rules/economy.md。
- 修改接口契约：../../packages/contracts/RULES.md。
- 修改房间入场或携带物资：../room-server/RULES.md。
