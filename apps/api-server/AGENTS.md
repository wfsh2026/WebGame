# 大厅业务入口

修改本应用前读取 [业务服务规则](RULES.md) 和 [通用代码规范](../../docs/development.md)。角色资产、经济和结算按业务服务规则分别读取领域文件。

当前账号与结算集中在 `src/index.ts`，Schema/migration 位于 `prisma`。已实现与未实现业务见 [当前实现](../../docs/implementation/limitations.md)，不要将网页本地演示视为真实商店、经营或永久强化。
