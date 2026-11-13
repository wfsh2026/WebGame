# 联机协调房间入口

修改本应用前读取 [房间规则](RULES.md) 和 [通用代码规范](../../docs/development.md)。修改协议、战斗算法、扩展接口或结算时，再读取房间规则中对应的关联文件。

当前实现集中于 `src/index.ts`。修改预测或移动同步时读 [客户端连续表现与同步](../../docs/gameplay/client-presentation.md)；启动或发布前读 [部署操作](../../deploy/operations.md)，注意启动恢复接口会中断活动场次。
