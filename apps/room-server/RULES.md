# 联机协调与房间运行规范

## 职责

Colyseus 管理联机协调、连接、房间生命周期、必要转发、掉落同步及成果提交；大厅业务管理永久数据保存。客户端运行战斗，职责以 [客户端战斗与关键同步](../../docs/gameplay/client-presentation.md) 为准。

## 房间与断线

- 每个房间具有唯一场次 ID，记录内容版本和规则版本。
- 玩家加入需要服务端认可的身份及入场资格。
- 携带物资的扣除、占用、归还需要由大厅业务服务记录，重试不得重复扣除。
- 断线重连绑定原玩家和场次，不生成额外角色或奖励资格。
- 重连恢复房间协调的最新有效检查点和后续事件，客户端提交状态须匹配原身份、场次和运行归属，不能任意覆盖共享状态。
- 不默认无损退出、无限重连或自动补发奖励。

## 生命周期

阶段推进、轮次结算、个人返回及失败终止分别遵守 [核心主循环](../../docs/gameplay/core-loop.md)与[失败惩罚](../../docs/gameplay/failure-penalties.md)。

整次秘境与每轮小秘境分别记录阶段，冻结本轮成果不终止后续轮次；仅整次会话结束后整体清理，新版本不改变运行中会话的规则。

## 关联规则

- 心法供能、能力计时、取能和触发先读 [核心战斗规则](../../docs/gameplay/core-combat.md)。
- 修改消息先读 ../../packages/contracts/RULES.md。
- 修改战斗算法先读 ../../packages/simulation/RULES.md。
- 新机制先读 ../../packages/content-sdk/RULES.md。
- 提交结算先读 ../api-server/rules/settlement.md。

- 实体移动、冲刺、格挡及怪物基础行为：[实体显示与控制](../../docs/gameplay/entity-controls.md)。
